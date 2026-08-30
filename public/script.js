const socket = io();

let currentName = '';
let currentGender = 'male';
let currentRoom = '';
let isSpinning = false;

// Dual timers state
let maleInterval = null;
let femaleInterval = null;
let maleEndTime = 0;
let femaleEndTime = 0;
let maleTotal = 0;
let femaleTotal = 0;
let maleDone = false;
let femaleDone = false;
let reportedMale = false;
let reportedFemale = false;

// Elements
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const nameInput = document.getElementById('name-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const roomCodeDisplay = document.getElementById('room-code-display');
const usersList = document.getElementById('users-list');
const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spin-btn');
const resultBox = document.getElementById('result-box');
const maleText = document.getElementById('male-text');
const femaleText = document.getElementById('female-text');
const resultBy = document.getElementById('result-by');
const maleTimerEl = document.getElementById('male-timer');
const femaleTimerEl = document.getElementById('female-timer');
const maleBar = document.getElementById('male-bar');
const femaleBar = document.getElementById('female-bar');
const maleStatus = document.getElementById('male-status');
const femaleStatus = document.getElementById('female-status');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const cumBtn = document.getElementById('cum-btn');
const cumOverlay = document.getElementById('cum-overlay');
const cumText = document.getElementById('cum-text');
const autoSpinCheck = document.getElementById('auto-spin-check');

// ===== LOGIN =====
joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const room = roomInput.value.trim().toUpperCase();
  const gender = document.querySelector('input[name="gender"]:checked').value;

  if (!name || !room) {
    alert('Preencha nome e código da sala');
    return;
  }

  currentName = name;
  currentGender = gender;
  currentRoom = room;

  socket.emit('join-room', { roomCode: room, name, gender });

  roomCodeDisplay.textContent = room;
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
});

socket.on('room-update', (data) => {
  usersList.textContent = data.users.map(u => `${u.name} (${u.gender === 'male' ? '♂' : '♀'})`).join(' • ');
  if (typeof data.autoSpin === 'boolean') {
    autoSpinCheck.checked = data.autoSpin;
  }
  if (data.chat && data.chat.length > 0) {
    chatMessages.innerHTML = '';
    data.chat.forEach(msg => addChatMessage(msg));
  }
});

// ===== CHAT =====
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit('chat-message', text);
  chatInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

socket.on('chat-message', (msg) => addChatMessage(msg));

