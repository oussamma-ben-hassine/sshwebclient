(() => {
  const state = {
    token: localStorage.getItem('token') || '',
    servers: [],
    socket: null,
    connectedServerId: null,
  };

  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const serverForm = document.getElementById('server-form');
  const serverList = document.getElementById('server-list');
  const serverSelect = document.getElementById('terminal-server-select');
  const terminalStatus = document.getElementById('terminal-status');

  const term = new Terminal({
    cursorBlink: true,
    theme: { background: '#020617' },
    fontFamily: 'monospace',
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(document.getElementById('terminal'));

  setTimeout(() => {
    fitAddon.fit();
  }, 0);

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    };
  }

  async function api(path, options = {}) {
    const res = await fetch(path, options);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: 'Erreur API' }));
      throw new Error(payload.error || 'Erreur API');
    }
    return res.json();
  }

  function toggleView() {
    loginView.classList.toggle('hidden', Boolean(state.token));
    dashboardView.classList.toggle('hidden', !state.token);
  }

  function renderServers() {
    serverList.innerHTML = '';
    serverSelect.innerHTML = '';

    state.servers.forEach((server) => {
      const li = document.createElement('li');
      li.className = 'server-item';
      li.innerHTML = `
        <strong>${server.name}</strong>
        <span>${server.username}@${server.host}:${server.port}</span>
        <span>Auth: ${server.hasPrivateKey ? 'clé SSH' : ''} ${server.hasPassword ? 'mot de passe' : ''}</span>
        <div class="row">
          <button data-action="edit" data-id="${server.id}" class="secondary">Modifier</button>
          <button data-action="delete" data-id="${server.id}" class="secondary">Supprimer</button>
        </div>
      `;
      serverList.appendChild(li);

      const option = document.createElement('option');
      option.value = String(server.id);
      option.textContent = `${server.name} (${server.host})`;
      serverSelect.appendChild(option);
    });
  }

  function resetServerForm() {
    document.getElementById('server-id').value = '';
    serverForm.reset();
    document.getElementById('server-port').value = '22';
  }

  async function loadServers() {
    state.servers = await api('/api/servers', { headers: authHeaders() });
    renderServers();
  }

  async function login(username, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    state.token = data.token;
    localStorage.setItem('token', data.token);
    toggleView();
    await loadServers();
    connectSocket();
  }

  function logout() {
    state.token = '';
    localStorage.removeItem('token');
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    state.connectedServerId = null;
    toggleView();
  }

  function connectSocket() {
    if (state.socket) {
      state.socket.disconnect();
    }

    state.socket = io({ auth: { token: state.token } });
    state.socket.on('connect', () => {
      term.writeln('\r\n[Socket connecté]');
    });
    state.socket.on('ssh:output', (chunk) => term.write(chunk));
    state.socket.on('ssh:error', (error) => {
      terminalStatus.textContent = `Statut: erreur (${error})`;
      term.writeln(`\r\n[Erreur] ${error}`);
    });
    state.socket.on('ssh:status', (status) => {
      terminalStatus.textContent = `Statut: ${status}`;
    });
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      await login(username, password);
    } catch (error) {
      alert(error.message);
    }
  });

  serverForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('server-id').value;
    const body = {
      name: document.getElementById('server-name').value.trim(),
      host: document.getElementById('server-host').value.trim(),
      port: Number(document.getElementById('server-port').value),
      username: document.getElementById('server-username').value.trim(),
      password: document.getElementById('server-password').value,
      privateKey: document.getElementById('server-private-key').value,
    };

    try {
      if (id) {
        await api(`/api/servers/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        await api('/api/servers', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
      }
      resetServerForm();
      await loadServers();
    } catch (error) {
      alert(error.message);
    }
  });

  serverList.addEventListener('click', async (event) => {
    const target = event.target;
    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (!action || !id) return;

    if (action === 'delete') {
      if (!confirm('Supprimer ce serveur ?')) return;
      await api(`/api/servers/${id}`, { method: 'DELETE', headers: authHeaders() });
      await loadServers();
      return;
    }

    if (action === 'edit') {
      const server = state.servers.find((item) => String(item.id) === id);
      if (!server) return;
      document.getElementById('server-id').value = String(server.id);
      document.getElementById('server-name').value = server.name;
      document.getElementById('server-host').value = server.host;
      document.getElementById('server-port').value = String(server.port);
      document.getElementById('server-username').value = server.username;
      document.getElementById('server-password').value = '';
      document.getElementById('server-private-key').value = '';
    }
  });

  document.getElementById('reset-server-btn').addEventListener('click', resetServerForm);
  document.getElementById('logout-btn').addEventListener('click', logout);

  document.getElementById('change-password-btn').addEventListener('click', async () => {
    const oldPassword = prompt('Ancien mot de passe');
    const newPassword = prompt('Nouveau mot de passe (min 6 caractères)');
    if (!oldPassword || !newPassword) return;
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      alert('Mot de passe changé avec succès');
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('connect-btn').addEventListener('click', () => {
    const serverId = Number(serverSelect.value);
    if (!serverId || !state.socket) return;

    state.connectedServerId = serverId;
    state.socket.emit('ssh:connect', { serverId });
    term.focus();
  });

  document.getElementById('disconnect-btn').addEventListener('click', () => {
    if (state.socket) {
      state.socket.emit('ssh:disconnect');
    }
    state.connectedServerId = null;
  });

  term.onData((data) => {
    if (state.socket && state.connectedServerId) {
      state.socket.emit('ssh:data', data);
    }
  });

  window.addEventListener('resize', () => {
    fitAddon.fit();
    if (state.socket && state.connectedServerId) {
      state.socket.emit('ssh:resize', { cols: term.cols, rows: term.rows });
    }
  });

  async function init() {
    toggleView();
    if (state.token) {
      try {
        await loadServers();
        connectSocket();
      } catch (_error) {
        logout();
      }
    }
  }

  init();
})();
