import { Themes, BotPersonalities, ProjectileType } from "./constants.js";
import { generateRandomInventory } from "./utils.js";

export const state = {
    gameState: "start",
    terrain: [],
    wind: { x: 0, y: 0 },
    currentPlayer: 1,
    player1Tank: {
        x: 100,
        y: 0,
        color: "lime",
        turretAngle: -Math.PI / 4,
        health: 3,
        selectedWeapon: ProjectileType.REGULAR,
        weapons: generateRandomInventory(),
    },
    player2Tank: {
        x: 700,
        y: 0,
        color: "red",
        turretAngle: -Math.PI * 0.75,
        health: 3,
        selectedWeapon: ProjectileType.REGULAR,
        weapons: generateRandomInventory(),
    },
    projectiles: [],
    explosions: [],
    windParticles: [],
    particles: [],
    napalmZones: [],
    chargePower: 0,
    chargeStartTime: 0,
    heldKeys: new Set(),
    lastFrameTime: Date.now(),
    currentTheme: Themes.NORMAL,
    currentDifficulty: BotPersonalities.VETERAN,
    isGameRunning: false,
    isCampaignMode: false,
    currentCampaignLevel: 0,
    bot: null, // Will be initialized later
};
