/**
 * boss_logic.js
 * FINAL TUNING: 
 * - Ghost Target: 93% màn hình phải (Mép phải).
 * - Timeline giữ nguyên.
 */

const BOSS_CFG = {
    scrollSpeed: 2.1,     
    segmentWidth: 920,    
    segmentCount: 30,     
    bounds: { yPadding: 130 },
    attackCooldown: 1200, 
    bulletSpeed: 0.55
};

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
}

class Projectile {
    constructor(x, y, vx, vy, bR, bB) {
        this.x = x; this.y = y; this.w = 30; this.h = 30;
        this.vx = vx; this.vy = vy; this.active = true;
        this.bR = bR; this.bB = bB;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        if(this.x<-300||this.x>this.bR+300||this.y<-300||this.y>this.bB+300) this.active = false;
    }
}

class SnakeHead {
    constructor(id, gameWidth, y, direction) {
        this.id = id; this.gameWidth = gameWidth;
        this.y = y; this.baseY = y;
        this.direction = direction; 
        this.isActive = false; this.velocity = 0;
        this.width = BOSS_CFG.segmentWidth; 
        this.height = 300; 
        const buffer = 2000;
        let startX = (direction === -1) ? gameWidth + buffer : -buffer;
        this.headX = startX;
        this.segments = [];
        const step = this.width; 
        for(let i=0; i < BOSS_CFG.segmentCount; i++) {
            let offsetMult = i + 0.39; 
            let offsetX = offsetMult * step * (-direction);
            this.segments.push({x: startX + offsetX, y: y, w: this.width, h: this.height});
        }
    }
    activate() { this.isActive = true; this.velocity = BOSS_CFG.scrollSpeed * this.direction; }
    update(dt, currentWidth) {
        if (!this.isActive) return;
        this.gameWidth = currentWidth;
        let time = Date.now() * 0.002; 
        this.headX += this.velocity * dt;
        this.y = this.baseY + Math.sin(time) * 8; 
        const totalLen = this.segments.length * this.width;
        const wrapBuffer = this.width * 2; 
        for (let i = 0; i < this.segments.length; i++) {
            let s = this.segments[i];
            s.x += this.velocity * dt;
            s.y = this.baseY + Math.sin(time + i * 0.15) * 8; 
            if (this.direction === -1) { if (s.x < -wrapBuffer) s.x += totalLen; } 
            else { if (s.x > this.gameWidth + wrapBuffer) s.x -= totalLen; }
        }
    }
}

class BossController {
    constructor(w, h) {
        this.state='INTRO'; this.timer=0; this.visualHp=0; this.introOpacity=0;
        this.shake={x:0,y:0,force:0}; this.events={s1:false, s2:false, ghostEnter: false, rev:false};
        this.projectiles=[]; this.atkTimer=BOSS_CFG.attackCooldown; this.isWarning=false;
        this.resize(w, h);
    }
    resize(w, h) {
        this.width = w; this.height = h;
        if(this.state === 'INTRO' && this.timer < 13000) this.ghostX = w + 800;
        else this.ghostX = w * 0.93; // Vị trí MẶC ĐỊNH LÀ 93% BÊN PHẢI
        
        this.ghostY = h * 0.5;
        if (!this.snakes) {
            let p = BOSS_CFG.bounds.yPadding;
            this.snakes = [ new SnakeHead(1, w, p, -1), new SnakeHead(2, w, h - p, 1) ];
        }
    }
    update(dt) {
        if(this.shake.force > 0) {
            this.shake.x=(Math.random()-0.5)*this.shake.force;
            this.shake.y=(Math.random()-0.5)*this.shake.force;
            this.shake.force*=0.95; if(this.shake.force<0.5) this.shake.force=0;
        } else { this.shake.x=0;this.shake.y=0; }

        if(this.state==='INTRO') this.updateIntro(dt); else this.updateFight(dt);
        this.ghostY = this.height * 0.5;

        this.snakes.forEach(s => s.update(dt, this.width));
        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => p.active);
    }
    updateIntro(dt) {
        this.timer += dt; let t = this.timer;
        this.isWarning = (t < 2000);
        if(t > 1500 && !this.events.s1) { this.events.s1=true; this.snakes[0].activate(); this.shake.force=12; }
        if(t > 4500 && !this.events.s2) { this.events.s2=true; this.snakes[1].activate(); this.shake.force=12; }
        
        // Ghost Head trôi vào (8.5s)
        if(t > 8500) {
            this.introOpacity = 1;
            if(!this.events.ghostEnter) this.events.ghostEnter=true; 
            
            // Logic Target: 93% màn hình
            let targetX = this.width * 0.93; 
            if (this.ghostX > targetX) this.ghostX -= 0.15 * dt; 
        }

        if(t > 10000) {
            if(this.visualHp<100) this.visualHp+=0.15*dt;
            if(!this.events.rev) { this.events.rev=true; this.shake.force=25; }
        }
        if(t > 13000) { this.state='FIGHT'; this.visualHp=100; }
    }
    updateFight(dt) {
        this.atkTimer -= dt; if(this.atkTimer <= 0) { this.fire(); this.atkTimer=BOSS_CFG.attackCooldown; }
        // Giữ Ghost ở 93%
        let targetX = this.width * 0.93; 
        if (Math.abs(this.ghostX - targetX) > 1) {
            this.ghostX += (targetX - this.ghostX) * 0.1;
        }
    }
    fire() {
        this.shake.force=6;
        this.snakes.forEach(s => {
            if(!s.isActive) return;
            let sy = (s.id===1) ? s.y+100 : s.y-100;
            let vy = (s.id===1) ? BOSS_CFG.bulletSpeed : -BOSS_CFG.bulletSpeed;
            this.projectiles.push(new Projectile(Math.random()*this.width, sy, 0, vy, this.width, this.height));
        });
    }
    checkCollision(player) {
        if(this.state !== 'FIGHT') return false;
        let p = {x:player.x+20, y:player.y+20, w:player.width-40, h:player.height-40};
        for(let proj of this.projectiles) if(rectIntersect(p, {x:proj.x-15, y:proj.y-15, w:30, h:30})) return true;
        let hitW = BOSS_CFG.segmentWidth * 0.7; 
        for(let s of this.snakes) {
            for(let seg of s.segments) {
                let r = {x:seg.x - hitW/2, y:seg.y-125, w:hitW, h:200}; 
                if(s.id===1) r.y-=30; else r.y+=30;
                if(rectIntersect(p, r)) return true;
            }
        }
        return false;
    }
}
window.BossController = BossController;