// ===== GAME CONSTANTS =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const SCREEN_WIDTH = canvas.width;
const SCREEN_HEIGHT = canvas.height;
const TANK_WIDTH = 20;
const TANK_HEIGHT = 10;
const TURRET_LENGTH = 15;

const GRAVITY = 150;
const MAX_WIND_SPEED = 50;
const MAX_LAUNCH_SPEED = 600;
const PROJECTILE_SPEED_MULTIPLIER = 1.0;

// ===== GAME STATE =====
const GameState = {
  START: "start",
  AIM: "aim",
  POWER: "power",
  RESOLVE: "resolve",
  GAME_OVER: "game_over",
};

// ===== THEMES =====
const Themes = {
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

let currentTheme = Themes.NORMAL;
let currentDifficulty = null; // Will be set after BotPersonalities is defined
let isGameRunning = false;

// Campaign Mode
let isCampaignMode = false;
let currentCampaignLevel = 0; // 0 = not in campaign, 1-3 = level number

// ===== PROJECTILE TYPES =====
const ProjectileType = {
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

// ===== INVENTORY UTILS =====
function generateRandomInventory(isCampaign = false) {
  const inventory = {};
  for (const key in ProjectileType) {
    const type = ProjectileType[key];
    if (type.rarity === 0) {
      inventory[key] = Infinity;
    } else if (type.rarity === 1) {
      inventory[key] = Math.floor(Math.random() * 3) + 3; // 3-5
    } else if (type.rarity === 2) {
      inventory[key] = Math.floor(Math.random() * 3) + 1; // 1-3
    } else if (type.rarity === 3) {
      // In campaign mode, guarantee at least 1 MIRV/Teleporter
      if (isCampaign) {
        inventory[key] = Math.floor(Math.random() * 2) + 1; // 1-2
      } else {
        inventory[key] = Math.random() < 0.5 ? 0 : 1; // 0-1
      }
    }
  }
  return inventory;
}

// ===== GAME VARIABLES =====
let gameState = GameState.START;
let terrain = [];
let wind = { x: 0, y: 0 };
let currentPlayer = 1;

let player1Tank = {
  x: 100,
  y: 0,
  color: "lime",
  turretAngle: -Math.PI / 4,
  health: 3,
  selectedWeapon: ProjectileType.REGULAR,
  weapons: generateRandomInventory(),
};

let player2Tank = {
  x: 700,
  y: 0,
  color: "red",
  turretAngle: -Math.PI * 0.75,
  health: 3,
  selectedWeapon: ProjectileType.REGULAR,
  weapons: generateRandomInventory(),
};

let projectiles = [];
let explosions = [];
let windParticles = [];
let particles = [];
let napalmZones = [];

let chargePower = 0;
let chargeStartTime = 0;
const MAX_CHARGE_TIME = 2000; // ms

const heldKeys = new Set();
let lastFrameTime = Date.now();

// ===== SOUND =====
function playShootSound() {
  new Audio("sounds/shoot.wav").play();
  console.log("🔊 SHOOT");
}
function playGroundHitSound() {
  new Audio("sounds/ground_hit.wav").play();
  console.log("🔊 GROUND HIT");
}
function playTankHitSound() {
  new Audio("sounds/tank_hit.wav").play();
  console.log("🔊 TANK HIT");
}
function playTankDestroySound() {
  new Audio("sounds/tank_destroy.wav").play();
  console.log("🔊 TANK DESTROYED");
}
function playNapalmSound() {
  new Audio("sounds/napalm.wav").play();
  console.log("🔊 NAPALM");
}
function playTeleportSound() {
  new Audio("sounds/teleport.wav").play();
  console.log("🔊 TELEPORT");
}

// ===== BOT PERSONALITIES =====
const BotPersonalities = {
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

// Set default difficulty
currentDifficulty = BotPersonalities.VETERAN;

// ===== CAMPAIGN LEVELS =====
const CampaignLevels = [
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

// ===== SHOOTER BOT AI =====
class ShooterBot {
  constructor(personality = BotPersonalities.VETERAN) {
    this.personality = personality;
    this.K_FACTOR = personality.kFactor;
    this.lastPower = 0;
    this.lastImpactX = 0;
    this.currentAngle = -Math.PI * 0.75;
    this.state = "WAITING";
    this.timer = 0;
    this.targetPower = 0;
    this.turnCounter = 0;
    console.log(`🤖 Bot Initialized: ${this.personality.name}`);
  }

  prepareTurn() {
    this.state = "WAITING";
    this.timer = 0;
    this.turnCounter++;
    this.calculateShot();
    console.log("🤖 Bot turn started. Calculating shot.");
  }

  isLOSBlocked(botX, botY, targetX, targetY) {
    const startX = Math.min(botX, targetX);
    const endX = Math.max(botX, targetX);
    const step = 20;
    const slope = (targetY - botY) / (targetX - botX);

    for (let x = startX + step; x < endX; x += step) {
      const lineY = botY + slope * (x - botX);
      if (terrain[Math.floor(x)] < lineY - 30) {
        return true;
      }
    }
    return false;
  }

  calculateShot() {
    const botTank = player2Tank;
    const targetTank = player1Tank;

    // Aseenvalinta (AI)
    const inventory = botTank.weapons;
    const availableWeapons = Object.keys(inventory).filter(
      (key) => inventory[key] > 0 && key !== "REGULAR" && key !== "TELEPORTER"
    );

    // 1. EASTER EGG: Teleporter (1% chance if available)
    if (inventory.TELEPORTER > 0 && Math.random() < 0.01) {
      botTank.selectedWeapon = ProjectileType.TELEPORTER;
      console.log("🤖 Bot: EASTER EGG! Using Teleporter.");
    }
    // 2. Kriisitilanne: Botin matala elinvoima
    else if (botTank.health <= 1 && availableWeapons.length > 0) {
      // Yritä löytää vahva ase
      const strongWeapons = availableWeapons.filter(
        (k) => k === "MIRV" || k === "HEAVY" || k === "NAPALM"
      );
      if (strongWeapons.length > 0) {
        const chosen =
          strongWeapons[Math.floor(Math.random() * strongWeapons.length)];
        botTank.selectedWeapon = ProjectileType[chosen];
        console.log(
          `🤖 Bot: Desperate shot! Using ${botTank.selectedWeapon.name}.`
        );
      } else {
        // Fallback to any available special
        const chosen =
          availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        botTank.selectedWeapon = ProjectileType[chosen];
        console.log(
          `🤖 Bot: Low health fallback! Using ${botTank.selectedWeapon.name}.`
        );
      }
    }
    // 3. Normaali valinta (Painotettu satunnaisuus Personalityn mukaan)
    else if (
      availableWeapons.length > 0 &&
      Math.random() < this.personality.weaponAggression
    ) {
      // Use special weapon based on aggression
      const chosen =
        availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
      botTank.selectedWeapon = ProjectileType[chosen];
      console.log(
        `🤖 Bot: Using special weapon ${botTank.selectedWeapon.name}.`
      );
    }
    // 4. Default: Regular
    else {
      botTank.selectedWeapon = ProjectileType.REGULAR;
      console.log(`🤖 Bot: Using Regular weapon.`);
    }

    // 1. Angle Selection (Obstacle Logic)
    const initialGroundY = terrain[Math.floor(botTank.x)]; // Current ground level at bot's X
    const CRATER_DEPTH_THRESHOLD = 50; // 50 pikselin syvyys katsotaan kraatteriksi

    if (initialGroundY - botTank.y - TANK_HEIGHT > CRATER_DEPTH_THRESHOLD) {
      // UUSI KORJAUS: Bot on syvässä kraaterissa/kuopassa. Pakotetaan High Arc.
      this.currentAngle = -Math.PI * 0.55; // Hyvin korkea kaari (enemmän y-komponenttia)
      console.log(
        "🤖 Bot: Deep crater detected. Forcing VERY High Arc to prevent overshoot."
      );
    } else if (
      this.isLOSBlocked(botTank.x, botTank.y, targetTank.x, targetTank.y)
    ) {
      this.currentAngle = -Math.PI * 0.65;
      console.log("🤖 Bot: Obstacle detected, using High Arc");
    } else {
      this.currentAngle = -Math.PI * 0.85;
      console.log("🤖 Bot: Line of sight clear, using Low Arc");
    }

    // 2. Power Calculation (Iterative)
    let newPower;

    if (this.lastImpactX === 0) {
      const dist = Math.abs(targetTank.x - botTank.x);
      newPower = dist * 0.55;
    } else {
      const targetDist = botTank.x - targetTank.x;
      const actualDist = botTank.x - this.lastImpactX;
      const error = targetDist - actualDist;

      const currentK =
        Math.abs(this.currentAngle) < 2.3 ? this.K_FACTOR * 1.5 : this.K_FACTOR;

      const correction = error * currentK;

      // KORJAUS 1: Rajoita korjauksen suuruutta estääksesi liian suuret heilahdukset
      const MAX_POWER_CORRECTION = 150;

      let calculatedCorrection = correction;

      // Damping: Jos virhe on erittäin suuri (> 150), vaimenna korjauskerrointa (0.5)
      if (Math.abs(error) > 150) {
        calculatedCorrection *= 0.5;
        console.log(
          `🤖 Bot DAMPING: Large error (${error.toFixed(
            0
          )}) detected. Correction dampened by 50%.`
        );
      }

      const cappedCorrection = Math.max(
        -MAX_POWER_CORRECTION,
        Math.min(MAX_POWER_CORRECTION, calculatedCorrection)
      );

      newPower = this.lastPower + cappedCorrection;

      // Lisää satunnaisuus (Personalityn mukaan)
      const noise = (Math.random() - 0.5) * this.personality.randomness;
      newPower += noise;
      console.log(`🤖 Bot: Added noise ${noise.toFixed(1)} to shot.`);

      // Bouncing-ammus: ammu hieman vajaaksi, koska se pomppii eteenpäin.
      if (botTank.selectedWeapon === ProjectileType.BOUNCING) {
        newPower -= 50; // Intentionally under-power the shot
        console.log(`🤖 Bot: Adjusting power down by 50 for Bouncing shot.`);
      }

      console.log(
        `🤖 Bot Correction: Error=${error.toFixed(
          0
        )}, AppliedCorrection=${cappedCorrection.toFixed(
          0
        )} (Original: ${correction.toFixed(0)})`
      );
    }

    newPower -= wind.x * 2.5;
    newPower = Math.max(50, Math.min(MAX_LAUNCH_SPEED, newPower));

    this.targetPower = newPower;
    this.lastPower = newPower;
  }

  update(deltaTime) {
    this.timer += deltaTime;

    if (this.state === "WAITING") {
      if (this.timer > 1.0) {
        this.state = "AIMING";
        console.log("🤖 Bot: Transition to AIMING.");
      }
    }

    if (this.state === "AIMING") {
      const diff = this.currentAngle - player2Tank.turretAngle;

      if (Math.abs(diff) > 0.05) {
        player2Tank.turretAngle += Math.sign(diff) * deltaTime * 2.0;
      } else {
        player2Tank.turretAngle = this.currentAngle;
        this.state = "CHARGING";

        gameState = GameState.POWER;
        chargeStartTime = Date.now();
        chargePower = 0;
        console.log("🤖 Bot: Aiming complete. Transition to CHARGING.");
      }
    }

    if (this.state === "CHARGING") {
      const requiredCharge = this.targetPower / MAX_LAUNCH_SPEED;
      const elapsed = Date.now() - chargeStartTime;
      chargePower = Math.min(elapsed / MAX_CHARGE_TIME, 1);

      if (chargePower >= requiredCharge) {
        console.log(
          `🤖 Bot: Charge complete (${(requiredCharge * 100).toFixed(
            0
          )}%). Firing projectile.`
        );
        fireProjectile();
        this.state = "FIRED";
      }
    }
  }

  updateLastImpact(x) {
    if (currentPlayer === 2) {
      this.lastImpactX = x;
      console.log(`🤖 Bot recorded impact at X: ${x.toFixed(0)}`);
    }
  }
}

const bot = new ShooterBot(currentDifficulty);

// ===== PROJECTILE UTILS: SPLIT AMMUNITION FUNCTION =====
function splitProjectile(parent) {
  const weapon = parent.type;
  // Lapsiammuksen tyyppi on sama, mutta säde asetetaan childRadius-arvoon
  const childType = { ...weapon, explosionRadius: weapon.childRadius };

  for (let k = 0; k < weapon.childCount; k++) {
    projectiles.push({
      x: parent.x,
      y: parent.y,
      // Lisää pieni satunnainen nopeusmuutos
      vx: parent.vx + (Math.random() - 0.5) * 150,
      vy: parent.vy + (Math.random() - 0.5) * 150,
      type: childType,
      owner: parent.owner,
      trail: [],
      canSplit: false,
      bounces: 0,
      flightTime: 0,
      isFragment: true,
    });
  }
}

// ===== WIND PARTICLE SYSTEM (Ei muutoksia) =====
class WindParticle {
  constructor() {
    this.respawn();
  }
  respawn() {
    this.x = Math.random() * SCREEN_WIDTH;
    this.y = Math.random() * SCREEN_HEIGHT;
    this.vx = wind.x * 5;
    this.vy = 0;
  }
  update(deltaTime) {
    const targetVx = wind.x * 5;
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

// ===== PARTICLE & NAPALM SYSTEMS (Ei muutoksia) =====
class NapalmZone {
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
      particles.push(
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
      [player1Tank, player2Tank].forEach((tank) => {
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

class Particle {
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

function createExplosionParticles(x, y, radius) {
  // Optimized: Reduced particle count from 10 to 8 for better performance
  const particleCount = Math.min(8, Math.floor(radius / 5));
  for (let i = 0; i < particleCount; i++) {
    particles.push(
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
function createMuzzleFlash(x, y, angle) {
  particles.push(
    new Particle(x, y, Math.cos(angle) * 50, Math.sin(angle) * 50, "smoke")
  );
}

// ===== EXPLOSION CLASS & UPDATES =====
class Explosion {
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
        if (terrain[targetX] < craterBottom) terrain[targetX] = craterBottom;
        terrain[targetX] = Math.min(terrain[targetX], SCREEN_HEIGHT);
      }
    }
    createExplosionParticles(this.x, this.y, this.radius);
    [player1Tank, player2Tank].forEach((tank) => {
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

function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update(dt);
    if (explosions[i].isDead) {
      explosions.splice(i, 1);
    }
  }
}

// ===== TERRAIN & SETUP =====
function generateTerrain() {
  terrain = [];

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

    terrain[x] = height;
  }
}

function placeTanks() {
  player1Tank.x = 100;
  player1Tank.y = terrain[100] - TANK_HEIGHT;
  player1Tank.health = 3;

  player2Tank.x = SCREEN_WIDTH - 100;
  player2Tank.y = terrain[SCREEN_WIDTH - 100] - TANK_HEIGHT;
  player2Tank.health = 3;
}

function setRandomWind() {
  wind = { x: (Math.random() - 0.5) * MAX_WIND_SPEED, y: 0 };
  windParticles.forEach((p) => (p.vx = wind.x * 5));
}

// ===== UPDATE LOOPS =====
function updateTank(tank, dt) {
  if (tank.health <= 0) return;

  const x = Math.floor(tank.x);
  if (x >= 0 && x < SCREEN_WIDTH) {
    const groundY = terrain[x];
    if (tank.y + TANK_HEIGHT < groundY) {
      tank.y += 100 * dt;
    } else {
      tank.y = groundY - TANK_HEIGHT;
    }
  }
  if (tank.y > SCREEN_HEIGHT) tank.health = 0;
}

function updatePowerCharging(deltaTime) {
  const elapsed = Date.now() - chargeStartTime;
  chargePower = Math.min(elapsed / MAX_CHARGE_TIME, 1);

  if (chargePower >= 1 && currentPlayer === 1) fireProjectile();
}

function fireProjectile() {
  const activeTank = currentPlayer === 1 ? player1Tank : player2Tank;
  const weapon = activeTank.selectedWeapon;

  const turretX =
    activeTank.x + Math.cos(activeTank.turretAngle) * TURRET_LENGTH;
  const turretY =
    activeTank.y + Math.sin(activeTank.turretAngle) * TURRET_LENGTH;

  const power = chargePower * MAX_LAUNCH_SPEED;

  projectiles.push({
    x: turretX,
    y: turretY,
    vx: Math.cos(activeTank.turretAngle) * power,
    vy: Math.sin(activeTank.turretAngle) * power,
    type: weapon,
    owner: currentPlayer,
    trail: [],
    canSplit: weapon.childCount > 0,
    bounces: weapon === ProjectileType.BOUNCING ? 1 : 0, // Yksi pomppu
    flightTime: 0,
    isFragment: false,
  });

  createMuzzleFlash(turretX, turretY, activeTank.turretAngle);
  playShootSound();

  // Vähennä ammuksia
  if (activeTank.weapons[weapon.id] !== Infinity) {
    activeTank.weapons[weapon.id]--;
    // Jos ammukset loppuivat, vaihda takaisin Regular-aseeseen
    if (activeTank.weapons[weapon.id] <= 0) {
      activeTank.selectedWeapon = ProjectileType.REGULAR;
      console.log(`Ammo depleted for ${weapon.name}. Switching to Regular.`);
    }
  }

  gameState = GameState.RESOLVE;
  chargePower = 0;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];

    p.flightTime = (p.flightTime || 0) + dt;

    p.vx += wind.x * dt * 0.5;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Optimized: Reduced trail length from 20 to 10 for better performance
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 10) p.trail.shift();

    // Cluster/MIRV AUTOSPLIT (P2)
    if (
      p.canSplit &&
      (p.type === ProjectileType.MIRV ||
        (p.type === ProjectileType.CLUSTER && p.owner === 2)) &&
      p.flightTime > 1.0 // Split-time after 1s.
    ) {
      splitProjectile(p);
      p.canSplit = false;
      projectiles.splice(i, 1);
      continue;
    }

    if (p.type === ProjectileType.DIGGER && p.y > terrain[Math.floor(p.x)]) {
      p.penetration = (p.penetration || 0) + Math.abs(p.vy) * dt;
      if (p.penetration > p.type.penetrationDepth) {
        explodeProjectile(p, i);
      }
      continue;
    }

    if (p.y >= terrain[Math.floor(p.x)] || p.x < 0 || p.x > SCREEN_WIDTH) {
      // Korjaus: Botin laukaus meni reunan yli vasemmalle (yliammunta P1:lle).
      if (p.owner === 2 && p.x < 0) {
        const targetTank = player1Tank;
        // Kirjaa osuma kuvitteellisesti kauas maalin ohi pakottaakseen tehon vähennyksen.
        bot.updateLastImpact(targetTank.x - 100);
        console.log(
          "🤖 Bot: Shot flew off screen (Left). Forcing power adjustment for massive overshoot."
        );
        projectiles.splice(i, 1);
        continue;
      }

      if (p.type === ProjectileType.BOUNCING && p.bounces > 0) {
        p.vy = -p.vy * 0.6;
        p.bounces--;
        p.y -= 5;
      } else if (p.type === ProjectileType.NAPALM) {
        napalmZones.push(
          new NapalmZone(p.x, p.y, p.type.fireRadius, p.type.fireDuration)
        );
        playNapalmSound();
        // NAPALM KIRJAA OSUMANSA explodeProjectile-funktiossa
        explodeProjectile(p, i);
      } else if (p.type === ProjectileType.TELEPORTER) {
        const tank = p.owner === 1 ? player1Tank : player2Tank;
        tank.x = p.x;
        tank.y = p.y - TANK_HEIGHT;
        playTeleportSound();
        projectiles.splice(i, 1);
      } else {
        explodeProjectile(p, i);
      }
    }
  }
}

function explodeProjectile(p, index) {
  explosions.push(new Explosion(p.x, p.y, p.type.explosionRadius));
  playGroundHitSound();

  // Tähtäyskorjaus: Päivitä impact, jos P2 ampuu
  if (p.owner === 2) {
    const dx = Math.abs(p.x - player2Tank.x);
    let updateImpact = false;
    let impactXToRecord = p.x; // Tallennettava X-koordinaatti

    // Sääntö 1: Säännölliset ja tarkat ammukset päivitetään aina.
    if (
      p.type === ProjectileType.REGULAR ||
      p.type === ProjectileType.HEAVY ||
      p.type === ProjectileType.DIGGER ||
      p.type === ProjectileType.NAPALM
    ) {
      updateImpact = true;
    }

    // Sääntö: Clusterin/MIRVin sirpaleet päivitetään aina.
    if (p.isFragment) {
      updateImpact = true;
      console.log(`🤖 Bot: Fragment impact recorded (X:${p.x.toFixed(0)}).`);
    }

    // Hätäkorjaus kuopasta ulospääsyyn (vanha lyhyt laukaus)
    // Jos osuma on TODELLA lähellä (< 50px), pakota bot ulos kuopasta.
    if (dx < 50) {
      // Asetetaan kuvitteellinen osuma 250 pikseliä tankista eteenpäin.
      impactXToRecord = player2Tank.x - 250;
      updateImpact = true;
      console.log(
        `🤖 Bot EMERGENCY ESCAPE: Close impact (${p.type.name
        } at X:${p.x.toFixed(
          0
        )}). Setting correction target to X:${impactXToRecord.toFixed(0)}.`
      );
    }

    if (updateImpact) {
      bot.updateLastImpact(impactXToRecord);
    } else {
      // Ignoroidaan Cluster/Mirv emoammus, Bouncing emoammus (jos ei hätätilanne)
      console.log(
        `🤖 Bot: Not updating impact (Irregular shot: ${p.type.name}).`
      );
    }
  }

  projectiles.splice(index, 1);
}

// ===== INPUT & CONTROLS (Pelaaja 1) (Ei muutoksia) =====
function updatePlayerAiming(dt) {
  const tank = player1Tank;
  const rate = 1.0;
  if (heldKeys.has("a") || heldKeys.has("A")) tank.turretAngle -= rate * dt;
  if (heldKeys.has("d") || heldKeys.has("D")) tank.turretAngle += rate * dt;
  tank.turretAngle = Math.max(-Math.PI, Math.min(0, tank.turretAngle));
}

document.addEventListener("keydown", (e) => {
  heldKeys.add(e.key);

  if (e.key === "r" || e.key === "R") initializeGame();

  if (currentPlayer === 1 && gameState === GameState.AIM) {
    if (e.key === "w" || e.key === "W") {
      gameState = GameState.POWER;
      chargeStartTime = Date.now();
      chargePower = 0;
    }
    if (e.key === "s" || e.key === "S") {
      const keys = Object.keys(ProjectileType);
      let currentIdx = keys.indexOf(player1Tank.selectedWeapon.id);
      let nextIdx = currentIdx;
      let found = false;

      // Etsi seuraava ase, jolla on ammuksia
      for (let i = 0; i < keys.length; i++) {
        nextIdx = (nextIdx + 1) % keys.length;
        const weaponKey = keys[nextIdx];
        if (player1Tank.weapons[weaponKey] > 0) {
          player1Tank.selectedWeapon = ProjectileType[weaponKey];
          found = true;
          break;
        }
      }
    }
  }

  // Pelaaja 1:n Cluster-ammuksen manuaalinen split
  if (
    gameState === GameState.RESOLVE &&
    currentPlayer === 1 &&
    (e.key === "w" || e.key === "W")
  ) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      let p = projectiles[i];
      // Etsi Cluster-tyyppinen ammus, joka kuuluu P1:lle ja voi vielä splitata
      if (
        p.type === ProjectileType.CLUSTER &&
        p.owner === currentPlayer &&
        p.canSplit
      ) {
        splitProjectile(p);
        projectiles.splice(i, 1); // Poista emoammus
        break; // Oletetaan, että vain yksi ammus lentää kerrallaan
      }
    }
  }
});

document.addEventListener("keyup", (e) => {
  heldKeys.delete(e.key);
  if (
    currentPlayer === 1 &&
    gameState === GameState.POWER &&
    (e.key === "w" || e.key === "W")
  ) {
    fireProjectile();
  }
});

// ===== MAIN LOOPS (Ei muutoksia) =====
function update() {
  const now = Date.now();
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  updateTank(player1Tank, dt);
  updateTank(player2Tank, dt);
  windParticles.forEach((p) => p.update(dt));

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].isDead) {
      particles.splice(i, 1);
    }
  }

  for (let i = napalmZones.length - 1; i >= 0; i--) {
    napalmZones[i].update(dt);
    if (napalmZones[i].isDead) {
      napalmZones.splice(i, 1);
    }
  }

  switch (gameState) {
    case GameState.AIM:
      if (currentPlayer === 1) {
        updatePlayerAiming(dt);
      } else {
        bot.update(dt);
      }
      break;
    case GameState.POWER:
      if (currentPlayer === 1) updatePowerCharging(dt);
      else bot.update(dt);
      break;
    case GameState.RESOLVE:
      updateProjectiles(dt);
      updateExplosions(dt);
      if (
        projectiles.length === 0 &&
        explosions.length === 0 &&
        particles.length === 0 &&
        napalmZones.length === 0
      ) {
        if (!checkGameOver()) {
          currentPlayer = currentPlayer === 1 ? 2 : 1;
          setRandomWind();
          gameState = GameState.AIM;

          if (currentPlayer === 2) bot.prepareTurn();
        }
      }
      break;
  }
}

function checkGameOver() {
  if (player1Tank.health <= 0 || player2Tank.health <= 0) {
    gameState = GameState.GAME_OVER;

    // Campaign Mode Logic
    if (isCampaignMode) {
      if (player1Tank.health > 0) {
        // Player Won
        if (currentCampaignLevel < CampaignLevels.length) {
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

function draw() {
  // Cartoon style: Bright blue sky with gradient (Theme based)
  const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  gradient.addColorStop(0, currentTheme.skyTop); // Sky top
  gradient.addColorStop(0.6, currentTheme.skyTop); // Mid
  gradient.addColorStop(1, currentTheme.skyBottom); // Horizon
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  windParticles.forEach((p) => p.draw());

  // Cartoon style: Vibrant grass (Theme based)
  ctx.fillStyle = currentTheme.ground;
  ctx.beginPath();
  ctx.moveTo(0, SCREEN_HEIGHT);
  for (let x = 0; x < SCREEN_WIDTH; x++) ctx.lineTo(x, terrain[x]);
  ctx.lineTo(SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fill();

  // Add darker outline for cartoon effect (Theme based)
  ctx.strokeStyle = currentTheme.groundOutline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, terrain[0]);
  for (let x = 1; x < SCREEN_WIDTH; x++) ctx.lineTo(x, terrain[x]);
  ctx.stroke();

  drawTank(player1Tank);
  drawTank(player2Tank);

  projectiles.forEach((p) => {
    drawProjectile(p);
  });

  explosions.forEach((e) => e.draw());
  particles.forEach((p) => p.draw());
  napalmZones.forEach((z) => z.draw());

  drawUI();
}

// ===== PROJECTILE RENDERING WITH UNIQUE VISUALS =====
function drawProjectile(p) {
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

// Helper function to draw a star shape
function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

function drawTank(tank) {
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

function drawUI() {
  // Cartoon style: Bigger, bolder text with shadows
  ctx.font = "bold 24px 'Fredoka', sans-serif";
  ctx.textAlign = "left";

  // Player 1 health with shadow
  ctx.fillStyle = "#000";
  ctx.fillText(`P1: ${"♥".repeat(player1Tank.health)}`, 12, 32);
  ctx.fillStyle = "#FF1744";
  ctx.fillText(`P1: ${"♥".repeat(player1Tank.health)}`, 10, 30);

  // Bot health with shadow
  ctx.textAlign = "right";
  ctx.fillStyle = "#000";
  ctx.fillText(`Bot: ${"♥".repeat(player2Tank.health)}`, SCREEN_WIDTH - 8, 32);
  ctx.fillStyle = "#FF1744";
  ctx.fillText(`Bot: ${"♥".repeat(player2Tank.health)}`, SCREEN_WIDTH - 10, 30);

  // Wind and turn info with shadow
  ctx.textAlign = "center";
  ctx.font = "bold 22px 'Fredoka', sans-serif";
  ctx.fillStyle = "#000";
  ctx.fillText(
    `Wind: ${wind.x.toFixed(1)} | Turn: P${currentPlayer}`,
    SCREEN_WIDTH / 2 + 1,
    31
  );
  ctx.fillStyle = "#ffffffff";
  ctx.fillText(
    `Wind: ${wind.x.toFixed(1)} | Turn: P${currentPlayer}`,
    SCREEN_WIDTH / 2,
    30
  );

  // Weapon display with shadow
  const currentTank = currentPlayer === 1 ? player1Tank : player2Tank;
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
  if (gameState === GameState.POWER) {
    ctx.fillStyle = "#FF6B00";
    ctx.fillRect(SCREEN_WIDTH / 2 - 100, 65, 200 * chargePower, 15);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeRect(SCREEN_WIDTH / 2 - 100, 65, 200, 15);
  }

  // Game over screen - cartoon style
  if (gameState === GameState.GAME_OVER) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    ctx.font = "bold 60px 'Fredoka One', cursive";
    const winner = player1Tank.health > 0 ? "YOU WIN!" : "BOT WINS!";

    // Shadow
    ctx.fillStyle = "#000";
    ctx.fillText(winner, SCREEN_WIDTH / 2 + 3, SCREEN_HEIGHT / 2 + 3);

    // Main text
    ctx.fillStyle = player1Tank.health > 0 ? "#FFD700" : "#FF1744";
    ctx.fillText(winner, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

    if (!isCampaignMode) {
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
}

function initializeGame() {
  generateTerrain();
  placeTanks();
  setRandomWind();
  windParticles = [];
  // Optimized: 80 particles instead of 100 for better performance while maintaining visibility
  for (let i = 0; i < 80; i++) windParticles.push(new WindParticle());
  gameState = GameState.AIM;
  currentPlayer = 1;
  projectiles = [];
  explosions = [];
  particles = [];
  napalmZones = [];
  chargePower = 0;
  bot.lastImpactX = 0;
  bot.turnCounter = 0;

  // Aseet nollataan ja arvotaan uudet
  player1Tank.weapons = generateRandomInventory(isCampaignMode);
  player2Tank.weapons = generateRandomInventory(isCampaignMode);
  player1Tank.selectedWeapon = ProjectileType.REGULAR;
  player2Tank.selectedWeapon = ProjectileType.REGULAR;
}

// ===== START (Ei muutoksia) =====
// ===== START SCREEN LOGIC =====
function selectTheme(themeName) {
  currentTheme = Themes[themeName];

  // Update UI buttons
  const buttons = document.querySelectorAll(".theme-btn");
  buttons.forEach((btn) => {
    btn.classList.remove("selected");
    if (btn.textContent.toUpperCase() === themeName) {
      btn.classList.add("selected");
    }
  });
}

function selectDifficulty(diffName) {
  currentDifficulty = BotPersonalities[diffName];

  // Update UI buttons
  const buttons = document.querySelectorAll(".diff-btn");
  buttons.forEach((btn) => {
    btn.classList.remove("selected");
    if (btn.textContent.toUpperCase() === diffName) {
      btn.classList.add("selected");
    }
  });
}

function selectMode(mode) {
  const quickplayOptions = document.getElementById("quickplay-options");
  const campaignOptions = document.getElementById("campaign-options");
  const modeButtons = document.querySelectorAll(".mode-btn");

  modeButtons.forEach((btn) => {
    btn.classList.remove("selected");
    if (btn.textContent.toLowerCase().includes(mode)) {
      btn.classList.add("selected");
    }
  });

  if (mode === "campaign") {
    quickplayOptions.style.display = "none";
    campaignOptions.style.display = "block";
    isCampaignMode = true;
  } else {
    quickplayOptions.style.display = "block";
    campaignOptions.style.display = "none";
    isCampaignMode = false;
  }
}

function startGame() {
  if (isCampaignMode) {
    // Start campaign from level 1
    currentCampaignLevel = 1;
    loadCampaignLevel(currentCampaignLevel);
  } else {
    // Quick Play - use selected theme and difficulty
    bot.personality = currentDifficulty;
    bot.K_FACTOR = currentDifficulty.kFactor;
    console.log(`🤖 Bot Updated to: ${bot.personality.name}`);
  }

  document.getElementById("start-screen").style.display = "none";
  document.getElementById("menu-btn").style.display = "block";
  isGameRunning = true;
  initializeGame();
}

function loadCampaignLevel(levelNum) {
  const level = CampaignLevels[levelNum - 1];
  currentTheme = level.theme;
  currentDifficulty = level.difficulty;
  bot.personality = level.difficulty;
  bot.K_FACTOR = level.difficulty.kFactor;
  console.log(`🎮 Campaign Level ${levelNum}: ${level.name}`);
}

function showLevelComplete() {
  setTimeout(() => {
    const nextLevel = currentCampaignLevel + 1;
    const nextLevelName = CampaignLevels[nextLevel - 1].name;

    document.getElementById(
      "victory-title"
    ).textContent = `🎉 Level ${currentCampaignLevel} Complete!`;
    document.getElementById(
      "victory-message"
    ).textContent = `Next: Level ${nextLevel} - ${nextLevelName}`;
    document.getElementById("victory-overlay").style.display = "flex";
  }, 1000);
}

function showCampaignComplete() {
  setTimeout(() => {
    document.getElementById("campaign-complete-overlay").style.display = "flex";
  }, 1000);
}

function showMissionFailed() {
  setTimeout(() => {
    document.getElementById("defeat-overlay").style.display = "flex";
  }, 1000);
}

// Overlay button handlers
function continueToNextLevel() {
  document.getElementById("victory-overlay").style.display = "none";
  currentCampaignLevel++;
  loadCampaignLevel(currentCampaignLevel);
  initializeGame();
}

function retryLevel() {
  document.getElementById("defeat-overlay").style.display = "none";
  initializeGame();
}

function returnToMenu() {
  document.getElementById("victory-overlay").style.display = "none";
  document.getElementById("defeat-overlay").style.display = "none";
  document.getElementById("campaign-complete-overlay").style.display = "none";
  showMainMenu();
}

function showMainMenu() {
  isGameRunning = false;
  document.getElementById("start-screen").style.display = "flex";
  document.getElementById("menu-btn").style.display = "none";
}

// ===== START =====
// initializeGame() is called by startGame()
// Initial render for background
generateTerrain();
draw();

function loop() {
  if (isGameRunning) {
    update();
    draw();
  }
  requestAnimationFrame(loop);
}
loop();
