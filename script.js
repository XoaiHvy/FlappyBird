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
function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
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

        this.updateConfig(); // Load config trước để có biến width

        // QUAN TRỌNG: Tự động tính số đốt sao cho dài hơn màn hình 20%
        // Để khi rắn trôi qua, màn hình lúc nào cũng đầy thân rắn
        // +10 là để trừ hao cho các đoạn cong lượn sóng
        const gap = window.BOSS_VISUAL[this.id===1?'snake1':'snake2'].gap || 920; // fallback tránh lỗi
        this.segmentCount = Math.ceil(gameWidth / gap) + 10; 

        // Đặt vị trí ban đầu (Lùi lại một chút để không thấy đuôi lúc đầu)
        this.resetPosition(gameWidth);
        
        // Tạo đốt ngay
        this.segments = [];
        for(let i=0; i < this.segmentCount; i++) {
            let startX = this.headX - (i * this.width * this.direction);
            this.segments.push({ idx: i, x: startX, y: this.baseY });
        }
    }
    
    updateConfig() {
        if (!window.BOSS_VISUAL) return;
        // Lấy đúng key snake1 hoặc snake2
        const key = (this.id === 1) ? 'snake1' : 'snake2';
        const cfg = window.BOSS_VISUAL[key];
        
        this.width = cfg.gap; 
        
        // Logic Y chuẩn: ID 1 tính từ trên xuống, ID 2 từ dưới lên
        if (this.id === 1) this.baseY = cfg.yPos; 
        else this.baseY = GAME_HEIGHT - cfg.yPos; 
    }
    
    resetPosition(gw) {
        // Đẩy thật xa (Gấp 5 lần độ rộng màn hình)
        // Nếu màn hình 1920px -> đẩy ra 9000px
        let offset = Math.max(gw, 2000) * 1.5; 
        if (this.direction === -1) this.headX = gw + offset; 
        else this.headX = -offset;
    }

    activate() { 
        this.isActive = true; 
        this.velocity = BOSS_CFG.scrollSpeed * this.direction; 
    }

    update(dt, currentWidth) {
        this.updateConfig();
        if (!this.isActive) return;

        // --- 1. CHO ĐẦU HIỆN TRỞ LẠI ---
        const elementId = (this.id === 1) ? 'domSnake1' : 'domSnake2';
        const domHead = document.getElementById(elementId);
        
        // --- 2. LOGIC DI CHUYỂN CHUẨN (KHÔNG CHẶN ĐƯỜNG NỮA) ---
        // Cho rắn bay tự do theo vận tốc, không check if/else cản đường ở đây
        this.headX += this.velocity * dt;
        
        let time = Date.now() * 0.002;
        // Logic Y cơ bản (lên xuống)
        this.y = this.baseY + Math.sin(time) * 8; 

        // --- 3. LOGIC "BĂNG CHUYỀN" VÔ TẬN (SỬA LẠI) ---
        // Thay vì đợi hết cả con rắn (dài ngoằng) mới reset -> Gây hổng lỗ toác
        // Ta sẽ reset "Cuộn tròn" ngay khi cái đầu đi khuất màn hình bên kia
        
        const gap = this.width; // Khoảng cách giữa các đốt (thường là 900px)

        if (this.direction === -1) { 
            // SNAKE 1: Bay sang TRÁI (Top)
            // Khi cái đầu rắn đã đi khuất hẳn màn hình bên trái (xa hơn 2 lần gap để chắc chắn)
            // Ta dịch nó lùi lại 1 đoạn đúng bằng 1 đốt (gap) về phía phải
            // => Giúp rắn trông như trôi vô tận mà đầu vẫn luôn ở ngoài màn hình
            if (this.headX < -gap * 2) {
                 this.headX += gap;
            }
        } else {
            // SNAKE 2: Bay sang PHẢI (Bot)
            // Tương tự, khi đi quá lố bên phải -> giật lùi lại bên trái 1 đốt
            if (this.headX > currentWidth + gap * 2) {
                 this.headX -= gap;
            }
        }

        // --- 4. KÉO THÂN THEO ĐẦU ---
        // (Tính lại tọa độ Y cho uốn lượn)
        for (let i = 0; i < this.segments.length; i++) {
            let seg = this.segments[i];
            seg.x = this.headX - (i * this.width * this.direction);
            
            // Nếu muốn rắn uốn lượn đều mà không bị giật khi reset đầu
            // Ta tính góc pha dựa trên vị trí X thực tế thay vì index i
            // (Mẹo này giúp sóng không bị đứt đoạn)
            let wavePhase = (seg.x * 0.002); 
            seg.y = this.baseY + Math.sin(time + wavePhase) * 8; 
        }
        
        // --- 5. TẮT HEAD (NẾU CẦN) ---
        // Sau khi Intro xong (đầu rắn đã đi qua màn hình), bác có thể muốn ẩn cái đầu to đi
        // để trông giống con rồng vô tận hơn. Nếu muốn giữ đầu thì xóa dòng if này đi.
        // Logic: Nếu đầu rắn nằm ngoài vùng nhìn thấy -> ẩn nó đi cho đỡ rác DOM
        if (domHead) {
            let isOffScreen = (this.headX < -200) || (this.headX > currentWidth + 200);
            domHead.style.display = isOffScreen ? 'none' : 'block';
        }
    }
}

