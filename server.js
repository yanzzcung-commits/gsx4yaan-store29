const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(process.env.DB_PATH || 'yaanz-store.db');
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) console.warn('Set ADMIN_PASSWORD in your hosting environment before deployment.');

db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer TEXT NOT NULL,
 contact TEXT NOT NULL,
 service TEXT NOT NULL,
 platform TEXT NOT NULL,
 target TEXT NOT NULL,
 amount INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'Menunggu',
 payment_status TEXT NOT NULL DEFAULT 'Belum dibayar',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS services (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 price INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1
);
`);
const count = db.prepare('SELECT COUNT(*) AS n FROM services').get().n;
if (!count) {
 const insert = db.prepare('INSERT INTO services (platform,title,description,price) VALUES (?,?,?,?)');
 const starter = [
  ['Instagram','Followers Instagram','Paket promosi akun; pastikan metode layanan sesuai aturan platform.',17000],
  ['TikTok','Paket Promosi TikTok','Bantuan perencanaan dan promosi konten.',15000],
  ['YouTube','Promosi YouTube','Paket promosi konten dan kanal.',15000],
  ['Facebook','Promosi Facebook','Bantuan promosi halaman dan konten.',8000],
  ['Telegram','Promosi Telegram','Paket promosi kanal atau komunitas.',10000],
  ['Lainnya','Konsultasi Media Sosial','Saran strategi dan ide konten.',5000]
 ];
 starter.forEach(s => insert.run(...s));
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
 secret: process.env.SESSION_SECRET || 'change-this-session-secret-before-deploy',
 resave: false, saveUninitialized: false,
 cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8*60*60*1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const requireAdmin = (req,res,next) => req.session && req.session.admin ? next() : res.status(401).json({error:'Silakan login admin.'});
app.get('/api/services', (req,res) => res.json(db.prepare('SELECT id,platform,title,description,price FROM services WHERE active=1 ORDER BY id').all()));
app.post('/api/orders', (req,res) => {
 const {customer,contact,serviceId,target} = req.body || {};
 if (!customer?.trim() || !contact?.trim() || !target?.trim()) return res.status(400).json({error:'Lengkapi nama, kontak, dan target layanan.'});
 const service = db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(Number(serviceId));
 if (!service) return res.status(400).json({error:'Layanan tidak ditemukan.'});
 const result = db.prepare('INSERT INTO orders (customer,contact,service,platform,target,amount) VALUES (?,?,?,?,?,?)')
  .run(customer.trim().slice(0,100),contact.trim().slice(0,150),service.title,service.platform,target.trim().slice(0,300),service.price);
 res.json({ok:true,orderId:result.lastInsertRowid,message:'Pesanan tercatat. Admin akan menghubungi untuk konfirmasi pembayaran.'});
});
app.post('/api/admin/login', (req,res) => {
 const {username,password} = req.body || {};
 if (!ADMIN_PASSWORD || username !== ADMIN_USER || password !== ADMIN_PASSWORD) return res.status(401).json({error:'Username atau password salah. Periksa Environment hosting.'});
 req.session.admin = true; res.json({ok:true});
});
app.post('/api/admin/logout', (req,res) => req.session.destroy(() => res.json({ok:true})));
app.get('/api/admin/me', (req,res) => res.json({loggedIn:!!req.session.admin}));
app.get('/api/admin/orders', requireAdmin, (req,res) => {
 const q = String(req.query.q || '').slice(0,100);
 res.json(db.prepare(`SELECT * FROM orders WHERE customer LIKE ? OR contact LIKE ? OR service LIKE ? ORDER BY id DESC LIMIT 500`).all(`%${q}%`,`%${q}%`,`%${q}%`));
});
app.patch('/api/admin/orders/:id', requireAdmin, (req,res) => {
 const {status,payment_status} = req.body || {};
 const allowedStatus = ['Menunggu','Diproses','Selesai','Dibatalkan'];
 const allowedPayment = ['Belum dibayar','Menunggu verifikasi','Dibayar','Dikembalikan'];
 if (status && !allowedStatus.includes(status)) return res.status(400).json({error:'Status pesanan tidak valid.'});
 if (payment_status && !allowedPayment.includes(payment_status)) return res.status(400).json({error:'Status pembayaran tidak valid.'});
 const row = db.prepare('SELECT id FROM orders WHERE id=?').get(Number(req.params.id));
 if (!row) return res.status(404).json({error:'Pesanan tidak ditemukan.'});
 if (status && payment_status) db.prepare('UPDATE orders SET status=?,payment_status=? WHERE id=?').run(status,payment_status,row.id);
 else if (status) db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,row.id);
 else if (payment_status) db.prepare('UPDATE orders SET payment_status=? WHERE id=?').run(payment_status,row.id);
 res.json({ok:true});
});
app.get('/api/admin/stats', requireAdmin, (req,res) => res.json({
 total: db.prepare('SELECT COUNT(*) n FROM orders').get().n,
 pending: db.prepare("SELECT COUNT(*) n FROM orders WHERE status='Menunggu'").get().n,
 revenue: db.prepare("SELECT COALESCE(SUM(amount),0) n FROM orders WHERE payment_status='Dibayar'").get().n
}));
app.get('/admin', (req,res) => res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log(`YAANZ STORE running on port ${PORT}`));
