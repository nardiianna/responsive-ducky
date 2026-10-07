const $ = (s) => document.querySelector(s);

const state = {
  os: 'ios',
  kind: 'all',
  search: '',
  status: null,
  devices: { ios: [], android: [], mac: [] },
  sessions: loadSessions(),
  shots: [],
};

const BROWSERS = {
  ios: [
    { id: 'safari', name: 'Safari' },
    // On iOS every browser (Chrome included) must use WebKit, so pages render as in Safari.
    { id: 'chrome', name: 'Chrome', note: 'motore Safari' },
  ],
  android: [{ id: 'chrome', name: 'Chrome' }],
};

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem('sessions') || '[]');
  } catch {
    return [];
  }
}
function saveSessions() {
  try {
    localStorage.setItem('sessions', JSON.stringify(state.sessions));
  } catch { /* ignore */ }
}

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, error = false, ms = 4000) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (error ? ' error' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

function currentUrl() {
  const v = $('#url').value.trim();
  if (!v) {
    $('#url').focus();
    throw new Error('Scrivi prima l\'URL del sito in alto');
  }
  return v;
}

async function refresh() {
  try {
    const [status, devices] = await Promise.all([api('/api/status'), api('/api/devices')]);
    state.status = status;
    state.devices = devices;
    // Drop sessions whose device is no longer running.
    state.sessions = state.sessions.filter((s) => {
      if (s.platform === 'mac') return false;
      const d = devices[s.platform].find((x) => x.id === s.deviceId);
      return d && d.booted;
    });
    saveSessions();
  } catch (e) {
    toast('Server non raggiungibile: avvia "npm start"', true);
  }
  render();
}

function render() {
  renderNotice();
  renderDevices();
  renderSessions();
  renderShots();
}

function renderNotice() {
  const n = $('#notice');
  const s = state.status?.[state.os];
  if (!s || s.available) {
    n.hidden = true;
    return;
  }
  n.hidden = false;
  if (state.os === 'ios') {
    n.innerHTML = `
      <h3>Per iPhone e iPad serve Xcode</h3>
      <ol>
        <li>Installa <strong>Xcode</strong> dall'App Store.</li>
        <li>Aprilo una volta: quando lo chiede, scarica la piattaforma <strong>iOS</strong>.</li>
        <li>Nel Terminale: <code>sudo xcode-select -s /Applications/Xcode.app</code></li>
      </ol>
      <button class="browser-btn" data-action="recheck">Ricontrolla</button>`;
  } else {
    n.innerHTML = `
      <h3>Per Android serve Android Studio</h3>
      <ol>
        <li>Installa <strong>Android Studio</strong> da developer.android.com/studio.</li>
        <li>Apri <em>Device Manager</em> e crea un dispositivo (telefono o tablet) con immagine <strong>Google Play</strong>, così c'è Chrome.</li>
      </ol>
      <button class="browser-btn" data-action="recheck">Ricontrolla</button>`;
  }
}

function deviceIcon(kind) {
  return kind === 'tablet' ? '📱' : '📲';
}

function renderDevices() {
  const list = $('#device-list');
  $('#filters').hidden = state.os === 'mac';

  if (state.os === 'mac') {
    const browsers = state.devices.mac;
    list.innerHTML = `
      <div class="device">
        <div class="kind">💻</div>
        <div><div class="name">Questo Mac</div><div class="os">Browser installati</div></div>
        <div class="browsers">
          ${browsers.map((b) => `<button class="browser-btn" data-launch data-platform="mac" data-browser="${b.id}">${b.name}</button>`).join('')}
        </div>
      </div>`;
    return;
  }

  const q = state.search.toLowerCase();
  const devices = state.devices[state.os].filter((d) =>
    (state.kind === 'all' || d.kind === state.kind) && d.name.toLowerCase().includes(q));

  if (!devices.length) {
    list.innerHTML = state.status?.[state.os]?.available
      ? '<div class="empty">Nessun dispositivo trovato.</div>'
      : '';
    return;
  }

  // Group by OS version (iOS) or a single group (Android).
  const groups = {};
  for (const d of devices) {
    const key = d.osVersion ? `${state.os === 'ios' ? 'iOS' : 'Android'} ${d.osVersion}` : 'Dispositivi';
    (groups[key] ||= []).push(d);
  }

  list.innerHTML = Object.entries(groups).map(([title, devs]) => `
    <div class="group-title">${title}</div>
    ${devs.map((d) => `
      <div class="device">
        <div class="kind">${deviceIcon(d.kind)}</div>
        <div>
          <div class="name">${escapeHtml(d.name)}${d.booted ? '<span class="live">● acceso</span>' : ''}</div>
          <div class="os">${d.kind === 'tablet' ? 'Tablet' : 'Smartphone'}</div>
        </div>
        <div class="browsers">
          ${BROWSERS[state.os].map((b) => `
            <button class="browser-btn" data-launch data-platform="${state.os}" data-device="${d.id}"
              data-name="${escapeHtml(d.name)}" data-browser="${b.id}" title="Apri in ${b.name}">
              ${b.name}${b.note ? ` <small>${b.note}</small>` : ''}
            </button>`).join('')}
        </div>
      </div>`).join('')}
  `).join('');
}

function renderSessions() {
  const el = $('#session-list');
  if (!state.sessions.length) {
    el.innerHTML = '<p class="muted">Nessun dispositivo avviato.</p>';
    return;
  }
  el.innerHTML = state.sessions.map((s, i) => `
    <div class="session">
      <div class="title">${escapeHtml(s.name)} · ${s.browserName}</div>
      <div class="url">${escapeHtml(s.url)}</div>
      <div class="actions">
        <button data-session="${i}" data-action="open">Apri URL attuale</button>
        <button data-session="${i}" data-action="screenshot">📸 Screenshot</button>
        <button data-session="${i}" data-action="light">☀️</button>
        <button data-session="${i}" data-action="dark">🌙</button>
        <button data-session="${i}" data-action="shutdown" class="stop">Spegni</button>
      </div>
      <div class="tip">${s.platform === 'ios'
        ? 'Nel Simulator: ⌘← / ⌘→ ruota, ⌘K tastiera, trascina per scrollare.'
        : 'Nell\'emulatore: usa i tasti laterali per ruotare.'}</div>
    </div>`).join('');
}

function renderShots() {
  const el = $('#shots');
  if (!state.shots.length) {
    el.innerHTML = '<p class="muted">Ancora nessuno.</p>';
    return;
  }
  el.innerHTML = state.shots.map((s) => `
    <a href="${s.file}" target="_blank"><img src="${s.file}" alt=""><span>${escapeHtml(s.label)}</span></a>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function launch(btn) {
  const { platform, device, browser, name } = btn.dataset;
  let url;
  try {
    url = currentUrl();
  } catch (e) {
    return toast(e.message, true);
  }
  const browserName = btn.textContent.trim().split(/\s+/)[0];
  btn.disabled = true;
  toast(platform === 'mac'
    ? `Apro ${browserName}…`
    : `Avvio ${name}… la prima volta può richiedere fino a un minuto.`, false, 60_000);
  try {
    const res = await api('/api/launch', { platform, deviceId: device, browser, url });
    if (platform !== 'mac') {
      state.sessions = state.sessions.filter((s) => s.deviceId !== device);
      state.sessions.unshift({ platform, deviceId: device, name, browserName, url: res.url });
      saveSessions();
    }
    toast(platform === 'ios' && browser === 'chrome'
      ? 'Aperto. Nota: su iOS Chrome usa lo stesso motore di Safari, quindi il sito si vede uguale.'
      : 'Aperto ✓', false, 5000);
    await refresh();
  } catch (e) {
    toast(e.message, true, 8000);
  } finally {
    btn.disabled = false;
  }
}

async function sessionAction(btn) {
  const s = state.sessions[Number(btn.dataset.session)];
  const action = btn.dataset.action;
  btn.disabled = true;
  try {
    const base = { platform: s.platform, deviceId: s.deviceId };
    if (action === 'open') {
      const res = await api('/api/open', { ...base, url: currentUrl() });
      s.url = res.url;
      saveSessions();
    } else if (action === 'screenshot') {
      const res = await api('/api/screenshot', { ...base, label: s.name });
      state.shots.unshift({ file: res.file, label: s.name });
      toast('Screenshot salvato nella cartella screenshots/');
    } else if (action === 'light' || action === 'dark') {
      await api('/api/appearance', { ...base, mode: action });
    } else if (action === 'shutdown') {
      await api('/api/shutdown', base);
      state.sessions = state.sessions.filter((x) => x !== s);
      saveSessions();
      await refresh();
    }
    render();
  } catch (e) {
    toast(e.message, true, 8000);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.os) {
    state.os = btn.dataset.os;
    document.querySelectorAll('#os-nav button').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  } else if (btn.dataset.kind) {
    state.kind = btn.dataset.kind;
    document.querySelectorAll('#kind-filter button').forEach((b) => b.classList.toggle('active', b === btn));
    renderDevices();
  } else if (btn.hasAttribute('data-launch')) {
    launch(btn);
  } else if (btn.dataset.session !== undefined) {
    sessionAction(btn);
  } else if (btn.dataset.action === 'recheck' || btn.id === 'refresh') {
    refresh();
  }
});

$('#search').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderDevices();
});

$('#url-form').addEventListener('submit', (e) => e.preventDefault());
try {
  $('#url').value = localStorage.getItem('lastUrl') || '';
} catch { /* ignore */ }
$('#url').addEventListener('change', (e) => {
  try { localStorage.setItem('lastUrl', e.target.value); } catch { /* ignore */ }
});

refresh();
