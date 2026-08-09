#!/usr/bin/env sh
set -eu
backup_dir=/opt/losthvost/backups
mkdir -p "$backup_dir"
docker run --rm -v losthvost_app_data:/data:ro -v "$backup_dir":/backup alpine sh -c 'tar -czf /backup/losthvost-$(date +%F-%H%M%S).tar.gz -C /data .'
find "$backup_dir" -type f -name 'losthvost-*.tar.gz' -mtime +14 -delete
