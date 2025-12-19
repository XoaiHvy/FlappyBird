// ==================== AUTH & PROFILE LOGIC ====================
let usersDB = JSON.parse(localStorage.getItem('flappyUsersDB')) || [];
let currentUser = null; // Người đang đăng nhập

// DOM 
const authScreen = document.getElementById('authScreen');
const menuScreen = document.getElementById('menuScreen'); // Move up here
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUserInp = document.getElementById('loginUser');
const loginPassInp = document.getElementById('loginPass');
const regUserInp = document.getElementById('regUser');
const regPassInp = document.getElementById('regPass');
const authMessage = document.getElementById('authMessage');
// Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let GAME_WIDTH = canvas.width;
let GAME_HEIGHT = canvas.height;
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
// --- GAME MODES & LOGIC ---
let currentMode = 'normal'; // 'normal' hoặc 'crazy'
const modeScreen = document.getElementById('modeScreen');
const btnNormalMode = document.getElementById('btnNormalMode');
const btnCrazyMode = document.getElementById('btnCrazyMode');
const btnBackMode = document.getElementById('btnBackMode');
const bossWarning = document.getElementById('bossWarning');
const bossHpBar = document.getElementById('bossHpBar');
const bossHpFill = document.getElementById('bossHpFill');

// --- ITEMS CONFIG ---
let items = [];
let activeEffects = {
    shield: false,
    mini: false
};
const ITEM_TYPES = ['shield', 'bomb', 'mini'];
let lastItemSpawn = 0;

// --- BOSS CONFIG ---
let boss = null;
let bossBullets = [];
let gameTime = 0; // Đếm thời gian chơi để spawn boss
let isBossFight = false;
let bossTimer = 0; // Đếm ngược thời gian boss tồn tại
const TIME_TO_SPAWN_BOSS = 30000; // 30 giây chờ (Normal)
const TIME_TO_FIGHT_BOSS = 60000; // 60 giây đánh nhau (Boss)
let crazyModeTimer = 0;           // Biến đếm thời gian chung

// ============================================
// --- BOSS CONFIGURATION & VISUAL EDITOR ---
// ============================================

// 1. Cấu hình hình ảnh hiển thị (Visual Config) - ĐỂ CHỈNH TRÊN BẢNG SETTING
const DEFAULT_VISUAL = {
    "snake1": {
        "gap": 821,
        "yPos": 163,
        "bodyW": 900,
        "bodyH": 250,
        "bodyRot": 3,
        "headW": 560,
        "headH": 450,
        "headRot": 0,
        "headOffX": 421,
        "headOffY": 4,
        "flipped": true
    },
    "snake2": {
        "gap": 806,
        "yPos": 130,
        "bodyW": 900,
        "bodyH": 250,
        "bodyRot": 2,
        "headW": 560,
        "headH": 450,
        "headRot": 0,
        "headOffX": 452,
        "headOffY": 0,
        "flipped": true
    },
    "bigBoss": {
        "size": 734,
        "posX": 0.75,
        "posY": 0.4
    }
};

window.BOSS_VISUAL = JSON.parse(JSON.stringify(DEFAULT_VISUAL));

try {
    const raw = localStorage.getItem('flappyBossVisual');
    if (raw) {
        const parsed = JSON.parse(raw);
        // Hỗ trợ migration từ data cũ sang mới nếu cần
        if (parsed.snake1) {
            window.BOSS_VISUAL = parsed;
        } else if (parsed.snake) {
            // Data cũ: Convert sang đôi
            window.BOSS_VISUAL.snake1 = {...parsed.snake, yPos: parsed.snake.yTop || 130};
            window.BOSS_VISUAL.snake2 = {...parsed.snake, yPos: parsed.snake.yBot || 130};
            window.BOSS_VISUAL.bigBoss = parsed.bigBoss;
        }
    }
} catch (e) { console.log(e); }

window.HITBOX_CFG = {
    body: { w: 900, h: 250, dx: 0, dy: 10 },
    head: { w: 300, h: 500, dx: 10, dy: 10 },
    skill: { w: 605, h: 800, dx: 15, dy: -12 },
    player: { w: 45, h: 45, dx: 0, dy: 0 },
};

const BOSS_CFG = {
    scrollSpeed: 1.2,
    segmentCount: 30, // Khởi tạo, sẽ tự tính lại
    bounds: { yPadding: 130 }
};


// 3. Hàm kiểm tra va chạm AABB (Từ boss_logic.js)
// Lưu ý: script.js đã có rectsIntersect (có chữ 's'), 
// hàm này là rectIntersect (không 's') dùng riêng cho logic Boss để tránh lỗi.
function rectIntersect(a, b) {
    return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}

// ============================================
// --- BOSS CLASSES & LOGIC INTEGRATION ---
// ============================================

// 1. KHAI BÁO DOM/CANVAS TƯƠNG THÍCH (Bridge)
// Logic cũ dùng 2 canvas, ta ép nó dùng chung Canvas chính của Flappy Bird
let canvasBack = canvas; // Mượn canvas chính
let ctxBack = ctx;       // Mượn context chính
let canvasFront = canvas; 
let ctxFront = ctx;

// Các biến DOM Overlay (Logic cũ dùng thẻ IMG rời để xoay/scale)
// Trong Flappy Bird ta sẽ vẽ trực tiếp lên Canvas nên tạm set null để không gây lỗi logic
let domHead1 = null; 
let domHead2 = null; 
let domBoss = null; 

// 2. CLASS SNAKE HEAD (Quản lý các đoạn thân rồng)
// 1. CLASS SNAKE HEAD (ĐÃ SỬA LỖI currentScreenHeight -> GAME_HEIGHT)
class SnakeHead {
    constructor(id, gameWidth, y, direction) {
        this.id = id;
        this.direction = direction;
        this.velocity = 0;
        this.baseY = 0;
        
        // --- BIẾN MỚI: ĐỘ BAY LÊN ---
        this.liftY = 0; 
        // ---------------------------

        this.updateConfig();
        const gap = window.BOSS_VISUAL[this.id===1?'snake1':'snake2'].gap || 920; 
        this.segmentCount = Math.ceil(gameWidth / gap) + 10; 
        this.resetPosition(gameWidth);
        
        this.segments = [];
        for(let i=0; i < this.segmentCount; i++) {
            let startX = this.headX - (i * this.width * this.direction);
            this.segments.push({ idx: i, x: startX, y: this.baseY });
        }
    }
    
    updateConfig() {
        if (!window.BOSS_VISUAL) return;
        const key = (this.id === 1) ? 'snake1' : 'snake2';
        const cfg = window.BOSS_VISUAL[key];
        this.width = cfg.gap; 
        if (this.id === 1) this.baseY = cfg.yPos; else this.baseY = GAME_HEIGHT - cfg.yPos; 
    }
    