// 3. CLASS BOSS CONTROLLER (Bộ não của Boss)
class BossController {
    constructor(w, h) {
        this.state = 'INTRO'; this.timer = 0; this.visualHp = 0; this.introOpacity = 1; 
        this.shake = { x: 0, y: 0, force: 0 }; 
        this.events = { s1: false, s2: false, ghostEnter: false, rev: false };
        this.width = w; this.height = h;
        
        this.snakes = [ new SnakeHead(1, w, 0, -1), new SnakeHead(2, w, 0, 1) ];
        // Khởi tạo Boss To theo đúng Config ngay từ đầu
        const BC = window.BOSS_VISUAL.bigBoss;
        this.ghostX = w * 1.5; // Xa màn hình lúc intro
        this.ghostY = h * BC.posY;
    }

    update(dt) {
        if (window.debugState.isBossFrozen) return; 
        if (this.shake.force > 0) { this.shake.x = (Math.random()-0.5)*this.shake.force; this.shake.y = (Math.random()-0.5)*this.shake.force; this.shake.force*=0.95; } 
        else { this.shake.x=0; this.shake.y=0; }

        if (this.state === 'INTRO') this.updateIntro(dt); 
        else this.updateFight(dt);

        this.snakes.forEach(s => s.update(dt, this.width));
    }

    updateIntro(dt) {
        this.timer += dt; let t = this.timer;
        if (t > 100 && !this.events.s1) { this.events.s1=true; this.snakes[0].activate(); this.shake.force=12; }
        if (t > 2000 && !this.events.s2) { this.events.s2=true; this.snakes[1].activate(); this.shake.force=12; }
        
        // Boss Bay Vào
        if (t > 5000) { // Intro ngắn lại chút cho nhanh test
            if (!this.events.ghostEnter) this.events.ghostEnter = true; 
            
            // --- LOGIC BOSS TO FIX ---
            // Lấy đích đến TỪ CONFIG (Pos X)
            let targetX = this.width * window.BOSS_VISUAL.bigBoss.posX;
            // Di chuyển tới đích
            this.ghostX += (targetX - this.ghostX) * 0.05;
        }
        if (t > 8000) { this.state = 'FIGHT'; this.visualHp = 100; }
    }

    updateFight(dt) {
        // --- LOGIC BOSS FIGHT CHUẨN ---
        // Trong Editor bạn chỉnh Pos X/Y -> Game phải tuân thủ tuyệt đối
        const BC = window.BOSS_VISUAL.bigBoss;
        
        let targetX = this.width * BC.posX; // Đích X theo Config
        let targetY = this.height * BC.posY; // Đích Y theo Config
        
        // Easing move (Trôi nhẹ tới đích)
        this.ghostX += (targetX - this.ghostX) * 0.1;
        this.ghostY += (targetY - this.ghostY) * 0.1;
    }
    
