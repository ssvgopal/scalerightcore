# Orchestrall Platform Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Development Deployment](#development-deployment)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Monitoring Setup](#monitoring-setup)
7. [SSL Configuration](#ssl-configuration)
8. [Backup Configuration](#backup-configuration)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD, Recommended 100GB+ SSD
- **Network**: Stable internet connection with ports 80, 443, 22 open

### Software Requirements
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: Version 2.25+
- **Node.js**: Version 18+ (for development)
- **PostgreSQL**: Version 15+ (if not using Docker)
- **Redis**: Version 7+ (if not using Docker)

### Domain and SSL
- **Domain Name**: Configured DNS pointing to your server
- **SSL Certificate**: Valid SSL certificate (Let's Encrypt recommended)
- **Email**: SMTP server for notifications

## Environment Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip software-properties-common

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/orchestrall-platform.git
cd orchestrall-platform

# Checkout the appropriate branch
git checkout main  # or develop for staging
```

### 3. Environment Configuration

```bash
# Copy environment template
cp deployment/environments/production.env.example .env.production

# Edit environment variables
nano .env.production
```

**Required Environment Variables:**
```bash
# Application Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/orchestrall
POSTGRES_PASSWORD=your_secure_postgres_password

# Redis Configuration
REDIS_URL=redis://:your_secure_password@redis:6379
REDIS_PASSWORD=your_secure_redis_password

# Security Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters
ENCRYPTION_KEY=your_encryption_key_here_32_characters_exactly

# API Keys (Configure based on your needs)
OPENAI_API_KEY=your_openai_api_key
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Monitoring
GRAFANA_PASSWORD=your_grafana_admin_password
```

## Development Deployment

### 1. Quick Start

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Check logs
docker-compose -f docker-compose.dev.yml logs -f app

# Access the application
open http://localhost:3000
```

### 2. Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev:zero-config

# Run linting
npm run lint

# Generate Prisma client
npx prisma generate
```

## Staging Deployment

### 1. Staging Server Setup

```bash
# Create staging directory
sudo mkdir -p /opt/orchestrall-staging
sudo chown $USER:$USER /opt/orchestrall-staging
cd /opt/orchestrall-staging

# Clone repository
git clone https://github.com/your-org/orchestrall-platform.git .
git checkout develop

# Copy staging environment
cp deployment/environments/staging.env.example .env.staging
nano .env.staging
```

### 2. Deploy to Staging

```bash
# Build and start services
docker-compose -f docker-compose.staging.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.staging.yml exec app npx prisma migrate deploy

# Seed initial data
docker-compose -f docker-compose.staging.yml exec app npx prisma db seed

# Check health
curl -f http://localhost:3000/health
```

### 3. Staging Verification

```bash
# Test all endpoints
curl -f http://localhost:3000/health/database
curl -f http://localhost:3000/health/redis
curl -f http://localhost:3000/health/full

# Access admin dashboard
open http://localhost:3000/admin

# Check monitoring
open http://localhost:3001  # Grafana
open http://localhost:9090  # Prometheus
```

## Production Deployment

### 1. Production Server Setup

```bash
# Create production directory
sudo mkdir -p /opt/orchestrall
sudo chown $USER:$USER /opt/orchestrall
cd /opt/orchestrall

# Clone repository
git clone https://github.com/your-org/orchestrall-platform.git .
git checkout main

# Copy production environment
cp deployment/environments/production.env.example .env.production
nano .env.production
```

### 2. SSL Certificate Setup

```bash
# Install Certbot
sudo apt install -y certbot

# Generate SSL certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to nginx directory
sudo mkdir -p /opt/orchestrall/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/orchestrall/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/orchestrall/ssl/key.pem
sudo chown $USER:$USER /opt/orchestrall/ssl/*
```

### 3. Production Deployment

```bash
# Build and start services
docker-compose -f docker-compose.production.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.production.yml exec app npx prisma migrate deploy

# Seed initial data
docker-compose -f docker-compose.production.yml exec app npx prisma db seed

# Verify deployment
curl -f https://yourdomain.com/health
```

### 4. Production Verification

```bash
# Test all health endpoints
curl -f https://yourdomain.com/health
curl -f https://yourdomain.com/health/database
curl -f https://yourdomain.com/health/redis
curl -f https://yourdomain.com/health/full

# Test API endpoints
curl -f https://yourdomain.com/api/entities

# Access admin dashboard
open https://yourdomain.com/admin

# Check monitoring
open https://yourdomain.com:3001  # Grafana
open https://yourdomain.com:9090  # Prometheus
```

## Monitoring Setup

### 1. Grafana Dashboard Access

```bash
# Default Grafana credentials
Username: admin
Password: (from GRAFANA_PASSWORD environment variable)

# Access Grafana
open http://yourdomain.com:3001
```

### 2. Prometheus Metrics

```bash
# Access Prometheus
open http://yourdomain.com:9090

# Check targets
curl http://yourdomain.com:9090/api/v1/targets
```

### 3. Log Management

```bash
# View application logs
docker-compose -f docker-compose.production.yml logs -f app

# View all service logs
docker-compose -f docker-compose.production.yml logs -f

# Access Kibana for log analysis
open http://yourdomain.com:5601
```

## SSL Configuration

### 1. Automatic SSL Renewal

```bash
# Create renewal script
sudo nano /etc/cron.d/certbot-renewal

# Add cron job
0 12 * * * root certbot renew --quiet --post-hook "docker-compose -f /opt/orchestrall/docker-compose.production.yml restart nginx"
```

### 2. SSL Security Headers

The nginx configuration includes:
- HSTS (HTTP Strict Transport Security)
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### 3. SSL Testing

```bash
# Test SSL configuration
curl -I https://yourdomain.com

# Check SSL rating
# Visit: https://www.ssllabs.com/ssltest/
```

## Backup Configuration

### 1. Database Backup

```bash
# Manual backup
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U postgres orchestrall > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
sudo nano /opt/orchestrall/backup-script.sh
```

**Backup Script:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/orchestrall/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="orchestrall_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
docker-compose -f /opt/orchestrall/docker-compose.production.yml exec -T postgres pg_dump -U postgres orchestrall > $BACKUP_DIR/$BACKUP_FILE

# Compress backup
gzip $BACKUP_DIR/$BACKUP_FILE

# Remove old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### 2. Automated Backup Schedule

```bash
# Make script executable
chmod +x /opt/orchestrall/backup-script.sh

# Add to crontab
crontab -e

# Add backup schedule (daily at 2 AM)
0 2 * * * /opt/orchestrall/backup-script.sh
```

### 3. Backup Restoration

```bash
# Restore from backup
gunzip -c backup_file.sql.gz | docker-compose -f docker-compose.production.yml exec -T postgres psql -U postgres orchestrall
```

## Troubleshooting

### 1. Common Issues

**Database Connection Issues:**
```bash
# Check database status
docker-compose -f docker-compose.production.yml ps postgres

# Check database logs
docker-compose -f docker-compose.production.yml logs postgres

# Test database connection
docker-compose -f docker-compose.production.yml exec app npx prisma db push
```

**Application Won't Start:**
```bash
# Check application logs
docker-compose -f docker-compose.production.yml logs app

# Check environment variables
docker-compose -f docker-compose.production.yml exec app env

# Restart application
docker-compose -f docker-compose.production.yml restart app
```

**SSL Issues:**
```bash
# Check SSL certificate
openssl x509 -in /opt/orchestrall/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect yourdomain.com:443

# Check nginx configuration
docker-compose -f docker-compose.production.yml exec nginx nginx -t
```

### 2. Performance Issues

**High Memory Usage:**
```bash
# Check memory usage
docker stats

# Restart services
docker-compose -f docker-compose.production.yml restart

# Scale services if needed
docker-compose -f docker-compose.production.yml up -d --scale app=2
```

**Slow Database Queries:**
```bash
# Check database performance
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres orchestrall -c "SELECT * FROM pg_stat_activity;"

# Analyze slow queries
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres orchestrall -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### 3. Log Analysis

```bash
# View real-time logs
docker-compose -f docker-compose.production.yml logs -f --tail=100

# Search logs for errors
docker-compose -f docker-compose.production.yml logs app | grep ERROR

# Export logs
docker-compose -f docker-compose.production.yml logs > orchestrall_logs_$(date +%Y%m%d).txt
```

## Maintenance

### 1. Regular Maintenance Tasks

**Weekly Tasks:**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker images
docker system prune -f

# Check disk space
df -h

# Review logs for errors
docker-compose -f docker-compose.production.yml logs --since=7d | grep ERROR
```

**Monthly Tasks:**
```bash
# Update application dependencies
npm audit fix

# Review security updates
npm audit

# Check SSL certificate expiration
openssl x509 -in /opt/orchestrall/ssl/cert.pem -noout -dates

# Review backup integrity
ls -la /opt/orchestrall/backups/
```

### 2. Updates and Upgrades

**Application Updates:**
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build

# Run migrations
docker-compose -f docker-compose.production.yml exec app npx prisma migrate deploy
```

**Docker Updates:**
```bash
# Update Docker
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io

# Update Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Security Maintenance

**Security Updates:**
```bash
# Check for security vulnerabilities
npm audit

# Update dependencies
npm update

# Review access logs
docker-compose -f docker-compose.production.yml logs nginx | grep -E "(401|403|404)"
```

**Firewall Configuration:**
```bash
# Install UFW
sudo apt install ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## Support and Resources

### Documentation
- [API Documentation](docs/api/openapi.yaml)
- [User Manual](docs/user-manual.md)
- [Architecture Guide](docs/architecture.md)

### Monitoring
- **Grafana Dashboard**: https://yourdomain.com:3001
- **Prometheus Metrics**: https://yourdomain.com:9090
- **Application Health**: https://yourdomain.com/health

### Support Channels
- **Email**: support@orchestrall.ai
- **Documentation**: https://docs.orchestrall.ai
- **GitHub Issues**: https://github.com/your-org/orchestrall-platform/issues

---

**Note**: This deployment guide assumes a standard Linux server setup. Adjust commands and paths as needed for your specific environment.
