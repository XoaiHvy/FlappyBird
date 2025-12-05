// ==================== AUTH & PROFILE LOGIC (PHẦN MỚI) ====================

// Quản lý Users (Lấy từ localStorage hoặc tạo mới mảng rỗng)
let usersDB = JSON.parse(localStorage.getItem('flappyUsersDB')) || [];
let currentUser = null; // Người đang đăng nhập

// DOM Authentication
const authScreen = document.getElementById('authScreen');
const menuScreen = document.getElementById('menuScreen'); // Move up here
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUserInp = document.getElementById('loginUser');
const loginPassInp = document.getElementById('loginPass');
const regUserInp = document.getElementById('regUser');
const regPassInp = document.getElementById('regPass');
const authMessage = document.getElementById('authMessage');

// Profile & Greeting DOM
const displayUsername = document.getElementById('displayUsername');
const profileScreen = document.getElementById('profileScreen');
const profileButton = document.getElementById('profileButton');
const profileBackBtn = document.getElementById('profileBackBtn');
const logoutButton = document.getElementById('logoutButton');

// Profile Info DOM
const profileName = document.getElementById('profileName');
const profileBest = document.getElementById('profileBest');
const profileGames = document.getElementById('profileGames');

// Game Over Extra DOM
const finalBestScoreDisplay = document.getElementById('finalBestScore');
const newRecordMsg = document.getElementById('newRecordMsg');

function showMessage(msg) {
    authMessage.textContent = msg;
    setTimeout(() => authMessage.textContent = '', 3000);
}

function saveUsers() {
    localStorage.setItem('flappyUsersDB', JSON.stringify(usersDB));
}

function updateUIForUser() {
    if (!currentUser) return;
    displayUsername.textContent = currentUser.username;
}

// Logic kiểm tra phiên đăng nhập
function checkSession() {
    const sessionUser = localStorage.getItem('flappyCurrentSession');
    if (sessionUser) {
        currentUser = usersDB.find(u => u.username === sessionUser);
        if (currentUser) {
            authScreen.classList.remove('active');
            menuScreen.classList.add('active');
            updateUIForUser();
        }
    }
}
// Chạy ngay lập tức
checkSession();

// Sự kiện nút Auth
document.getElementById('btnSwitchToReg').onclick = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authMessage.textContent = '';
};
document.getElementById('btnSwitchToLogin').onclick = () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    authMessage.textContent = '';
};

document.getElementById('btnRegister').onclick = () => {
    const u = regUserInp.value.trim();
    const p = regPassInp.value.trim();
    if (!u || !p) return showMessage('Điền đủ thông tin đê!');
    if (usersDB.find(user => user.username === u)) return showMessage('Tên này bị trùng rồi!');

    const newUser = {
        username: u, password: p, highScore: 0, totalGames: 0
    };
    usersDB.push(newUser);
    saveUsers();
    showMessage('Đăng ký thành công! Hãy đăng nhập.');
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    loginUserInp.value = u; 
};

document.getElementById('btnLogin').onclick = () => {
    const u = loginUserInp.value.trim();
    const p = loginPassInp.value.trim();
    const foundUser = usersDB.find(user => user.username === u && user.password === p);
    if (foundUser) {
        currentUser = foundUser;
        localStorage.setItem('flappyCurrentSession', u);
        authScreen.classList.remove('active');
        menuScreen.classList.add('active');
        updateUIForUser();
        
        // Phát video menu
        if(menuBgVideo) menuBgVideo.play().catch(e=>console.log(e));
    } else {
        showMessage('Sai tài khoản hoặc mật khẩu!');
    }
};

if(logoutButton) {
    logoutButton.onclick = () => {
        currentUser = null;
        localStorage.removeItem('flappyCurrentSession');
        location.reload(); 
    };
}

