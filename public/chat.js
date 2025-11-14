const socket = io();

// DOM elements
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

const myUsername = prompt("Enter your username") || 'Guest';
const room = 'main'; // always join same room

// Send message
sendBtn.addEventListener('click', () => {
  const text = msgInput.value;
  if (!text) return;
  socket.emit('message', { text });
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

// Users list (optional)
socket.on('users', (userList) => {
  const ul = document.getElementById('user-list');
  if (!ul) return;
  ul.innerHTML = '';
  userList.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    ul.appendChild(li);
  });
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
