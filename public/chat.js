const socket = io();

let username = null;
let isAdmin = false;

const messages = document.getElementById("messages");
const input = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

// ===== LOGIN =====
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

loginBtn.onclick = () => {
  const usernameVal = usernameInput.value.trim();
  const passwordVal = passwordInput.value.trim();

  if (!usernameVal || !passwordVal) {
    alert("Enter username and password");
    return;
  }

  socket.emit("login", { username: usernameVal, password: passwordVal }, (res) => {
    if (!res.success) {
      alert("Invalid login");
      return;
    }

    username = usernameVal;
    isAdmin = res.admin;

    // lock UI
    usernameInput.disabled = true;
    passwordInput.disabled = true;
    loginBtn.disabled = true;
    registerBtn.disabled = true;

    input.disabled = false;
    sendBtn.disabled = false;
  });
};

registerBtn.onclick = () => {
  const usernameVal = usernameInput.value.trim();
  const passwordVal = passwordInput.value.trim();

  if (!usernameVal || !passwordVal) {
    alert("Enter username and password");
    return;
  }

  socket.emit("register", { username: usernameVal, password: passwordVal }, (res) => {
    if (!res.success) {
      alert(res.message || "Failed");
      return;
    }

    alert("Account created. You can now log in.");
  });
};

// ===== SEND =====
function sendMessage() {
  if (!username) return alert("Login first");

  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chatMessage", msg);
  input.value = "";
}

sendBtn.onclick = sendMessage;

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// ===== RECEIVE =====
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
});

// ===== USERS =====
socket.on("userList", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";

  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    list.appendChild(li);
  });

  // update admin panel list
  const adminList = document.getElementById("admin-user-list");
  adminList.innerHTML = "";

  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;

    if (isAdmin) {
      const btn = document.createElement("button");
      btn.textContent = "Kick";
      btn.onclick = () => socket.emit("kickUser", u);
      li.appendChild(btn);
    }

    adminList.appendChild(li);
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

// ===== ADMIN PANEL =====
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
    if (!isAdmin) return alert("Not admin");

    document.getElementById("admin-console").style.display = "block";
  }
});

document.getElementById("clear-chat").onclick = () => {
  socket.emit("clearChat");
};

function register() {
  const username = document.getElementById("nameInput").value.trim();
  const password = prompt("Create password:");

  if (!username || !password) return;

  socket.emit("register", { username, password }, (res) => {
    if (!res.success) {
      alert(res.message);
      return;
    }

    alert("Account created!");
  });
}