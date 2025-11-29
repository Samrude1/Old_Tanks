import { state } from "./state.js";
import { GameState, ProjectileType } from "./constants.js";
import { initializeGame } from "./gameLogic.js";
import { fireProjectile, splitProjectile } from "./physics.js";

// ===== INPUT & CONTROLS (Pelaaja 1) =====
export function updatePlayerAiming(dt) {
    const tank = state.player1Tank;
    const rate = 1.0;
    if (state.heldKeys.has("a") || state.heldKeys.has("A")) tank.turretAngle -= rate * dt;
    if (state.heldKeys.has("d") || state.heldKeys.has("D")) tank.turretAngle += rate * dt;
    tank.turretAngle = Math.max(-Math.PI, Math.min(0, tank.turretAngle));
}

export function setupInputListeners() {
    document.addEventListener("keydown", (e) => {
        state.heldKeys.add(e.key);

        if (e.key === "r" || e.key === "R") initializeGame();

        if (state.currentPlayer === 1 && state.gameState === GameState.AIM) {
            if (e.key === "w" || e.key === "W") {
                state.gameState = GameState.POWER;
                state.chargeStartTime = Date.now();
                state.chargePower = 0;
            }
            if (e.key === "s" || e.key === "S") {
                const keys = Object.keys(ProjectileType);
                let currentIdx = keys.indexOf(state.player1Tank.selectedWeapon.id);
                let nextIdx = currentIdx;
                let found = false;

                // Etsi seuraava ase, jolla on ammuksia
                for (let i = 0; i < keys.length; i++) {
                    nextIdx = (nextIdx + 1) % keys.length;
                    const weaponKey = keys[nextIdx];
                    if (state.player1Tank.weapons[weaponKey] > 0) {
                        state.player1Tank.selectedWeapon = ProjectileType[weaponKey];
                        found = true;
                        break;
                    }
                }
            }
        }

        // Pelaaja 1:n Cluster-ammuksen manuaalinen split
        if (
            state.gameState === GameState.RESOLVE &&
            state.currentPlayer === 1 &&
            (e.key === "w" || e.key === "W")
        ) {
            for (let i = state.projectiles.length - 1; i >= 0; i--) {
                let p = state.projectiles[i];
                // Etsi Cluster-tyyppinen ammus, joka kuuluu P1:lle ja voi vielä splitata
                if (
                    p.type === ProjectileType.CLUSTER &&
                    p.owner === state.currentPlayer &&
                    p.canSplit
                ) {
                    splitProjectile(p);
                    state.projectiles.splice(i, 1); // Poista emoammus
                    break; // Oletetaan, että vain yksi ammus lentää kerrallaan
                }
            }
        }
    });

    document.addEventListener("keyup", (e) => {
        state.heldKeys.delete(e.key);
        if (
            state.currentPlayer === 1 &&
            state.gameState === GameState.POWER &&
            (e.key === "w" || e.key === "W")
        ) {
            fireProjectile();
        }
    });
}
