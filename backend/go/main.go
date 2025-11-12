package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	neturl "net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	nsq "github.com/nsqio/go-nsq"
	"sync"
	"github.com/rs/cors"
)

type serverDeps struct {
	db     *pgxpool.Pool
	nsqProd *nsq.Producer
	jwtKey []byte
}

type user struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

// in-memory set of active websocket connections for broadcasting incoming NSQ messages
var clients = make(map[*websocket.Conn]bool)
var clientsMu sync.Mutex

func main() {
	ctx := context.Background()
	// prefer Supabase-provided Postgres URL if present (set SUPABASE_DB_URL),
	// otherwise fall back to DATABASE_URL, POSTGRES_URL, or a local default.
	pgURL := getenv("SUPABASE_DB_URL", getenv("DATABASE_URL", getenv("POSTGRES_URL", "postgres://postgres:postgres@localhost:5432/turbo?sslmode=disable")))
	switch {
	case os.Getenv("SUPABASE_DB_URL") != "":
		log.Printf("using SUPABASE_DB_URL for Postgres connection")
	case os.Getenv("DATABASE_URL") != "":
		log.Printf("using DATABASE_URL for Postgres connection (likely Supabase)")
	case os.Getenv("POSTGRES_URL") != "":
		log.Printf("using POSTGRES_URL for Postgres connection")
	default:
		log.Printf("using default local Postgres connection string")
	}
	jwtKey := []byte(getenv("JWT_SECRET", "dev-secret"))

	// DNS diagnostic: attempt to resolve the hostname from the Postgres URL
	func() {
		if u, err := neturl.Parse(pgURL); err == nil {
			host := u.Host
			// strip port if present
			if h, _, err := net.SplitHostPort(host); err == nil {
				host = h
			}
			if host != "" {
				addrs, err := net.LookupIP(host)
				if err != nil {
					log.Printf("dns lookup for %s failed: %v", host, err)
				} else {
					for _, a := range addrs {
						log.Printf("dns: %s -> %s", host, a.String())
					}
				}
			}
		} else {
			log.Printf("failed to parse pgURL for DNS diagnostic: %v", err)
		}
	}()

	db, err := pgxpool.New(ctx, pgURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	if err := db.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	// Ensure storage folder exists for uploads
	_ = os.MkdirAll("./uploads", 0755)

	// ensure tables exist: users, messages, images
	_, _ = db.Exec(ctx, `CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash BYTEA NOT NULL, display_name TEXT, avatar_url TEXT, bio TEXT);`)
	_, _ = db.Exec(ctx, `CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, text TEXT, created_at TIMESTAMPTZ DEFAULT now(), recipient TEXT);`)
	_, _ = db.Exec(ctx, `CREATE TABLE IF NOT EXISTS images (id BIGSERIAL PRIMARY KEY, message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE, url TEXT NOT NULL, filename TEXT, filesize BIGINT, created_at TIMESTAMPTZ DEFAULT now());`)

	// initialize NSQ producer
	nsqdAddr := getenv("NSQD_ADDR", "localhost:4150")
	prod, err := nsq.NewProducer(nsqdAddr, nsq.NewConfig())
	if err != nil {
		log.Fatalf("nsq producer: %v", err)
	}

	deps := &serverDeps{db: db, nsqProd: prod, jwtKey: jwtKey}

	// Start a single NSQ consumer for the "chat" topic and broadcast messages to all connected websockets
	consumer, err := nsq.NewConsumer("chat", "channel_turbo", nsq.NewConfig())
	if err != nil {
		log.Fatalf("nsq consumer: %v", err)
	}
	consumer.AddHandler(nsq.HandlerFunc(func(m *nsq.Message) error {
		var v any
		_ = json.Unmarshal(m.Body, &v)
		clientsMu.Lock()
		defer clientsMu.Unlock()
		for c := range clients {
			// best-effort write; ignore errors so one bad connection doesn't stop broadcasts
			_ = c.WriteJSON(v)
		}
		return nil
	}))
	if err := consumer.ConnectToNSQD(nsqdAddr); err != nil {
		log.Fatalf("nsq consumer connect: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/register", deps.handleRegister)
	mux.HandleFunc("/api/login", deps.handleLogin)
	mux.HandleFunc("/api/upload", deps.handleUpload)
	mux.HandleFunc("/api/messages", deps.handleMessages)
	mux.HandleFunc("/api/profile", deps.handleProfile)
	mux.HandleFunc("/api/sign-upload", deps.handleSignUpload)
	mux.HandleFunc("/api/friends", deps.handleFriends)
	mux.HandleFunc("/ws", deps.handleWS)
	// serve uploaded files
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	handler := cors.AllowAll().Handler(mux)

	addr := ":8080"
	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}

func (s *serverDeps) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		http.Error(w, "missing", http.StatusBadRequest)
		return
	}
	// Simplified: store password hash; for demo only.
	pwHash := sha256.Sum256([]byte(req.Password))
	// insert user record (display_name/avatar handled separately)
	_, err := s.db.Exec(r.Context(), `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING;`, req.Email, pwHash[:], req.Email)
	if err != nil {
		http.Error(w, "db", http.StatusInternalServerError)
		return
	}
	// return the user object
	var id int64
	err = s.db.QueryRow(r.Context(), `SELECT id FROM users WHERE email=$1;`, req.Email).Scan(&id)
	if err != nil {
		http.Error(w, "db", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "email": req.Email})
}

