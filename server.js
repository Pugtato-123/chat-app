const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Track users in the room
const users = {}; // socket.id -> username
const ROOM = 'main'; // always join same room
const MESSAGE_HISTORY_LIMIT = 10;
const messageHistory = []; // stores last N messages

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Auto-join the default room
  socket.join(ROOM);

  // Handle join with username
  socket.on('join', ({ username }, ack) => {
    if (!username) username = 'Guest-' + socket.id.slice(0, 4);
    users[socket.id] = username;

    // Send last messages to the new user
    socket.emit('message-history', messageHistory);

    socket.to(ROOM).emit('system', `${username} has joined the room.`);
    io.in(ROOM).emit('users', Object.values(users));

    ack && ack({ ok: true, username, room: ROOM });
  });

  // Handle normal messages
  socket.on('message', ({ text }) => {
    const username = users[socket.id] || 'Unknown';
    const msg = { username, text, type: 'normal' };
    
    // Save to history
    messageHistory.push(msg);
    if (messageHistory.length > MESSAGE_HISTORY_LIMIT) messageHistory.shift();

    io.in(ROOM).emit('message', msg);
  });

  // Handle direct messages
  socket.on('directMessage', ({ toUsername, text }) => {
    const toSocketId = Object.keys(users).find(id => users[id] === toUsername);
    const username = users[socket.id] || 'Unknown';
    const msg = { username, text, type: 'direct', to: toUsername };

    if (toSocketId) {
      io.to(toSocketId).emit('message', msg);
      socket.emit('message', msg);
    }
  });

  // Typing indicator
  socket.on('typing', (isTyping) => {
    const username = users[socket.id] || 'Unknown';
    socket.to(ROOM).emit('typing', { username, isTyping });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const username = users[socket.id];
    delete users[socket.id];
    socket.to(ROOM).emit('system', `${username} has left the room.`);
    io.in(ROOM).emit('users', Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
