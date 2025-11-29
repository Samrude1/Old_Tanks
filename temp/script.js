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
  AIM: "aim",
  POWER: "power",
  RESOLVE: "resolve",
  GAME_OVER: "game_over",
};

// ===== PROJECTILE TYPES =====
const ProjectileType = {
  REGULAR: { name: "Regular", explosionRadius: 30, color: "yellow" },
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
    bounces: 2,
  },
  HEAVY: { name: "Heavy", explosionRadius: 70, color: "red" },
  DIGGER: {
    name: "Digger",
    explosionRadius: 35,
    color: "brown",
    penetrationDepth: 80,
  },
  NAPALM: {
    name: "Napalm",
    explosionRadius: 25,
    color: "orangered",
    fireDuration: 1000,
    fireRadius: 60,
  },
  MIRV: {
    name: "MIRV",
    explosionRadius: 20,
    color: "purple",
    childCount: 3,
    childRadius: 30,
  },
  TELEPORTER: { name: "Teleporter", color: "cyan" },
};

// ===== GAME VARIABLES =====
let gameState = GameState.AIM;
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
};

let player2Tank = {
  x: 700,
  y: 0,
  color: "red",
  turretAngle: -Math.PI * 0.75,
  health: 3,
  selectedWeapon: ProjectileType.REGULAR,
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

// ===== SHOOTER BOT AI =====
class ShooterBot {
  constructor(kFactor = 0.6) {
    this.K_FACTOR = kFactor;
    this.lastPower = 0;
    this.lastImpactX = 0;
    this.currentAngle = -Math.PI * 0.75;
    this.state = "WAITING";
    this.timer = 0;
    this.targetPower = 0;
    this.turnCounter = 0;
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

    // Aseenvalinta
    // TELEPORTER POISTETTU yleisestä erikoisasevalikoimasta
    let specialWeapons = [
      ProjectileType.HEAVY,
      ProjectileType.DIGGER,
      ProjectileType.NAPALM,
    ];
    const commonWeapons = [
      ProjectileType.REGULAR,
      ProjectileType.CLUSTER,
      ProjectileType.BOUNCING,
    ];
    const cycleIndex = (this.turnCounter - 1) % commonWeapons.length;

    // 1. EASTER EGG: Teleporter (1% chance)
    if (Math.random() < 0.01) {
      botTank.selectedWeapon = ProjectileType.TELEPORTER;
      console.log("🤖 Bot: EASTER EGG! Using Teleporter (1% chance).");
    }
    // 2. Kriisitilanne: Botin matala elinvoima
    else if (botTank.health <= 1) {
      if (Math.random() < 0.5) {
        // 50% todennäköisyys MIRV
        botTank.selectedWeapon = ProjectileType.MIRV;
        console.log("🤖 Bot: Desperate shot! Using MIRV (50% chance).");
      } else {
        // 50% todennäköisyys Heavy/Napalm
        const lowHealthWeapons = [ProjectileType.HEAVY, ProjectileType.NAPALM];
        const lowHealthIndex = (this.turnCounter - 1) % lowHealthWeapons.length;
        botTank.selectedWeapon = lowHealthWeapons[lowHealthIndex];
        console.log(
          `🤖 Bot: Low health fallback! Cycling to ${botTank.selectedWeapon.name}.`
        );
      }
    }
    // 3. Erikoistilanne: Satunnainen erikoisammus (20% todennäköisyys)
    else if (Math.random() < 0.2) {
      const randomSpecial =
        specialWeapons[Math.floor(Math.random() * specialWeapons.length)];
      botTank.selectedWeapon = randomSpecial;
      console.log(`🤖 Bot: Lucky shot! Using ${randomSpecial.name}.`);
    }
    // 4. Pääsääntö: Kierrätä kolmea yleisintä
    else {
      botTank.selectedWeapon = commonWeapons[cycleIndex];
      console.log(`🤖 Bot: Cycling weapon to ${botTank.selectedWeapon.name}.`);
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

      // Pieni satunnaisuus ylikorjaamisen estämiseksi
      newPower += (Math.random() - 0.5) * 10;

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

const bot = new ShooterBot();

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
    // Enhanced visibility - larger, more opaque particles
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 2, 2);
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

// ===== EXPLOSION CLASS & UPDATES (Ei muutoksia) =====
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

// ===== TERRAIN & SETUP (Ei muutoksia) =====
function generateTerrain() {
  terrain = [];
  let height = 400;
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    height += (Math.random() - 0.5) * 5;
    height = Math.max(200, Math.min(SCREEN_HEIGHT - 50, height));
    terrain[x] = height;
  }
  for (let i = 0; i < 3; i++) {
    for (let x = 1; x < SCREEN_WIDTH - 1; x++) {
      terrain[x] = (terrain[x - 1] + terrain[x] + terrain[x + 1]) / 3;
    }
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

// ===== UPDATE LOOPS (Ei muutoksia) =====
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
        `🤖 Bot EMERGENCY ESCAPE: Close impact (${
          p.type.name
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
      let currentIdx = keys.indexOf(
        Object.keys(ProjectileType).find(
          (k) => ProjectileType[k] === player1Tank.selectedWeapon
        )
      );
      let nextIdx = (currentIdx + 1) % keys.length;
      player1Tank.selectedWeapon = ProjectileType[keys[nextIdx]];
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
    return true;
  }
  return false;
}

function draw() {
  // Cartoon style: Bright blue sky with gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  gradient.addColorStop(0, "#c3d6ffff"); // Sky blue at top
  gradient.addColorStop(0.6, "#95c7ffff");
  gradient.addColorStop(1, "#3168ffff"); // Slightly deeper at horizon
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  windParticles.forEach((p) => p.draw());

  // Cartoon style: Vibrant green grass
  ctx.fillStyle = "#228B22"; // Forest green
  ctx.beginPath();
  ctx.moveTo(0, SCREEN_HEIGHT);
  for (let x = 0; x < SCREEN_WIDTH; x++) ctx.lineTo(x, terrain[x]);
  ctx.lineTo(SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fill();

  // Add darker green outline for cartoon effect
  ctx.strokeStyle = "#1a6b1a";
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

  // Draw tank body with outline
  ctx.fillRect(-10, 0, 20, 10);
  ctx.strokeRect(-10, 0, 20, 10);

  // Draw turret with outline
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(tank.turretAngle) * 15, Math.sin(tank.turretAngle) * 15);
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

  // Aseet nollataan
  player1Tank.selectedWeapon = ProjectileType.REGULAR;
  player2Tank.selectedWeapon = ProjectileType.REGULAR;
}

// ===== START (Ei muutoksia) =====
initializeGame();
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
