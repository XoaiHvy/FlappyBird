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
const gameBgVideo = document.getElementById('gameBgVideo');
// --- DATA COLLECTION ---
// bird
const BIRD_SKINS = [
    { id: 'bird_nightfury',     name: 'Night Fury',     src: 'assets/images/nightfury_bird.png' },
    { id: 'bird_lightfury',     name: 'Light Fury',     src: 'assets/images/lightfury_bird.png' },
    { id: 'bird_bewilderbeast', name: 'Bewilderbeast',  src: 'assets/images/bewilderbeast_bird.png' },
    // Bạn có thể giữ con chim gốc nếu muốn
    { id: 'bird_default',       name: 'Base Guts',       src: 'assets/images/bird.png' }
];

// map
const MAP_SKINS = [
    { id: 'map_eldenring',   name: 'Elden Ring',   src: 'assets/images/videos/eldenring_map.mp4' },
    { id: 'map_starrynight', name: 'Starry Night', src: 'assets/images/videos/starrynight_map.mp4' },
    { id: 'map_city',        name: 'Night City',         src: 'assets/images/videos/city_map.mp4' },
    { id: 'map_default',     name: 'Berserk',      src: 'assets/images/videos/game_bg.mp4' },
    { id: 'map_frozen',      name: 'Frozen Zerg',  src: 'assets/images/videos/frozen_map.mp4'}
];
const PIPE_SKINS = [
    { 
        id: 'pipe_default', 
        name: 'Corpse of Berserk', 
        top: 'assets/images/pipe_top.png', 
        bottom: 'assets/images/pipe_bottom.png' 
    },
    { 
        id: 'pipe_sword', 
        name: 'Sword of Truth', 
        top: 'assets/images/pipesword_top.png', 
        bottom: 'assets/images/pipesword_bottom.png' 
    },
    { 
        id: 'pipe_ice', 
        name: 'Frozen Peak', 
        top: 'assets/images/pipeice_top.png', 
        bottom: 'assets/images/pipeice_bottom.png' 
    },
    { 
        id: 'pipe_van', 
        name: 'Vangogh', 
        top: 'assets/images/pipevan_top.png', 
        bottom: 'assets/images/pipevan_bottom.png' 
    }
];
let currentBirdSrc = localStorage.getItem('selectedBirdSrc') || BIRD_SKINS[0].src;
let currentMapSrc = localStorage.getItem('selectedMapSrc') || MAP_SKINS[0].src;
let currentPipeId = localStorage.getItem('selectedPipeId') || 'pipe_default';

// dom
const collectionScreen = document.getElementById('collectionScreen');
const collectionButton = document.getElementById('collectionButton'); // Nút ở menu chính
const collectionBackBtn = document.getElementById('collectionBackBtn');
const birdGrid = document.getElementById('birdGrid');
const mapGrid = document.getElementById('mapGrid');
const pipeGrid = document.getElementById('pipeGrid');

// canvas n context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// size game
let GAME_WIDTH = canvas.width;
let GAME_HEIGHT = canvas.height;

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
// Bird animation state
let birdAngle = 0; 
const MAX_UP_ANGLE = -25;   
const MAX_DOWN_ANGLE = 80;  
const ANGLE_LERP = 0.12;    

let flapTimer = 0;         
const FLAP_DURATION = 200;  
const FLAP_SCALE_X = 1.05;  
const FLAP_SCALE_Y = 0.9;   

// hitbox fix
const DEBUG_HITBOX = false; 
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
};

function loadAssets() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalAssets = Object.keys(assets).length;
        const assetLoaded = () => {
            loadedCount++;
            if (loadedCount === totalAssets) resolve();
        };

        
        assets.bird.src = currentBirdSrc; 
        
        
        assets.bird.onload = assetLoaded;
        assets.bird.onerror = () => {
            console.error("Lỗi load ảnh chim, dùng ảnh mặc định.");
            assets.bird.src = 'assets/images/bird.png'; // Fallback
        };
const selectedPipe = PIPE_SKINS.find(p => p.id === currentPipeId) || PIPE_SKINS[0];
        assets.pipeTop.src = 'assets/images/pipe_top.png';
        assets.pipeTop.onload = assetLoaded;
        assets.pipeBottom.src = 'assets/images/pipe_bottom.png';
        assets.pipeBottom.onload = assetLoaded;
    });
}
// game logic
function resizeGame() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    GAME_WIDTH = canvas.width / dpr;
    GAME_HEIGHT = canvas.height / dpr;
}

