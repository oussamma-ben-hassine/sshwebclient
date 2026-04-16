#!/usr/bin/env bash
set -Eeuo pipefail

APP_PATH="${APP_PATH:?APP_PATH is required}"
IMAGE_REPO="${IMAGE_REPO:?IMAGE_REPO is required}"
IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
GHCR_USERNAME="${GHCR_USERNAME:?GHCR_USERNAME is required}"
GHCR_TOKEN="${GHCR_TOKEN:?GHCR_TOKEN is required}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker is not installed on VPS." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] docker compose plugin is missing on VPS." >&2
  exit 1
fi

cd "$APP_PATH"
mkdir -p data

if [ ! -f .env ]; then
  echo "[ERROR] Missing $APP_PATH/.env (required for production runtime vars)." >&2
  exit 1
fi

if [ ! -f docker-compose.prod.yml ]; then
  echo "[ERROR] Missing $APP_PATH/docker-compose.prod.yml." >&2
  exit 1
fi

# Login GHCR (token via stdin, jamais affiché dans les logs).
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null

export IMAGE_REPO IMAGE_TAG

echo "[INFO] Pulling image ${IMAGE_REPO}:${IMAGE_TAG}"
docker compose -f docker-compose.prod.yml pull

echo "[INFO] Restarting service"
docker compose -f docker-compose.prod.yml up -d

# Nettoyage léger pour limiter la consommation disque.
docker image prune -f >/dev/null

echo "[OK] Deployment completed: ${IMAGE_REPO}:${IMAGE_TAG}"
