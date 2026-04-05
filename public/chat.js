const socket = io();

let username = null;
let isAdmin = false;
let avatar = null;
let role = "user";
let color = "#93c5fd";

const messages = document.getElementById("messages");
const input = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

// ===== LOGIN =====
loginBtn.onclick = () => {
  const u = usernameInput.value.trim();
  const p = passwordInput.value.trim();

  if (!u || !p) return alert("Enter username + password");

  socket.emit("login", { username: u, password: p }, (res) => {
    if (!res.success) return alert("Invalid login");

    username = u;
    isAdmin = res.admin;
    avatar = res.avatar;
    role = res.role;
    color = res.color;

    document.querySelector(".controls").style.display = "none";

    const header = document.querySelector("header");

    const acc = document.createElement("div");
    acc.style.marginLeft = "auto";
    acc.style.display = "flex";
    acc.style.alignItems = "center";
    acc.style.gap = "10px";

    const name = document.createElement("span");
    name.textContent = username;
    name.style.color = color;

    const img = document.createElement("img");
    img.src = avatar || "https://via.placeholder.com/32";
    img.style.width = "32px";
    img.style.height = "32px";
    img.style.borderRadius = "50%";

    acc.appendChild(name);
    acc.appendChild(img);
    header.appendChild(acc);

    input.disabled = false;
    sendBtn.disabled = false;
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

// ===== SEND =====
function sendMessage() {
  if (!username) return;

  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chatMessage", msg);
  input.value = "";
}

sendBtn.onclick = sendMessage;
input.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// ===== RECEIVE =====
socket.on("chatMessage", (data) => {
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
        <strong style="color:${data.color}">
          ${data.username} ${roleTag}
        </strong>
        <span class="time">${data.time}</span>
        <div>${data.msg}</div>
      </div>
    </div>
  `;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// ===== HISTORY =====
socket.on("messageHistory", (history) => {
  messages.innerHTML = "";

  history.forEach(data => {
    const div = document.createElement("div");
    div.classList.add("msg");

    div.innerHTML = `
      <div style="display:flex; gap:10px;">
        <img src="${data.avatar || 'https://via.placeholder.com/32'}"
             style="width:32px;height:32px;border-radius:50%;">
        <div>
          <strong style="color:${data.color}">
            ${data.username}
          </strong>
          <span class="time">${data.time}</span>
          <div>${data.msg}</div>
        </div>
      </div>
    `;

    messages.appendChild(div);
  });
});

// ===== USERS =====
socket.on("userList", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";

  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    list.appendChild(li);
  });
});

// ===== CLEAR =====
socket.on("clearChat", () => {
  messages.innerHTML = "";
});

// ===== KICKED =====
socket.on("kicked", () => {
  alert("You were kicked");
  location.reload();
});

// ===== AVATAR CHANGE =====
const avatarInput = document.getElementById("avatarURLInput");
const avatarBtn = document.getElementById("changeAvatarBtn");

avatarBtn.onclick = () => {
  const url = avatarInput.value.trim();
  if (!url) return alert("Enter a valid URL");

  socket.emit("setAvatar", url);

  // Update top-right avatar immediately
  const topRightImg = document.querySelector("header img");
  if (topRightImg) topRightImg.src = url;

  avatar = url;
};

// Update avatars for everyone in chat when changed
socket.on("avatarChanged", ({ username: u, avatar: url }) => {
  document.querySelectorAll(".msg").forEach(div => {
    const strong = div.querySelector("strong");
    if (strong && strong.textContent.includes(u)) {
      div.querySelector("img").src = url;
    }
  });

  // Update your top-right if it’s you
  if (u === username) {
    const topRightImg = document.querySelector("header img");
    if (topRightImg) topRightImg.src = url;
  }
});