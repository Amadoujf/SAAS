#!/usr/bin/env bash
# Reprise après sinistre : REMPLACE la base et les fichiers EN SERVICE par la dernière
# sauvegarde (ou un instantané donné : ./restore.sh <id>). Destructif : demande de taper
# RESTAURER. Arrête web et worker pendant l'opération, les relance ensuite.
. "$(dirname "$0")/lib.sh"
SNAPSHOT=${1:-latest}
if [ "${YCOM_RESTORE_CONFIRM:-}" != "RESTAURER" ]; then
  read -r -p "Remplacer la base et les fichiers en service par la sauvegarde « $SNAPSHOT » ? Tapez RESTAURER : " answer
  [ "$answer" = "RESTAURER" ] || { echo "Abandon."; exit 1; }
fi
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
EXTRA_MOUNTS=(-v "$WORK:/restore")
if [ "$SNAPSHOT" = latest ]; then restic restore latest --tag db --target /restore --quiet; else restic restore "$SNAPSHOT" --target /restore --quiet; fi
DUMP="$WORK/db/yamacommerce_preview.dump"
[ -s "$DUMP" ] || { echo "Dump absent de la sauvegarde." >&2; exit 1; }

echo "Arrêt de web et worker"
$COMPOSE stop web worker
# Quoi qu'il arrive (même une erreur), web et worker sont relancés.
trap 'rm -rf "$WORK"; echo "Redémarrage"; $COMPOSE start web worker' EXIT
echo "Remplacement de la base"
$COMPOSE exec -T db psql -U yamacommerce_owner -d postgres -qc "DROP DATABASE IF EXISTS yamacommerce_preview WITH (FORCE)" -c "CREATE DATABASE yamacommerce_preview OWNER yamacommerce_owner"
$COMPOSE exec -T db pg_restore -U yamacommerce_owner -d yamacommerce_preview --exit-on-error < "$DUMP"
# Le mot de passe du rôle applicatif suit la configuration EN SERVICE.
APP_PW=$(grep '^APP_DB_PASSWORD=' "$PREVIEW_ENV" | cut -d= -f2-)
$COMPOSE exec -T db psql -U yamacommerce_owner -d yamacommerce_preview -qc "ALTER ROLE yamacommerce_app PASSWORD '${APP_PW//\'/\'\'}'"

echo "Remplacement des fichiers"
docker run --rm -v "${PROJECT}_preview_storage:/data/storage" --entrypoint sh "$RESTIC_IMAGE" -c 'find /data/storage -mindepth 1 -delete'
EXTRA_MOUNTS=(-v "${PROJECT}_preview_storage:/data/storage")
restic restore latest --tag files --target / --quiet
docker run --rm -v "${PROJECT}_preview_storage:/data/storage" --entrypoint chown "$RESTIC_IMAGE" -R 1000:1000 /data/storage
echo "Restauration terminée : vérifiez avec infra/preview/verify.sh."
