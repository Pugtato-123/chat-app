const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== CREATE TABLES =====
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      admin BOOLEAN DEFAULT false,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      color TEXT DEFAULT '#93c5fd'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      username TEXT,
      message TEXT,
      time TEXT
    );
  `);
})();

// ===== IN-MEMORY USERS =====
let users = {}; // socket.id => username

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, "public")));

// ===== SOCKET.IO =====
io.on("connection", (socket) => {

  // ===== REGISTER =====
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

  // ===== LOGIN =====
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

    // load messages
    const result = await pool.query(
      "SELECT * FROM messages ORDER BY id ASC"
    );

    const history = result.rows.map(row => ({
      username: row.username,
      msg: row.message,
      time: row.time,
      avatar: null,
      role: "user",
      color: "#93c5fd"
    }));

    socket.emit("messageHistory", history);
    io.emit("userList", Object.values(users));

    callback({
      success: true,
      admin: user.admin,
      avatar: user.avatar,
      role: user.role,
      color: user.color
    });
  });

  // ===== SET AVATAR =====
  socket.on("setAvatar", async (url) => {
    const username = users[socket.id];
    if (!username) return;

    await pool.query(
      "UPDATE users SET avatar = $1 WHERE username = $2",
      [url, username]
    );

    // Emit update to everyone
    io.emit("avatarChanged", { username, avatar: url });
  });

  // ===== SET ROLE (ADMIN ONLY) =====
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

  // ===== SET COLOR (ADMIN ONLY) =====
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

  // ===== SEND MESSAGE =====
  socket.on("chatMessage", async (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const time = new Date().toLocaleTimeString();

    const userRes = await pool.query(
      "SELECT avatar, role, color FROM users WHERE username = $1",
      [username]
    );

    const { avatar, role, color } = userRes.rows[0];

    const messageData = { username, msg, time, avatar, role, color };

    await pool.query(
      "INSERT INTO messages (username, message, time) VALUES ($1, $2, $3)",
      [username, msg, time]
    );

    // keep only last 100 messages
    await pool.query(`
      DELETE FROM messages
      WHERE id NOT IN (
        SELECT id FROM messages ORDER BY id DESC LIMIT 100
      )
    `);

    io.emit("chatMessage", messageData);
  });

  // ===== CLEAR CHAT (ADMIN) =====
  socket.on("clearChat", async () => {
    const username = users[socket.id];
    const res = await pool.query(
      "SELECT admin FROM users WHERE username = $1",
      [username]
    );
    if (!res.rows[0]?.admin) return;

    await pool.query("DELETE FROM messages");
    io.emit("clearChat");
  });

  // ===== KICK (ADMIN) =====
  socket.on("kickUser", async (targetUsername) => {
    const username = users[socket.id];
    const res = await pool.query(
      "SELECT admin FROM users WHERE username = $1",
      [username]
    );
    if (!res.rows[0]?.admin) return;

    const targetSocket = Object.keys(users).find(
      id => users[id] === targetUsername
    );

    if (targetSocket) {
      io.to(targetSocket).emit("kicked");
      io.sockets.sockets.get(targetSocket)?.disconnect();
    }
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });

});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});