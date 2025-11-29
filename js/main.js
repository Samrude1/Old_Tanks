import { state } from "./state.js";
import { GameState } from "./constants.js";
import { ShooterBot } from "./classes/ShooterBot.js";
import { generateTerrain, setRandomWind } from "./terrain.js";
import { draw } from "./render.js";
import {
    updateTank,
    updatePowerCharging,
    updateProjectiles,
    updateExplosions,
} from "./physics.js";
import { checkGameOver, initializeGame } from "./gameLogic.js";
import { setupInputListeners, updatePlayerAiming } from "./input.js";
import { selectTheme, selectDifficulty, selectMode, startGame, continueToNextLevel, retryLevel, returnToMenu, showMainMenu } from "./ui.js";

// Expose UI functions to window for HTML onclick handlers
window.selectTheme = selectTheme;
window.selectDifficulty = selectDifficulty;
window.selectMode = selectMode;
window.startGame = startGame;
window.continueToNextLevel = continueToNextLevel;
window.retryLevel = retryLevel;
window.returnToMenu = returnToMenu;
window.showMainMenu = showMainMenu;

// Initialize Bot
state.bot = new ShooterBot(state.currentDifficulty);

// Setup Input
setupInputListeners();

// Initial Setup
generateTerrain();
draw();

// ===== MAIN LOOPS =====
function update() {
    const now = Date.now();
    const dt = (now - state.lastFrameTime) / 1000;
    state.lastFrameTime = now;

    updateTank(state.player1Tank, dt);
    updateTank(state.player2Tank, dt);
    state.windParticles.forEach((p) => p.update(dt));

    for (let i = state.particles.length - 1; i >= 0; i--) {
        state.particles[i].update(dt);
        if (state.particles[i].isDead) {
            state.particles.splice(i, 1);
        }
    }

    for (let i = state.napalmZones.length - 1; i >= 0; i--) {
        state.napalmZones[i].update(dt);
        if (state.napalmZones[i].isDead) {
            state.napalmZones.splice(i, 1);
        }
    }

    switch (state.gameState) {
        case GameState.AIM:
            if (state.currentPlayer === 1) {
                updatePlayerAiming(dt);
            } else {
                state.bot.update(dt);
            }
            break;
        case GameState.POWER:
            if (state.currentPlayer === 1) updatePowerCharging(dt);
            else state.bot.update(dt);
            break;
        case GameState.RESOLVE:
            updateProjectiles(dt);
            updateExplosions(dt);
            if (
                state.projectiles.length === 0 &&
                state.explosions.length === 0 &&
                state.particles.length === 0 &&
                state.napalmZones.length === 0
            ) {
                if (!checkGameOver()) {
                    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
                    setRandomWind();
                    state.gameState = GameState.AIM;

                    if (state.currentPlayer === 2) state.bot.prepareTurn();
                }
            }
            break;
    }
}

function loop() {
    if (state.isGameRunning) {
        update();
        draw();
    }
    requestAnimationFrame(loop);
}

loop();
