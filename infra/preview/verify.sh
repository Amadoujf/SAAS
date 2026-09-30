#!/bin/sh
# Vérification automatique de la prévisualisation privée, à lancer SUR LE SERVEUR après
# `docker compose ... up -d` :
#   sh infra/preview/verify.sh infra/preview/.env.preview
# Contrôle : services démarrés, HTTPS (certificat valide), porte d'accès, noindex,
# API fermées sans code, chaque démonstration joignable, état de l'assistant IA.
# N'affiche jamais le code d'accès ni aucun secret. Sort en erreur au premier échec.
# CURL_EXTRA permet d'ajouter des options à curl (ex. essai local : --resolve, --cacert).
set -eu
ENV_FILE="${1:-infra/preview/.env.preview}"
COMPOSE="docker compose -f $(dirname "$0")/docker-compose.yml --env-file $ENV_FILE"
# shellcheck disable=SC1090
. "$ENV_FILE"
D="$PREVIEW_DOMAIN"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
CURL="curl -sS --max-time 60 ${CURL_EXTRA:-}"
ok() { echo "  ✓ $1"; }
ko() { echo "  ✗ $1" >&2; exit 1; }

echo "1. Services"
for s in db redis web worker caddy; do
  state="$($COMPOSE ps --format '{{.State}}' "$s" 2>/dev/null || true)"
  [ "$state" = "running" ] && ok "$s en marche" || ko "$s : état « ${state:-absent} »"
done
[ "$($COMPOSE ps -a --format '{{.ExitCode}}' migrate)" = "0" ] && ok "migrate terminé sans erreur" || ko "migrate en échec (docker compose logs migrate)"

echo "2. HTTPS et porte d'accès"
code="$($CURL -o /dev/null -w '%{http_code}' "https://$D/")" || ko "HTTPS injoignable ou certificat refusé sur $D"
[ "$code" = "307" ] || [ "$code" = "308" ] || ko "sans code, la page d'accueil devrait rediriger vers la porte (reçu $code)"
ok "certificat accepté ; sans code → redirection vers la porte d'accès"
$CURL -D - -o /dev/null "https://$D/" | grep -qi '^x-robots-tag: .*noindex' && ok "en-tête noindex" || ko "en-tête noindex absent"
$CURL "https://$D/robots.txt" | grep -qi 'Disallow: /' && ok "robots.txt fermé" || ko "robots.txt ouvert"
[ "$($CURL -o /dev/null -w '%{http_code}' "https://$D/api/dashboard/courier")" = "401" ] && ok "API fermée sans code (401)" || ko "une API répond sans code"
$CURL -c "$JAR" -o /dev/null -X POST --data-urlencode "code=mauvais-code" --data-urlencode "suite=/" "https://$D/api/preview-access"
grep -q yc_preview "$JAR" && ko "un mauvais code a ouvert l'accès" || ok "mauvais code refusé"
$CURL -c "$JAR" -o /dev/null -X POST --data-urlencode "code=$PREVIEW_ACCESS_CODE" --data-urlencode "suite=/" "https://$D/api/preview-access"
grep -q yc_preview "$JAR" && ok "bon code accepté (cookie posé)" || ko "le bon code n'a pas ouvert l'accès"
[ "$($CURL -b "$JAR" -o /dev/null -w '%{http_code}' "https://$D/")" = "200" ] && ok "accueil de la plateforme (200)" || ko "accueil inaccessible avec le code"

echo "3. Démonstrations (sous-domaines, même code)"
hosts="$($COMPOSE exec -T db psql -U yamacommerce_owner -d yamacommerce_preview -Atc \
  "SELECT d.domain FROM \"Domain\" d JOIN \"Tenant\" t ON t.id = d.\"tenantId\" WHERE t.\"isDemo\" AND d.domain LIKE '%.$D' ORDER BY 1")"
[ -n "$hosts" ] || ko "aucune démonstration trouvée pour $D"
for h in $hosts; do
  c="$($CURL -b "$JAR" -o /dev/null -w '%{http_code}' "https://$h/")" || ko "$h injoignable"
  [ "$c" = "200" ] && ok "$h" || ko "$h répond $c"
done

echo "4. Assistant IA"
if [ -n "${AI_PROVIDER_API_KEY:-}" ]; then
  ok "clé présente (valeur non affichée) ; modèle ${AI_MODEL:-claude-opus-5-5} ; plafond ${AI_PLATFORM_MONTHLY_CAP_XOF:-15000} FCFA/mois"
  echo "  → parcours à faire depuis le téléphone : description → propositions → brouillon → modification → publication (docs/16)."
else
  echo "  – aucune clé : l'assistant affichera « non configuré » (aucune simulation en production)."
fi
echo "Prévisualisation vérifiée."
