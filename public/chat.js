const socket = io();

// DOM elements
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const userListEl = document.getElementById('user-list');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

let myUsername = '';
let joined = false;

// ---- JOIN BUTTON ----
joinBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (!name || joined) return;

  myUsername = name;
  joined = true;

  socket.emit('join', { username: myUsername }, (res) => {
    if (res.ok) {
      usernameInput.disabled = true;
      joinBtn.disabled = true;
      console.log(`Joined as ${res.username}`);
    }
  });
});

// ---- SEND MESSAGE ----
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !joined) return;

  socket.emit('message', { text });
  msgInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);

msgInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// ---- RECEIVE NORMAL MESSAGE ----
socket.on('message', (msg) => addMessageToChat(msg));

// ---- RECEIVE SYSTEM MESSAGE ----
socket.on('system', (text) => {
  const div = document.createElement('div');
  div.classList.add('system-message');
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// ---- USERS LIST UPDATE ----
socket.on('users', (users) => {
  userListEl.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    userListEl.appendChild(li);
  });
});

// ---- TYPING INDICATOR ----
msgInput.addEventListener('input', () => {
  if (!joined) return;
  socket.emit('typing', msgInput.value.length > 0);
});

socket.on('typing', ({ username, isTyping }) => {
  typingIndicator.textContent = isTyping ? `${username} is typing...` : '';
});

// ---- PAST MESSAGE HISTORY ----
socket.on('message-history', (messages) => {
  messages.forEach(msg => addMessageToChat(msg));
});

// ---- ADD MESSAGE TO CHAT (WITH TIME) ----
function addMessageToChat(msg) {
  const div = document.createElement('div');

  // highlight own messages
  if (msg.username === myUsername) div.classList.add('my-message');

  // highlight direct messages
  if (msg.type === 'direct') div.classList.add('direct-message');

  // Convert timestamp to readable time
  const time = formatTime(msg.time);

  div.textContent =
    msg.type === 'direct'
      ? `[${time}] (DM) ${msg.username}: ${msg.text}`
      : `[${time}] ${msg.username}: ${msg.text}`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ---- FORMAT HH:MM ----
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
