const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Always send index.html for the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ---- CHAT DATA ----
const defaultRoom = "main";
const messageHistory = [];   // store last 10 chat messages

// ---- USER LIST ----
function getUsersInRoom(room) {
  return Array.from(io.sockets.adapter.rooms.get(room) || []).map(
    id => io.sockets.sockets.get(id)?.data?.username
  ).filter(Boolean);
}

function updateUsers(room) {
  io.to(room).emit("users", getUsersInRoom(room));
}

// ---- SOCKET HANDLING ----
io.on("connection", (socket) => {

  // ---- JOIN EVENT ----
  socket.on("join", ({ username }, callback) => {
    socket.data.username = username;
    socket.join(defaultRoom);

    // send last 10 messages
    socket.emit("message-history", messageHistory);

    // system message
    io.to(defaultRoom).emit("system", `${username} joined the chat`);

    updateUsers(defaultRoom);

    callback({ ok: true, room: defaultRoom, username });
  });

  // ---- SEND MESSAGE ----
  socket.on("message", ({ text }) => {
    const msg = {
      username: socket.data.username,
      text,
      time: Date.now(),
      type: "normal",
    };

    // save to history
    messageHistory.push(msg);
    if (messageHistory.length > 10) messageHistory.shift();

    io.to(defaultRoom).emit("message", msg);
  });

  // ---- TYPING INDICATOR ----
  socket.on("typing", (isTyping) => {
    socket.to(defaultRoom).emit("typing", {
      username: socket.data.username,
      isTyping
    });
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    if (socket.data.username) {
      io.to(defaultRoom).emit("system", `${socket.data.username} left the chat`);
      updateUsers(defaultRoom);
    }
  });

});

// ---- START SERVER ----
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
