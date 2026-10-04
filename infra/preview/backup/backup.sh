#!/usr/bin/env bash
# Sauvegarde quotidienne HORS du serveur, chiffrée (restic) : base PostgreSQL (dump
# cohérent), fichiers importés et configuration (.env.preview, chiffré dans le dépôt).
# Rétention : 7 jours, 4 semaines, 6 mois. Lancé par ycom-backup.timer.
. "$(dirname "$0")/lib.sh"
ping "${HEALTHCHECK_BACKUP_URL:-}" /start
trap 'ping "${HEALTHCHECK_BACKUP_URL:-}" /fail' ERR

restic cat config >/dev/null 2>&1 || restic init
# Même étiquette pour les trois instantanés : un seul point de restauration cohérent.
RUN_TAG="run-$(date -u +%Y%m%dT%H%M%SZ)"
echo "1/4 Base de données"
$COMPOSE exec -T db pg_dump -U yamacommerce_owner -Fc yamacommerce_preview \
  | restic backup --stdin --stdin-filename db/yamacommerce_preview.dump --tag db --tag "$RUN_TAG" --quiet
echo "2/4 Fichiers importés"
EXTRA_MOUNTS=(-v "${PROJECT}_preview_storage:/data/storage:ro")
restic backup /data/storage --tag files --tag "$RUN_TAG" --quiet
echo "3/4 Configuration"
EXTRA_MOUNTS=(-v "$PREVIEW_ENV:/config/.env.preview:ro")
restic backup /config --tag config --tag "$RUN_TAG" --quiet
EXTRA_MOUNTS=()
echo "4/4 Rétention"
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune --quiet
restic snapshots --latest 1 --compact
ping "${HEALTHCHECK_BACKUP_URL:-}"
echo "Sauvegarde terminée."
