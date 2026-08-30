const socket = io();

let currentName = '';
let currentGender = 'male';
let currentRoom = '';
let isSpinning = false;
let timerInterval = null;
let timerEndTime = 0;
let totalDuration = 0;

// Elementos
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const nameInput = document.getElementById('name-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const roomCodeDisplay = document.getElementById('room-code-display');
const usersList = document.getElementById('users-list');
const wheel = document.getElementById('wheel');
const spinMaleBtn = document.getElementById('spin-male');
const spinFemaleBtn = document.getElementById('spin-female');
const resultBox = document.getElementById('result-box');
const resultType = document.getElementById('result-type');
const resultText = document.getElementById('result-text');
const resultBy = document.getElementById('result-by');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const timerContainer = document.getElementById('timer-container');
const timerDisplay = document.getElementById('timer-display');
const timerBar = document.getElementById('timer-bar');
const cumBtn = document.getElementById('cum-btn');
const cumOverlay = document.getElementById('cum-overlay');
const cumText = document.getElementById('cum-text');

// Entrar na sala
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

// Atualização da sala
socket.on('room-update', (data) => {
  usersList.textContent = data.users.map(u => `${u.name} (${u.gender === 'male' ? '♂' : '♀'})`).join(' • ');
  
  // Carrega chat existente
  if (data.chat && data.chat.length > 0) {
    chatMessages.innerHTML = '';
    data.chat.forEach(msg => addChatMessage(msg));
  }
});

// Chat
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

socket.on('chat-message', (msg) => {
  addChatMessage(msg);
});

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

// Roleta
spinMaleBtn.addEventListener('click', () => {
  if (isSpinning) return;
  socket.emit('spin', { type: 'male' });
});

spinFemaleBtn.addEventListener('click', () => {
  if (isSpinning) return;
  socket.emit('spin', { type: 'female' });
});

socket.on('spin-start', (data) => {
  isSpinning = true;
  spinMaleBtn.disabled = true;
  spinFemaleBtn.disabled = true;
  resultBox.classList.add('hidden');
  stopTimer();
  timerContainer.classList.add('hidden');

  // Animação de giro
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
  spinMaleBtn.disabled = false;
  spinFemaleBtn.disabled = false;

  resultType.textContent = data.type === 'male' ? 'Ordem para ELE ♂' : 'Ordem para ELA ♀';
  resultText.textContent = data.result;
  resultBy.textContent = `Girado por ${data.spunBy} • ${data.time}`;
  resultBox.classList.remove('hidden');
});

// ===== TIMER =====
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startTimer(duration, startedAt) {
  stopTimer();
  totalDuration = duration;
  timerEndTime = (startedAt || Date.now()) + duration * 1000;
  
  timerContainer.classList.remove('hidden');
  timerDisplay.classList.remove('warning', 'danger');
  timerBar.classList.remove('warning', 'danger');
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 100);
}

function updateTimer() {
  const now = Date.now();
  const remaining = Math.max(0, (timerEndTime - now) / 1000);
  const pct = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;
  
  timerDisplay.textContent = formatTime(remaining);
  timerBar.style.width = pct + '%';
  
  if (remaining <= 5 && remaining > 0) {
    timerDisplay.classList.add('danger');
    timerDisplay.classList.remove('warning');
    timerBar.classList.add('danger');
    timerBar.classList.remove('warning');
  } else if (remaining <= 10) {
    timerDisplay.classList.add('warning');
    timerDisplay.classList.remove('danger');
    timerBar.classList.add('warning');
    timerBar.classList.remove('danger');
  } else {
    timerDisplay.classList.remove('warning', 'danger');
    timerBar.classList.remove('warning', 'danger');
  }
  
  if (remaining <= 0) {
    stopTimer();
    timerDisplay.textContent = '00:00';
    timerBar.style.width = '0%';
    socket.emit('timer-done');
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

socket.on('timer-start', (data) => {
  startTimer(data.duration, data.startedAt);
});

socket.on('timer-sync', (data) => {
  if (data && data.duration) {
    startTimer(data.duration, data.startedAt);
  }
});

socket.on('timer-finished', () => {
  stopTimer();
  timerDisplay.textContent = '00:00';
  timerBar.style.width = '0%';
  timerDisplay.classList.add('danger');
});

// ===== GOZOU / CUM =====
cumBtn.addEventListener('click', () => {
  socket.emit('cum');
});

socket.on('cum-event', (data) => {
  stopTimer();
  timerContainer.classList.add('hidden');
  
  // Mensagem no chat
  addChatMessage({
    system: true,
    text: `💦 ${data.name} GOZOU! (${data.time})`,
    time: data.time
  });
  
  // Animação
  playCumAnimation(data.name);
});

function playCumAnimation(name) {
  cumText.textContent = `${name} GOZOU! 💦`;
  cumOverlay.classList.remove('hidden');
  
  // Restart animations by forcing reflow
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
  
  // Hide after animation
  setTimeout(() => {
    cumOverlay.classList.add('hidden');
  }, 2800);
}

// Click on overlay to close early
cumOverlay.addEventListener('click', () => {
  cumOverlay.classList.add('hidden');
});