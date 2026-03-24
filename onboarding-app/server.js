const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'clients.json');

// Users
const USERS = {
  lu: { password: 'Hyp3r1a$2026', name: 'Lu' },
  ferran: { password: 'Mak3da$2026', name: 'Ferran' }
};

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const sessions = {};

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data dir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// DB helpers
function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { console.error('DB read error:', e); }
  return { clients: {}, customSteps: [] };
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Auth middleware
function auth(req, res, next) {
  const sid = req.cookies?.sid;
  if (sid && sessions[sid]) {
    req.user = sessions[sid];
    return next();
  }
  // If API request, return 401
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  // Otherwise serve login page
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
}

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username];
  if (!user || user.password !== password) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const sid = crypto.randomBytes(24).toString('hex');
  sessions[sid] = { username, name: user.name };
  res.cookie('sid', sid, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
  res.json({ ok: true, name: user.name });
});

app.post('/api/logout', (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) delete sessions[sid];
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// API: Get all clients
app.get('/api/clients', auth, (req, res) => {
  const db = readDB();
  res.json(db);
});

// API: Save client
app.put('/api/clients/:id', auth, (req, res) => {
  const db = readDB();
  const id = req.params.id;
  db.clients[id] = req.body;
  db.clients[id].updatedBy = req.user.name;
  db.clients[id].updatedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true });
});

// API: Delete client
app.delete('/api/clients/:id', auth, (req, res) => {
  const db = readDB();
  delete db.clients[req.params.id];
  writeDB(db);
  res.json({ ok: true });
});

// API: Custom steps
app.get('/api/custom-steps', auth, (req, res) => {
  const db = readDB();
  res.json(db.customSteps || []);
});

app.put('/api/custom-steps', auth, (req, res) => {
  const db = readDB();
  db.customSteps = req.body;
  writeDB(db);
  res.json({ ok: true });
});

// Protected app route
app.get('/', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Onboarding app running on port ${PORT}`));
