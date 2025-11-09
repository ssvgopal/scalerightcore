#!/bin/bash
set -e

# Bootstrap script for Google Cloud TTS credentials
# This script handles reading Google Cloud credentials from environment variables
# and writing them to a temporary file that can be used by the application

echo "🚀 Starting application bootstrap..."

# Handle Google Cloud TTS credentials
if [ ! -z "$GOOGLE_TTS_CREDENTIALS_JSON" ]; then
  echo "📝 Setting up Google Cloud TTS credentials from JSON..."
  
  # Create temporary directory for credentials
  CREDS_DIR="/tmp/gcp-credentials"
  mkdir -p "$CREDS_DIR"
  
  # Write credentials to file
  CREDS_FILE="$CREDS_DIR/service-account.json"
  echo "$GOOGLE_TTS_CREDENTIALS_JSON" > "$CREDS_FILE"
  
  # Set environment variable
  export GOOGLE_APPLICATION_CREDENTIALS="$CREDS_FILE"
  echo "✅ Google Cloud credentials configured: $GOOGLE_APPLICATION_CREDENTIALS"
elif [ ! -z "$GOOGLE_TTS_PROJECT_ID" ] && [ ! -z "$GOOGLE_TTS_CLIENT_EMAIL" ] && [ ! -z "$GOOGLE_TTS_PRIVATE_KEY" ]; then
  echo "📝 Setting up Google Cloud TTS credentials from individual variables..."
  
  # Create temporary directory for credentials
  CREDS_DIR="/tmp/gcp-credentials"
  mkdir -p "$CREDS_DIR"
  
  # Build JSON credentials file
  CREDS_FILE="$CREDS_DIR/service-account.json"
  cat > "$CREDS_FILE" << EOF
{
  "type": "service_account",
  "project_id": "$GOOGLE_TTS_PROJECT_ID",
  "private_key_id": "key1",
  "private_key": $GOOGLE_TTS_PRIVATE_KEY,
  "client_email": "$GOOGLE_TTS_CLIENT_EMAIL",
  "client_id": "1",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
EOF
  
  # Set environment variable
  export GOOGLE_APPLICATION_CREDENTIALS="$CREDS_FILE"
  echo "✅ Google Cloud credentials configured: $GOOGLE_APPLICATION_CREDENTIALS"
else
  echo "⚠️  Google Cloud TTS credentials not configured (optional if not using Google TTS)"
fi

# Ensure necessary directories exist
mkdir -p /app/logs /app/uploads /app/backups 2>/dev/null || true

echo "✅ Bootstrap complete. Starting application..."

# Execute the main application
exec "$@"
