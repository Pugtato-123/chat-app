const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { Pool } = require("pg");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== FILE UPLOAD =====
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use("/uploads", express.static("uploads"));

// ===== CREATE / FIX TABLES =====
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      admin BOOLEAN DEFAULT false,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      color TEXT DEFAULT '#93c5fd',
      font TEXT DEFAULT 'default',
      theme TEXT DEFAULT 'macchiato'
    );
  `);

  // ensure columns exist
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#93c5fd'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS font TEXT DEFAULT 'default'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'macchiato'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      username TEXT,
      message TEXT,
      time TEXT
    );
  `);
})();

// ===== DATA =====
let users = {};

// ===== STATIC =====
app.use(express.static(path.join(__dirname, "public")));

// ===== UPLOAD ROUTE =====
app.post("/upload", upload.single("image"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ===== SOCKET =====
io.on("connection", (socket) => {

  // REGISTER
  socket.on("register", async ({ username, password }, callback) => {
    try {
      await pool.query(
        "INSERT INTO users (username, password) VALUES ($1, $2)",
        [username, password]
      );
      callback({ success: true });
    } catch {
      callback({ success: false, message: "User exists" });
    }
  });

  // LOGIN
  socket.on("login", async ({ username, password }, callback) => {
    const res = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    const user = res.rows[0];

    if (!user || user.password !== password) {
      return callback({ success: false });
    }

    users[socket.id] = user.username;

    // LOAD HISTORY WITH USER DATA
    const result = await pool.query(`
      SELECT m.*, u.avatar, u.role, u.color
      FROM messages m
      LEFT JOIN users u ON m.username = u.username
      ORDER BY m.id ASC
    `);

    const history = result.rows.map(row => ({
      username: row.username,
      msg: row.message,
      time: row.time,
      avatar: row.avatar,
      role: row.role,
      color: row.color
    }));

    socket.emit("messageHistory", history);
    io.emit("userList", Object.values(users));

    callback({
      success: true,
      admin: user.admin,
      avatar: user.avatar,
      role: user.role,
      color: user.color,
      font: user.font,
      theme: user.theme
    });
  });

  // ===== SETTINGS =====
  socket.on("setAvatar", async (url) => {
    const username = users[socket.id];
    if (!username) return;

    await pool.query(
      "UPDATE users SET avatar = $1 WHERE username = $2",
      [url, username]
    );
  });

  socket.on("setFont", async (font) => {
    const username = users[socket.id];
    if (!username) return;

    await pool.query(
      "UPDATE users SET font = $1 WHERE username = $2",
      [font, username]
    );
  });

  socket.on("setTheme", async (theme) => {
    const username = users[socket.id];
    if (!username) return;

    await pool.query(
      "UPDATE users SET theme = $1 WHERE username = $2",
      [theme, username]
    );
  });

  // ===== ADMIN / MOD =====
  socket.on("setRole", async ({ target, role }) => {
    const username = users[socket.id];

    const res = await pool.query(
      "SELECT admin FROM users WHERE username = $1",
      [username]
    );

    if (!res.rows[0]?.admin) return;

    await pool.query(
      "UPDATE users SET role = $1 WHERE username = $2",
      [role, target]
    );
  });

  socket.on("setColor", async ({ target, color }) => {
    const username = users[socket.id];

    const res = await pool.query(
      "SELECT admin FROM users WHERE username = $1",
      [username]
    );

    if (!res.rows[0]?.admin) return;

    await pool.query(
      "UPDATE users SET color = $1 WHERE username = $2",
      [color, target]
    );
  });

  socket.on("clearChat", async () => {
    const username = users[socket.id];

    const res = await pool.query(
      "SELECT role FROM users WHERE username = $1",
      [username]
    );

    if (!["admin", "mod"].includes(res.rows[0]?.role)) return;

    await pool.query("DELETE FROM messages");
    io.emit("clearChat");
  });

  socket.on("kickUser", async (targetUsername) => {
    const username = users[socket.id];

    const res = await pool.query(
      "SELECT role FROM users WHERE username = $1",
      [username]
    );

    if (!["admin", "mod"].includes(res.rows[0]?.role)) return;

    const targetSocket = Object.keys(users).find(
      (id) => users[id] === targetUsername
    );

    if (targetSocket) {
      io.to(targetSocket).emit("kicked");
      io.sockets.sockets.get(targetSocket)?.disconnect();
    }
  });

  // ===== MESSAGE =====
  socket.on("chatMessage", async (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const time = new Date().toISOString();

    const userRes = await pool.query(
      "SELECT avatar, role, color FROM users WHERE username = $1",
      [username]
    );

    const { avatar, role, color } = userRes.rows[0];

    const messageData = {
      username,
      msg,
      time,
      avatar,
      role,
      color
    };

    await pool.query(
      "INSERT INTO messages (username, message, time) VALUES ($1, $2, $3)",
      [username, msg, time]
    );

    await pool.query(`
      DELETE FROM messages
      WHERE id NOT IN (
        SELECT id FROM messages ORDER BY id DESC LIMIT 100
      )
    `);

    io.emit("chatMessage", messageData);
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});