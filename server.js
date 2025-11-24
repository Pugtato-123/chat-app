const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

const ADMIN_PASSWORD = "changeme"; // <<< CHANGE THIS

let connectedUsers = new Map();
let adminSockets = new Set();
let messages = []; // last 10 messages stored

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Send last 10 messages to the new user
  socket.emit("messageHistory", messages);

  // User sets their name
  socket.on("setName", (name) => {
    connectedUsers.set(socket.id, { id: socket.id, name });
    io.emit("userList", Array.from(connectedUsers.values()));
    broadcastAdminUsers();
  });

  // Receive a chat message
  socket.on("chatMessage", (data) => {
    const entry = {
      user: data.user,
      message: data.message,
      time: data.time
    };

    messages.push(entry);
    if (messages.length > 10) messages.shift();

    io.emit("chatMessage", entry);
  });

  // ----- ADMIN SYSTEM -----

  socket.on("adminLogin", (password) => {
    if (password === ADMIN_PASSWORD) {
      adminSockets.add(socket.id);
      socket.emit("adminAuthorized", true);
      broadcastAdminUsers();
      console.log("Admin connected");
    } else {
      socket.emit("adminAuthorized", false);
    }
  });

  function broadcastAdminUsers() {
    const users = Array.from(connectedUsers.values());
    adminSockets.forEach(id => {
      io.to(id).emit("adminUserList", users);
    });
  }

  // Kick user
  socket.on("kickUser", (username) => {
    const entry = [...connectedUsers.entries()]
      .find(([id, user]) => user.name === username);

    if (entry) {
      const [id] = entry;
      io.to(id).emit("kicked");
      io.sockets.sockets.get(id)?.disconnect();
    }
  });

  // Clear chat
  socket.on("clearChat", () => {
    messages = [];
    io.emit("chatCleared");
  });

  // Disconnect
  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    adminSockets.delete(socket.id);
    io.emit("userList", Array.from(connectedUsers.values()));
    broadcastAdminUsers();
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