    resetPosition(gw) {
        let offset = Math.max(gw, 2000) * 1.5; 
        if (this.direction === -1) this.headX = gw + offset; else this.headX = -offset;
    }

    activate() { 
        this.isActive = true; 
        this.velocity = BOSS_CFG.scrollSpeed * this.direction; 
    }

    update(dt, currentWidth) {
        this.updateConfig();
        if (!this.isActive) return;

        // TẮT ĐẦU NẾU CẦN
        const elementId = (this.id === 1) ? 'domSnake1' : 'domSnake2';
        const domHead = document.getElementById(elementId);
        if (domHead) {
            let isOffScreen = (this.headX < -200) || (this.headX > currentWidth + 200);
            domHead.style.display = isOffScreen ? 'none' : 'block';
        }

        // DI CHUYỂN
        this.headX += this.velocity * dt;
        
        let time = Date.now() * 0.002;
        
        // --- ÁP DỤNG BIẾN LIFT Y VÀO ĐÂY ---
        // (BaseY + LiftY)
        let finalBaseY = this.baseY + this.liftY;
        this.y = finalBaseY + Math.sin(time) * 8; 
        // ----------------------------------

        // LOOP VÔ TẬN
        const gap = this.width; 
        if (this.direction === -1) { 
            if (this.headX < -gap * 2) this.headX += gap;
        } else {
            if (this.headX > currentWidth + gap * 2) this.headX -= gap;
        }

        // KÉO THÂN
        for (let i = 0; i < this.segments.length; i++) {
            let seg = this.segments[i];
            seg.x = this.headX - (i * this.width * this.direction);
            let wavePhase = (seg.x * 0.002); 
            // Áp dụng LiftY cho cả thân
            seg.y = finalBaseY + Math.sin(time + wavePhase) * 8; 
        }
    }
}

// 3. CLASS BOSS CONTROLLER (Bộ não của Boss)
class BossController {
    constructor(w, h) {
        this.width = w; this.height = h;
        this.timer = 0; 
        this.introPhase = 0; 
        this.visualHp = 0; 
        
        // Khởi tạo rắn
        this.snakes = [ new SnakeHead(1, w, 0, -1), new SnakeHead(2, w, 0, 1) ];
        this.snakes.forEach(s => { s.isActive = false; }); 

        // Big Boss Config
        const BC = window.BOSS_VISUAL.bigBoss;
        this.ghostX = w + 800; 
        this.ghostY = h * BC.posY;
        this.isLeaving = false; 
    }

    update(dt) {
        if (window.debugState.isBossFrozen) return; 
        this.timer += dt; 

        // --- LOGIC ĐIỀU KHIỂN RẮN 1 (Lên / Xuống) ---
        // 1. Bay lên: Từ giây thứ 5 (trước cảnh báo rắn dưới 1s) đến giây 13 (lúc boss ra)
        // Mục đích: Né đường cho Rắn 2 ra mắt
        if (this.timer > 5000 && this.timer < 13000) {
            // Bay lên độ cao -400 (Biến mất khỏi nóc)
            if (this.snakes[0].liftY > -400) {
                this.snakes[0].liftY -= 5; // Tốc độ bay lên
            }
        } 
        // 2. Bay về: Từ giây 13 trở đi hoặc lúc chưa đến giờ bay
        else {
            // Hạ cánh về 0 (Vị trí mặc định)
            if (this.snakes[0].liftY < 0) {
                this.snakes[0].liftY += 5; // Tốc độ hạ cánh
            }
        }
        // --------------------------------------------

        this.snakes.forEach(s => s.update(dt, this.width));

        if (this.timer < 16000) {
            this.updateIntroLogic();
        } else {
            this.updateFightLogic();
        }
    }

    updateIntroLogic() {
        const t = this.timer;

        // PHASE 1: RẮN TRÊN (0s -> 1s)
        if (t >= 0 && this.introPhase === 0) {
            showSpecificWarning('snake1');
            this.introPhase = 1;
        }
        if (t >= 1000 && this.introPhase === 1) {
            clearWarnings();
            this.snakes[0].activate(); 
            this.introPhase = 2;
        }

        // PHASE 2: RẮN DƯỚI (6s -> 7s)
        // Lưu ý: Lúc này ở hàm update(), Rắn 1 đã tự động bay lên từ giây thứ 5 rồi
        if (t >= 6000 && this.introPhase === 2) {
            showSpecificWarning('snake2');
            this.introPhase = 3;
        }
        if (t >= 7000 && this.introPhase === 3) {
            clearWarnings();
            this.snakes[1].activate(); 
            this.introPhase = 4;
        }

        // PHASE 3: BOSS TO (13s)
        if (t >= 13000 && this.introPhase === 4) {
            // Không hiện cảnh báo Boss nữa theo yêu cầu
            clearWarnings();
            
            // Hiện HP Bar
            const bar = document.getElementById('bossHpBar');
            if(bar) bar.style.opacity = '1';
            
            this.introPhase = 5; 
        }

        // Animation Boss To (13s -> 16s)
        // Lúc này Rắn 1 cũng đang tự động bay xuống (do timer > 13000)
        if (t >= 13000) {
            let targetX = this.width * window.BOSS_VISUAL.bigBoss.posX;
            // Trôi chậm
            this.ghostX += (targetX - this.ghostX) * 0.015; 
            if(this.visualHp < 100) this.visualHp += 0.55; 
        }
        
        // Hết Intro
        if (t >= 16000) {
            this.state = 'FIGHT';
            this.visualHp = 100;
        }
    }

    updateFightLogic() {
        const BC = window.BOSS_VISUAL.bigBoss;
        let targetX = this.width * BC.posX; 
        let targetY = this.height * BC.posY;

        if (!this.isLeaving) {
            // Chiến đấu: Boss rung rinh
            this.ghostX += (targetX - this.ghostX) * 0.1;
            this.ghostY += (targetY - this.ghostY) * 0.1;
        } else {
            // (Đoạn này thực tế bác đã bỏ qua việc boss bỏ chạy rồi, giữ lại để phòng hờ sau này bật lại)
            this.ghostY -= 15; 
            this.snakes.forEach(s => s.baseY -= 15);
            if (this.ghostY < -1500) { endBossFight(); }
        }
    }
    