func (s *serverDeps) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	var id int64
	var stored []byte
	err := s.db.QueryRow(r.Context(), `SELECT id, password_hash FROM users WHERE email=$1;`, req.Email).Scan(&id, &stored)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	pwHash := sha256.Sum256([]byte(req.Password))
	if string(pwHash[:]) != string(stored) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   id,
		"email": req.Email,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
	})
	sToken, err := token.SignedString(s.jwtKey)
	if err != nil {
		http.Error(w, "token", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"token": sToken, "user": map[string]any{"id": id, "email": req.Email}})
}

// validateToken parses a bearer token or raw token and returns a user (or nil)
func (s *serverDeps) validateToken(tokenStr string) *user {
	if tokenStr == "" {
		return nil
	}
	// strip "Bearer " if present
	if len(tokenStr) > 7 && tokenStr[:7] == "Bearer " {
		tokenStr = tokenStr[7:]
	}
	// If SUPABASE_URL is set, validate the token via Supabase Auth endpoint
	if supa := os.Getenv("SUPABASE_URL"); supa != "" {
		req, _ := http.NewRequest("GET", supa+"/auth/v1/user", nil)
		req.Header.Set("Authorization", "Bearer "+tokenStr)
		// include anon key if available
		if k := os.Getenv("SUPABASE_ANON_KEY"); k != "" {
			req.Header.Set("apikey", k)
		}
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				var u map[string]any
				if err := json.NewDecoder(resp.Body).Decode(&u); err == nil {
					// u may contain id and email
					var uid int64
					switch v := u["id"].(type) {
					case float64:
						uid = int64(v)
					case int64:
						uid = v
					case string:
						// Supabase user id is string (uuid) — we cannot map to int64; return email-only
						uid = 0
					}
					email, _ := u["email"].(string)
					return &user{ID: uid, Email: email}
				}
			}
		}
		// if Supabase validation failed, fall through to local JWT validation
	}

	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) { return s.jwtKey, nil })
	if err != nil || !tok.Valid {
		return nil
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil
	}
	var uid int64
	switch v := claims["sub"].(type) {
	case float64:
		uid = int64(v)
	case int64:
		uid = v
	default:
		uid = 0
	}
	email, _ := claims["email"].(string)
	return &user{ID: uid, Email: email}
}

