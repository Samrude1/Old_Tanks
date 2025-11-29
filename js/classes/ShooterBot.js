import { BotPersonalities, ProjectileType, TANK_HEIGHT, MAX_LAUNCH_SPEED, MAX_CHARGE_TIME, GameState } from "../constants.js";
import { state } from "../state.js";
import { fireProjectile } from "../physics.js";

// ===== SHOOTER BOT AI =====
export class ShooterBot {
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
            if (state.terrain[Math.floor(x)] < lineY - 30) {
                return true;
            }
        }
        return false;
    }

    calculateShot() {
        const botTank = state.player2Tank;
        const targetTank = state.player1Tank;

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
        const initialGroundY = state.terrain[Math.floor(botTank.x)]; // Current ground level at bot's X
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

        newPower -= state.wind.x * 2.5;
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
            const diff = this.currentAngle - state.player2Tank.turretAngle;

            if (Math.abs(diff) > 0.05) {
                state.player2Tank.turretAngle += Math.sign(diff) * deltaTime * 2.0;
            } else {
                state.player2Tank.turretAngle = this.currentAngle;
                this.state = "CHARGING";

                state.gameState = GameState.POWER;
                state.chargeStartTime = Date.now();
                state.chargePower = 0;
                console.log("🤖 Bot: Aiming complete. Transition to CHARGING.");
            }
        }

        if (this.state === "CHARGING") {
            const requiredCharge = this.targetPower / MAX_LAUNCH_SPEED;
            const elapsed = Date.now() - state.chargeStartTime;
            state.chargePower = Math.min(elapsed / MAX_CHARGE_TIME, 1);

            if (state.chargePower >= requiredCharge) {
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
        if (state.currentPlayer === 2) {
            this.lastImpactX = x;
            console.log(`🤖 Bot recorded impact at X: ${x.toFixed(0)}`);
        }
    }
}
