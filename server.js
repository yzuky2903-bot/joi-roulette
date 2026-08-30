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
        lastSpin: null
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

    // Male and Female orders
    const maleOrders = [
      "20 estocadas bem lentas",
      "Só a cabeça por 40 segundos",
      "Edge 2 vezes e para completamente",
      "Mão esquerda só, ritmo médio por 30s",
      "Para totalmente por 1 minuto",
      "15 estocadas rápidas e segura no limite",
      "Apenas a ponta dos dedos, bem leve",
      "Estocadas longas e lentas por 45 segundos",
      "Aperta forte a base e segura 20s",
      "Ritmo irregular: 5 rápidas + 5 lentas (3x)",
      "Edge até quase gozar e para 40 segundos",
      "Usa só o polegar e indicador, bem devagar"
    ];

    const femaleOrders = [
      "Circular bem devagar no clitóris por 40s",
      "Dois dedos, vai-e-vem lento por 30s",
      "Edge e segura sem tocar por 25 segundos",
      "Só a ponta dos dedos, pressão leve",
      "Aumenta a velocidade por 20s e para",
      "Pressiona e segura 15 segundos",
      "Movimento de círculos bem lentos",
      "Estimula só o lado esquerdo por 30s",
      "Edge 2 vezes e fica sem tocar 40s",
      "Ritmo bem irregular e provocante",
      "Foca só na sensibilidade máxima, bem leve",
      "Para no meio do prazer por 1 minuto inteiro"
    ];

    const orders = type === 'male' ? maleOrders : femaleOrders;
    const result = orders[Math.floor(Math.random() * orders.length)];

    const spinData = {
      type,
      result,
      spunBy: socket.userName,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    rooms[roomCode].lastSpin = spinData;

    // Emit to everyone in the room (including spinner) so they see the animation
    io.to(roomCode).emit('spin-start', { type, spunBy: socket.userName });
    
    // After animation time, send the result
    setTimeout(() => {
      io.to(roomCode).emit('spin-result', spinData);
    }, 4000); // 4 seconds of spinning
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