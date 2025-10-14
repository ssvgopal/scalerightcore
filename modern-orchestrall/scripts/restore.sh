#!/bin/bash
# Disaster Recovery Script for Orchestrall Platform
# This script restores the platform from a backup

set -e

# Configuration
BACKUP_DIR="/backups"
RESTORE_DIR="/tmp/restore"
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-orchestrall_prod}
DB_USER=${DB_USER:-orchestrall}
DB_PASSWORD=${DB_PASSWORD:-secure_password_123}

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${RESTORE_DIR}/restore.log"
}

# Usage
usage() {
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 orchestrall_backup_20241201_120000.tar.gz"
    exit 1
}

# Check if backup file is provided
if [ $# -ne 1 ]; then
    usage
fi

BACKUP_FILE="$1"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

if [ ! -f "${BACKUP_PATH}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_PATH}"
    exit 1
fi

# Create restore directory
mkdir -p "${RESTORE_DIR}"
cd "${RESTORE_DIR}"

log "Starting disaster recovery from backup: ${BACKUP_FILE}"

# 1. Verify backup integrity
log "Verifying backup integrity..."
if [ -f "${BACKUP_PATH}.sha256" ]; then
    EXPECTED_CHECKSUM=$(cat "${BACKUP_PATH}.sha256")
    ACTUAL_CHECKSUM=$(sha256sum "${BACKUP_PATH}" | cut -d' ' -f1)
    
    if [ "${EXPECTED_CHECKSUM}" != "${ACTUAL_CHECKSUM}" ]; then
        log "ERROR: Backup checksum mismatch"
        log "Expected: ${EXPECTED_CHECKSUM}"
        log "Actual: ${ACTUAL_CHECKSUM}"
        exit 1
    fi
    log "Backup integrity verified"
else
    log "WARNING: No checksum file found, skipping integrity check"
fi

# 2. Extract backup
log "Extracting backup..."
tar -xzf "${BACKUP_PATH}" -C "${RESTORE_DIR}"

BACKUP_NAME=$(basename "${BACKUP_FILE}" .tar.gz)
BACKUP_CONTENT="${RESTORE_DIR}/${BACKUP_NAME}"

if [ ! -d "${BACKUP_CONTENT}" ]; then
    log "ERROR: Backup extraction failed"
    exit 1
fi

log "Backup extracted to: ${BACKUP_CONTENT}"

# 3. Read backup manifest
if [ -f "${BACKUP_CONTENT}/manifest.json" ]; then
    log "Backup manifest:"
    cat "${BACKUP_CONTENT}/manifest.json" | jq .
else
    log "WARNING: No manifest file found"
fi

# 4. Stop application services
log "Stopping application services..."
kubectl scale deployment orchestrall-app --replicas=0 -n orchestrall || true
sleep 10

# 5. Restore database
log "Restoring database..."
if [ -f "${BACKUP_CONTENT}/database.dump" ]; then
    # Drop existing database and recreate
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
    
    # Restore database
    PGPASSWORD="${DB_PASSWORD}" pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        --verbose --no-password --clean --if-exists \
        "${BACKUP_CONTENT}/database.dump"
    
    if [ $? -eq 0 ]; then
        log "Database restored successfully"
    else
        log "ERROR: Database restore failed"
        exit 1
    fi
else
    log "ERROR: Database backup file not found"
    exit 1
fi

# 6. Restore Redis
log "Restoring Redis..."
if [ -f "${BACKUP_CONTENT}/redis.rdb" ]; then
    # Stop Redis
    kubectl scale statefulset redis --replicas=0 -n orchestrall || true
    sleep 5
    
    # Copy RDB file to Redis pod
    REDIS_POD=$(kubectl get pods -n orchestrall -l app=redis -o jsonpath='{.items[0].metadata.name}')
    kubectl cp "${BACKUP_CONTENT}/redis.rdb" "${REDIS_POD}:/data/dump.rdb" -n orchestrall
    
    # Restart Redis
    kubectl scale statefulset redis --replicas=1 -n orchestrall
    sleep 10
    
    log "Redis restored successfully"
else
    log "WARNING: Redis backup file not found"
fi

# 7. Restore application data
log "Restoring application data..."
if [ -f "${BACKUP_CONTENT}/uploads.tar.gz" ]; then
    tar -xzf "${BACKUP_CONTENT}/uploads.tar.gz" -C /app/
    log "Uploads restored"
fi

if [ -f "${BACKUP_CONTENT}/logs.tar.gz" ]; then
    tar -xzf "${BACKUP_CONTENT}/logs.tar.gz" -C /app/
    log "Logs restored"
fi

# 8. Restore configuration
log "Restoring configuration..."
if [ -f "${BACKUP_CONTENT}/env.backup" ]; then
    cp "${BACKUP_CONTENT}/env.backup" /app/.env
    log "Environment configuration restored"
fi

# 9. Run database migrations
log "Running database migrations..."
kubectl run migration-job --image=orchestrall/platform:latest --rm -i --restart=Never -n orchestrall -- npm run db:migrate

# 10. Start application services
log "Starting application services..."
kubectl scale deployment orchestrall-app --replicas=3 -n orchestrall

# 11. Wait for services to be ready
log "Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=orchestrall-app -n orchestrall --timeout=300s

# 12. Run health checks
log "Running health checks..."
sleep 30

# Check application health
APP_POD=$(kubectl get pods -n orchestrall -l app=orchestrall-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec "${APP_POD}" -n orchestrall -- curl -f http://localhost:3000/health

if [ $? -eq 0 ]; then
    log "Health check passed"
else
    log "ERROR: Health check failed"
    exit 1
fi

# 13. Cleanup
log "Cleaning up temporary files..."
rm -rf "${RESTORE_DIR}"

# 14. Send notification
if [ -n "${SLACK_WEBHOOK}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔄 Orchestrall disaster recovery completed from backup: ${BACKUP_FILE}\"}" \
        "${SLACK_WEBHOOK}"
fi

log "Disaster recovery completed successfully"
log "Platform restored from backup: ${BACKUP_FILE}"

exit 0
