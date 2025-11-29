import { SCREEN_WIDTH, SCREEN_HEIGHT, TANK_HEIGHT, MAX_WIND_SPEED } from "./constants.js";
import { state } from "./state.js";
import { WindParticle } from "./classes/Particles.js";

// ===== TERRAIN & SETUP =====
export function generateTerrain() {
    state.terrain = [];

    // 1. Generate control points (Rolling Hills)
    const segmentWidth = 100;
    const numSegments = Math.ceil(SCREEN_WIDTH / segmentWidth) + 1;
    const controlPoints = [];

    for (let i = 0; i < numSegments; i++) {
        // Random height between 300 and 500 (Screen Height is 600)
        // Keep it somewhat level for playability
        controlPoints.push(350 + Math.random() * 150);
    }

    // 2. Interpolate
    for (let x = 0; x < SCREEN_WIDTH; x++) {
        const segmentIndex = Math.floor(x / segmentWidth);
        const segmentT = (x % segmentWidth) / segmentWidth;

        const y1 = controlPoints[segmentIndex];
        const y2 = controlPoints[segmentIndex + 1] || y1; // Handle last segment

        // Cosine Interpolation for smooth hills
        const mu2 = (1 - Math.cos(segmentT * Math.PI)) / 2;
        let height = y1 * (1 - mu2) + y2 * mu2;

        // 3. Add small noise for texture
        height += (Math.random() - 0.5) * 5;

        state.terrain[x] = height;
    }
}

export function placeTanks() {
    state.player1Tank.x = 100;
    state.player1Tank.y = state.terrain[100] - TANK_HEIGHT;
    state.player1Tank.health = 3;

    state.player2Tank.x = SCREEN_WIDTH - 100;
    state.player2Tank.y = state.terrain[SCREEN_WIDTH - 100] - TANK_HEIGHT;
    state.player2Tank.health = 3;
}

export function setRandomWind() {
    state.wind = { x: (Math.random() - 0.5) * MAX_WIND_SPEED, y: 0 };
    state.windParticles.forEach((p) => (p.vx = state.wind.x * 5));
}
