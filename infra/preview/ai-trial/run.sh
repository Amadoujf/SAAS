#!/bin/sh
# Banc d'essai IA sur la prévisualisation (à lancer SUR LE SERVEUR, depuis la racine du
# dépôt, une fois la clé IA renseignée et la pile démarrée) :
#   sh infra/preview/ai-trial/run.sh infra/preview/.env.preview            # 10 scénarios
#   ONLY=mode-ceremonie,auto-premium sh infra/preview/ai-trial/run.sh ...  # sélection
# Dépense RÉELLE (bornée par le plafond de la plateforme) : environ 2 $ avec Sonnet 5.5
# pour les 10 scénarios. Résultat : infra/preview/ai-trial/out/<date>/index.html.
set -eu
ENV_FILE="${1:-infra/preview/.env.preview}"
# shellcheck disable=SC1090
. "$ENV_FILE"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$HERE/out/$STAMP"
mkdir -p "$OUT"
COMPOSE="docker compose -f $HERE/../docker-compose.yml --env-file $ENV_FILE"
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PW_VERSION=1.56.1

# Secrets transmis par l'environnement (jamais sur la ligne de commande visible).
export PASSWORD="$PREVIEW_DEMO_PASSWORD" ACCESS_CODE="$PREVIEW_ACCESS_CODE"
docker run --rm --network host --ipc=host \
  -v "$HERE:/trial" -w /trial \
  -e BASE="https://$PREVIEW_DOMAIN" -e SITE_SUFFIX="$PREVIEW_DOMAIN" -e OUT="/trial/out/$STAMP" -e ONLY="${ONLY:-}" \
  -e PASSWORD -e ACCESS_CODE \
  "mcr.microsoft.com/playwright:v$PW_VERSION-noble" \
  sh -c "npm install --no-save --silent playwright@$PW_VERSION >/dev/null && node trial.mjs"

# Coût réel : jetons facturés et coût de chaque génération de l'essai, lus dans la base.
$COMPOSE exec -T db psql -U yamacommerce_owner -d yamacommerce_preview -At -c "
  SELECT coalesce(json_agg(row_to_json(x)), '[]') FROM (
    SELECT t.slug AS tenant, j.type, j.status, j.model, j.simulated, j.\"inputTokens\", j.\"outputTokens\",
           j.\"costEstimateXOF\", j.\"createdAt\", (extract(epoch FROM (j.\"finishedAt\" - j.\"createdAt\")) * 1000)::int AS \"durationMs\"
    FROM \"AIGenerationJob\" j JOIN \"Tenant\" t ON t.id = j.\"tenantId\"
    WHERE j.\"createdAt\" >= '$START' ORDER BY j.\"createdAt\") x" > "$OUT/costs.json"
$COMPOSE exec -T db psql -U yamacommerce_owner -d yamacommerce_preview -At -c "
  SELECT coalesce(row_to_json(b), 'null') FROM \"AIPlatformBudget\" b WHERE \"periodMonth\" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')" > "$OUT/budget.json" || echo null > "$OUT/budget.json"
[ -s "$OUT/budget.json" ] || echo null > "$OUT/budget.json"

docker run --rm -v "$HERE:/trial" -w /trial -e AI_PLATFORM_MONTHLY_CAP_XOF="${AI_PLATFORM_MONTHLY_CAP_XOF:-15000}" \
  "mcr.microsoft.com/playwright:v$PW_VERSION-noble" node report.mjs "/trial/out/$STAMP"
echo "Rapport : $OUT/index.html (à copier sur votre ordinateur : scp -r serveur:$OUT .)"
