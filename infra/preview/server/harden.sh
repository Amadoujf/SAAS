#!/usr/bin/env bash
# Durcissement du serveur de prévisualisation (Ubuntu 24.04), à lancer UNE fois en root
# juste après la création du serveur :   sudo bash infra/preview/server/harden.sh
# Idempotent (peut être relancé). Voir docs/19-securite-previsualisation.md.
#
# - un seul administrateur (ADMIN_USER, « ycom » par défaut), connexion SSH par clé ;
# - root ne se connecte plus en SSH, aucun mot de passe en SSH ;
# - pare-feu ufw : 22, 80, 443 seulement ; fail2ban sur SSH ;
# - mises à jour de sécurité automatiques (redémarrage la nuit si nécessaire) ;
# - Docker : journaux plafonnés, no-new-privileges, live-restore.
set -euo pipefail
ADMIN_USER=${ADMIN_USER:-ycom}
SSH_PORT=${SSH_PORT:-22}
# Pour les tests en conteneur uniquement (aucun systemd) : ne recharge pas les services.
NO_SYSTEMD=${YCOM_NO_SYSTEMD:-0}
svc() { [ "$NO_SYSTEMD" = 1 ] || systemctl "$@"; }
step() { printf '\n== %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "À lancer en root (sudo)." >&2; exit 1; }

step "1. Paquets de sécurité"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades apt-listchanges needrestart openssh-server curl ca-certificates >/dev/null
apt-get -y -qq upgrade >/dev/null

step "2. Administrateur « $ADMIN_USER » (clé SSH, sudo)"
id "$ADMIN_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$ADMIN_USER"
usermod -aG sudo "$ADMIN_USER"
getent group docker >/dev/null && usermod -aG docker "$ADMIN_USER"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
AK="/home/$ADMIN_USER/.ssh/authorized_keys"
# La clé déposée par Hetzner pour root est reprise pour l'administrateur.
if [ ! -s "$AK" ] && [ -s /root/.ssh/authorized_keys ]; then cp /root/.ssh/authorized_keys "$AK"; fi
[ -s "$AK" ] || { echo "Aucune clé SSH pour $ADMIN_USER : arrêt (sinon plus aucun accès)." >&2; exit 1; }
chown "$ADMIN_USER:$ADMIN_USER" "$AK"; chmod 600 "$AK"
# sudo exige le mot de passe de l'administrateur (jamais utilisé pour SSH).
if [ "$(passwd -S "$ADMIN_USER" | awk '{print $2}')" != "P" ]; then
  if [ -t 0 ]; then echo "Choisissez le mot de passe sudo de $ADMIN_USER (saisi ici, jamais ailleurs) :"; passwd "$ADMIN_USER";
  else echo "  ! Pas de mot de passe sudo : lancez « passwd $ADMIN_USER » avant de vous déconnecter."; fi
fi

step "3. SSH : clé uniquement, root interdit"
cat > /etc/ssh/sshd_config.d/10-ycom-hardening.conf <<CONF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
AllowUsers $ADMIN_USER
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
CONF
mkdir -p /run/sshd
sshd -t
svc reload ssh

step "4. Pare-feu (ufw) : 22, 80, 443"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw limit "$SSH_PORT/tcp" comment "SSH (limité)" >/dev/null
ufw allow 80/tcp comment "HTTP (redirection HTTPS)" >/dev/null
ufw allow 443/tcp comment "HTTPS" >/dev/null
ufw --force enable >/dev/null
ufw status verbose | sed -n '1,12p'

step "5. fail2ban (SSH)"
cat > /etc/fail2ban/jail.d/ycom.local <<CONF
[sshd]
enabled = true
port = $SSH_PORT
backend = systemd
maxretry = 4
findtime = 10m
bantime = 1h
bantime.increment = true
CONF
fail2ban-client -t >/dev/null
svc enable --now fail2ban
svc restart fail2ban

step "6. Mises à jour de sécurité automatiques"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<CONF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat > /etc/apt/apt.conf.d/52ycom-unattended <<CONF
Unattended-Upgrade::Allowed-Origins {
  "\${distro_id}:\${distro_codename}-security";
  "\${distro_id}ESMApps:\${distro_codename}-apps-security";
  "\${distro_id}ESM:\${distro_codename}-infra-security";
  "Docker:\${distro_codename}";
};
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
CONF
apt-config dump | grep -q "Automatic-Reboot-Time" 

step "7. Docker : journaux plafonnés, no-new-privileges"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<CONF
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "no-new-privileges": true,
  "live-restore": true
}
CONF
command -v docker >/dev/null && svc restart docker || true

step "8. Noyau : protections réseau"
cat > /etc/sysctl.d/90-ycom.conf <<CONF
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.tcp_syncookies = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
fs.protected_symlinks = 1
fs.protected_hardlinks = 1
CONF
[ "$NO_SYSTEMD" = 1 ] || sysctl --system >/dev/null

step "Terminé"
cat <<MSG
AVANT de fermer cette session root, ouvrez un SECOND terminal et vérifiez :
  ssh $ADMIN_USER@<IP>          (doit fonctionner)
  ssh root@<IP>                  (doit être refusé)
Puis : sudo bash infra/preview/server/setup-ops.sh (sauvegardes et surveillance).
MSG