window.addEventListener('resize', resizeGame);
resizeGame();

function startGame() {
    
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');

    resizeGame();
    resetGame();

    gameRunning = true;
    isPaused = false;
    isGameOver = false;
  
    menuBgVideo.pause();         
    gameBgVideo.currentTime = 0; 
    gameBgVideo.play();          

    canvas.addEventListener('click', jump);
    document.addEventListener('keydown', handleKeyPress); 

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

        flapTimer = 0;
        birdAngle = MAX_UP_ANGLE;
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
    const gapY = Math.random() * (maxHeight - minHeight) + minHeight; 
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
  
    const velocityTargetAngle = Math.max(Math.min(birdVelocityY * 7, MAX_DOWN_ANGLE), MAX_UP_ANGLE);

    birdAngle += (velocityTargetAngle - birdAngle) * ANGLE_LERP;

    flapTimer += (typeof delta === 'number' ? delta : 16.67);

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
function renderCollection() {
    //render bird
    birdGrid.innerHTML = '';
    BIRD_SKINS.forEach(skin => {
        const div = document.createElement('div');
       
        const isSelected = (skin.src === currentBirdSrc);
        div.className = `skin-item ${isSelected ? 'selected' : ''}`;
        
        div.innerHTML = `
            <img src="${skin.src}" class="skin-img" alt="${skin.name}">
            <div class="skin-name">${skin.name}</div>
        `;
        
        div.onclick = () => {
            currentBirdSrc = skin.src;
            localStorage.setItem('selectedBirdSrc', skin.src); 
            assets.bird.src = skin.src; 
            renderCollection(); 
        };
        birdGrid.appendChild(div);
    });

    // render map
    mapGrid.innerHTML = '';
    MAP_SKINS.forEach(skin => {
        const div = document.createElement('div');
        const isSelected = (skin.src === currentMapSrc);
        div.className = `skin-item ${isSelected ? 'selected' : ''}`;
        
        div.innerHTML = `
            <video src="${skin.src}" class="map-preview" muted loop autoplay playsinline></video>
            <div class="skin-name">${skin.name}</div>
        `;

        div.onclick = () => {
            currentMapSrc = skin.src;
            localStorage.setItem('selectedMapSrc', skin.src); 
            
            menuBgVideo.src = skin.src;
            gameBgVideo.src = skin.src;
            menuBgVideo.play().catch(()=>{});
            
            renderCollection();
        };
        mapGrid.appendChild(div);
        // render pipe
        pipeGrid.innerHTML = '';
    PIPE_SKINS.forEach(skin => {
        const div = document.createElement('div');
       
        const isSelected = (skin.id === currentPipeId);
        div.className = `skin-item ${isSelected ? 'selected' : ''}`;
        
        div.innerHTML = `
            <img src="${skin.bottom}" class="skin-img" style="height: 60px; object-fit: contain;" alt="${skin.name}">
            <div class="skin-name">${skin.name}</div>
        `;
        
        div.onclick = () => {
            currentPipeId = skin.id;
            localStorage.setItem('selectedPipeId', skin.id); 
            
            assets.pipeTop.src = skin.top;
            assets.pipeBottom.src = skin.bottom;
            
            renderCollection(); 
        };
        pipeGrid.appendChild(div);
    });
    });
}

// on/off
function openCollection() {
    menuScreen.classList.remove('active');
    collectionScreen.classList.add('active');
    renderCollection(); 
}

function closeCollection() {
    collectionScreen.classList.remove('active');
    menuScreen.classList.add('active');

    menuBgVideo.play().catch(()=>{}); 
}
function selectBird(id) {
    currentBirdId = id;
    localStorage.setItem('selectedBird', id); // save
  
    const skinData = BIRD_SKINS.find(s => s.id === id);
    if (skinData) {
        assets.bird.src = skinData.src;
    }
    
    renderCollection(); 
}

function selectMap(id) {
    currentMapId = id;
    localStorage.setItem('selectedMap', id);
    
    const skinData = MAP_SKINS.find(s => s.id === id);
    if (skinData) {
        menuBgVideo.src = skinData.src;
        gameBgVideo.src = skinData.src;
        
        menuBgVideo.load();
        gameBgVideo.load();
        menuBgVideo.play().catch(()=>{});
    }

    renderCollection();
}

function openCollection() {
    menuScreen.classList.remove('active');
    collectionScreen.classList.add('active');
    renderCollection();
}

function closeCollection() {
    collectionScreen.classList.remove('active');
    menuScreen.classList.add('active');
}

function draw() {
    // clear
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // draw pipes 
    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i];
        if (pipe.type === 'top') {
            ctx.drawImage(assets.pipeTop, pipe.x, pipe.y, pipe.width, pipe.height);
        } else {
            ctx.drawImage(assets.pipeBottom, pipe.x, pipe.y, pipe.width, pipe.height);
        }
    }

    // draw bird
    ctx.save();
    const cx = birdX + BIRD_WIDTH / 2;
    const cy = birdY + BIRD_HEIGHT / 2;
    ctx.translate(cx, cy);
    ctx.rotate((birdAngle * Math.PI) / 180);

    let scaleX = 1, scaleY = 1;
    if (flapTimer < FLAP_DURATION) {
        const t = flapTimer / FLAP_DURATION;
        const ease = 1 - Math.pow(1 - t, 2);
        scaleX = 1 + (FLAP_SCALE_X - 1) * (1 - ease);
        scaleY = 1 - (1 - FLAP_SCALE_Y) * (1 - ease);
    }

    ctx.scale(scaleX, scaleY);
    ctx.drawImage(assets.bird, -BIRD_WIDTH / 2, -BIRD_HEIGHT / 2, BIRD_WIDTH, BIRD_HEIGHT);
    ctx.restore();

    // Debug
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
}

