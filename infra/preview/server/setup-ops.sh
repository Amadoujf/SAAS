#!/usr/bin/env bash
# Installe les tâches automatiques de la prévisualisation (après harden.sh, en root) :
#   ycom-backup        sauvegarde chiffrée hors serveur, chaque nuit à 03:15
#   ycom-restore-test  restauration réelle dans une base jetable, chaque dimanche à 05:00
#   ycom-heartbeat     contrôle services/disque/HTTPS/certificat, toutes les 5 minutes
# Aucun secret n'est saisi ici : ils vont dans /etc/ycom-backup/backup.env (voir docs/19).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }
REPO_DIR=${REPO_DIR:-$(cd "$(dirname "$0")/../../.." && pwd)}
UNIT_DIR=${UNIT_DIR:-/etc/systemd/system}
CONF_DIR=/etc/ycom-backup

echo "== Dossier des secrets de sauvegarde ($CONF_DIR, root uniquement)"
install -d -m 700 -o root -g root "$CONF_DIR"
if [ ! -f "$CONF_DIR/backup.env" ]; then
  install -m 600 -o root -g root "$REPO_DIR/infra/preview/backup/backup.env.example" "$CONF_DIR/backup.env"
  sed -i "s#^REPO_DIR=.*#REPO_DIR=$REPO_DIR#" "$CONF_DIR/backup.env"
  echo "   Modèle copié : à compléter avec : sudo nano $CONF_DIR/backup.env"
fi
chmod 600 "$CONF_DIR/backup.env"
if [ ! -f "$CONF_DIR/storagebox_ed25519" ]; then
  ssh-keygen -q -t ed25519 -N "" -C "ycom-backup@$(hostname)" -f "$CONF_DIR/storagebox_ed25519"
  echo "   Clé SSH de sauvegarde créée. Clé PUBLIQUE à installer sur la Storage Box :"
  cat "$CONF_DIR/storagebox_ed25519.pub"
fi
chmod 600 "$CONF_DIR/storagebox_ed25519"
touch "$CONF_DIR/known_hosts"; chmod 644 "$CONF_DIR/known_hosts"

echo "== Unités systemd"
unit() { # nom description commande calendrier [persistent]
  cat > "$UNIT_DIR/$1.service" <<EOF
[Unit]
Description=$2
Wants=network-online.target docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
Environment=REPO_DIR=$REPO_DIR
ExecStart=$3
Nice=10
IOSchedulingClass=idle
EOF
  cat > "$UNIT_DIR/$1.timer" <<EOF
[Unit]
Description=$2 (planification)

[Timer]
OnCalendar=$4
Persistent=${5:-true}
RandomizedDelaySec=${6:-0}

[Install]
WantedBy=timers.target
EOF
}
unit ycom-backup "Sauvegarde chiffrée hors serveur (YamaCommerce)" \
  "/usr/bin/bash $REPO_DIR/infra/preview/backup/backup.sh" "*-*-* 03:15:00" true 10m
unit ycom-restore-test "Test de restauration réel (YamaCommerce)" \
  "/usr/bin/bash $REPO_DIR/infra/preview/backup/restore-test.sh" "Sun *-*-* 05:00:00" true 10m
unit ycom-heartbeat "Battement de cœur de la prévisualisation" \
  "/usr/bin/bash $REPO_DIR/infra/preview/server/heartbeat.sh" "*:0/5" false 0

if [ "${YCOM_NO_SYSTEMD:-0}" != 1 ]; then
  systemctl daemon-reload
  systemctl enable --now ycom-backup.timer ycom-restore-test.timer ycom-heartbeat.timer
  systemctl list-timers 'ycom-*' --no-pager
fi

cat <<EOF

Installé. Étapes restantes (docs/19-securite-previsualisation.md) :
  1. Compléter $CONF_DIR/backup.env (sudo nano), dépôt Storage Box et mot de passe restic.
  2. Première sauvegarde manuelle : sudo systemctl start ycom-backup && journalctl -u ycom-backup -n 50
  3. Restauration réelle : sudo systemctl start ycom-restore-test && journalctl -u ycom-restore-test -n 80
EOF