func (s *serverDeps) handleWS(w http.ResponseWriter, r *http.Request) {
	// WebSocket handler: clients must send an initial {type:"auth", token: "..."} message to authenticate.
	var connUser *user

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "upgrade", http.StatusBadRequest)
		return
	}
	defer conn.Close()

	ctx := r.Context()

	// register connection for broadcasts
	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()
	defer func() {
		clientsMu.Lock()
		delete(clients, conn)
		clientsMu.Unlock()
	}()

	// Reader goroutine: read messages from this websocket and publish to NSQ
	go func() {
		for {
			var msg map[string]any
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}
			// Handle auth handshake
			if t, _ := msg["type"].(string); t == "auth" {
				tokenStr, _ := msg["token"].(string)
				if u := s.validateToken(tokenStr); u != nil {
					connUser = u
					// send back a confirmation
					_ = conn.WriteJSON(map[string]any{"type": "auth_ok", "user": map[string]any{"id": u.ID, "email": u.Email}})
				} else {
					_ = conn.WriteJSON(map[string]any{"type": "auth_fail"})
				}
				continue
			}

			// If this is a chat message, require auth
			if t, _ := msg["type"].(string); t == "message" {
				if connUser == nil {
					// require authentication
					_ = conn.WriteJSON(map[string]any{"type": "error", "reason": "unauthenticated"})
					continue
				}
				text, _ := msg["text"].(string)
				// support recipient for DMs
				var recipient string
				if to, ok := msg["to"].(string); ok {
					recipient = to
				} else if rcv, ok := msg["recipient"].(string); ok {
					recipient = rcv
				}
				// insert message including recipient
				var mid int64
				var created time.Time
				err := s.db.QueryRow(ctx, `INSERT INTO messages (user_id, text, created_at, recipient) VALUES ($1, $2, now(), $3) RETURNING id, created_at;`, connUser.ID, text, recipient).Scan(&mid, &created)
				if err == nil {
					msg["id"] = mid
					msg["ts"] = created.UnixMilli()
					// attach author metadata so consumers can show display name/avatar
					var auid int64
					var aemail, adisplay, aavatar *string
					_ = s.db.QueryRow(ctx, `SELECT id, email, display_name, avatar_url FROM users WHERE id=$1`, connUser.ID).Scan(&auid, &aemail, &adisplay, &aavatar)
					authorObj := map[string]any{"id": auid}
					if aemail != nil {
						authorObj["email"] = *aemail
					}
					if adisplay != nil {
						authorObj["display_name"] = *adisplay
					}
					if aavatar != nil {
						authorObj["avatar_url"] = *aavatar
					}
					msg["author"] = authorObj
					// handle images metadata if present
					if imgs, ok := msg["images"].([]any); ok && len(imgs) > 0 {
						for _, im := range imgs {
							if m, ok := im.(map[string]any); ok {
								url, _ := m["url"].(string)
								filename, _ := m["filename"].(string)
								filesize := int64(0)
								if fs, ok := m["filesize"].(float64); ok {
									filesize = int64(fs)
								}
								_, _ = s.db.Exec(ctx, `INSERT INTO images (message_id, url, filename, filesize) VALUES ($1,$2,$3,$4);`, mid, url, filename, filesize)
							}
						}
					}
				}
			}
			// publish to NSQ so the consumer will broadcast to all connected websockets
			if s.nsqProd != nil {
				_ = s.nsqProd.Publish("chat", []byte(mustJSON(msg)))
			}
		}
	}()

	// Note: incoming NSQ messages are broadcast by the consumer to all active connections.
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func (s *serverDeps) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}

	// simple auth via Authorization header
	token := r.Header.Get("Authorization")
	u := s.validateToken(token)
	if u == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// limit to 50MB
	err := r.ParseMultipartForm(50 << 20)
	if err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "bad file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// save file
	fname := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(handler.Filename))
	dstPath := filepath.Join("./uploads", fname)
	out, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, "server", http.StatusInternalServerError)
		return
	}
	defer out.Close()
	size, _ := io.Copy(out, file)

	// build URL (BASE_URL env optional)
	base := getenv("BASE_URL", "http://localhost:8080")
	url := fmt.Sprintf("%s/uploads/%s", base, fname)

	_ = json.NewEncoder(w).Encode(map[string]any{"url": url, "filename": handler.Filename, "filesize": size})
}

