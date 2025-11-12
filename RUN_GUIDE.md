# How to Run the Turbo Chat Application

## Quick Start (Using Docker Compose) ✅

### Step 1: Build and Start All Services

Open PowerShell in the project directory and run:

```powershell
docker compose up --build
```

This command will:
- ✅ Build all Docker images (backend, frontend, file service)
- ✅ Download required images (PostgreSQL, Redis)
- ✅ Start all 5 services:
  - PostgreSQL (database) on port 5432
  - Redis (cache/pubsub) on port 6379
  - Go Backend (API) on port 8080
  - Rust File Service on port 8090
  - Next.js Frontend (web UI) on port 3000

**Note**: First build may take 5-10 minutes to download images and compile.

### Step 2: Access the Application

Once all services are running, open your browser:

1. **Frontend (Main Application)**: http://localhost:3000
2. **Backend API Health Check**: http://localhost:8080/api/health
3. **File Service**: http://localhost:8090/upload

### Step 3: Use the Application

1. **Register a new user**:
   - Go to http://localhost:3000/login
   - Enter email and password
   - Click "Register"

2. **Login**:
   - Use your registered email and password
   - Click "Login"
   - You'll receive a JWT token

3. **Chat**:
   - Go to http://localhost:3000
   - Send messages in real-time
   - Open multiple browser tabs to see real-time sync

## Useful Commands

### Check Service Status
```powershell
docker compose ps
```
Should show 5 services running: `postgres`, `redis`, `backend`, `file`, `frontend`

### View Logs
```powershell
# All services
docker compose logs

# Specific service
docker compose logs frontend
docker compose logs backend

# Follow logs in real-time
docker compose logs -f
```

### Stop Services
```powershell
# Stop but keep containers
docker compose stop

# Stop and remove containers (keeps data)
docker compose down

# Stop and remove everything including data
docker compose down -v
```

### Restart Services
```powershell
# Restart all services
docker compose restart

# Restart specific service
docker compose restart frontend
```

### Rebuild After Code Changes
```powershell
# Rebuild and restart
docker compose up --build

# Rebuild specific service
docker compose build frontend
docker compose up frontend
```

## Troubleshooting

### If a Service Fails to Start

1. **Check logs**:
   ```powershell
   docker compose logs [service-name]
   ```

2. **Rebuild specific service**:
   ```powershell
   docker compose build --no-cache [service-name]
   docker compose up [service-name]
   ```

3. **Check if ports are in use**:
   ```powershell
   # Windows
   netstat -ano | findstr :3000
   netstat -ano | findstr :8080
   ```

### If Docker Won't Start

See `DOCKER_FIX.md` or `ERROR_REVIEW.md` for troubleshooting steps.

## Running in Background (Detached Mode)

To run services in the background:

```powershell
docker compose up -d --build
```

Then view logs:
```powershell
docker compose logs -f
```

Stop background services:
```powershell
docker compose down
```

## Development Mode (Without Docker)

If you prefer to run services directly without Docker:

See `SETUP.md` → **"Development Mode (Without Docker)"** section.

This requires installing:
- Go 1.22+
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Rust 1.81+ (optional, for file service)

## Next Steps

1. ✅ Run `docker compose up --build`
2. ✅ Open http://localhost:3000
3. ✅ Register and login
4. ✅ Start chatting!

For more details, see `SETUP.md`.
