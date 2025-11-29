import { ProjectileType, ctx } from "./constants.js";

// ===== INVENTORY UTILS =====
export function generateRandomInventory() {
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
            inventory[key] = Math.random() < 0.5 ? 0 : 1; // 0-1
        }
    }
    return inventory;
}

// Helper function to draw a star shape
export function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
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
