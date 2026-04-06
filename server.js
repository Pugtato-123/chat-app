// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== POSTGRES POOL =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/chatdb",
});

// ===== MIDDLEWARE =====
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===== UPLOAD CONFIG =====
const uploadDir = "./public/uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ===== IMAGE UPLOAD =====
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ===== SOCKET.IO =====
const users = {}; // socket.id -> username

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // ---- LOGIN ----
  socket.on("login", async ({ username, password }, callback) => {
    try {
      const res = await pool.query(
        "SELECT * FROM users WHERE username=$1 AND password=$2",
        [username, password]
      );
      if (!res.rows[0]) return callback({ success: false });

      users[socket.id] = username;

      callback({
        success: true,
        font: res.rows[0].font,
        theme: res.rows[0].theme,
        color: res.rows[0].color,
        avatar: res.rows[0].avatar,
        role: res.rows[0].role,
      });

      sendUserList();
      sendMessageHistory(socket);
    } catch (err) {
      console.error(err);
      callback({ success: false });
    }
  });

  // ---- REGISTER ----
  socket.on("register", async ({ username, password }, callback) => {
    try {
      await pool.query(
        "INSERT INTO users(username,password,role) VALUES($1,$2,'user')",
        [username, password]
      );
      callback({ success: true });
    } catch (err) {
      callback({ success: false, message: "Username taken" });
    }
  });

  // ---- SEND MESSAGE ----
  socket.on("chatMessage", async (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const time = Date.now();
    try {
      await pool.query("INSERT INTO messages(username,msg,time) VALUES($1,$2,$3)", [
        username,
        msg,
        time,
      ]);
      const userRes = await pool.query(
        "SELECT role, avatar, color FROM users WHERE username=$1",
        [username]
      );
      const user = userRes.rows[0];
      io.emit("chatMessage", { username, msg, time, role: user.role, avatar: user.avatar, color: user.color });
    } catch (err) {
      console.error(err);
    }
  });

  // ---- CLEAR CHAT ----
  socket.on("clearChat", async () => {
    const username = users[socket.id];
    if (!username) return;

    try {
      const roleRes = await pool.query("SELECT role FROM users WHERE username=$1", [username]);
      if (!roleRes.rows[0] || roleRes.rows[0].role !== "admin") return;
      await pool.query("DELETE FROM messages");
      io.emit("chatCleared");
    } catch (err) {
      console.error(err);
    }
  });

  // ---- SETTINGS ----
  socket.on("setAvatar", async (avatar) => {
    const username = users[socket.id];
    if (!username) return;
    await pool.query("UPDATE users SET avatar=$1 WHERE username=$2", [avatar, username]);
  });
  socket.on("setColor", async (color) => {
    const username = users[socket.id];
    if (!username) return;
    await pool.query("UPDATE users SET color=$1 WHERE username=$2", [color, username]);
  });
  socket.on("setFont", async (font) => {
    const username = users[socket.id];
    if (!username) return;
    await pool.query("UPDATE users SET font=$1 WHERE username=$2", [font, username]);
  });
  socket.on("setTheme", async (theme) => {
    const username = users[socket.id];
    if (!username) return;
    await pool.query("UPDATE users SET theme=$1 WHERE username=$2", [theme, username]);
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    delete users[socket.id];
    sendUserList();
  });

  // ---- SEND USER LIST ----
  async function sendUserList() {
    const usernames = Object.values(users);
    if (!usernames.length) return;
    try {
      const res = await pool.query(
        `SELECT username, avatar FROM users WHERE username = ANY($1)`,
        [usernames]
      );
      io.emit("userList", res.rows);
    } catch (err) {
      console.error(err);
    }
  }

  // ---- SEND MESSAGE HISTORY ----
  async function sendMessageHistory(targetSocket) {
    try {
      const res = await pool.query("SELECT * FROM messages ORDER BY id ASC");
      targetSocket.emit("messageHistory", res.rows);
    } catch (err) {
      console.error(err);
    }
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));