    checkCollision(playerRect) { 
        if (this.state !== 'FIGHT' && this.timer < 13000) return false;
        
        // Copy Logic Check cũ vào đây
        for (let s of this.snakes) {
            if (!s.isActive) continue;
            const cfg = window.BOSS_VISUAL[(s.id === 1 ? 'snake1' : 'snake2')];
            const hitboxW = cfg.bodyW * 0.8; const hitboxH = cfg.bodyH * 0.8; 
            for (let seg of s.segments) {
                // Áp dụng luôn cái liftY vào hitbox
                // Note: Class SnakeHead đã cộng liftY vào seg.y rồi, nên ở đây lấy seg.y là chuẩn
                const segRect = { x: seg.x - hitboxW/2, y: seg.y - hitboxH/2, w: hitboxW, h: hitboxH };
                if (rectIntersect(playerRect, segRect)) return true;
            }
            const headW = cfg.headW * 0.6; const headH = cfg.headH * 0.6;
            const headRect = { x: s.headX - headW/2, y: s.y - headH/2, w: headW, h: headH };
            if (rectIntersect(playerRect, headRect)) return true;
        }
        if (this.state === 'FIGHT' || this.timer >= 12000) {
            const BC = window.BOSS_VISUAL.bigBoss;
            const bossSize = BC.size * 0.7; 
            const bossRect = { x: this.ghostX - bossSize/2, y: this.ghostY - bossSize/2, w: bossSize, h: bossSize };
            if (rectIntersect(playerRect, bossRect)) return true;
        }
        return false; 
    }
}
window.BossController = BossController;
// Assets giả lập (Bạn nên thay bằng ảnh thật)
const assetsExtra = {
    shield: new Image(), 
    bomb: new Image(), 
    potion: new Image(),
    boss1: new Image(), 
    boss2: new Image(),
    boss3: new Image(), 
    bullet: new Image(),

    // --- CÁC ASSETS CHO BOSS ---
    // Sửa đường dẫn src thành 'assets/images/...' để khớp với thư mục của bạn
    snakeBody: new Image(),
    bossFrame: new Image(),
    player: new Image(),   
    bossFace: new Image(), 
    bossFaceFlip: new Image()
};

// Gán đường dẫn đúng (Thêm tiền tố "assets/images/" vào trước tên file)
assetsExtra.snakeBody.src = 'assets/images/body.png';
assetsExtra.bossFrame.src = 'assets/images/BossFrame.png';
assetsExtra.player.src = 'assets/images/dragon.png';
assetsExtra.bossFace.src = 'assets/images/head.gif';
assetsExtra.bossFaceFlip.src = 'assets/images/head_flip.gif';
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

// Logic 
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

checkSession();

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

// ==================== GAME CORE LOGIC ====================

// DOM
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
    { id: 'bird_nightfury',     name: 'Night Fury',     src: 'assets/images/nightfury_bird.png', jumpSound: 'assets/audio/sfx/wingflap.mp3' },
    { id: 'bird_lightfury',     name: 'Light Fury',     src: 'assets/images/lightfury_bird.png', jumpSound: 'assets/audio/sfx/wingflap.mp3' },
    { id: 'bird_bewilderbeast', name: 'Bewilderbeast',  src: 'assets/images/bewilderbeast_bird.png', jumpSound: 'assets/audio/sfx/wingflap.mp3' },
    { id: 'bird_default',       name: 'Base Guts',       src: 'assets/images/bird.png' },
    { if: 'bird_bckx',          name: 'BCKX',           src: 'assets/images/bckx_bird.png', jumpSound: 'assets/audio/sfx/kaiaku.mp3' },
    { if: 'bird_thaidui',       name: 'Thái Dúi',       src: 'assets/images/bird_thaidui.png' }
];

const MAP_SKINS = [
    { id: 'map_eldenring',   name: 'Elden Ring',   src: 'assets/videos/eldenring_map.mp4' },
    { id: 'map_starrynight', name: 'Starry Night', src: 'assets/videos/starrynight_map.mp4', music: 'assets/audio/music/vangogh.mp3' },
    { id: 'map_city',        name: 'Night City',   src: 'assets/videos/city_map.mp4', music: 'assets/audio/music/nightcity.mp3' },
    { id: 'map_default',     name: 'Berserk',      src: 'assets/videos/game_bg.mp4' },
    { id: 'map_frozen',      name: 'Frozen Zerg',  src: 'assets/videos/frozen_map.mp4'}
];
const PIPE_SKINS = [
    { id: 'pipe_default', name: 'Corpse of Berserk', top: 'assets/images/pipe_top.png', bottom: 'assets/images/pipe_bottom.png' },
    { id: 'pipe_sword',   name: 'Sword of Truth',    top: 'assets/images/pipesword_top.png', bottom: 'assets/images/pipesword_bottom.png' },
    { id: 'pipe_ice',     name: 'Frozen Peak',       top: 'assets/images/pipeice_top.png', bottom: 'assets/images/pipeice_bottom.png' },
    { id: 'pipe_van',     name: 'Vangogh',           top: 'assets/images/pipevan_top.png', bottom: 'assets/images/pipevan_bottom.png' },
    { id: 'pipe_bckx',    name: 'BCKX',              top: 'assets/images/bckx_pipetop.png', bottom: 'assets/images/bckx_pipebottom.png' },
    { if: 'pipe_thaidui',  name: 'Thái',         top: 'assets/images/thaidui_pipetop.png', bottom: 'assets/images/thaidui_pipebottom.png' }
];
const SFX = {
    score: new Audio('assets/audio/sfx/score.mp3'),
    die: new Audio('assets/audio/sfx/die.mp3')
};
let currentBirdSrc = localStorage.getItem('selectedBirdSrc') || BIRD_SKINS[0].src;
let currentMapSrc = localStorage.getItem('selectedMapSrc') || MAP_SKINS[0].src;
let currentPipeId = localStorage.getItem('selectedPipeId') || 'pipe_default';

// --- FIX: KHAI BÁO BIẾN CÒN THIẾU ---
let currentMusicSrc = '';

// Collection DOM
const collectionScreen = document.getElementById('collectionScreen');
const collectionButton = document.getElementById('collectionButton');
const collectionBackBtn = document.getElementById('collectionBackBtn');
const birdGrid = document.getElementById('birdGrid');
const mapGrid = document.getElementById('mapGrid');
const pipeGrid = document.getElementById('pipeGrid');
// --- AUDIO SYSTEM ---
let currentBGM = new Audio();
currentBGM.loop = true;
currentBGM.volume = 0.5;
const bgMusicPlayer = new Audio();
bgMusicPlayer.loop = true;
bgMusicPlayer.volume = 0.5;
let currentJumpSoundSrc = BIRD_SKINS[0].jumpSound;


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
     // Reset thời gian game
    crazyModeTimer = 0; 
    isBossFight = false;
    boss = null;
    bossBullets = [];
    activeEffects = { shield: false, mini: false };
    if(menuBgVideo) menuBgVideo.pause();         
    if(gameBgVideo) {
        gameBgVideo.currentTime = 0; 
        gameBgVideo.play().catch(e => console.log(e));          
    }
    

    // --- SỬA ĐỔI: Phát nhạc thông qua hàm quản lý ---
    if (currentMusicSrc) {
        playBackgroundMusic(currentMusicSrc);
    }
    currentBGM.play().catch(()=>{});

    canvas.addEventListener('click', jump);
    document.addEventListener('keydown', handleKeyPress); 
    gameLoop();
}
let screenFadeAlpha = 0; // 0 = trong suốt, 1 = đen xì
const SCORE_TO_BOSS = 10; // Cột mốc gặp Boss

