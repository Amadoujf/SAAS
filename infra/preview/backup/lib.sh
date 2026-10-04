# Fonctions communes des sauvegardes (sourcé par backup.sh et restore-test.sh).
set -euo pipefail
ENV_FILE=${YCOM_BACKUP_ENV:-/etc/ycom-backup/backup.env}
[ -r "$ENV_FILE" ] || { echo "Fichier introuvable : $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${REPO_DIR:?}" "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}"
PROJECT=yamacommerce-preview
RESTIC_IMAGE=${RESTIC_IMAGE:-restic/restic:0.17.3}
POSTGRES_IMAGE=${POSTGRES_IMAGE:-postgres:17-alpine}
PREVIEW_ENV=${PREVIEW_ENV:-$REPO_DIR/infra/preview/.env.preview}
COMPOSE="docker compose -p $PROJECT -f $REPO_DIR/infra/preview/docker-compose.yml --env-file $PREVIEW_ENV"

# restic dans un conteneur (rien à installer sur le serveur). Le mot de passe passe par
# l'environnement du conteneur, jamais par la ligne de commande (invisible dans `ps`).
restic() {
  local mounts=(-v ycom_restic_cache:/root/.cache/restic)
  case "$RESTIC_REPOSITORY" in
    /*) mounts+=(-v "$RESTIC_REPOSITORY:$RESTIC_REPOSITORY") ;;
    sftp:*) mounts+=(-v "${SSH_KEY:?}:/root/.ssh/id_ed25519:ro" -v "${KNOWN_HOSTS:?}:/root/.ssh/known_hosts:ro") ;;
  esac
  docker run --rm -i --hostname ycom-preview -e RESTIC_REPOSITORY -e RESTIC_PASSWORD "${mounts[@]}" "${EXTRA_MOUNTS[@]}" "$RESTIC_IMAGE" "$@"
}
export RESTIC_REPOSITORY RESTIC_PASSWORD
EXTRA_MOUNTS=()

# Signal de surveillance : début, succès, échec (healthchecks.io). Jamais bloquant.
ping() { [ -n "${1:-}" ] && curl -fsS -m 10 --retry 3 -o /dev/null "$1${2:-}" || true; }
