const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const app = express();
app.use(cors());
app.use(express.json());

const BASE = __dirname;
const UPLOAD_DIR = path.join(BASE, 'uploads');
const DB_FILE = path.join(BASE, 'data', 'app.db');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, passwordHash TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS listings (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, price REAL, listingType TEXT, beds INTEGER, description TEXT, address TEXT, images TEXT, createdAt INTEGER)`);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const hash = bcrypt.hashSync(password, 8);
  db.run(`INSERT INTO users (username, passwordHash) VALUES (?,?)`, [username, hash], function (err) {
    if (err) return res.status(400).json({ error: 'user exists or invalid' });
    const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  db.get(`SELECT id, passwordHash FROM users WHERE username = ?`, [username], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'invalid credentials' });
    if (!bcrypt.compareSync(password, row.passwordHash)) return res.status(400).json({ error: 'invalid credentials' });
    const token = jwt.sign({ id: row.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  });
});

function authMiddleware(req, res, next){
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if(!m) return res.status(401).json({ error: 'missing token' });
  try{
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.get('/api/listings', (req, res) => {
  db.all(`SELECT id, title, price, listingType, beds, description, address, images, createdAt FROM listings ORDER BY createdAt DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'failed to read listings' });
    const out = rows.map(r => ({ ...r, images: r.images ? JSON.parse(r.images) : [] }));
    res.json(out);
  });
});

app.post('/api/listings', authMiddleware, upload.array('images', 8), (req, res) => {
  try {
    const body = req.body || {};
    const files = req.files || [];
    const images = files.map(f => '/uploads/' + f.filename);
    const stmt = db.prepare(`INSERT INTO listings (title, price, listingType, beds, description, address, images, createdAt) VALUES (?,?,?,?,?,?,?,?)`);
    const createdAt = Date.now();
    stmt.run(body.title||'', Number(body.price)||0, body.listingType||'rent', Number(body.beds)||0, body.description||'', body.address||'', JSON.stringify(images), createdAt, function(err){
      if(err) return res.status(500).json({ error: 'failed to save' });
      db.get(`SELECT id, title, price, listingType, beds, description, address, images, createdAt FROM listings WHERE id = ?`, [this.lastID], (er,row)=>{
        if(er) return res.status(500).json({ error:'failed' });
        row.images = row.images ? JSON.parse(row.images) : [];
        res.json(row);
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to save listing' });
  }
});

// Update listing (partial). Accepts JSON body or form data. Protected.
app.put('/api/listings/:id', authMiddleware, upload.array('images', 8), (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  const body = req.body || {};
  const files = req.files || [];
  const images = files.length ? files.map(f => '/uploads/' + f.filename) : (body.images ? (typeof body.images === 'string' ? JSON.parse(body.images) : body.images) : null);
  // build update parts
  const fields = [];
  const params = [];
  if (body.title !== undefined) { fields.push('title = ?'); params.push(body.title); }
  if (body.price !== undefined) { fields.push('price = ?'); params.push(Number(body.price) || 0); }
  if (body.listingType !== undefined) { fields.push('listingType = ?'); params.push(body.listingType); }
  if (body.beds !== undefined) { fields.push('beds = ?'); params.push(Number(body.beds) || 0); }
  if (body.description !== undefined) { fields.push('description = ?'); params.push(body.description); }
  if (body.address !== undefined) { fields.push('address = ?'); params.push(body.address); }
  if (images !== null) { fields.push('images = ?'); params.push(JSON.stringify(images)); }
  if (!fields.length) return res.status(400).json({ error: 'no updatable fields' });
  params.push(id);
  const sql = `UPDATE listings SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: 'update failed' });
    db.get(`SELECT id, title, price, listingType, beds, description, address, images, createdAt FROM listings WHERE id = ?`, [id], (er, row) => {
      if (er) return res.status(500).json({ error: 'failed to fetch' });
      row.images = row.images ? JSON.parse(row.images) : [];
      res.json(row);
    });
  });
});

// Delete listing. Protected.
app.delete('/api/listings/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  db.run(`DELETE FROM listings WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'delete failed' });
    res.json({ ok: true });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
