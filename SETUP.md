# Turbo Chat Application - Setup & Usage Guide

## Prerequisites

Before starting, ensure you have the following installed:
- **Docker** (version 20.10+) and **Docker Compose** (v2.0+)
- **Git** (to clone the repository)

### Installing Docker on Windows

If you see the error: `'docker' is not recognized as the name of a cmdlet`

1. **Download Docker Desktop for Windows**:
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download and install Docker Desktop
   - Restart your computer after installation

2. **Verify Installation**:
   ```powershell
   docker --version
   docker compose version
   ```

3. **Start Docker Desktop**:
   - Open Docker Desktop from the Start menu
   - Wait until it shows "Docker Desktop is running" in the system tray

**Alternative**: If you cannot install Docker, see [Development Mode (Without Docker)](#development-mode-without-docker) section below.

Optional (for local development without Docker):
- **Go 1.22+** (for backend development)
- **Rust 1.81+** (for file service development)
- **Node.js 20+** and **npm** (for frontend development)
- **PostgreSQL 16+** (or use Docker)
- **Redis 7+** (or use Docker)

## Quick Start (Recommended: Docker Compose)

### Step 1: Clone and Navigate
```bash
git clone <your-repo-url>
cd Turbo
```

### Step 2: Build and Start Services
```bash
docker compose up --build
```

This will:
- Start PostgreSQL on port 5432
- Start Redis on port 6379
- Build and start the Go backend on port 8080
- Build and start the Rust file service on port 8090
- Build and start the Next.js frontend on port 3000

**Note**: First build may take 5-10 minutes to download base images and compile.

### Step 3: Verify Services Are Running

Check that all containers are up:
```bash
docker compose ps
```

You should see 5 services: `postgres`, `redis`, `backend`, `file`, and `frontend`.

### Step 4: Access the Application

1. **Frontend (Web UI)**: Open your browser to http://localhost:3000
2. **Backend API**: http://localhost:8080/api/health (should return "ok")
3. **File Service**: http://localhost:8090/upload (POST endpoint)

## Using the Application

### Registration & Authentication

1. **Navigate to Login Page**:
   - Open http://localhost:3000/login
   - Or click "Login" if there's a navigation menu

2. **Register a New User**:
   - Enter an email (e.g., `user@example.com`)
   - Enter a password (e.g., `password123`)
   - Click **"Register"** button
   - You should see: "Registered. Now login."

3. **Login**:
   - Use the same email and password
   - Click **"Login"** button
   - A JWT token will be displayed (store this for API calls)

### Real-Time Chat

1. **Navigate to Chat**:
   - Go to http://localhost:3000
   - This opens the main chat interface

2. **Send Messages**:
   - Type a message in the input field
   - Click **"Send"** or press Enter
   - Your message appears in the chat window
   - Open multiple browser tabs/windows to see real-time sync

3. **Test Real-Time**:
   - Open http://localhost:3000 in two different browser tabs
   - Send a message from one tab
   - It should appear instantly in the other tab via WebSocket

## Testing the Backend API

### Using curl

**1. Health Check**:
```bash
curl http://localhost:8080/api/health
# Response: ok
```

**2. Register**:
```bash
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
# Response: 201 Created
```

**3. Login**:
```bash
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
# Response: {"token":"eyJhbGc..."}
```

**4. WebSocket Test** (using `wscat`):
```bash
# Install wscat: npm install -g wscat
wscat -c ws://localhost:8080/ws

# In wscat, send:
{"text":"Hello from terminal","author":"test"}

# Messages will broadcast to all connected clients
```

## File Upload Service

### Test File Upload

**Using curl**:
```bash
curl -X POST http://localhost:8090/upload \
  -F "file=@/path/to/your/file.txt"
# Response: {"filename":"file.txt","size":1234,"status":"stored"}
```

**Note**: Currently returns a stub response. To enable S3 uploads, set AWS credentials in environment variables.

## Development Mode (Without Docker)

**Use this if you cannot or prefer not to use Docker.**

### Prerequisites for Development Mode

Install separately:
- **Go 1.22+**: https://go.dev/dl/
- **PostgreSQL 16+**: https://www.postgresql.org/download/windows/
- **Redis 7+**: https://github.com/microsoftarchive/redis/releases (or use WSL)
- **Node.js 20+**: https://nodejs.org/
- **Rust** (optional, for file service): https://www.rust-lang.org/tools/install

### Backend (Go)

**Windows PowerShell**:
```powershell
cd backend/go

# Install dependencies
go mod download

# Set environment variables (PowerShell)
$env:POSTGRES_URL="postgres://postgres:postgres@localhost:5432/turbo?sslmode=disable"
$env:REDIS_ADDR="localhost:6379"
$env:JWT_SECRET="dev-secret-change-me"

# Run
go run main.go
```

**Linux/Mac**:
```bash
cd backend/go

# Install dependencies
go mod download

# Set environment variables
export POSTGRES_URL="postgres://postgres:postgres@localhost:5432/turbo?sslmode=disable"
export REDIS_ADDR="localhost:6379"
export JWT_SECRET="dev-secret-change-me"

# Run
go run main.go
```

### File Service (Rust)

```bash
cd services/file-upload

# Set environment (optional for S3)
export AWS_REGION="us-east-1"
export S3_BUCKET="your-bucket"

# Run
cargo run
```

### Frontend (Next.js)

**Windows PowerShell**:
```powershell
cd frontend

# Install dependencies
npm install

# Set environment variables (PowerShell)
$env:NEXT_PUBLIC_API_URL="http://localhost:8080"
$env:NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"

# Run development server
npm run dev
```

**Linux/Mac**:
```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_API_URL="http://localhost:8080"
export NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"

# Run development server
npm run dev
```

**Note**: Alternatively, create a `.env.local` file in the `frontend` directory:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

## Database Management

### Access PostgreSQL

```bash
# Using Docker
docker compose exec postgres psql -U postgres -d chat

# Or connect from host (if port 5432 is exposed)
psql -h localhost -U postgres -d chat
```

**Useful SQL commands**:
```sql
-- List users
SELECT id, email FROM users;

-- View messages (if you add a messages table later)
SELECT * FROM messages ORDER BY created_at DESC;

-- Clean up
TRUNCATE TABLE users;
```

### Access Redis

```bash
# Using Docker
docker compose exec redis redis-cli

# In redis-cli:
KEYS *
PUBSUB CHANNELS
SUBSCRIBE chat:global
```

## Load Testing

### Setup Locust

```bash
# Install Locust
pip install locust

# Navigate to locust directory
cd locust

# Start Locust
locust -f locustfile.py --host=http://localhost:8080
```

### Run Load Tests

1. Open http://localhost:8089 in your browser
2. Set:
   - **Number of users**: 100
   - **Spawn rate**: 10
   - **Host**: http://localhost:8080
3. Click **"Start swarming"**
4. Monitor metrics in real-time

## Troubleshooting

### Docker Command Not Found (Windows)

**Error**: `'docker' is not recognized as the name of a cmdlet`

**Solution**:
1. Install Docker Desktop for Windows from https://www.docker.com/products/docker-desktop/
2. After installation, restart your computer
3. Open Docker Desktop application (must be running)
4. Open a new PowerShell window and try again:
   ```powershell
   docker --version
   docker compose version
   ```

**If Docker is installed but still not found**:
- Make sure Docker Desktop is running (check system tray)
- Close and reopen PowerShell/terminal
- Verify Docker is in PATH: `$env:PATH` should contain Docker paths

### Docker Desktop Unable to Start

**Error**: `Error response from daemon: Docker Desktop is unable to start` or `unable to get image 'redis:7-alpine': unexpected end of JSON input`

**Solution**:

1. **Check WSL2 (Most Common Fix)**:
   ```powershell
   # Check WSL status
   wsl --status
   
   # If kernel is missing, update it (requires Administrator)
   wsl --update
   
   # Restart your computer after updating
   ```

2. **Restart Docker Desktop**:
   ```powershell
   # Stop all Docker processes
   Get-Process "*Docker*" | Stop-Process -Force
   
   # Wait a few seconds
   Start-Sleep -Seconds 5
   
   # Start Docker Desktop
   Start-Process "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
   
   # Wait 30-60 seconds for Docker to start
   ```

3. **Run Automated Fix Script**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File fix-docker.ps1
   ```

4. **For detailed troubleshooting**, see `DOCKER_FIX.md`

**Alternative**: If Docker continues to fail, use [Development Mode (Without Docker)](#development-mode-without-docker) to run the application without Docker.

### Services Won't Start

**Check logs**:
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
docker compose logs redis
```

### Database Connection Issues

1. Ensure PostgreSQL is running:
   ```bash
   docker compose ps postgres
   ```

2. Check connection string in `docker-compose.yml`:
   ```yaml
   POSTGRES_URL: postgres://postgres:postgres@postgres:5432/turbo?sslmode=disable
   ```

### WebSocket Not Connecting

1. Verify backend is running: `curl http://localhost:8080/api/health`
2. Check browser console for WebSocket errors
3. Ensure `NEXT_PUBLIC_WS_URL` is set correctly in frontend

### Port Already in Use

If ports are occupied:
```bash
# Find process using port
# Windows:
netstat -ano | findstr :8080
# Linux/Mac:
lsof -i :8080

# Stop Docker containers
docker compose down

# Or change ports in docker-compose.yml
```

## Stopping the Application

```bash
# Stop all services (keeps data)
docker compose stop

# Stop and remove containers (keeps volumes)
docker compose down

# Stop and remove everything including volumes (deletes data)
docker compose down -v
```

## Next Steps

### For Production Deployment

1. **Update K8s manifests**:
   - Replace `YOUR_REGISTRY` with your container registry
   - Update image tags in `k8s/*.yaml`

2. **Set up secrets**:
   ```bash
   kubectl create secret generic backend-secrets \
     --from-literal=jwt=your-production-jwt-secret \
    -n turbo
   ```

3. **Apply manifests**:
   ```bash
   kubectl apply -f k8s/
   ```

4. **Configure Ingress**:
   - Update `k8s/ingress.yaml` with your domain
   - Install NGINX Ingress Controller if needed

### Enhancements to Try

- Add message persistence to PostgreSQL
- Implement channels/rooms
- Add file upload UI in frontend
- Integrate actual S3 uploads in Rust service
- Add user presence indicators
- Implement message history pagination

## Support

For issues or questions:
1. Check logs: `docker compose logs [service-name]`
2. Verify environment variables
3. Ensure all prerequisites are installed
4. Review the README.md for architecture details
