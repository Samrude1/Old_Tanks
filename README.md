# Scorched Earth - Tanks Game

A modern recreation of the classic Scorched Earth artillery game with enhanced physics, multiple weapon types, and two-player local multiplayer.

![Tanks Game](screenshot.png?v2)

## Features

### Core Gameplay

- **Two-Player Local Multiplayer** - Battle on the same keyboard
- **Realistic Physics** - Gravity, wind, and ballistic trajectories
- **Dynamic Terrain** - Procedurally generated landscapes with destruction
- **Multiple Weapon Types** - Regular, Cluster, Bouncing, and Heavy projectiles

### Game Mechanics

- **Turret Aiming** - Precise angle control with keyboard
- **Power Charging** - Hold-to-charge firing system
- **Wind System** - Visual wind particles affect projectile flight
- **Terrain Destruction** - Circular crater deformation on impact
- **Tank Gravity** - Tanks fall when ground is destroyed beneath them

### Visual Effects

- **Animated Explosions** - Growing and shrinking blast effects
- **Projectile Trails** - Visual feedback for shot tracking
- **Wind Particles** - 150 particles showing wind direction and strength
- **Health Display** - Heart-based health indicators

## Controls

### Player 1 (Green Tank)

- **A/D** - Aim turret left/right
- **W** - Hold to charge power, release to fire
- **S** - Cycle through weapons

### Player 2 (Red Tank)

- **←/→** - Aim turret left/right
- **SPACE** - Hold to charge power, release to fire
- **TAB** - Cycle through weapons

### General

- **R** - Restart game

## Weapons

1. **Regular** - Standard projectile with medium explosion
2. **Cluster** - Splits into 5 smaller projectiles on impact
3. **Bouncing** - Bounces off terrain 2 times before exploding
4. **Heavy** - Large explosion radius for maximum damage

## Configuration

The game includes several configurable constants in `script.js`:

```javascript
const GRAVITY = 20; // Physics gravity
const MAX_WIND_SPEED = 5; // Maximum wind strength
const MAX_LAUNCH_SPEED = 200; // Shot power (default: 200)
const PROJECTILE_SPEED_MULTIPLIER = 2.0; // Visual speed (default: 1.0)
```

### Adjustable Parameters

- **MAX_LAUNCH_SPEED** - Increase for more powerful shots
- **PROJECTILE_SPEED_MULTIPLIER** - Adjust visual speed without changing physics
  - `1.0` = Normal speed
  - `2.0` = 2x faster visually
  - `0.5` = Slow motion effect

## Technical Details

### Physics System

- Delta-time based physics for consistent gameplay
- Separate visual speed multiplier for performance tuning
- Wind affects projectiles realistically (subtle horizontal force)
- Gravity constant matches reference implementation

### Terrain Generation

- Multi-octave noise for varied landscapes
- Random features (hills, valleys, plateaus)
- 2-4 unique features per map
- Smooth and plateau terrain types

### Game States

- **AIM** - Player adjusts turret angle
- **POWER** - Player charges shot power
- **RESOLVE** - Projectiles in flight, explosions active
- **GAME_OVER** - Victory screen with restart option

## Installation

1. Clone the repository
2. Open `index.html` in a modern web browser
3. No build process required - pure HTML/CSS/JavaScript

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with Canvas support

## Development

### File Structure

```
tanks/
├── index.html          # Main HTML file
├── script.js           # Game logic and physics
├── style.css           # Styling
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Credits

Inspired by the classic DOS game "Scorched Earth" (1991) by Wendell Hicken.

## License

MIT License - Feel free to use and modify!

## Roadmap

See `enhancement_plan.md` for upcoming features including:

- Camera shake and visual polish
- Limited ammo system
- Power-ups and strategic features
