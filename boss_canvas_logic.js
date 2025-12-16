/**
 * boss_canvas_logic.js
 * FIXED LAYERING ULTIMATE:
 * 1. Back Canvas (Mặc định): Vẽ Thân Rắn Trên.
 * 2. Boss DOM Image (Z=10): Hình head.gif to, nằm đè lên Rắn Trên.
 * 3. Front Canvas (Tạo thêm, Z=15): Vẽ Thân Rắn Dưới -> ĐÈ LÊN BOSS.
 */

(function() {
    let canvasBack, ctxBack; // Canvas nền (Snake 1)
    let canvasFront, ctxFront; // Canvas nổi (Snake 2, HUD)

    let domHead1, domHead2, domBoss; // Thẻ IMG cho các đầu & boss

    // ▼ CHỈNH BOSS TO TẠI ĐÂY ▼
    const BOSS_SCALE = 1.3; 

    const P = {
        visSpace: 0, drW: 1000, drH: 250, hSize: 450,
        hOffX: -50, hOffY: -50, 
        rotB: 3, rotH: -4        
    };

    const ASSET_SOURCES = {
        snakeBody: 'Image/body.png', 
        bullet: 'Image/posionbullet.png', 
        bossFrame: 'Image/BossFrame.png',
        player: 'Image/dragon.png',
        // [SỬA THEO Ý BẠN]: Đầu Boss to dùng chung file head.gif
        bossFace: 'Image/head.gif' 
    };
    
    const assets = {}; let assetsLoaded=0;
    const state = { fps:0, lastTime:0, dragon:{x:0,y:0,vy:0,width:80,height:80}, isDebug: false };

    // Bong bóng HUD
    const bubbles = [];
    for(let i=0; i<15; i++) {
        bubbles.push({x: Math.random(), y: Math.random(), r: 2+Math.random()*3, s: 0.05+Math.random()*0.05});
    }

    function initSystem() {
        // 1. SETUP CANVAS NỀN (Back)
        canvasBack = document.getElementById('gameCanvas'); if(!canvasBack)return;
        ctxBack = canvasBack.getContext('2d');
        canvasBack.style.zIndex = 1; 

        // 2. SETUP CANVAS NỔI (Front) - Tạo mới bằng code
        canvasFront = document.createElement('canvas');
        canvasFront.style.position = 'absolute';
        canvasFront.style.top = '0'; canvasFront.style.left = '0';
        canvasFront.style.width = '100%'; canvasFront.style.height = '100%';
        canvasFront.style.pointerEvents = 'none'; // Click xuyên qua
        canvasFront.style.zIndex = 15; // Nằm trên Boss (Z=10)
        document.body.appendChild(canvasFront);
        ctxFront = canvasFront.getContext('2d');

        // 3. SETUP CÁC THẺ ẢNH GIF
        
        // - Đầu rắn trên: Nằm trên canvasBack (Z=5) nhưng dưới Boss (Z=10)
        domHead1 = createOverlayImage('Image/head.gif', 5);
        
        // - BOSS TO: [QUAN TRỌNG] Z=10 -> Nằm TRÊN rắn trên, nhưng DƯỚI rắn dưới
        domBoss = createOverlayImage('Image/head.gif', 10); 
        
        // - Đầu rắn dưới: Cao nhất (Z=20)
        domHead2 = createOverlayImage('Image/head_flip.gif', 20);

        resizeGame(); window.addEventListener('resize', resizeGame);
        
        // Setup Player
        state.dragon.x = window.innerWidth*0.15; state.dragon.y = window.innerHeight/2;
        if(window.BossController) window.bossController=new window.BossController(window.innerWidth, window.innerHeight);
        
        // Chỉnh boss qua phải 95%
        if(window.BossController) window.bossController.ghostX = window.innerWidth * 0.95;

        loadAssets(()=>{document.getElementById('loading').style.display='none'; requestAnimationFrame(loop);});
        window.addEventListener('keydown', e=>{if(e.code==='Space') state.dragon.vy=-10.5; if(e.key==='h')state.isDebug=!state.isDebug;});
    }
    
    function createOverlayImage(src, zIndex) {
        let img = document.createElement('img');
        img.src = src;
        img.style.position = 'absolute';
        img.style.zIndex = zIndex; 
        img.style.display = 'none'; 
        img.style.pointerEvents = 'none'; 
        img.style.transformOrigin = '50% 50%'; 
        document.body.appendChild(img);
        return img;
    }

    function updateDomImg(img, x, y, rotation, scale = 1.0) {
        if(!img) return;
        img.style.display = 'block';
        img.style.left = x + 'px';
        img.style.top = y + 'px';
        img.style.transform = `translate(-50%, -50%) rotate(${rotation}rad) scale(${scale})`;
    }

    function resizeGame() {
        canvasBack.width = window.innerWidth; canvasBack.height = window.innerHeight;
        canvasFront.width = window.innerWidth; canvasFront.height = window.innerHeight;
        if(window.bossController) window.bossController.resize(window.innerWidth, window.innerHeight);
        state.dragon.x = window.innerWidth*0.15;
    }

    function loadAssets(cb) {
        let t=Object.keys(ASSET_SOURCES).length; 
        for(let k in ASSET_SOURCES){
            let i=new Image();i.src=ASSET_SOURCES[k];
            i.onload=()=>{assets[k]=i; assetsLoaded++; if(assetsLoaded===t)cb()};
            i.onerror=()=>{console.warn("Lỗi ảnh: "+k); assetsLoaded++; if(assetsLoaded===t)cb()};
        }
    }

    // Vẽ xoay (truyền ctx để chọn vẽ lên canvas trước hay sau)
    function drawRotated(ctx, img, x, y, w, h, angle) {
        if(!img)return; ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
        ctx.drawImage(img, -w/2, -h/2, w, h);
        ctx.restore();
    }

    function drawSnakes(boss) {
        const radBody = P.rotB * (Math.PI / 180);
        const radHead = P.rotH * (Math.PI / 180);

        boss.snakes.forEach(s=>{
            // --- XÁC ĐỊNH VẼ Ở ĐÂU ---
            // Snake 1 (Trên): Vẽ vào Back (Bị Boss che)
            // Snake 2 (Dưới): Vẽ vào Front (Che Boss)
            let targetCtx = (s.id === 1) ? ctxBack : ctxFront; 
            let domImg = (s.id === 1) ? domHead1 : domHead2;

            if(!s.isActive && s.id===2 && boss.introTimer<6000) {
                 if(domImg) domImg.style.display='none';
                 return;
            }

            // Vẽ Thân
            const finalBodyAngle = (s.angle !== undefined ? s.angle : 0) + radBody;
            s.segments.forEach((seg, index) => {
                let extraSpace = index * P.visSpace; 
                let drawX = seg.x + (extraSpace * -s.direction); 
                drawRotated(targetCtx, assets.snakeBody, drawX, seg.y, P.drW, P.drH, finalBodyAngle);
            });

            // Update DOM Head
            let finalHeadAngle = (s.id===1) ? radHead : -radHead;
            let hx = (s.headX || s.x);
            if (s.id === 1) hx += P.hOffX; else hx -= P.hOffX;
            let hy = s.y + P.hOffY;
            if (s.id === 2) hy += 60;
            
            if(domImg) {
                domImg.style.width = P.hSize + 'px'; domImg.style.height = 'auto';
                // Shake chung toàn màn hình
                updateDomImg(domImg, hx + window.currentShakeX, hy + window.currentShakeY, finalHeadAngle, 1.0); 
            }
        });
    }

    function drawLiquidHUD(ctx, boss) {
        if(boss.visualHp<=0) return;
        const cx=canvasBack.width/2, W=Math.min(800, canvasBack.width*0.9), H=W/5.3, X=cx-W/2, Y=40;
        
        ctx.save(); ctx.fillStyle='#39ff14'; ctx.font="bold 28px 'Impact'"; ctx.textAlign='center';
        ctx.shadowColor='#39ff14'; ctx.shadowBlur=15; ctx.fillText("THE PHANTOM LEVIATHAN", cx, Y-10); ctx.restore();
        
        const bx=X+(W*0.175), by=Y+(H*0.39), bw=W*0.76, bh=H*0.20;
        ctx.fillStyle='#001100'; ctx.fillRect(bx, by, bw, bh);
        
        let cur = bw*(boss.visualHp/100);
        if(cur>0){
            ctx.save(); ctx.beginPath(); ctx.rect(bx, by, cur, bh); ctx.clip();

            let g = ctx.createLinearGradient(bx, by, bx, by+bh);
            g.addColorStop(0, '#32CD32'); g.addColorStop(1, '#005500'); 
            ctx.fillStyle = g; ctx.fillRect(bx, by, cur, bh);

            ctx.fillStyle = "rgba(173, 255, 47, 0.4)"; let time = Date.now() * 0.005;
            ctx.beginPath(); ctx.moveTo(bx, by + bh); ctx.lineTo(bx, by + 10);
            for(let dx=0; dx<=cur; dx+=10) ctx.lineTo(bx+dx, by+5 + Math.sin(dx*0.02+time)*5);
            ctx.lineTo(bx+cur, by+bh); ctx.fill();

            ctx.fillStyle = "rgba(255,255,255,0.5)";
            bubbles.forEach(b => {
                b.y -= b.s; if(b.y < -0.1) b.y = 1.1; 
                if(b.x * bw < cur) { ctx.beginPath(); ctx.arc(bx + b.x*cur, by + b.y*bh, b.r, 0, Math.PI*2); ctx.fill(); }
            });

            let gGlass = ctx.createLinearGradient(bx, by, bx, by+bh*0.5);
            gGlass.addColorStop(0, 'rgba(255,255,255,0.6)'); gGlass.addColorStop(1, 'rgba(255,255,255,0.0)');
            ctx.fillStyle = gGlass; ctx.fillRect(bx, by, cur, bh*0.4);
            ctx.restore();
        }
        if(assets.bossFrame) ctx.drawImage(assets.bossFrame, X, Y, W, H);
    }
    
    function draw() {
        if(!ctxBack)return;
        let b = window.bossController;
        let sx=0, sy=0; if(b){sx=b.shake.x;sy=b.shake.y;}
        window.currentShakeX = sx; window.currentShakeY = sy;

        if(!b) { if(domHead1)domHead1.style.display='none'; if(domHead2)domHead2.style.display='none'; if(domBoss)domBoss.style.display='none'; }

        // --- CLEAR CẢ 2 CANVAS ---
        ctxBack.clearRect(0, 0, canvasBack.width, canvasBack.height);
        ctxFront.clearRect(0, 0, canvasFront.width, canvasFront.height);

        // --- DRAW VÀO BACK ---
        ctxBack.save(); ctxBack.translate(sx,sy);
        // Nền đen
        ctxBack.fillStyle='#0d0d0d'; ctxBack.fillRect(-20,-20,canvasBack.width+40,canvasBack.height+40);
        
        if(b) {
            b.projectiles.forEach(p=>{ if(assets.bullet) drawRotated(ctxBack, assets.bullet,p.x,p.y,30,30,0) });
            // Vẽ Rắn -> Hàm này tự chia rắn nào vẽ Front, rắn nào vẽ Back
            drawSnakes(b); 
            
            // --- XỬ LÝ BOSS HEAD (DOM) ---
            if(b.events && b.events.ghostEnter && domBoss) {
                let opacity = (b.state === 'INTRO' && b.timer < 10000) ? Math.min((b.timer-8500)/1000, 1) : 1;
                domBoss.style.opacity = opacity;
                domBoss.style.width = '500px'; domBoss.style.height = 'auto'; // Kích thước boss gốc trước scale
                
                // Update vị trí DOM BOSS
                updateDomImg(domBoss, b.ghostX + sx, b.ghostY + sy, 0, BOSS_SCALE);
            } else { if(domBoss) domBoss.style.display='none'; }
        }
        
        // Vẽ Player ở Front để không bị Back che, nhưng cũng ko quan trọng lắm vì player test
        if (assets.player) {
            ctxFront.drawImage(assets.player, state.dragon.x + sx, state.dragon.y + sy, 80, 80);
        }
        
        ctxBack.restore();

        // --- UI DRAW VÀO FRONT (Để đè lên tất cả) ---
        if(b) {
            if(b.isWarning) { 
                let a = Math.abs(Math.sin(Date.now()/150))*0.3;
                ctxFront.fillStyle=`rgba(0, 255, 0, ${a})`; ctxFront.fillRect(0,0,canvasFront.width,canvasFront.height);
                ctxFront.save(); ctxFront.fillStyle='#39ff14'; ctxFront.font="900 80px Impact"; ctxFront.textAlign='center'; 
                ctxFront.shadowBlur=10; ctxFront.shadowColor='green';
                ctxFront.fillText("⚠ TOXIC ⚠", canvasFront.width/2, canvasFront.height/2); ctxFront.restore();
            }
            drawLiquidHUD(ctxFront, b);
        }
        ctxFront.fillStyle='lime'; ctxFront.font='12px monospace'; ctxFront.fillText("FPS: "+state.fps,10,20);
    }

    function update(dt) {
        state.fps=Math.round(1000/dt);
        state.dragon.vy+=0.45*(dt/16); state.dragon.y+=state.dragon.vy*(dt/16);
        if(state.dragon.y>canvasBack.height-80) state.dragon.y=canvasBack.height-80;
        if(state.dragon.y<0){state.dragon.y=0;state.dragon.vy=0;}
        if(window.bossController) window.bossController.update(dt);
    }

    function loop(ts) {
        if(!state.lastTime)state.lastTime=ts; let dt=ts-state.lastTime;
        if(dt<1000){update(dt);draw();} state.lastTime=ts; requestAnimationFrame(loop);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSystem);else initSystem();
})();