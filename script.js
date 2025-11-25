// ===== GAME CONSTANTS =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const SCREEN_WIDTH = canvas.width;
const SCREEN_HEIGHT = canvas.height;
const TANK_WIDTH = 20;
const TANK_HEIGHT = 10;
const TURRET_LENGTH = 15;
const GRAVITY = 20; // Pixels per second squared (matches reference)
const MAX_WIND_SPEED = 5; // Pixels per second (matches reference)
const MAX_LAUNCH_SPEED = 200; // Maximum projectile launch speed (increase for faster ammo) default 200
const PROJECTILE_SPEED_MULTIPLIER = 2.0; // Visual speed multiplier (1.0 = normal, 2.0 = 2x faster visually, doesn't affect power/trajectory)

// ===== GAME STATE =====
const GameState = {
  AIM: "aim",
  POWER: "power",
  RESOLVE: "resolve",
  GAME_OVER: "game_over",
};

// ===== PROJECTILE TYPES =====
const ProjectileType = {
  REGULAR: {
    name: "Regular",
    explosionRadius: 30,
    color: "yellow",
  },
  CLUSTER: {
    name: "Cluster",
    explosionRadius: 20,
    color: "orange",
    childCount: 5,
    childRadius: 12,
  },
  BOUNCING: {
    name: "Bouncing",
    explosionRadius: 25,
    color: "cyan",
    bounces: 1, // Default is 2
  },
  HEAVY: {
    name: "Heavy",
    explosionRadius: 70,
    color: "red",
  },
  // Phase 3 weapons
  DIGGER: {
    name: "Digger",
    explosionRadius: 35,
    color: "brown",
    penetrationDepth: 80, // depth before exploding
  },
  NAPALM: {
    name: "Napalm",
    explosionRadius: 25,
    color: "orangered",
    fireDuration: 2000, // ms - reduced for even shorter burning time
    fireRadius: 60,
  },
  MIRV: {
    name: "MIRV",
    explosionRadius: 25, // increased from 20 for more effectiveness
    color: "purple",
    childCount: 5, // increased from 3 for more warheads
    childRadius: 15, // increased from 10
  },
  TELEPORTER: {
    name: "Teleporter",
    color: "cyan",
  },
};

// ===== GAME VARIABLES =====
let gameState = GameState.AIM;
let terrain = [];
let wind = { x: 0, y: 0 }; // Wind vector (matches reference)
let currentPlayer = 1; // 1 or 2

// Player tanks
let player1Tank = {
  x: 100,
  y: 0,
  color: "lime",
  turretAngle: -Math.PI / 2,
  health: 3,
  selectedWeapon: ProjectileType.REGULAR,
};

let player2Tank = {
  x: 700,
  y: 0,
  color: "red",
  turretAngle: -Math.PI / 2,
  health: 3,
  selectedWeapon: ProjectileType.REGULAR,
};

// Active game objects
let projectiles = [];
let explosions = [];
let windParticles = [];
let particles = []; // Explosion debris, smoke, etc.
let napalmZones = []; // Lingering fire zones
let lasers = []; // Active laser beams

// Power charging
let chargePower = 0;
let chargeStartTime = 0;
const MAX_CHARGE_TIME = 2000; // milliseconds

// Keyboard state
const heldKeys = new Set();

// Delta time
let lastFrameTime = Date.now();

// ===== SOUND SYSTEM (PLACEHOLDERS) =====
function playLaserSound() {
  new Audio("sounds/laser.wav").play();
  console.log("🔊 LASER");
}
function playNapalmSound() {
  new Audio("sounds/napalm.wav").play();
  console.log("🔊 NAPALM");
}
function playTeleportSound() {
  new Audio("sounds/teleport.wav").play();
  console.log("🔊 TELEPORT");
}

function playShootSound() {
  // TODO: Play shooting sound effect
  new Audio("sounds/shoot.wav").play();
  console.log("🔊 SHOOT");
}

function playGroundHitSound() {
  // TODO: Play ground impact sound effect
  new Audio("sounds/ground_hit.wav").play();
  console.log("🔊 GROUND HIT");
}

function playTankHitSound() {
  // TODO: Play tank hit sound effect
  new Audio("sounds/tank_hit.wav").play();
  console.log("🔊 TANK HIT");
}

function playTankDestroySound() {
  // TODO: Play tank destruction sound effect
  new Audio("sounds/tank_destroy.wav").play();
  console.log("🔊 TANK DESTROYED");
}

function playClusterSplitSound() {
  // TODO: Play tank destruction sound effect
  new Audio("sounds/cluster_split.wav").play();
  console.log("🔊 TANK DESTROYED");
}

function playBounceSound() {
  // TODO: Play tank destruction sound effect
  new Audio("sounds/bounce.wav").play();
  console.log("🔊 TANK DESTROYED");
}

// ===== WIND PARTICLE SYSTEM =====
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
    // Smoothly interpolate to current wind (matches reference)
    const targetVx = wind.x * 5;
    this.vx = this.vx * 0.95 + targetVx * 0.05;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Wrap around screen
    if (this.x < 0) this.x += SCREEN_WIDTH;
    else if (this.x >= SCREEN_WIDTH) this.x -= SCREEN_WIDTH;
    if (this.y < 0) this.y += SCREEN_HEIGHT;
    else if (this.y >= SCREEN_HEIGHT) this.y -= SCREEN_HEIGHT;
  }

  draw() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; // Dark for visibility against bright sky
    ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 1, 1);
  }
}

