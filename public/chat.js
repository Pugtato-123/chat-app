const socket = io();

// DOM elements
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const userListEl = document.getElementById('user-list');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const imageInput = document.getElementById('image-input');

let myUsername = '';
let joined = false;

// ----- Browser tab notifications -----
const originalTitle = document.title;
let unreadCount = 0;

function handleVisibilityChange() {
  if (!document.hidden) {
    unreadCount = 0;
    document.title = originalTitle;
  }
}
document.addEventListener("visibilitychange", handleVisibilityChange);

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
    }
  });
});

// ---- SEND TEXT MESSAGE ----
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

// ---- SEND IMAGE ----
imageInput.addEventListener('change', () => {
  if (!joined || !imageInput.files.length) return;

  const file = imageInput.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    const base64Data = reader.result;
    socket.emit('image', { data: base64Data, name: file.name });
  };

  reader.readAsDataURL(file);
  imageInput.value = "";
});

// ---- RECEIVE TEXT MESSAGE ----
socket.on('message', (msg) => {
  addMessageToChat(msg);

  if (document.hidden) {
    unreadCount++;
    document.title = `(${unreadCount}) New message!`;
  }
});

// ---- RECEIVE IMAGE ----
socket.on('image', (msg) => {
  addImageToChat(msg);

  if (document.hidden) {
    unreadCount++;
    document.title = `(${unreadCount}) New message!`;
  }
});

// ---- SYSTEM MESSAGES ----
socket.on('system', (text) => {
  const div = document.createElement('div');
  div.classList.add('system-message');
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// ---- USERS LIST ----
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

// ---- MESSAGE HISTORY ----
socket.on('message-history', (messages) => {
  messages.forEach(msg => {
    if (msg.type === 'image') addImageToChat(msg);
    else addMessageToChat(msg);
  });
});

// ---- ADD MESSAGE ----
function addMessageToChat(msg) {
  const div = document.createElement('div');
  if (msg.username === myUsername) div.classList.add('my-message');

  const time = formatTime(msg.time);
  div.textContent = `[${time}] ${msg.username}: ${msg.text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ---- ADD IMAGE MESSAGE ----
function addImageToChat(msg) {
  const div = document.createElement('div');
  if (msg.username === myUsername) div.classList.add('my-message');

  const time = formatTime(msg.time);
  div.innerHTML = `<strong>[${time}] ${msg.username}:</strong><br><img src="${msg.data}" style="max-width:200px; max-height:200px;">`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ---- FORMAT TIME ----
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const h = String(date.getHours()).padStart(2,"0");
  const m = String(date.getMinutes()).padStart(2,"0");
  return `${h}:${m}`;
}
