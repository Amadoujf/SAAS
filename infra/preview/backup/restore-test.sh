#!/usr/bin/env bash
# Test RÉEL de restauration (hebdomadaire) : relit le dépôt (intégrité), restaure la
# dernière sauvegarde de la base dans une instance PostgreSQL JETABLE (aucun réseau,
# jamais la base en service), puis compare avec la base en service ; restaure aussi les
# fichiers et compte ce qui revient. Toute différence anormale fait échouer le test.
. "$(dirname "$0")/lib.sh"
ping "${HEALTHCHECK_RESTORE_URL:-}" /start
WORK=$(mktemp -d)
CONTAINER=ycom-restore-test
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap 'cleanup; ping "${HEALTHCHECK_RESTORE_URL:-}" /fail' ERR
trap cleanup EXIT

echo "1/5 Intégrité du dépôt (5 % des données relues)"
restic check --read-data-subset=5% --quiet

echo "2/5 Restauration de la base"
read -r DB_SNAP RUN_TAG <<<"$(recovery_point latest)"
[ -n "$RUN_TAG" ] || { echo "Aucune sauvegarde avec point de restauration." >&2; false; }
echo "Point de restauration : $RUN_TAG (base $DB_SNAP)"
EXTRA_MOUNTS=(-v "$WORK:/restore")
restic restore "$DB_SNAP" --target /restore --quiet
DUMP="$WORK/db/yamacommerce_preview.dump"
[ -s "$DUMP" ] || { echo "Dump absent ou vide." >&2; false; }
PW=$(openssl rand -hex 16)
docker run -d --name "$CONTAINER" --network none -e POSTGRES_PASSWORD="$PW" -v "$DUMP:/backup.dump:ro" "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
docker exec "$CONTAINER" psql -U postgres -qc "CREATE ROLE yamacommerce_app NOLOGIN" -c "CREATE ROLE yamacommerce_owner NOLOGIN" -c "CREATE DATABASE restored OWNER yamacommerce_owner"
docker exec "$CONTAINER" pg_restore -U postgres -d restored --exit-on-error /backup.dump

echo "3/5 Comparaison avec la base en service"
COUNT_SQL="SELECT (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)||' '||(SELECT count(*) FROM \"Tenant\")||' '||(SELECT count(*) FROM \"Product\")||' '||(SELECT count(*) FROM \"Order\")||' '||(SELECT count(*) FROM \"User\")"
read -r R_MIG R_TEN R_PROD R_ORD R_USR <<<"$(docker exec "$CONTAINER" psql -U postgres -d restored -Atc "$COUNT_SQL")"
read -r L_MIG L_TEN L_PROD L_ORD L_USR <<<"$($COMPOSE exec -T db psql -U yamacommerce_owner -d yamacommerce_preview -Atc "$COUNT_SQL")"
printf "                 restaurée  en service\n"
printf "migrations      %9s %10s\n" "$R_MIG" "$L_MIG"
printf "entreprises     %9s %10s\n" "$R_TEN" "$L_TEN"
printf "produits        %9s %10s\n" "$R_PROD" "$L_PROD"
printf "commandes       %9s %10s\n" "$R_ORD" "$L_ORD"
printf "utilisateurs    %9s %10s\n" "$R_USR" "$L_USR"
# La sauvegarde date d'au plus un jour : elle peut avoir MOINS de lignes, jamais zéro.
[ "$R_MIG" -gt 0 ] && [ "$R_TEN" -gt 0 ] && [ "$R_USR" -gt 0 ] || { echo "Base restaurée vide." >&2; false; }
[ "$R_MIG" -le "$L_MIG" ] && [ "$R_TEN" -le "$L_TEN" ] || { echo "Incohérence entre sauvegarde et base en service." >&2; false; }
RLS=$(docker exec "$CONTAINER" psql -U postgres -d restored -Atc "SELECT count(*) FROM pg_class WHERE relforcerowsecurity")
[ "$RLS" -gt 100 ] || { echo "Protections RLS absentes de la base restaurée ($RLS)." >&2; false; }
echo "RLS forcée sur $RLS tables de la base restaurée."

echo "4/5 Restauration des fichiers"
restic restore latest --tag "files,$RUN_TAG" --target /restore --quiet
R_FILES=$(find "$WORK/data/storage" -type f 2>/dev/null | wc -l)
L_FILES=$($COMPOSE exec -T web sh -c 'find /data/storage -type f | wc -l')
echo "fichiers : $R_FILES restaurés, $L_FILES en service"
[ "$R_FILES" -le "$L_FILES" ] || { echo "Plus de fichiers restaurés qu'en service : incohérence." >&2; false; }

echo "5/5 Configuration"
restic restore latest --tag "config,$RUN_TAG" --target /restore --quiet
grep -q '^PREVIEW_DOMAIN=' "$WORK/config/.env.preview" || { echo "Configuration non restaurée." >&2; false; }

ping "${HEALTHCHECK_RESTORE_URL:-}"
echo "Restauration vérifiée."