// ===== PARTICLE SYSTEM =====
class NapalmZone {
  constructor(x, y, radius, duration) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.duration = duration / 1000; // seconds
    this.timer = 0;
    this.isDead = false;
    this.spawnTimer = 0;
  }
  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration) {
      this.isDead = true;
      return;
    }

    // Spawn fire particles
    this.spawnTimer += dt;
    if (this.spawnTimer > 0.05) {
      // Spawn every 50ms
      this.spawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * this.radius;
      const px = this.x + Math.cos(angle) * dist;
      const py = this.y + Math.sin(angle) * dist;

      // Fire particle
      particles.push(
        new Particle(px, py, 0, -20 - Math.random() * 30, "spark")
      );
      // Smoke particle
      if (Math.random() > 0.5) {
        particles.push(
          new Particle(px, py, 0, -10 - Math.random() * 20, "smoke")
        );
      }
    }

    // Damage tanks inside zone
    [player1Tank, player2Tank].forEach((tank) => {
      const dx = tank.x - this.x;
      const dy = tank.y - this.y;
      if (Math.hypot(dx, dy) < this.radius) {
        // Damage every 0.5 seconds roughly (handled by frame rate for now, simplified)
        if (Math.random() < dt * 2) {
          // Chance to damage based on dt
          tank.health = Math.max(0, tank.health - 1);
          if (tank.health === 0) {
            playTankDestroySound();
            checkGameOver();
          } else {
            //playTankHitSound();
          }
        }
      }
    });
  }
  draw() {
    // Draw glow
    ctx.fillStyle = "rgba(255, 100, 0, 0.2)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
class Particle {
  constructor(x, y, vx, vy, type = "debris") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.type = type; // 'debris', 'smoke', 'dust', 'spark'
    this.lifetime = 0;
    this.maxLifetime = type === "smoke" ? 1.5 : type === "spark" ? 0.3 : 1.0;
    this.size =
      type === "smoke" ? 3 + Math.random() * 4 : 2 + Math.random() * 3;
    this.isDead = false;

    // Type-specific properties
    if (type === "debris") {
      this.color = `rgb(${100 + Math.random() * 50}, ${80 + Math.random() * 40
        }, ${40 + Math.random() * 20})`;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 5;
    } else if (type === "smoke") {
      this.color = `rgba(80, 80, 80, ${0.5 + Math.random() * 0.3})`;
    } else if (type === "dust") {
      this.color = `rgba(150, 130, 100, ${0.4 + Math.random() * 0.3})`;
    } else if (type === "spark") {
      this.color = `rgb(255, ${200 + Math.random() * 55}, ${100 + Math.random() * 100
        })`;
    }
  }

  update(deltaTime) {
    this.lifetime += deltaTime;

    if (this.lifetime >= this.maxLifetime) {
      this.isDead = true;
      return;
    }

    // Physics
    if (this.type === "debris") {
      this.vy += GRAVITY * deltaTime * 0.5; // Half gravity for debris
      this.vx *= 0.98; // Air resistance
      this.rotation += this.rotationSpeed * deltaTime;
    } else if (this.type === "smoke") {
      this.vy -= 20 * deltaTime; // Rise up
      this.vx *= 0.95;
      this.size += deltaTime * 2; // Expand
    } else if (this.type === "dust") {
      this.vy += GRAVITY * deltaTime * 0.2; // Very light
      this.vx *= 0.9;
    } else if (this.type === "spark") {
      this.vy += GRAVITY * deltaTime;
      this.vx *= 0.95;
    }

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  draw() {
    const alpha = 1 - this.lifetime / this.maxLifetime;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === "debris") {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else if (this.type === "smoke") {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === "dust" || this.type === "spark") {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Create explosion particles
function createExplosionParticles(x, y, radius) {
  // Heavy bomb (radius >= 60) gets massive particle count
  const isHeavy = radius >= 60;
  const multiplier = isHeavy ? 3 : 1;

  const debrisCount = Math.floor(radius / 3) * multiplier;
  const smokeCount = Math.floor(radius / 5) * multiplier;
  const dustCount = Math.floor(radius / 4) * multiplier;

  // Debris particles
  for (let i = 0; i < debrisCount; i++) {
    const angle = (Math.PI * 2 * i) / debrisCount + (Math.random() - 0.5) * 0.5;
    const speed = 50 + Math.random() * 100;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 30; // Bias upward
    particles.push(new Particle(x, y, vx, vy, "debris"));
  }

  // Smoke particles
  for (let i = 0; i < smokeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 30;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 40; // Rise up
    particles.push(new Particle(x, y, vx, vy, "smoke"));
  }

  // Dust cloud
  for (let i = 0; i < dustCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 40;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    particles.push(new Particle(x, y, vx, vy, "dust"));
  }
}

// Create muzzle flash particles
function createMuzzleFlash(x, y, angle) {
  for (let i = 0; i < 8; i++) {
    const spreadAngle = angle + (Math.random() - 0.5) * 0.5;
    const speed = 80 + Math.random() * 60;
    const vx = Math.cos(spreadAngle) * speed;
    const vy = Math.sin(spreadAngle) * speed;
    particles.push(new Particle(x, y, vx, vy, "spark"));
  }

  // Smoke puff
  for (let i = 0; i < 3; i++) {
    const vx = Math.cos(angle) * (20 + Math.random() * 20);
    const vy = Math.sin(angle) * (20 + Math.random() * 20);
    particles.push(new Particle(x, y, vx, vy, "smoke"));
  }
}

// ===== EXPLOSION CLASS =====
class Explosion {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.progress = 0;
    this.duration = 1000; // milliseconds
    this.triggered = false;
    this.isDead = false;
  }

  update(deltaTime) {
    this.progress += deltaTime / (this.duration / 1000);

    if (this.progress >= 1) {
      this.isDead = true;
    }

    // Trigger terrain deformation and damage at 50% progress
    if (this.progress >= 0.5 && !this.triggered) {
      this.trigger();
    }
  }

  trigger() {
    this.triggered = true;

    // Carve terrain - improved algorithm for better craters on slopes
    // Create a proper circular crater by checking each pixel within the explosion radius
    for (let i = -this.radius; i <= this.radius; i++) {
      let targetX = Math.floor(this.x + i);
      if (targetX >= 0 && targetX < SCREEN_WIDTH) {
        // Calculate the vertical extent of the crater at this X position
        let horizontalDist = Math.abs(i);
        if (horizontalDist <= this.radius) {
          // Calculate crater depth at this position (circular profile)
          let craterDepth = Math.sqrt(
            this.radius * this.radius - horizontalDist * horizontalDist
          );

          // The crater bottom at this X position
          let craterBottom = this.y + craterDepth;

          // Remove terrain: if current terrain is above crater bottom, push it down
          if (terrain[targetX] < craterBottom) {
            terrain[targetX] = craterBottom;
          }

          // Clamp to screen bounds
          terrain[targetX] = Math.min(terrain[targetX], SCREEN_HEIGHT);
        }
      }
    }

    // Create explosion particles
    createExplosionParticles(this.x, this.y, this.radius);

    // Check tank damage
    this.checkTankDamage(player1Tank);
    this.checkTankDamage(player2Tank);
  }

  checkTankDamage(tank) {
    const dist = Math.sqrt((this.x - tank.x) ** 2 + (this.y - tank.y) ** 2);
    if (dist < this.radius + TANK_WIDTH / 2) {
      const wasAlive = tank.health > 0;
      tank.health--;

      if (tank.health <= 0 && wasAlive) {
        playTankDestroySound(); // Tank destroyed
      } else if (tank.health > 0) {
        playTankHitSound(); // Tank hit but still alive
      }
    }
  }

  draw() {
    // Animated explosion: grows then shrinks
    const animRadius = this.radius * Math.sin(this.progress * Math.PI);

    ctx.save();
    // Outer glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = "rgba(255, 100, 0, 0.8)";

    // Outer ring (orange)
    ctx.fillStyle = `rgba(255, 100, 0, ${0.6 * (1 - this.progress)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, animRadius, 0, Math.PI * 2);
    ctx.fill();

    // Middle ring (yellow)
    ctx.fillStyle = `rgba(255, 200, 0, ${0.8 * (1 - this.progress)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, animRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Inner core (white)
    ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - this.progress)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, animRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ===== TERRAIN GENERATION =====
function generateTerrain() {
  terrain = [];

  // Multi-octave terrain generation for more variation
  const baseHeight = 400; // Base terrain level
  const octaves = [
    { amplitude: 80, frequency: 0.01 }, // Large hills
    { amplitude: 40, frequency: 0.03 }, // Medium features
    { amplitude: 20, frequency: 0.08 }, // Small details
    { amplitude: 10, frequency: 0.15 }, // Fine noise
  ];

  // Random seed for this terrain
  const seed = Math.random() * 1000;

  // Generate random features (mountains, valleys, plateaus)
  const numFeatures = Math.floor(Math.random() * 3) + 2; // 2-4 features
  const features = [];
  for (let i = 0; i < numFeatures; i++) {
    features.push({
      center: Math.random() * SCREEN_WIDTH,
      width: 50 + Math.random() * 150,
      height: (Math.random() - 0.5) * 150, // Can be positive (hill) or negative (valley)
      type: Math.random() > 0.5 ? "smooth" : "plateau",
    });
  }

  for (let x = 0; x < SCREEN_WIDTH; x++) {
    let height = baseHeight;

    // Add multi-octave noise
    for (let octave of octaves) {
      const noise = Math.sin((x + seed) * octave.frequency) * octave.amplitude;
      height += noise;
    }

    // Add random features
    for (let feature of features) {
      const distance = Math.abs(x - feature.center);
      if (distance < feature.width) {
        const influence = 1 - distance / feature.width;
        if (feature.type === "smooth") {
          // Smooth hill or valley
          height += feature.height * Math.pow(influence, 2);
        } else {
          // Plateau
          height +=
            feature.height *
            (influence > 0.7 ? 1 : Math.pow(influence / 0.7, 3));
        }
      }
    }

    // Clamp to screen bounds
    height = Math.max(Math.min(height, SCREEN_HEIGHT - 50), 250);
    terrain[x] = height;
  }
}

// ===== TANK PLACEMENT =====
function placeTanks() {
  // Player 1 on left
  player1Tank.x = Math.floor(Math.random() * 150 + 50);
  player1Tank.y = terrain[player1Tank.x] - TANK_HEIGHT;
  player1Tank.turretAngle = -Math.PI / 2;
  player1Tank.health = 3;

  // Player 2 on right
  player2Tank.x = Math.floor(Math.random() * 150 + (SCREEN_WIDTH - 200));
  player2Tank.y = terrain[player2Tank.x] - TANK_HEIGHT;
  player2Tank.turretAngle = -Math.PI / 2;
  player2Tank.health = 3;

  // Flatten terrain under tanks
  flattenTerrainUnderTank(player1Tank);
  flattenTerrainUnderTank(player2Tank);
}

function flattenTerrainUnderTank(tank) {
  const baseHeight = terrain[tank.x];
  for (let x = tank.x - TANK_WIDTH / 2; x < tank.x + TANK_WIDTH / 2; x++) {
    if (x >= 0 && x < SCREEN_WIDTH) {
      terrain[Math.floor(x)] = baseHeight;
    }
  }
}

// ===== WIND SYSTEM =====
function setRandomWind() {
  // Wind is a vector (matches reference implementation)
  const windX = (Math.random() - 0.5) * MAX_WIND_SPEED * 2;
  const windY = (Math.random() - 0.5) * MAX_WIND_SPEED * 2 * 0.1; // Mostly horizontal
  wind = { x: windX, y: windY };

  // Update all wind particles
  windParticles.forEach((p) => (p.vx = wind.x * 5));
}

// ===== TANK UPDATES =====
function updateTank(tank, deltaTime) {
  // Check if tank fell off the world
  if (tank.y >= SCREEN_HEIGHT) {
    tank.health = 0;
    return;
  }

  // Check if there is ground beneath us (pixel-perfect check)
  let groundExists = false;
  for (
    let x = Math.floor(tank.x - TANK_WIDTH / 2);
    x <= Math.floor(tank.x + TANK_WIDTH / 2);
    x++
  ) {
    if (x >= 0 && x < SCREEN_WIDTH) {
      // Check if tank bottom is touching terrain
      if (tank.y + TANK_HEIGHT >= terrain[x]) {
        groundExists = true;
        break;
      }
    }
  }

  // If no ground beneath, fall down (gravity)
  if (!groundExists) {
    tank.y += 1; // Fall 1 pixel per frame (matches reference)
  }
}

// ===== TURRET AIMING =====
function updateTurretAiming(tank, deltaTime) {
  const turnRate = heldKeys.has("Shift") ? 0.1 : 0.5;

  // Player 1 controls: A/D
  if (tank === player1Tank && currentPlayer === 1) {
    if (heldKeys.has("a") || heldKeys.has("A")) {
      tank.turretAngle -= turnRate * deltaTime;
    }
    if (heldKeys.has("d") || heldKeys.has("D")) {
      tank.turretAngle += turnRate * deltaTime;
    }
  }

  // Player 2 controls: Arrow Left/Right
  if (tank === player2Tank && currentPlayer === 2) {
    if (heldKeys.has("ArrowLeft")) {
      tank.turretAngle -= turnRate * deltaTime; // Move turret left
    }
    if (heldKeys.has("ArrowRight")) {
      tank.turretAngle += turnRate * deltaTime; // Move turret right
    }
  }

  // Clamp turret angle
  if (tank === player1Tank) {
    // Player 1 aims right (0 to -180 degrees)
    tank.turretAngle = Math.max(
      Math.min(tank.turretAngle, -Math.PI * 0.1),
      -Math.PI * 0.9
    );
  } else {
    // Player 2 aims left (-180 to 0 degrees, but mirrored)
    tank.turretAngle = Math.max(
      Math.min(tank.turretAngle, -Math.PI * 0.1),
      -Math.PI * 0.9
    );
  }
}

// ===== POWER CHARGING =====
function updatePowerCharging(deltaTime) {
  const elapsed = Date.now() - chargeStartTime;
  chargePower = Math.min(elapsed / MAX_CHARGE_TIME, 1);

  // Auto-fire at 100%
  if (chargePower >= 1) {
    fireProjectile();
  }
}

// ===== PROJECTILE FIRING =====
function fireProjectile() {
  const activeTank = currentPlayer === 1 ? player1Tank : player2Tank;
  const weaponType = activeTank.selectedWeapon;

  // Calculate launch position and velocity
  const turretEndX =
    activeTank.x + Math.cos(activeTank.turretAngle) * TURRET_LENGTH;
  const turretEndY =
    activeTank.y + Math.sin(activeTank.turretAngle) * TURRET_LENGTH;

  // Power scales to MAX_LAUNCH_SPEED constant (adjust at top of file)
  const power = chargePower * MAX_LAUNCH_SPEED;
  const vx = Math.cos(activeTank.turretAngle) * power;
  const vy = Math.sin(activeTank.turretAngle) * power;

  // Weapon‑specific initialization
  const proj = {
    x: turretEndX,
    y: turretEndY,
    canSplit: weaponType === ProjectileType.CLUSTER,
    vx: vx,
    vy: vy,
    type: weaponType,
    owner: currentPlayer,
    trail: [],
    bounces: weaponType === ProjectileType.BOUNCING ? weaponType.bounces : 0,
  };

  // Digger specific
  if (weaponType === ProjectileType.DIGGER) {
    proj.penetrationRemaining = weaponType.penetrationDepth;
    proj.penetrated = false;
  }

  // Laser is instant – handle immediately
  if (weaponType === ProjectileType.LASER) {
    // Raycast up to a max range
    const maxRange = 300;
    const endX = turretEndX + Math.cos(activeTank.turretAngle) * maxRange;
    const endY = turretEndY + Math.sin(activeTank.turretAngle) * maxRange;
    // Simple hit test against opposing tank
    const targetTank = currentPlayer === 1 ? player2Tank : player1Tank;
    gameState = GameState.RESOLVE;
    chargePower = 0;
    return;
  }

  projectiles.push(proj);

  // Muzzle flash particles
  createMuzzleFlash(turretEndX, turretEndY, activeTank.turretAngle);

  playShootSound(); // Play shoot sound
  gameState = GameState.RESOLVE;
  chargePower = 0;
}

// ===== PROJECTILE UPDATES =====
function updateProjectiles(deltaTime) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];

    // Debug check for NaN
    if (isNaN(p.x) || isNaN(p.y)) {
      console.error("Projectile NaN detected!", p);
      projectiles.splice(i, 1);
      continue;
    }

    // Store trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 20) p.trail.shift();

    // Apply physics
    p.vy += GRAVITY * deltaTime;
    p.vx += wind.x * deltaTime;
    p.vy += wind.y * deltaTime;

    // Update position
    p.x += p.vx * deltaTime * PROJECTILE_SPEED_MULTIPLIER;
    p.y += p.vy * deltaTime * PROJECTILE_SPEED_MULTIPLIER;

    // MIRV Mid-air split logic
    if (p.type === ProjectileType.MIRV && !p.hasSplit) {
      // Split at apex (when vertical velocity is small or just turned positive)
      // or if it's been in air long enough
      if (p.vy > 0 && p.vy < 50) {
        p.hasSplit = true;
        const childCount = p.type.childCount || 3;
        const spreadAngle = Math.PI * 0.4; // Wider cone

        // Play split sound (reuse cluster sound for now)
        playClusterSplitSound();

        for (let j = 0; j < childCount; j++) {
          const angleOffset =
            (j - (childCount - 1) / 2) * (spreadAngle / (childCount - 1));
          // Velocity is mostly down but with spread
          const baseSpeed = 150;
          const angle = Math.PI / 2 + angleOffset; // Downwards + offset

          projectiles.push({
            x: p.x,
            y: p.y,
            vx: p.vx + Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed, // Shoot downwards
            type: ProjectileType.REGULAR, // Warheads act like regular bombs
            owner: p.owner,
            trail: [],
            bounces: 0,
            canSplit: false,
          });
        }

        // Remove parent MIRV
        projectiles.splice(i, 1);
        // Create small poof effect
        createExplosionParticles(p.x, p.y, 10);
        continue;
      }
    }

    // Digger handling – allow penetration
    if (p.type === ProjectileType.DIGGER) {
      if (!p.penetrated && p.y >= terrain[Math.floor(p.x)]) {
        // Start penetrating terrain
        p.penetrated = true;
        p.vy = 0; // stop vertical motion while penetrating
        p.vx = 0;
      }
      if (p.penetrated) {
        p.penetrationRemaining -=
          Math.abs(p.vy) * deltaTime * PROJECTILE_SPEED_MULTIPLIER;
        if (p.penetrationRemaining <= 0) {
          // Explode underground
          explosions.push(new Explosion(p.x, p.y, p.type.explosionRadius));
          projectiles.splice(i, 1);
          playGroundHitSound();
          continue;
        }
        // While penetrating, don't check normal collision
        continue;
      }
    }

    // Collision with terrain (ground)
    if (p.y >= terrain[Math.floor(p.x)]) {
      if (p.type === ProjectileType.BOUNCING && p.bounces > 0) {
        // Bounce
        playBounceSound(); // Bounce sound
        p.vy = -p.vy * 0.6;
        p.vx = p.vx * 0.8;
        p.y = terrain[Math.floor(p.x)] - 1;
        p.bounces--;
        continue;
      }
      if (p.type === ProjectileType.CLUSTER && !p.canSplit) {
        // Cluster already split, explode normally
        playGroundHitSound();
        explosions.push(new Explosion(p.x, p.y, p.type.childRadius));
        projectiles.splice(i, 1);
        continue;
      }
      if (p.type === ProjectileType.NAPALM) {
        // Create napalm zone
        napalmZones.push(
          new NapalmZone(p.x, p.y, p.type.fireRadius, p.type.fireDuration)
        );
        playNapalmSound();
        projectiles.splice(i, 1);
        continue;
      }
      if (p.type === ProjectileType.TELEPORTER) {
        // Teleport owning tank
        const tank = p.owner === 1 ? player1Tank : player2Tank;
        tank.x = p.x;
        tank.y = p.y - TANK_HEIGHT; // place tank on top of ground
        tank.turretAngle = -Math.PI / 2;
        playTeleportSound();
        projectiles.splice(i, 1);
        continue;
      }
      if (p.type === ProjectileType.MIRV) {
        // If it hits ground without splitting, explode normally
        playGroundHitSound();
        explosions.push(new Explosion(p.x, p.y, p.type.explosionRadius));
        projectiles.splice(i, 1);
        continue;
      }
      // Normal explosion for other types
      playGroundHitSound();
      explosions.push(new Explosion(p.x, p.y, p.type.explosionRadius));
      projectiles.splice(i, 1);
      continue;
    }

    // Out of bounds horizontally
    if (p.x < 0 || p.x > SCREEN_WIDTH) {
      projectiles.splice(i, 1);
      continue;
    }
  }
}

function splitClusterBomb(projectile) {
  playClusterSplitSound();
  const childCount = projectile.type.childCount;
  const spreadAngle = Math.PI * 0.4; // Wider spread

  for (let i = 0; i < childCount; i++) {
    // Calculate spread angle from current velocity direction
    const velocityAngle = Math.atan2(projectile.vy, projectile.vx);
    const offset =
      (i - (childCount - 1) / 2) * (spreadAngle / (childCount - 1));
    const angle = velocityAngle + offset;

    // Inherit parent velocity with some spread
    const inheritFactor = 0.7; // 70% of parent velocity
    const spreadSpeed = 30;
    const childVx =
      projectile.vx * inheritFactor + Math.cos(angle) * spreadSpeed;
    const childVy =
      projectile.vy * inheritFactor + Math.sin(angle) * spreadSpeed;

    projectiles.push({
      x: projectile.x,
      y: projectile.y,
      vx: childVx,
      vy: childVy,
      type: {
        ...ProjectileType.CLUSTER,
        explosionRadius: projectile.type.childRadius,
      },
      owner: projectile.owner,
      trail: [],
      bounces: 0,
      canSplit: false, // Children cannot split again
    });
  }
}

// ===== EXPLOSION UPDATES =====
function updateExplosions(deltaTime) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update(deltaTime);
    if (explosions[i].isDead) {
      explosions.splice(i, 1);
    }
  }
}

// ===== DRAWING =====
function draw() {
  // Clear screen with gradient sky
  const skyGradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  skyGradient.addColorStop(0, "#87CEEB");
  skyGradient.addColorStop(0.6, "#E0F6FF");
  skyGradient.addColorStop(1, "#D2B48C");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // Draw wind particles
  windParticles.forEach((p) => p.draw());

  // Draw terrain with gradient and shadow
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, SCREEN_HEIGHT);
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    ctx.lineTo(x, terrain[x]);
  }
  ctx.lineTo(SCREEN_WIDTH, SCREEN_HEIGHT);

  // Terrain gradient (grass to dirt)
  const terrainGradient = ctx.createLinearGradient(0, 300, 0, SCREEN_HEIGHT);
  terrainGradient.addColorStop(0, "#8BC34A");
  terrainGradient.addColorStop(0.3, "#7CB342");
  terrainGradient.addColorStop(1, "#6D4C41");
  ctx.fillStyle = terrainGradient;
  ctx.fill();

  // Terrain outline/shadow
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Draw tanks
  drawTank(player1Tank);
  drawTank(player2Tank);

  // Draw projectiles
  projectiles.forEach((p) => drawProjectile(p));

  // Draw explosions
  explosions.forEach((e) => e.draw());

  // Draw particles
  particles.forEach((p) => p.draw());
  // Draw napalm zones
  napalmZones.forEach((z) => z.draw());
  // Draw UI
  drawUI();
}

