import { state } from "./state.js";
import {
    ctx,
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    ProjectileType,
    GameState,
} from "./constants.js";
import { drawStar } from "./utils.js";

// ===== PROJECTILE RENDERING WITH UNIQUE VISUALS =====
export function drawProjectile(p) {
    const time = Date.now() / 1000;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Draw trail first (behind projectile)
    if (p.trail && p.trail.length > 0) {
        // Medium gray trail, more visible but balanced
        ctx.strokeStyle = "rgba(100, 100, 100, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        p.trail.forEach((t, i) => {
            const worldX = t.x - p.x;
            const worldY = t.y - p.y;
            if (i === 0) ctx.moveTo(worldX, worldY);
            else ctx.lineTo(worldX, worldY);
        });
        ctx.stroke();
    }

    // Draw projectile based on type
    switch (p.type) {
        case ProjectileType.REGULAR:
            // Pulsing yellow star
            const pulse = 0.8 + Math.sin(time * 10) * 0.2;
            ctx.fillStyle = "#FFD700";
            ctx.strokeStyle = "#FFA500";
            ctx.lineWidth = 2;
            drawStar(0, 0, 5, 5 * pulse, 3 * pulse);
            ctx.fill();
            ctx.stroke();
            break;

        case ProjectileType.CLUSTER:
            // Spinning orange ball with sparks
            const clusterRotation = time * 5;
            ctx.rotate(clusterRotation);

            // Main ball
            ctx.fillStyle = "#FF8C00";
            ctx.strokeStyle = "#FF4500";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Sparks
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                ctx.fillStyle = "#FFA500";
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * 6, Math.sin(angle) * 6, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            break;

        case ProjectileType.BOUNCING:
            // Cyan rotating ball with motion lines
            const bounceRotation = time * 8;

            // Motion lines
            ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const offset = i * 3;
                ctx.beginPath();
                ctx.arc(0, 0, 4 + offset, bounceRotation, bounceRotation + Math.PI);
                ctx.stroke();
            }

            // Main ball
            ctx.fillStyle = "#00FFFF";
            ctx.strokeStyle = "#00CED1";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

        case ProjectileType.HEAVY:
            // Large red bomb with flame trail
            const heavyPulse = 0.9 + Math.sin(time * 8) * 0.1;

            // Flame effect
            ctx.fillStyle = "rgba(255, 100, 0, 0.6)";
            ctx.beginPath();
            ctx.arc(0, 0, 8 * heavyPulse, 0, Math.PI * 2);
            ctx.fill();

            // Main bomb
            ctx.fillStyle = "#DC143C";
            ctx.strokeStyle = "#8B0000";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Highlight
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.beginPath();
            ctx.arc(-2, -2, 2, 0, Math.PI * 2);
            ctx.fill();
            break;

        case ProjectileType.DIGGER:
            // Brown spinning drill
            const drillRotation = time * 12;
            ctx.rotate(drillRotation);

            // Drill bit
            ctx.fillStyle = "#8B4513";
            ctx.strokeStyle = "#654321";
            ctx.lineWidth = 2;

            // Draw drill shape
            ctx.beginPath();
            ctx.moveTo(0, -5);
            ctx.lineTo(3, 0);
            ctx.lineTo(0, 5);
            ctx.lineTo(-3, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Center
            ctx.fillStyle = "#A0522D";
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, Math.PI * 2);
            ctx.fill();
            break;

        case ProjectileType.NAPALM:
            // Fire trail effect
            const napalmFlicker = Math.random();

            // Outer flame
            ctx.fillStyle = `rgba(255, 69, 0, ${0.6 + napalmFlicker * 0.2})`;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();

            // Middle flame
            ctx.fillStyle = `rgba(255, 140, 0, ${0.7 + napalmFlicker * 0.2})`;
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.fillStyle = "#FFD700";
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
            break;

        case ProjectileType.MIRV:
            // Purple with electric arcs
            const mirvPulse = 0.8 + Math.sin(time * 12) * 0.2;

            // Electric arcs
            ctx.strokeStyle = "rgba(138, 43, 226, 0.8)";
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                const angle = time * 5 + (i * Math.PI * 2) / 3;
                const x = Math.cos(angle) * 7;
                const y = Math.sin(angle) * 7;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(x, y);
                ctx.stroke();
            }

            // Main projectile
            ctx.fillStyle = "#9370DB";
            ctx.strokeStyle = "#8A2BE2";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 4 * mirvPulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

        case ProjectileType.TELEPORTER:
            // Cyan spiral effect
            const teleportRotation = time * 10;

            // Spiral
            ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const spiralAngle = teleportRotation + (i * Math.PI * 2) / 3;
                const radius = 3 + i * 2;
                ctx.beginPath();
                ctx.arc(0, 0, radius, spiralAngle, spiralAngle + Math.PI);
                ctx.stroke();
            }

            // Center
            ctx.fillStyle = "#00FFFF";
            ctx.strokeStyle = "#00CED1";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;

        default:
            // Fallback: simple circle
            ctx.fillStyle = p.type.color || "white";
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
    }

    ctx.restore();
}

