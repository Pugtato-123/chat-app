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

    // ===== AVATAR CHANGE INPUT =====
    const avatarContainer = document.createElement("div");
    avatarContainer.style.display = "flex";
    avatarContainer.style.gap = "8px";
    avatarContainer.style.marginLeft = "16px";
    avatarContainer.style.alignItems = "center";

    const avatarInput = document.createElement("input");
    avatarInput.type = "text";
    avatarInput.placeholder = "Avatar URL";
    avatarInput.value = avatar || "";
    avatarInput.style.padding = "4px 6px";

    const avatarBtn = document.createElement("button");
    avatarBtn.textContent = "Change Avatar";
    avatarBtn.style.padding = "4px 8px";
    avatarBtn.style.cursor = "pointer";

    avatarBtn.onclick = () => {
      const url = avatarInput.value.trim();
      if (!url) return alert("Enter avatar URL");

      socket.emit("setAvatar", url);
      avatar = url;
      img.src = url; // top-right image

      // Update past messages
      document.querySelectorAll(".msg").forEach(msgDiv => {
        const strong = msgDiv.querySelector("strong");
        if (strong && strong.textContent.includes(username)) {
          const mImg = msgDiv.querySelector("img");
          if (mImg) mImg.src = url;
        }
      });
    };

    avatarContainer.appendChild(avatarInput);
    avatarContainer.appendChild(avatarBtn);
    header.appendChild(avatarContainer);
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

// ===== RECEIVE MESSAGES =====
socket.on("chatMessage", (data) => {
  appendMessage(data);
});

socket.on("messageHistory", (history) => {
  messages.innerHTML = "";
  history.forEach(data => appendMessage(data));
});

// ===== AVATAR LIVE UPDATE =====
socket.on("avatarChanged", ({ username: u, avatar: newAvatar }) => {
  document.querySelectorAll(".msg").forEach(msgDiv => {
    const strong = msgDiv.querySelector("strong");
    if (strong && strong.textContent.includes(u)) {
      const img = msgDiv.querySelector("img");
      if (img) img.src = newAvatar;
    }
  });
  if (u === username) document.querySelector("header img").src = newAvatar;
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
socket.on("clearChat", () => messages.innerHTML = "");

// ===== KICKED =====
socket.on("kicked", () => {
  alert("You were kicked");
  location.reload();
});

// ===== APPEND MESSAGE HELPER =====
function appendMessage(data) {
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
        <strong style="color:${data.color}">${data.username} ${roleTag}</strong>
        <span class="time">${data.time}</span>
        <div>${data.msg}</div>
      </div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}