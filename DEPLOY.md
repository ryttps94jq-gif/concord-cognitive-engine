# Concord Deployment Guide

This guide covers deploying Concord to a production server with Docker.

## Prerequisites

- A server with Docker and Docker Compose installed
- A domain name pointed to your server's IP
- Ports 80 and 443 open

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url> concord
cd concord

# Copy and edit environment file
cp .env.example .env
nano .env  # Update DOMAIN, NEXT_PUBLIC_API_URL, etc.
```

### 2. Update Nginx Configuration

Edit `nginx/conf.d/default.conf`:
- Replace `yourdomain.com` with your actual domain (3 places)
- Update SSL certificate paths

### 3. Initial Setup (Before SSL)

For first-time deployment, start with HTTP only to get SSL certificates:

```bash
# Use the initial HTTP config
mv nginx/conf.d/default.conf nginx/conf.d/default.conf.ssl
cp nginx/conf.d/initial-http.conf.example nginx/conf.d/default.conf

# Update the domain in the initial config
nano nginx/conf.d/default.conf

# Start the services
docker-compose up -d backend frontend nginx

# Get SSL certificate
docker-compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# Restore SSL config
mv nginx/conf.d/default.conf.ssl nginx/conf.d/default.conf

# Restart nginx
docker-compose restart nginx
```

### 4. Full Deployment

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | Next.js web app |
| backend | 5050 | Node.js API server |
| nginx | 80, 443 | Reverse proxy with SSL |
| certbot | - | SSL certificate management |
| ollama | 11434 | Local LLM (optional) |

## Configuration

### Environment Variables

See `.env.example` for all available options. Key variables:

```bash
DOMAIN=yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
OLLAMA_HOST=http://ollama:11434
```

### Data Persistence

Data is stored in Docker volumes:
- `concord-data`: DTUs, events, configurations
- `ollama-data`: Downloaded LLM models

To backup:
```bash
docker run --rm -v concord-data:/data -v $(pwd):/backup alpine tar czf /backup/concord-backup.tar.gz /data
```

### GPU Support for Ollama

To enable GPU acceleration for Ollama, uncomment the GPU section in `docker-compose.yml`:

```yaml
ollama:
  ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

## Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Update SSL certificates manually
docker-compose run --rm certbot renew

# Shell into container
docker-compose exec backend sh

# Check health
curl https://yourdomain.com/api/status
```

## Troubleshooting

### SSL Certificate Issues

```bash
# Check certificate status
docker-compose run --rm certbot certificates

# Force renewal
docker-compose run --rm certbot renew --force-renewal
docker-compose restart nginx
```

### Backend Not Responding

```bash
# Check logs
docker-compose logs backend

# Verify health
docker-compose exec backend curl http://localhost:5050/api/status
```

### Frontend Build Errors

```bash
# Rebuild with no cache
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Security Checklist

- [ ] Changed default SESSION_SECRET in .env
- [ ] Updated ALLOWED_ORIGINS to only your domain
- [ ] SSL certificates installed and working
- [ ] HSTS header enabled (after confirming SSL works)
- [ ] Firewall configured (only 80, 443 open)
- [ ] Regular backups configured
- [ ] Monitoring/alerts set up

## Updating

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build

# If database migrations needed
docker-compose exec backend npm run migrate  # if applicable
```
