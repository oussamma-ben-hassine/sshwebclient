const http = require('http');
const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const { Server } = require('socket.io');
const { Client: SSHClient } = require('ssh2');

const config = require('./config');
const prisma = require('./prisma');
const { encrypt, decrypt } = require('./crypto');
const { signToken, authMiddleware, socketAuth } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());
app.use('/vendor/xterm', express.static(path.join(__dirname, '..', 'node_modules', 'xterm', 'lib')));
app.use('/vendor/xterm-addon-fit', express.static(path.join(__dirname, '..', 'node_modules', 'xterm-addon-fit', 'lib')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  return res.json({ token: signToken(user), username: user.username });
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Mot de passe invalide (min. 6 caractères)' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = user && await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return res.json({ success: true });
});

app.get('/api/servers', authMiddleware, async (_req, res) => {
  const servers = await prisma.server.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json(servers.map((item) => ({
    id: item.id,
    name: item.name,
    host: item.host,
    port: item.port,
    username: item.username,
    hasPassword: Boolean(item.encryptedPassword),
    hasPrivateKey: Boolean(item.encryptedKey),
  })));
});

app.post('/api/servers', authMiddleware, async (req, res) => {
  const { name, host, port, username, password, privateKey } = req.body;
  if (!name || !host || !username) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  if (!password && !privateKey) {
    return res.status(400).json({ error: 'Mot de passe ou clé privée requis' });
  }

  const created = await prisma.server.create({
    data: {
      name,
      host,
      port: Number(port) || 22,
      username,
      encryptedPassword: encrypt(password),
      encryptedKey: encrypt(privateKey),
    },
  });

  return res.status(201).json({ id: created.id });
});

app.put('/api/servers/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { name, host, port, username, password, privateKey, clearPassword, clearPrivateKey } = req.body;

  const existing = await prisma.server.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Serveur introuvable' });
  }

  const data = {
    name: name ?? existing.name,
    host: host ?? existing.host,
    port: port ? Number(port) : existing.port,
    username: username ?? existing.username,
  };

  if (clearPassword) data.encryptedPassword = null;
  if (clearPrivateKey) data.encryptedKey = null;
  if (password) data.encryptedPassword = encrypt(password);
  if (privateKey) data.encryptedKey = encrypt(privateKey);

  await prisma.server.update({ where: { id }, data });
  return res.json({ success: true });
});

app.delete('/api/servers/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.server.delete({ where: { id } });
  return res.json({ success: true });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

io.use(socketAuth);
io.on('connection', (socket) => {
  let ssh = null;
  let stream = null;

  socket.on('ssh:connect', async ({ serverId }) => {
    try {
      const serverConfig = await prisma.server.findUnique({ where: { id: Number(serverId) } });
      if (!serverConfig) {
        socket.emit('ssh:error', 'Serveur introuvable');
        return;
      }

      ssh = new SSHClient();

      ssh.on('ready', () => {
        ssh.shell((err, shellStream) => {
          if (err) {
            socket.emit('ssh:error', `Shell error: ${err.message}`);
            return;
          }
          stream = shellStream;
          socket.emit('ssh:status', 'connected');

          shellStream.on('data', (data) => socket.emit('ssh:output', data.toString('utf8')));
          shellStream.on('close', () => {
            socket.emit('ssh:status', 'disconnected');
            ssh.end();
          });
        });
      });

      ssh.on('error', (err) => {
        socket.emit('ssh:error', err.message);
      });

      ssh.connect({
        host: serverConfig.host,
        port: serverConfig.port,
        username: serverConfig.username,
        password: decrypt(serverConfig.encryptedPassword) || undefined,
        privateKey: decrypt(serverConfig.encryptedKey) || undefined,
        readyTimeout: 20000,
      });
    } catch (error) {
      socket.emit('ssh:error', error.message);
    }
  });

  socket.on('ssh:data', (data) => {
    if (stream) {
      stream.write(data);
    }
  });

  socket.on('ssh:resize', ({ cols, rows }) => {
    if (stream && stream.setWindow) {
      stream.setWindow(rows, cols, rows, cols);
    }
  });

  socket.on('ssh:disconnect', () => {
    if (ssh) ssh.end();
    socket.emit('ssh:status', 'disconnected');
  });

  socket.on('disconnect', () => {
    if (ssh) ssh.end();
  });
});

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Web SSH client running on http://localhost:${config.port}`);
});
