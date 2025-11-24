const socket = io();
let username = "";

// ===== SET USERNAME =====
document.getElementById("setNameBtn").onclick = () => {
  username = document.getElementById("nameInput").value.trim();
  if (!username) return;
  socket.emit("setName", username);
};

document.getElementById("nameInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("setNameBtn").click();
});

// ===== SEND MESSAGE =====
document.getElementById("sendBtn").onclick = () => {
  const msg = document.getElementById("msgInput").value.trim();
  if (!msg) return;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  socket.emit("chatMessage", { user: username, message: msg, time });
  document.getElementById("msgInput").value = "";
};

document.getElementById("msgInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") document.getElementById("sendBtn").click();
});

// ===== DISPLAY MESSAGE =====
function appendMessage(data) {
  const div = document.createElement("div");
  div.textContent = `[${data.time}] ${data.user}: ${data.message}`;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop =
    document.getElementById("messages").scrollHeight;
}

socket.on("chatMessage", appendMessage);
socket.on("messageHistory", (list) => {
  document.getElementById("messages").innerHTML = "";
  list.forEach(appendMessage);
});

// ===== USER LIST =====
socket.on("userList", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.name;
    list.appendChild(li);
  });
});

// ===== KICKED =====
socket.on("kicked", () => {
  alert("You were kicked by the admin.");
  socket.disconnect();
});

// ===== CHAT CLEARED =====
socket.on("chatCleared", () => {
  document.getElementById("messages").innerHTML = "";
});

// ===== SECRET ADMIN ACCESS (CTRL+SHIFT+A) =====
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "A") {
    document.getElementById("admin-login").style.display = "block";
  }
});

// ===== ADMIN LOGIN =====
document.getElementById("admin-login-btn").onclick = () => {
  const pass = document.getElementById("admin-pass").value;
  socket.emit("adminLogin", pass);
};

socket.on("adminAuthorized", (success) => {
  if (success) {
    document.getElementById("admin-login").style.display = "none";
    document.getElementById("admin-console").style.display = "block";
  } else {
    alert("Wrong password.");
  }
});

// ===== ADMIN USER LIST =====
socket.on("adminUserList", (users) => {
  const list = document.getElementById("admin-user-list");
  list.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.name;
    li.onclick = () => socket.emit("kickUser", u.name);
    list.appendChild(li);
  });
});

// ===== CLEAR CHAT BUTTON =====
document.getElementById("clear-chat").onclick = () => {
  socket.emit("clearChat");
};
