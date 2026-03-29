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

let gameState = { players: {}, bots: {}, powerups: [], hasGameStarted: false };
let myId = null;
let roomCode = null;
let isHost = false;
let botCount = 0;

// Controls
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// UI Listeners
btnCreate.addEventListener('click', () => {
    const username = inputUsername.value.trim();
    if (username.length > 0) {
        socket.emit('createRoom', { username });
    } else {
        errorMsg.textContent = "Please enter a username.";
    }
});

btnJoin.addEventListener('click', () => {
    const code = inputCode.value.trim().toUpperCase();
    const username = inputUsername.value.trim();
    if (username.length === 0) {
        errorMsg.textContent = "Please enter a username.";
        return;
    }
    if (code.length === 4) {
        socket.emit('joinRoom', { code, username });
    } else {
        errorMsg.textContent = "Code must be 4 letters.";
    }
});

btnStart.addEventListener('click', () => {
    socket.emit('startGame', { botCount });
});

btnBotMinus.addEventListener('click', () => {
    if (botCount > 0) {
        botCount--;
        botCountDisplay.textContent = botCount;
    }
});

btnBotPlus.addEventListener('click', () => {
    if (botCount < 5) {
        botCount++;
        botCountDisplay.textContent = botCount;
    }
});

inputCode.addEventListener('input', () => {
    errorMsg.textContent = ""; // clear error
});

// Socket Listeners
socket.on('errorMsg', (msg) => {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    setTimeout(() => { errorMsg.style.display = "none"; }, 3000);
});

socket.on('roomJoined', (data) => {
    roomCode = data.code;
    myId = data.playerId;
    isHost = data.isHost;
    
    // Hide Lobby, Show Room
    lobbyContainer.classList.add('hidden');
    roomContainer.classList.remove('hidden');
    displayCode.textContent = roomCode;
    
    if (isHost) {
        btnStart.classList.remove('hidden');
        botConfig.classList.remove('hidden');
    }

    // Show Canvas
    canvas.classList.remove('hidden');
    
    // Push UI Layer to top slightly transparent so we can see game underneath
    uiLayer.style.top = "20px";
    uiLayer.style.transform = "scale(0.8)";
    roomContainer.style.background = "rgba(20, 20, 30, 0.3)";
    document.querySelector('.glow-text').style.fontSize = "2rem";

    // Start sending inputs
    setInterval(sendInput, 1000 / 60);
    // Start render loop
    requestAnimationFrame(renderLoop);
});

socket.on('gameStarted', () => {
    btnStart.classList.add('hidden');
    botConfig.classList.add('hidden');
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
    // Flash screen or play sound if wanted
    if (data.newIt === myId) {
        document.body.style.background = "radial-gradient(circle at center, #300 0%, #000 100%)";
        setTimeout(() => {
            document.body.style.background = "radial-gradient(circle at center, #111 0%, #000 100%)";
        }, 300);
    }
});

socket.on('powerupCollected', (data) => {
    console.log('Powerup collected:', data.type);
});

// Input Handling
window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.down = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
});

function sendInput() {
    socket.emit('input', keys);
}

// Render Loop
function renderLoop() {
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid for aesthetic
    ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for(let i=0; i<canvas.height; i+=40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Draw Power-ups
    if (gameState.powerups) {
        gameState.powerups.forEach(pu => {
            ctx.beginPath();
            ctx.arc(pu.x, pu.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = pu.color;
            ctx.shadowColor = pu.color;
            ctx.shadowBlur = 15;
            ctx.fill();
            
            ctx.fillStyle = "black";
            ctx.font = "bold 10px Outfit";
            ctx.textAlign = "center";
            ctx.fillText(pu.type[0].toUpperCase(), pu.x, pu.y + 4);
            ctx.shadowBlur = 0;
        });
    }

    // Draw Entites (Players + Bots)
    const players = gameState.players || {};
    const bots = gameState.bots || {};
    const allEntities = { ...players, ...bots };

    for (let id in allEntities) {
        const p = allEntities[id];
        const isMe = id === myId;
        const isBot = id.startsWith('bot_');
        
        // Draw Auras / Effects
        if (p.shieldTimer > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        if (p.speedTimer > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        
        if (p.isIt) {
            ctx.fillStyle = "#ff3366";
            ctx.shadowColor = "#ff3366";
            ctx.shadowBlur = 20;
        } else {
            if (isMe) {
                ctx.fillStyle = "#00ffff";
                ctx.shadowColor = "#00ffff";
            } else if (isBot) {
                ctx.fillStyle = "#ffffff";
                ctx.shadowColor = "#ffffff";
            } else {
                ctx.fillStyle = "#00aaff";
                ctx.shadowColor = "#00aaff";
            }
            ctx.shadowBlur = isMe ? 20 : 10;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // reset
        
        // Draw username and score below player
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "14px Outfit";
        ctx.textAlign = "center";
        
        let prefix = "";
        if (isMe) prefix = "(YOU) ";
        if (isBot) prefix = "🤖 ";
        
        ctx.fillText(prefix + p.username, p.x, p.y + 35);
        
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px Outfit";
        const scoreSeconds = Math.floor(p.score / 60);
        ctx.fillText(`Score: ${scoreSeconds}`, p.x, p.y + 50);
    }

    requestAnimationFrame(renderLoop);
}
