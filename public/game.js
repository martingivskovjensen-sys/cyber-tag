const socket = io();

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const lobbyContainer = document.getElementById('lobby-container');
const roomContainer = document.getElementById('room-container');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const inputCode = document.getElementById('input-code');
const errorMsg = document.getElementById('error-msg');
const displayCode = document.getElementById('display-code');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = {};
let myId = null;
let roomCode = null;

// Controls
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// UI Listeners
btnCreate.addEventListener('click', () => {
    socket.emit('createRoom');
});

btnJoin.addEventListener('click', () => {
    const code = inputCode.value.trim().toUpperCase();
    if (code.length === 4) {
        socket.emit('joinRoom', code);
    } else {
        errorMsg.textContent = "Code must be 4 letters.";
    }
});

inputCode.addEventListener('input', () => {
    errorMsg.textContent = ""; // clear error
});

// Socket Listeners
socket.on('errorMsg', (msg) => {
    errorMsg.textContent = msg;
});

socket.on('roomJoined', (data) => {
    roomCode = data.code;
    myId = data.playerId;
    
    // Hide Lobby, Show Room
    lobbyContainer.classList.add('hidden');
    roomContainer.classList.remove('hidden');
    displayCode.textContent = roomCode;
    
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

socket.on('gameState', (state) => {
    gameState = state;
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
    // Optional: play a sound or show a small popup
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
            
            // Draw an icon or initial
            ctx.fillStyle = "black";
            ctx.font = "bold 10px Outfit";
            ctx.fillText(pu.type[0].toUpperCase(), pu.x, pu.y + 4);
            ctx.shadowBlur = 0;
        });
    }

    // Draw Players
    const players = gameState.players || {};
    for (let id in players) {
        const p = players[id];
        const isMe = id === myId;
        
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
            ctx.fillStyle = isMe ? "#00ffff" : "#00aaff";
            ctx.shadowColor = isMe ? "#00ffff" : "#00aaff";
            ctx.shadowBlur = isMe ? 20 : 10;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // reset
        
        // Draw score below player
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "12px Outfit";
        ctx.textAlign = "center";
        
        const scoreSeconds = Math.floor(p.score / 60); // approx seconds
        ctx.fillText(scoreSeconds, p.x, p.y + 35);
        
        if (isMe) {
            ctx.fillStyle = "white";
            ctx.fillText("YOU", p.x, p.y - 25);
        }
    }

    requestAnimationFrame(renderLoop);
}
