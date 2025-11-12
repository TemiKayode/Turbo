<<<<<<< HEAD

=======
# Turbo
<<<<<<< HEAD
Portfolio-ready real-time chat platform showcasing backend concurrency in Go, a high-performance Rust microservice for file uploads, a Next.js frontend, Docker/K8s deployment, and CI/CD via GitLab
=======

Turbo is a full-stack, real-time messaging platform designed as a portfolio-quality showcase of modern distributed application patterns. It combines a Go realtime API, a Rust-powered file pipeline, and a Next.js client with refined branding to deliver a production-style developer experience from local dev to Kubernetes.

---

## ✨ Highlights

- **Realtime messaging** via WebSockets backed by Postgres, Redis, and NSQ for fan-out.
- **Supabase-friendly auth** with support for local JWTs or delegated Supabase validation.
- **Media pipeline** built in Rust (Actix) for secure uploads and future S3 integration.
- **Modern UI** in Next.js + TypeScript with a Turbo-branded component system.
- **DevOps ready** with Docker Compose, Kubernetes manifests, and GitLab CI examples.
- **Load testing toolkit** using Locust to stress-test the chat workload.

---

## 🧱 Architecture at a Glance

```
frontend/         Next.js application (chat UI, profile management)
backend/go/       Go API + WS server (auth, messaging, uploads, Supabase hooks)
services/file-upload/
                  Rust microservice for file ingestion
scripts/          Dev tooling & automation (e.g. avatar extraction)
k8s/              Kubernetes manifests (namespace, ingress, deployments, services, stateful data)
locust/           Load testing scenarios
```

Supporting docs: [`SETUP.md`](./SETUP.md), [`RUN_GUIDE.md`](./RUN_GUIDE.md), [`QUICKSTART.md`](./QUICKSTART.md).

---

## 🚀 Quick Start (Local)

1. **Clone & install**
   ```bash
   git clone https://github.com/TemiKayode/Turbo.git
   cd Turbo/frontend
   npm install
   ```

2. **Configure environment (do not commit)**
   Create `frontend/.env.local` with:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   NEXT_PUBLIC_API_URL=http://localhost:8080
   NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
   ```
   Optionally set backend env vars in PowerShell:
   ```powershell
   $env:SUPABASE_DB_URL="postgres://postgres:postgres@localhost:5432/turbo?sslmode=disable"
   $env:JWT_SECRET="dev-secret"
   ```

3. **Bring everything up**
   ```bash
   docker compose up --build
   ```
   - Frontend: <http://localhost:3000>
   - API health: <http://localhost:8080/api/health>
   - File service: <http://localhost:8090>

4. **Chat**
   Visit <http://localhost:3000/login>, register, then head to `/` to start messaging. Profile uploads leverage the Rust service + Supabase signed URLs.

---

## 🧪 Developer Tooling

- `npm run dev` – hot reload the Next.js client.
- `cd backend/go && go run main.go` – run the API directly.
- `node scripts/extract-avi.js` – regenerate the Turbo avatar asset from the brand artwork.
- `npm run lint` – lint the frontend with Next.js ESLint rules.
- `cd locust && locust -f locustfile.py` – launch load tests against the messaging endpoints.

---

## ☁️ Deploying to Kubernetes

Dockerize the services, push to your registry, then:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/file.yaml
kubectl apply -f k8s/ingress.yaml
```
Patch image references and secrets to match your environment before applying.

---

## 🔐 Security Notes

- Supabase keys, JWT secrets, and database credentials **must** stay out of git. `frontend/.env.local` and `.env` files are already `.gitignore`d.
- `backend/start.ps1` uses interactive prompts to avoid printing secrets.
- Set `SUPABASE_SERVICE_ROLE_KEY` via secure secret stores (GitLab/Actions/Kubernetes) when enabling signed uploads.

---

## 🤝 Contributing & Next Steps

Ideas to explore:
- Presence metrics broadcast from the Go backend for richer UI status.
- Production S3 wiring for the Rust file service.
- CI/CD pipeline hookup to GitHub Actions.

We welcome issues and PRs. See `ERROR_ANALYSIS.md` and `FIX_APPLIED.md` for recent troubleshooting history.

---

## 📄 License

MIT © 2025 Temi Kayode

---

Happy hacking from Team Turbo! ⚡
>>>>>>> 6f65fcb (Prepare Turbo project for GitHub release)
>>>>>>> 9274da9 (Prepare Turbo project for GitHub release)