if(profileButton) {
    profileButton.onclick = () => {
        menuScreen.classList.remove('active');
        profileScreen.classList.add('active');
        if(currentUser) {
            profileName.textContent = currentUser.username;
            profileBest.textContent = currentUser.highScore;
            profileGames.textContent = currentUser.totalGames;
        }
    };
}

if(profileBackBtn) {
    profileBackBtn.onclick = () => {
        profileScreen.classList.remove('active');
        menuScreen.classList.add('active');
    };
}

// ==================== GAME CORE LOGIC (PHẦN CŨ) ====================

// DOM Elements
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
const BIRD_SKINS = [
    { id: 'bird_nightfury',     name: 'Night Fury',     src: 'assets/images/nightfury_bird.png' },
    { id: 'bird_lightfury',     name: 'Light Fury',     src: 'assets/images/lightfury_bird.png' },
    { id: 'bird_bewilderbeast', name: 'Bewilderbeast',  src: 'assets/images/bewilderbeast_bird.png' },
    { id: 'bird_default',       name: 'Base Guts',       src: 'assets/images/bird.png' }
];

const MAP_SKINS = [
    { id: 'map_eldenring',   name: 'Elden Ring',   src: 'assets/images/videos/eldenring_map.mp4' },
    { id: 'map_starrynight', name: 'Starry Night', src: 'assets/images/videos/starrynight_map.mp4' },
    { id: 'map_city',        name: 'Night City',   src: 'assets/images/videos/city_map.mp4' },
    { id: 'map_default',     name: 'Berserk',      src: 'assets/images/videos/game_bg.mp4' },
    { id: 'map_frozen',      name: 'Frozen Zerg',  src: 'assets/images/videos/frozen_map.mp4'}
];
const PIPE_SKINS = [
    { id: 'pipe_default', name: 'Corpse of Berserk', top: 'assets/images/pipe_top.png', bottom: 'assets/images/pipe_bottom.png' },
    { id: 'pipe_sword',   name: 'Sword of Truth',    top: 'assets/images/pipesword_top.png', bottom: 'assets/images/pipesword_bottom.png' },
    { id: 'pipe_ice',     name: 'Frozen Peak',       top: 'assets/images/pipeice_top.png', bottom: 'assets/images/pipeice_bottom.png' },
    { id: 'pipe_van',     name: 'Vangogh',           top: 'assets/images/pipevan_top.png', bottom: 'assets/images/pipevan_bottom.png' }
];

let currentBirdSrc = localStorage.getItem('selectedBirdSrc') || BIRD_SKINS[0].src;
let currentMapSrc = localStorage.getItem('selectedMapSrc') || MAP_SKINS[0].src;
let currentPipeId = localStorage.getItem('selectedPipeId') || 'pipe_default';

// Collection DOM
const collectionScreen = document.getElementById('collectionScreen');
const collectionButton = document.getElementById('collectionButton');
const collectionBackBtn = document.getElementById('collectionBackBtn');
const birdGrid = document.getElementById('birdGrid');
const mapGrid = document.getElementById('mapGrid');
const pipeGrid = document.getElementById('pipeGrid');

// Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let GAME_WIDTH = canvas.width;
let GAME_HEIGHT = canvas.height;

// Game State
let gameRunning = false;
let isPaused = false;
let isGameOver = false;
let score = 0;

// Bird vars
const BIRD_WIDTH = 60;
const BIRD_HEIGHT = 50;  
let birdX = 200;
let birdY = GAME_HEIGHT / 2;
let birdVelocityY = 0;
const GRAVITY = 0.1;
const JUMP_STRENGTH = -3;
let birdAngle = 0; 
const MAX_UP_ANGLE = -25;   
const MAX_DOWN_ANGLE = 80;  
const ANGLE_LERP = 0.12;    
let flapTimer = 0;         
const FLAP_DURATION = 200;  
const FLAP_SCALE_X = 1.05;  
const FLAP_SCALE_Y = 0.9;   

// Hitbox config
const BIRD_HITBOX_INSET = { x: 6, y: 4 }; 
const PIPE_HITBOX_INSET = { x: 2, y: 2 };  

