const socket = io();

// DOM elements
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

let myUsername = '';
const room = 'main'; // always join same room

// Prompt for username once
while (!myUsername) {
  myUsername = prompt("Enter your username")?.trim() || '';
}

// Auto-join room
socket.emit('join', { username: myUsername, room }, (res) => {
  if (res.ok) {
    console.log(`Joined room: ${res.room} as ${res.username}`);
  }
});

// Send message function
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;
  socket.emit('message', { text });
  msgInput.value = '';
}

// Send message on button click
sendBtn.addEventListener('click', sendMessage);

// Send message on Enter key
msgInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
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

// Typing indicator
msgInput.addEventListener('input', () => {
  socket.emit('typing', msgInput.value.length > 0);
});

socket.on('typing', ({ username, isTyping }) => {
  if (!typingIndicator) return;
  typingIndicator.textContent = isTyping ? `${username} is typing...` : '';
});

// Add message to chat
function addMessageToChat(msg) {
  const div = document.createElement('div');
  if (msg.username === myUsername) div.classList.add('my-message');
  if (msg.type === 'direct') div.classList.add('direct-message');

  div.textContent = msg.type === 'direct'
    ? `(DM) ${msg.username}: ${msg.text}`
    : `${msg.username}: ${msg.text}`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