function resetGame() {
    birdY = GAME_HEIGHT / 2 - BIRD_HEIGHT / 2;
    birdVelocityY = 0;
    pipes = [];
    score = 0;
    scoreDisplay.textContent = `Score: ${score}`;
    lastPipeSpawnTime = 0;
    pauseOverlay.classList.remove('visible');
    gameOverOverlay.classList.remove('visible');
    items = [];
    isBossFight = false;
    boss = null;
    crazyModeTimer = 0; 
    
    // Reset hiệu ứng HP (Kiểm tra null trước cho an toàn)
    if (bossHpBar) bossHpBar.style.display = 'none';
    
    // --- KHẮC PHỤC LỖI TẠI ĐÂY ---
    // Code cũ: bossWarning.style.display = 'none'; 
    // -> Bị lỗi vì thẻ bossWarning đã bị xóa khỏi HTML.
    
    // Code mới: Dọn sạch lớp cảnh báo mới
    const warningLayer = document.getElementById('warningLayer');
    if (warningLayer) warningLayer.innerHTML = '';
    // ----------------------------

    activeEffects = { shield: false, mini: false };
    bossBullets = [];
    screenFadeAlpha = 0; 
}

function jump() {
    if (!isPaused && !isGameOver) {
        birdVelocityY = JUMP_STRENGTH;
        flapTimer = 0;
        birdAngle = MAX_UP_ANGLE;
        playJumpSound(); 
    }
}