    // ... (Giữ nguyên checkCollision không thay đổi)
    checkCollision(playerRect) { 
        if (this.state !== 'FIGHT') return false;
        // Copy lại logic collision cũ của bạn ở đây...
        return false; // Tạm tắt death để test vị trí (Bật lại sau khi xong visual)
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

function resetGame() {
    birdY = GAME_HEIGHT / 2 - BIRD_HEIGHT / 2;
    birdVelocityY = 0;
    pipes = [];
    score = 0;
    scoreDisplay.textContent = `Score: ${score}`;
    lastPipeSpawnTime = 0;
    pauseOverlay.classList.remove('visible');
    gameOverOverlay.classList.remove('visible');
    pipes = [];
    items = [];
    isBossFight = false;
    boss = null;
    crazyModeTimer = 0; // Quan trọng: Reset timer spawn boss
    bossHpBar.style.display = 'none';
    bossWarning.style.display = 'none';
    activeEffects = { shield: false, mini: false };
    bossBullets = [];
    boss = null;
    bossHpBar.style.display = 'none';
    bossWarning.style.display = 'none';
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

function spawnBoss() {
    if (isBossFight || boss) return;
    console.log("!!! SPAWN BOSS !!!");
    isBossFight = true;
    
    // Khởi tạo Boss mới với kích thước màn hình
    boss = new BossController(canvas.width, canvas.height);
    
    // Hiển thị UI cảnh báo & HP
    bossWarning.style.display = 'block';
    bossHpBar.style.display = 'block';
    
    // Ẩn warning sau 3s
    setTimeout(() => { bossWarning.style.display = 'none'; }, 3000);
}

function updateBoss() {
    if (!boss) return;
    
    // 1. Cập nhật logic boss (dt = 16.67ms)
    boss.update(16.67);

    // 2. Update HP Bar hiển thị
    // Boss cũ có logic visualHp tăng dần từ 0->100
    const percent = Math.max(0, Math.min(100, boss.visualHp)); 
    bossHpFill.style.width = percent + '%';
    
    // 3. Check Va chạm Chim vs Boss
    const birdRect = {
        x: birdX + BIRD_HITBOX_INSET.x,
        y: birdY + BIRD_HITBOX_INSET.y,
        w: BIRD_WIDTH - 2 * BIRD_HITBOX_INSET.x,
        h: BIRD_HEIGHT - 2 * BIRD_HITBOX_INSET.y
    };

    if (boss.checkCollision(birdRect)) {
        if (activeEffects.shield) {
            activeEffects.shield = false; 
        } else {
            gameOver('boss_collision'); // <-- Truyền tham số
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
    
    // 1. Logic Vật lý Chim
    birdVelocityY += GRAVITY;
    birdY += birdVelocityY;
    
    const velocityTargetAngle = Math.max(Math.min(birdVelocityY * 7, MAX_DOWN_ANGLE), MAX_UP_ANGLE);
    birdAngle += (velocityTargetAngle - birdAngle) * ANGLE_LERP;
    flapTimer += 16.67;
   
    // Check va chạm trần/sàn
    if (birdY < 0) {
        // Chạm trần
        if (!window.debugState?.isGodMode) {
            gameOver('bound_hit'); 
            return;
        } else {
             // Bất tử: giữ lại ở mép trên, reset lực nhảy
             birdY = 0;
             birdVelocityY = 0;
        }
    } 
    if (birdY + BIRD_HEIGHT > GAME_HEIGHT) {
        // Chạm sàn
        if (!window.debugState?.isGodMode) {
            gameOver('bound_hit');
            return;
        } else {
             // Bất tử: giữ lại ở mép sàn, không cho rơi sâu hơn
             birdY = GAME_HEIGHT - BIRD_HEIGHT; 
             birdVelocityY = 0; 
             // Khi rồng đứng trên sàn, nó sẽ reset tốc độ rơi về 0
             // Bạn bấm chuột phát là nó bay lên được ngay.
        }
    }
    // Tính thời gian game
    gameTime += 16.67;

    // 2. LOGIC PIPES (Chỉ chạy khi KHÔNG đánh boss)
    // Nếu đánh boss, ngừng sinh ống nước mới
    if (!isBossFight) {
        if (Date.now() - lastPipeSpawnTime > PIPE_SPAWN_INTERVAL) {
            spawnPipe();
            lastPipeSpawnTime = Date.now();
        }

        // Cập nhật vị trí và va chạm Pipes (Code cũ giữ nguyên logic nhưng dọn gọn)
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

            // Check va chạm Pipe
            if (rectIntersect(birdRect, pipeRect)) {
                if (activeEffects.shield) {
                    activeEffects.shield = false;
                    pipes.splice(i, 1); // Xóa pipe chạm phải
                    i--; // Lùi index
                    continue; 
                } else {
                    gameOver('pipe_hit'); // <-- Truyền tham số
                    return;
                }
            }

            // Tính điểm
            if (!pipe.passed && pipe.x + pipe.width < birdX) {
                pipe.passed = true;
                if (pipe.type === 'bottom') { 
                    score++;
                    scoreDisplay.textContent = `Score: ${score}`;
                    SFX.score.currentTime = 0; 
                    SFX.score.play();
                }
            }
        }
        // Xóa ống nước đã đi qua màn hình
        pipes = pipes.filter(pipe => pipe.x + pipe.width > 0);
    }

    // 3. LOGIC CRAZY MODE
    if (currentMode === 'crazy') {
        crazyModeTimer += 16.67;
        
        // A. Xử lý Item
        if (!isBossFight) {
            spawnItem();
        }
        updateItems();

        // --- B. KÍCH HOẠT BOSS (SỬA ĐỔI: Dựa theo SCORE) ---
        
        // Logic cũ (Time based): if (!isBossFight && crazyModeTimer >= TIME_TO_SPAWN_BOSS) ...
        
        // Logic mới (Score based):
        // Nếu chưa đánh boss VÀ điểm >= 2 (tức là đã qua 2 cột)
        if (!isBossFight && score >= 0 && !boss) { 
             spawnBoss();
        }
        // ---------------------------------------------------

        // C. Cập nhật Boss
        if (boss) {
            updateBoss();
        }
        
        // D. Kết thúc Boss (Vẫn giữ theo thời gian đánh boss hoặc có thể sửa tùy ý)
        if (isBossFight && crazyModeTimer >= (TIME_TO_SPAWN_BOSS + TIME_TO_FIGHT_BOSS)) {
            // Lưu ý: Nếu muốn boss lặp lại dựa trên điểm số thay vì thời gian,
            // bạn cần reset 'score' hoặc có biến đếm 'scoreSinceLastBoss'.
            // Hiện tại ta cứ giữ logic time out để boss biến mất sau 60s đánh nhau.
            endBossFight();
        }
    }
    // (Nếu là mode 'normal', đoạn logic trên sẽ bị bỏ qua)
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
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Lấy DOM Elements (Chỉ lấy 1 lần hoặc cache nếu muốn tối ưu, nhưng ở đây lấy luôn cho gọn)
    const domS1 = document.getElementById('domSnake1');
    const domS2 = document.getElementById('domSnake2');
    const domBB = document.getElementById('domBigBoss');
    const allDoms = [domS1, domS2, domBB];

    // Reset tất cả về ẩn trước (tránh trường hợp game over hình vẫn còn)
    // Nếu game pause, không ẩn để nhìn thấy boss
    if(!boss && !isBossFight && !isPaused) {
        allDoms.forEach(d => { if(d) d.style.display = 'none'; });
    }

    // 1. Vẽ Ống & Items & Chim (Giữ nguyên)
    for (let i = 0; i < pipes.length; i++) {
        let p = pipes[i];
        if (p.type === 'top') ctx.drawImage(assets.pipeTop, p.x, p.y, p.width, p.height);
        else ctx.drawImage(assets.pipeBottom, p.x, p.y, p.width, p.height);
    }
    if (currentMode === 'crazy') {
        items.forEach(it => {
            if (it.type === 'shield') ctx.fillStyle = 'cyan';
            else if (it.type === 'bomb') ctx.fillStyle = 'red';
            else ctx.fillStyle = 'green';
            ctx.fillRect(it.x, it.y, it.w, it.h);
        });
    }

    // 2. VẼ BOSS (Phần Thân vẽ Canvas, Phần Đầu chỉnh CSS DOM)
    if (currentMode === 'crazy' && boss && boss.snakes) {
        
        boss.snakes.forEach(s => {
            if (!s.isActive) {
                // Ẩn đầu tương ứng
                let d = (s.id === 1) ? domS1 : domS2;
                if(d) d.style.display = 'none';
                return;
            };

            const cfg = window.BOSS_VISUAL[(s.id === 1 ? 'snake1' : 'snake2')];
            const radBody = cfg.bodyRot * (Math.PI / 180);
            
            // --- VẼ THÂN TRÊN CANVAS (Giữ nguyên) ---
            if (assetsExtra.snakeBody) {
                s.segments.forEach(seg => {
                    drawRotated(ctx, assetsExtra.snakeBody, seg.x, seg.y, cfg.bodyW, cfg.bodyH, radBody);
                });
            }

            // --- VẼ ĐẦU BẰNG DOM GIF (Thay thế code vẽ cũ) ---
            let domImg = (s.id === 1) ? domS1 : domS2;
            if (domImg) {
                domImg.style.display = 'block'; // Hiện lên
                
                // 1. Kích thước
                domImg.style.width = cfg.headW + 'px';
                domImg.style.height = cfg.headH + 'px';

                // 2. Vị trí (Tọa độ tính y chang Canvas)
                // Cần trừ 1/2 chiều rộng/cao vì position tính từ góc trên trái, nhưng toạ độ game tính từ tâm
                let hx = s.headX - cfg.headW/2; 
                let hy = s.y - cfg.headH/2; 

                // Offset Config
                if (s.id === 1) hx -= cfg.headOffX; else hx += cfg.headOffX;
                hy += cfg.headOffY;

                domImg.style.left = hx + 'px';
                domImg.style.top = hy + 'px';

                // 3. Xoay & Lật (Dùng CSS Transform)
                let deg = cfg.headRot;
                let scaleX = (cfg.flipped) ? -1 : 1;
                
                // Chuỗi transform CSS: Lật trước, Xoay sau (hoặc ngược lại tuỳ logic bạn muốn)
                // Lưu ý: CSS rotate là độ (deg), Canvas là radian
                domImg.style.transform = `scaleX(${scaleX}) rotate(${deg}deg)`;
                
                // Logic đổi ảnh nếu có file Flip
                // Snake 1 mặc định dùng src head_flip trong HTML, Snake 2 dùng head
                // Bạn có thể đổi src động ở đây nếu muốn:
                // if (cfg.flipped) domImg.src = 'assets/images/head_flip.gif';
            }
        });

        // --- BOSS TO ---
        const BC = window.BOSS_VISUAL.bigBoss;
        if ((boss.state === 'FIGHT' || boss.events.ghostEnter)) {
            if(domBB) {
                domBB.style.display = 'block';
                domBB.style.width = BC.size + 'px';
                domBB.style.height = BC.size + 'px';
                
                // Tọa độ góc trái trên = Tâm - 1/2 kích thước
                domBB.style.left = (boss.ghostX - BC.size/2) + 'px';
                domBB.style.top = (boss.ghostY - BC.size/2) + 'px';
                
                // Hiệu ứng nhấp nhô
                let swayDeg = Math.sin(Date.now() / 500) * 5; // * 5 độ
                domBB.style.transform = `rotate(${swayDeg}deg)`;
            }
        } else {
            if(domBB) domBB.style.display = 'none';
        }
    } else {
        // Tắt hết nếu ko phải boss fight
        allDoms.forEach(d => { if(d) d.style.display = 'none'; });
    }

    // Draw Bird
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
        if (boss.events && (boss.events.ghostEnter || boss.state==='FIGHT')) {
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