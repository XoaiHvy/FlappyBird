/**
 * boss_logic.js
 * REMOVED: Bullets (Pure Melee Boss)
 * HITBOX: User Fixed Values.
 */

// ▼▼▼ HITBOX GIỮ NGUYÊN ▼▼▼
window.HITBOX_CFG = {
    body: { w: 900, h: 250, dx: 0, dy: 10 },
    head: { w: 300, h: 500, dx: 10, dy: 10 },
    skill: { w: 605, h: 800, dx: 15, dy: -12 },
    player: { w: 45, h: 45, dx: 0, dy: 0 },
};
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const BOSS_CFG = {
    scrollSpeed: 2.1,     
    segmentWidth: 920,    
    segmentCount: 30,     
    bounds: { yPadding: 130 }
};

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
}

// [DELETED PROJECTILE CLASS]

class SnakeHead {
    constructor(id, gameWidth, y, direction) {
        this.id = id; this.gameWidth = gameWidth;
        this.y = y; this.baseY = y;
        this.direction = direction; 
        this.isActive = false; this.velocity = 0;
        this.width = BOSS_CFG.segmentWidth; 
        this.height = 300; 
        let startX = (direction === -1) ? gameWidth + 2000 : -2000;
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
        this.state='INTRO'; this.timer=0; this.visualHp=0; 
        this.introOpacity=1; 
        this.shake={x:0,y:0,force:0}; this.events={s1:false, s2:false, ghostEnter: false, rev:false};
        this.isWarning=false;
        this.resize(w, h);
    }
    resize(w, h) {
        this.width = w; this.height = h;
        if(this.state === 'INTRO' && !this.events.ghostEnter) {
            this.ghostX = w + 600; 
        } else {
            this.ghostX = w * 0.95; 
        }
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
    }
    updateIntro(dt) {
        this.timer += dt; let t = this.timer;
        this.isWarning = (t < 2000);
        if(t > 1500 && !this.events.s1) { this.events.s1=true; this.snakes[0].activate(); this.shake.force=12; }
        if(t > 4500 && !this.events.s2) { this.events.s2=true; this.snakes[1].activate(); this.shake.force=12; }
        
        if(t > 8500) {
            if(!this.events.ghostEnter) this.events.ghostEnter=true; 
            let targetX = this.width * 0.95; 
            if (this.ghostX > targetX) this.ghostX += (targetX - this.ghostX) * 0.025; 
        }

        if(t > 10500) {
            if(this.visualHp<100) this.visualHp+=0.15*dt;
            if(!this.events.rev) { this.events.rev=true; this.shake.force=25; }
        }
        
        if(t > 13000) { this.state='FIGHT'; this.visualHp=100; this.ghostX = this.width * 0.95; }
    }
    updateFight(dt) {
        // [DELETED BULLET FIRE LOGIC]
        // Chỉ còn logic giữ vị trí boss ghost
        let targetX = this.width * 0.95; 
        if (Math.abs(this.ghostX - targetX) > 1) {
            this.ghostX += (targetX - this.ghostX) * 0.1;
        }
    }

    checkCollision(player) {
        if(this.state !== 'FIGHT') return false;
        
        let cfg = window.HITBOX_CFG;
        if(!cfg) return false;

        let phb = cfg.player;
        let pRect = {
            x: player.x + phb.dx + (40 - phb.w/2), 
            y: player.y + phb.dy + (40 - phb.h/2),
            w: phb.w, h: phb.h
        };

        // [DELETED BULLET COLLISION CHECK]

        let hbBody = cfg.body;
        let hbHead = cfg.head;
        
        for(let s of this.snakes) {
            // Body Check
            for(let seg of s.segments) {
                let r = {
                    x: seg.x + hbBody.dx - hbBody.w/2,
                    y: seg.y + hbBody.dy - hbBody.h/2,
                    w: hbBody.w, h: hbBody.h
                };
                if(rectIntersect(pRect, r)) return true;
            }

            // Head Check
            let hOffX = -50; 
            let hx = (s.headX || s.x);
            if(s.id===1) hx += hOffX; else hx -= hOffX;
            let hy = s.y - 50; if(s.id===2) hy += 60; 
            let headDx = (s.direction === -1) ? hbHead.dx : -hbHead.dx;
            
            let headR = {
                x: hx + headDx - hbHead.w/2,
                y: hy + hbHead.dy - hbHead.h/2,
                w: hbHead.w, h: hbHead.h
            };
            if(rectIntersect(pRect, headR)) return true;
        }

        let ghostHb = cfg.skill;
        if(ghostHb) {
            let ghostR = {
                x: this.ghostX + ghostHb.dx - ghostHb.w/2,
                y: this.ghostY + ghostHb.dy - ghostHb.h/2,
                w: ghostHb.w, 
                h: ghostHb.h
            };
            if(rectIntersect(pRect, ghostR)) return true;
        }
        return false;
    }
}
window.BossController = BossController;