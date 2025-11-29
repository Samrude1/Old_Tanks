export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");

export const SCREEN_WIDTH = canvas.width;
export const SCREEN_HEIGHT = canvas.height;
export const TANK_WIDTH = 20;
export const TANK_HEIGHT = 10;
export const TURRET_LENGTH = 15;

export const GRAVITY = 150;
export const MAX_WIND_SPEED = 50;
export const MAX_LAUNCH_SPEED = 600;
export const PROJECTILE_SPEED_MULTIPLIER = 1.0;
export const MAX_CHARGE_TIME = 2000; // ms

// ===== GAME STATE ENUMS =====
export const GameState = {
    START: "start",
    AIM: "aim",
    POWER: "power",
    RESOLVE: "resolve",
    GAME_OVER: "game_over",
};

// ===== THEMES =====
export const Themes = {
    NORMAL: {
        skyTop: "#c3d6ffff",
        skyBottom: "#3168ffff",
        ground: "#228B22",
        groundOutline: "#1a6b1a",
    },
    DESERT: {
        skyTop: "#87CEEB",
        skyBottom: "#E0F6FF",
        ground: "#F4A460",
        groundOutline: "#8B4513",
    },
    WINTER: {
        skyTop: "#E0FFFF",
        skyBottom: "#B0E0E6",
        ground: "#F0F8FF",
        groundOutline: "#4682B4",
    },
};

// ===== PROJECTILE TYPES =====
export const ProjectileType = {
    REGULAR: {
        id: "REGULAR",
        name: "Regular",
        explosionRadius: 30,
        color: "yellow",
        rarity: 0,
    },
    CLUSTER: {
        id: "CLUSTER",
        name: "Cluster",
        explosionRadius: 20,
        color: "orange",
        childCount: 5,
        childRadius: 12,
        rarity: 1,
    },
    BOUNCING: {
        id: "BOUNCING",
        name: "Bouncing",
        explosionRadius: 25,
        color: "cyan",
        bounces: 2,
        rarity: 1,
    },
    HEAVY: {
        id: "HEAVY",
        name: "Heavy",
        explosionRadius: 70,
        color: "red",
        rarity: 2,
    },
    DIGGER: {
        id: "DIGGER",
        name: "Digger",
        explosionRadius: 35,
        color: "brown",
        penetrationDepth: 80,
        rarity: 2,
    },
    NAPALM: {
        id: "NAPALM",
        name: "Napalm",
        explosionRadius: 25,
        color: "orangered",
        fireDuration: 1000,
        fireRadius: 60,
        rarity: 2,
    },
    MIRV: {
        id: "MIRV",
        name: "MIRV",
        explosionRadius: 20,
        color: "purple",
        childCount: 3,
        childRadius: 30,
        rarity: 3,
    },
    TELEPORTER: {
        id: "TELEPORTER",
        name: "Teleporter",
        color: "cyan",
        rarity: 3,
    },
};

// ===== BOT PERSONALITIES =====
export const BotPersonalities = {
    ROOKIE: {
        name: "Rookie",
        kFactor: 0.3,
        randomness: 50,
        weaponAggression: 0.1, // 10% chance for special
    },
    VETERAN: {
        name: "Veteran",
        kFactor: 0.6,
        randomness: 10,
        weaponAggression: 0.4, // 40% chance
    },
    SNIPER: {
        name: "Sniper",
        kFactor: 0.9,
        randomness: 2,
        weaponAggression: 0.6, // 60% chance
    },
    ELITE: {
        name: "Elite",
        kFactor: 1.0,
        randomness: 0,
        weaponAggression: 0.8, // 80% chance
    },
};

// ===== CAMPAIGN LEVELS =====
export const CampaignLevels = [
    {
        name: "Boot Camp",
        theme: Themes.NORMAL,
        difficulty: BotPersonalities.ROOKIE,
    },
    {
        name: "Grass Valley",
        theme: Themes.NORMAL,
        difficulty: BotPersonalities.ROOKIE,
    },
    {
        name: "Sandy Shores",
        theme: Themes.DESERT,
        difficulty: BotPersonalities.VETERAN,
    },
    {
        name: "Desert Storm",
        theme: Themes.DESERT,
        difficulty: BotPersonalities.VETERAN,
    },
    {
        name: "Snowy Hills",
        theme: Themes.WINTER,
        difficulty: BotPersonalities.SNIPER,
    },
    {
        name: "Final Showdown",
        theme: Themes.WINTER,
        difficulty: BotPersonalities.ELITE,
    },
];
