const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);


// Get DOM elements
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');

let myUsername = '';
let currentRoom = '';

// Join room
joinBtn.addEventListener('click', () => {
  const username = usernameInput.value || 'Guest';
  const room = roomInput.value || 'main';
  myUsername = username;
  currentRoom = room;

  socket.emit('join', { username, room }, (res) => {
    if (res.ok) {
      chatBox.innerHTML = ''; // clear chat on join
    }
  });
});

// Listen for previous messages
socket.on('previousMessages', (messages) => {
  messages.forEach(msg => addMessageToChat(msg));
});

// Send message
sendBtn.addEventListener('click', () => {
  const text = msgInput.value;
  if (!text) return;
  socket.emit('message', { room: currentRoom, text });
  msgInput.value = '';
});

// Display messages
socket.on('message', (msg) => {
  addMessageToChat(msg);
});

// Display system messages
socket.on('system', (text) => {
  const div = document.createElement('div');
  div.classList.add('system-message');
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Display users list (optional)
socket.on('users', (users) => {
  const userList = document.getElementById('user-list');
  if (userList) {
    userList.innerHTML = '';
    users.forEach(u => {
      const li = document.createElement('li');
      li.textContent = u;
      userList.appendChild(li);
    });
  }
});

// Add message to chat
function addMessageToChat(msg) {
  const div = document.createElement('div');

  if (msg.username === myUsername) {
    div.classList.add('my-message'); // highlight your own messages
  }

  if (msg.type === 'direct') {
    div.classList.add('direct-message');
    if (msg.to && msg.to === myUsername) {
      div.textContent = `(DM to me) ${msg.username}: ${msg.text}`;
    } else {
      div.textContent = `(DM) ${msg.username}: ${msg.text}`;
    }
  } else {
    div.textContent = `${msg.username}: ${msg.text}`;
  }

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Optional: typing indicator
msgInput.addEventListener('input', () => {
  socket.emit('typing', { room: currentRoom, isTyping: msgInput.value.length > 0 });
});

socket.on('typing', ({ username, isTyping }) => {
  const typingDiv = document.getElementById('typing-indicator');
  if (!typingDiv) return;
  if (isTyping) {
    typingDiv.textContent = `${username} is typing...`;
  } else {
    typingDiv.textContent = '';
  }
});
