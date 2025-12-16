/**
 * boss_canvas_logic.js
 * REMOVED: Bullet rendering.
 */

(function() {
    let canvasBack, ctxBack;
    let canvasFront, ctxFront;
    let domHead1, domHead2, domBoss; 

    // BOSS SCALE
    const BOSS_SCALE = 1.6; 

    const P = {
        visSpace: 0, drW: 1000, drH: 250, hSize: 450,
        hOffX: -50, hOffY: -50, rotB: 3, rotH: -4        
    };

    const ASSET_SOURCES = {
        snakeBody: 'Image/body.png', 
        // bullet: 'Image/posionbullet.png', (Không cần nữa)
        bossFrame: 'Image/BossFrame.png',
        player: 'Image/dragon.png',
        bossFace: 'Image/head.gif' 
    };
    
    const assets = {}; let assetsLoaded=0;
    const state = { fps:0, lastTime:0, dragon:{x:0,y:0,vy:0,width:80,height:80}, isDebug: false };
    const bubbles = []; for(let i=0; i<15; i++) bubbles.push({x:Math.random(), y:Math.random(), r:2+Math.random()*3, s:0.05+Math.random()*0.05});

    function initSystem() {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Creepster&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        canvasBack = document.getElementById('gameCanvas'); if(!canvasBack)return;
        ctxBack = canvasBack.getContext('2d'); canvasBack.style.zIndex = 1; 

        canvasFront = document.createElement('canvas');
        canvasFront.style.position = 'absolute'; canvasFront.style.top = '0'; canvasFront.style.left = '0';
        canvasFront.style.width = '100%'; canvasFront.style.height = '100%';
        canvasFront.style.pointerEvents = 'none'; canvasFront.style.zIndex = 15; 
        document.body.appendChild(canvasFront); ctxFront = canvasFront.getContext('2d');

        domHead1 = createOverlayImage('Image/head.gif', 5);
        domBoss = createOverlayImage('Image/head.gif', 10); 
        domHead2 = createOverlayImage('Image/head_flip.gif', 20);

        resizeGame(); window.addEventListener('resize', resizeGame);
        
        state.dragon.x = window.innerWidth*0.15; state.dragon.y = window.innerHeight/2;
        if(window.BossController) window.bossController=new window.BossController(window.innerWidth, window.innerHeight);
        if(window.BossController) window.bossController.ghostX = window.innerWidth + 500; 

        loadAssets(()=>{document.getElementById('loading').style.display='none'; requestAnimationFrame(loop);});
        
        window.addEventListener('keydown', e=>{if(e.code==='Space') state.dragon.vy=-10.5; if(e.key==='h')state.isDebug=!state.isDebug;});
        
        window.toggleGameDebug = () => { state.isDebug = !state.isDebug; return state.isDebug; };
    }
    
    function createOverlayImage(src, zIndex) {
        let img = document.createElement('img'); img.src = src;
        img.style.position = 'absolute'; img.style.zIndex = zIndex; 
        img.style.display = 'none'; img.style.pointerEvents = 'none'; 
        img.style.transformOrigin = '50% 50%'; document.body.appendChild(img);
        return img;
    }

    function updateDomImg(img, x, y, rotation, scale = 1.0) {
        if(!img) return; img.style.display = 'block';
        img.style.left = x + 'px'; img.style.top = y + 'px';
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
        for(let k in ASSET_SOURCES){ let i=new Image();i.src=ASSET_SOURCES[k]; i.onload=()=>{assets[k]=i; assetsLoaded++; if(assetsLoaded===t)cb()}; i.onerror=()=>{assetsLoaded++; if(assetsLoaded===t)cb()}; }
    }

    function drawRotated(ctx, img, x, y, w, h, angle) { if(!img)return; ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore(); }

    function drawSnakes(boss) {
        const radBody = P.rotB * (Math.PI / 180); const radHead = P.rotH * (Math.PI / 180);
        boss.snakes.forEach(s=>{
            let targetCtx = (s.id === 1) ? ctxBack : ctxFront; 
            let domImg = (s.id === 1) ? domHead1 : domHead2;

            if(!s.isActive && s.id===2 && boss.introTimer<6000) { if(domImg) domImg.style.display='none'; return; }

            const finalBodyAngle = (s.angle !== undefined ? s.angle : 0) + radBody;
            s.segments.forEach((seg, index) => {
                let extraSpace = index * P.visSpace; let drawX = seg.x + (extraSpace * -s.direction); 
                drawRotated(targetCtx, assets.snakeBody, drawX, seg.y, P.drW, P.drH, finalBodyAngle);
            });

            let finalHeadAngle = (s.id===1) ? radHead : -radHead;
            let hx = (s.headX || s.x);
            if (s.id === 1) hx += P.hOffX; else hx -= P.hOffX;
            let hy = s.y + P.hOffY; if (s.id === 2) hy += 60;
            
            if(domImg) {
                domImg.style.width = P.hSize + 'px'; domImg.style.height = 'auto';
                updateDomImg(domImg, hx + window.currentShakeX, hy + window.currentShakeY, finalHeadAngle, 1.0); 
            }
        });
    }

    function drawLiquidHUD(ctx, boss) {
        const t = boss.timer; 
        if(t < 9000) return; 

        // HUD Position Y=10
        const cx=canvasBack.width/2, W=Math.min(800, canvasBack.width*0.9), H=W/5.3, X=cx-W/2, Y=10; 
        
        const bx=X+(W*0.175), by=Y+(H*0.39);
        const bw=W*0.76, bh=H*0.20; 
        
        let textProgress = Math.min(1, Math.max(0, (t - 9000) / 800));
        let easeText = 1 - Math.pow(1 - textProgress, 3);
        
        let targetTextY = by - 8; 
        let startTextY = -50; 
        let textY = startTextY + (targetTextY - startTextY) * easeText;

        let frameProgress = Math.min(1, Math.max(0, (t - 9500) / 1000));
        let easeFrame = 1 - Math.pow(1 - frameProgress, 3);
        let currentW = W * easeFrame; 

        if(textProgress > 0) {
            ctx.save(); ctx.fillStyle='#39ff14'; 
            ctx.font="40px 'Creepster', cursive"; ctx.textAlign='center'; 
            ctx.shadowColor='#39ff14'; ctx.shadowBlur=20; 
            ctx.globalAlpha = textProgress;
            ctx.fillText("THE PHANTOM LEVIATHAN", cx, textY); ctx.restore();
        }

        if (currentW > 0) {
            ctx.save();
            ctx.beginPath(); ctx.rect(cx - currentW/2, Y, currentW, H); ctx.clip(); 

            if(frameProgress > 0.1) {
                ctx.fillStyle='#001100'; ctx.fillRect(bx, by, bw, bh);
                let cur = bw*(boss.visualHp/100);
                if(cur > 0) {
                    ctx.save();
                    ctx.beginPath(); ctx.rect(bx, by, cur, bh); ctx.clip();
                    
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
            }

            if (assets.bossFrame) { ctx.drawImage(assets.bossFrame, X, Y, W, H); }
            ctx.restore(); 
        }
    }

    function drawDebugHitboxes(ctx, sx, sy, b) {
        if(!window.HITBOX_CFG) return; 
        let cfg = window.HITBOX_CFG;
        ctx.save(); ctx.lineWidth = 2; 
        
        let phb = cfg.player; ctx.strokeStyle = '#00FF00';
        let px = state.dragon.x + sx + phb.dx + (40 - phb.w/2); let py = state.dragon.y + sy + phb.dy + (40 - phb.h/2);
        ctx.strokeRect(px, py, phb.w, phb.h);

        ctx.strokeStyle = '#FF0000'; ctx.fillStyle = 'rgba(255,0,0,0.3)';
        let bb = cfg.body; let bh = cfg.head; let bs = cfg.skill;

        b.snakes.forEach(s => {
            if(!s.isActive) return;
            s.segments.forEach(seg => {
                let rX = seg.x + sx + bb.dx - bb.w/2; let rY = seg.y + sy + bb.dy - bb.h/2;
                ctx.fillRect(rX, rY, bb.w, bb.h); ctx.strokeRect(rX, rY, bb.w, bb.h);
            });
            let hx = (s.headX || s.x); if(s.id===1) hx += -50; else hx -= -50; let hy = s.y - 50; if(s.id===2) hy += 60;
            let headDx = (s.direction === -1) ? bh.dx : -bh.dx;
            let rectHeadX = hx + sx + headDx - bh.w/2; let rectHeadY = hy + sy + bh.dy - bh.h/2;
            ctx.fillRect(rectHeadX, rectHeadY, bh.w, bh.h); ctx.strokeRect(rectHeadX, rectHeadY, bh.w, bh.h);
        });

        if(b.events && b.events.ghostEnter && bs && b.ghostX < canvasBack.width + 100) {
             ctx.strokeStyle = '#FF8800'; ctx.fillStyle = 'rgba(255,136,0,0.3)';
             let gX = b.ghostX + sx + bs.dx - bs.w/2; let gY = b.ghostY + sy + bs.dy - bs.h/2;
             ctx.fillRect(gX, gY, bs.w, bs.h); ctx.strokeRect(gX, gY, bs.w, bs.h);
        }
        ctx.restore();
    }
    
    function draw() {
        if(!ctxBack)return;
        let b = window.bossController;
        let sx=0, sy=0; if(b){sx=b.shake.x;sy=b.shake.y;}
        window.currentShakeX = sx; window.currentShakeY = sy;

        if(!b) { if(domHead1)domHead1.style.display='none'; if(domHead2)domHead2.style.display='none'; if(domBoss)domBoss.style.display='none'; }

        ctxBack.clearRect(0, 0, canvasBack.width, canvasBack.height);
        ctxFront.clearRect(0, 0, canvasFront.width, canvasFront.height);

        // LAYER BACK
        ctxBack.save(); ctxBack.translate(sx,sy); ctxBack.fillStyle='#0d0d0d'; ctxBack.fillRect(-20,-20,canvasBack.width+40,canvasBack.height+40);
        if(b) {
            // [NO BULLET DRAWING]
            drawSnakes(b); 
            if(b.events && b.events.ghostEnter && domBoss) {
                domBoss.style.opacity = '1'; domBoss.style.width = '500px'; domBoss.style.height = 'auto';
                updateDomImg(domBoss, b.ghostX + sx, b.ghostY + sy, 0, BOSS_SCALE);
            } else { if(domBoss) domBoss.style.display='none'; }
        }
        ctxBack.restore();

        // LAYER FRONT
        if (assets.player) { ctxFront.drawImage(assets.player, state.dragon.x + sx, state.dragon.y + sy, 80, 80); }
        if(state.isDebug && b) drawDebugHitboxes(ctxFront, sx, sy, b);

        if(b) {
            if(b.isWarning) { 
                let a = Math.abs(Math.sin(Date.now()/150))*0.3; ctxFront.fillStyle=`rgba(0, 255, 0, ${a})`; ctxFront.fillRect(0,0,canvasFront.width,canvasFront.height);
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
    function loop(ts) { if(!state.lastTime)state.lastTime=ts; let dt=ts-state.lastTime; if(dt<1000){update(dt);draw();} state.lastTime=ts; requestAnimationFrame(loop); }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSystem);else initSystem();
})();