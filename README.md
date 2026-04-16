# Web SSH Client (Dockerisé)

Application full stack permettant l'accès SSH à des serveurs depuis un navigateur.

## Stack technique

- **Backend** : Node.js + Express + Socket.IO + ssh2
- **Frontend** : SPA avec xterm.js
- **Base de données** : SQLite + Prisma
- **Sécurité** : JWT, bcrypt, chiffrement AES-256-GCM des identifiants SSH

## Fonctionnalités

- Login sécurisé par JWT
- Dashboard des serveurs enregistrés
- CRUD des serveurs SSH (nom, host, port, user, mot de passe/clé)
- Terminal SSH interactif en temps réel dans le navigateur
- Déconnexion/reconnexion dynamique
- Création automatique d'un utilisateur admin au premier démarrage

## Identifiants par défaut

- **Utilisateur** : `admin`
- **Mot de passe** : `admin`

> ⚠️ Changez immédiatement le mot de passe admin après la première connexion.

---

## Démarrage direct (recommandé)

1. Copier le fichier d'environnement:
   ```bash
   cp .env.example .env
   ```
2. Lancer l'application:
   ```bash
   docker-compose up --build -d
   ```
3. Vérifier l'état:
   ```bash
   docker-compose ps
   curl -fsS http://localhost:3000/health
   ```

Si tout est OK, l'application est disponible sur `http://localhost:3000`.

---

## Exécution locale (Docker)

```bash
docker-compose up --build
```

Application disponible sur:

- http://localhost:3000

La persistance locale est conservée via:

- `./data:/app/data`

---

## CI/CD GitHub Actions (professionnelle + simple)

Le dépôt inclut 2 workflows:

- **CI** (`.github/workflows/ci.yml`)
  - trigger: `push` + `pull_request`
  - checkout
  - install dépendances
  - lint (si script disponible)
  - tests (si script disponible)
  - build Docker de validation

- **Deploy** (`.github/workflows/deploy.yml`)
  - trigger: `push` sur `main`
  - build + push image vers **GHCR**
  - tags publiés:
    - `latest`
    - `sha-<12_caractères_du_commit>`
  - connexion SSH au VPS
  - `docker compose pull && up -d` via `docker-compose.prod.yml`
  - prune léger des images inutilisées

### Permissions minimales utilisées

- CI: `contents: read`
- Deploy: `contents: read`, `packages: write`

Aucun secret n'est hardcodé dans le code.

---

## Fichiers de déploiement production

- `docker-compose.prod.yml`: utilise une image GHCR (`image:`) au lieu d'un build local
- `scripts/deploy.sh`: script idempotent de déploiement côté VPS

> Le `docker-compose.yml` local (avec `build: .`) reste intact pour ne pas casser l'usage développeur.

---

## Secrets GitHub à configurer

Dans **Settings > Secrets and variables > Actions**, créer:

- `VPS_SSH_HOST` : IP / hostname du VPS
- `VPS_SSH_PORT` : port SSH (ex: `22`)
- `VPS_SSH_USER` : utilisateur SSH
- `VPS_SSH_PRIVATE_KEY` : clé privée (format OpenSSH)
- `VPS_APP_PATH` : chemin de l'app sur le VPS (ex: `/opt/web-ssh`)
- `VPS_GHCR_USERNAME` : utilisateur/robot autorisé à pull GHCR
- `VPS_GHCR_TOKEN` : token GHCR avec permission `read:packages`

> Le push GHCR côté workflow utilise `GITHUB_TOKEN` (pas besoin d'ajouter un secret pour ça).

---

## Préparation du VPS (une seule fois)

1. Installer Docker + plugin Docker Compose.
2. Créer le dossier applicatif, ex:
   ```bash
   sudo mkdir -p /opt/web-ssh/data
   sudo chown -R $USER:$USER /opt/web-ssh
   ```
3. Créer `/opt/web-ssh/.env` à partir de `.env.example` (avec vraies valeurs).
4. Vérifier que l'utilisateur SSH peut exécuter `docker`.

Exemple minimal de `.env` sur VPS:

```env
PORT=3000
DATABASE_URL=file:/app/data/app.db
JWT_SECRET=...
ENCRYPTION_KEY=...
ADMIN_USER=admin
ADMIN_PASS=... # uniquement utile au premier démarrage
```

---

## Procédure de déploiement automatique

- Merge/push sur `main`
- GitHub Actions:
  1. build + push image GHCR
  2. SSH vers VPS
  3. pull image taggée SHA
  4. restart service

---

## Rollback simple

Lister les tags existants en GHCR, puis sur le VPS:

```bash
cd /opt/web-ssh
IMAGE_REPO=ghcr.io/<owner>/<repo>
IMAGE_TAG=sha-<ancien_sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Rollback instantané possible tant que le tag SHA existe dans GHCR.

---


## Dépannage VPS (erreurs fréquentes)

Si le déploiement échoue sur le VPS, vérifiez dans cet ordre:

1. `docker --version`
2. `docker compose version`
3. présence de `/opt/web-ssh/.env`
4. accès GHCR avec le token:
   ```bash
   echo "$VPS_GHCR_TOKEN" | docker login ghcr.io -u "$VPS_GHCR_USERNAME" --password-stdin
   ```
5. logs du service:
   ```bash
   cd /opt/web-ssh
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs --tail=200
   ```

Le script `scripts/deploy.sh` arrête explicitement le déploiement avec un message clair si Docker, Docker Compose, `.env` ou `docker-compose.prod.yml` est manquant.

---

## Développement local (sans Docker)

```bash
npm install
npm run bootstrap
npm start
```

## API rapide

- `POST /api/auth/login`
- `POST /api/auth/change-password`
- `GET /api/servers`
- `POST /api/servers`
- `PUT /api/servers/:id`
- `DELETE /api/servers/:id`
- Socket.IO events: `ssh:connect`, `ssh:data`, `ssh:resize`, `ssh:disconnect`
