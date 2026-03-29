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

// Multiple Map Layouts (20 Designs)
const MAP_LAYOUTS = [
    // 1: The Standard
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 150, y: 460, w: 200, h: 20 }, { x: 450, y: 460, w: 200, h: 20 }, { x: 300, y: 340, w: 200, h: 20 }, { x: 50, y: 220, w: 180, h: 20 }, { x: 570, y: 220, w: 180, h: 20 }],
    // 2: Vertical Towers
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 200, y: 500, w: 100, h: 20 }, { x: 500, y: 500, w: 100, h: 20 }, { x: 200, y: 400, w: 100, h: 20 }, { x: 500, y: 400, w: 100, h: 20 }, { x: 350, y: 280, w: 100, h: 20 }, { x: 100, y: 180, w: 100, h: 20 }, { x: 600, y: 180, w: 100, h: 20 }],
    // 3: The Wide Bridge
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 100, y: 450, w: 600, h: 20 }, { x: 50, y: 320, w: 200, h: 20 }, { x: 550, y: 320, w: 200, h: 20 }, { x: 250, y: 200, w: 300, h: 20 }],
    // 4: Scattered Fragments
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 50, y: 480, w: 120, h: 20 }, { x: 250, y: 480, w: 120, h: 20 }, { x: 450, y: 480, w: 120, h: 20 }, { x: 650, y: 480, w: 120, h: 20 }, { x: 150, y: 360, w: 120, h: 20 }, { x: 350, y: 360, w: 120, h: 20 }, { x: 550, y: 360, w: 120, h: 20 }, { x: 250, y: 240, w: 120, h: 20 }, { x: 450, y: 240, w: 120, h: 20 }],
    // 5: Double Deck
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 0, y: 440, w: 300, h: 20 }, { x: 500, y: 440, w: 300, h: 20 }, { x: 200, y: 300, w: 400, h: 20 }, { x: 0, y: 160, w: 300, h: 20 }, { x: 500, y: 160, w: 300, h: 20 }],
    // 6: Central Core
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 300, y: 480, w: 200, h: 20 }, { x: 100, y: 380, w: 150, h: 20 }, { x: 550, y: 380, w: 150, h: 20 }, { x: 300, y: 280, w: 200, h: 20 }, { x: 100, y: 180, w: 150, h: 20 }, { x: 550, y: 180, w: 150, h: 20 }],
    // 7: Zig Zag
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 50, y: 500, w: 200, h: 20 }, { x: 550, y: 500, w: 200, h: 20 }, { x: 300, y: 420, w: 200, h: 20 }, { x: 50, y: 340, w: 200, h: 20 }, { x: 550, y: 340, w: 200, h: 20 }, { x: 300, y: 260, w: 200, h: 20 }, { x: 50, y: 180, w: 200, h: 20 }, { x: 550, y: 180, w: 200, h: 20 }],
    // 8: The Hanger
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 100, y: 440, w: 100, h: 40 }, { x: 600, y: 440, w: 100, h: 40 }, { x: 250, y: 340, w: 300, h: 20 }, { x: 50, y: 220, w: 150, h: 20 }, { x: 600, y: 220, w: 150, h: 20 }],
    // 9: The Cross
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 300, y: 450, w: 200, h: 20 }, { x: 50, y: 350, w: 200, h: 20 }, { x: 550, y: 350, w: 200, h: 20 }, { x: 300, y: 250, w: 200, h: 20 }, { x: 100, y: 150, w: 600, h: 20 }],
    // 10: Triple Peaks
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 50, y: 460, w: 150, h: 20 }, { x: 325, y: 420, w: 150, h: 20 }, { x: 600, y: 460, w: 150, h: 20 }, { x: 100, y: 320, w: 100, h: 20 }, { x: 600, y: 320, w: 100, h: 20 }, { x: 350, y: 220, w: 100, h: 20 }],
    // 11: Floating Islands
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 100, y: 480, w: 80, h: 20 }, { x: 250, y: 410, w: 80, h: 20 }, { x: 400, y: 480, w: 80, h: 20 }, { x: 550, y: 410, w: 80, h: 20 }, { x: 700, y: 480, w: 80, h: 20 }, { x: 50, y: 300, w: 80, h: 20 }, { x: 200, y: 220, w: 80, h: 20 }, { x: 350, y: 300, w: 80, h: 20 }, { x: 500, y: 220, w: 80, h: 20 }, { x: 650, y: 300, w: 80, h: 20 }],
    // 12: Big Step
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 0, y: 480, w: 200, h: 100 }, { x: 600, y: 480, w: 200, h: 100 }, { x: 250, y: 380, w: 300, h: 20 }, { x: 100, y: 260, w: 150, h: 20 }, { x: 550, y: 260, w: 150, h: 20 }, { x: 300, y: 140, w: 200, h: 20 }],
    // 13: Neon Corridor
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 0, y: 400, w: 250, h: 20 }, { x: 550, y: 400, w: 250, h: 20 }, { x: 100, y: 250, w: 600, h: 20 }, { x: 0, y: 150, w: 200, h: 20 }, { x: 600, y: 150, w: 200, h: 20 }],
    // 14: Midair Split
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 200, y: 480, w: 400, h: 20 }, { x: 50, y: 360, w: 300, h: 20 }, { x: 450, y: 360, w: 300, h: 20 }, { x: 300, y: 240, w: 200, h: 20 }, { x: 50, y: 120, w: 200, h: 20 }, { x: 550, y: 120, w: 200, h: 20 }],
    // 15: Bounce House
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 100, y: 500, w: 60, h: 20 }, { x: 640, y: 500, w: 60, h: 20 }, { x: 250, y: 420, w: 60, h: 20 }, { x: 490, y: 420, w: 60, h: 20 }, { x: 370, y: 340, w: 60, h: 20 }, { x: 250, y: 260, w: 60, h: 20 }, { x: 490, y: 260, w: 60, h: 20 }, { x: 100, y: 180, w: 60, h: 20 }, { x: 640, y: 180, w: 60, h: 20 }],
    // 16: The Great Wall
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 390, y: 200, w: 20, h: 380 }, { x: 100, y: 440, w: 200, h: 20 }, { x: 500, y: 440, w: 200, h: 20 }, { x: 50, y: 280, w: 200, h: 20 }, { x: 550, y: 280, w: 200, h: 20 }],
    // 17: Side Climber
    [{ x: 0, y: 580, w: 200, h: 20 }, { x: 600, y: 580, w: 200, h: 20 }, { x: 0, y: 460, w: 150, h: 20 }, { x: 650, y: 460, w: 150, h: 20 }, { x: 0, y: 340, w: 150, h: 20 }, { x: 650, y: 340, w: 150, h: 20 }, { x: 0, y: 220, w: 150, h: 20 }, { x: 650, y: 220, w: 150, h: 20 }, { x: 300, y: 120, w: 200, h: 20 }],
    // 18: Center Stage
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 350, y: 450, w: 100, h: 20 }, { x: 250, y: 350, w: 300, h: 20 }, { x: 150, y: 250, w: 500, h: 20 }, { x: 50, y: 150, w: 700, h: 20 }],
    // 19: Symmetry
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 100, y: 480, w: 150, h: 20 }, { x: 550, y: 480, w: 150, h: 20 }, { x: 250, y: 360, w: 300, h: 20 }, { x: 100, y: 240, w: 150, h: 20 }, { x: 550, y: 240, w: 150, h: 20 }],
    // 20: The Edge
    [{ x: 0, y: 580, w: 800, h: 20 }, { x: 0, y: 460, w: 100, h: 20 }, { x: 700, y: 460, w: 100, h: 20 }, { x: 0, y: 340, w: 100, h: 20 }, { x: 700, y: 340, w: 100, h: 20 }, { x: 0, y: 220, w: 100, h: 20 }, { x: 700, y: 220, w: 100, h: 20 }, { x: 200, y: 120, w: 400, h: 20 }]
];

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
    } while (rooms[code]);
    return code;
}

function getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// AABB Collision for Platformer
function checkPlatformCollision(entity, platforms) {
    let onGround = false;
    platforms.forEach(plat => {
        // Check if entity is falling onto the top of a platform
        const platHeight = plat.h || 20; // Default height if missing
        if (entity.vy >= 0 &&
            entity.oldY + PLAYER_H <= plat.y &&
            entity.y + PLAYER_H >= plat.y &&
            entity.x + PLAYER_W > plat.x &&
            entity.x < plat.x + plat.w) {
            entity.y = plat.y - PLAYER_H;
            entity.vy = 0;
            onGround = true;
        }
    });
    return onGround;
}

io.on('connection', (socket) => {
    socket.on('createRoom', (data) => {
        const username = data.username || 'Player';
        const color = data.color || '#00ffff';
        const code = generateRoomCode();
        // Pick a random map layout
        const randomMap = MAP_LAYOUTS[Math.floor(Math.random() * MAP_LAYOUTS.length)];
        rooms[code] = {
            players: {},
            bots: {},
            platforms: randomMap,
            powerups: [],
            tagCooldown: 0,
            powerupTimer: 300,
            hasGameStarted: false,
            hostId: socket.id
        };
        joinGameRoom(socket, code, username, color);
    });

    socket.on('joinRoom', (data) => {
        const code = (data.code || '').toUpperCase();
        const username = data.username || 'Player';
        const color = data.color || '#00ffff';
        if (rooms[code]) {
            joinGameRoom(socket, code, username, color);
        } else {
            socket.emit('errorMsg', 'Room not found!');
        }
    });

    function joinGameRoom(socket, code, username, color) {
        socket.join(code);
        socket.roomId = code;
        const room = rooms[code];
        room.players[socket.id] = {
            username: username,
            color: color,
            x: 100, y: 100,
            oldY: 100,
            vy: 0,
            isIt: Object.keys(room.players).length === 0,
            score: 0,
            up: false, down: false, left: false, right: false,
            speedTimer: 0,
            shieldTimer: 0,
            jumpsUsed: 0,
            canJump: true
        };
        socket.emit('roomJoined', { 
            code: code, 
            playerId: socket.id,
            isHost: room.hostId === socket.id,
            platforms: room.platforms
        });
    }

    socket.on('startGame', (data) => {
        const room = rooms[socket.roomId];
        const botCount = parseInt(data.botCount) || 0;
        if (room && room.hostId === socket.id) {
            if (Object.keys(room.players).length + botCount < 2) {
                socket.emit('errorMsg', 'Need 2+ entities to start!');
                return;
            }
            // Reset scores for new round
            Object.values(room.players).forEach(p => p.score = 0);
            room.hasGameStarted = true;
            room.bots = {};
            for (let i = 0; i < botCount; i++) {
                const botId = 'bot_' + Math.random().toString(36).substr(2, 5);
                room.bots[botId] = {
                    username: 'Bot ' + (i + 1),
                    color: '#ffffff',
                    x: Math.random() * 600 + 100, y: 100, oldY: 100, vy: 0,
                    isIt: false, score: 0, speedTimer: 0, shieldTimer: 0,
                    jumpsUsed: 0, targetX: 400, jumpCooldown: 0
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
                if (remainingPlayers.length > 0) room.players[remainingPlayers[0]].isIt = true;
                else if (remainingBots.length > 0) room.bots[remainingBots[0]].isIt = true;
            }
            if (remainingPlayers.length === 0) delete rooms[socket.roomId];
        }
    });
});

function updateBots(room) {
    if (!room.hasGameStarted || !room.bots) return;
    const botKeys = Object.keys(room.bots);
    const allEntities = [
        ...Object.keys(room.players).map(id => ({ id, ...room.players[id], isBot: false })),
        ...botKeys.map(id => ({ id, ...room.bots[id], isBot: true }))
    ];

    botKeys.forEach(botId => {
        const bot = room.bots[botId];
        bot.oldY = bot.y;
        
        let dx = 0;
        let target = null;

        if (bot.isIt) {
            let minDist = Infinity;
            allEntities.forEach(e => {
                if (e.id === botId || e.isIt) return;
                const dist = getDistance(bot, e);
                if (dist < minDist) { minDist = dist; target = e; }
            });
            if (target) dx = target.x - bot.x;
        } else {
            const it = allEntities.find(e => e.isIt);
            if (it && getDistance(bot, it) < 200) dx = bot.x - it.x;
            else if (Math.random() < 0.01) bot.targetX = Math.random() * ARENA_WIDTH;
            if (!it || getDistance(bot, it) >= 200) dx = bot.targetX - bot.x;
        }

        const currentSpeed = (bot.speedTimer > 0) ? BOOST_SPEED : BASE_SPEED;
        if (dx > 5) bot.x += currentSpeed;
        else if (dx < -5) bot.x -= currentSpeed;

        // Jump Logic
        if (bot.jumpCooldown > 0) bot.jumpCooldown--;
        if (target && target.y < bot.y - 40 && bot.jumpCooldown <= 0) {
            bot.vy = JUMP_FORCE;
            bot.jumpCooldown = 60;
        }

        // Physics
        bot.vy = Math.min(MAX_FALL_SPEED, bot.vy + GRAVITY);
        bot.y += bot.vy;
        const grounded = checkPlatformCollision(bot, room.platforms);
        if (grounded) bot.jumpsUsed = 0;

        bot.x = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_W, bot.x));
        if (bot.speedTimer > 0) bot.speedTimer--;
        if (bot.shieldTimer > 0) bot.shieldTimer--;
        if (!bot.isIt) bot.score++;

        // Power-up
        room.powerups.forEach((pu, index) => {
            if (getDistance(bot, pu) < PLAYER_RADIUS + POWERUP_RADIUS) {
                if (pu.type === 'speed') bot.speedTimer = pu.duration;
                if (pu.type === 'shield') bot.shieldTimer = pu.duration;
                if (pu.type === 'teleport') { bot.x = Math.random() * 750 + 20; bot.y = 100; }
                room.powerups.splice(index, 1);
            }
        });
    });
}