// handleSignUpload issues a signed upload URL using the Supabase Storage REST API
// Expects JSON body: { bucket: string, path: string, expiresIn?: int }
func (s *serverDeps) handleSignUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	// require auth (optional) to avoid abuse
	token := r.Header.Get("Authorization")
	if s.validateToken(token) == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Bucket    string `json:"bucket"`
		Path      string `json:"path"`
		ExpiresIn int    `json:"expiresIn"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.Bucket == "" || body.Path == "" {
		http.Error(w, "missing", http.StatusBadRequest)
		return
	}
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	supa := os.Getenv("SUPABASE_URL")
	if serviceKey == "" || supa == "" {
		http.Error(w, "server-misconfigured", http.StatusInternalServerError)
		return
	}
	// call Supabase REST to sign an upload URL
	signPath := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", supa, body.Bucket, body.Path)
	req, _ := http.NewRequest(http.MethodPost, signPath, nil)
	q := req.URL.Query()
	if body.ExpiresIn > 0 {
		q.Set("expiresIn", fmt.Sprintf("%d", body.ExpiresIn))
	}
	req.URL.RawQuery = q.Encode()
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("apikey", serviceKey)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "sign-failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		http.Error(w, "sign-failed", http.StatusInternalServerError)
		return
	}
	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		http.Error(w, "bad response", http.StatusInternalServerError)
		return
	}
	// build public URL (Supabase storage public URL pattern)
	public := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supa, body.Bucket, body.Path)
	out["publicUrl"] = public
	_ = json.NewEncoder(w).Encode(out)
}

// handleFriends returns a lightweight list of users (id, email, display_name, avatar_url)
func (s *serverDeps) handleFriends(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	rows, err := s.db.Query(ctx, `SELECT id, email, display_name, avatar_url FROM users ORDER BY id DESC LIMIT 100`)
	if err != nil {
		http.Error(w, "db", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var email, display, avatar *string
		_ = rows.Scan(&id, &email, &display, &avatar)
		m := map[string]any{"id": id}
		if email != nil {
			m["email"] = *email
		}
		if display != nil {
			m["display_name"] = *display
		}
		if avatar != nil {
			m["avatar_url"] = *avatar
		}
		out = append(out, m)
	}
	_ = json.NewEncoder(w).Encode(out)
}

// handleProfile updates the current user's profile (display_name, avatar_url, bio)
func (s *serverDeps) handleProfile(w http.ResponseWriter, r *http.Request) {
	// Support GET for profile lookup and POST for updates
	switch r.Method {
	case http.MethodGet:
		// allow ?email= or use Authorization header to identify current user
		qEmail := r.URL.Query().Get("email")
		ctx := r.Context()
		var email string
		if qEmail != "" {
			email = qEmail
		} else {
			token := r.Header.Get("Authorization")
			u := s.validateToken(token)
			if u == nil || u.Email == "" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			email = u.Email
		}
		var id int64
		var displayName, avatarUrl, bio *string
		err := s.db.QueryRow(ctx, `SELECT id, display_name, avatar_url, bio FROM users WHERE email=$1`, email).Scan(&id, &displayName, &avatarUrl, &bio)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		out := map[string]any{"id": id, "email": email}
		if displayName != nil {
			out["display_name"] = *displayName
		}
		if avatarUrl != nil {
			out["avatar_url"] = *avatarUrl
		}
		if bio != nil {
			out["bio"] = *bio
		}
		_ = json.NewEncoder(w).Encode(out)
		return
	case http.MethodPost:
		token := r.Header.Get("Authorization")
		u := s.validateToken(token)
		if u == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// parse body
		var body struct {
			DisplayName string `json:"display_name"`
			AvatarURL   string `json:"avatar_url"`
			Bio         string `json:"bio"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// find or create user record
		var id int64
		if u.ID != 0 {
			id = u.ID
		} else {
			// lookup by email
			if u.Email == "" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			err := s.db.QueryRow(ctx, `SELECT id FROM users WHERE email=$1`, u.Email).Scan(&id)
			if err != nil {
				// create a user record if not exists (no password)
				err2 := s.db.QueryRow(ctx, `INSERT INTO users (email, display_name) VALUES ($1,$2) RETURNING id`, u.Email, u.Email).Scan(&id)
				if err2 != nil {
					http.Error(w, "db", http.StatusInternalServerError)
					return
				}
			}
		}

		// If avatar changed, attempt to remove the old avatar file from Supabase Storage (best-effort)
		var oldAvatar *string
		_ = s.db.QueryRow(ctx, `SELECT avatar_url FROM users WHERE id=$1`, id).Scan(&oldAvatar)
		_, err := s.db.Exec(ctx, `UPDATE users SET display_name=$1, avatar_url=$2, bio=$3 WHERE id=$4`, body.DisplayName, body.AvatarURL, body.Bio, id)
		if err != nil {
			http.Error(w, "db", http.StatusInternalServerError)
			return
		}
		if oldAvatar != nil && *oldAvatar != "" && body.AvatarURL != "" && *oldAvatar != body.AvatarURL {
			// attempt deletion using service role key
			go func(pubUrl string) {
				serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
				supa := os.Getenv("SUPABASE_URL")
				if serviceKey == "" || supa == "" {
					return
				}
				// parse expected pattern: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
				prefix := supa + "/storage/v1/object/public/"
				if !strings.HasPrefix(pubUrl, prefix) {
					return
				}
				key := strings.TrimPrefix(pubUrl, prefix)
				// key is "<bucket>/<path>" — split once
				parts := strings.SplitN(key, "/", 2)
				if len(parts) != 2 {
					return
				}
				bucket := parts[0]
				objPath := parts[1]
				deleteURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supa, bucket, objPath)
				req, _ := http.NewRequest(http.MethodDelete, deleteURL, nil)
				req.Header.Set("Authorization", "Bearer "+serviceKey)
				req.Header.Set("apikey", serviceKey)
				client := &http.Client{Timeout: 10 * time.Second}
				_, _ = client.Do(req)
			}(*oldAvatar)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id})
		return
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
}

