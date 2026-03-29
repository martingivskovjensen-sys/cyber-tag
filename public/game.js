const socket = io();

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const lobbyContainer = document.getElementById('lobby-container');
const roomContainer = document.getElementById('room-container');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnStart = document.getElementById('btn-start');
const btnBotMinus = document.getElementById('btn-bot-minus');
const btnBotPlus = document.getElementById('btn-bot-plus');
const botCountDisplay = document.getElementById('bot-count');
const botConfig = document.getElementById('bot-config');
const inputCode = document.getElementById('input-code');
const inputUsername = document.getElementById('input-username');
const errorMsg = document.getElementById('error-msg');
const displayCode = document.getElementById('display-code');
const gameStatus = document.getElementById('game-status');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const victoryScreen = document.getElementById('victory-screen');
const winnerNameSpan = document.getElementById('winner-name');
const btnDismissVictory = document.getElementById('btn-dismiss-victory');
const colorButtons = document.querySelectorAll('.color-btn');

let gameState = { players: {}, bots: {}, powerups: [], hasGameStarted: false };
let myId = null;
let roomCode = null;
let isHost = false;
let botCount = 0;
let platforms = [];
let animFrame = 0;
let selectedColor = "#00ffff"; // Default Cyan
// Controls
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// UI LISTENERS
colorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        colorButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedColor = btn.dataset.color;
    });
});

btnCreate.addEventListener('click', () => {
    const username = inputUsername.value.trim();
    if (username.length > 0) socket.emit('createRoom', { username, color: selectedColor });
    else errorMsg.textContent = "Please enter a username.";
});

btnJoin.addEventListener('click', () => {
    const code = inputCode.value.trim().toUpperCase();
    const username = inputUsername.value.trim();
    if (username.length === 0) { errorMsg.textContent = "Please enter a username."; return; }
    if (code.length === 4) socket.emit('joinRoom', { code, username, color: selectedColor });
    else errorMsg.textContent = "Code must be 4 letters.";
});

btnStart.addEventListener('click', () => {
    socket.emit('startGame', { botCount });
});

btnDismissVictory.addEventListener('click', () => {
    victoryScreen.classList.add('hidden');
    // Show room container again for host to restart
    roomContainer.classList.remove('hidden');
    if (isHost) {
        btnStart.classList.remove('hidden');
        botConfig.classList.remove('hidden');
    }
});

btnBotMinus.addEventListener('click', () => {
    if (botCount > 0) { botCount--; botCountDisplay.textContent = botCount; }
});

btnBotPlus.addEventListener('click', () => {
    if (botCount < 10) { botCount++; botCountDisplay.textContent = botCount; }
});

inputCode.addEventListener('input', () => { errorMsg.textContent = ""; });

// SOCKET LISTENERS
socket.on('errorMsg', (msg) => {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    setTimeout(() => { errorMsg.style.display = "none"; }, 3000);
});

socket.on('roomJoined', (data) => {
    roomCode = data.code;
    myId = data.playerId;
    isHost = data.isHost;
    platforms = data.platforms;
    
    lobbyContainer.classList.add('hidden');
    roomContainer.classList.remove('hidden');
    displayCode.textContent = roomCode;
    
    if (isHost) {
        btnStart.classList.remove('hidden');
        botConfig.classList.remove('hidden');
    }
    canvas.classList.remove('hidden');
    
    uiLayer.style.top = "20px";
    uiLayer.style.transform = "scale(0.8)";
    roomContainer.style.background = "rgba(20, 20, 30, 0.3)";

    setInterval(sendInput, 1000 / 60);
    requestAnimationFrame(renderLoop);
});

socket.on('gameStarted', () => {
    btnStart.classList.add('hidden');
    botConfig.classList.add('hidden');
    victoryScreen.classList.add('hidden');
});

socket.on('gameOver', (data) => {
    winnerNameSpan.textContent = data.winnerName + " Wins!";
    // Find winner color
    const winner = gameState.players[data.winnerId] || gameState.bots[data.winnerId] || { color: "#fff" };
    winnerNameSpan.style.color = winner.color;
    victoryScreen.classList.remove('hidden');
    roomContainer.classList.add('hidden'); // Hide Lobby while showing victory
});

socket.on('gameState', (state) => {
    gameState = state;
    if (gameState.hasGameStarted) {
        gameStatus.textContent = "Match in Progress";
        gameStatus.style.color = "#0f0";
    } else {
        gameStatus.textContent = "Lobby - Waiting for Host";
    }
});

socket.on('tagEvent', (data) => {
    if (data.newIt === myId) {
        document.body.style.background = "radial-gradient(circle at center, #300 0%, #000 100%)";
        setTimeout(() => {
            document.body.style.background = "radial-gradient(circle at center, #111 0%, #000 100%)";
        }, 300);
    }
});

// INPUT
window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') keys.up = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.down = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') keys.up = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
});

function sendInput() {
    socket.emit('input', keys);
}

function drawStickman(x, y, color, username, score, isIt, isBot, isMe) {
    const centerX = x + 10;
    const centerY = y;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    if (isIt) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
    }

    // Head
    ctx.beginPath();
    ctx.arc(centerX, centerY + 8, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 14);
    ctx.lineTo(centerX, centerY + 30);
    ctx.stroke();

    // Legs animation
    const legSwing = Math.sin(animFrame * 0.2) * 8;
    // Left Leg
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 30);
    ctx.lineTo(centerX - 8 + legSwing, centerY + 43);
    ctx.stroke();
    // Right Leg
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 30);
    ctx.lineTo(centerX + 8 - legSwing, centerY + 43);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 18);
    ctx.lineTo(centerX - 10, centerY + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 18);
    ctx.lineTo(centerX + 10, centerY + 24);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // UI Above
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Outfit";
    ctx.textAlign = "center";
    let name = isMe ? "(YOU) " + username : (isBot ? "🤖 " + username : username);
    ctx.fillText(name, centerX, centerY - 15);
    
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px Outfit";
    ctx.fillText("Score: " + Math.floor(score/60), centerX, centerY - 5);
}

function renderLoop() {
    animFrame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=40){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

    // Draw Platforms
    platforms.forEach(p => {
        ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 2;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        
        // Neon Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#0ff";
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.shadowBlur = 0;
    });

    // Draw Power-ups
    if (gameState.powerups) {
        gameState.powerups.forEach(pu => {
            ctx.font = "24px Outfit";
            ctx.textAlign = "center";
            let icon = "⚡";
            if (pu.type === 'shield') icon = "🛡️";
            if (pu.type === 'teleport') icon = "🌀";
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = pu.color;
            ctx.fillText(icon, pu.x, pu.y + 10);
            ctx.shadowBlur = 0;
        });
    }

    // Draw Players & Bots
    const players = gameState.players || {};
    const bots = gameState.bots || {};
    const all = { ...players, ...bots };

    for (let id in all) {
        const p = all[id];
        const isMe = id === myId;
        const isBot = id.startsWith('bot_');
        
        let color = isMe ? "#00ffff" : (isBot ? "#fff" : "#00aaff");
        if (p.isIt) color = "#ff3366";
        
        // Shield Effect
        if (p.shieldTimer > 0) {
            ctx.beginPath();
            ctx.arc(p.x + 10, p.y + 20, 30, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        drawStickman(p.x, p.y, color, p.username, p.score, p.isIt, isBot, isMe);
    }

    requestAnimationFrame(renderLoop);
}
