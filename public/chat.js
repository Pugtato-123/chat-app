const socket = io();

let username = null;

const messages = document.getElementById("messages");
const input = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

// ===== SET USERNAME =====
document.getElementById("setNameBtn").onclick = () => {
  const name = document.getElementById("nameInput").value.trim();

  if (!name) {
    alert("Enter a name first");
    return;
  }

  username = name;
  socket.emit("join", username);

  // Lock name input
  document.getElementById("nameInput").disabled = true;
  document.getElementById("setNameBtn").disabled = true;

  // Enable chat
  input.disabled = false;
  sendBtn.disabled = false;
};

// ===== SEND MESSAGE =====
function sendMessage() {
  if (!username) {
    alert("Set your name first");
    return;
  }

  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chatMessage", msg);
  input.value = "";
}

sendBtn.onclick = sendMessage;

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// ===== RECEIVE MESSAGE =====
socket.on("chatMessage", (data) => {
  const div = document.createElement("div");
  div.classList.add("msg");

  div.innerHTML = `
    <strong>${data.username}</strong>
    <span class="time">${data.time}</span><br>
    ${data.msg}
  `;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

socket.on("chatMessage", (msg) => {
    const username = users[socket.id];

    if (!username) return; // prevents undefined

    const messageData = {
        username: username,
        msg: msg,
        time: new Date().toLocaleTimeString()
    };

    messageHistory.push(messageData);
    if (messageHistory.length > 10) messageHistory.shift();

    io.emit("chatMessage", messageData);
});

// ===== HISTORY =====
socket.on("messageHistory", (history) => {
  messages.innerHTML = "";

  history.forEach((data) => {
    const div = document.createElement("div");
    div.classList.add("msg");

    div.innerHTML = `
      <strong>${data.username}</strong>
      <span class="time">${data.time}</span><br>
      ${data.msg}
    `;

    messages.appendChild(div);
  });

  messages.scrollTop = messages.scrollHeight;
});

// ===== USER LIST =====
socket.on("userList", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";

  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    list.appendChild(li);
  });
});

// ===== CLEAR CHAT =====
socket.on("clearChat", () => {
  messages.innerHTML = "";
});

// ===== KICKED =====
socket.on("kicked", () => {
  alert("You were kicked");
  location.reload();
});

// ===== ADMIN PANEL SHORTCUT =====
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
    document.getElementById("admin-login").style.display = "block";
  }
});