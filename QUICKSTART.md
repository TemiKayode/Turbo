# Quick Start Reference Card

## ⚠️ Prerequisites
- **Docker Desktop** must be installed and running
- If you see `'docker' is not recognized`, install Docker Desktop from https://www.docker.com/products/docker-desktop/
- See [SETUP.md](./SETUP.md) for detailed installation instructions or running without Docker

## 🚀 Start Everything
```bash
docker compose up --build
```

## 🌐 Access URLs
| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Web UI |
| **Login** | http://localhost:3000/login | Register/Login page |
| **Backend Health** | http://localhost:8080/api/health | API health check |
| **File Upload** | http://localhost:8090/upload | File upload endpoint (POST) |

## 👤 First Time User Flow
1. Open http://localhost:3000/login
2. Enter email & password → Click **Register**
3. Click **Login** → Copy JWT token (if needed)
4. Go to http://localhost:3000 → Start chatting!

## 🧪 Test API (curl)
```bash
# Health check
curl http://localhost:8080/api/health

# Register
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## 🛑 Stop Services
```bash
# Stop (keep data)
docker compose stop

# Stop & remove (keep volumes)
docker compose down

# Stop & remove everything
docker compose down -v
```

## 📊 Check Status
```bash
# View running containers
docker compose ps

# View logs
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

## 🔍 Troubleshooting
```bash
# Rebuild specific service
docker compose up --build backend

# Check service logs
docker compose logs -f backend

# Restart a service
docker compose restart backend
```

## 📚 More Info
- **Detailed Guide**: See [SETUP.md](./SETUP.md)
- **Architecture**: See [README.md](./README.md)
