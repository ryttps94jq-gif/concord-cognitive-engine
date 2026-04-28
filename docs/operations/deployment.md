# Deployment Guide

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm
- Ollama (optional — required only for AI/brain features)

### Server

```bash
git clone <repo>
cd server
npm install
cp .env.example .env   # set JWT_SECRET and ADMIN_PASSWORD at minimum
node migrate.js        # initialize SQLite database
node server.js         # starts on :5050
```

### Frontend

Open a separate terminal:

```bash
cd concord-frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:5050 npm run dev   # starts on :3000
```

### Mobile (optional)

```bash
cd concord-mobile
npm install
npx expo start
```

---

## Environment Variables

| Name | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `ci` enables test mode; `production` tightens security |
| `PORT` | no | `5050` | Server listen port |
| `DATA_DIR` | no | `./data` | Directory for SQLite database files |
| `JWT_SECRET` | **yes (production)** | — | JWT signing secret (minimum 32 characters) |
| `ADMIN_PASSWORD` | **yes (production)** | — | Admin account password |
| `OLLAMA_HOST` | no | `http://localhost:11434` | Ollama inference base URL |
| `BRAIN_CONSCIOUS_URL` | no | `$OLLAMA_HOST` | Primary reasoning model endpoint |
| `BRAIN_SUBCONSCIOUS_URL` | no | `$OLLAMA_HOST` | Background reasoning model endpoint |
| `BRAIN_UTILITY_URL` | no | `$OLLAMA_HOST` | Utility model endpoint |
| `BRAIN_REPAIR_URL` | no | `$OLLAMA_HOST` | Self-repair model endpoint |
| `REDIS_URL` | no | — | Optional Redis for pub/sub; falls back to in-memory if unset |
| `AUTH_MODE` | no | — | `public` skips auth for reads; `ci` for integration test runs |

---

## Docker

### Backend

```bash
docker build -t concord-backend ./server
docker run \
  -e JWT_SECRET=<strong-secret> \
  -e ADMIN_PASSWORD=<strong-password> \
  -e DATA_DIR=/data \
  -v concord-data:/data \
  -p 5050:5050 \
  concord-backend
```

### Frontend

```bash
docker build -t concord-frontend ./concord-frontend
docker run \
  -e NEXT_PUBLIC_API_URL=http://backend:5050 \
  -p 3000:3000 \
  concord-frontend
```

A `docker-compose.yml` is provided at the repo root for running both services together.

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` set to a strong random value (≥32 characters)
- [ ] `ADMIN_PASSWORD` set to a strong value
- [ ] Persistent volume mounted at `DATA_DIR` (SQLite database must survive restarts)
- [ ] Reverse proxy (nginx or Caddy) in front of both services; TLS terminated at the proxy
- [ ] `REDIS_URL` configured if running multiple server replicas (in-memory pub/sub does not work across processes)
- [ ] Log aggregation pointed at stdout/stderr of both containers
- [ ] Health endpoint monitored: `GET /health` on the backend returns `{ status, dtuCount, ... }`
