
// Mock browser environment
global.window = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: () => { },
};
global.document = {
    getElementById: () => ({
        getContext: () => ({
            canvas: { width: 800, height: 600 },
            clearRect: () => { },
            beginPath: () => { },
            moveTo: () => { },
            lineTo: () => { },
            stroke: () => { },
            fill: () => { },
            fillRect: () => { },
            arc: () => { },
            save: () => { },
            restore: () => { },
            translate: () => { },
            rotate: () => { },
            fillText: () => { },
            measureText: () => ({ width: 0 }),
        }),
        width: 800,
        height: 600,
    }),
};
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.Image = class { };

// Load the script content
const fs = require('fs');
const scriptContent = fs.readFileSync('script.js', 'utf8');
// Evaluate the script in the global context
try {
    eval(scriptContent);
} catch (e) {
    console.log("Error evaluating script:");
    console.log(e.message);
    console.log(e.stack);
}

console.log("Script loaded.");
console.log("Running game loop...");
for (let i = 0; i < 60; i++) {
    gameLoop();
}

// Trigger fire
console.log("Triggering fireProjectile...");
// We need to set state to AIM and power to something
gameState = GameState.AIM;
chargePower = 50;
fireProjectile();

console.log("Post-fire game loop...");
// Run loop again to see if it freezes
for (let i = 0; i < 60; i++) {
    gameLoop();
}

console.log("Test completed successfully.");
