const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { Pool } = require("pg");
const multer = require("multer");
const bcrypt = require("bcrypt");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== UPLOAD =====
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use("/uploads", express.static("uploads"));
app.use(express.static(path.join(__dirname, "public")));

// ===== DB SETUP =====
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

// ===== HELPERS =====
async function buildUserList() {
  return await Promise.all(
    Object.values(users).map(async (u) => {
      const res = await pool.query(
        "SELECT avatar FROM users WHERE username = $1",
        [u]
      );

      return {
        username: u,
        avatar: res.rows[0]?.avatar
      };
    })
  );
}

// ===== UPLOAD ROUTE =====
app.post("/upload", upload.single("image"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ===== SOCKET CONNECTION =====
io.on("connection", (socket) => {

  // ===== REGISTER =====
  socket.on("register", async ({ username, password }, cb) => {
    try {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO users (username,password) VALUES ($1,$2)",
        [username, hash]
      );
      cb({ success: true });
    } catch {
      cb({ success: false, message: "User exists" });
    }
  });

  // ===== LOGIN =====
  socket.on("login", async ({ username, password }, cb) => {
    const res = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    const user = res.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return cb({ success: false });
    }

    users[socket.id] = username;

    // LOAD HISTORY
    const result = await pool.query(`
      SELECT m.*, u.avatar, u.role, u.color, u.font, u.theme
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
      color: row.color,
      font: row.font,
      theme: row.theme
    }));

    socket.emit("messageHistory", history);

    // SEND USER LIST
    const userList = await buildUserList();
    io.emit("userList", userList);

    cb({
      success: true,
      avatar: user.avatar,
      role: user.role,
      color: user.color,
      font: user.font,
      theme: user.theme
    });
  });

  // ===== SETTINGS =====
  socket.on("setAvatar", async (url) => {
    const u = users[socket.id];
    if (!u) return;
    await pool.query("UPDATE users SET avatar=$1 WHERE username=$2", [url, u]);
  });

  socket.on("setFont", async (font) => {
    const u = users[socket.id];
    if (!u) return;
    await pool.query("UPDATE users SET font=$1 WHERE username=$2", [font, u]);
  });

  socket.on("setColor", async (color) => {
    const u = users[socket.id];
    if (!u) return;
    await pool.query("UPDATE users SET color=$1 WHERE username=$2", [color, u]);
  });

  socket.on("setTheme", async (theme) => {
    const u = users[socket.id];
    if (!u) return;
    await pool.query("UPDATE users SET theme=$1 WHERE username=$2", [theme, u]);
  });

  // ===== CHAT MESSAGE =====
  socket.on("chatMessage", async (msg) => {
    const u = users[socket.id];
    if (!u) return;

    const time = new Date().toISOString();
    const userRes = await pool.query(
      "SELECT avatar, role, color FROM users WHERE username=$1",
      [u]
    );
    const role = userRes.rows[0]?.role;

    // --- ADMIN COMMANDS ---
    if (msg === "/clear" && role === "admin") {
      await pool.query("DELETE FROM messages");
      io.emit("chatCleared"); // notify clients
      return;
    }

    if (msg.startsWith("/kick ") && role === "admin") {
      const target = msg.split(" ")[1];
      for (const [id, name] of Object.entries(users)) {
        if (name === target) io.sockets.sockets.get(id)?.disconnect();
      }
      return;
    }

    const messageData = {
      username: u,
      msg,
      time,
      ...userRes.rows[0]
    };

    await pool.query(
      "INSERT INTO messages (username,message,time) VALUES ($1,$2,$3)",
      [u, msg, time]
    );

    io.emit("chatMessage", messageData);
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", async () => {
    delete users[socket.id];
    const userList = await buildUserList();
    io.emit("userList", userList);
  });

});
  
// ===== START SERVER =====
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});