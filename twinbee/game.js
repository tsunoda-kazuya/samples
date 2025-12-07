// =====================================================
// TWINBEE - Classic Shooting Game Recreation
// =====================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GAME_WIDTH = 320;
const GAME_HEIGHT = 480;
const SCROLL_SPEED = 1.5;

// Game state
let gameStarted = false;
let gamePaused = false;
let gameOver = false;
let score = 0;
let lives = 3;
let stage = 1;
let frameCount = 0;
let scrollY = 0;

// Sound
let soundEnabled = true;
let audioContext = null;

// Player (TwinBee)
const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 80,
    width: 32,
    height: 32,
    speed: 4,
    shotLevel: 1,      // 1=single, 2=double, 3=spread
    hasShield: false,
    speedUp: 0,
    options: [],       // trailing options
    armLeft: true,     // arms can be shot off
    armRight: true,
    invincible: 0,
    punchCooldown: 0
};

// Bullets
let playerBullets = [];
let enemyBullets = [];

// Bells and clouds
let bells = [];
let clouds = [];

// Enemies
let airEnemies = [];
let groundEnemies = [];

// Ground objects
let groundTiles = [];

// Effects
let explosions = [];
let particles = [];

// Input
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    shot: false,
    bomb: false
};

// Bell colors and their effects
const BELL_COLORS = {
    YELLOW: '#FFD700',   // Points (increases with consecutive catches)
    BLUE: '#4169E1',     // Speed up
    WHITE: '#FFFFFF',    // Twin shot (double)
    GREEN: '#32CD32',    // Shield (barrier)
    RED: '#FF4444'       // Option (trailing helper)
};

const BELL_EFFECTS = ['YELLOW', 'BLUE', 'WHITE', 'GREEN', 'RED'];

// =====================================================
// SOUND SYSTEM
// =====================================================

function initAudio() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio not supported');
    }
}

function playTone(freq, duration, type = 'square', volume = 0.3) {
    if (!soundEnabled || !audioContext) return;

    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);

        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start();
        osc.stop(audioContext.currentTime + duration);
    } catch (e) {}
}

function playShot() {
    playTone(880, 0.05, 'square', 0.2);
}

function playBellHit() {
    playTone(1200, 0.08, 'square', 0.2);
}

function playBellGet() {
    playTone(880, 0.1, 'square', 0.3);
    setTimeout(() => playTone(1100, 0.1, 'square', 0.3), 50);
    setTimeout(() => playTone(1320, 0.15, 'square', 0.3), 100);
}

function playExplosion() {
    playTone(100, 0.2, 'sawtooth', 0.4);
    playTone(80, 0.3, 'square', 0.3);
}

function playPowerUp() {
    playTone(523, 0.1, 'square', 0.3);
    setTimeout(() => playTone(659, 0.1, 'square', 0.3), 100);
    setTimeout(() => playTone(784, 0.1, 'square', 0.3), 200);
    setTimeout(() => playTone(1047, 0.2, 'square', 0.3), 300);
}

function playPunch() {
    playTone(150, 0.15, 'sawtooth', 0.4);
}

function playHit() {
    playTone(200, 0.1, 'sawtooth', 0.5);
    playTone(100, 0.2, 'square', 0.4);
}

function playGameOver() {
    const notes = [392, 349, 330, 294, 262];
    notes.forEach((note, i) => {
        setTimeout(() => playTone(note, 0.3, 'square', 0.3), i * 200);
    });
}

// BGM
let bgmInterval = null;
let bgmStep = 0;
const bgmMelody = [
    523, 587, 659, 698, 784, 698, 659, 587,
    523, 587, 659, 784, 880, 784, 659, 523,
    440, 494, 523, 587, 659, 587, 523, 494,
    440, 523, 659, 784, 880, 659, 523, 440
];
const bgmBass = [
    262, 262, 294, 294, 330, 330, 349, 349,
    262, 262, 330, 330, 392, 392, 330, 262,
    220, 220, 262, 262, 330, 330, 294, 294,
    220, 262, 330, 392, 440, 330, 262, 220
];

function startBGM() {
    if (bgmInterval) return;
    bgmStep = 0;
    bgmInterval = setInterval(() => {
        if (!gamePaused && soundEnabled && audioContext) {
            const melodyNote = bgmMelody[bgmStep % bgmMelody.length];
            const bassNote = bgmBass[bgmStep % bgmBass.length];
            playTone(melodyNote, 0.12, 'square', 0.15);
            playTone(bassNote / 2, 0.12, 'triangle', 0.1);
            bgmStep++;
        }
    }, 150);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}

