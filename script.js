// dom
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const playButton = document.getElementById('playButton');
const pauseButton = document.getElementById('pauseButton');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeButton = document.getElementById('resumeButton');
const exitToMenuButton = document.getElementById('exitToMenuButton');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const retryButton = document.getElementById('retryButton');
const gameOverExitButton = document.getElementById('gameOverExitButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreDisplay = document.getElementById('finalScore');
const menuBgVideo = document.getElementById('menuBgVideo');

// canvas n context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// size game
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// in game
let gameRunning = false;
let isPaused = false;
let isGameOver = false;
let score = 0;

// bird
const BIRD_WIDTH = 60;
const BIRD_HEIGHT = 50;  
let birdX = 200;
let birdY = GAME_HEIGHT / 1 - BIRD_HEIGHT / 1;
let birdVelocityY = 2;
const GRAVITY = 0.1;
const JUMP_STRENGTH = -3;

// Hitbox config 
const DEBUG_HITBOX = true; 
const BIRD_HITBOX_INSET = { x: 6, y: 4 }; 
const PIPE_HITBOX_INSET = { x: 2, y: 2 };  

// pipe
const PIPE_WIDTH = 70;
const PIPE_GAP_HEIGHT = 150;
const PIPE_SPEED = 2;
const PIPE_SPACING = 250; 
let pipes = [];
let lastPipeSpawnTime = 0;
const PIPE_SPAWN_INTERVAL = 2000; 

const assets = {
    bird: new Image(),
    pipeTop: new Image(),
    pipeBottom: new Image(),
    gameBg: new Image(),
};

function loadAssets() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalAssets = Object.keys(assets).length;

        const assetLoaded = () => {
            loadedCount++;
            if (loadedCount === totalAssets) {
                resolve();
            }
        };

        assets.bird.src = 'assets/images/bird.png';
        assets.bird.onload = assetLoaded;
        assets.bird.onerror = () => console.error("Failed to load bird.png");

        assets.pipeTop.src = 'assets/images/pipe_top.png';
        assets.pipeTop.onload = assetLoaded;
        assets.pipeTop.onerror = () => console.error("Failed to load pipe_top.png");

        assets.pipeBottom.src = 'assets/images/pipe_bottom.png';
        assets.pipeBottom.onload = assetLoaded;
        assets.pipeBottom.onerror = () => console.error("Failed to load pipe_bottom.png");

        assets.gameBg.src = 'assets/images/game_bg.png';
        assets.gameBg.onload = assetLoaded;
        assets.gameBg.onerror = () => console.error("Failed to load game_bg.png");
    });
}

// ---- Game Logic Functions ----

function startGame() {
    // menu
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');

    // Reset 
    resetGame();

    gameRunning = true;
    isPaused = false;
    isGameOver = false;
  
    menuBgVideo.pause();

    canvas.addEventListener('click', jump);
    document.addEventListener('keydown', handleKeyPress); // Lắng nghe phím cách

    gameLoop();
}

function resetGame() {
    birdY = GAME_HEIGHT / 2 - BIRD_HEIGHT / 2;
    birdVelocityY = 0;
    pipes = [];
    score = 0;
    scoreDisplay.textContent = `Score: ${score}`;
    lastPipeSpawnTime = 0;

    pauseOverlay.classList.remove('visible');
    gameOverOverlay.classList.remove('visible');
}

function jump() {
    if (!isPaused && !isGameOver) {
        birdVelocityY = JUMP_STRENGTH;
    }
}

function handleKeyPress(event) {
    if (event.code === 'Space' && !isPaused && !isGameOver) {
        jump();
    }
}


function spawnPipe() {
    const minHeight = 50;
    const maxHeight = GAME_HEIGHT - PIPE_GAP_HEIGHT - 50;
    const gapY = Math.random() * (maxHeight - minHeight) + minHeight; // Vị trí Y của khoảng trống

    pipes.push({
        x: GAME_WIDTH,
        y: 0,
        width: PIPE_WIDTH,
        height: gapY,
        type: 'top',
        passed: false
    });

    pipes.push({
        x: GAME_WIDTH,
        y: gapY + PIPE_GAP_HEIGHT,
        width: PIPE_WIDTH,
        height: GAME_HEIGHT - (gapY + PIPE_GAP_HEIGHT),
        type: 'bottom',
        passed: false
    });
}