// Pipe vars
const PIPE_WIDTH = 70;
const PIPE_GAP_HEIGHT = 150;
const PIPE_SPEED = 2;
let pipes = [];
let lastPipeSpawnTime = 0;
const PIPE_SPAWN_INTERVAL = 2000; 

const assets = {
    bird: new Image(),
    pipeTop: new Image(),
    pipeBottom: new Image(),
};

// LOAD ASSETS
function loadAssets() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalAssets = 3;
        const assetLoaded = () => {
            loadedCount++;
            if (loadedCount === totalAssets) resolve();
        };

        assets.bird.src = currentBirdSrc; 
        assets.bird.onload = assetLoaded;
        assets.bird.onerror = () => { assets.bird.src = 'assets/images/bird.png'; assetLoaded(); };

        const selectedPipe = PIPE_SKINS.find(p => p.id === currentPipeId) || PIPE_SKINS[0];
        assets.pipeTop.src = selectedPipe.top;
        assets.pipeTop.onload = assetLoaded;
        assets.pipeBottom.src = selectedPipe.bottom;
        assets.pipeBottom.onload = assetLoaded;
    });
}

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

// START & RESET
function startGame() {
    menuScreen.classList.remove('active');
    gameScreen.classList.add('active');
    resizeGame();
    resetGame();
    gameRunning = true;
    isPaused = false;
    isGameOver = false;
  
    if(menuBgVideo) menuBgVideo.pause();         
    if(gameBgVideo) {
        gameBgVideo.currentTime = 0; 
        gameBgVideo.play().catch(e => console.log(e));          
    }

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
    pipes.push({ x: GAME_WIDTH, y: 0, width: PIPE_WIDTH, height: gapY, type: 'top', passed: false });
    pipes.push({ x: GAME_WIDTH, y: gapY + PIPE_GAP_HEIGHT, width: PIPE_WIDTH, height: GAME_HEIGHT - (gapY + PIPE_GAP_HEIGHT), type: 'bottom', passed: false });
}

function rectsIntersect(a, b) {
    return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}

function update() {
    if (isPaused || isGameOver) return;
    birdVelocityY += GRAVITY;
    birdY += birdVelocityY;
  
    const velocityTargetAngle = Math.max(Math.min(birdVelocityY * 7, MAX_DOWN_ANGLE), MAX_UP_ANGLE);
    birdAngle += (velocityTargetAngle - birdAngle) * ANGLE_LERP;
    flapTimer += 16.67;

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
    
    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i];
        if (pipe.type === 'top') {
            ctx.drawImage(assets.pipeTop, pipe.x, pipe.y, pipe.width, pipe.height);
        } else {
            ctx.drawImage(assets.pipeBottom, pipe.x, pipe.y, pipe.width, pipe.height);
        }
    }

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
}

