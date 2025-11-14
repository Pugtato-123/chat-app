// Realtime Chat Room
// Updated with colored users and improved auto-scroll

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', ({ room, username }, ack) => {
    room = String(room || 'main');
    username = String(username || 'Guest-' + socket.id.slice(0,4));

    socket.join(room);

    rooms[room] = rooms[room] || { users: {} };
    rooms[room].users[socket.id] = username;

    ack && ack({ ok: true, room, username });

    socket.to(room).emit('system', `${username} has joined the room.`);
    io.in(room).emit('users', Object.values(rooms[room].users));
  });

  socket.on('message', ({ room, text }) => {
    const username = (rooms[room] && rooms[room].users[socket.id]) || 'Unknown';
    const payload = { username, text, ts: Date.now() };
    io.in(room).emit('message', payload);
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
server.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://0.0.0.0:${PORT}`));

/*
------------------- public/index.html -------------------
The frontend <script> part should be updated as follows:
*/

/*
<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();

const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const joinBtn = document.getElementById('joinBtn');
const usersList = document.getElementById('users');
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingEl = document.getElementById('typing');

let currentRoom = null;
let currentUser = null;
let typingTimeout = null;
const userColors = {};

function getColor(username) {
  if (!userColors[username]) {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    userColors[username] = color;
  }
  return userColors[username];
}

function appendMessage(html) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = html;
  messagesEl.appendChild(div);

  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 100;
  if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || null;
  const room = roomInput.value.trim() || 'main';
  socket.emit('join', { room, username }, (res) => {
    if (res && res.ok) {
      currentRoom = res.room;
      currentUser = res.username;
      appendMessage(`<em>Joined room: ${currentRoom} as ${currentUser}</em>`);
    }
  });
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
  socket.emit('typing', { room: currentRoom, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { room: currentRoom, isTyping: false });
  }, 800);
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentRoom) return;
  socket.emit('message', { room: currentRoom, text });
  messageInput.value = '';
  socket.emit('typing', { room: currentRoom, isTyping: false });
}

socket.on('message', ({ username, text, ts }) => {
  const time = new Date(ts).toLocaleTimeString();
  appendMessage(`<strong style="color:${getColor(username)}">${escapeHtml(username)}</strong> <span class="time">${time}</span><div>${escapeHtml(text)}</div>`);
});

socket.on('system', (text) => {
  appendMessage(`<em>${escapeHtml(text)}</em>`);
});

socket.on('users', (users) => {
  usersList.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    usersList.appendChild(li);
  });
});

socket.on('typing', ({ username, isTyping }) => {
  typingEl.textContent = isTyping ? `${username} is typing…` : '';
});

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
</script>
*/