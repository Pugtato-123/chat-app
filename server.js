const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render
});

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== LOAD ACCOUNTS =====
let accounts = JSON.parse(fs.readFileSync("accounts.json", "utf8"));

// ===== DATA =====
let users = {};
let messageHistory = [];
const MESSAGE_LIMIT = 10;

// ===== STATIC =====
app.use(express.static(path.join(__dirname, "public")));

// ===== SOCKET =====
io.on("connection", (socket) => {

  // ===== REGISTER =====
socket.on("register", async ({ username, password }, callback) => {
  try {
    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username, password]
    );

    callback({ success: true });
  } catch (err) {
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

  socket.emit("messageHistory", messageHistory);
  io.emit("userList", Object.values(users));

  callback({
    success: true,
    admin: user.admin
  });
});

  // ===== MESSAGE =====
  socket.on("chatMessage", (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const messageData = {
      username,
      msg,
      time: new Date().toLocaleTimeString()
    };

    messageHistory.push(messageData);
    if (messageHistory.length > MESSAGE_LIMIT) {
      messageHistory.shift();
    }

    io.emit("chatMessage", messageData);
  });

  // ===== ADMIN =====
  socket.on("clearChat", () => {
    const username = users[socket.id];
    if (!accounts[username]?.admin) return;

    messageHistory = [];
    io.emit("clearChat");
  });

  socket.on("kickUser", (targetUsername) => {
    const username = users[socket.id];
    if (!accounts[username]?.admin) return;

    const targetSocket = Object.keys(users).find(
      (id) => users[id] === targetUsername
    );

    if (targetSocket) {
      io.to(targetSocket).emit("kicked");
      io.sockets.sockets.get(targetSocket)?.disconnect();
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      admin BOOLEAN DEFAULT false
    )
  `);
})();