export function drawTank(tank) {
    if (tank.health <= 0) return;
    ctx.save();
    ctx.translate(tank.x, tank.y);

    // Cartoon style: Black outline (thinner)
    ctx.fillStyle = tank.color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;

    // 1. Tracks (Bottom)
    ctx.fillStyle = "#333";
    ctx.fillRect(-12, 6, 24, 6);
    ctx.strokeRect(-12, 6, 24, 6);

    // 2. Main Body (Rounded)
    ctx.fillStyle = tank.color;
    ctx.beginPath();
    ctx.roundRect(-10, -2, 20, 10, 3);
    ctx.fill();
    ctx.stroke();

    // 3. Turret (Dome)
    ctx.beginPath();
    ctx.arc(0, -2, 7, Math.PI, 0); // Semi-circle dome
    ctx.lineTo(7, -2);
    ctx.lineTo(-7, -2);
    ctx.fill();
    ctx.stroke();

    // 4. Barrel
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -4); // Start from center of dome
    ctx.lineTo(
        Math.cos(tank.turretAngle) * 18,
        Math.sin(tank.turretAngle) * 18 - 4
    );
    ctx.stroke();

    ctx.restore();
}

export function drawUI() {
    // Cartoon style: Bigger, bolder text with shadows
    ctx.font = "bold 24px 'Fredoka', sans-serif";
    ctx.textAlign = "left";

    // Player 1 health with shadow
    ctx.fillStyle = "#000";
    ctx.fillText(`P1: ${"♥".repeat(state.player1Tank.health)}`, 12, 32);
    ctx.fillStyle = "#FF1744";
    ctx.fillText(`P1: ${"♥".repeat(state.player1Tank.health)}`, 10, 30);

    // Bot health with shadow
    ctx.textAlign = "right";
    ctx.fillStyle = "#000";
    ctx.fillText(`Bot: ${"♥".repeat(state.player2Tank.health)}`, SCREEN_WIDTH - 8, 32);
    ctx.fillStyle = "#FF1744";
    ctx.fillText(`Bot: ${"♥".repeat(state.player2Tank.health)}`, SCREEN_WIDTH - 10, 30);

    // Wind and turn info with shadow
    ctx.textAlign = "center";
    ctx.font = "bold 22px 'Fredoka', sans-serif";
    ctx.fillStyle = "#000";
    ctx.fillText(
        `Wind: ${state.wind.x.toFixed(1)} | Turn: P${state.currentPlayer}`,
        SCREEN_WIDTH / 2 + 1,
        31
    );
    ctx.fillStyle = "#ffffffff";
    ctx.fillText(
        `Wind: ${state.wind.x.toFixed(1)} | Turn: P${state.currentPlayer}`,
        SCREEN_WIDTH / 2,
        30
    );

    // Weapon display with shadow
    const currentTank = state.currentPlayer === 1 ? state.player1Tank : state.player2Tank;
    ctx.font = "bold 20px 'Fredoka', sans-serif";
    ctx.fillStyle = "#000";
    ctx.fillText(
        `Weapon: ${currentTank.selectedWeapon.name}`,
        SCREEN_WIDTH / 2 + 1,
        56
    );
    ctx.fillStyle = "#FFD700";
    ctx.fillText(
        `Weapon: ${currentTank.selectedWeapon.name}`,
        SCREEN_WIDTH / 2,
        55
    );

    // Ammo count
    const ammoCount = currentTank.weapons[currentTank.selectedWeapon.id];
    const ammoText = ammoCount === Infinity ? "∞" : `x${ammoCount}`;

    ctx.fillStyle = "#000";
    ctx.fillText(ammoText, SCREEN_WIDTH / 2 + 1, 80);
    ctx.fillStyle = "#FFF";
    ctx.fillText(ammoText, SCREEN_WIDTH / 2, 79);

    // Power bar - cartoon style with thick border
    if (state.gameState === GameState.POWER) {
        ctx.fillStyle = "#FF6B00";
        ctx.fillRect(SCREEN_WIDTH / 2 - 100, 65, 200 * state.chargePower, 15);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeRect(SCREEN_WIDTH / 2 - 100, 65, 200, 15);
    }

    // Game over screen - cartoon style
    if (state.gameState === GameState.GAME_OVER) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        ctx.font = "bold 60px 'Fredoka One', cursive";
        const winner = state.player1Tank.health > 0 ? "YOU WIN!" : "BOT WINS!";

        // Shadow
        ctx.fillStyle = "#000";
        ctx.fillText(winner, SCREEN_WIDTH / 2 + 3, SCREEN_HEIGHT / 2 + 3);

        // Main text
        ctx.fillStyle = state.player1Tank.health > 0 ? "#FFD700" : "#FF1744";
        ctx.fillText(winner, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

        ctx.font = "bold 28px 'Fredoka', sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText(
            "Press R to Restart",
            SCREEN_WIDTH / 2 + 2,
            SCREEN_HEIGHT / 2 + 52
        );
        ctx.fillStyle = "#FFF";
        ctx.fillText(
            "Press R to Restart",
            SCREEN_WIDTH / 2,
            SCREEN_HEIGHT / 2 + 50
        );
    }
}

