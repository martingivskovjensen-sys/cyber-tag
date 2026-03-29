const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Store game state by room code
const rooms = {};

// Game Constants
const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
const PLAYER_RADIUS = 15;
const POWERUP_RADIUS = 12;
const BASE_SPEED = 5;
const BOOST_SPEED = 8.5;

// Power-up Types
const POWERUP_TYPES = [
    { type: 'speed', color: '#ffff00', duration: 300 }, // 5s
    { type: 'shield', color: '#00ffff', duration: 240 }, // 4s
    { type: 'teleport', color: '#ff00ff', duration: 0 }  // Instant
];

// Generate a random 4-letter room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms[code]); // ensure uniqueness
    return code;
}

// Distance between two points
function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isCollision(p1, p2, r1, r2) {
    return getDistance(p1, p2) < (r1 + r2);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (data) => {
        const username = data.username || 'Player';
        const code = generateRoomCode();
        rooms[code] = {
            players: {},
            powerups: [],
            tagCooldown: 0,
            powerupTimer: 300,
            hasGameStarted: false,
            hostId: socket.id
        };
        joinGameRoom(socket, code, username);
    });

    socket.on('joinRoom', (data) => {
        const code = (data.code || '').toUpperCase();
        const username = data.username || 'Player';
        if (rooms[code]) {
            joinGameRoom(socket, code, username);
        } else {
            socket.emit('errorMsg', 'Room not found!');
        }
    });

    function joinGameRoom(socket, code, username) {
        socket.join(code);
        socket.roomId = code;

        const room = rooms[code];
        
        // Add player to room
        room.players[socket.id] = {
            username: username,
            x: Math.random() * (ARENA_WIDTH - 100) + 50,
            y: Math.random() * (ARENA_HEIGHT - 100) + 50,
            isIt: Object.keys(room.players).length === 0, // First player is 'It'
            score: 0,
            up: false, down: false, left: false, right: false,
            speedTimer: 0,
            shieldTimer: 0
        };

        socket.emit('roomJoined', { 
            code: code, 
            playerId: socket.id,
            isHost: room.hostId === socket.id
        });
    }

    socket.on('startGame', (data) => {
        const room = rooms[socket.roomId];
        const botCount = parseInt(data.botCount) || 0;
        const playerCount = Object.keys(room.players).length;

        if (room && room.hostId === socket.id) {
            if (playerCount + botCount < 2) {
                socket.emit('errorMsg', 'Need at least 2 entities (players + bots) to start!');
                return;
            }

            room.hasGameStarted = true;
            room.bots = {};
            
            // Spawn Bots
            for (let i = 0; i < botCount; i++) {
                const botId = 'bot_' + Math.random().toString(36).substr(2, 5);
                room.bots[botId] = {
                    username: 'Bot ' + (i + 1),
                    x: Math.random() * (ARENA_WIDTH - 100) + 50,
                    y: Math.random() * (ARENA_HEIGHT - 100) + 50,
                    isIt: false, // Players usually start as 'It' if first, bots join later
                    score: 0,
                    speedTimer: 0,
                    shieldTimer: 0,
                    targetX: Math.random() * ARENA_WIDTH,
                    targetY: Math.random() * ARENA_HEIGHT,
                    changeDirTimer: 0
                };
            }

            io.to(socket.roomId).emit('gameStarted');
        }
    });

    socket.on('input', (data) => {
        const room = rooms[socket.roomId];
        if (!room) return;
        const player = room.players[socket.id];
        if (!player) return;
        player.up = data.up;
        player.down = data.down;
        player.left = data.left;
        player.right = data.right;
    });

    socket.on('disconnect', () => {
        const room = rooms[socket.roomId];
        if (room) {
            const wasIt = room.players[socket.id]?.isIt;
            delete room.players[socket.id];
            const remainingPlayers = Object.keys(room.players);
            const remainingBots = Object.keys(room.bots || {});
            
            if (wasIt) {
                if (remainingPlayers.length > 0) {
                    const randomId = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
                    room.players[randomId].isIt = true;
                } else if (remainingBots.length > 0) {
                    const randomId = remainingBots[Math.floor(Math.random() * remainingBots.length)];
                    room.bots[randomId].isIt = true;
                }
            }
            
            if (remainingPlayers.length === 0) {
                delete rooms[socket.roomId];
            }
        }
    });
});