function addChatMessage(msg) {
  const div = document.createElement('div');
  div.className = `chat-msg ${msg.gender || 'system'}`;
  if (msg.name === currentName) div.classList.add('own');
  if (msg.system) div.classList.add('system');

  if (msg.system) {
    div.innerHTML = `<div>${msg.text}</div>`;
  } else {
    div.innerHTML = `
      <div class="meta">
        <span class="name">${msg.name}</span> • ${msg.time}
      </div>
      <div>${msg.text}</div>
    `;
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== SPIN =====
spinBtn.addEventListener('click', () => {
  if (isSpinning) return;
  socket.emit('spin');
});

socket.on('spin-start', (data) => {
  isSpinning = true;
  spinBtn.disabled = true;
  resultBox.classList.add('hidden');
  stopAllTimers();
  maleStatus.textContent = '';
  femaleStatus.textContent = '';

  const extraSpins = 5 + Math.random() * 3;
  const randomDegree = Math.floor(Math.random() * 360);
  const totalRotation = extraSpins * 360 + randomDegree;

  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;

  wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
  wheel.style.transform = `rotate(${totalRotation}deg)`;
});

socket.on('spin-result', (data) => {
  isSpinning = false;
  spinBtn.disabled = false;

  maleText.textContent = data.male.text;
  femaleText.textContent = data.female.text;
  resultBy.textContent = `Girado por ${data.spunBy} • ${data.time}`;
  resultBox.classList.remove('hidden');

  // Reset visual states
  maleTimerEl.classList.remove('warning', 'danger', 'done');
  femaleTimerEl.classList.remove('warning', 'danger', 'done');
  maleBar.classList.remove('warning', 'danger', 'done');
  femaleBar.classList.remove('warning', 'danger', 'done');
  maleStatus.textContent = '';
  femaleStatus.textContent = '';
});

// ===== TIMERS =====
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stopAllTimers() {
  if (maleInterval) { clearInterval(maleInterval); maleInterval = null; }
  if (femaleInterval) { clearInterval(femaleInterval); femaleInterval = null; }
  maleDone = false;
  femaleDone = false;
  reportedMale = false;
  reportedFemale = false;
}

function startDualTimers(data) {
  stopAllTimers();

  maleTotal = data.maleDuration;
  femaleTotal = data.femaleDuration;
  maleEndTime = (data.startedAt || Date.now()) + data.maleDuration * 1000;
  femaleEndTime = (data.startedAt || Date.now()) + data.femaleDuration * 1000;
  maleDone = data.maleDone || false;
  femaleDone = data.femaleDone || false;
  reportedMale = maleDone;
  reportedFemale = femaleDone;

  if (!maleDone) {
    updateMaleTimer();
    maleInterval = setInterval(updateMaleTimer, 100);
  } else {
    markSideDone('male');
  }

  if (!femaleDone) {
    updateFemaleTimer();
    femaleInterval = setInterval(updateFemaleTimer, 100);
  } else {
    markSideDone('female');
  }
}

function updateMaleTimer() {
  const remaining = Math.max(0, (maleEndTime - Date.now()) / 1000);
  const pct = maleTotal > 0 ? (remaining / maleTotal) * 100 : 0;

  maleTimerEl.textContent = formatTime(remaining);
  maleBar.style.width = pct + '%';

  applyTimerStyle(maleTimerEl, maleBar, remaining);

  if (remaining <= 0 && !reportedMale) {
    reportedMale = true;
    markSideDone('male');
    socket.emit('timer-side-done', { side: 'male' });
    if (maleInterval) { clearInterval(maleInterval); maleInterval = null; }
  }
}

function updateFemaleTimer() {
  const remaining = Math.max(0, (femaleEndTime - Date.now()) / 1000);
  const pct = femaleTotal > 0 ? (remaining / femaleTotal) * 100 : 0;

  femaleTimerEl.textContent = formatTime(remaining);
  femaleBar.style.width = pct + '%';

  applyTimerStyle(femaleTimerEl, femaleBar, remaining);

  if (remaining <= 0 && !reportedFemale) {
    reportedFemale = true;
    markSideDone('female');
    socket.emit('timer-side-done', { side: 'female' });
    if (femaleInterval) { clearInterval(femaleInterval); femaleInterval = null; }
  }
}

function applyTimerStyle(displayEl, barEl, remaining) {
  displayEl.classList.remove('warning', 'danger', 'done');
  barEl.classList.remove('warning', 'danger', 'done');

  if (remaining <= 0) {
    displayEl.classList.add('done');
    barEl.classList.add('done');
  } else if (remaining <= 5) {
    displayEl.classList.add('danger');
    barEl.classList.add('danger');
  } else if (remaining <= 10) {
    displayEl.classList.add('warning');
    barEl.classList.add('warning');
  }
}

function markSideDone(side) {
  if (side === 'male') {
    maleDone = true;
    maleTimerEl.textContent = '00:00';
    maleTimerEl.classList.add('done');
    maleBar.classList.add('done');
    maleBar.style.width = '0%';
    maleStatus.textContent = '✓ Terminou';
  } else {
    femaleDone = true;
    femaleTimerEl.textContent = '00:00';
    femaleTimerEl.classList.add('done');
    femaleBar.classList.add('done');
    femaleBar.style.width = '0%';
    femaleStatus.textContent = '✓ Terminou';
  }
}

socket.on('timers-start', (data) => {
  startDualTimers(data);
});

socket.on('timers-sync', (data) => {
  if (data) startDualTimers(data);
});

socket.on('timer-side-update', (data) => {
  if (data.maleDone) markSideDone('male');
  if (data.femaleDone) markSideDone('female');
});

socket.on('both-timers-finished', () => {
  addChatMessage({
    system: true,
    text: '✅ Os dois desafios terminaram!' + (autoSpinCheck.checked ? ' Roleta girando de novo em 2,5s…' : '')
  });
});

// ===== AUTO-SPIN TOGGLE =====
autoSpinCheck.addEventListener('change', () => {
  socket.emit('toggle-auto-spin');
});

socket.on('auto-spin-changed', (data) => {
  autoSpinCheck.checked = data.autoSpin;
  addChatMessage({
    system: true,
    text: data.autoSpin ? '🔄 Auto-giro ATIVADO' : '⏸️ Auto-giro DESATIVADO'
  });
});

// ===== GOZOU =====
cumBtn.addEventListener('click', () => {
  socket.emit('cum');
});

socket.on('cum-event', (data) => {
  stopAllTimers();
  maleStatus.textContent = '';
  femaleStatus.textContent = '';

  addChatMessage({
    system: true,
    text: `💦 ${data.name} GOZOU! (${data.time})`
  });

  playCumAnimation(data.name);
});

function playCumAnimation(name) {
  cumText.textContent = `${name} GOZOU! 💦`;
  cumOverlay.classList.remove('hidden');

  const streams = cumOverlay.querySelectorAll('.stream');
  const drops = cumOverlay.querySelectorAll('.drop');
  streams.forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });
  drops.forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });

  setTimeout(() => {
    cumOverlay.classList.add('hidden');
  }, 2800);
}

cumOverlay.addEventListener('click', () => {
  cumOverlay.classList.add('hidden');
});