export function draw() {
    // Cartoon style: Bright blue sky with gradient (Theme based)
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, state.currentTheme.skyTop); // Sky top
    gradient.addColorStop(0.6, state.currentTheme.skyTop); // Mid
    gradient.addColorStop(1, state.currentTheme.skyBottom); // Horizon
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    state.windParticles.forEach((p) => p.draw());

    // Cartoon style: Vibrant grass (Theme based)
    ctx.fillStyle = state.currentTheme.ground;
    ctx.beginPath();
    ctx.moveTo(0, SCREEN_HEIGHT);
    for (let x = 0; x < SCREEN_WIDTH; x++) ctx.lineTo(x, state.terrain[x]);
    ctx.lineTo(SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fill();

    // Add darker outline for cartoon effect (Theme based)
    ctx.strokeStyle = state.currentTheme.groundOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, state.terrain[0]);
    for (let x = 1; x < SCREEN_WIDTH; x++) ctx.lineTo(x, state.terrain[x]);
    ctx.stroke();

    drawTank(state.player1Tank);
    drawTank(state.player2Tank);

    state.projectiles.forEach((p) => {
        drawProjectile(p);
    });

    state.explosions.forEach((e) => e.draw());
    state.particles.forEach((p) => p.draw());
    state.napalmZones.forEach((z) => z.draw());

    drawUI();
}
