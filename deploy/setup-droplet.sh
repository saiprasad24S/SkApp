#!/bin/bash
# =====================================================================
# SkandanHomecarre EmployeeHub — Droplet Setup Script
# Domain: employees.skandanhomecarrecclinic.com
#
# USAGE:
#   1. Create a DigitalOcean Droplet (Ubuntu 24.04, 2-4 GB RAM)
#   2. Point DNS A record: employees.skandanhomecarrecclinic.com → <Droplet IP>
#   3. SSH into the Droplet: ssh root@<Droplet IP>
#   4. Upload this repo to /home/skandan/app (or git clone)
#   5. Run: bash /home/skandan/app/deploy/setup-droplet.sh
#
# This script will:
#   - Install system packages (Python, Node, Nginx, Redis, MySQL client, etc.)
#   - Create the 'skandan' user (if not exists)
#   - Set up Python virtualenv & install pip dependencies
#   - Install Node.js & build the frontend
#   - Run Django migrations & collectstatic
#   - Configure Nginx & Supervisor
#   - Obtain SSL certificate via Certbot
#   - Start all services
# =====================================================================

set -euo pipefail

DOMAIN="employees.skandanhomecarrecclinic.com"
APP_DIR="/home/skandan/app"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
VENV_DIR="${BACKEND_DIR}/.venv"
LOG_DIR="/var/log/skandanhomecarre"

echo "============================================="
echo "  SkandanHomecarre Droplet Setup"
echo "  Domain: ${DOMAIN}"
echo "============================================="

# -----------------------------------------------
# 1. System packages
# -----------------------------------------------
echo ""
echo "[1/10] Installing system packages..."
apt update && apt upgrade -y
apt install -y \
    python3 python3-pip python3-venv python3-dev \
    build-essential libssl-dev libffi-dev \
    libmysqlclient-dev pkg-config \
    nginx redis-server \
    certbot python3-certbot-nginx \
    git curl supervisor ufw

# -----------------------------------------------
# 2. Firewall
# -----------------------------------------------
echo ""
echo "[2/10] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "Firewall configured."

# -----------------------------------------------
# 3. Create user
# -----------------------------------------------
echo ""
echo "[3/10] Setting up 'skandan' user..."
if ! id -u skandan &>/dev/null; then
    adduser --disabled-password --gecos "" skandan
    usermod -aG sudo skandan
    echo "User 'skandan' created."
else
    echo "User 'skandan' already exists."
fi

# Ensure app directory ownership
chown -R skandan:skandan "${APP_DIR}"

# -----------------------------------------------
# 4. Redis
# -----------------------------------------------
echo ""
echo "[4/10] Starting Redis..."
systemctl enable redis-server
systemctl start redis-server
redis-cli ping || echo "WARNING: Redis did not respond to PING"

# -----------------------------------------------
# 5. Python virtualenv & backend dependencies
# -----------------------------------------------
echo ""
echo "[5/10] Setting up Python backend..."
cd "${BACKEND_DIR}"

if [ ! -d "${VENV_DIR}" ]; then
    python3 -m venv "${VENV_DIR}"
fi
source "${VENV_DIR}/bin/activate"
pip install --upgrade pip
pip install -r requirements.txt

# -----------------------------------------------
# 6. Django migrations & static files
# -----------------------------------------------
echo ""
echo "[6/10] Running Django migrations & collectstatic..."

# Copy production env if not already in place
if [ -f "${BACKEND_DIR}/.env.production.example" ] && [ ! -f "${BACKEND_DIR}/.env" ]; then
    cp "${BACKEND_DIR}/.env.production.example" "${BACKEND_DIR}/.env"
    echo "Copied .env.production.example to .env — PLEASE EDIT WITH YOUR ACTUAL SECRETS"
fi

export DJANGO_SETTINGS_MODULE=skandan.settings
export PYTHONPATH="${BACKEND_DIR}"
python manage.py migrate --noinput
python manage.py collectstatic --noinput
deactivate

# -----------------------------------------------
# 7. Node.js & frontend build
# -----------------------------------------------
echo ""
echo "[7/10] Building frontend..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

cd "${FRONTEND_DIR}"
npm install
npm run build
echo "Frontend built successfully."

# -----------------------------------------------
# 8. Nginx configuration
# -----------------------------------------------
echo ""
echo "[8/10] Configuring Nginx..."
cp "${APP_DIR}/deploy/nginx-skandanhomecarre.conf" /etc/nginx/sites-available/skandanhomecarre
ln -sf /etc/nginx/sites-available/skandanhomecarre /etc/nginx/sites-enabled/skandanhomecarre
rm -f /etc/nginx/sites-enabled/default

# Create APK directory
mkdir -p "${APP_DIR}/apk"
chown skandan:skandan "${APP_DIR}/apk"

nginx -t
systemctl reload nginx
echo "Nginx configured and reloaded."

# -----------------------------------------------
# 9. Supervisor configuration
# -----------------------------------------------
echo ""
echo "[9/10] Configuring Supervisor..."
mkdir -p "${LOG_DIR}"
chown skandan:skandan "${LOG_DIR}"
cp "${APP_DIR}/deploy/supervisor-skandanhomecarre.conf" /etc/supervisor/conf.d/skandanhomecarre.conf
supervisorctl reread
supervisorctl update
supervisorctl restart skandanhomecarre || supervisorctl start skandanhomecarre
echo "Supervisor started Daphne."

# -----------------------------------------------
# 10. SSL Certificate
# -----------------------------------------------
echo ""
echo "[10/10] Obtaining SSL certificate..."
echo ""
echo "Make sure the DNS A record for ${DOMAIN} points to this server's IP."
echo ""
read -p "Press Enter to continue with Certbot, or Ctrl+C to skip and do it later... "
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email admin@skandanhomecarrecclinic.com --redirect || {
    echo "WARNING: Certbot failed. You can run it manually later:"
    echo "  sudo certbot --nginx -d ${DOMAIN}"
}

# -----------------------------------------------
# Done
# -----------------------------------------------
echo ""
echo "============================================="
echo "  SETUP COMPLETE!"
echo "============================================="
echo ""
echo "  Backend (Daphne):  http://127.0.0.1:8000"
echo "  Frontend:          https://${DOMAIN}"
echo "  API:               https://${DOMAIN}/api/"
echo "  WebSocket:         wss://${DOMAIN}/ws/"
echo "  APK Download:      https://${DOMAIN}/SkandanHomecarre.apk"
echo ""
echo "  Supervisor status: sudo supervisorctl status skandanhomecarre"
echo "  Backend logs:      tail -f ${LOG_DIR}/error.log"
echo ""
echo "  IMPORTANT:"
echo "  1. Edit ${BACKEND_DIR}/.env with your production secrets"
echo "  2. Upload your APK to ${APP_DIR}/apk/SkandanHomecarre.apk"
echo "  3. Test: curl -I https://${DOMAIN}/api/communication/overview/"
echo ""
