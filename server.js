const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const sqlite3 = require("sqlite3").verbose(); // simple local DB

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===== DATABASE =====
const db = new sqlite3.Database("./chat.db", (err) => {
  if (err) console.error(err);
  else console.log("DB connected");
});

// USERS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user',
  avatar TEXT,
  color TEXT,
  font TEXT,
  theme TEXT
)
`);

// MESSAGES TABLE
db.run(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  msg TEXT,
  time INTEGER
)
`);

// ===== UPLOAD CONFIG =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./public/uploads"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
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
  socket.on("login", ({ username, password }, callback) => {
    db.get(
      "SELECT * FROM users WHERE username=? AND password=?",
      [username, password],
      (err, row) => {
        if (err) return callback({ success: false });
        if (!row) return callback({ success: false });

        users[socket.id] = username;

        callback({
          success: true,
          font: row.font,
          theme: row.theme,
          color: row.color,
          avatar: row.avatar,
        });

        sendUserList();
        sendMessageHistory(socket);
      }
    );
  });

  // ---- REGISTER ----
  socket.on("register", ({ username, password }, callback) => {
    db.run(
      "INSERT INTO users(username,password) VALUES(?,?)",
      [username, password],
      function (err) {
        if (err) return callback({ success: false, message: "Username taken" });
        callback({ success: true });
      }
    );
  });

  // ---- SEND MESSAGE ----
  socket.on("chatMessage", (msg) => {
    const username = users[socket.id];
    if (!username) return;

    const time = Date.now();
    db.run(
      "INSERT INTO messages(username,msg,time) VALUES(?,?,?)",
      [username, msg, time],
      (err) => {
        if (err) return console.error(err);

        db.get("SELECT role, avatar, color FROM users WHERE username=?", [username], (err, row) => {
          if (err) return;

          io.emit("chatMessage", {
            username,
            msg,
            time,
            role: row.role,
            avatar: row.avatar,
            color: row.color,
          });
        });
      }
    );
  });

  // ---- CLEAR CHAT ----
  socket.on("clearChat", () => {
    const username = users[socket.id];
    if (!username) return;

    db.get("SELECT role FROM users WHERE username=?", [username], (err, row) => {
      if (err || !row) return;
      if (row.role !== "admin") return; // only admins

      db.run("DELETE FROM messages", (err) => {
        if (err) return console.error(err);
        io.emit("chatCleared");
      });
    });
  });

  // ---- SETTINGS ----
  socket.on("setAvatar", (avatar) => {
    const username = users[socket.id];
    if (!username) return;
    db.run("UPDATE users SET avatar=? WHERE username=?", [avatar, username]);
  });
  socket.on("setColor", (color) => {
    const username = users[socket.id];
    if (!username) return;
    db.run("UPDATE users SET color=? WHERE username=?", [color, username]);
  });
  socket.on("setFont", (font) => {
    const username = users[socket.id];
    if (!username) return;
    db.run("UPDATE users SET font=? WHERE username=?", [font, username]);
  });
  socket.on("setTheme", (theme) => {
    const username = users[socket.id];
    if (!username) return;
    db.run("UPDATE users SET theme=? WHERE username=?", [theme, username]);
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    delete users[socket.id];
    sendUserList();
  });

  // ---- SEND USER LIST ----
  function sendUserList() {
    const usernames = Object.values(users);
    if (!usernames.length) return;
    db.all(
      "SELECT username, avatar FROM users WHERE username IN (" +
        usernames.map(() => "?").join(",") +
        ")",
      usernames,
      (err, rows) => {
        if (err) return;
        io.emit("userList", rows);
      }
    );
  }

  // ---- SEND MESSAGE HISTORY ----
  function sendMessageHistory(targetSocket) {
    db.all("SELECT * FROM messages ORDER BY id ASC", [], (err, rows) => {
      if (err) return;
      targetSocket.emit("messageHistory", rows);
    });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));