// Bot AI Logic
function updateBots(room) {
    if (!room.hasGameStarted || !room.bots) return;

    const botKeys = Object.keys(room.bots);
    const playerKeys = Object.keys(room.players);
    const allEntities = [
        ...playerKeys.map(id => ({ id, ...room.players[id], isBot: false })),
        ...botKeys.map(id => ({ id, ...room.bots[id], isBot: true }))
    ];

    botKeys.forEach(botId => {
        const bot = room.bots[botId];
        let dx = 0;
        let dy = 0;

        if (bot.isIt) {
            // Chase nearest non-it entity
            let nearest = null;
            let minDist = Infinity;
            allEntities.forEach(e => {
                if (e.id === botId || e.isIt) return;
                const dist = getDistance(bot, e);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = e;
                }
            });

            if (nearest) {
                dx = nearest.x - bot.x;
                dy = nearest.y - bot.y;
            }
        } else {
            // Run away from 'It' if close
            const itEntity = allEntities.find(e => e.isIt);
            if (itEntity) {
                const dist = getDistance(bot, itEntity);
                if (dist < 150) {
                    dx = bot.x - itEntity.x;
                    dy = bot.y - itEntity.y;
                } else {
                    // Wander randomly
                    if (bot.changeDirTimer <= 0) {
                        bot.targetX = Math.random() * ARENA_WIDTH;
                        bot.targetY = Math.random() * ARENA_HEIGHT;
                        bot.changeDirTimer = 60 + Math.random() * 120;
                    }
                    bot.changeDirTimer--;
                    dx = bot.targetX - bot.x;
                    dy = bot.targetY - bot.y;
                }
            }
        }

        // Normalize and move
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
            const currentSpeed = (bot.speedTimer > 0) ? BOOST_SPEED : BASE_SPEED;
            bot.x += (dx / dist) * currentSpeed;
            bot.y += (dy / dist) * currentSpeed;
        }

        // Constrain to arena
        bot.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, bot.x));
        bot.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, bot.y));
        
        // Decement effect timers
        if (bot.speedTimer > 0) bot.speedTimer--;
        if (bot.shieldTimer > 0) bot.shieldTimer--;
        if (!bot.isIt) bot.score++;

        // Power-up collection for bots
        room.powerups.forEach((pu, index) => {
            if (isCollision(bot, pu, PLAYER_RADIUS, POWERUP_RADIUS)) {
                if (pu.type === 'speed') bot.speedTimer = pu.duration;
                if (pu.type === 'shield') bot.shieldTimer = pu.duration;
                if (pu.type === 'teleport') {
                    bot.x = Math.random() * (ARENA_WIDTH - 100) + 50;
                    bot.y = Math.random() * (ARENA_HEIGHT - 100) + 50;
                }
                room.powerups.splice(index, 1);
            }
        });
    });
}

// Main Update Loop (60 FPS)
setInterval(() => {
    for (const code in rooms) {
        const room = rooms[code];
        const playerKeys = Object.keys(room.players);
        const botKeys = Object.keys(room.bots || {});
        if (playerKeys.length === 0) continue;

        updateBots(room);

        // Spawn power-ups
        room.powerupTimer--;
        if (room.powerupTimer <= 0) {
            if (room.powerups.length < 3) {
                const config = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                room.powerups.push({
                    x: Math.random() * (ARENA_WIDTH - 40) + 20,
                    y: Math.random() * (ARENA_HEIGHT - 40) + 20,
                    ...config
                });
            }
            room.powerupTimer = 400 + Math.random() * 400; // Reset timer 7-13s
        }

        if (room.tagCooldown > 0) room.tagCooldown--;

        const allEntities = [
            ...playerKeys.map(id => ({ id, data: room.players[id], isBot: false })),
            ...botKeys.map(id => ({ id, data: room.bots[id], isBot: true }))
        ];

        let currentlyIt = allEntities.find(e => e.data.isIt);
        
        // Update players (movement and scores)
        playerKeys.forEach(id => {
            const p = room.players[id];
            if (p.speedTimer > 0) p.speedTimer--;
            if (p.shieldTimer > 0) p.shieldTimer--;
            const currentSpeed = (p.speedTimer > 0) ? BOOST_SPEED : BASE_SPEED;
            if (p.up && p.y > PLAYER_RADIUS) p.y -= currentSpeed;
            if (p.down && p.y < ARENA_HEIGHT - PLAYER_RADIUS) p.y += currentSpeed;
            if (p.left && p.x > PLAYER_RADIUS) p.x -= currentSpeed;
            if (p.right && p.x < ARENA_WIDTH - PLAYER_RADIUS) p.x += currentSpeed;
            if (!p.isIt) p.score++;

            // Power-up collection
            room.powerups.forEach((pu, index) => {
                if (isCollision(p, pu, PLAYER_RADIUS, POWERUP_RADIUS)) {
                    if (pu.type === 'speed') p.speedTimer = pu.duration;
                    if (pu.type === 'shield') p.shieldTimer = pu.duration;
                    if (pu.type === 'teleport') {
                        p.x = Math.random() * (ARENA_WIDTH - 100) + 50;
                        p.y = Math.random() * (ARENA_HEIGHT - 100) + 50;
                    }
                    room.powerups.splice(index, 1);
                    io.to(code).emit('powerupCollected', { playerId: id, type: pu.type });
                }
            });
        });

        // Tag Logic
        if (room.hasGameStarted && currentlyIt && room.tagCooldown <= 0) {
            const itData = currentlyIt.data;
            allEntities.forEach(target => {
                if (target.id === currentlyIt.id) return;
                const targetData = target.data;
                
                if (targetData.shieldTimer <= 0 && isCollision(itData, targetData, PLAYER_RADIUS, PLAYER_RADIUS)) {
                    itData.isIt = false;
                    targetData.isIt = true;
                    targetData.speedTimer = 0;
                    targetData.shieldTimer = 0;
                    room.tagCooldown = 60;
                    io.to(code).emit('tagEvent', { newIt: target.id });
                }
            });
        }

        io.to(code).emit('gameState', {
            players: room.players,
            bots: room.bots,
            powerups: room.powerups,
            hasGameStarted: room.hasGameStarted,
            hostId: room.hostId
        });
    }
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Cyber Tag Server running at http://localhost:${PORT}`);
});