function rectsIntersect(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}
function update() {
    if (isPaused || isGameOver) return;

    birdVelocityY += GRAVITY;
    birdY += birdVelocityY;

    if (birdY < 0 || birdY + BIRD_HEIGHT > GAME_HEIGHT) {
        gameOver();
        return;
    }

    if (Date.now() - lastPipeSpawnTime > PIPE_SPAWN_INTERVAL) {
        spawnPipe();
        lastPipeSpawnTime = Date.now();
    }
    
    const birdRect = {
        x: birdX + BIRD_HITBOX_INSET.x,
        y: birdY + BIRD_HITBOX_INSET.y,
        w: BIRD_WIDTH - 2 * BIRD_HITBOX_INSET.x,
        h: BIRD_HEIGHT - 2 * BIRD_HITBOX_INSET.y
    };

    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i];
        pipe.x -= PIPE_SPEED;

        const pipeRect = {
            x: pipe.x + PIPE_HITBOX_INSET.x,
            y: pipe.y + PIPE_HITBOX_INSET.y,
            w: pipe.width - 2 * PIPE_HITBOX_INSET.x,
            h: pipe.height - 2 * PIPE_HITBOX_INSET.y
        };

if (rectsIntersect(birdRect, pipeRect)) {
    gameOver();
    return;
}

        if (!pipe.passed && pipe.x + pipe.width < birdX) {
            pipe.passed = true;
            if (pipe.type === 'bottom') { 
                score++;
                scoreDisplay.textContent = `Score: ${score}`;
            }
        }
    }

    pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);
}

function draw() {
 
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.drawImage(assets.gameBg, 0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.drawImage(assets.bird, birdX, birdY, BIRD_WIDTH, BIRD_HEIGHT);

    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i];
        if (pipe.type === 'top') {
            ctx.drawImage(assets.pipeTop, pipe.x, pipe.y, pipe.width, pipe.height);
        } else {
            ctx.drawImage(assets.pipeBottom, pipe.x, pipe.y, pipe.width, pipe.height);
        }
    }
}
    if (DEBUG_HITBOX) {
        // bird hitbox
        ctx.strokeStyle = 'rgba(255,0,0,0.9)';
        ctx.lineWidth = 2;
        const bx = birdX + BIRD_HITBOX_INSET.x;
        const by = birdY + BIRD_HITBOX_INSET.y;
        const bw = BIRD_WIDTH - 2 * BIRD_HITBOX_INSET.x;
        const bh = BIRD_HEIGHT - 2 * BIRD_HITBOX_INSET.y;
        ctx.strokeRect(bx, by, bw, bh);

        // pipes hitboxes
        ctx.strokeStyle = 'rgba(0,255,0,0.9)';
        for (let i = 0; i < pipes.length; i++) {
            const p = pipes[i];
            const px = p.x + PIPE_HITBOX_INSET.x;
            const py = p.y + PIPE_HITBOX_INSET.y;
            const pw = p.width - 2 * PIPE_HITBOX_INSET.x;
            const ph = p.height - 2 * PIPE_HITBOX_INSET.y;
            ctx.strokeRect(px, py, pw, ph);
        }
    }

function gameLoop() {
    if (!gameRunning) return;

    update();
    draw();

    requestAnimationFrame(gameLoop);
}

function gameOver() {
    isGameOver = true;
    gameRunning = false; 
    finalScoreDisplay.textContent = score;
    gameOverOverlay.classList.add('visible');
    
    canvas.removeEventListener('click', jump);
    document.removeEventListener('keydown', handleKeyPress);
}

function togglePause() {
    if (isGameOver) return; 

    isPaused = !isPaused;
    if (isPaused) {
        pauseOverlay.classList.add('visible');
       
    } else {
        pauseOverlay.classList.remove('visible');
        gameLoop(); 
    }
}

function resumeGame() {
    if (isGameOver) return;
    isPaused = false;
    pauseOverlay.classList.remove('visible');
    gameLoop();
}

function exitGameToMenu() {
    gameRunning = false;
    isPaused = false;
    isGameOver = false;
    pipes = [];
   
    canvas.removeEventListener('click', jump);
    document.removeEventListener('keydown', handleKeyPress);

    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');

    menuBgVideo.play();
}


// ---- Event Listeners ----
playButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
resumeButton.addEventListener('click', resumeGame);
exitToMenuButton.addEventListener('click', exitGameToMenu);
retryButton.addEventListener('click', startGame); 
gameOverExitButton.addEventListener('click', exitGameToMenu);

window.onload = loadAssets;