function drawTank(tank) {
  if (tank.health <= 0) return;

  ctx.save();
  ctx.translate(tank.x, tank.y);

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(-TANK_WIDTH / 2 + 2, 2, TANK_WIDTH, TANK_HEIGHT);

  // Tank body with gradient
  const bodyGradient = ctx.createLinearGradient(
    -TANK_WIDTH / 2,
    0,
    TANK_WIDTH / 2,
    TANK_HEIGHT
  );
  if (tank.color === "lime") {
    bodyGradient.addColorStop(0, "#76FF03");
    bodyGradient.addColorStop(1, "#64DD17");
  } else {
    bodyGradient.addColorStop(0, "#FF5252");
    bodyGradient.addColorStop(1, "#D32F2F");
  }
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(-TANK_WIDTH / 2, 0, TANK_WIDTH, TANK_HEIGHT);

  // Thick dark border for tank body
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-TANK_WIDTH / 2, 0, TANK_WIDTH, TANK_HEIGHT);

  // Highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(-TANK_WIDTH / 2 + 2, 1, TANK_WIDTH - 4, 3);

  // Draw turret (no glow)
  const turretEndX = Math.cos(tank.turretAngle) * TURRET_LENGTH;
  const turretEndY = Math.sin(tank.turretAngle) * TURRET_LENGTH;

  // Dark border for turret
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(turretEndX, turretEndY);
  ctx.stroke();

  // Turret color on top
  ctx.strokeStyle = tank.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(turretEndX, turretEndY);
  ctx.stroke();

  // Turret tip with dark border
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.beginPath();
  ctx.arc(turretEndX, turretEndY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = tank.color === "lime" ? "#FFEB3B" : "#FFC107";
  ctx.beginPath();
  ctx.arc(turretEndX, turretEndY, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawProjectile(p) {
  // Draw trail with gradient
  if (p.trail.length > 1) {
    for (let i = 1; i < p.trail.length; i++) {
      const alpha = i / p.trail.length;
      ctx.strokeStyle = `rgba(255, 200, 100, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
      ctx.lineTo(p.trail[i].x, p.trail[i].y);
      ctx.stroke();
    }
  }

  // Draw projectile with glow
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = p.type.color || "yellow";
  ctx.fillStyle = p.type.color || "yellow";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Inner bright core
  ctx.shadowBlur = 0;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Off-screen indicator
  if (p.y < 0) {
    ctx.fillStyle = "#FF5252";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#FF5252";
    ctx.beginPath();
    ctx.moveTo(p.x, 0);
    ctx.lineTo(p.x + 5, 10);
    ctx.lineTo(p.x - 5, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawUI() {
  // Player 1 Health (left side)
  ctx.textAlign = "left";
  ctx.font = "bold 20px 'Nunito', sans-serif";

  // Add text stroke for better contrast
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 4;
  ctx.strokeText(`P1`, 10, 28);

  ctx.shadowBlur = 3;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.fillStyle = "#76FF03";
  ctx.fillText(`P1`, 10, 28);

  ctx.font = "bold 22px 'Nunito', sans-serif";
  for (let i = 0; i < 3; i++) {
    if (i < player1Tank.health) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText("♥", 50 + i * 24, 28);
      ctx.fillStyle = "#FF1744";
      ctx.fillText("♥", 50 + i * 24, 28);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillText("♡", 50 + i * 24, 28);
    }
  }

  // Player 2 Health (right side)
  ctx.textAlign = "right";
  ctx.font = "bold 20px 'Nunito', sans-serif";

  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 4;
  ctx.strokeText(`P2`, SCREEN_WIDTH - 10, 28);

  ctx.fillStyle = "#FF5252";
  ctx.fillText(`P2`, SCREEN_WIDTH - 10, 28);

  ctx.font = "bold 22px 'Nunito', sans-serif";
  for (let i = 0; i < 3; i++) {
    if (i < player2Tank.health) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText("♥", SCREEN_WIDTH - 55 - (2 - i) * 24, 28);
      ctx.fillStyle = "#FF1744";
      ctx.fillText("♥", SCREEN_WIDTH - 55 - (2 - i) * 24, 28);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillText("♡", SCREEN_WIDTH - 55 - (2 - i) * 24, 28);
    }
  }

  // Current weapon display (center top)
  const activeTank = currentPlayer === 1 ? player1Tank : player2Tank;
  ctx.textAlign = "center";
  ctx.font = "bold 16px 'Nunito', sans-serif";

  // Weapon background with darker border
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(SCREEN_WIDTH / 2 - 80, 35, 160, 30);

  // Add border to weapon card
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(SCREEN_WIDTH / 2 - 80, 35, 160, 30);

  // Weapon text with stroke
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 3;
  ctx.strokeText(`🎯 ${activeTank.selectedWeapon.name}`, SCREEN_WIDTH / 2, 55);

  ctx.fillStyle = "#FFC107";
  ctx.shadowBlur = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.fillText(`🎯 ${activeTank.selectedWeapon.name}`, SCREEN_WIDTH / 2, 55);

  ctx.shadowBlur = 0;

  // Wind display (center, below weapon)
  ctx.textAlign = "center";
  ctx.font = "bold 16px 'Nunito', sans-serif";

  // Wind background with darker border
  ctx.fillStyle = "rgba(102, 126, 234, 0.7)";
  ctx.fillRect(SCREEN_WIDTH / 2 - 80, 70, 160, 30);

  // Add border to wind card
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(SCREEN_WIDTH / 2 - 80, 70, 160, 30);

  const windSpeed = Math.abs(wind.x * 100).toFixed(0);
  const windDir = wind.x > 0 ? "→" : wind.x < 0 ? "←" : "•";

  // Wind text with stroke
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 3;
  ctx.strokeText(`💨 Wind: ${windDir} ${windSpeed}`, SCREEN_WIDTH / 2, 90);

  ctx.fillStyle = "#FFFFFF";
  ctx.shadowBlur = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.fillText(`💨 Wind: ${windDir} ${windSpeed}`, SCREEN_WIDTH / 2, 90);

  ctx.shadowBlur = 0;

  // Power bar during charging
  if (gameState === GameState.POWER) {
    const barWidth = SCREEN_WIDTH * 0.6;
    const barHeight = 30;
    const barX = (SCREEN_WIDTH - barWidth) / 2;
    const barY = SCREEN_HEIGHT - 110; // Moved up to avoid overlap with turn message

    // Background shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(barX + 2, barY + 2, barWidth, barHeight);

    // Background
    ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Fill with gradient
    const powerGradient = ctx.createLinearGradient(
      barX,
      barY,
      barX + barWidth,
      barY
    );
    powerGradient.addColorStop(0, "#76FF03");
    powerGradient.addColorStop(0.5, "#FFEB3B");
    powerGradient.addColorStop(1, "#FF5252");
    ctx.fillStyle = powerGradient;
    ctx.fillRect(barX, barY, barWidth * chargePower, barHeight);

    // Power text with stroke
    ctx.font = "bold 16px 'Nunito', sans-serif";
    ctx.textAlign = "center";

    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 4;
    ctx.strokeText(
      `POWER: ${Math.floor(chargePower * 100)}%`,
      SCREEN_WIDTH / 2,
      barY - 8
    );

    ctx.fillStyle = "white";
    ctx.shadowBlur = 2;
    ctx.shadowColor = "black";
    ctx.fillText(
      `POWER: ${Math.floor(chargePower * 100)}%`,
      SCREEN_WIDTH / 2,
      barY - 8
    );
    ctx.shadowBlur = 0;
  }

  // Turn indicator
  if (gameState === GameState.AIM || gameState === GameState.POWER) {
    ctx.textAlign = "center";
    ctx.font = "bold 22px 'Fredoka One', cursive";

    // Add text stroke for better contrast
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 5;
    ctx.strokeText(
      `Player ${currentPlayer}'s Turn`,
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT - 35
    );

    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.fillStyle = currentPlayer === 1 ? "#76FF03" : "#FF5252";
    ctx.fillText(
      `Player ${currentPlayer}'s Turn`,
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT - 35
    );
    ctx.shadowBlur = 0;
  }

  // Game over screen
  if (gameState === GameState.GAME_OVER) {
    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Winner text
    ctx.textAlign = "center";
    ctx.font = "bold 52px 'Fredoka One', cursive";

    let winner = "";
    let winnerColor = "";
    if (player1Tank.health > 0 && player2Tank.health <= 0) {
      winner = "🎉 Player 1 Wins! 🎉";
      winnerColor = "#76FF03";
    } else if (player2Tank.health > 0 && player1Tank.health <= 0) {
      winner = "🎉 Player 2 Wins! 🎉";
      winnerColor = "#FF5252";
    } else {
      winner = "It's a Draw!";
      winnerColor = "#FFC107";
    }

    // Winner text stroke
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 6;
    ctx.strokeText(winner, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);

    ctx.shadowBlur = 10;
    ctx.shadowColor = winnerColor;
    ctx.fillStyle = winnerColor;
    ctx.fillText(winner, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);

    // Restart instruction
    ctx.font = "bold 26px 'Nunito', sans-serif";

    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 5;
    ctx.strokeText(
      "Press R to Restart",
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT / 2 + 40
    );

    ctx.shadowBlur = 5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.fillStyle = "white";
    ctx.fillText(
      "Press R to Restart",
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT / 2 + 40
    );
    ctx.shadowBlur = 0;
  }

  // Controls hint
  if (gameState === GameState.AIM) {
    ctx.font = "14px 'Nunito', sans-serif";
    ctx.textAlign = "center";

    if (currentPlayer === 1) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeText(
        "P1: A/D=Aim | W=Fire | S=Weapon",
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 5
      );

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(
        "P1: A/D=Aim | W=Fire | S=Weapon",
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 5
      );
    } else {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeText(
        "P2: ←/→=Aim | SPACE=Fire | TAB=Weapon",
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 5
      );

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(
        "P2: ←/→=Aim | SPACE=Fire | TAB=Weapon",
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 5
      );
    }
  }
}


// ===== GAME UPDATE =====
function update() {
  const currentTime = Date.now();
  const deltaTime = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;

  // Update tanks (always, so they fall when ground is destroyed)
  updateTank(player1Tank, deltaTime);
  updateTank(player2Tank, deltaTime);

  // Update wind particles
  windParticles.forEach((p) => p.update(deltaTime));

  // Update particles (debris, smoke, etc.)
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(deltaTime);
    if (particles[i].isDead) {
      particles.splice(i, 1);
    }
  }

  // Update napalm zones
  for (let i = napalmZones.length - 1; i >= 0; i--) {
    napalmZones[i].update(deltaTime);
    if (napalmZones[i].isDead) {
      napalmZones.splice(i, 1);
    }
  }

  // State-specific updates
  switch (gameState) {
    case GameState.AIM:
      const activeTank = currentPlayer === 1 ? player1Tank : player2Tank;
      updateTurretAiming(activeTank, deltaTime);
      break;

    case GameState.POWER:
      updatePowerCharging(deltaTime);
      break;

    case GameState.RESOLVE:
      updateProjectiles(deltaTime);
      updateExplosions(deltaTime);

      // Check if resolution is complete
      // Check if resolution is complete
      if (projectiles.length === 0 && explosions.length === 0) {
        if (!checkGameOver()) {
          // Both alive - continue game
          currentPlayer = currentPlayer === 1 ? 2 : 1;
          setRandomWind();
          gameState = GameState.AIM;
        }
      }
      break;

    case GameState.GAME_OVER:
      // Do nothing - wait for restart
      break;
  }
}

