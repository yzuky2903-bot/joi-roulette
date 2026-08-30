const socket = io();

let currentName = '';
let currentGender = 'male';
let currentRoom = '';

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
  div.className = `chat-msg ${msg.gender}`;
  if (msg.name === currentName) div.classList.add('own');
  
  div.innerHTML = `
    <div class="meta">
      <span class="name">${msg.name}</span> • ${msg.time}
    </div>
    <div>${msg.text}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Roleta
let isSpinning = false;

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

  // Animação de giro
  const extraSpins = 5 + Math.random() * 3; // 5 a 8 voltas
  const randomDegree = Math.floor(Math.random() * 360);
  const totalRotation = extraSpins * 360 + randomDegree;

  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  
  // Force reflow
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
