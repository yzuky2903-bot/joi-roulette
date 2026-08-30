const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Rooms storage (in-memory)
const rooms = {};

const maleOrders = [
  { text: "20 estocadas bem lentas", duration: 45 },
  { text: "Só a cabeça por 40 segundos", duration: 40 },
  { text: "Edge 2 vezes e para completamente", duration: 60 },
  { text: "Mão esquerda só, ritmo médio por 30s", duration: 30 },
  { text: "Para totalmente por 1 minuto", duration: 60 },
  { text: "15 estocadas rápidas e segura no limite", duration: 25 },
  { text: "Apenas a ponta dos dedos, bem leve", duration: 35 },
  { text: "Estocadas longas e lentas por 45 segundos", duration: 45 },
  { text: "Aperta forte a base e segura 20s", duration: 20 },
  { text: "Ritmo irregular: 5 rápidas + 5 lentas (3x)", duration: 50 },
  { text: "Edge até quase gozar e para 40 segundos", duration: 40 },
  { text: "Usa só o polegar e indicador, bem devagar", duration: 40 },
  { text: "Masturba bem rápido por 20 segundos e para", duration: 20 },
  { text: "Segura o pau sem se mexer por 1 minuto", duration: 60 },
  { text: "Estocadas bem profundas e lentas por 50s", duration: 50 }
];