function handleKeyPress(event) {
    // Nhảy
    if (event.code === 'Space' && !isPaused && !isGameOver) {
        jump();
    }
    // Pause bằng ESC
    if (event.code === 'Escape') {
        togglePause();
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
// --- BOSS & ITEM HELPERS ---

function spawnItem() {
    // Chỉ spawn mỗi 5 giây
    if (Date.now() - lastItemSpawn < 5000) return;
    
    // Tỉ lệ spawn: 40% (Nếu muốn ít hơn thì giảm số này)
    if (Math.random() > 0.4) { 
        lastItemSpawn = Date.now();
        return; 
    }

    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    // Random độ cao an toàn (tránh đụng trần/sàn)
    const y = 50 + Math.random() * (GAME_HEIGHT - 200); 
    
    items.push({
        type: type,
        x: GAME_WIDTH,
        y: y,
        w: 40, h: 40,
        active: true
    });
    lastItemSpawn = Date.now();
}

function updateItems() {
    // 1. Di chuyển & Lọc item
    items.forEach(it => it.x -= PIPE_SPEED); // Tốc độ bằng ống nước
    items = items.filter(it => it.x + it.w > 0 && it.active);

    // 2. Va chạm với Chim
    const birdRect = {
        x: birdX + BIRD_HITBOX_INSET.x,
        y: birdY + BIRD_HITBOX_INSET.y,
        w: BIRD_WIDTH - 2 * BIRD_HITBOX_INSET.x,
        h: BIRD_HEIGHT - 2 * BIRD_HITBOX_INSET.y
    };

    items.forEach(it => {
        const itemRect = { x: it.x, y: it.y, w: it.w, h: it.h };
        if (rectIntersect(birdRect, itemRect)) {
            // Ăn item
            it.active = false; // Đánh dấu để xóa sau
            if (it.type === 'shield') {
                activeEffects.shield = true;
                setTimeout(() => activeEffects.shield = false, 10000); // Khiên 10s
            } 
            else if (it.type === 'mini') {
                activeEffects.mini = true;
                setTimeout(() => activeEffects.mini = false, 8000); // Teo nhỏ 8s
            }
            else if (it.type === 'bomb') {
                gameOver('bomb_hit'); // <-- Truyền tham số
            }
        }
    });
}
let fadeState = 0; 

function spawnBoss() {
    if (isBossFight || boss) return;
    console.log("!!! SPAWN BOSS !!!");
    isBossFight = true;
    
    boss = new BossController(canvas.width, canvas.height);
    
    // --- CHẮC CHẮN DÒNG NÀY LÀ SỐ 0 NHÉ ---
    boss.timer = 0; 
    // --------------------------------------

    if (bossHpBar) {
        bossHpBar.style.display = 'block';
        bossHpBar.style.opacity = '0';
    }
}

function updateBoss() {
    if (!boss) return;
    boss.update(16.67);
    if (!boss) return; 

    // 2. Update HP Bar (Đã sửa lại để không cần icon GIF nữa)
    const percent = Math.max(0, Math.min(100, boss.visualHp)); 
    if(bossHpFill) bossHpFill.style.width = percent + '%';
    
    // --- SỬA LỖI TẠI ĐÂY (Thêm dòng khai báo birdRect) ---
    const birdRect = {
        x: birdX + BIRD_HITBOX_INSET.x,
        y: birdY + BIRD_HITBOX_INSET.y,
        w: BIRD_WIDTH - 2 * BIRD_HITBOX_INSET.x,
        h: BIRD_HEIGHT - 2 * BIRD_HITBOX_INSET.y
    };
    // ---------------------------------------------------

    if (boss.checkCollision(birdRect)) {
        if (activeEffects.shield) {
            activeEffects.shield = false; 
        } else {
            gameOver('boss_collision');
        }
    }
}

function endBossFight() {
    console.log("--- BOSS FIGHT ENDED ---");
    isBossFight = false;
    boss = null;
    bossBullets = [];
    crazyModeTimer = 0; // Reset vòng lặp boss
    bossHpBar.style.display = 'none';
}
function update() {
    if (isPaused || isGameOver) return;
    
    // --- 1. LOGIC VẬT LÝ CHIM ---
    birdVelocityY += GRAVITY;
    birdY += birdVelocityY;
    const velocityTargetAngle = Math.max(Math.min(birdVelocityY * 7, MAX_DOWN_ANGLE), MAX_UP_ANGLE);
    birdAngle += (velocityTargetAngle - birdAngle) * ANGLE_LERP;
    flapTimer += 16.67;
   
    if (birdY < 0) { 
        if (!window.debugState?.isGodMode) { gameOver('bound_hit'); return; } 
        else { birdY = 0; birdVelocityY = 0; } 
    } 
    if (birdY + BIRD_HEIGHT > GAME_HEIGHT) { 
        if (!window.debugState?.isGodMode) { gameOver('bound_hit'); return; } 
        else { birdY = GAME_HEIGHT - BIRD_HEIGHT; birdVelocityY = 0; } 
    }
    gameTime += 16.67;

    // --- 2. LOGIC CỘT (Ngừng spawn khi đủ điểm) ---
    const allowSpawnPipes = !isBossFight && (!boss) && (score < SCORE_TO_BOSS);
    if (allowSpawnPipes && Date.now() - lastPipeSpawnTime > PIPE_SPAWN_INTERVAL) {
        spawnPipe(); lastPipeSpawnTime = Date.now();
    }

    let isTransitionPhase = (currentMode === 'crazy') && (score >= SCORE_TO_BOSS) && (!boss);
    const birdRect = { x: birdX + BIRD_HITBOX_INSET.x, y: birdY + BIRD_HITBOX_INSET.y, w: BIRD_WIDTH - 2 * BIRD_HITBOX_INSET.x, h: BIRD_HEIGHT - 2 * BIRD_HITBOX_INSET.y };

    for (let i = 0; i < pipes.length; i++) {
        let pipe = pipes[i];
        pipe.x -= PIPE_SPEED;
        // Rút cột đi chỗ khác
        if (isTransitionPhase) { if (pipe.type === 'top') pipe.y -= 5; else pipe.y += 5; }

        const pipeRect = { x: pipe.x + PIPE_HITBOX_INSET.x, y: pipe.y + PIPE_HITBOX_INSET.y, w: pipe.width - 2 * PIPE_HITBOX_INSET.x, h: pipe.height - 2 * PIPE_HITBOX_INSET.y };
        let isSafeToPass = (pipe.type === 'top' && pipe.y + pipe.height < 0) || (pipe.type === 'bottom' && pipe.y > GAME_HEIGHT);

        if (!isSafeToPass && rectIntersect(birdRect, pipeRect)) {
            if (activeEffects.shield) { activeEffects.shield = false; pipes.splice(i, 1); i--; continue; } else { gameOver('pipe_hit'); return; }
        }
        if (!pipe.passed && pipe.x + pipe.width < birdX) { 
            pipe.passed = true; 
            if (pipe.type === 'bottom') { score++; scoreDisplay.textContent = `Score: ${score}`; SFX.score.currentTime = 0; SFX.score.play(); } 
        }
    }
    pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);

    // --- 3. LOGIC CRAZY MODE & BOSS SCENE ---
    if (currentMode === 'crazy') {
        crazyModeTimer += 16.67;
        
        // Item
        if (!isBossFight && score < SCORE_TO_BOSS) spawnItem();
        updateItems();

        // 3a. BẮT ĐẦU CHUYỂN CẢNH: Màn hình Tối dần
        if (!isBossFight && score >= SCORE_TO_BOSS && !boss && fadeState === 0) {
             fadeState = 1; // Vào trạng thái 1
        }

        // 3b. STATE 1: Fade Black (0 -> 1)
        if (fadeState === 1) {
            screenFadeAlpha += 0.01; 
            if (screenFadeAlpha >= 1) {
                screenFadeAlpha = 1;
                // Khi đã đen thui:
                // 1. Tắt nền cũ, chuẩn bị nền mới (nhưng chưa hiện)
                if(gameBgVideo) gameBgVideo.style.display = 'none';
                const bv = document.getElementById('bossVideo');
                if(bv) { bv.style.display = 'block'; bv.style.opacity = '0'; bv.play().catch(()=>{}); } 

                // 2. Gọi Boss ra (Timer = 0 -> Nó sẽ chạy Intro: Rắn 1 -> Rắn 2)
                spawnBoss();
                
                // 3. Chuyển sang State 2: Chờ Intro chạy
                fadeState = 2;
            }
        }

        // 3c. STATE 2: Bóng Đêm (Rắn con chạy trên nền đen)
        if (fadeState === 2 && boss) {
            // Theo dõi đồng hồ của Boss
            // BossController.updateIntroLogic() quy định giây thứ 13 là Boss To ra.
            // Nên ta chờ đến 12.5s thì bắt đầu làm sáng màn hình dần là vừa đẹp.
            if (boss.timer >= 12500) {
                fadeState = 3; 
            }
        }
        
        // 3d. STATE 3: Màn hình Sáng lại (Fade In)
        if (fadeState === 3) {
            screenFadeAlpha -= 0.01; // Giảm màu đen
            if (screenFadeAlpha < 0) screenFadeAlpha = 0;

            // Đồng thời hiện Video nền Boss lên
            const bv = document.getElementById('bossVideo');
            if (bv) {
                let currentOp = parseFloat(bv.style.opacity || 0);
                if (currentOp < 1) bv.style.opacity = (currentOp + 0.01).toString();
            }

            // Và hiện thanh máu lên
            if (bossHpBar) {
                 let currentOp = parseFloat(bossHpBar.style.opacity || 0);
                 if (currentOp < 1) bossHpBar.style.opacity = (currentOp + 0.01).toString();
            }

            if (screenFadeAlpha <= 0) {
                fadeState = 4; // Hoàn tất Intro
            }
        }

        // LUÔN UPDATE BOSS
        if (boss) updateBoss();
    }
}
function playMusic(src) {
    // Nếu bài nhạc mới trùng bài cũ thì không làm gì cả (để nhạc chạy tiếp)
    // Nhưng nếu bài mới khác bài cũ, thì đổi bài.
    if (currentBGM.src.includes(src)) {
        if (currentBGM.paused) currentBGM.play().catch(()=>{});
        return;
    }

    currentBGM.src = src;
    currentBGM.play().catch(error => console.log("Chưa tương tác nên chưa phát nhạc: ", error));
}
function playBackgroundMusic(src) {
    if (!src) return; 

    // Nếu bài mới trùng bài cũ -> Chỉ resume nếu đang pause
    if (bgMusicPlayer.src.includes(src)) {
        if (bgMusicPlayer.paused) {
            bgMusicPlayer.play().catch(e => console.log("Chờ tương tác..."));
        }
        return;
    }

    // Nếu là bài khác -> Tắt bài cũ, nạp bài mới
    bgMusicPlayer.pause();
    bgMusicPlayer.currentTime = 0;
    bgMusicPlayer.src = src;
    bgMusicPlayer.play().catch(e => console.log("Chờ tương tác..."));
}

function stopBackgroundMusic() {
    bgMusicPlayer.pause();
    bgMusicPlayer.currentTime = 0;
}

// Hàm phát tiếng nhảy
function playJumpSound() {
    const sound = new Audio(currentJumpSoundSrc);
    sound.volume = 0.6;
    sound.play().catch(()=>{});
}
// Hàm phát tiếng nhảy (Tạo bản sao để nhảy liên tục không bị ngắt)
function playJumpSound() {
    const sound = new Audio(currentJumpSoundSrc);
    sound.volume = 0.6;
    sound.play().catch(()=>{});
}
function drawRotated(ctx, img, x, y, w, h, angle) {
    if (!img) return; // Nếu ảnh chưa tải xong thì bỏ qua
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -w/2, -h/2, w, h);
    ctx.restore();
}
function draw() {
    // 1. Xóa sạch và lấy DOM cần thiết
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const domS1 = document.getElementById('domSnake1');
    const domS2 = document.getElementById('domSnake2');
    const domBB = document.getElementById('domBigBoss');
    const allDoms = [domS1, domS2, domBB];

    if (!isPaused && !boss && !isBossFight) { 
        allDoms.forEach(d => { if(d) d.style.display = 'none'; }); 
    }

    // --- LỚP 1: VẼ ỐNG (Sẽ chìm trong bóng tối) ---
    for (let i = 0; i < pipes.length; i++) {
        let p = pipes[i];
        if (p.type === 'top') ctx.drawImage(assets.pipeTop, p.x, p.y, p.width, p.height);
        else ctx.drawImage(assets.pipeBottom, p.x, p.y, p.width, p.height);
    }
    
    // --- LỚP 2: VẼ MÀN HÌNH ĐEN (VẼ Ở ĐÂY ĐỂ CHE ỐNG NHƯNG KHÔNG CHE BOSS) ---
    if (currentMode === 'crazy' && screenFadeAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${screenFadeAlpha})`; 
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // --- LỚP 3: ITEMS & BOSS (NỔI TRÊN NỀN ĐEN) ---
    if (currentMode === 'crazy') {
        items.forEach(it => {
            if (it.type === 'shield') ctx.fillStyle = 'cyan'; else if (it.type === 'bomb') ctx.fillStyle = 'red'; else ctx.fillStyle = 'green';
            ctx.fillRect(it.x, it.y, it.w, it.h);
        });
    }

    // Logic Boss
    if (currentMode === 'crazy' && boss && boss.snakes) {
        // A. Rắn con
        boss.snakes.forEach(s => {
             if (!s.isActive) return;
             const cfg = window.BOSS_VISUAL[(s.id === 1 ? 'snake1' : 'snake2')];
             
             // --- VẼ THÂN (Lúc này background đã bị tô đen, nên thân vẽ ở đây sẽ NỔI LÊN) ---
             const radBody = cfg.bodyRot * (Math.PI / 180);
             if (assetsExtra.snakeBody) {
                s.segments.forEach(seg => { drawRotated(ctx, assetsExtra.snakeBody, seg.x, seg.y, cfg.bodyW, cfg.bodyH, radBody); });
             }
             
             // Vẽ Đầu Rắn (DOM - Luôn nổi)
             let domImg = (s.id === 1) ? domS1 : domS2;
             if (domImg) { 
                 domImg.style.display = 'block'; 
                 domImg.style.width = cfg.headW+'px'; domImg.style.height = cfg.headH+'px';
                 let hx = s.headX - cfg.headW/2; 
                 if (s.id===1) hx-=cfg.headOffX; else hx+=cfg.headOffX;
                 let hy = s.y - cfg.headH/2 + cfg.headOffY; 
                 domImg.style.left=hx+'px'; domImg.style.top=hy+'px';
                 domImg.style.transform = `scaleX(${cfg.flipped?-1:1}) rotate(${cfg.headRot}deg)`;
             }
        });

        // B. BOSS TO (DOM HEAD) - 13s mới hiện
        // Chỉ hiện khi timer > 12s (sớm hơn xíu cho chắc)
        if (boss.timer >= 12000) { 
             if(domBB) {
                 const BC = window.BOSS_VISUAL.bigBoss;
                 domBB.style.display = 'block'; 
                 domBB.style.width = BC.size + 'px'; 
                 domBB.style.height = BC.size + 'px';
                 domBB.style.left = (boss.ghostX - BC.size/2) + 'px'; 
                 domBB.style.top = (boss.ghostY - BC.size/2) + 'px';
                 let swayDeg = Math.sin(Date.now()/500)*5; 
                 domBB.style.transform = `rotate(${swayDeg}deg)`;
             }
        } else {
             if(domBB) domBB.style.display = 'none';
        }
    } 

    // --- LỚP 4: VẼ CHIM (Trên cùng) ---
    ctx.save();
    let scaleEffect = activeEffects.mini ? 0.5 : 1; 
    const cx = birdX + (BIRD_WIDTH * scaleEffect) / 2;
    const cy = birdY + (BIRD_HEIGHT * scaleEffect) / 2;
    ctx.translate(cx, cy); ctx.rotate((birdAngle * Math.PI) / 180);
    
    let scaleX = 1, scaleY = 1;
    if (flapTimer < FLAP_DURATION) {
        let t = flapTimer / FLAP_DURATION; let ease = 1 - Math.pow(1 - t, 2);
        scaleX = 1 + (FLAP_SCALE_X - 1) * (1 - ease); scaleY = 1 - (1 - FLAP_SCALE_Y) * (1 - ease);
    }
    let finalScale = activeEffects.mini ? 0.5 : 1;
    ctx.scale(scaleX * finalScale, scaleY * finalScale);
    ctx.drawImage(assets.bird, -BIRD_WIDTH/2, -BIRD_HEIGHT/2, BIRD_WIDTH, BIRD_HEIGHT);
    ctx.restore();

    if (activeEffects.shield) {
        ctx.strokeStyle = 'cyan'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(birdX + BIRD_WIDTH/2, birdY + BIRD_HEIGHT/2, 40, 0, Math.PI*2); ctx.stroke();
    }
}


function gameLoop() {
    if (!gameRunning) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// UPDATE: GAMEOVER LOGIC MỚI
function gameOver(cause = 'unknown') {
    if (window.debugState && window.debugState.isGodMode) {
        console.log(`[GOD MODE] Chặn chết do: ${cause}`);
        return; // Hủy lệnh chết ngay lập tức
    }
    if (isGameOver) return; // Chặn gọi 2 lần liên tiếp
    
    console.log(`GAME OVER! Nguyên nhân: ${cause}`); // Debug xem chết vì gì

    isGameOver = true;
    gameRunning = false; 
    
    // --- 1. CẬP NHẬT DỮ LIỆU NGƯỜI DÙNG ---
    if (currentUser) {
        // Tăng tổng số game đã chơi
        currentUser.totalGames = (currentUser.totalGames || 0) + 1;
        
        // Kiểm tra kỷ lục
        if (score > currentUser.highScore) {
            currentUser.highScore = score;
            newRecordMsg.style.display = 'block'; 
            newRecordMsg.innerText = "NEW RECORD!";
        } else {
            newRecordMsg.style.display = 'none';
        }
        
        // Lưu vào LocalStorage
        saveUsers();
        
        // Hiển thị ra UI ngay lập tức
        if(finalBestScoreDisplay) finalBestScoreDisplay.textContent = currentUser.highScore;
        // Cập nhật Profile Screen nếu đang mở ẩn
        if(profileGames) profileGames.textContent = currentUser.totalGames;
    }
    // ----------------------------------------

    stopBackgroundMusic();
    
    SFX.die.play();
    finalScoreDisplay.textContent = score; 
    gameOverOverlay.classList.add('visible'); 
    
    if(gameBgVideo) gameBgVideo.pause();
    
    canvas.removeEventListener('click', jump);
    document.removeEventListener('keydown', handleKeyPress);
}
function exitGameToMenu() {
    // 1. Reset cờ trạng thái game cơ bản
    gameRunning = false;
    isPaused = false;
    isGameOver = false;
    
    // 2. Dọn dẹp dữ liệu vòng chơi cũ
    pipes = [];
    canvas.removeEventListener('click', jump);
    document.removeEventListener('keydown', handleKeyPress);
    
    // 3. --- QUAN TRỌNG: RESET TRẠNG THÁI BOSS & CRAZY MODE ---
    boss = null;           // Xóa đối tượng BossController
    isBossFight = false;   // Tắt cờ đánh nhau
    crazyModeTimer = 0;    // Reset bộ đếm giờ
    bossBullets = [];      // Xóa đạn boss
    items = [];            // Xóa vật phẩm bay
    
    // Reset hiệu ứng HP và Cảnh báo DOM
    if (bossHpBar) bossHpBar.style.display = 'none';
    if (bossWarning) bossWarning.style.display = 'none';
    
    // Reset hiệu ứng nhân vật
    activeEffects = { shield: false, mini: false };
    // ---------------------------------------------------------

    stopBackgroundMusic(); 

    // 4. Chuyển màn hình về Menu
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
    if(menuBgVideo) menuBgVideo.play().catch(e=>console.log(e));
    updateUIForUser(); 
}

function togglePause() {
    if (isGameOver) return; 
    if (!isPaused) {
        // --- PAUSE ---
        isPaused = true;
        pauseOverlay.classList.add('visible');
        if (gameBgVideo) gameBgVideo.pause();
        
        bgMusicPlayer.pause(); // Dùng biến chuẩn bgMusicPlayer
        
        canvas.removeEventListener('click', jump);
        document.removeEventListener('keydown', handleKeyPress);
    } else {
        // --- RESUME ---
        isPaused = false;
        pauseOverlay.classList.remove('visible');
        canvas.addEventListener('click', jump);
        
        bgMusicPlayer.play().catch(()=>{}); // Dùng biến chuẩn bgMusicPlayer
        
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
playButton.addEventListener('click', () => {
    menuScreen.classList.remove('active');
    modeScreen.classList.add('active');
});

// Nút chọn NORMAL
btnNormalMode.addEventListener('click', () => {
    currentMode = 'normal';
    startGame();
});

// Nút chọn CRAZY
btnCrazyMode.addEventListener('click', () => {
    currentMode = 'crazy';
    startGame();
});

btnBackMode.addEventListener('click', () => {
    modeScreen.classList.remove('active');
    menuScreen.classList.add('active');
});
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
            if (skin.jumpSound) {
        currentJumpSoundSrc = skin.jumpSound; // Cập nhật tiếng nhảy ngay
        console.log("Đã đổi tiếng nhảy: " + skin.jumpSound);
    }
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
              if (skin.music) {
        currentMusicSrc = skin.music;
        // Kiểm tra để không load lại nếu bài nhạc giống hệt bài cũ
        if (!bgMusicPlayer.src.includes(skin.music)) {
            bgMusicPlayer.src = skin.music;
            bgMusicPlayer.play().catch(e => console.log("Chờ click để phát nhạc"));
        }
    }
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
     const selectedMap = MAP_SKINS.find(s => s.src === currentMapSrc);
    if (selectedMap && selectedMap.music) {
        currentMusicSrc = selectedMap.music; // Lưu vào biến, chưa phát vội
    }
    
    const selectedBird = BIRD_SKINS.find(s => s.src === currentBirdSrc);
    if (selectedBird && selectedBird.jumpSound) {
        currentJumpSoundSrc = selectedBird.jumpSound;
    }
     const savedMap = MAP_SKINS.find(s => s.src === currentMapSrc);
    if (savedMap && savedMap.music) {
        bgMusicPlayer.src = savedMap.music;
        // Lưu ý: Trình duyệt có thể chặn tự phát nhạc, nên ta sẽ phát nó ở hàm startGame
    }

    // --- 2. KHÔI PHỤC TIẾNG NHẢY ---
    // Tìm chim đang chọn dựa trên src đã lưu
    const savedBird = BIRD_SKINS.find(s => s.src === currentBirdSrc);
    if (savedBird && savedBird.jumpSound) {
        currentJumpSoundSrc = savedBird.jumpSound;
    }

    await loadAssets();
    renderCollection();

    // Try play
    if(menuBgVideo) menuBgVideo.play().catch(() => console.log("User gesture needed for autoplay"));
};
// ============================================
// --- DEBUG & TUNING TOOLS (LOGIC CUỐI CÙNG) ---
// ============================================

// 1. Quản lý trạng thái Debug
window.debugState = {
    isDrawingHitboxes: false,
    isGodMode: false,
    isBossFrozen: false // Đảm bảo cái này là false
};

// 2. Hàm Toggle Panel
window.toggleDebugPanel = function() {
    const p = document.getElementById('debugPanel');
    if (p.style.display === 'none') {
        p.style.display = 'block';
        window.updateDebugInputs(); // Load giá trị hiện tại vào input
    } else {
        p.style.display = 'none';
    }
};

// 3. Logic Hitbox Tuning (Editor)
window.updateDebugInputs = function() {
    const part = document.getElementById('selHbPart').value;
    const cfg = window.HITBOX_CFG[part];
    if (cfg) {
        document.getElementById('inp_w').value = cfg.w;
        document.getElementById('inp_h').value = cfg.h;
        document.getElementById('inp_dx').value = cfg.dx;
        document.getElementById('inp_dy').value = cfg.dy;
    }
};

window.applyHitboxChange = function() {
    const part = document.getElementById('selHbPart').value;
    if (window.HITBOX_CFG[part]) {
        window.HITBOX_CFG[part].w = parseFloat(document.getElementById('inp_w').value);
        window.HITBOX_CFG[part].h = parseFloat(document.getElementById('inp_h').value);
        window.HITBOX_CFG[part].dx = parseFloat(document.getElementById('inp_dx').value);
        window.HITBOX_CFG[part].dy = parseFloat(document.getElementById('inp_dy').value);
    }
};

// 4. Hook vào hàm draw() để vẽ Hitbox nếu bật
// Chúng ta sẽ "Monkey Patch" (Ghi đè nhẹ) hàm draw để thêm lớp vẽ debug sau cùng
const originalDraw = draw; // Lưu hàm draw cũ
draw = function() {
    originalDraw(); // Gọi logic vẽ game bình thường
    
    // Vẽ lớp Debug đè lên trên cùng
    if (window.debugState.isDrawingHitboxes && window.BossController) {
        if (!boss || !boss.snakes) return;
        
        ctx.save();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;

        const cfg = window.HITBOX_CFG;
        const hbBody = cfg.body;
        const hbHead = cfg.head;

        // Vẽ Hitbox Thân & Đầu Rắn
        boss.snakes.forEach(s => {
            if (!s.isActive) return;
            // Thân
            s.segments.forEach(seg => {
                let rx = seg.x + hbBody.dx - hbBody.w/2;
                let ry = seg.y + hbBody.dy - hbBody.h/2;
                ctx.strokeRect(rx, ry, hbBody.w, hbBody.h);
            });
            // Đầu (tính toán lại y hệt logic collision)
            let hOffX = -50; 
            let hx = (s.headX !== undefined) ? s.headX : s.segments[0].x;
            if (s.id === 1) hx += hOffX; else hx -= hOffX;
            let hy = s.y;
            // (Đoạn này phải khớp logic BossController checkCollision)
            let headDx = (s.direction === -1) ? hbHead.dx : -hbHead.dx;
            // Vẽ
            let headRx = hx + headDx - hbHead.w/2;
            let headRy = hy + hbHead.dy - hbHead.h/2; 
            // Lưu ý: Logic draw collision phức tạp hơn xíu vì head flip, vẽ tạm để tham khảo
            ctx.strokeRect(headRx, headRy, hbHead.w, hbHead.h);
        });

        // Vẽ Hitbox Ghost (Skill)
        if (boss.events && (boss.events.enter || boss.state==='FIGHT')) {
             const hbSkill = cfg.skill;
             let gx = boss.ghostX + hbSkill.dx - hbSkill.w/2;
             let gy = boss.ghostY + hbSkill.dy - hbSkill.h/2;
             ctx.strokeStyle = 'cyan';
             ctx.strokeRect(gx, gy, hbSkill.w, hbSkill.h);
        } 
        // Vẽ Hitbox Player
        ctx.strokeStyle = 'lime';
        const pCfg = cfg.player;
        ctx.strokeRect(birdX + pCfg.dx, birdY + pCfg.dy, pCfg.w, pCfg.h);

        ctx.restore();
    }
};

// Console Log hướng dẫn
console.log("%c DEBUG TOOLS LOADED", "color: #0f0; background: #000; font-size: 14px; padding: 5px;");
console.log("Gõ lệnh: window.toggleDebugPanel() để mở bảng điều chỉnh Hitbox/Boss.");
// ============================================
// --- KEYBOARD DEBUG SHORTCUTS (Tab, G, H) ---
// ============================================

// Tạo một thẻ div để hiện thông báo nhanh khi bấm phím
const toastDiv = document.createElement('div');
toastDiv.style.cssText = `
    position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.7); color: lime; padding: 10px 20px;
    font-family: monospace; font-size: 1.5em; border: 1px solid lime;
    border-radius: 5px; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 10000;
