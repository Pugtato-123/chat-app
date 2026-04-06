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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== FILE UPLOAD =====
const upload = multer({
  dest: "public/uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ===== TABLE SETUP =====
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      admin BOOLEAN DEFAULT false
    );
  `);

  const cols = ["avatar", "role", "color"];
  for (const col of cols) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
    } catch {}
  }

  await pool.query(`UPDATE users SET role='user' WHERE role IS NULL`);
  await pool.query(`UPDATE users SET color='#93c5fd' WHERE color IS NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      username TEXT,
      message TEXT,
      time BIGINT
    );
  `);
})();

let users = {};

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ===== UPLOAD ROUTE =====
app.post("/upload", upload.single("image"), (req, res) => {
  res.json({ url: "/uploads/" + req.file.filename });
});

// ===== SOCKET =====
io.on("connection", (socket) => {

  socket.on("register", async ({ username, password }, cb) => {
    try {
      await pool.query(
        "INSERT INTO users (username, password) VALUES ($1,$2)",
        [username, password]
      );
      cb({ success: true });
    } catch {
      cb({ success: false });
    }
  });

  socket.on("login", async ({ username, password }, cb) => {
    const res = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    const user = res.rows[0];
    if (!user || user.password !== password) {
      return cb({ success: false });
    }

    users[socket.id] = user.username;

    const msgs = await pool.query("SELECT * FROM messages ORDER BY id ASC");

    const history = await Promise.all(
      msgs.rows.map(async (row) => {
        const u = await pool.query(
          "SELECT avatar, role, color FROM users WHERE username=$1",
          [row.username]
        );

        return {
          username: row.username,
          msg: row.message,
          time: row.time,
          avatar: u.rows[0]?.avatar,
          role: u.rows[0]?.role,
          color: u.rows[0]?.color
        };
      })
    );

    socket.emit("messageHistory", history);
    io.emit("userList", Object.values(users));

    cb({
      success: true,
      admin: user.admin,
      avatar: user.avatar,
      role: user.role,
      color: user.color
    });
  });

  socket.on("setAvatar", async (url) => {
    const username = users[socket.id];
    if (!username) return;

    await pool.query(
      "UPDATE users SET avatar=$1 WHERE username=$2",
      [url, username]
    );
  });

  socket.on("chatMessage", async (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const res = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    const user = res.rows[0];

    // ===== SLASH COMMANDS =====
    if (msg.startsWith("/")) {
      const [cmd, target, value] = msg.split(" ");

      if (cmd === "/kick" && (user.admin || user.role === "mod")) {
        const targetSocket = Object.keys(users).find(
          id => users[id] === target
        );
        if (targetSocket) {
          io.to(targetSocket).emit("kicked");
          io.sockets.sockets.get(targetSocket)?.disconnect();
        }
        return;
      }

      if (cmd === "/clear" && (user.admin || user.role === "mod")) {
        await pool.query("DELETE FROM messages");
        io.emit("clearChat");
        return;
      }

      if (cmd === "/role" && user.admin) {
        await pool.query(
          "UPDATE users SET role=$1 WHERE username=$2",
          [value, target]
        );
        return;
      }

      if (cmd === "/color" && user.admin) {
        await pool.query(
          "UPDATE users SET color=$1 WHERE username=$2",
          [value, target]
        );
        return;
      }

      return;
    }

    const time = Date.now();

    await pool.query(
      "INSERT INTO messages (username,message,time) VALUES ($1,$2,$3)",
      [username, msg, time]
    );

    await pool.query(`
      DELETE FROM messages
      WHERE id NOT IN (
        SELECT id FROM messages ORDER BY id DESC LIMIT 100
      )
    `);

    io.emit("chatMessage", {
      username,
      msg,
      time,
      avatar: user.avatar,
      role: user.role,
      color: user.color
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});