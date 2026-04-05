const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== DATA =====
let users = {}; // socket.id -> username
let messageHistory = [];
const MESSAGE_LIMIT = 10;

// ===== STATIC =====
app.use(express.static(path.join(__dirname, "public")));

// ===== SOCKET =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ===== JOIN =====
  socket.on("join", (username) => {
    if (!username) return;

    users[socket.id] = username;

    // send history
    socket.emit("messageHistory", messageHistory);

    // update users
    io.emit("userList", Object.values(users));
  });

  // ===== MESSAGE =====
  socket.on("chatMessage", (msg) => {
    const username = users[socket.id];

    if (!username) return; // prevents undefined messages

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

  // ===== CLEAR CHAT (ADMIN) =====
  socket.on("clearChat", () => {
    messageHistory = [];
    io.emit("clearChat");
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

// ===== START =====
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});