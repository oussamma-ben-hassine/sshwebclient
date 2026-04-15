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

## Lancer avec Docker

```bash
docker-compose up --build
```

Application disponible sur:

- http://localhost:3000

## Persistance

Le dossier `./data` est monté vers `/app/data` dans le conteneur pour conserver SQLite.

## Variables d'environnement

Voir `.env.example`.

Variables clés:

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `ADMIN_USER`
- `ADMIN_PASS`
- `DATABASE_URL`

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
