import { state } from "./state.js";
import { GameState, CampaignLevels, ProjectileType } from "./constants.js";
import {
    showLevelComplete,
    showCampaignComplete,
    showMissionFailed,
} from "./ui.js";
import { generateTerrain, placeTanks, setRandomWind } from "./terrain.js";
import { WindParticle } from "./classes/Particles.js";
import { generateRandomInventory } from "./utils.js";

export function checkGameOver() {
    if (state.player1Tank.health <= 0 || state.player2Tank.health <= 0) {
        state.gameState = GameState.GAME_OVER;

        // Campaign Mode Logic
        if (state.isCampaignMode) {
            if (state.player1Tank.health > 0) {
                // Player Won
                if (state.currentCampaignLevel < CampaignLevels.length) {
                    // Not final level - show level complete
                    showLevelComplete();
                } else {
                    // Final level - show campaign complete
                    showCampaignComplete();
                }
            } else {
                // Player Lost
                showMissionFailed();
            }
        }

        return true;
    }
    return false;
}

export function initializeGame() {
    generateTerrain();
    placeTanks();
    setRandomWind();
    state.windParticles = [];
    // Optimized: 80 particles instead of 100 for better performance while maintaining visibility
    for (let i = 0; i < 80; i++) state.windParticles.push(new WindParticle());
    state.gameState = GameState.AIM;
    state.currentPlayer = 1;
    state.projectiles = [];
    state.explosions = [];
    state.particles = [];
    state.napalmZones = [];
    state.chargePower = 0;
    if (state.bot) {
        state.bot.lastImpactX = 0;
        state.bot.turnCounter = 0;
    }

    // Aseet nollataan ja arvotaan uudet
    state.player1Tank.weapons = generateRandomInventory();
    state.player2Tank.weapons = generateRandomInventory();
    state.player1Tank.selectedWeapon = ProjectileType.REGULAR;
    state.player2Tank.selectedWeapon = ProjectileType.REGULAR;
}
