const socket = io();

let username = null;
let lastMsg = null;

const messages = document.getElementById("messages");
const input = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");

// ===== ENTER LOGIN =====
usernameInput.addEventListener("keypress", e => {
  if (e.key === "Enter") loginBtn.click();
});
passwordInput.addEventListener("keypress", e => {
  if (e.key === "Enter") loginBtn.click();
});

// ===== LOGIN =====
loginBtn.onclick = () => {
  const u = usernameInput.value.trim();
  const p = passwordInput.value.trim();

  socket.emit("login", { username: u, password: p }, (res) => {
    if (!res.success) return alert("Invalid login");

    username = u;

    document.querySelector(".controls").style.display = "none";

    // settings button
    const header = document.querySelector("header");

    const settingsBtn = document.createElement("button");
    settingsBtn.textContent = "⚙";
    settingsBtn.style.marginLeft = "auto";

    settingsBtn.onclick = () => {
      document.getElementById("settingsPanel").style.display = "block";
    };

    header.appendChild(settingsBtn);

    input.disabled = false;
    sendBtn.disabled = false;
  });
};

// ===== SEND =====
function sendMessage() {
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
  const now = Date.now();

  // GROUP MESSAGE
  if (
    lastMsg &&
    lastMsg.username === data.username &&
    now - lastMsg.time < 120000
  ) {
    lastMsg.text.innerHTML += `<br>${data.msg}`;
    return;
  }

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
        <div class="msg-text">${data.msg}</div>
      </div>
    </div>
  `;

  messages.appendChild(div);

  lastMsg = {
    username: data.username,
    time: now,
    text: div.querySelector(".msg-text")
  };

  messages.scrollTop = messages.scrollHeight;
});

// ===== IMAGE UPLOAD =====
const upload = document.getElementById("upload");
if (upload) {
  upload.onchange = async () => {
    const file = upload.files[0];

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    socket.emit("chatMessage", `<img src="${data.url}" style="max-width:200px;">`);
  };
}

// ===== SETTINGS SAVE =====
function saveSettings() {
  const avatar = document.getElementById("avatarInput").value;
  const color = document.getElementById("colorInput").value;

  socket.emit("setAvatar", avatar);

  socket.emit("chatMessage", `/color ${username} ${color}`);

  document.getElementById("settingsPanel").style.display = "none";
}