// =====================================================
// DRAWING FUNCTIONS
// =====================================================

function drawTwinBee(x, y, invincible) {
    ctx.save();
    ctx.translate(x, y);

    // Flash when invincible
    if (invincible > 0 && Math.floor(frameCount / 3) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // Main body (light blue oval)
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4169E1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cockpit window
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(0, -4, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pilot face
    ctx.fillStyle = '#FFE4C4';
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-2, -5, 1, 0, Math.PI * 2);
    ctx.arc(2, -5, 1, 0, Math.PI * 2);
    ctx.fill();

    // Arms (boxing gloves)
    if (player.armLeft) {
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.ellipse(-18, 2, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#CC4444';
        ctx.stroke();
        // Arm connector
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(-14, -1, 4, 6);
    }

    if (player.armRight) {
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.ellipse(18, 2, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#CC4444';
        ctx.stroke();
        // Arm connector
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(10, -1, 4, 6);
    }

    // Feet
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.ellipse(-6, 14, 5, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 14, 5, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Propeller on top
    const propAngle = frameCount * 0.5;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10 * Math.cos(propAngle), -18);
    ctx.lineTo(10 * Math.cos(propAngle), -18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10 * Math.sin(propAngle), -18);
    ctx.lineTo(10 * Math.sin(propAngle), -18);
    ctx.stroke();

    // Propeller hub
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, -18, 3, 0, Math.PI * 2);
    ctx.fill();

    // Shield effect
    if (player.hasShield) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + Math.sin(frameCount * 0.2) * 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function drawOption(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Small helper ship
    ctx.fillStyle = '#FFA500';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CC7000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBell(bell) {
    ctx.save();
    ctx.translate(bell.x, bell.y);

    // Bell swing animation
    const swing = Math.sin(frameCount * 0.15) * 0.2;
    ctx.rotate(swing);

    // Bell body
    ctx.fillStyle = bell.color;
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.quadraticCurveTo(-12, 8, 0, 12);
    ctx.quadraticCurveTo(12, 8, 10, -8);
    ctx.quadraticCurveTo(5, -12, 0, -12);
    ctx.quadraticCurveTo(-5, -12, -10, -8);
    ctx.fill();

    // Bell outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bell clapper
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 6, 3, 0, Math.PI * 2);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-4, -4, 3, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawCloud(cloud) {
    ctx.save();
    ctx.translate(cloud.x, cloud.y);

    ctx.fillStyle = cloud.hasBell ? '#E8E8E8' : '#D3D3D3';

    // Fluffy cloud shape
    ctx.beginPath();
    ctx.arc(-12, 0, 12, 0, Math.PI * 2);
    ctx.arc(8, -4, 14, 0, Math.PI * 2);
    ctx.arc(12, 8, 10, 0, Math.PI * 2);
    ctx.arc(-8, 8, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#BBB';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

function drawBullet(bullet) {
    ctx.fillStyle = bullet.color || '#FFD700';
    ctx.beginPath();
    ctx.ellipse(bullet.x, bullet.y, bullet.width / 2, bullet.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.fillStyle = 'rgba(255, 255, 200, 0.5)';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.width / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyBullet(bullet) {
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFAAAA';
    ctx.beginPath();
    ctx.arc(bullet.x - 1, bullet.y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawAirEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    switch (enemy.type) {
        case 'bee':
            // Bee enemy (similar to TwinBee but evil)
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.ellipse(0, -2, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(-3, -3, 3, 0, Math.PI * 2);
            ctx.arc(3, -3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-3, -3, 1.5, 0, Math.PI * 2);
            ctx.arc(3, -3, 1.5, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'spinner':
            // Spinning enemy
            ctx.rotate(frameCount * 0.1);
            ctx.fillStyle = '#9932CC';
            ctx.fillRect(-10, -3, 20, 6);
            ctx.fillRect(-3, -10, 6, 20);
            ctx.fillStyle = '#DDA0DD';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'floater':
            // Floating jellyfish-like enemy
            ctx.fillStyle = '#00CED1';
            ctx.beginPath();
            ctx.arc(0, 0, 12, Math.PI, 0);
            ctx.fill();
            // Tentacles
            ctx.strokeStyle = '#00CED1';
            ctx.lineWidth = 2;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 4, 0);
                const wave = Math.sin(frameCount * 0.1 + i) * 3;
                ctx.quadraticCurveTo(i * 4 + wave, 8, i * 4, 16);
                ctx.stroke();
            }
            break;

        case 'bomber':
            // Large bomber enemy
            ctx.fillStyle = '#2F4F4F';
            ctx.beginPath();
            ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FF6347';
            ctx.fillRect(-20, -4, 8, 8);
            ctx.fillRect(12, -4, 8, 8);
            // Cockpit
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, -4, 6, 0, Math.PI * 2);
            ctx.fill();
            break;
    }

    ctx.restore();
}

function drawGroundEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    switch (enemy.type) {
        case 'turret':
            // Ground turret
            ctx.fillStyle = '#556B2F';
            ctx.fillRect(-12, -8, 24, 16);
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(0, -8, 8, Math.PI, 0);
            ctx.fill();
            // Cannon
            ctx.fillStyle = '#333';
            ctx.fillRect(-3, -16, 6, 10);
            break;

        case 'tank':
            // Moving tank
            ctx.fillStyle = '#6B8E23';
            ctx.fillRect(-14, -6, 28, 12);
            ctx.fillStyle = '#556B2F';
            ctx.fillRect(-10, -12, 20, 8);
            // Treads
            ctx.fillStyle = '#333';
            ctx.fillRect(-16, 4, 32, 4);
            break;

        case 'building':
            // Building/structure
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-16, -20, 32, 40);
            ctx.fillStyle = '#654321';
            ctx.fillRect(-12, -16, 10, 10);
            ctx.fillRect(2, -16, 10, 10);
            ctx.fillRect(-12, 0, 10, 10);
            ctx.fillRect(2, 0, 10, 10);
            break;
    }

    ctx.restore();
}

function drawExplosion(exp) {
    ctx.save();
    ctx.translate(exp.x, exp.y);

    const progress = exp.frame / exp.maxFrames;
    const radius = exp.size * (0.5 + progress);
    const alpha = 1 - progress;

    // Outer explosion
    ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Middle
    ctx.fillStyle = `rgba(255, 200, 0, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawParticle(p) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawPunch(x, y, direction) {
    ctx.save();
    ctx.translate(x, y);

    // Punch wave effect
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 20 + direction * 10, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 20 + direction * 15, 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.7, '#98FB98');
    gradient.addColorStop(1, '#228B22');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Scrolling ground pattern
    const groundY = GAME_HEIGHT * 0.7;
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, groundY, GAME_WIDTH, GAME_HEIGHT - groundY);

    // Ground details (fields, roads, etc.)
    ctx.fillStyle = '#32CD32';
    for (let i = 0; i < 5; i++) {
        const y = (groundY + 20 + i * 60 + scrollY * 0.5) % (GAME_HEIGHT * 0.5) + groundY;
        ctx.fillRect(0, y, GAME_WIDTH, 30);
    }

    // Rivers/paths
    ctx.fillStyle = '#4169E1';
    const riverY = (groundY + 100 + scrollY * 0.3) % 200 + groundY;
    ctx.beginPath();
    ctx.moveTo(0, riverY);
    for (let x = 0; x <= GAME_WIDTH; x += 20) {
        ctx.lineTo(x, riverY + Math.sin((x + scrollY) * 0.02) * 15);
    }
    ctx.lineTo(GAME_WIDTH, riverY + 20);
    ctx.lineTo(0, riverY + 20);
    ctx.fill();
}

// =====================================================
// GAME LOGIC
// =====================================================

function spawnCloud() {
    if (Math.random() < 0.02) {
        clouds.push({
            x: Math.random() * (GAME_WIDTH - 60) + 30,
            y: -40,
            width: 40,
            height: 30,
            hasBell: Math.random() < 0.7, // 70% chance to have a bell
            hits: 0
        });
    }
}

function spawnAirEnemy() {
    if (Math.random() < 0.015 + stage * 0.003) {
        const types = ['bee', 'spinner', 'floater', 'bomber'];
        const type = types[Math.floor(Math.random() * types.length)];

        let health = 1;
        let points = 100;
        let shootInterval = 0;

        switch (type) {
            case 'bee':
                health = 1;
                points = 100;
                shootInterval = 120;
                break;
            case 'spinner':
                health = 2;
                points = 200;
                break;
            case 'floater':
                health = 1;
                points = 150;
                shootInterval = 90;
                break;
            case 'bomber':
                health = 4;
                points = 500;
                shootInterval = 60;
                break;
        }

        airEnemies.push({
            x: Math.random() * (GAME_WIDTH - 40) + 20,
            y: -30,
            width: 24,
            height: 24,
            type,
            health,
            maxHealth: health,
            points,
            shootInterval,
            shootTimer: Math.floor(Math.random() * shootInterval),
            vx: (Math.random() - 0.5) * 2,
            vy: 1 + Math.random() * 0.5
        });
    }
}

function spawnGroundEnemy() {
    if (Math.random() < 0.008 + stage * 0.002) {
        const types = ['turret', 'tank', 'building'];
        const type = types[Math.floor(Math.random() * types.length)];

        let health = 2;
        let points = 200;

        switch (type) {
            case 'turret':
                health = 2;
                points = 200;
                break;
            case 'tank':
                health = 3;
                points = 300;
                break;
            case 'building':
                health = 5;
                points = 500;
                break;
        }

        groundEnemies.push({
            x: Math.random() * (GAME_WIDTH - 40) + 20,
            y: -30,
            width: 32,
            height: 32,
            type,
            health,
            points,
            vx: type === 'tank' ? (Math.random() - 0.5) * 1 : 0
        });
    }
}

function shoot() {
    playShot();

    const bulletSpeed = -8;
    const bulletSize = { width: 6, height: 12 };

    switch (player.shotLevel) {
        case 1:
            // Single shot
            playerBullets.push({
                x: player.x,
                y: player.y - 20,
                ...bulletSize,
                vy: bulletSpeed,
                vx: 0
            });
            break;
        case 2:
            // Double shot
            playerBullets.push({
                x: player.x - 8,
                y: player.y - 20,
                ...bulletSize,
                vy: bulletSpeed,
                vx: 0
            });
            playerBullets.push({
                x: player.x + 8,
                y: player.y - 20,
                ...bulletSize,
                vy: bulletSpeed,
                vx: 0
            });
            break;
        case 3:
            // Spread shot (5-way)
            for (let i = -2; i <= 2; i++) {
                playerBullets.push({
                    x: player.x,
                    y: player.y - 20,
                    ...bulletSize,
                    vy: bulletSpeed,
                    vx: i * 1.5
                });
            }
            break;
    }

    // Options also shoot
    player.options.forEach(opt => {
        playerBullets.push({
            x: opt.x,
            y: opt.y - 15,
            width: 4,
            height: 8,
            vy: bulletSpeed,
            vx: 0,
            color: '#FFA500'
        });
    });
}

function punch() {
    if (player.punchCooldown > 0) return;
    if (!player.armLeft && !player.armRight) return;

    playPunch();
    player.punchCooldown = 20;

    // Create ground attack wave
    const punchX = player.x;
    const punchY = player.y + 40;

    // Check ground enemies in range
    groundEnemies.forEach(enemy => {
        const dx = enemy.x - punchX;
        const dy = enemy.y - punchY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 50) {
            enemy.health--;
            createExplosion(enemy.x, enemy.y, 15);

            if (enemy.health <= 0) {
                score += enemy.points;
                createExplosion(enemy.x, enemy.y, 30);
                playExplosion();
            }
        }
    });

    groundEnemies = groundEnemies.filter(e => e.health > 0);
}

function getBell(bell) {
    playBellGet();

    switch (bell.colorName) {
        case 'YELLOW':
            // Points - consecutive catches increase score
            const bonus = 500 * (bell.yellowCount || 1);
            score += bonus;
            createParticles(bell.x, bell.y, '#FFD700', 10);
            break;

        case 'BLUE':
            // Speed up
            player.speedUp = Math.min(player.speedUp + 1, 3);
            player.speed = 4 + player.speedUp;
            playPowerUp();
            createParticles(bell.x, bell.y, '#4169E1', 15);
            break;

        case 'WHITE':
            // Upgrade shot
            player.shotLevel = Math.min(player.shotLevel + 1, 3);
            playPowerUp();
            createParticles(bell.x, bell.y, '#FFFFFF', 15);
            break;

        case 'GREEN':
            // Shield
            player.hasShield = true;
            playPowerUp();
            createParticles(bell.x, bell.y, '#32CD32', 15);
            break;

        case 'RED':
            // Option
            if (player.options.length < 2) {
                player.options.push({
                    x: player.x,
                    y: player.y + 30 + player.options.length * 25,
                    targetX: player.x,
                    targetY: player.y + 30 + player.options.length * 25
                });
            }
            playPowerUp();
            createParticles(bell.x, bell.y, '#FF4444', 15);
            break;
    }
}

function hitBell(bell) {
    playBellHit();
    bell.hitCount = (bell.hitCount || 0) + 1;
    bell.vy = -3; // Bounce up when hit

    // Change color every few hits
    if (bell.hitCount % 3 === 0) {
        const currentIndex = BELL_EFFECTS.indexOf(bell.colorName);
        const nextIndex = (currentIndex + 1) % BELL_EFFECTS.length;
        bell.colorName = BELL_EFFECTS[nextIndex];
        bell.color = BELL_COLORS[bell.colorName];
    }

    // Track consecutive yellow catches
    if (bell.colorName === 'YELLOW') {
        bell.yellowCount = (bell.yellowCount || 0) + 1;
    }
}

function createExplosion(x, y, size) {
    explosions.push({
        x, y, size,
        frame: 0,
        maxFrames: 15
    });
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color,
            size: 2 + Math.random() * 3,
            life: 30,
            maxLife: 30
        });
    }
}

function playerHit() {
    if (player.invincible > 0) return;

    if (player.hasShield) {
        player.hasShield = false;
        player.invincible = 60;
        playHit();
        return;
    }

    // Randomly lose an arm first
    if (player.armLeft || player.armRight) {
        if (player.armLeft && player.armRight) {
            if (Math.random() < 0.5) {
                player.armLeft = false;
            } else {
                player.armRight = false;
            }
        } else if (player.armLeft) {
            player.armLeft = false;
        } else {
            player.armRight = false;
        }
        player.invincible = 60;
        playHit();
        createParticles(player.x, player.y, '#FF6B6B', 8);
        return;
    }

    // Lose a life
    lives--;
    playHit();
    createExplosion(player.x, player.y, 40);

    if (lives <= 0) {
        endGame();
    } else {
        resetPlayer();
    }
}

function resetPlayer() {
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 80;
    player.invincible = 120;
    player.shotLevel = 1;
    player.hasShield = false;
    player.speedUp = 0;
    player.speed = 4;
    player.options = [];
    player.armLeft = true;
    player.armRight = true;
}

function checkCollisions() {
    // Player bullets vs clouds
    playerBullets.forEach(bullet => {
        clouds.forEach(cloud => {
            if (rectCollision(bullet, cloud)) {
                bullet.hit = true;
                cloud.hits++;

                if (cloud.hits >= 3 && cloud.hasBell) {
                    // Release bell
                    bells.push({
                        x: cloud.x,
                        y: cloud.y,
                        width: 20,
                        height: 24,
                        vy: 1,
                        color: BELL_COLORS.YELLOW,
                        colorName: 'YELLOW',
                        hitCount: 0,
                        yellowCount: 1
                    });
                    cloud.hasBell = false;
                }
            }
        });
    });

    // Player bullets vs bells (to change color)
    playerBullets.forEach(bullet => {
        bells.forEach(bell => {
            if (rectCollision(bullet, bell)) {
                bullet.hit = true;
                hitBell(bell);
            }
        });
    });

    // Player vs bells (collect)
    bells.forEach(bell => {
        if (rectCollision(player, bell)) {
            bell.collected = true;
            getBell(bell);
        }
    });

    // Player bullets vs air enemies
    playerBullets.forEach(bullet => {
        airEnemies.forEach(enemy => {
            if (rectCollision(bullet, enemy)) {
                bullet.hit = true;
                enemy.health--;
                createExplosion(bullet.x, bullet.y, 10);

                if (enemy.health <= 0) {
                    score += enemy.points;
                    createExplosion(enemy.x, enemy.y, 25);
                    playExplosion();
                }
            }
        });
    });

    // Player vs air enemies
    airEnemies.forEach(enemy => {
        if (enemy.health > 0 && rectCollision(player, enemy)) {
            enemy.health = 0;
            createExplosion(enemy.x, enemy.y, 25);
            playerHit();
        }
    });

    // Enemy bullets vs player
    enemyBullets.forEach(bullet => {
        if (rectCollision(bullet, player)) {
            bullet.hit = true;
            playerHit();
        }
    });

    // Clean up
    playerBullets = playerBullets.filter(b => !b.hit);
    bells = bells.filter(b => !b.collected);
    airEnemies = airEnemies.filter(e => e.health > 0);
    enemyBullets = enemyBullets.filter(b => !b.hit);
}

function rectCollision(a, b) {
    const aLeft = a.x - (a.width || 10) / 2;
    const aRight = a.x + (a.width || 10) / 2;
    const aTop = a.y - (a.height || 10) / 2;
    const aBottom = a.y + (a.height || 10) / 2;

    const bLeft = b.x - (b.width || 10) / 2;
    const bRight = b.x + (b.width || 10) / 2;
    const bTop = b.y - (b.height || 10) / 2;
    const bBottom = b.y + (b.height || 10) / 2;

    return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function update() {
    if (gamePaused || gameOver) return;

    frameCount++;
    scrollY += SCROLL_SPEED;

    // Update player position
    const speed = player.speed;
    if (keys.left) player.x -= speed;
    if (keys.right) player.x += speed;
    if (keys.up) player.y -= speed;
    if (keys.down) player.y += speed;

    // Keep player in bounds
    player.x = Math.max(20, Math.min(GAME_WIDTH - 20, player.x));
    player.y = Math.max(40, Math.min(GAME_HEIGHT - 40, player.y));

    // Update options (follow player with delay)
    player.options.forEach((opt, i) => {
        const targetY = player.y + 30 + i * 25;
        opt.targetX = player.x;
        opt.targetY = targetY;
        opt.x += (opt.targetX - opt.x) * 0.1;
        opt.y += (opt.targetY - opt.y) * 0.1;
    });

    // Auto-fire
    if (keys.shot && frameCount % 8 === 0) {
        shoot();
    }

    // Punch/bomb
    if (keys.bomb && player.punchCooldown === 0) {
        punch();
    }

    if (player.punchCooldown > 0) player.punchCooldown--;
    if (player.invincible > 0) player.invincible--;

    // Update bullets
    playerBullets.forEach(b => {
        b.x += b.vx || 0;
        b.y += b.vy;
    });
    playerBullets = playerBullets.filter(b => b.y > -20 && b.y < GAME_HEIGHT + 20 && b.x > -20 && b.x < GAME_WIDTH + 20);

    enemyBullets.forEach(b => {
        b.x += b.vx || 0;
        b.y += b.vy;
    });
    enemyBullets = enemyBullets.filter(b => b.y > -20 && b.y < GAME_HEIGHT + 20);

    // Update clouds
    clouds.forEach(c => c.y += SCROLL_SPEED * 0.5);
    clouds = clouds.filter(c => c.y < GAME_HEIGHT + 50);

    // Update bells
    bells.forEach(b => {
        b.vy += 0.05; // Gravity
        b.vy = Math.min(b.vy, 2);
        b.y += b.vy;

        // Bounce at screen edges
        if (b.y > GAME_HEIGHT - 30) {
            b.y = GAME_HEIGHT - 30;
            b.vy = -2;
        }
    });
    bells = bells.filter(b => b.y < GAME_HEIGHT + 30 && b.y > -30);

    // Update air enemies
    airEnemies.forEach(enemy => {
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;

        // Bounce off walls
        if (enemy.x < 20 || enemy.x > GAME_WIDTH - 20) {
            enemy.vx *= -1;
        }

        // Shooting
        if (enemy.shootInterval > 0) {
            enemy.shootTimer++;
            if (enemy.shootTimer >= enemy.shootInterval) {
                enemy.shootTimer = 0;
                // Aim at player
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                enemyBullets.push({
                    x: enemy.x,
                    y: enemy.y + 10,
                    vx: (dx / dist) * 3,
                    vy: (dy / dist) * 3
                });
            }
        }
    });
    airEnemies = airEnemies.filter(e => e.y < GAME_HEIGHT + 50 && e.y > -50);

    // Update ground enemies
    groundEnemies.forEach(enemy => {
        enemy.x += enemy.vx || 0;
        enemy.y += SCROLL_SPEED;

        if (enemy.x < 20 || enemy.x > GAME_WIDTH - 20) {
            enemy.vx *= -1;
        }
    });
    groundEnemies = groundEnemies.filter(e => e.y < GAME_HEIGHT + 50);

    // Update explosions
    explosions.forEach(exp => exp.frame++);
    explosions = explosions.filter(exp => exp.frame < exp.maxFrames);

    // Update particles
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);

    // Spawn new objects
    spawnCloud();
    spawnAirEnemy();
    spawnGroundEnemy();

    // Check collisions
    checkCollisions();

    // Stage progression
    if (score >= stage * 10000) {
        stage++;
    }

    // Update UI
    document.getElementById('score').textContent = score.toString().padStart(6, '0');
    document.getElementById('stage').textContent = stage;
    document.getElementById('lives').textContent = lives;
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw background
    drawBackground();

    // Draw ground enemies (behind player)
    groundEnemies.forEach(e => drawGroundEnemy(e));

    // Draw clouds
    clouds.forEach(c => drawCloud(c));

    // Draw bells
    bells.forEach(b => drawBell(b));

    // Draw player bullets
    playerBullets.forEach(b => drawBullet(b));

    // Draw enemy bullets
    enemyBullets.forEach(b => drawEnemyBullet(b));

    // Draw air enemies
    airEnemies.forEach(e => drawAirEnemy(e));

    // Draw options
    player.options.forEach(opt => drawOption(opt.x, opt.y));

    // Draw player
    if (!gameOver) {
        drawTwinBee(player.x, player.y, player.invincible);
    }

    // Draw punch effect
    if (player.punchCooldown > 15) {
        drawPunch(player.x, player.y, 20 - player.punchCooldown);
    }

    // Draw explosions
    explosions.forEach(exp => drawExplosion(exp));

    // Draw particles
    particles.forEach(p => drawParticle(p));

    // Pause overlay
    if (gamePaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#FFF';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2);
    }
}

function gameLoop() {
    if (gameStarted) {
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function startGame() {
    initAudio();
    gameStarted = true;
    gameOver = false;
    gamePaused = false;
    score = 0;
    lives = 3;
    stage = 1;
    frameCount = 0;
    scrollY = 0;

    resetPlayer();

    playerBullets = [];
    enemyBullets = [];
    bells = [];
    clouds = [];
    airEnemies = [];
    groundEnemies = [];
    explosions = [];
    particles = [];

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';

    startBGM();
}

function endGame() {
    gameOver = true;
    stopBGM();
    playGameOver();
    document.getElementById('gameOver').style.display = 'block';
}

function restartGame() {
    startGame();
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';

    if (soundEnabled && gameStarted && !gameOver) {
        startBGM();
    } else {
        stopBGM();
    }
}

// =====================================================
// INPUT HANDLING
// =====================================================

// Keyboard
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'd':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'w':
            keys.up = true;
            break;
        case 'ArrowDown':
        case 's':
            keys.down = true;
            break;
        case 'z':
        case 'Z':
        case ' ':
            keys.shot = true;
            e.preventDefault();
            break;
        case 'x':
        case 'X':
            keys.bomb = true;
            break;
        case 'Escape':
        case 'p':
        case 'P':
            if (gameStarted && !gameOver) {
                gamePaused = !gamePaused;
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowLeft':
        case 'a':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'w':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 's':
            keys.down = false;
            break;
        case 'z':
        case 'Z':
        case ' ':
            keys.shot = false;
            break;
        case 'x':
        case 'X':
            keys.bomb = false;
            break;
    }
});

// Touch controls
function setupTouchControls() {
    const dpadUp = document.getElementById('dpad-up');
    const dpadDown = document.getElementById('dpad-down');
    const dpadLeft = document.getElementById('dpad-left');
    const dpadRight = document.getElementById('dpad-right');
    const btnShot = document.getElementById('btn-shot');
    const btnBomb = document.getElementById('btn-bomb');

    const handleTouch = (element, key, isDown) => {
        if (element) {
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                keys[key] = true;
                element.classList.add('active');
            });
            element.addEventListener('touchend', (e) => {
                e.preventDefault();
                keys[key] = false;
                element.classList.remove('active');
            });
            element.addEventListener('touchcancel', (e) => {
                keys[key] = false;
                element.classList.remove('active');
            });
        }
    };

    handleTouch(dpadUp, 'up');
    handleTouch(dpadDown, 'down');
    handleTouch(dpadLeft, 'left');
    handleTouch(dpadRight, 'right');
    handleTouch(btnShot, 'shot');
    handleTouch(btnBomb, 'bomb');
}

// Initialize
setupTouchControls();
gameLoop();