`;
document.body.appendChild(toastDiv);

let toastTimer = null;
function showStatus(msg, color = 'lime') {
    toastDiv.innerText = msg;
    toastDiv.style.color = color;
    toastDiv.style.borderColor = color;
    toastDiv.style.opacity = '1';
    
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastDiv.style.opacity = '0'; }, 2000);
}
function showSpecificWarning(type) {
    const layer = document.getElementById('warningLayer');
    if (!layer) return;
    // Không xoá warning cũ để có thể hiện đè nếu muốn, 
    // nhưng theo kịch bản này là hiện từng cái nên xoá trước cũng dc
    layer.innerHTML = ''; 

    // Config
    const VIS = window.BOSS_VISUAL;
    const S1 = VIS.snake1;
    const S2 = VIS.snake2;
    const BB = VIS.bigBoss;

    let div = document.createElement('div');
    div.className = 'danger-zone';

    if (type === 'snake1') {
        // Cảnh báo rắn trên
        div.style.top = (S1.yPos - S1.headH/2) + 'px';
        div.style.height = S1.headH + 'px';
    } else if (type === 'snake2') {
        // Cảnh báo rắn dưới
        let y2 = (GAME_HEIGHT - S2.yPos) - S2.headH/2;
        div.style.top = y2 + 'px';
        div.style.height = S2.headH + 'px';
    } else if (type === 'boss') {
        // Cảnh báo Boss To
        let by = GAME_HEIGHT * BB.posY;
        div.style.top = (by - BB.size/2) + 'px';
        div.style.height = BB.size + 'px';
        
        // Thêm chữ "BOSS" cho nguy hiểm
        div.innerHTML = `<span style="color:red; font-size:3em; font-weight:bold; text-shadow:0 0 10px #000;">⚠️ MEGA BOSS ⚠️</span>`;
    }
    
    layer.appendChild(div);
}

function clearWarnings() {
    const layer = document.getElementById('warningLayer');
    if(layer) layer.innerHTML = '';
}
// Lắng nghe sự kiện bàn phím
document.addEventListener('keydown', (e) => {
    // 1. Phím TAB: Bật/Tắt Bảng Debug
    if (e.code === 'Tab') {
        e.preventDefault(); // Chặn việc chuyển ô input
        if (typeof window.toggleDebugPanel === 'function') {
            window.toggleDebugPanel();
        }
    }

    // 2. Phím G: GOD MODE
    if (e.code === 'KeyG') {
        // Đảo ngược trạng thái
        window.debugState.isGodMode = !window.debugState.isGodMode;
        
        // Đồng bộ với checkbox trong bảng (nếu bảng đang mở)
        const cb = document.getElementById('chkGodMode');
        if (cb) cb.checked = window.debugState.isGodMode;

        // Hiện thông báo
        if (window.debugState.isGodMode) showStatus("🛡️ GOD MODE: ON", "gold");
        else showStatus("🛡️ GOD MODE: OFF", "#ccc");
    }

    // 3. Phím H: SHOW HITBOX
    if (e.code === 'KeyH') {
        // Đảo ngược trạng thái
        window.debugState.isDrawingHitboxes = !window.debugState.isDrawingHitboxes;
        
        // Đồng bộ với checkbox trong bảng
        const cb = document.getElementById('chkDrawHitboxes');
        if (cb) cb.checked = window.debugState.isDrawingHitboxes;

        // Hiện thông báo
        if (window.debugState.isDrawingHitboxes) showStatus("⚡ HITBOX: ON", "red");
        else showStatus("⚡ HITBOX: OFF", "#ccc");
    }
});