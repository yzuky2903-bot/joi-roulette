const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Rooms storage (in-memory - simple for free hosting)
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create or join room
  socket.on('join-room', ({ roomCode, name, gender }) => {
    roomCode = roomCode.toUpperCase().trim();
    
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        users: {},
        chat: [],
        lastSpin: null,
        activeTimer: null
      };
    }

    rooms[roomCode].users[socket.id] = { name, gender };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.userName = name;
    socket.gender = gender;

    // Notify room
    io.to(roomCode).emit('room-update', {
      users: Object.values(rooms[roomCode].users),
      chat: rooms[roomCode].chat
    });

    // Send current state to the new user
    if (rooms[roomCode].lastSpin) {
      socket.emit('spin-result', rooms[roomCode].lastSpin);
    }
    if (rooms[roomCode].activeTimer) {
      socket.emit('timer-sync', rooms[roomCode].activeTimer);
    }
  });

  // Chat message
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
    if (rooms[roomCode].chat.length > 100) {
      rooms[roomCode].chat.shift();
    }

    io.to(roomCode).emit('chat-message', message);
  });

  // Spin the wheel
  socket.on('spin', ({ type }) => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    // Male and Female orders — each with text + duration in seconds (0 = no timer)
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

    const orders = type === 'male' ? maleOrders : femaleOrders;
    const chosen = orders[Math.floor(Math.random() * orders.length)];

    const spinData = {
      type,
      result: chosen.text,
      duration: chosen.duration,
      spunBy: socket.userName,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    rooms[roomCode].lastSpin = spinData;
    rooms[roomCode].activeTimer = null;

    // Emit to everyone in the room (including spinner) so they see the animation
    io.to(roomCode).emit('spin-start', { type, spunBy: socket.userName });
    
    // After animation time, send the result
    setTimeout(() => {
      io.to(roomCode).emit('spin-result', spinData);
      if (chosen.duration > 0) {
        const timerData = {
          duration: chosen.duration,
          startedAt: Date.now(),
          type
        };
        rooms[roomCode].activeTimer = timerData;
        io.to(roomCode).emit('timer-start', timerData);
      }
    }, 4000); // 4 seconds of spinning
  });

  // Cum / Gozou event
  socket.on('cum', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    rooms[roomCode].activeTimer = null;

    io.to(roomCode).emit('cum-event', {
      name: socket.userName,
      gender: socket.gender,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Timer finished (client notifies)
  socket.on('timer-done', () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    rooms[roomCode].activeTimer = null;
    io.to(roomCode).emit('timer-finished');
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      delete rooms[roomCode].users[socket.id];
      
      if (Object.keys(rooms[roomCode].users).length === 0) {
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('room-update', {
          users: Object.values(rooms[roomCode].users),
          chat: rooms[roomCode].chat
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
