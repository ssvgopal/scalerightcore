#!/bin/bash
# Backup Script for Orchestrall Platform
# This script creates comprehensive backups of the platform

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="orchestrall_backup_${DATE}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Database configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-orchestrall_prod}
DB_USER=${DB_USER:-orchestrall}
DB_PASSWORD=${DB_PASSWORD:-secure_password_123}

# S3 configuration (optional)
S3_BUCKET=${S3_BUCKET:-orchestrall-backups}
AWS_REGION=${AWS_REGION:-us-east-1}

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_PATH}/backup.log"
}

# Create backup directory
mkdir -p "${BACKUP_PATH}"

log "Starting Orchestrall Platform backup: ${BACKUP_NAME}"

# 1. Database Backup
log "Creating database backup..."
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --verbose --no-password --format=custom --compress=9 \
    --file="${BACKUP_PATH}/database.dump"

if [ $? -eq 0 ]; then
    log "Database backup completed successfully"
else
    log "ERROR: Database backup failed"
    exit 1
fi

# 2. Redis Backup
log "Creating Redis backup..."
redis-cli -h redis -p 6379 -a redis_secure_password --rdb "${BACKUP_PATH}/redis.rdb"

if [ $? -eq 0 ]; then
    log "Redis backup completed successfully"
else
    log "ERROR: Redis backup failed"
fi

# 3. Application Data Backup
log "Backing up application data..."
if [ -d "/app/uploads" ]; then
    tar -czf "${BACKUP_PATH}/uploads.tar.gz" -C /app uploads
    log "Uploads backup completed"
fi

if [ -d "/app/logs" ]; then
    tar -czf "${BACKUP_PATH}/logs.tar.gz" -C /app logs
    log "Logs backup completed"
fi

# 4. Configuration Backup
log "Backing up configuration files..."
if [ -f "/app/.env" ]; then
    cp /app/.env "${BACKUP_PATH}/env.backup"
fi

if [ -d "/app/k8s" ]; then
    tar -czf "${BACKUP_PATH}/k8s-config.tar.gz" -C /app k8s
fi

# 5. Create backup manifest
log "Creating backup manifest..."
cat > "${BACKUP_PATH}/manifest.json" << EOF
{
    "backup_name": "${BACKUP_NAME}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "2.0.0",
    "components": {
        "database": {
            "file": "database.dump",
            "size": "$(du -h "${BACKUP_PATH}/database.dump" | cut -f1)"
        },
        "redis": {
            "file": "redis.rdb",
            "size": "$(du -h "${BACKUP_PATH}/redis.rdb" | cut -f1)"
        },
        "uploads": {
            "file": "uploads.tar.gz",
            "size": "$(du -h "${BACKUP_PATH}/uploads.tar.gz" | cut -f1)"
        },
        "logs": {
            "file": "logs.tar.gz",
            "size": "$(du -h "${BACKUP_PATH}/logs.tar.gz" | cut -f1)"
        }
    },
    "total_size": "$(du -sh "${BACKUP_PATH}" | cut -f1)"
}
EOF

# 6. Compress entire backup
log "Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

BACKUP_FILE="${BACKUP_NAME}.tar.gz"
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

log "Backup compressed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# 7. Upload to S3 (if configured)
if [ -n "${S3_BUCKET}" ] && [ -n "${AWS_ACCESS_KEY_ID}" ]; then
    log "Uploading backup to S3..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/" \
        --region "${AWS_REGION}" \
        --storage-class STANDARD_IA
    
    if [ $? -eq 0 ]; then
        log "Backup uploaded to S3 successfully"
    else
        log "ERROR: S3 upload failed"
    fi
fi

# 8. Cleanup old backups
log "Cleaning up old backups..."
find "${BACKUP_DIR}" -name "orchestrall_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# 9. Verify backup integrity
log "Verifying backup integrity..."
if [ -f "${BACKUP_FILE}" ]; then
    BACKUP_CHECKSUM=$(sha256sum "${BACKUP_FILE}" | cut -d' ' -f1)
    echo "${BACKUP_CHECKSUM}" > "${BACKUP_FILE}.sha256"
    log "Backup checksum: ${BACKUP_CHECKSUM}"
else
    log "ERROR: Backup file not found"
    exit 1
fi

# 10. Send notification (if configured)
if [ -n "${SLACK_WEBHOOK}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Orchestrall backup completed: ${BACKUP_NAME} (${BACKUP_SIZE})\"}" \
        "${SLACK_WEBHOOK}"
fi

log "Backup completed successfully: ${BACKUP_FILE}"
log "Backup size: ${BACKUP_SIZE}"
log "Backup checksum: ${BACKUP_CHECKSUM}"

exit 0
