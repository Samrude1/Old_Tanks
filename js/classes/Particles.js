import { SCREEN_WIDTH, SCREEN_HEIGHT, GRAVITY, ctx } from "../constants.js";
import { state } from "../state.js";
import { playTankDestroySound, playTankHitSound } from "../audio.js";
import { checkGameOver } from "../gameLogic.js";

// ===== WIND PARTICLE SYSTEM =====
export class WindParticle {
    constructor() {
        this.respawn();
    }
    respawn() {
        this.x = Math.random() * SCREEN_WIDTH;
        this.y = Math.random() * SCREEN_HEIGHT;
        this.vx = state.wind.x * 5;
        this.vy = 0;
    }
    update(deltaTime) {
        const targetVx = state.wind.x * 5;
        this.vx = this.vx * 0.95 + targetVx * 0.05;
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        if (this.x < 0) this.x += SCREEN_WIDTH;
        else if (this.x >= SCREEN_WIDTH) this.x -= SCREEN_WIDTH;
        if (this.y < 0) this.y += SCREEN_HEIGHT;
        else if (this.y >= SCREEN_HEIGHT) this.y -= SCREEN_HEIGHT;
    }
    draw() {
        // Enhanced visibility - larger, darker particles for bright backgrounds
        ctx.fillStyle = "rgba(50, 50, 50, 0.6)";
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 3, 3);
    }
}

// ===== PARTICLE & NAPALM SYSTEMS =====
export class NapalmZone {
    constructor(x, y, radius, duration) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.duration = duration / 1000;
        this.timer = 0;
        this.isDead = false;
        this.damageTimer = 0;
    }
    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) {
            this.isDead = true;
            return;
        }

        if (Math.random() > 0.8) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.radius;
            state.particles.push(
                new Particle(
                    this.x + Math.cos(angle) * dist,
                    this.y + Math.sin(angle) * dist,
                    0,
                    -20,
                    "smoke"
                )
            );
        }

        this.damageTimer += dt;
        if (this.damageTimer > 0.5) {
            this.damageTimer = 0;
            [state.player1Tank, state.player2Tank].forEach((tank) => {
                const dx = tank.x - this.x;
                const dy = tank.y - this.y;
                if (Math.hypot(dx, dy) < this.radius) {
                    tank.health = Math.max(0, tank.health - 1);
                    if (tank.health === 0) {
                        playTankDestroySound();
                        checkGameOver();
                    } else {
                        playTankHitSound();
                    }
                }
            });
        }
    }
    draw() {
        ctx.fillStyle = "rgba(255, 100, 0, 0.2)";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "orange";
        ctx.stroke();
    }
}

export class Particle {
    constructor(x, y, vx, vy, type = "debris") {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.lifetime = 0;
        this.maxLifetime = 1.0;
        this.size = Math.random() * 3 + 1;
        this.isDead = false;
        this.color = type === "smoke" ? "rgba(100,100,100,0.5)" : "orange";
    }
    update(dt) {
        this.lifetime += dt;
        if (this.lifetime >= this.maxLifetime) this.isDead = true;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.type === "debris") this.vy += GRAVITY * dt;
    }
    draw() {
        // KORJAUS: Tallenna piirtotila ennen alpha-muutosta.
        ctx.save();

        ctx.globalAlpha = 1 - this.lifetime / this.maxLifetime;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);

        // Palauta piirtotila. Tämä palauttaa globalAlpha:n automaattisesti 1.0:aan.
        ctx.restore();
    }
}

export function createExplosionParticles(x, y, radius) {
    // Optimized: Reduced particle count from 10 to 8 for better performance
    const particleCount = Math.min(8, Math.floor(radius / 5));
    for (let i = 0; i < particleCount; i++) {
        state.particles.push(
            new Particle(
                x,
                y,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100,
                "debris"
            )
        );
    }
}

export function createMuzzleFlash(x, y, angle) {
    state.particles.push(
        new Particle(x, y, Math.cos(angle) * 50, Math.sin(angle) * 50, "smoke")
    );
}

// ===== EXPLOSION CLASS & UPDATES =====
export class Explosion {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.progress = 0;
        this.duration = 500;
        this.triggered = false;
        this.isDead = false;
    }
    update(dt) {
        this.progress += dt * 1000;
        if (this.progress >= this.duration) this.isDead = true;
        if (this.progress >= this.duration / 2 && !this.triggered) this.trigger();
    }
    trigger() {
        this.triggered = true;
        for (let i = -this.radius; i <= this.radius; i++) {
            let targetX = Math.floor(this.x + i);
            if (targetX >= 0 && targetX < SCREEN_WIDTH) {
                let craterDepth = Math.sqrt(this.radius ** 2 - i ** 2);
                let craterBottom = this.y + craterDepth;
                if (state.terrain[targetX] < craterBottom) state.terrain[targetX] = craterBottom;
                state.terrain[targetX] = Math.min(state.terrain[targetX], SCREEN_HEIGHT);
            }
        }
        createExplosionParticles(this.x, this.y, this.radius);
        [state.player1Tank, state.player2Tank].forEach((tank) => {
            const dist = Math.hypot(tank.x - this.x, tank.y - this.y);
            if (dist < this.radius + 10) {
                tank.health = Math.max(0, tank.health - 1);
                if (tank.health <= 0) playTankDestroySound();
                else playTankHitSound();
            }
        });
    }
    draw() {
        ctx.fillStyle = "rgba(255, 180, 60, 0.8)";
        ctx.beginPath();
        ctx.arc(
            this.x,
            this.y,
            this.radius * ((this.progress / this.duration) * 2),
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}
