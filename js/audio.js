// ===== SOUND =====
export function playShootSound() {
    new Audio("sounds/shoot.wav").play();
    console.log("🔊 SHOOT");
}
export function playGroundHitSound() {
    new Audio("sounds/ground_hit.wav").play();
    console.log("🔊 GROUND HIT");
}
export function playTankHitSound() {
    new Audio("sounds/tank_hit.wav").play();
    console.log("🔊 TANK HIT");
}
export function playTankDestroySound() {
    new Audio("sounds/tank_destroy.wav").play();
    console.log("🔊 TANK DESTROYED");
}
export function playNapalmSound() {
    new Audio("sounds/napalm.wav").play();
    console.log("🔊 NAPALM");
}
export function playTeleportSound() {
    new Audio("sounds/teleport.wav").play();
    console.log("🔊 TELEPORT");
}
