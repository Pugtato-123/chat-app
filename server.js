const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== ACCOUNTS =====
const accounts = {
  "Johno": { password: "Pugtater", admin: true },
  "user": { password: "1111", admin: false }
};

// ===== DATA =====
let users = {}; // socket.id -> username
let messageHistory = [];
const MESSAGE_LIMIT = 10;

// ===== STATIC =====
app.use(express.static(path.join(__dirname, "public")));

// ===== SOCKET =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ===== LOGIN =====
  socket.on("login", ({ username, password }, callback) => {
    if (!accounts[username] || accounts[username].password !== password) {
      return callback({ success: false });
    }

    users[socket.id] = username;

    socket.emit("messageHistory", messageHistory);
    io.emit("userList", Object.values(users));

    callback({
      success: true,
      admin: accounts[username].admin
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

  // ===== ADMIN: CLEAR CHAT =====
  socket.on("clearChat", () => {
    const username = users[socket.id];
    if (!accounts[username]?.admin) return;

    messageHistory = [];
    io.emit("clearChat");
  });

  // ===== ADMIN: KICK =====
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

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});