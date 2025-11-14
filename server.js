const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Track users in the room
const users = {};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  const username = 'Guest-' + socket.id.slice(0, 4);
  const room = 'main';
  users[socket.id] = username;

  // Auto-join room
  socket.join(room);
  socket.to(room).emit('system', `${username} has joined the room.`);
  io.in(room).emit('users', Object.values(users));

  // Handle messages
  socket.on('message', ({ text }) => {
    io.in(room).emit('message', { username, text, ts: Date.now(), type: 'normal' });
  });

  // Handle direct messages
  socket.on('directMessage', ({ toUsername, text }) => {
    const toSocketId = Object.keys(users).find(id => users[id] === toUsername);
    if (toSocketId) {
      io.to(toSocketId).emit('message', { username, text, ts: Date.now(), type: 'direct', to: toUsername });
      socket.emit('message', { username, text, ts: Date.now(), type: 'direct', to: toUsername });
    }
  });

  // Typing indicator
  socket.on('typing', (isTyping) => {
    socket.to(room).emit('typing', { username, isTyping });
  });

  // Disconnect
  socket.on('disconnect', () => {
    delete users[socket.id];
    socket.to(room).emit('system', `${username} has left.`);
    io.in(room).emit('users', Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