let rafId = null;

function gameLoop() {
    if (!gameRunning) return;

    update();
    draw();

    rafId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isGameOver = true;
    gameRunning = false; 
    finalScoreDisplay.textContent = score;
    gameOverOverlay.classList.add('visible');
    gameBgVideo.pause();
    
    canvas.removeEventListener('click', jump);
    document.removeEventListener('keydown', handleKeyPress);
}

function togglePause() {
    if (isGameOver) return; 

    if (!isPaused) {
     
        isPaused = true;
        pauseOverlay.classList.add('visible');

        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        try { if (typeof gameBgVideo !== 'undefined' && gameBgVideo) gameBgVideo.pause(); } catch (e) {}

        canvas.removeEventListener('click', jump);
        document.removeEventListener('keydown', handleKeyPress);
    } else {
        // -> resume
        isPaused = false;
        pauseOverlay.classList.remove('visible');

        canvas.addEventListener('click', jump);
        document.addEventListener('keydown', handleKeyPress);

        try { if (typeof gameBgVideo !== 'undefined' && gameBgVideo) gameBgVideo.play().catch(()=>{}); } catch (e) {}

        if (!rafId && gameRunning) {
            gameLoop();
        }
    }
}

function resumeGame() {
    if (isGameOver) return;
    if (isPaused) togglePause(); 
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
pauseButton.addEventListener('click', (e) => {
   
    e.stopPropagation(); 
    console.log("Pause button clicked!"); 
    togglePause();
});

pauseButton.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault(); 
    }
});
resumeButton.addEventListener('click', resumeGame);
exitToMenuButton.addEventListener('click', exitGameToMenu);
retryButton.addEventListener('click', startGame); 
gameOverExitButton.addEventListener('click', exitGameToMenu);
collectionButton.addEventListener('click', openCollection);
collectionBackBtn.addEventListener('click', closeCollection);

window.onload = async () => {
     menuBgVideo.src = currentMapSrc;
    gameBgVideo.src = currentMapSrc;

    await loadAssets();

    menuBgVideo.src = 'assets/images/videos/menu_bg.mp4';
    menuBgVideo.loop = true;
    menuBgVideo.muted = true;      
    menuBgVideo.playsInline = true;
    gameBgVideo.src = 'assets/images/videos/game_bg.mp4'; 
    gameBgVideo.loop = true;
    gameBgVideo.muted = true;
    gameBgVideo.playsInline = true;

    menuBgVideo.play().catch(() => {
        
        console.warn('Menu background video autoplay was blocked; it will play after user interaction.');
    });
};