// ===== GAME OVER CHECK =====
function checkGameOver() {
  const p1Alive = player1Tank.health > 0;
  const p2Alive = player2Tank.health > 0;

  if (!p1Alive || !p2Alive) {
    gameState = GameState.GAME_OVER;
    return true;
  }
  return false;
}

// ===== KEYBOARD INPUT =====
document.addEventListener("keydown", (e) => {
  heldKeys.add(e.key);

  if (gameState === GameState.AIM) {
    const activeTank = currentPlayer === 1 ? player1Tank : player2Tank;

    // Fire (W for P1, Space for P2)
    if (
      (currentPlayer === 1 && (e.key === "w" || e.key === "W")) ||
      (currentPlayer === 2 && e.key === " ")
    ) {
      gameState = GameState.POWER;
      chargeStartTime = Date.now();
      chargePower = 0;
    }

    // Weapon switch (S for P1, Tab for P2)
    if (
      (currentPlayer === 1 && (e.key === "s" || e.key === "S")) ||
      (currentPlayer === 2 && e.key === "Tab")
    ) {
      e.preventDefault();
      cycleWeapon(activeTank);
    }
  }

  // Restart game (works in any state for debugging)
  if (e.key === "r" || e.key === "R") {
    console.log("R pressed, gameState:", gameState);
    if (gameState === GameState.GAME_OVER) {
      console.log("Restarting game...");
      initializeGame();
    }
  }

  // Cluster bomb manual split (during RESOLVE state)
  if (gameState === GameState.RESOLVE) {
    // Player 1: W key
    if (currentPlayer === 1 && (e.key === "w" || e.key === "W")) {
      triggerClusterSplit(1);
    }
    // Player 2: SPACE key
    if (currentPlayer === 2 && e.key === " ") {
      triggerClusterSplit(2);
    }
  }
});

