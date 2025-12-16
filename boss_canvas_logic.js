/**
 * boss_canvas_logic.js
 * VISUAL FIXED: 
 * - VisSpace = 0 (Để logic tự khớp)
 * - DrW = 1000px vs Logic 450px tạo độ đè đẹp mắt
 */

(function() {
    let canvas, ctx;

    const P = {
        visSpace: 0,
        drW: 1000, 
        drH: 250,
        hSize: 450,
        
        // --- TINH CHỈNH KHỚP CỔ Ở ĐÂY ---
        // Nếu thân giãn ra (Logic tăng), có thể bạn cần tăng giá trị này lên một chút 
        // để đẩy đầu về đúng vị trí khớp nối.
        // Ví dụ: Đang là -150, thử sửa thành -100 hoặc -50 (hoặc -250 tùy hướng hở)
        hOffX: -50,  
        // --------------------------------
        
        hOffY: -50, // Độ cao khớp cổ
        rotB: 3,         
        rotH: -4        
    };

    // Đổi tên file ở đây nếu cần
    const ASSET_SOURCES = {
        snakeHead: 'Image/head.gif', 
        snakeHeadFlip: 'Image/head.gif', // Có thể dùng head_flip.gif nếu có
        snakeBody: 'Image/body.png', 
        bullet: 'Image/posionbullet.png', 
        bossFrame: 'Image/BossFrame.png' 
    };
    
    const assets = {}; let assetsLoaded=0;
    const state = { fps:0, lastTime:0, dragon:{x:0,y:0,vy:0,width:80,height:80}, isDebug: false };

    function initSystem() {
        canvas = document.getElementById('gameCanvas'); if(!canvas)return;
        ctx = canvas.getContext('2d');
        resizeGame(); window.addEventListener('resize', resizeGame);
        
        // Tạo Player test (Vuông hoặc ảnh nếu có)
        state.dragon.x = canvas.width*0.15; state.dragon.y = canvas.height/2;
        
        if(window.BossController) window.bossController=new window.BossController(canvas.width, canvas.height);
        
        loadAssets(()=>{
            document.getElementById('loading').style.display='none'; 
            requestAnimationFrame(loop);
        });
        
        // Điều khiển player test
        window.addEventListener('keydown', e=>{if(e.code==='Space') state.dragon.vy=-10.5; if(e.key==='h')state.isDebug=!state.isDebug;});
        
        // Lắng nghe Tuning (Nếu mở file boss_tuning.html)
        try{
            new BroadcastChannel('boss_tuning_live').onmessage = (ev) => {
                if(ev.data) { Object.assign(P, ev.data); }
            }
        }catch(e){}
    }

    function resizeGame() {
        canvas.width=window.innerWidth; canvas.height=window.innerHeight;
        if(window.bossController) window.bossController.resize(canvas.width, canvas.height);
        state.dragon.x = canvas.width*0.15;
    }

    function loadAssets(cb) {
        let t=Object.keys(ASSET_SOURCES).length; 
        for(let k in ASSET_SOURCES){
            let i=new Image();i.src=ASSET_SOURCES[k];
            i.onload=()=>{assets[k]=i; assetsLoaded++; if(assetsLoaded===t)cb()};
            i.onerror=()=>{console.warn("Lỗi load ảnh: " + k); assetsLoaded++; if(assetsLoaded===t)cb()};
        }
    }

    function drawRotated(img, x, y, w, h, angle) {
        if(!img)return; 
        ctx.save(); 
        ctx.translate(x,y); 
        ctx.rotate(angle);
        ctx.drawImage(img, -w/2, -h/2, w, h);
        
        if(state.isDebug) { ctx.strokeStyle='red';ctx.strokeRect(-w/2,-h/2,w,h); } 
        ctx.restore();
    }

    function drawSnakes(boss) {
        const radBody = P.rotB * (Math.PI / 180);
        const radHead = P.rotH * (Math.PI / 180);

        boss.snakes.forEach(s=>{
            // Nếu chưa đến lúc xuất hiện thì không vẽ
            if(!s.isActive && s.id===2 && boss.introTimer<7000) return;
            
            // --- VẼ THÂN (BODY) ---
            const baseAngle = (s.angle !== undefined) ? s.angle : 0;
            const finalBodyAngle = baseAngle + radBody;

            // Loop vẽ từng đốt
            s.segments.forEach((seg, index) => {
                let extraSpace = index * P.visSpace; 
                let drawX = seg.x + (extraSpace * -s.direction); 
                drawRotated(assets.snakeBody, drawX, seg.y, P.drW, P.drH, finalBodyAngle);
            });
            
            // --- VẼ ĐẦU (HEAD) ---
            // Đầu cần offset để khớp với đốt đầu tiên
            let img = s.id===1 ? assets.snakeHead : assets.snakeHeadFlip;
            
            let finalHeadAngle = radHead;
            if(s.id===2) finalHeadAngle = -finalHeadAngle; 
            
            let hx = (s.headX || s.x);
            
            // Áp dụng offset (Cân chỉnh thủ công từ biến P)
            if (s.id === 1) hx += P.hOffX;
            else hx -= P.hOffX; // Đảo chiều nếu chạy hướng ngược lại

            let hy = s.y + P.hOffY;

            // Vẽ đầu sau cùng để nằm đè lên cổ
            drawRotated(img, hx, hy, P.hSize, P.hSize, finalHeadAngle);
        });
    }

    function drawHUD(boss) {
        if(boss.visualHp<=0) return;
        const cx=canvas.width/2, W=Math.min(800, canvas.width*0.9), H=W/5.3, X=cx-W/2, Y=40;
        
        // Tên Boss
        ctx.save(); ctx.fillStyle='#ccff00'; ctx.font="bold 28px 'Impact', sans-serif"; ctx.textAlign='center';
        ctx.shadowColor='black'; ctx.shadowBlur=6; 
        ctx.fillText("THE PHANTOM LEVIATHAN", cx, Y-10); ctx.restore();
        
        // Thanh máu
        const bx=X+(W*0.175), by=Y+(H*0.39), bw=W*0.76, bh=H*0.20;
        ctx.fillStyle='#222'; ctx.fillRect(bx, by, bw, bh);
        let cur = bw*(boss.visualHp/100);
        if(cur>0){
            let g=ctx.createLinearGradient(bx,0,bx,by+bh); g.addColorStop(0,'#f00'); g.addColorStop(1,'#800');
            ctx.fillStyle=g; ctx.fillRect(bx,by,cur,bh);
        }
        if(assets.bossFrame) ctx.drawImage(assets.bossFrame, X, Y, W, H);
    }
    
    function draw() {
        if(!ctx)return;
        let b = window.bossController;
        let sx=0, sy=0; if(b){sx=b.shake.x;sy=b.shake.y;}
        
        ctx.save(); ctx.translate(sx,sy);
        
        // Background tối
        ctx.fillStyle='#0d0d0d'; ctx.fillRect(-20,-20,canvas.width+40,canvas.height+40);
        
        if(b) {
            // Vẽ đạn
            b.projectiles.forEach(p=>{ if(assets.bullet) drawRotated(assets.bullet,p.x,p.y,30,30,0) });
            // Vẽ rồng
            drawSnakes(b);
        }
        
        // Player Test
        ctx.fillStyle='cyan'; ctx.fillRect(state.dragon.x, state.dragon.y, 40,40);

        ctx.restore();

        // UI Layer
        if(b) {
            if(b.isWarning) { 
                let a = Math.abs(Math.sin(Date.now()/150))*0.3;
                ctx.fillStyle=`rgba(255,0,0,${a})`; ctx.fillRect(0,0,canvas.width,canvas.height);
                ctx.save(); ctx.fillStyle='#ffd700'; ctx.font="900 80px Impact"; ctx.textAlign='center'; 
                ctx.fillText("⚠ DANGER ⚠", canvas.width/2, canvas.height/2); ctx.restore();
            }
            drawHUD(b);
        }
        ctx.fillStyle='lime'; ctx.font='12px monospace'; ctx.fillText("FPS: "+state.fps,10,20);
    }

    function update(dt) {
        state.fps=Math.round(1000/dt);
        
        // Physics đơn giản cho player test (Trọng lực)
        state.dragon.vy+=0.45*(dt/16); state.dragon.y+=state.dragon.vy*(dt/16);
        if(state.dragon.y>canvas.height-80) state.dragon.y=canvas.height-80;
        if(state.dragon.y<0){state.dragon.y=0;state.dragon.vy=0;}
        
        // Boss update
        if(window.bossController) window.bossController.update(dt);
    }

    function loop(ts) {
        if(!state.lastTime)state.lastTime=ts; let dt=ts-state.lastTime;
        if(dt<1000){update(dt);draw();} state.lastTime=ts; requestAnimationFrame(loop);
    }
    
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSystem);else initSystem();
})();