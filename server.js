const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'clients.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

// ===== Users =====
const USERS = {
  'lu': bcrypt.hashSync('Hyp3r1a2026!', 10),
  'ferran': bcrypt.hashSync('Mak3da2026!', 10)
};

// ===== Sessions =====
const sessions = {};

function genToken() { return crypto.randomBytes(32).toString('hex'); }

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  req.user = sessions[token];
  next();
}

// ===== DB =====
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) return { clients: {}, customSteps: [] };
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return { clients: {}, customSteps: [] };
  }
}

function writeDB(data) {
  ensureDataDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ===== Auth routes =====
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (!user || !pass) return res.status(400).json({ error: 'Faltan credenciales' });
  const hash = USERS[user.toLowerCase()];
  if (!hash || !bcrypt.compareSync(pass, hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const token = genToken();
  sessions[token] = { user: user.toLowerCase(), loginAt: Date.now() };
  res.json({ token, user: user.toLowerCase() });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) delete sessions[token];
  res.json({ ok: true });
});

// ===== Client routes =====
app.get('/api/clients', authMiddleware, (req, res) => {
  const db = readDB();
  const summary = {};
  for (const [k, v] of Object.entries(db.clients)) {
    const totalChecks = Object.values(v.checks || {}).length;
    const doneChecks = Object.values(v.checks || {}).filter(c => c.done).length;
    summary[k] = {
      name: v.name,
      tipo: v.tipo,
      created: v.created,
      progress: totalChecks ? Math.round((doneChecks / totalChecks) * 100) : 0,
      done: doneChecks,
      total: totalChecks
    };
  }
  res.json({ clients: summary, customSteps: db.customSteps || [] });
});

app.get('/api/clients/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const client = db.clients[req.params.id];
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ client, customSteps: db.customSteps || [] });
});

app.post('/api/clients', authMiddleware, (req, res) => {
  const { id, name, tipo } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Faltan datos' });
  const db = readDB();
  if (db.clients[id]) return res.status(409).json({ error: 'Ya existe' });
  db.clients[id] = {
    name,
    tipo: tipo || 'outbound+inbound',
    created: new Date().toISOString().split('T')[0],
    datos: {},
    checks: {},
    notes: {}
  };
  writeDB(db);
  res.json({ ok: true });
});

app.put('/api/clients/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const client = db.clients[req.params.id];
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  const { datos, checks, notes, name, tipo } = req.body;
  if (datos !== undefined) client.datos = { ...client.datos, ...datos };
  if (checks !== undefined) client.checks = { ...client.checks, ...checks };
  if (notes !== undefined) client.notes = { ...client.notes, ...notes };
  if (name !== undefined) client.name = name;
  if (tipo !== undefined) client.tipo = tipo;
  writeDB(db);
  res.json({ ok: true });
});

app.delete('/api/clients/:id', authMiddleware, (req, res) => {
  const db = readDB();
  delete db.clients[req.params.id];
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/clients/:id/duplicate', authMiddleware, (req, res) => {
  const { newId, newName } = req.body;
  if (!newId || !newName) return res.status(400).json({ error: 'Faltan datos' });
  const db = readDB();
  const src = db.clients[req.params.id];
  if (!src) return res.status(404).json({ error: 'Origen no encontrado' });
  if (db.clients[newId]) return res.status(409).json({ error: 'Ya existe' });
  db.clients[newId] = {
    ...JSON.parse(JSON.stringify(src)),
    name: newName,
    created: new Date().toISOString().split('T')[0],
    checks: {},
    notes: {}
  };
  writeDB(db);
  res.json({ ok: true });
});

// ===== Check toggle =====
app.post('/api/clients/:id/check', authMiddleware, (req, res) => {
  const { checkId, done, note } = req.body;
  const db = readDB();
  const client = db.clients[req.params.id];
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (!client.checks) client.checks = {};
  client.checks[checkId] = {
    done: !!done,
    date: done ? new Date().toISOString() : null,
    user: req.user.user,
    note: note || ''
  };
  writeDB(db);
  res.json({ ok: true });
});

// ===== Notes per item =====
app.post('/api/clients/:id/note', authMiddleware, (req, res) => {
  const { checkId, value } = req.body;
  const db = readDB();
  const client = db.clients[req.params.id];
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (!client.notes) client.notes = {};
  client.notes[checkId] = value || '';
  writeDB(db);
  res.json({ ok: true });
});

// ===== Datos del cliente =====
app.post('/api/clients/:id/datos', authMiddleware, (req, res) => {
  const { field, value } = req.body;
  const db = readDB();
  const client = db.clients[req.params.id];
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (!client.datos) client.datos = {};
  client.datos[field] = value || '';
  writeDB(db);
  res.json({ ok: true });
});

// ===== Custom steps =====
app.post('/api/custom-steps', authMiddleware, (req, res) => {
  const { phaseId, text, tag } = req.body;
  if (!phaseId || !text) return res.status(400).json({ error: 'Faltan datos' });
  const db = readDB();
  if (!db.customSteps) db.customSteps = [];
  const id = 'custom_' + Date.now();
  db.customSteps.push({ id, phaseId, text, tag: tag || 'Dev', created: new Date().toISOString() });
  writeDB(db);
  res.json({ ok: true, id });
});

app.delete('/api/custom-steps/:stepId', authMiddleware, (req, res) => {
  const db = readDB();
  db.customSteps = (db.customSteps || []).filter(s => s.id !== req.params.stepId);
  writeDB(db);
  res.json({ ok: true });
});

// ===== Export =====
app.get('/api/clients/:id/export', authMiddleware, (req, res) => {
  const db = readDB();
  const client = db.clients[req.params.id];
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ client, customSteps: db.customSteps || [] });
});

// ===== Serve frontend =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Onboarding app running on port ${PORT}`);
  ensureDataDir();
});
