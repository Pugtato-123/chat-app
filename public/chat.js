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

  // lock name input
  document.getElementById("nameInput").disabled = true;
  document.getElementById("setNameBtn").disabled = true;

  // enable chat
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
    <span class="time">${data.time}</span>
    <div>${data.msg}</div>
  `;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// ===== HISTORY =====
socket.on("messageHistory", (history) => {
  messages.innerHTML = "";

  history.forEach((data) => {
    const div = document.createElement("div");
    div.classList.add("msg");

    div.innerHTML = `
  <strong>${data.username}</strong>
  <span class="time">${data.time}</span>
  <div>${data.msg}</div>
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

// ===== ADMIN SHORTCUT =====
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
    document.getElementById("admin-login").style.display = "block";
  }
});