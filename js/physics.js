import { state } from "./state.js";
import {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    TANK_HEIGHT,
    TURRET_LENGTH,
    MAX_LAUNCH_SPEED,
    GRAVITY,
    ProjectileType,
    GameState,
} from "./constants.js";
import { createMuzzleFlash, NapalmZone, Explosion } from "./classes/Particles.js";
import {
    playShootSound,
    playNapalmSound,
    playTeleportSound,
    playGroundHitSound,
} from "./audio.js";

// ===== UPDATE LOOPS =====
export function updateTank(tank, dt) {
    if (tank.health <= 0) return;

    const x = Math.floor(tank.x);
    if (x >= 0 && x < SCREEN_WIDTH) {
        const groundY = state.terrain[x];
        if (tank.y + TANK_HEIGHT < groundY) {
            tank.y += 100 * dt;
        } else {
            tank.y = groundY - TANK_HEIGHT;
        }
    }
    if (tank.y > SCREEN_HEIGHT) tank.health = 0;
}

export function updatePowerCharging(deltaTime) {
    const elapsed = Date.now() - state.chargeStartTime;
    state.chargePower = Math.min(elapsed / 2000, 1); // MAX_CHARGE_TIME is 2000

    if (state.chargePower >= 1 && state.currentPlayer === 1) fireProjectile();
}

export function fireProjectile() {
    const activeTank = state.currentPlayer === 1 ? state.player1Tank : state.player2Tank;
    const weapon = activeTank.selectedWeapon;

    const turretX =
        activeTank.x + Math.cos(activeTank.turretAngle) * TURRET_LENGTH;
    const turretY =
        activeTank.y + Math.sin(activeTank.turretAngle) * TURRET_LENGTH;

    const power = state.chargePower * MAX_LAUNCH_SPEED;

    state.projectiles.push({
        x: turretX,
        y: turretY,
        vx: Math.cos(activeTank.turretAngle) * power,
        vy: Math.sin(activeTank.turretAngle) * power,
        type: weapon,
        owner: state.currentPlayer,
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

    state.gameState = GameState.RESOLVE;
    state.chargePower = 0;
}

export function splitProjectile(parent) {
    const weapon = parent.type;
    // Lapsiammuksen tyyppi on sama, mutta säde asetetaan childRadius-arvoon
    const childType = { ...weapon, explosionRadius: weapon.childRadius };

    for (let k = 0; k < weapon.childCount; k++) {
        state.projectiles.push({
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

export function explodeProjectile(p, index) {
    state.explosions.push(new Explosion(p.x, p.y, p.type.explosionRadius));
    playGroundHitSound();

    // Tähtäyskorjaus: Päivitä impact, jos P2 ampuu
    if (p.owner === 2 && state.bot) {
        const dx = Math.abs(p.x - state.player2Tank.x);
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
            impactXToRecord = state.player2Tank.x - 250;
            updateImpact = true;
            console.log(
                `🤖 Bot EMERGENCY ESCAPE: Close impact (${p.type.name
                } at X:${p.x.toFixed(
                    0
                )}). Setting correction target to X:${impactXToRecord.toFixed(0)}.`
            );
        }

        if (updateImpact) {
            state.bot.updateLastImpact(impactXToRecord);
        } else {
            // Ignoroidaan Cluster/Mirv emoammus, Bouncing emoammus (jos ei hätätilanne)
            console.log(
                `🤖 Bot: Not updating impact (Irregular shot: ${p.type.name}).`
            );
        }
    }

    state.projectiles.splice(index, 1);
}

export function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        let p = state.projectiles[i];

        p.flightTime = (p.flightTime || 0) + dt;

        p.vx += state.wind.x * dt * 0.5;
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
            state.projectiles.splice(i, 1);
            continue;
        }

        if (p.type === ProjectileType.DIGGER && p.y > state.terrain[Math.floor(p.x)]) {
            p.penetration = (p.penetration || 0) + Math.abs(p.vy) * dt;
            if (p.penetration > p.type.penetrationDepth) {
                explodeProjectile(p, i);
            }
            continue;
        }

        if (p.y >= state.terrain[Math.floor(p.x)] || p.x < 0 || p.x > SCREEN_WIDTH) {
            // Korjaus: Botin laukaus meni reunan yli vasemmalle (yliammunta P1:lle).
            if (p.owner === 2 && p.x < 0 && state.bot) {
                const targetTank = state.player1Tank;
                // Kirjaa osuma kuvitteellisesti kauas maalin ohi pakottaakseen tehon vähennyksen.
                state.bot.updateLastImpact(targetTank.x - 100);
                console.log(
                    "🤖 Bot: Shot flew off screen (Left). Forcing power adjustment for massive overshoot."
                );
                state.projectiles.splice(i, 1);
                continue;
            }

            if (p.type === ProjectileType.BOUNCING && p.bounces > 0) {
                p.vy = -p.vy * 0.6;
                p.bounces--;
                p.y -= 5;
            } else if (p.type === ProjectileType.NAPALM) {
                state.napalmZones.push(
                    new NapalmZone(p.x, p.y, p.type.fireRadius, p.type.fireDuration)
                );
                playNapalmSound();
                // NAPALM KIRJAA OSUMANSA explodeProjectile-funktiossa
                explodeProjectile(p, i);
            } else if (p.type === ProjectileType.TELEPORTER) {
                const tank = p.owner === 1 ? state.player1Tank : state.player2Tank;
                tank.x = p.x;
                tank.y = p.y - TANK_HEIGHT;
                playTeleportSound();
                state.projectiles.splice(i, 1);
            } else {
                explodeProjectile(p, i);
            }
        }
    }
}

export function updateExplosions(dt) {
    for (let i = state.explosions.length - 1; i >= 0; i--) {
        state.explosions[i].update(dt);
        if (state.explosions[i].isDead) {
            state.explosions.splice(i, 1);
        }
    }
}