func (s *serverDeps) handleMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	limit := 50
	// parse ?limit
	if l := r.URL.Query().Get("limit"); l != "" {
		// ignore parse errors, keep default
	}

	rows, err := s.db.Query(ctx, `SELECT m.id, m.text, m.created_at, m.recipient, u.id, u.email, u.display_name, u.avatar_url FROM messages m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT  $1`, limit)
	if err != nil {
		http.Error(w, "db", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type msgOut struct {
		ID        int64            `json:"id"`
		Text      string           `json:"text"`
		Ts        int64            `json:"ts"`
		Recipient *string          `json:"to,omitempty"`
		Author    map[string]any   `json:"author"`
		Images    []map[string]any `json:"images"`
	}

	var out []msgOut
	for rows.Next() {
		var id int64
		var text string
		var created time.Time
		var recipient *string
		var uid *int64
		var email *string
		var displayName *string
		var avatarUrl *string
		_ = rows.Scan(&id, &text, &created, &recipient, &uid, &email, &displayName, &avatarUrl)
		var author map[string]any
		if uid != nil || email != nil {
			author = map[string]any{}
			if uid != nil {
				author["id"] = *uid
			}
			if email != nil {
				author["email"] = *email
			}
			if displayName != nil {
				author["display_name"] = *displayName
			}
			if avatarUrl != nil {
				author["avatar_url"] = *avatarUrl
			}
		} else {
			author = nil
		}
		// load images
		imgs := []map[string]any{}
		irows, _ := s.db.Query(ctx, `SELECT url, filename, filesize FROM images WHERE message_id=$1`, id)
		for irows.Next() {
			var url, filename string
			var filesize int64
			_ = irows.Scan(&url, &filename, &filesize)
			imgs = append(imgs, map[string]any{"url": url, "filename": filename, "filesize": filesize})
		}
		irows.Close()
		// include recipient and author metadata (display_name/avatar handled in author_extended)
		mo := msgOut{ID: id, Text: text, Ts: created.UnixMilli(), Recipient: recipient, Author: author, Images: imgs}
		out = append(out, mo)
	}

	// return newest last
	// reverse
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	_ = json.NewEncoder(w).Encode(out)
}
