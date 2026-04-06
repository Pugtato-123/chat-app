const socket = io();

let username = null;
let lastMsg = null;

const messages = document.getElementById("messages");
const input = document.getElementById("msgInput");

const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const uploadBtn = document.getElementById("uploadBtn");
const uploadInput = document.getElementById("upload");

// ===== SAFE HTML =====
function safeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== LOGIN =====
loginBtn.onclick = () => {
  const u = usernameInput.value.trim();
  const p = passwordInput.value.trim();
  if (!u || !p) return alert("Enter username + password");

  socket.emit("login", { username: u, password: p }, (res) => {
    if (!res.success) return alert("Invalid login");

    username = u;

    document.querySelector(".controls").style.display = "none";

    document.body.className = "";
    document.body.classList.add("font-" + (res.font || "default"));
    document.body.classList.add("theme-" + (res.theme || "macchiato"));

    // ACCOUNT DISPLAY
    const header = document.querySelector("header");
    const acc = document.createElement("div");
    acc.classList.add("account");

    const name = document.createElement("span");
    name.textContent = username;
    name.style.color = res.color;

    const img = document.createElement("img");
    img.src = res.avatar || "https://via.placeholder.com/32";

    const settingsBtn = document.createElement("button");
    settingsBtn.textContent = "⚙";
    settingsBtn.classList.add("settings-btn");
    settingsBtn.onclick = () => {
      document.getElementById("settingsPanel").classList.toggle("open");
    };

    acc.appendChild(name);
    acc.appendChild(img);
    acc.appendChild(settingsBtn);
    header.appendChild(acc);

    input.disabled = false;
    input.focus();
  });
};

// ===== REGISTER =====
registerBtn.onclick = () => {
  const u = usernameInput.value.trim();
  const p = passwordInput.value.trim();
  if (!u || !p) return alert("Enter username + password");

  socket.emit("register", { username: u, password: p }, (res) => {
    if (!res.success) return alert(res.message);
    alert("Account created");
  });
};

// ===== SEND MESSAGE =====
function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit("chatMessage", msg);
  input.value = "";
}

input.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });
usernameInput.addEventListener("keypress", e => { if (e.key === "Enter") loginBtn.click(); });
passwordInput.addEventListener("keypress", e => { if (e.key === "Enter") loginBtn.click(); });

// ===== RENDER MESSAGE =====
function renderMessage(data) {
  const now = Date.now();

  if (
    lastMsg &&
    lastMsg.username === data.username &&
    now - lastMsg.time < 120000
  ) {
    const line = document.createElement("div");
    line.innerHTML = safeHTML(data.msg);
    lastMsg.text.appendChild(line);
  } else {
    const roleTag =
      data.role === "admin"
        ? "<span style='color:red;font-size:12px'>[ADMIN]</span>"
        : data.role === "mod"
        ? "<span style='color:lime;font-size:12px'>[MOD]</span>"
        : "";

    const div = document.createElement("div");
    div.classList.add("msg");

    div.innerHTML = `
      <div style="display:flex; gap:10px;">
        <img src="${data.avatar || 'https://via.placeholder.com/32'}"
             style="width:32px;height:32px;border-radius:50%;">
        <div>
          <div class="msg-header">
            <strong style="color:${data.color}">
              ${data.username} ${roleTag}
            </strong>
            <span class="time">${new Date(data.time).toLocaleTimeString()}</span>
          </div>
          <div class="msg-text"></div>
        </div>
      </div>
    `;

    const textDiv = div.querySelector(".msg-text");
    const line = document.createElement("div");
    line.innerHTML = safeHTML(data.msg);
    textDiv.appendChild(line);

    messages.appendChild(div);

    lastMsg = { username: data.username, time: now, text: textDiv };
  }

  if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 50) {
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }
}

// ===== MESSAGE HISTORY =====
socket.on("messageHistory", (history) => {
  messages.innerHTML = "";
  lastMsg = null;

  history.forEach(data => {
    renderMessage(data);
  });
});

// ===== RECEIVE MESSAGE =====
socket.on("chatMessage", (data) => {
  renderMessage(data);
});

// ===== USER LIST =====
socket.on("userList", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";

  users.forEach(u => {
    const li = document.createElement("li");

    const img = document.createElement("img");
    img.src = u.avatar || "https://i.pinimg.com/236x/7e/4a/a3/7e4aa3f27b0a8068c4a1258a1c061557.jpg";
    img.classList.add("user-pfp");

    const name = document.createElement("span");
    name.textContent = u.username;

    li.appendChild(img);
    li.appendChild(name);

    list.appendChild(li);
  });
});

// ===== IMAGE UPLOAD =====
uploadBtn.onclick = () => uploadInput.click();

uploadInput.onchange = async () => {
  const file = uploadInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  uploadBtn.textContent = "...";

  try {
    const res = await fetch("/upload", { method: "POST", body: formData });
    const data = await res.json();
    socket.emit("chatMessage", `<img src="${data.url}" style="max-width:200px;border-radius:6px;">`);
  } catch {
    alert("Upload failed");
  }

  uploadBtn.textContent = "📎";
  uploadInput.value = "";
};

// ===== SETTINGS SAVE =====
function saveSettings() {
  const avatar = document.getElementById("avatarInput").value;
  const color = document.getElementById("colorInput").value;
  const font = document.getElementById("fontSelect").value;
  const theme = document.getElementById("themeSelect").value;

  if (avatar) socket.emit("setAvatar", avatar);
  if (color) socket.emit("setColor", color);
  if (font) socket.emit("setFont", font);
  if (theme) socket.emit("setTheme", theme);

  document.body.className = "";
  document.body.classList.add("font-" + font);
  document.body.classList.add("theme-" + theme);

  document.getElementById("settingsPanel").classList.remove("open");
}