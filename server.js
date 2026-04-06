// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== DATABASE (PostgreSQL) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" 
    ? { rejectUnauthorized: false } 
    : false
});

// ===== STATIC + UPLOAD SETUP =====
app.use(express.static("public"));

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

// ===== REALTIME CHAT (Socket.IO) =====
let users = {}; // socket.id => username

io.on("connection", (socket) => {

  // ===== LOGIN =====
  socket.on("login", async ({ username, password }, callback) => {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE username=$1",
        [username]
      );
      const user = result.rows[0];
      if (!user) return callback({ success: false });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return callback({ success: false });

      users[socket.id] = username;

      callback({
        success: true,
        avatar: user.avatar,
        role: user.role,
        color: user.color,
        font: user.font,
        theme: user.theme,
      });

      sendUserList();
      sendMessageHistory(socket);
    } catch (err) {
      console.error(err);
      callback({ success: false });
    }
  });

  // ===== REGISTER =====
  socket.on("register", async ({ username, password }, callback) => {
    try {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO users (username,password) VALUES ($1,$2)",
        [username, hash]
      );
      callback({ success: true });
    } catch (err) {
      if (err.code === "23505") {
        callback({ success: false, message: "Username taken" });
      } else {
        console.error(err);
        callback({ success: false });
      }
    }
  });

  // ===== SEND MESSAGE =====
  socket.on("chatMessage", async (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const time = new Date().toISOString();

    try {
      await pool.query(
        "INSERT INTO messages (username,message,time) VALUES ($1,$2,$3)",
        [username, msg, time]
      );

      const userRes = await pool.query(
        "SELECT role, avatar, color FROM users WHERE username=$1",
        [username]
      );

      const u = userRes.rows[0];
      io.emit("chatMessage", {
        username,
        msg,
        time,
        role: u.role,
        avatar: u.avatar,
        color: u.color,
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ===== CLEAR CHAT =====
  socket.on("clearChat", async () => {
    const username = users[socket.id];
    if (!username) return;

    try {
      const roleRes = await pool.query(
        "SELECT role FROM users WHERE username=$1",
        [username]
      );
      if (roleRes.rows[0]?.role !== "admin") return;
      await pool.query("DELETE FROM messages");
      io.emit("chatCleared");
    } catch (err) {
      console.error(err);
    }
  });

  // ===== SETTINGS =====
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

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    delete users[socket.id];
    sendUserList();
  });

  // ===== HELPERS =====
  async function sendUserList() {
    const names = Object.values(users);
    if (!names.length) return;

    try {
      const res = await pool.query(
        "SELECT username, avatar FROM users WHERE username = ANY($1)",
        [names]
      );
      io.emit("userList", res.rows);
    } catch (err) {
      console.error(err);
    }
  }

  async function sendMessageHistory(targetSocket) {
    try {
      const res = await pool.query("SELECT * FROM messages ORDER BY id ASC");
      targetSocket.emit("messageHistory", res.rows);
    } catch (err) {
      console.error(err);
    }
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running: " + PORT));