function gameLoop() {
    if (!gameRunning) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// UPDATE: GAMEOVER LOGIC MỚI
function gameOver() {
    isGameOver = true;
    gameRunning = false; 
    
    // Logic High Score & Record
    if (currentUser) {
        currentUser.totalGames = (currentUser.totalGames || 0) + 1;
        if (score > currentUser.highScore) {
            currentUser.highScore = score;
            newRecordMsg.style.display = 'block'; 
        } else {
            newRecordMsg.style.display = 'none';
        }
        saveUsers();
        if(finalBestScoreDisplay) finalBestScoreDisplay.textContent = currentUser.highScore;
    }

    finalScoreDisplay.textContent = score; 
    gameOverOverlay.classList.add('visible'); 
    if(gameBgVideo) gameBgVideo.pause();
    
    canvas.removeEventListener('click', jump);
    document.removeEventListener('keydown', handleKeyPress);
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
    if(menuBgVideo) menuBgVideo.play().catch(e=>console.log(e));
    updateUIForUser(); // Update tên
}

function togglePause() {
    if (isGameOver) return; 
    if (!isPaused) {
        isPaused = true;
        pauseOverlay.classList.add('visible');
        if (gameBgVideo) gameBgVideo.pause();
        canvas.removeEventListener('click', jump);
        document.removeEventListener('keydown', handleKeyPress);
    } else {
        isPaused = false;
        pauseOverlay.classList.remove('visible');
        canvas.addEventListener('click', jump);
        document.addEventListener('keydown', handleKeyPress);
        if (gameBgVideo) gameBgVideo.play().catch(e=>console.log(e));
        gameLoop();
    }
}
function resumeGame() {
    if (isGameOver) return;
    if (isPaused) togglePause(); 
}

// EVENTS
playButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
resumeButton.addEventListener('click', resumeGame);
exitToMenuButton.addEventListener('click', exitGameToMenu);
retryButton.addEventListener('click', startGame); 
gameOverExitButton.addEventListener('click', exitGameToMenu);
collectionButton.addEventListener('click', () => { menuScreen.classList.remove('active'); collectionScreen.classList.add('active'); renderCollection(); });
collectionBackBtn.addEventListener('click', () => { collectionScreen.classList.remove('active'); menuScreen.classList.add('active'); });

// Render Collection function
function renderCollection() {
    // Render Birds
    birdGrid.innerHTML = '';
    BIRD_SKINS.forEach(skin => {
        const div = document.createElement('div');
        const isSelected = (skin.src === currentBirdSrc);
        div.className = `skin-item ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `<img src="${skin.src}" class="skin-img" alt="${skin.name}"><div class="skin-name">${skin.name}</div>`;
        div.onclick = () => {
            currentBirdSrc = skin.src;
            localStorage.setItem('selectedBirdSrc', skin.src); 
            assets.bird.src = skin.src; 
            renderCollection(); 
        };
        birdGrid.appendChild(div);
    });

    // Render Maps
    mapGrid.innerHTML = '';
    MAP_SKINS.forEach(skin => {
        const div = document.createElement('div');
        const isSelected = (skin.src === currentMapSrc);
        div.className = `skin-item ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `<video src="${skin.src}" class="map-preview" muted loop autoplay playsinline></video><div class="skin-name">${skin.name}</div>`;
        div.onclick = () => {
            currentMapSrc = skin.src;
            localStorage.setItem('selectedMapSrc', skin.src); 
            menuBgVideo.src = skin.src;
            gameBgVideo.src = skin.src;
            menuBgVideo.play().catch(e=>console.log(e));
            renderCollection();
        };
        mapGrid.appendChild(div);
    });
    
    // Render Pipes
    pipeGrid.innerHTML = '';
    PIPE_SKINS.forEach(skin => {
        const div = document.createElement('div');
        const isSelected = (skin.id === currentPipeId);
        div.className = `skin-item ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `<img src="${skin.bottom}" class="skin-img" style="height: 60px; object-fit: contain;"><div class="skin-name">${skin.name}</div>`;
        div.onclick = () => {
            currentPipeId = skin.id;
            localStorage.setItem('selectedPipeId', skin.id); 
            renderCollection(); 
            // reload assets for pipe
            const selectedPipe = PIPE_SKINS.find(p => p.id === currentPipeId);
            assets.pipeTop.src = selectedPipe.top;
            assets.pipeBottom.src = selectedPipe.bottom;
        };
        pipeGrid.appendChild(div);
    });
}

// INIT
window.onload = async () => {
    // Load config from localstorage
    menuBgVideo.src = currentMapSrc;
    gameBgVideo.src = currentMapSrc;
    
    // Video attributes safety check
    [menuBgVideo, gameBgVideo].forEach(vid => {
        if(vid) {
            vid.loop = true;
            vid.muted = true;
            vid.playsInline = true;
        }
    });

    await loadAssets();
    renderCollection();

    // Try play
    if(menuBgVideo) menuBgVideo.play().catch(() => console.log("User gesture needed for autoplay"));
};