const femaleOrders = [
  { text: "Circular bem devagar no clitóris por 40s", duration: 40 },
  { text: "Dois dedos, vai-e-vem lento por 30s", duration: 30 },
  { text: "Edge e segura sem tocar por 25 segundos", duration: 25 },
  { text: "Só a ponta dos dedos, pressão leve", duration: 35 },
  { text: "Aumenta a velocidade por 20s e para", duration: 20 },
  { text: "Pressiona e segura 15 segundos", duration: 15 },
  { text: "Movimento de círculos bem lentos", duration: 45 },
  { text: "Estimula só o lado esquerdo por 30s", duration: 30 },
  { text: "Edge 2 vezes e fica sem tocar 40s", duration: 40 },
  { text: "Ritmo bem irregular e provocante", duration: 40 },
  { text: "Foca só na sensibilidade máxima, bem leve", duration: 35 },
  { text: "Para no meio do prazer por 1 minuto inteiro", duration: 60 },
  { text: "Dedos dentro e polegar no clitóris por 45s", duration: 45 },
  { text: "Estimulação rápida por 25 segundos e para", duration: 25 },
  { text: "Sem tocar nada por 1 minuto inteiro", duration: 60 }
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomCode, name, gender }) => {
    roomCode = roomCode.toUpperCase().trim();
    
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        users: {},
        chat: [],
        lastSpin: null,
        activeTimers: null, // { maleDone, femaleDone, startedAt, maleDuration, femaleDuration }
        autoSpin: true
      };
    }

    rooms[roomCode].users[socket.id] = { name, gender };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.userName = name;
    socket.gender = gender;

    io.to(roomCode).emit('room-update', {
      users: Object.values(rooms[roomCode].users),
      chat: rooms[roomCode].chat,
      autoSpin: rooms[roomCode].autoSpin
    });

    if (rooms[roomCode].lastSpin) {
      socket.emit('spin-result', rooms[roomCode].lastSpin);
    }
    if (rooms[roomCode].activeTimers) {
      socket.emit('timers-sync', rooms[roomCode].activeTimers);
    }
  });

  socket.on('chat-message', (msg) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const message = {
      name: socket.userName,
      gender: socket.gender,
      text: msg,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    rooms[roomCode].chat.push(message);
    if (rooms[roomCode].chat.length > 100) rooms[roomCode].chat.shift();

    io.to(roomCode).emit('chat-message', message);
  });

  // Spin for BOTH at once
  socket.on('spin', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    // Prevent double spin while already spinning / timers active
    if (rooms[roomCode]._spinning) return;
    rooms[roomCode]._spinning = true;

    const male = pickRandom(maleOrders);
    const female = pickRandom(femaleOrders);

    const spinData = {
      male: { text: male.text, duration: male.duration },
      female: { text: female.text, duration: female.duration },
      spunBy: socket.userName,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    rooms[roomCode].lastSpin = spinData;
    rooms[roomCode].activeTimers = null;

    io.to(roomCode).emit('spin-start', { spunBy: socket.userName });

    setTimeout(() => {
      rooms[roomCode]._spinning = false;

      const timerData = {
        maleDuration: male.duration,
        femaleDuration: female.duration,
        maleDone: false,
        femaleDone: false,
        startedAt: Date.now()
      };
      rooms[roomCode].activeTimers = timerData;

      io.to(roomCode).emit('spin-result', spinData);
      io.to(roomCode).emit('timers-start', timerData);
    }, 4000);
  });

  // Client tells server one side finished its timer
  socket.on('timer-side-done', ({ side }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode] || !rooms[roomCode].activeTimers) return;

    const t = rooms[roomCode].activeTimers;
    if (side === 'male') t.maleDone = true;
    if (side === 'female') t.femaleDone = true;

    io.to(roomCode).emit('timer-side-update', { side, maleDone: t.maleDone, femaleDone: t.femaleDone });

    // Both finished → auto spin if enabled
    if (t.maleDone && t.femaleDone) {
      rooms[roomCode].activeTimers = null;
      io.to(roomCode).emit('both-timers-finished');

      if (rooms[roomCode].autoSpin) {
        // Small delay then auto-spin (triggered by first client that reports, but guarded)
        if (!rooms[roomCode]._autoSpinScheduled) {
          rooms[roomCode]._autoSpinScheduled = true;
          setTimeout(() => {
            rooms[roomCode]._autoSpinScheduled = false;
            // Simulate a spin from the server itself
            if (rooms[roomCode] && rooms[roomCode].autoSpin && !rooms[roomCode]._spinning) {
              // Find any socket still in the room to "own" the spin, or just emit directly
              const male = pickRandom(maleOrders);
              const female = pickRandom(femaleOrders);

              const spinData = {
                male: { text: male.text, duration: male.duration },
                female: { text: female.text, duration: female.duration },
                spunBy: 'Roleta Automática',
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              };

              rooms[roomCode].lastSpin = spinData;
              rooms[roomCode]._spinning = true;

              io.to(roomCode).emit('spin-start', { spunBy: 'Roleta Automática' });

              setTimeout(() => {
                rooms[roomCode]._spinning = false;
                const timerData = {
                  maleDuration: male.duration,
                  femaleDuration: female.duration,
                  maleDone: false,
                  femaleDone: false,
                  startedAt: Date.now()
                };
                rooms[roomCode].activeTimers = timerData;
                io.to(roomCode).emit('spin-result', spinData);
                io.to(roomCode).emit('timers-start', timerData);
              }, 4000);
            }
          }, 2500); // 2.5s pause after both finish before auto re-spin
        }
      }
    }
  });

  // Toggle auto-spin
  socket.on('toggle-auto-spin', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    rooms[roomCode].autoSpin = !rooms[roomCode].autoSpin;
    io.to(roomCode).emit('auto-spin-changed', { autoSpin: rooms[roomCode].autoSpin });
  });

  // Cum
  socket.on('cum', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    rooms[roomCode].activeTimers = null;
    rooms[roomCode]._autoSpinScheduled = false;

    io.to(roomCode).emit('cum-event', {
      name: socket.userName,
      gender: socket.gender,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      delete rooms[roomCode].users[socket.id];
      if (Object.keys(rooms[roomCode].users).length === 0) {
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('room-update', {
          users: Object.values(rooms[roomCode].users),
          chat: rooms[roomCode].chat,
          autoSpin: rooms[roomCode].autoSpin
        });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
