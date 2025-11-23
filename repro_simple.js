
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

console.log("Requiring script.js...");
try {
    require('./script.js');
    console.log("Script required successfully.");
} catch (e) {
    console.error("Error requiring script:");
    console.error(e);
}
