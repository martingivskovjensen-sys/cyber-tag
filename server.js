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

    socket.on('createRoom', () => {
        const code = generateRoomCode();
        rooms[code] = {
            players: {},
            powerups: [],
            tagCooldown: 0,
            powerupTimer: 300 // Spawn every 5s if empty
        };
        joinGameRoom(socket, code);
    });

    socket.on('joinRoom', (code) => {
        code = code.toUpperCase();
        if (rooms[code]) {
            joinGameRoom(socket, code);
        } else {
            socket.emit('errorMsg', 'Room not found!');
        }
    });

    function joinGameRoom(socket, code) {
        socket.join(code);
        socket.roomId = code;

        const room = rooms[code];
        
        // Add player to room
        room.players[socket.id] = {
            x: Math.random() * (ARENA_WIDTH - 100) + 50,
            y: Math.random() * (ARENA_HEIGHT - 100) + 50,
            isIt: Object.keys(room.players).length === 0, // First player is 'It'
            score: 0,
            up: false, down: false, left: false, right: false,
            speedTimer: 0,
            shieldTimer: 0
        };

        socket.emit('roomJoined', { code: code, playerId: socket.id });
    }

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
            if (wasIt && remainingPlayers.length > 0) {
                const randomId = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
                room.players[randomId].isIt = true;
            }
            if (remainingPlayers.length === 0) {
                delete rooms[socket.roomId];
            }
        }
    });
});

// Main Update Loop (60 FPS)
setInterval(() => {
    for (const code in rooms) {
        const room = rooms[code];
        const playerKeys = Object.keys(room.players);
        if (playerKeys.length === 0) continue;

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

        let currentlyIt = null;
        
        // Update players
        for (const id of playerKeys) {
            const p = room.players[id];
            
            // Decement effect timers
            if (p.speedTimer > 0) p.speedTimer--;
            if (p.shieldTimer > 0) p.shieldTimer--;

            const currentSpeed = (p.speedTimer > 0) ? BOOST_SPEED : BASE_SPEED;
            
            if (p.up && p.y > PLAYER_RADIUS) p.y -= currentSpeed;
            if (p.down && p.y < ARENA_HEIGHT - PLAYER_RADIUS) p.y += currentSpeed;
            if (p.left && p.x > PLAYER_RADIUS) p.x -= currentSpeed;
            if (p.right && p.x < ARENA_WIDTH - PLAYER_RADIUS) p.x += currentSpeed;
            
            if (p.isIt) currentlyIt = id;
            else p.score += 1;

            // Check power-up collection
            for (let i = room.powerups.length - 1; i >= 0; i--) {
                const pu = room.powerups[i];
                if (isCollision(p, pu, PLAYER_RADIUS, POWERUP_RADIUS)) {
                    // Apply Effect
                    if (pu.type === 'speed') p.speedTimer = pu.duration;
                    if (pu.type === 'shield') p.shieldTimer = pu.duration;
                    if (pu.type === 'teleport') {
                        p.x = Math.random() * (ARENA_WIDTH - 100) + 50;
                        p.y = Math.random() * (ARENA_HEIGHT - 100) + 50;
                    }
                    room.powerups.splice(i, 1);
                    io.to(code).emit('powerupCollected', { playerId: id, type: pu.type });
                }
            }
        }

        // Tag Logic
        if (currentlyIt && room.tagCooldown <= 0) {
            const itPlayer = room.players[currentlyIt];
            for (const id of playerKeys) {
                if (id === currentlyIt) continue;
                const otherPlayer = room.players[id];
                
                // Only tag if other player doesn't have a shield
                if (otherPlayer.shieldTimer <= 0 && isCollision(itPlayer, otherPlayer, PLAYER_RADIUS, PLAYER_RADIUS)) {
                    itPlayer.isIt = false;
                    otherPlayer.isIt = true;
                    // Reset effects on tag
                    otherPlayer.speedTimer = 0;
                    otherPlayer.shieldTimer = 0;
                    room.tagCooldown = 60;
                    io.to(code).emit('tagEvent', { newIt: id });
                    break;
                }
            }
        }

        io.to(code).emit('gameState', {
            players: room.players,
            powerups: room.powerups
        });
    }
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Cyber Tag Server running at http://localhost:${PORT}`);
});
