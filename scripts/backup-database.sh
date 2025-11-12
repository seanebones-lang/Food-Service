#!/bin/bash

# Restaurant POS Database Backup Script
# Automated PostgreSQL backup with rotation and S3 upload

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
DATABASE_NAME="${DATABASE_NAME:-restaurant_pos}"
DATABASE_URL="${DATABASE_URL}"
S3_BUCKET="${S3_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESSION="${COMPRESSION:-gzip}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi

    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable not set."
        exit 1
    fi

    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Perform database backup
perform_backup() {
    local backup_file="${BACKUP_DIR}/${DATABASE_NAME}_${TIMESTAMP}.sql"

    log_info "Starting backup of database: $DATABASE_NAME"
    log_info "Backup file: $backup_file"

    # Perform pg_dump
    if pg_dump "$DATABASE_URL" > "$backup_file"; then
        log_info "Database dump completed successfully"
    else
        log_error "Database dump failed"
        exit 1
    fi

    # Compress backup
    if [ "$COMPRESSION" == "gzip" ]; then
        log_info "Compressing backup with gzip..."
        gzip "$backup_file"
        backup_file="${backup_file}.gz"
    fi

    # Calculate and display file size
    local size=$(du -h "$backup_file" | cut -f1)
    log_info "Backup size: $size"

    echo "$backup_file"
}

# Upload to S3 (if configured)
upload_to_s3() {
    local backup_file=$1

    if [ -z "$S3_BUCKET" ]; then
        log_warn "S3_BUCKET not configured, skipping S3 upload"
        return
    fi

    if ! command -v aws &> /dev/null; then
        log_warn "AWS CLI not found, skipping S3 upload"
        return
    fi

    log_info "Uploading backup to S3: s3://$S3_BUCKET/backups/postgres/"

    if aws s3 cp "$backup_file" "s3://$S3_BUCKET/backups/postgres/$(basename $backup_file)"; then
        log_info "S3 upload completed successfully"
    else
        log_error "S3 upload failed"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."

    local deleted_count=0

    # Find and delete old local backups
    while IFS= read -r -d '' file; do
        rm "$file"
        deleted_count=$((deleted_count + 1))
        log_info "Deleted old backup: $(basename $file)"
    done < <(find "$BACKUP_DIR" -name "${DATABASE_NAME}_*.sql*" -mtime +$RETENTION_DAYS -print0)

    # Cleanup old S3 backups (if configured)
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log_info "Cleaning up old S3 backups..."

        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)

        aws s3 ls "s3://$S3_BUCKET/backups/postgres/" | while read -r line; do
            local file_date=$(echo $line | awk '{print $4}' | grep -oP '\d{8}')
            local file_name=$(echo $line | awk '{print $4}')

            if [ "$file_date" -lt "$cutoff_date" ]; then
                aws s3 rm "s3://$S3_BUCKET/backups/postgres/$file_name"
                log_info "Deleted old S3 backup: $file_name"
                deleted_count=$((deleted_count + 1))
            fi
        done
    fi

    log_info "Cleanup completed. Deleted $deleted_count old backup(s)"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1

    log_info "Verifying backup integrity..."

    # Decompress if needed for verification
    local verify_file=$backup_file
    if [[ $backup_file == *.gz ]]; then
        verify_file="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$verify_file"
    fi

    # Check if file contains SQL
    if head -n 10 "$verify_file" | grep -q "PostgreSQL database dump"; then
        log_info "Backup verification successful"

        # Remove decompressed file if we created it
        if [ "$verify_file" != "$backup_file" ]; then
            rm "$verify_file"
        fi

        return 0
    else
        log_error "Backup verification failed"
        return 1
    fi
}

# Send notification (webhook or email)
send_notification() {
    local status=$1
    local backup_file=$2

    if [ -z "$WEBHOOK_URL" ]; then
        return
    fi

    local message
    if [ "$status" == "success" ]; then
        message="✅ Database backup completed successfully: $(basename $backup_file)"
    else
        message="❌ Database backup failed"
    fi

    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$message\", \"timestamp\": \"$TIMESTAMP\"}" \
        2>/dev/null || log_warn "Failed to send notification"
}

# Main execution
main() {
    log_info "=== Restaurant POS Database Backup ==="
    log_info "Timestamp: $TIMESTAMP"

    check_prerequisites

    # Perform backup
    backup_file=$(perform_backup)

    # Verify backup
    if verify_backup "$backup_file"; then
        # Upload to S3
        upload_to_s3 "$backup_file"

        # Cleanup old backups
        cleanup_old_backups

        # Send success notification
        send_notification "success" "$backup_file"

        log_info "=== Backup completed successfully ==="
        exit 0
    else
        send_notification "failure"
        log_error "=== Backup failed ==="
        exit 1
    fi
}

# Run main function
main