setInterval(() => {
    for (const code in rooms) {
        const room = rooms[code];
        const playerKeys = Object.keys(room.players);
        if (playerKeys.length === 0) continue;

        updateBots(room);

        // Spawn power-ups
        room.powerupTimer--;
        if (room.powerupTimer <= 0) {
            if (room.powerups.length < 3) {
                const config = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                room.powerups.push({
                    x: Math.random() * 760 + 20, y: Math.random() * 400 + 100, ...config
                });
            }
            room.powerupTimer = 400 + Math.random() * 400;
        }

        if (room.tagCooldown > 0) room.tagCooldown--;

        playerKeys.forEach(id => {
            const p = room.players[id];
            p.oldY = p.y;
            if (p.speedTimer > 0) p.speedTimer--;
            if (p.shieldTimer > 0) p.shieldTimer--;
            const currentSpeed = (p.speedTimer > 0) ? BOOST_SPEED : BASE_SPEED;

            if (p.left) p.x -= currentSpeed;
            if (p.right) p.x += currentSpeed;

            // Jump handling (with double jump)
            if (p.up && p.canJump) {
                if (p.jumpsUsed < 2) {
                    p.vy = JUMP_FORCE;
                    p.jumpsUsed++;
                }
                p.canJump = false;
            }
            if (!p.up) p.canJump = true;

            p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY);
            p.y += p.vy;

            const grounded = checkPlatformCollision(p, room.platforms);
            if (grounded) p.jumpsUsed = 0;

            p.x = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_W, p.x));
            if (!p.isIt) p.score++;

            room.powerups.forEach((pu, idx) => {
                if (getDistance(p, pu) < PLAYER_RADIUS + POWERUP_RADIUS) {
                    if (pu.type === 'speed') p.speedTimer = pu.duration;
                    if (pu.type === 'shield') p.shieldTimer = pu.duration;
                    if (pu.type === 'teleport') { p.x = Math.random() * 750 + 20; p.y = 100; }
                    room.powerups.splice(idx, 1);
                    io.to(code).emit('powerupCollected', { playerId: id, type: pu.type });
                }
            });
        });

        // Tag collisions & Win Check
        const all = [
            ...playerKeys.map(id => ({ id, data: room.players[id] })),
            ...Object.keys(room.bots || {}).map(id => ({ id, data: room.bots[id] }))
        ];
        const it = all.find(e => e.data.isIt);
        if (room.hasGameStarted && it && room.tagCooldown <= 0) {
            all.forEach(target => {
                if (target.id === it.id) return;
                if (target.data.shieldTimer <= 0 && 
                    isCollision(it.data, target.data, PLAYER_RADIUS, PLAYER_RADIUS)) {
                    it.data.isIt = false;
                    target.data.isIt = true;
                    target.data.speedTimer = 0;
                    target.data.shieldTimer = 0;
                    room.tagCooldown = 60;
                    io.to(code).emit('tagEvent', { newIt: target.id });
                }
            });
        }

        // WIN CONDITION CHECK (100 points = 6000 frames)
        const winner = all.find(e => e.data.score >= 6000);
        if (winner && room.hasGameStarted) {
            room.hasGameStarted = false;
            io.to(code).emit('gameOver', { 
                winnerName: winner.data.username,
                winnerId: winner.id 
            });
        }

        io.to(code).emit('gameState', {
            players: room.players, bots: room.bots, powerups: room.powerups,
            hasGameStarted: room.hasGameStarted, hostId: room.hostId
        });
    }
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Cyber Tag Server running at http://localhost:${PORT}`);
});

