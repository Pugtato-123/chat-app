// Render-ready Chat App Server
// Own messages highlight, room switching, direct messages, serving frontend correctly

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Default route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};
const userSockets = {};

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', ({ room, username }, ack) => {
    room = String(room || 'main');
    username = String(username || 'Guest-' + socket.id.slice(0,4));

    socket.join(room);
    rooms[room] = rooms[room] || { users: {} };
    rooms[room].users[socket.id] = username;
    userSockets[username] = socket.id;

    ack && ack({ ok: true, room, username });

    socket.to(room).emit('system', `${username} has joined the room.`);
    io.in(room).emit('users', Object.values(rooms[room].users));
  });

  socket.on('message', ({ room, text }) => {
    const username = (rooms[room] && rooms[room].users[socket.id]) || 'Unknown';
    const payload = { username, text, ts: Date.now(), type: 'normal' };
    io.in(room).emit('message', payload);
  });

  socket.on('directMessage', ({ toUsername, text }) => {
    const toSocketId = userSockets[toUsername];
    if(toSocketId){
      const username = Object.values(rooms).map(r=>r.users[socket.id])[0] || 'Unknown';
      io.to(toSocketId).emit('message', { username, text, ts: Date.now(), type: 'direct' });
      socket.emit('message', { username, text, ts: Date.now(), type: 'direct', to: toUsername });
    }
  });

  socket.on('typing', ({ room, isTyping }) => {
    const username = (rooms[room] && rooms[room].users[socket.id]) || 'Unknown';
    socket.to(room).emit('typing', { username, isTyping });
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (rooms[room] && rooms[room].users[socket.id]) {
        const username = rooms[room].users[socket.id];
        delete rooms[room].users[socket.id];
        delete userSockets[username];
        socket.to(room).emit('system', `${username} has left.`);
        io.in(room).emit('users', Object.values(rooms[room].users));
      }
    }
  });

  socket.on('leave', ({ room }) => {
    socket.leave(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));