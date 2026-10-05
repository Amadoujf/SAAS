#!/usr/bin/env bash
# Battement de cœur de la prévisualisation (toutes les 5 minutes via systemd, voir setup-ops.sh).
# Vérifie : services démarrés, disque, réponse HTTPS, certificat, redémarrage en attente.
# Tout va bien → ping healthchecks.io ; un problème → ping /fail avec le détail (alerte e-mail).
# Aucun ping (serveur éteint, réseau coupé) → healthchecks.io alerte aussi après le délai de grâce.
set -uo pipefail
REPO_DIR=${REPO_DIR:-/home/ycom/SAAS}
PREVIEW_ENV=${PREVIEW_ENV:-$REPO_DIR/infra/preview/.env.preview}
PROJECT=yamacommerce-preview
DISK_MAX=${DISK_MAX:-85}
CERT_MIN_DAYS=${CERT_MIN_DAYS:-14}
# Pour les tests locaux : options curl supplémentaires (ex. -k pour une autorité locale).
CURL_EXTRA=${CURL_EXTRA:-}

envval() { grep -E "^$1=" "$PREVIEW_ENV" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"; }
DOMAIN=$(envval PREVIEW_DOMAIN)
PING_URL=$(envval HEALTHCHECK_PING_URL)
problems=()
add() { problems+=("$1"); }

# 1. Services : tous ceux qui doivent tourner en permanence.
for svc in db redis web worker caddy; do
  state=$(docker inspect -f '{{.State.Status}}{{if .State.Health}}/{{.State.Health.Status}}{{end}}' \
    "$(docker ps -aq -f "label=com.docker.compose.project=$PROJECT" -f "label=com.docker.compose.service=$svc" | head -1)" 2>/dev/null)
  case "$state" in
    running|running/healthy) ;;
    *) add "service $svc : ${state:-absent}" ;;
  esac
done

# 2. Disque (racine et données Docker).
for mnt in / /var/lib/docker; do
  [ -d "$mnt" ] || continue
  use=$(df -P "$mnt" | awk 'NR==2 {gsub("%","",$5); print $5}')
  [ "${use:-0}" -ge "$DISK_MAX" ] && add "disque $mnt plein à ${use}%"
done

# 3. Réponse HTTPS de la porte d'accès (la seule page publique).
if [ -n "$DOMAIN" ]; then
  # shellcheck disable=SC2086
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 $CURL_EXTRA "https://$DOMAIN/acces-previsualisation")
  [ "$code" = 200 ] || add "HTTPS https://$DOMAIN/acces-previsualisation → $code"

  # 4. Certificat : expiration (Caddy renouvelle à 30 jours ; moins de 14 = renouvellement en échec).
  end=$(echo | timeout 15 openssl s_client -servername "$DOMAIN" -connect "${CERT_HOST:-$DOMAIN}:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -z "$end" ]; then
    add "certificat illisible pour $DOMAIN"
  else
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    [ "$days" -lt "$CERT_MIN_DAYS" ] && add "certificat $DOMAIN expire dans $days jours"
  fi
else
  add "PREVIEW_DOMAIN absent de $PREVIEW_ENV"
fi

# 5. Mises à jour de sécurité installées mais redémarrage en attente (avertissement seulement :
# unattended-upgrades redémarre seul à 04:30 ; si ce message dure plus d'un jour, vérifier).
warn=""
if [ -f /var/run/reboot-required ]; then
  since=$(( ( $(date +%s) - $(stat -c %Y /var/run/reboot-required) ) / 3600 ))
  [ "$since" -ge 30 ] && add "redémarrage en attente depuis ${since} h" || warn="redémarrage prévu (mises à jour)"
fi

if [ ${#problems[@]} -eq 0 ]; then
  msg="OK ${warn:+- $warn}"
  echo "$msg"
  [ -n "$PING_URL" ] && curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$msg" "$PING_URL" || true
  exit 0
fi
msg=$(printf '%s\n' "${problems[@]}")
echo "PROBLÈME :" >&2; echo "$msg" >&2
[ -n "$PING_URL" ] && curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$msg" "$PING_URL/fail" || true
exit 1