// Trigger cluster bomb split for active player
function triggerClusterSplit(player) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.owner === player && p.type === ProjectileType.CLUSTER && p.canSplit) {
      console.log("🎆 Cluster split triggered!");
      splitClusterBomb(p);
      projectiles.splice(i, 1);
      break; // Only split the first cluster found
    }
  }
}

document.addEventListener("keyup", (e) => {
  heldKeys.delete(e.key);

  if (gameState === GameState.POWER) {
    // Fire on release (W for P1, Space for P2)
    if (
      (currentPlayer === 1 && (e.key === "w" || e.key === "W")) ||
      (currentPlayer === 2 && e.key === " ")
    ) {
      fireProjectile();
    }
  }
});

// ===== WEAPON CYCLING =====
function cycleWeapon(tank) {
  const weapons = [
    ProjectileType.REGULAR,
    ProjectileType.CLUSTER,
    ProjectileType.BOUNCING,
    ProjectileType.HEAVY,
    ProjectileType.DIGGER,
    ProjectileType.NAPALM,
    ProjectileType.MIRV,
    ProjectileType.TELEPORTER,
  ];
  const idx = weapons.indexOf(tank.selectedWeapon);
  tank.selectedWeapon = weapons[(idx + 1) % weapons.length];
}

// ===== GAME INITIALIZATION =====
function initializeGame() {
  generateTerrain();
  placeTanks();
  setRandomWind();

  // Initialize wind particles
  windParticles = [];
  for (let i = 0; i < 150; i++) {
    windParticles.push(new WindParticle());
  }

  // Reset game state
  gameState = GameState.AIM;
  currentPlayer = 1;
  projectiles = [];
  explosions = [];
  chargePower = 0;

  // Reset weapons
  player2Tank.selectedWeapon = ProjectileType.REGULAR;

  console.log("Game Initialized. Wind particles:", windParticles.length);
  lastFrameTime = Date.now();
}

// ===== GAME LOOP =====
function gameLoop() {
  try {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  } catch (e) {
    console.error("Game Loop Error:", e);
  }
}

// ===== START GAME =====
initializeGame();
gameLoop();
