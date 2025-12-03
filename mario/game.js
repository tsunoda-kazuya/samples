// Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===============================
// SOUND SYSTEM
// ===============================
let audioContext = null;
let soundEnabled = true;
let bgmPlaying = false;
let bgmSource = null;
let bgmGainNode = null;

// Initialize Audio Context (must be called after user interaction)
function initAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Generate retro-style sound effects using Web Audio API
class SoundGenerator {
    constructor() {
        this.sounds = {};
    }

    // Jump sound - rising pitch
    playJump() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.15);
    }

    // Coin sound - two quick high notes
    playCoin() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(988, audioContext.currentTime); // B5
        osc.frequency.setValueAtTime(1319, audioContext.currentTime + 0.07); // E6

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.setValueAtTime(0.2, audioContext.currentTime + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
    }

    // Stomp sound - quick thump
    playStomp() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
    }

    // Death sound - descending notes
    playDeath() {
        if (!audioContext || !soundEnabled) return;

        const notes = [392, 330, 262, 196]; // G4, E4, C4, G3
        const duration = 0.15;

        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * duration);

            gain.gain.setValueAtTime(0, audioContext.currentTime + i * duration);
            gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + i * duration + 0.01);
            gain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + (i + 1) * duration);

            osc.start(audioContext.currentTime + i * duration);
            osc.stop(audioContext.currentTime + (i + 1) * duration);
        });
    }

    // Block hit sound
    playBlockHit() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(523, audioContext.currentTime); // C5
        osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.05); // E5

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
    }

    // Game over sound
    playGameOver() {
        if (!audioContext || !soundEnabled) return;

        const notes = [262, 247, 233, 220, 208, 196]; // Descending chromatic
        const duration = 0.2;

        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * duration);

            gain.gain.setValueAtTime(0, audioContext.currentTime + i * duration);
            gain.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + i * duration + 0.02);
            gain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + (i + 0.9) * duration);

            osc.start(audioContext.currentTime + i * duration);
            osc.stop(audioContext.currentTime + (i + 1) * duration);
        });
    }

    // Victory fanfare
    playVictory() {
        if (!audioContext || !soundEnabled) return;

        const notes = [523, 659, 784, 1047, 784, 1047]; // C5, E5, G5, C6, G5, C6
        const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.5];
        let time = audioContext.currentTime;

        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i] * 0.9);

            osc.start(time);
            osc.stop(time + durations[i]);
            time += durations[i];
        });
    }

    // Flag slide sound
    playFlagSlide() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.5);

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.5);
    }

    // Power-up sound
    playPowerUp() {
        if (!audioContext || !soundEnabled) return;

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        const duration = 0.1;

        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * duration);

            gain.gain.setValueAtTime(0.25, audioContext.currentTime + i * duration);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (i + 1) * duration);

            osc.start(audioContext.currentTime + i * duration);
            osc.stop(audioContext.currentTime + (i + 1) * duration);
        });
    }

    // Mushroom appear sound
    playMushroomAppear() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
    }

    // Shrink/damage sound
    playShrink() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(600, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.3);

        gain.gain.setValueAtTime(0.25, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
    }

    // Fireball sound
    playFireball() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
    }

    // Fire flower power-up sound
    playFirePowerUp() {
        if (!audioContext || !soundEnabled) return;

        const notes = [523, 659, 784, 880, 1047]; // C5, E5, G5, A5, C6
        const duration = 0.08;

        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * duration);

            gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * duration);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (i + 1) * duration);

            osc.start(audioContext.currentTime + i * duration);
            osc.stop(audioContext.currentTime + (i + 1) * duration);
        });
    }

    // Enemy hit by fireball
    playFireHit() {
        if (!audioContext || !soundEnabled) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.15);

        gain.gain.setValueAtTime(0.25, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.15);
    }

    // Star power sound - fast ascending arpeggio
    playStarPower() {
        if (!audioContext || !soundEnabled) return;

        const notes = [523, 659, 784, 1047, 1319, 1568, 2093]; // C5 to C7 arpeggio
        const duration = 0.05;

        notes.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * duration);

            gain.gain.setValueAtTime(0.2, audioContext.currentTime + i * duration);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (i + 1) * duration);

            osc.start(audioContext.currentTime + i * duration);
            osc.stop(audioContext.currentTime + (i + 1) * duration);
        });
    }
}

const soundGen = new SoundGenerator();

// BGM Generator - Simple chiptune-style melody
class BGMGenerator {
    constructor() {
        this.isPlaying = false;
        this.oscillators = [];
        this.gainNodes = [];
        this.nextNoteTime = 0;
        this.currentNote = 0;
        this.tempo = 140; // BPM
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25; // ms
        this.timerID = null;

        // Simple Mario-style melody (note frequencies)
        this.melody = [
            660, 660, 0, 660, 0, 523, 660, 0, 784, 0, 0, 0, 392, 0, 0, 0,
            523, 0, 0, 392, 0, 0, 330, 0, 0, 440, 0, 494, 0, 466, 440, 0,
            392, 660, 784, 880, 0, 698, 784, 0, 660, 0, 523, 587, 494, 0, 0, 0,
            523, 0, 0, 392, 0, 0, 330, 0, 0, 440, 0, 494, 0, 466, 440, 0,
            392, 660, 784, 880, 0, 698, 784, 0, 660, 0, 523, 587, 494, 0, 0, 0
        ];

        // Bass line
        this.bass = [
            131, 0, 131, 0, 131, 0, 131, 0, 165, 0, 165, 0, 165, 0, 165, 0,
            131, 0, 131, 0, 131, 0, 131, 0, 98, 0, 98, 0, 98, 0, 98, 0,
            131, 0, 131, 0, 175, 0, 175, 0, 165, 0, 165, 0, 131, 0, 131, 0,
            131, 0, 131, 0, 131, 0, 131, 0, 98, 0, 98, 0, 98, 0, 98, 0,
            131, 0, 131, 0, 175, 0, 175, 0, 165, 0, 165, 0, 131, 0, 131, 0
        ];
    }

    scheduleNote(time, freq, isBass = false) {
        if (freq === 0) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = isBass ? 'triangle' : 'square';
        osc.frequency.setValueAtTime(freq, time);

        const volume = isBass ? 0.15 : 0.1;
        const noteDuration = 60 / this.tempo / 2;

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration * 0.9);

        osc.start(time);
        osc.stop(time + noteDuration);
    }

    scheduler() {
        while (this.nextNoteTime < audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime, this.melody[this.currentNote % this.melody.length], false);
            this.scheduleNote(this.nextNoteTime, this.bass[this.currentNote % this.bass.length], true);

            const secondsPerBeat = 60 / this.tempo / 2;
            this.nextNoteTime += secondsPerBeat;
            this.currentNote++;
        }

        if (this.isPlaying) {
            this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    start() {
        if (this.isPlaying || !audioContext || !soundEnabled) return;
        this.isPlaying = true;
        this.currentNote = 0;
        this.nextNoteTime = audioContext.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }
}

let bgmGenerator = null;

// Star Power BGM - Super energetic dance music!
class StarBGMGenerator {
    constructor() {
        this.isPlaying = false;
        this.nextNoteTime = 0;
        this.currentNote = 0;
        this.tempo = 280; // Super fast disco tempo!
        this.scheduleAheadTime = 0.1;
        this.lookahead = 20;
        this.timerID = null;

        // Catchy disco-style melody - very upbeat and groovy
        this.melody = [
            // Part 1 - Ascending excitement
            784, 0, 784, 988, 1175, 0, 1175, 1319,
            1568, 0, 1568, 1319, 1175, 0, 988, 784,
            // Part 2 - Bouncy hook
            880, 880, 0, 1047, 1047, 0, 1319, 1319,
            0, 1568, 1568, 0, 1760, 0, 1568, 0,
            // Part 3 - Funky riff
            1319, 1175, 1319, 0, 1175, 1047, 1175, 0,
            1047, 988, 1047, 0, 988, 880, 988, 0,
            // Part 4 - Climax
            1760, 1568, 1760, 1976, 1760, 1568, 1319, 1175,
            1319, 1568, 1760, 1976, 2093, 0, 1760, 0
        ];

        // Pumping bass line - disco style
        this.bass = [
            // Driving 4-on-the-floor bass
            147, 0, 147, 147, 185, 0, 185, 185,
            220, 0, 220, 220, 262, 0, 262, 262,
            196, 0, 196, 196, 247, 0, 247, 247,
            262, 0, 262, 262, 330, 0, 330, 330,
            175, 0, 220, 0, 262, 0, 330, 0,
            262, 0, 220, 0, 175, 0, 147, 0,
            196, 0, 247, 0, 294, 0, 370, 0,
            330, 0, 294, 0, 262, 0, 220, 0
        ];

        // High-hat pattern for extra groove
        this.hihat = [
            1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1, 1
        ];
    }

    scheduleNote(time, freq, type = 'melody') {
        if (freq === 0) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        if (type === 'bass') {
            osc.type = 'sawtooth';
            const volume = 0.15;
            const noteDuration = 60 / this.tempo / 2;
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration * 0.7);
            osc.frequency.setValueAtTime(freq, time);
            osc.start(time);
            osc.stop(time + noteDuration);
        } else if (type === 'hihat') {
            // Create noise-like hi-hat sound
            osc.type = 'square';
            osc.frequency.setValueAtTime(8000 + Math.random() * 2000, time);
            const volume = 0.03;
            const noteDuration = 60 / this.tempo / 4;
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration * 0.3);
            osc.start(time);
            osc.stop(time + noteDuration);
        } else {
            // Melody - bright square wave
            osc.type = 'square';
            const volume = 0.12;
            const noteDuration = 60 / this.tempo / 2;
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + noteDuration * 0.6);
            osc.frequency.setValueAtTime(freq, time);
            osc.start(time);
            osc.stop(time + noteDuration);
        }
    }

    scheduler() {
        while (this.nextNoteTime < audioContext.currentTime + this.scheduleAheadTime) {
            const noteIndex = this.currentNote;

            // Play melody
            this.scheduleNote(this.nextNoteTime, this.melody[noteIndex % this.melody.length], 'melody');

            // Play bass
            this.scheduleNote(this.nextNoteTime, this.bass[noteIndex % this.bass.length], 'bass');

            // Play hi-hat for extra groove
            if (this.hihat[noteIndex % this.hihat.length]) {
                this.scheduleNote(this.nextNoteTime, 1, 'hihat');
            }

            const secondsPerBeat = 60 / this.tempo / 2;
            this.nextNoteTime += secondsPerBeat;
            this.currentNote++;
        }

        if (this.isPlaying) {
            this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    start() {
        if (this.isPlaying || !audioContext || !soundEnabled) return;
        this.isPlaying = true;
        this.currentNote = 0;
        this.nextNoteTime = audioContext.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }
}

let starBgmGenerator = null;
let isStarMusicPlaying = false;

function startBGM() {
    if (!audioContext || !soundEnabled) return;
    if (!bgmGenerator) {
        bgmGenerator = new BGMGenerator();
    }
    bgmGenerator.start();
}

function stopBGM() {
    if (bgmGenerator) {
        bgmGenerator.stop();
    }
}

function startStarBGM() {
    if (!audioContext || !soundEnabled) return;
    // Stop normal BGM first
    stopBGM();
    if (!starBgmGenerator) {
        starBgmGenerator = new StarBGMGenerator();
    }
    starBgmGenerator.start();
    isStarMusicPlaying = true;
}

function stopStarBGM() {
    if (starBgmGenerator) {
        starBgmGenerator.stop();
    }
    isStarMusicPlaying = false;
    // Resume normal BGM if game is still playing
    if (!gameState.isVictory && !gameState.isGameOver && mario && !mario.isDead) {
        startBGM();
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('soundToggle');
    btn.textContent = soundEnabled ? '🔊 ON' : '🔇 OFF';

    if (soundEnabled) {
        if (!gameState.isVictory && !gameState.isGameOver) {
            if (mario && mario.hasStarPower) {
                startStarBGM();
            } else {
                startBGM();
            }
        }
    } else {
        stopBGM();
        stopStarBGM();
    }
}

// Game Constants
const TILE_SIZE = 32;
const GRAVITY = 0.5;
const FRICTION = 0.8;
const MAX_SPEED = 5;
const JUMP_FORCE = -12;

// Goal position
let GOAL_X = 135 * TILE_SIZE; // Updated dynamically in generateLevel

// Game State
let gameState = {
    score: 0,
    coins: 0,
    time: 400,
    isGameOver: false,
    isPaused: false,
    isVictory: false,
    flagY: 0,
    victorySequence: 0,
    world: 1,
    level: 1,
    currentLevelSeed: 0  // Store seed for retry on same level
};

// Camera
let camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
};

// Input handling
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
    fire: false
};

document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
            keys.up = true;
            e.preventDefault();
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = true;
            break;
        case 'KeyR':
            // Retry same level on game over, full restart otherwise
            if (gameState.isGameOver) {
                retryLevel();
            } else {
                restartGame();
            }
            break;
        case 'KeyM':
            toggleSound();
            break;
        case 'KeyX':
        case 'KeyZ':
            keys.fire = true;
            if (mario && !mario.isDead) {
                mario.shootFireball();
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = false;
            break;
        case 'KeyX':
        case 'KeyZ':
            keys.fire = false;
            break;
    }
});

// ===============================
// SNES-STYLE DRAWING HELPERS
// ===============================

// Draw pixel with SNES-style shading
function drawPixelRect(x, y, w, h, baseColor, highlight, shadow) {
    // Main color
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, w, h);

    // Top-left highlight
    ctx.fillStyle = highlight;
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y, 2, h);

    // Bottom-right shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);
}

// Items arrays
let mushrooms = [];
let fireFlowers = [];
let fireballs = [];

// Mushroom Class
class Mushroom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.vx = 2;
        this.vy = 0;
        this.emerging = true;
        this.emergeY = y;
        this.startY = y + TILE_SIZE;
    }

    update() {
        // Emerging from block animation
        if (this.emerging) {
            this.y -= 1;
            if (this.y <= this.emergeY - TILE_SIZE) {
                this.emerging = false;
                this.y = this.emergeY - TILE_SIZE;
            }
            return true;
        }

        // Apply gravity
        this.vy += GRAVITY;
        this.vy = Math.min(this.vy, 10);

        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Platform collision
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                // Landing on top
                if (this.vy > 0 && this.y + this.height - this.vy <= platform.y) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                }
                // Side collision
                else if (this.vx > 0 && this.x + this.width - this.vx <= platform.x) {
                    this.x = platform.x - this.width;
                    this.vx = -this.vx;
                } else if (this.vx < 0 && this.x - this.vx >= platform.x + platform.width) {
                    this.x = platform.x + platform.width;
                    this.vx = -this.vx;
                }
            }
        }

        // Fell off screen
        if (this.y > canvas.height) {
            return false;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        let y = this.y;

        // If emerging, clip to block
        if (this.emerging) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 5, this.emergeY - TILE_SIZE, this.width + 10, TILE_SIZE);
            ctx.clip();
        }

        // Mushroom cap - SNES style with shading
        ctx.fillStyle = '#e02020';
        ctx.beginPath();
        ctx.ellipse(x + this.width/2, y + 8, 14, 10, 0, Math.PI, 0);
        ctx.fill();

        // Cap highlight
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.ellipse(x + this.width/2 - 2, y + 6, 10, 7, 0, Math.PI, 0);
        ctx.fill();

        // White spots on cap
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + 8, y + 4, 4, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 5, 3, 0, Math.PI * 2);
        ctx.arc(x + 14, y + 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Stem
        ctx.fillStyle = '#f0e0c0';
        ctx.fillRect(x + 6, y + 8, 16, 14);

        // Stem shading
        ctx.fillStyle = '#e0d0b0';
        ctx.fillRect(x + 6, y + 8, 4, 14);
        ctx.fillStyle = '#d0c0a0';
        ctx.fillRect(x + 18, y + 8, 4, 14);

        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 9, y + 12, 4, 5);
        ctx.fillRect(x + 17, y + 12, 4, 5);

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 10, y + 13, 2, 2);
        ctx.fillRect(x + 18, y + 13, 2, 2);

        if (this.emerging) {
            ctx.restore();
        }
    }
}

// Mario Class
// Fire Flower Class
class FireFlower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.emerging = true;
        this.emergeY = y;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    update() {
        // Emerging from block animation
        if (this.emerging) {
            this.y -= 1;
            if (this.y <= this.emergeY - TILE_SIZE) {
                this.emerging = false;
                this.y = this.emergeY - TILE_SIZE;
            }
        }

        // Animation
        this.animTimer++;
        if (this.animTimer > 8) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        let y = this.y;

        // If emerging, clip to block
        if (this.emerging) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 5, this.emergeY - TILE_SIZE, this.width + 10, TILE_SIZE);
            ctx.clip();
        }

        // Animated colors
        const colors = ['#ff4400', '#ffaa00', '#ff4400', '#ffff00'];
        const petalColor = colors[this.animFrame];

        // Stem
        ctx.fillStyle = '#00aa00';
        ctx.fillRect(x + 11, y + 14, 6, 14);

        // Leaves
        ctx.fillStyle = '#00cc00';
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 18, 6, 4, -0.5, 0, Math.PI * 2);
        ctx.ellipse(x + 20, y + 18, 6, 4, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Flower center
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(x + 14, y + 8, 6, 0, Math.PI * 2);
        ctx.fill();

        // Petals
        ctx.fillStyle = petalColor;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const px = x + 14 + Math.cos(angle) * 8;
            const py = y + 8 + Math.sin(angle) * 8;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eyes on flower
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 10, y + 6, 3, 4);
        ctx.fillRect(x + 15, y + 6, 3, 4);

        if (this.emerging) {
            ctx.restore();
        }
    }
}

// Star Class (invincibility power-up)
class Star {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 28;
        this.vx = 3;
        this.vy = 0;
        this.emerging = true;
        this.emergeY = y;
        this.animFrame = 0;
        this.animTimer = 0;
        this.bounceForce = -10;
    }

    update() {
        // Emerging from block animation
        if (this.emerging) {
            this.y -= 1;
            if (this.y <= this.emergeY - TILE_SIZE) {
                this.emerging = false;
                this.y = this.emergeY - TILE_SIZE;
                this.vy = this.bounceForce;
            }
            return true;
        }

        // Apply gravity
        this.vy += GRAVITY * 0.8;
        this.y += this.vy;
        this.x += this.vx;

        // Bounce off ground
        const groundY = canvas.height - TILE_SIZE * 2 - this.height;
        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = this.bounceForce;
        }

        // Bounce off platforms
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x) {
                // Side collision
                if (this.y + this.height > platform.y &&
                    this.y < platform.y + platform.height) {
                    if (this.vx > 0) {
                        this.x = platform.x - this.width;
                    } else {
                        this.x = platform.x + platform.width;
                    }
                    this.vx = -this.vx;
                }
            }
        }

        // Animation
        this.animTimer++;
        if (this.animTimer > 4) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        // Remove if off screen
        return this.x > camera.x - 100 && this.x < camera.x + canvas.width + 100;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        let y = this.y;

        // If emerging, clip to block
        if (this.emerging) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 5, this.emergeY - TILE_SIZE, this.width + 10, TILE_SIZE);
            ctx.clip();
        }

        // Animated rainbow colors
        const colors = ['#ffff00', '#ff8800', '#ff0000', '#ff8800'];
        const starColor = colors[this.animFrame];

        // Draw star shape
        ctx.fillStyle = starColor;
        ctx.beginPath();
        const cx = x + 14;
        const cy = y + 14;
        const outerRadius = 12;
        const innerRadius = 5;
        for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI / 5) - Math.PI / 2;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 9, y + 10, 3, 4);
        ctx.fillRect(x + 16, y + 10, 3, 4);

        // Sparkle effect
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, y + 4, 2, 2);
        ctx.fillRect(x + 20, y + 6, 2, 2);

        if (this.emerging) {
            ctx.restore();
        }
    }
}

let stars = []; // Array for star power-ups

// Fireball Class
class Fireball {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 12;
        this.height = 12;
        this.vx = direction * 8;
        this.vy = 0;
        this.bounceCount = 0;
        this.maxBounces = 4;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    update() {
        // Animation
        this.animTimer++;
        if (this.animTimer > 2) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        // Apply gravity
        this.vy += 0.4;
        this.vy = Math.min(this.vy, 8);

        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Platform collision - bounce
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                // Bounce on top
                if (this.vy > 0) {
                    this.y = platform.y - this.height;
                    this.vy = -6; // Bounce up
                    this.bounceCount++;
                }
                // Hit wall
                else if (this.vx !== 0) {
                    return false; // Destroy fireball
                }
            }
        }

        // Off screen or too many bounces
        if (this.y > canvas.height || this.bounceCount > this.maxBounces ||
            this.x < camera.x - 50 || this.x > camera.x + canvas.width + 50) {
            return false;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -20 || screenX > canvas.width + 20) return;

        const x = screenX;
        const y = this.y;

        // Rotating fireball effect
        ctx.save();
        ctx.translate(x + this.width/2, y + this.height/2);
        ctx.rotate(this.animFrame * Math.PI / 2);

        // Fireball core
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Fireball flames
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(-3, -3, 4, 0, Math.PI * 2);
        ctx.arc(3, -3, 4, 0, Math.PI * 2);
        ctx.arc(-3, 3, 4, 0, Math.PI * 2);
        ctx.arc(3, 3, 4, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Mario {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 32;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facing = 1; // 1 = right, -1 = left
        this.frame = 0;
        this.frameTimer = 0;
        this.isJumping = false;
        this.isDead = false;
        this.isSliding = false;
        this.slideY = 0;
        // Power-up state
        this.isBig = false;
        this.hasFire = false;
        this.isInvincible = false;
        this.invincibleTimer = 0;
        this.growingAnimation = 0;
        this.shrinkingAnimation = 0;
        this.fireballCooldown = 0;
        // Crouching
        this.isCrouching = false;
        // Star power (full invincibility)
        this.hasStarPower = false;
        this.starTimer = 0;
    }

    powerUp() {
        if (!this.isBig) {
            this.isBig = true;
            this.height = 56;
            this.y -= 24; // Adjust position so feet stay in place
            this.growingAnimation = 30;
            soundGen.playPowerUp();
            gameState.score += 1000;
        }
    }

    fireFlowerPowerUp() {
        if (!this.isBig) {
            // First become big
            this.isBig = true;
            this.height = 56;
            this.y -= 24;
        }
        this.hasFire = true;
        this.growingAnimation = 30;
        soundGen.playFirePowerUp();
        gameState.score += 1000;
    }

    starPowerUp() {
        this.hasStarPower = true;
        this.starTimer = 600; // 10 seconds at 60fps
        soundGen.playStarPower();
        gameState.score += 1000;
        // Start star power BGM
        startStarBGM();
    }

    shootFireball() {
        if (!this.hasFire || this.fireballCooldown > 0 || this.isDead) return;
        if (fireballs.length >= 2) return; // Max 2 fireballs at once

        const fireX = this.facing === 1 ? this.x + this.width : this.x - 12;
        const fireY = this.y + (this.isBig ? 24 : 12);

        fireballs.push(new Fireball(fireX, fireY, this.facing));
        this.fireballCooldown = 15; // Cooldown frames
        soundGen.playFireball();
    }

    takeDamage() {
        if (this.isInvincible) return;

        if (this.hasFire) {
            // Lose fire power, become big Mario
            this.hasFire = false;
            this.isInvincible = true;
            this.invincibleTimer = 120;
            this.shrinkingAnimation = 30;
            soundGen.playShrink();
        } else if (this.isBig) {
            // Shrink to small
            this.isBig = false;
            this.height = 32;
            this.isInvincible = true;
            this.invincibleTimer = 120; // 2 seconds
            this.shrinkingAnimation = 30;
            soundGen.playShrink();
        } else {
            // Die
            this.die();
        }
    }

    update() {
        // Update invincibility
        if (this.isInvincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
            }
        }

        // Update star power
        if (this.hasStarPower) {
            this.starTimer--;
            if (this.starTimer <= 0) {
                this.hasStarPower = false;
                // Stop star BGM and resume normal BGM
                stopStarBGM();
            }
        }

        // Update animations
        if (this.growingAnimation > 0) this.growingAnimation--;
        if (this.shrinkingAnimation > 0) this.shrinkingAnimation--;
        if (this.fireballCooldown > 0) this.fireballCooldown--;

        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            return;
        }

        // Victory sliding animation
        if (this.isSliding) {
            this.slideY += 3;
            this.y = Math.min(this.y + 3, canvas.height - TILE_SIZE * 2 - this.height);
            if (this.y >= canvas.height - TILE_SIZE * 2 - this.height) {
                this.isSliding = false;
                gameState.victorySequence = 2;
                // Walk to castle
                this.vx = 2;
                this.facing = 1;
            }
            return;
        }

        // Victory walk to castle
        if (gameState.victorySequence === 2) {
            this.x += this.vx;
            this.frameTimer++;
            if (this.frameTimer > 6) {
                this.frame = (this.frame + 1) % 3;
                this.frameTimer = 0;
            }
            if (this.x > GOAL_X + TILE_SIZE * 6) {
                gameState.victorySequence = 3;
                this.vx = 0;
                // Show level clear message then auto-advance
                setTimeout(() => {
                    document.getElementById('victory').style.display = 'block';
                    document.getElementById('levelClearText').textContent =
                        `WORLD ${gameState.world}-${gameState.level} CLEAR!`;
                    // Auto advance to next level after 2 seconds
                    setTimeout(() => {
                        nextLevel();
                    }, 2000);
                }, 500);
            }
            return;
        }

        if (gameState.isVictory) return;

        // Crouching (only for big Mario on ground)
        if (keys.down && this.isBig && this.onGround) {
            if (!this.isCrouching) {
                this.isCrouching = true;
                this.height = 32;
                this.y += 24; // Lower position
            }
        } else if (this.isCrouching) {
            // Stand up
            this.isCrouching = false;
            this.height = 56;
            this.y -= 24;
        }

        // Horizontal movement (slower when crouching)
        const moveSpeed = this.isCrouching ? 0.2 : 0.5;
        if (keys.left && !this.isCrouching) {
            this.vx -= moveSpeed;
            this.facing = -1;
        }
        if (keys.right && !this.isCrouching) {
            this.vx += moveSpeed;
            this.facing = 1;
        }

        // Apply friction (more friction when crouching)
        if (!keys.left && !keys.right || this.isCrouching) {
            this.vx *= this.isCrouching ? 0.8 : FRICTION;
        }

        // Clamp speed
        this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));

        // Jump (can't jump while crouching)
        if ((keys.up || keys.space) && this.onGround && !this.isJumping && !this.isCrouching) {
            this.vy = JUMP_FORCE;
            this.onGround = false;
            this.isJumping = true;
            soundGen.playJump();
        }

        if (!keys.up && !keys.space) {
            this.isJumping = false;
        }

        // Apply gravity
        this.vy += GRAVITY;
        this.vy = Math.min(this.vy, 15);

        // Move and check collisions
        this.x += this.vx;
        this.checkHorizontalCollisions();

        this.y += this.vy;
        this.checkVerticalCollisions();

        // Screen bounds
        if (this.x < camera.x) {
            this.x = camera.x;
            this.vx = 0;
        }

        // Fell off screen
        if (this.y > canvas.height) {
            this.die();
        }

        // Check goal
        if (this.x >= GOAL_X && !gameState.isVictory) {
            this.reachGoal();
        }

        // Animation
        if (Math.abs(this.vx) > 0.5 && this.onGround) {
            this.frameTimer++;
            if (this.frameTimer > 6) {
                this.frame = (this.frame + 1) % 3;
                this.frameTimer = 0;
            }
        } else if (this.onGround) {
            this.frame = 0;
        }
    }

    reachGoal() {
        gameState.isVictory = true;
        gameState.victorySequence = 1;
        this.isSliding = true;
        this.vx = 0;
        this.vy = 0;
        this.x = GOAL_X + 8;
        this.hasStarPower = false; // End star power at goal
        stopBGM();
        if (isStarMusicPlaying) {
            stopStarBGM();
        }
        soundGen.playFlagSlide();

        // Calculate score bonus based on height
        const heightBonus = Math.floor((canvas.height - this.y) * 10);
        gameState.score += heightBonus;

        setTimeout(() => {
            soundGen.playVictory();
        }, 600);
    }

    checkHorizontalCollisions() {
        for (let platform of platforms) {
            if (this.collidesWith(platform)) {
                if (this.vx > 0) {
                    this.x = platform.x - this.width;
                } else if (this.vx < 0) {
                    this.x = platform.x + platform.width;
                }
                this.vx = 0;
            }
        }
    }

    checkVerticalCollisions() {
        this.onGround = false;

        for (let platform of platforms) {
            if (this.collidesWith(platform)) {
                if (this.vy > 0) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy < 0) {
                    this.y = platform.y + platform.height;
                    this.vy = 0;

                    // Check if it's a question block
                    if (platform.type === 'question' && !platform.hit) {
                        platform.hit = true;
                        soundGen.playBlockHit();

                        // Star blocks - spawn star
                        if (platform.hasStar) {
                            stars.push(new Star(platform.x + 2, platform.y));
                            soundGen.playMushroomAppear();
                        }
                        // Fire flower blocks - spawn fire flower if big, mushroom if small
                        else if (platform.hasFireFlower) {
                            if (this.isBig) {
                                fireFlowers.push(new FireFlower(platform.x + 2, platform.y));
                            } else {
                                mushrooms.push(new Mushroom(platform.x + 2, platform.y));
                            }
                            soundGen.playMushroomAppear();
                        }
                        // Mushroom blocks spawn mushroom
                        else if (platform.hasMushroom) {
                            mushrooms.push(new Mushroom(platform.x + 2, platform.y));
                            soundGen.playMushroomAppear();
                        } else {
                            gameState.coins++;
                            gameState.score += 200;
                            createCoinEffect(platform.x + platform.width/2, platform.y);
                            soundGen.playCoin();
                        }
                    }
                    // Break brick blocks if big
                    else if (platform.type === 'brick' && this.isBig) {
                        // Remove the brick block
                        const index = platforms.indexOf(platform);
                        if (index > -1) {
                            platforms.splice(index, 1);
                            // Create debris effect
                            createBrickDebris(platform.x, platform.y);
                            soundGen.playBlockHit();
                            gameState.score += 50;
                        }
                    }
                    // Small Mario just bumps brick blocks
                    else if (platform.type === 'brick' && !this.isBig) {
                        soundGen.playBlockHit();
                        // Bump enemies on top of block
                        bumpEnemiesOnBlock(platform);
                    }
                }
            }
        }
    }

    collidesWith(obj) {
        return this.x < obj.x + obj.width &&
               this.x + this.width > obj.x &&
               this.y < obj.y + obj.height &&
               this.y + this.height > obj.y;
    }

    die() {
        if (!this.isDead) {
            this.isDead = true;
            this.vy = JUMP_FORCE;
            this.hasStarPower = false; // Lose star power on death
            soundGen.playDeath();
            stopBGM();
            if (isStarMusicPlaying) {
                stopStarBGM();
            }
            setTimeout(() => {
                gameState.isGameOver = true;
                document.getElementById('gameOver').style.display = 'block';
                soundGen.playGameOver();
            }, 1500);
        }
    }

    draw() {
        // Invincibility flashing (damage invincibility)
        if (this.isInvincible && !this.hasStarPower && Math.floor(this.invincibleTimer / 4) % 2 === 0) {
            return; // Skip drawing for flash effect
        }

        // Growing/shrinking animation
        if (this.growingAnimation > 0 || this.shrinkingAnimation > 0) {
            const flash = Math.floor((this.growingAnimation || this.shrinkingAnimation) / 3) % 2;
            if (flash === 0) {
                // Draw small version during animation
                ctx.save();
                ctx.translate(this.x - camera.x + this.width/2, this.y + (this.isBig ? 24 : 0));
                ctx.scale(this.facing, 1);
                this.drawSmallMario();
                ctx.restore();
                return;
            }
        }

        ctx.save();
        ctx.translate(this.x - camera.x + this.width/2, this.y);
        ctx.scale(this.facing, 1);

        // Star power rainbow effect
        if (this.hasStarPower) {
            const hue = (Date.now() / 10) % 360;
            ctx.filter = `hue-rotate(${hue}deg) saturate(2)`;
        }

        // Draw Mario (SNES pixel art style)
        if (this.isDead) {
            this.drawSmallMario();
        } else if (this.isBig) {
            if (this.isSliding) {
                this.drawBigMarioSliding();
            } else if (this.isCrouching) {
                this.drawBigMarioCrouching();
            } else if (!this.onGround) {
                this.drawBigMarioJumping();
            } else if (Math.abs(this.vx) > 0.5) {
                this.drawBigMarioRunning();
            } else {
                this.drawBigMarioSprite();
            }
        } else {
            if (this.isSliding) {
                this.drawMarioSliding();
            } else if (!this.onGround) {
                this.drawMarioJumping();
            } else if (Math.abs(this.vx) > 0.5) {
                this.drawMarioRunning();
            } else {
                this.drawSmallMario();
            }
        }

        ctx.filter = 'none';
        ctx.restore();
    }

    // Get color palette based on power state
    getColors() {
        if (this.hasFire) {
            return {
                hat: '#ffffff', hatDark: '#dddddd', hatLight: '#ffffff',
                shirt: '#ff4400', shirtDark: '#cc3300',
                overalls: '#ffffff', overallsDark: '#dddddd'
            };
        } else {
            return {
                hat: '#ff0000', hatDark: '#cc0000', hatLight: '#ff4444',
                shirt: '#ff0000', shirtDark: '#cc0000',
                overalls: '#0066cc', overallsDark: '#004499'
            };
        }
    }

    drawSmallMario() {
        this.drawMarioSprite();
    }

    drawMarioSprite(dead = false) {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // SNES-style Mario with better shading
        // Hat
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 6, y, 16, 6);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x + 2, y + 4, 22, 4);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 8, y + 1, 12, 2);

        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 4, y + 8, 18, 10);
        ctx.fillStyle = '#ffddaa';
        ctx.fillRect(x + 6, y + 9, 14, 6);

        // Hair/Sideburn
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 2, y + 8, 4, 6);
        ctx.fillRect(x + 4, y + 8, 6, 3);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 16, y + 10, 3, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 17, y + 10, 1, 1);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 15, 12, 3);

        // Body/Shirt
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 4, y + 18, 18, 6);
        ctx.fillStyle = colors.shirtDark;
        ctx.fillRect(x + 4, y + 22, 18, 2);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 2, y + 22, 22, 6);
        ctx.fillStyle = colors.overallsDark;
        ctx.fillRect(x + 2, y + 26, 22, 2);
        // Straps
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 6, y + 18, 3, 4);
        ctx.fillRect(x + 17, y + 18, 3, 4);
        // Buttons
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(x + 7, y + 20, 2, 2);
        ctx.fillRect(x + 17, y + 20, 2, 2);

        // Hands
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x, y + 20, 4, 4);
        ctx.fillRect(x + 22, y + 20, 4, 4);

        // Feet
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 2, y + 28, 8, 4);
        ctx.fillRect(x + 16, y + 28, 8, 4);
        ctx.fillStyle = '#3a1800';
        ctx.fillRect(x + 2, y + 30, 8, 2);
        ctx.fillRect(x + 16, y + 30, 8, 2);
    }

    drawMarioJumping() {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // Hat
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 6, y, 16, 6);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x + 2, y + 4, 22, 4);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 8, y + 1, 12, 2);

        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 4, y + 8, 18, 10);
        ctx.fillStyle = '#ffddaa';
        ctx.fillRect(x + 6, y + 9, 14, 6);

        // Hair
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 2, y + 8, 4, 6);
        ctx.fillRect(x + 4, y + 8, 6, 3);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 16, y + 10, 3, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 17, y + 10, 1, 1);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 15, 12, 3);

        // Body - arm raised
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 4, y + 18, 18, 6);

        // Raised arm
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 22, y + 14, 4, 8);
        ctx.fillRect(x, y + 16, 4, 6);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 4, y + 22, 18, 6);
        ctx.fillStyle = colors.overallsDark;
        ctx.fillRect(x + 4, y + 26, 18, 2);

        // Feet - spread for jump
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 28, 8, 4);
        ctx.fillRect(x + 18, y + 26, 8, 4);
    }

    drawMarioRunning() {
        const x = -this.width/2;
        const y = 0;
        const legOffset = this.frame * 3;
        const colors = this.getColors();

        // Hat
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 6, y, 16, 6);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x + 2, y + 4, 22, 4);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 8, y + 1, 12, 2);

        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 4, y + 8, 18, 10);

        // Hair
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 2, y + 8, 4, 6);
        ctx.fillRect(x + 4, y + 8, 6, 3);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 16, y + 10, 3, 3);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 15, 12, 3);

        // Body
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 4, y + 18, 18, 6);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 4, y + 22, 18, 6);

        // Animated feet
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 2 + legOffset, y + 28, 8, 4);
        ctx.fillRect(x + 16 - legOffset, y + 28, 8, 4);
    }

    drawMarioSliding() {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // Simplified side view for sliding
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 8, y, 12, 8);
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 8, y + 8, 12, 8);
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 4, y + 10, 4, 4);
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 6, y + 16, 14, 6);
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 6, y + 22, 14, 6);
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 6, y + 28, 14, 4);
    }

    // ========== BIG MARIO SPRITES ==========
    drawBigMarioSprite() {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // Hat
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 4, y, 20, 10);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x, y + 6, 26, 6);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 6, y + 2, 14, 3);

        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 2, y + 12, 22, 14);
        ctx.fillStyle = '#ffddaa';
        ctx.fillRect(x + 4, y + 14, 18, 8);

        // Hair/Sideburn
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 12, 6, 10);
        ctx.fillRect(x + 2, y + 12, 10, 4);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 18, y + 16, 4, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 19, y + 16, 2, 2);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 22, 14, 4);

        // Body/Shirt
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 2, y + 26, 22, 10);
        ctx.fillStyle = colors.shirtDark;
        ctx.fillRect(x + 2, y + 32, 22, 4);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x, y + 34, 26, 14);
        ctx.fillStyle = colors.overallsDark;
        ctx.fillRect(x, y + 44, 26, 4);
        // Straps
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 5, y + 26, 4, 8);
        ctx.fillRect(x + 17, y + 26, 4, 8);
        // Buttons
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(x + 6, y + 30, 3, 3);
        ctx.fillRect(x + 17, y + 30, 3, 3);

        // Hands
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x - 4, y + 30, 6, 6);
        ctx.fillRect(x + 24, y + 30, 6, 6);

        // Feet
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 48, 10, 8);
        ctx.fillRect(x + 16, y + 48, 10, 8);
        ctx.fillStyle = '#3a1800';
        ctx.fillRect(x, y + 52, 10, 4);
        ctx.fillRect(x + 16, y + 52, 10, 4);
    }

    drawBigMarioCrouching() {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // Hat (lowered)
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 4, y, 20, 8);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x, y + 4, 26, 5);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 6, y + 2, 14, 2);

        // Face (compressed)
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 2, y + 9, 22, 10);

        // Hair
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 9, 6, 6);
        ctx.fillRect(x + 2, y + 9, 10, 3);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 18, y + 12, 4, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 19, y + 12, 2, 2);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 16, 14, 3);

        // Body/Back (hunched)
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 2, y + 19, 22, 6);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x, y + 23, 26, 5);
        ctx.fillStyle = colors.overallsDark;
        ctx.fillRect(x, y + 26, 26, 2);

        // Feet (tucked under)
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 28, 12, 4);
        ctx.fillRect(x + 14, y + 28, 12, 4);
    }

    drawBigMarioJumping() {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // Hat
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 4, y, 20, 10);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x, y + 6, 26, 6);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 6, y + 2, 14, 3);

        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 2, y + 12, 22, 14);

        // Hair
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 12, 6, 10);
        ctx.fillRect(x + 2, y + 12, 10, 4);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 18, y + 16, 4, 4);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 22, 14, 4);

        // Body - arm raised
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 2, y + 26, 22, 10);

        // Raised arm
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 24, y + 20, 6, 12);
        ctx.fillRect(x - 4, y + 24, 6, 10);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 2, y + 34, 22, 14);

        // Feet - spread for jump
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x - 4, y + 48, 10, 8);
        ctx.fillRect(x + 20, y + 44, 10, 8);
    }

    drawBigMarioRunning() {
        const x = -this.width/2;
        const y = 0;
        const legOffset = this.frame * 4;
        const colors = this.getColors();

        // Hat
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 4, y, 20, 10);
        ctx.fillStyle = colors.hatDark;
        ctx.fillRect(x, y + 6, 26, 6);
        ctx.fillStyle = colors.hatLight;
        ctx.fillRect(x + 6, y + 2, 14, 3);

        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 2, y + 12, 22, 14);

        // Hair
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x, y + 12, 6, 10);
        ctx.fillRect(x + 2, y + 12, 10, 4);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 18, y + 16, 4, 4);

        // Mustache
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 10, y + 22, 14, 4);

        // Body
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 2, y + 26, 22, 10);

        // Overalls
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 2, y + 34, 22, 14);

        // Animated feet
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + legOffset, y + 48, 10, 8);
        ctx.fillRect(x + 16 - legOffset, y + 48, 10, 8);
    }

    drawBigMarioSliding() {
        const x = -this.width/2;
        const y = 0;
        const colors = this.getColors();

        // Simplified side view for sliding (big)
        ctx.fillStyle = colors.hat;
        ctx.fillRect(x + 6, y, 16, 14);
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(x + 6, y + 14, 16, 12);
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 2, y + 18, 6, 6);
        ctx.fillStyle = colors.shirt;
        ctx.fillRect(x + 4, y + 26, 18, 10);
        ctx.fillStyle = colors.overalls;
        ctx.fillRect(x + 4, y + 36, 18, 12);
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(x + 4, y + 48, 18, 8);
    }
}

// Enemy Class (Goomba) - SNES Style
class Goomba {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.vx = -1;
        this.vy = 0;
        this.isDead = false;
        this.deathTimer = 0;
        this.frame = 0;
        this.frameTimer = 0;
    }

    update() {
        if (this.isDead) {
            this.deathTimer++;
            return this.deathTimer < 30;
        }

        // Apply gravity
        this.vy += GRAVITY;
        this.y += this.vy;

        // Ground collision
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                if (this.vy > 0) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                }
            }
        }

        // Move
        this.x += this.vx;

        // Check for wall/edge collision
        for (let platform of platforms) {
            // Wall collision
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {
                if (this.vx < 0 && this.x + this.width/2 > platform.x + platform.width/2) {
                    this.vx = 1;
                } else if (this.vx > 0 && this.x + this.width/2 < platform.x + platform.width/2) {
                    this.vx = -1;
                }
            }
        }

        // Animation
        this.frameTimer++;
        if (this.frameTimer > 15) {
            this.frame = (this.frame + 1) % 2;
            this.frameTimer = 0;
        }

        // Fell off screen
        if (this.y > canvas.height) {
            return false;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;

        if (screenX < -50 || screenX > canvas.width + 50) return;

        if (this.isDead) {
            // Squashed goomba - SNES style
            ctx.fillStyle = '#a05020';
            ctx.fillRect(screenX + 4, this.y + 26, 24, 6);
            ctx.fillStyle = '#804010';
            ctx.fillRect(screenX + 4, this.y + 30, 24, 2);
            return;
        }

        const x = screenX;
        const y = this.y;
        const legOffset = this.frame * 2;

        // Body - SNES style with shading
        ctx.fillStyle = '#c06830';
        ctx.fillRect(x + 4, y + 2, 24, 18);
        ctx.fillStyle = '#a05020';
        ctx.fillRect(x + 8, y, 16, 4);
        ctx.fillStyle = '#d88050';
        ctx.fillRect(x + 6, y + 4, 20, 4);

        // Eyes - white with pupils
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, y + 8, 8, 8);
        ctx.fillRect(x + 18, y + 8, 8, 8);

        // Pupils
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 10, y + 10, 4, 5);
        ctx.fillRect(x + 18, y + 10, 4, 5);

        // Eyebrows - angry
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 5, y + 6, 9, 2);
        ctx.fillRect(x + 18, y + 6, 9, 2);

        // Feet - SNES style
        ctx.fillStyle = '#402000';
        ctx.fillRect(x + 2 - legOffset, y + 22, 12, 10);
        ctx.fillRect(x + 18 + legOffset, y + 22, 12, 10);
        ctx.fillStyle = '#301800';
        ctx.fillRect(x + 2 - legOffset, y + 28, 12, 4);
        ctx.fillRect(x + 18 + legOffset, y + 28, 12, 4);
    }

    stomp() {
        this.isDead = true;
        gameState.score += 100;
        soundGen.playStomp();
    }
}

// Koopa (Turtle) Enemy Class - SNES Style
class Koopa {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 40;
        this.vx = -1;
        this.vy = 0;
        this.isDead = false;
        this.isShell = false;
        this.isMovingShell = false;
        this.shellTimer = 0;
        this.frame = 0;
        this.frameTimer = 0;
        this.kickedBy = null; // To prevent instant re-collision
        this.kickCooldown = 0;
    }

    update() {
        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            return this.y < canvas.height + 100;
        }

        // Kick cooldown
        if (this.kickCooldown > 0) this.kickCooldown--;

        // Shell revival timer
        if (this.isShell && !this.isMovingShell) {
            this.shellTimer++;
            if (this.shellTimer > 300) { // 5 seconds to revive
                this.isShell = false;
                this.shellTimer = 0;
                this.height = 40;
                this.y -= 8;
            }
        }

        // Apply gravity
        this.vy += GRAVITY;
        this.y += this.vy;

        // Ground collision
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                if (this.vy > 0) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                }
            }
        }

        // Move
        if (!this.isShell || this.isMovingShell) {
            this.x += this.vx;
        }

        // Wall collision
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {

                if (this.vx > 0) {
                    this.x = platform.x - this.width;
                    this.vx = -this.vx;
                } else if (this.vx < 0) {
                    this.x = platform.x + platform.width;
                    this.vx = -this.vx;
                }

                // Moving shell breaks brick blocks
                if (this.isMovingShell && platform.type === 'brick') {
                    const index = platforms.indexOf(platform);
                    if (index > -1) {
                        platforms.splice(index, 1);
                        createBrickDebris(platform.x, platform.y);
                        soundGen.playBlockHit();
                        gameState.score += 50;
                    }
                }
            }
        }

        // Animation (only when walking)
        if (!this.isShell) {
            this.frameTimer++;
            if (this.frameTimer > 12) {
                this.frame = (this.frame + 1) % 2;
                this.frameTimer = 0;
            }
        }

        // Fell off screen
        if (this.y > canvas.height) {
            return false;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        const y = this.y;

        if (this.isShell) {
            // Draw shell
            const wobble = (!this.isMovingShell && this.shellTimer > 200) ?
                Math.sin(this.shellTimer * 0.5) * 2 : 0;

            // Shell body
            ctx.fillStyle = '#20a020';
            ctx.beginPath();
            ctx.ellipse(x + this.width/2 + wobble, y + 16, 14, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shell pattern
            ctx.fillStyle = '#108010';
            ctx.beginPath();
            ctx.ellipse(x + this.width/2 + wobble, y + 16, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shell highlight
            ctx.fillStyle = '#40c040';
            ctx.beginPath();
            ctx.ellipse(x + this.width/2 - 4 + wobble, y + 12, 5, 4, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Shell rim
            ctx.fillStyle = '#f0e0a0';
            ctx.fillRect(x + 2 + wobble, y + 24, 24, 6);
            ctx.fillStyle = '#d0c080';
            ctx.fillRect(x + 2 + wobble, y + 28, 24, 2);
        } else {
            // Draw walking Koopa
            const legOffset = this.frame * 3;
            const facing = this.vx > 0 ? 1 : -1;

            ctx.save();
            ctx.translate(x + this.width/2, y);
            ctx.scale(facing, 1);
            ctx.translate(-this.width/2, 0);

            // Shell (on back)
            ctx.fillStyle = '#20a020';
            ctx.beginPath();
            ctx.ellipse(14, 22, 12, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shell pattern
            ctx.fillStyle = '#108010';
            ctx.beginPath();
            ctx.ellipse(14, 22, 8, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shell highlight
            ctx.fillStyle = '#40c040';
            ctx.beginPath();
            ctx.ellipse(10, 18, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = '#f0d860';
            ctx.beginPath();
            ctx.ellipse(22, 10, 8, 9, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eye white
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(26, 8, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eye pupil
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(27, 9, 2, 0, Math.PI * 2);
            ctx.fill();

            // Beak/mouth
            ctx.fillStyle = '#f0a030';
            ctx.beginPath();
            ctx.ellipse(30, 12, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Feet
            ctx.fillStyle = '#f0a030';
            ctx.fillRect(6 + legOffset, 34, 8, 6);
            ctx.fillRect(14 - legOffset, 34, 8, 6);

            ctx.restore();
        }
    }

    stomp() {
        if (this.isShell) {
            // Kick the shell
            this.kick(mario.x < this.x ? 1 : -1);
        } else {
            // Become a shell
            this.isShell = true;
            this.isMovingShell = false;
            this.height = 30;
            this.vx = 0;
            this.shellTimer = 0;
            gameState.score += 100;
            soundGen.playStomp();
        }
    }

    kick(direction) {
        this.isMovingShell = true;
        this.vx = direction * 8;
        this.kickCooldown = 10;
        gameState.score += 400;
        soundGen.playStomp();
    }

    // Called when bumped from below
    bump() {
        if (this.isShell) {
            this.vy = -5;
        } else {
            this.isDead = true;
            this.vy = -8;
            gameState.score += 100;
        }
    }

    // Check if shell hits other enemies
    checkShellCollisions() {
        if (!this.isMovingShell) return;

        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (enemy === this || enemy.isDead) continue;
            if (enemy.isShell && !enemy.isMovingShell) continue; // Don't hit stationary shells

            if (this.x < enemy.x + enemy.width &&
                this.x + this.width > enemy.x &&
                this.y < enemy.y + enemy.height &&
                this.y + this.height > enemy.y) {

                // Kill the enemy
                enemy.isDead = true;
                enemy.vy = -5;
                gameState.score += 200;
                soundGen.playFireHit();
            }
        }
    }
}

// ===============================
// BULLET BILL (Cannon and Projectile)
// ===============================

class BillBlaster {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE * 2;
        this.fireTimer = 0;
        this.fireInterval = 180; // Fire every 3 seconds
    }

    update() {
        this.fireTimer++;

        // Fire when Mario is in range and timer is ready
        if (this.fireTimer >= this.fireInterval) {
            const distToMario = Math.abs(mario.x - this.x);
            if (distToMario > 100 && distToMario < 500) {
                this.fire();
                this.fireTimer = 0;
            }
        }

        return true;
    }

    fire() {
        const direction = mario.x < this.x ? -1 : 1;
        enemies.push(new BulletBill(this.x, this.y + 8, direction));
        soundGen.playFireball(); // Reuse fireball sound
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        const y = this.y;

        // Cannon base (black)
        ctx.fillStyle = '#202020';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE * 2);

        // Cannon highlights
        ctx.fillStyle = '#404040';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 8);
        ctx.fillRect(x + 2, y + TILE_SIZE + 2, TILE_SIZE - 4, 8);

        // Cannon opening
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 4, y + 12, TILE_SIZE - 8, 12);

        // Skull decoration
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE + 16, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 10, y + TILE_SIZE + 12, 4, 4);
        ctx.fillRect(x + 18, y + TILE_SIZE + 12, 4, 4);
        ctx.fillRect(x + 12, y + TILE_SIZE + 20, 8, 3);
    }

    // Cannon can't be killed
    stomp() {
        // Do nothing - Mario bounces off
        mario.vy = -8;
    }
}

class BulletBill {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 24;
        this.vx = direction * 4;
        this.direction = direction;
        this.isDead = false;
        this.vy = 0;
    }

    update() {
        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            return this.y < canvas.height + 100;
        }

        this.x += this.vx;

        // Remove if off screen
        if (this.x < camera.x - 100 || this.x > camera.x + canvas.width + 100) {
            return false;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        const y = this.y;

        ctx.save();
        ctx.translate(x + this.width/2, y + this.height/2);
        ctx.scale(this.direction, 1);
        ctx.translate(-this.width/2, -this.height/2);

        // Body
        ctx.fillStyle = '#202020';
        ctx.beginPath();
        ctx.ellipse(14, 12, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#202020';
        ctx.beginPath();
        ctx.moveTo(24, 6);
        ctx.lineTo(32, 12);
        ctx.lineTo(24, 18);
        ctx.closePath();
        ctx.fill();

        // Eye (white)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(18, 10, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(20, 10, 3, 0, Math.PI * 2);
        ctx.fill();

        // Arms/fins
        ctx.fillStyle = '#fff';
        ctx.fillRect(4, 2, 8, 4);
        ctx.fillRect(4, 18, 8, 4);

        ctx.restore();
    }

    stomp() {
        this.isDead = true;
        this.vy = -5;
        gameState.score += 200;
        soundGen.playStomp();
    }
}

// ===============================
// PARA-KOOPA (Flying Turtle)
// ===============================

class ParaKoopa {
    constructor(x, y, pattern = 'vertical') {
        this.x = x;
        this.y = y;
        this.startY = y;
        this.width = 28;
        this.height = 40;
        this.vx = -1;
        this.vy = 0;
        this.isDead = false;
        this.isShell = false;
        this.isMovingShell = false;
        this.shellTimer = 0;
        this.frame = 0;
        this.frameTimer = 0;
        this.wingFrame = 0;
        this.wingTimer = 0;
        this.kickCooldown = 0;
        this.pattern = pattern; // 'vertical' or 'horizontal'
        this.moveTimer = 0;
    }

    update() {
        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            return this.y < canvas.height + 100;
        }

        if (this.kickCooldown > 0) this.kickCooldown--;

        // If turned into shell, behave like regular Koopa
        if (this.isShell) {
            if (!this.isMovingShell) {
                this.shellTimer++;
                if (this.shellTimer > 300) {
                    this.isShell = false;
                    this.shellTimer = 0;
                    this.height = 40;
                    this.y -= 8;
                }
            }

            // Apply gravity when shell
            this.vy += GRAVITY;
            this.y += this.vy;

            // Ground collision
            for (let platform of platforms) {
                if (this.x < platform.x + platform.width &&
                    this.x + this.width > platform.x &&
                    this.y + this.height > platform.y &&
                    this.y < platform.y + platform.height) {
                    if (this.vy > 0) {
                        this.y = platform.y - this.height;
                        this.vy = 0;
                    }
                }
            }

            if (this.isMovingShell) {
                this.x += this.vx;
                // Wall collision
                for (let platform of platforms) {
                    if (this.x < platform.x + platform.width &&
                        this.x + this.width > platform.x &&
                        this.y < platform.y + platform.height &&
                        this.y + this.height > platform.y) {
                        this.vx = -this.vx;
                    }
                }
            }
        } else {
            // Flying pattern
            this.moveTimer++;

            if (this.pattern === 'vertical') {
                // Bounce up and down
                this.y = this.startY + Math.sin(this.moveTimer * 0.05) * 60;
                this.x += this.vx;

                // Reverse at screen edges
                if (this.x < camera.x - 50) this.vx = 1;
                if (this.x > camera.x + canvas.width) this.vx = -1;
            } else {
                // Horizontal swooping
                this.x += this.vx * 2;
                this.y = this.startY + Math.sin(this.moveTimer * 0.08) * 30;

                // Reverse direction
                if (this.moveTimer % 180 === 0) this.vx = -this.vx;
            }

            // Wing animation
            this.wingTimer++;
            if (this.wingTimer > 4) {
                this.wingFrame = (this.wingFrame + 1) % 2;
                this.wingTimer = 0;
            }
        }

        // Animation
        this.frameTimer++;
        if (this.frameTimer > 12) {
            this.frame = (this.frame + 1) % 2;
            this.frameTimer = 0;
        }

        if (this.y > canvas.height) return false;
        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        const y = this.y;

        if (this.isShell) {
            // Same shell drawing as regular Koopa
            const wobble = (!this.isMovingShell && this.shellTimer > 200) ?
                Math.sin(this.shellTimer * 0.5) * 2 : 0;

            ctx.fillStyle = '#d02020'; // Red shell for para-koopa
            ctx.beginPath();
            ctx.ellipse(x + this.width/2 + wobble, y + 16, 14, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a01010';
            ctx.beginPath();
            ctx.ellipse(x + this.width/2 + wobble, y + 16, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff4040';
            ctx.beginPath();
            ctx.ellipse(x + this.width/2 - 4 + wobble, y + 12, 5, 4, -0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f0e0a0';
            ctx.fillRect(x + 2 + wobble, y + 24, 24, 6);
        } else {
            // Draw flying Koopa with wings
            const legOffset = this.frame * 3;
            const facing = this.vx > 0 ? 1 : -1;

            ctx.save();
            ctx.translate(x + this.width/2, y);
            ctx.scale(facing, 1);
            ctx.translate(-this.width/2, 0);

            // Wings
            const wingY = this.wingFrame === 0 ? -4 : 4;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(-6, 18 + wingY, 12, 6, -0.5, 0, Math.PI * 2);
            ctx.ellipse(34, 18 + wingY, 12, 6, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ddd';
            ctx.beginPath();
            ctx.ellipse(-4, 20 + wingY, 8, 4, -0.5, 0, Math.PI * 2);
            ctx.ellipse(32, 20 + wingY, 8, 4, 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Red shell (on back)
            ctx.fillStyle = '#d02020';
            ctx.beginPath();
            ctx.ellipse(14, 22, 12, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a01010';
            ctx.beginPath();
            ctx.ellipse(14, 22, 8, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff4040';
            ctx.beginPath();
            ctx.ellipse(10, 18, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = '#f0d860';
            ctx.beginPath();
            ctx.ellipse(22, 10, 8, 9, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(26, 8, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(27, 9, 2, 0, Math.PI * 2);
            ctx.fill();

            // Beak
            ctx.fillStyle = '#f0a030';
            ctx.beginPath();
            ctx.ellipse(30, 12, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Feet
            ctx.fillStyle = '#f0a030';
            ctx.fillRect(6 + legOffset, 34, 8, 6);
            ctx.fillRect(14 - legOffset, 34, 8, 6);

            ctx.restore();
        }
    }

    stomp() {
        if (this.isShell) {
            this.kick(mario.x < this.x ? 1 : -1);
        } else {
            // Lose wings, become regular shell
            this.isShell = true;
            this.isMovingShell = false;
            this.height = 30;
            this.vx = 0;
            this.vy = 0;
            this.shellTimer = 0;
            gameState.score += 200;
            soundGen.playStomp();
        }
    }

    kick(direction) {
        this.isMovingShell = true;
        this.vx = direction * 8;
        this.kickCooldown = 10;
        gameState.score += 400;
        soundGen.playStomp();
    }

    bump() {
        this.isDead = true;
        this.vy = -8;
        gameState.score += 200;
    }

    checkShellCollisions() {
        if (!this.isMovingShell) return;

        for (let enemy of enemies) {
            if (enemy === this || enemy.isDead) continue;
            if (enemy.isShell && !enemy.isMovingShell) continue;

            if (this.x < enemy.x + enemy.width &&
                this.x + this.width > enemy.x &&
                this.y < enemy.y + enemy.height &&
                this.y + this.height > enemy.y) {
                enemy.isDead = true;
                enemy.vy = -5;
                gameState.score += 200;
                soundGen.playFireHit();
            }
        }
    }
}

// ===============================
// CHEEP CHEEP (Jumping Fish)
// ===============================

class CheepCheep {
    constructor(x, y) {
        this.x = x;
        this.startX = x;
        this.y = y;
        this.width = 28;
        this.height = 24;
        this.vx = 0;
        this.vy = 0;
        this.isDead = false;
        this.isJumping = false;
        this.jumpTimer = randomInt(60, 120);
        this.direction = seededRandom() < 0.5 ? -1 : 1;
        this.tailFrame = 0;
        this.tailTimer = 0;
    }

    update() {
        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            return this.y < canvas.height + 100;
        }

        this.jumpTimer--;

        if (!this.isJumping && this.jumpTimer <= 0) {
            // Start jump
            this.isJumping = true;
            this.vy = randomInt(-14, -10);
            this.vx = this.direction * randomInt(2, 4);
            this.y = canvas.height - 20; // Start from bottom
        }

        if (this.isJumping) {
            this.vy += GRAVITY * 0.6; // Slower fall
            this.x += this.vx;
            this.y += this.vy;

            // Back in water
            if (this.y > canvas.height) {
                this.isJumping = false;
                this.jumpTimer = randomInt(90, 180);
                this.x = this.startX + randomInt(-50, 50);
                this.direction = seededRandom() < 0.5 ? -1 : 1;
            }
        }

        // Tail animation
        this.tailTimer++;
        if (this.tailTimer > 6) {
            this.tailFrame = (this.tailFrame + 1) % 2;
            this.tailTimer = 0;
        }

        return true;
    }

    draw() {
        if (!this.isJumping) return; // Only draw when jumping

        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        const y = this.y;

        ctx.save();
        ctx.translate(x + this.width/2, y + this.height/2);
        ctx.scale(this.direction, 1);
        // Rotate based on velocity
        ctx.rotate(Math.atan2(this.vy, Math.abs(this.vx)) * 0.5);
        ctx.translate(-this.width/2, -this.height/2);

        // Body
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.ellipse(14, 12, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lighter belly
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.ellipse(14, 16, 8, 5, 0, 0, Math.PI);
        ctx.fill();

        // Tail
        const tailOffset = this.tailFrame * 3;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.moveTo(2, 8);
        ctx.lineTo(-6 - tailOffset, 4);
        ctx.lineTo(-6 - tailOffset, 20);
        ctx.lineTo(2, 16);
        ctx.closePath();
        ctx.fill();

        // Top fin
        ctx.fillStyle = '#ff6060';
        ctx.beginPath();
        ctx.moveTo(10, 4);
        ctx.lineTo(14, -4);
        ctx.lineTo(18, 4);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(20, 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(22, 10, 2, 0, Math.PI * 2);
        ctx.fill();

        // Lips
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.ellipse(26, 14, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    stomp() {
        this.isDead = true;
        this.vy = -5;
        gameState.score += 200;
        soundGen.playStomp();
    }
}

// ===============================
// HAMMER BRO
// ===============================

class HammerBro {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 28;
        this.height = 44;
        this.vx = 1;
        this.vy = 0;
        this.isDead = false;
        this.onGround = false;
        this.frame = 0;
        this.frameTimer = 0;
        this.jumpTimer = 0;
        this.throwTimer = 0;
        this.throwArm = 0;
        this.startX = x;
    }

    update() {
        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            return this.y < canvas.height + 100;
        }

        // Throw hammers
        this.throwTimer++;
        if (this.throwTimer >= 90) { // Every 1.5 seconds
            this.throwHammer();
            this.throwTimer = 0;
            this.throwArm = 15;
        }
        if (this.throwArm > 0) this.throwArm--;

        // Jump occasionally
        this.jumpTimer++;
        if (this.jumpTimer >= 120 && this.onGround) {
            this.vy = -10;
            this.onGround = false;
            this.jumpTimer = 0;
        }

        // Gravity
        this.vy += GRAVITY;
        this.y += this.vy;

        // Horizontal movement (pace back and forth)
        this.x += this.vx;
        if (Math.abs(this.x - this.startX) > 40) {
            this.vx = -this.vx;
        }

        // Ground collision
        this.onGround = false;
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y + this.height > platform.y &&
                this.y + this.height < platform.y + platform.height + this.vy) {
                if (this.vy > 0) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }

        // Animation
        this.frameTimer++;
        if (this.frameTimer > 10) {
            this.frame = (this.frame + 1) % 2;
            this.frameTimer = 0;
        }

        if (this.y > canvas.height) return false;
        return true;
    }

    throwHammer() {
        const direction = mario.x < this.x ? -1 : 1;
        enemies.push(new Hammer(this.x + this.width/2, this.y, direction));
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        const x = screenX;
        const y = this.y;
        const facing = mario.x < this.x ? -1 : 1;

        ctx.save();
        ctx.translate(x + this.width/2, y);
        ctx.scale(facing, 1);
        ctx.translate(-this.width/2, 0);

        // Shell/body
        ctx.fillStyle = '#20a020';
        ctx.beginPath();
        ctx.ellipse(14, 26, 12, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#108010';
        ctx.beginPath();
        ctx.ellipse(14, 26, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#f0d860';
        ctx.beginPath();
        ctx.ellipse(14, 8, 10, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#20a020';
        ctx.beginPath();
        ctx.arc(14, 4, 10, Math.PI, 0);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(18, 8, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(20, 9, 2, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows
        ctx.fillStyle = '#000';
        ctx.fillRect(14, 4, 10, 2);

        // Arm with hammer
        const armY = this.throwArm > 0 ? -8 : 0;
        ctx.fillStyle = '#f0d860';
        ctx.fillRect(22, 16 + armY, 8, 6);

        // Hammer in hand
        if (this.throwArm > 5) {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(26, 8 + armY, 4, 14);
            ctx.fillStyle = '#404040';
            ctx.fillRect(24, 4 + armY, 8, 8);
        }

        // Feet
        ctx.fillStyle = '#f0a030';
        const legOffset = this.frame * 3;
        ctx.fillRect(6 + legOffset, 38, 8, 6);
        ctx.fillRect(14 - legOffset, 38, 8, 6);

        ctx.restore();
    }

    stomp() {
        this.isDead = true;
        this.vy = -8;
        gameState.score += 500;
        soundGen.playStomp();
    }
}

class Hammer {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.vx = direction * 4;
        this.vy = -8;
        this.rotation = 0;
        this.isDead = false;
    }

    update() {
        this.vy += GRAVITY * 0.7;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += 0.3;

        // Remove if off screen
        if (this.y > canvas.height || this.x < camera.x - 50 || this.x > camera.x + canvas.width + 50) {
            return false;
        }

        return true;
    }

    draw() {
        const screenX = this.x - camera.x;
        if (screenX < -50 || screenX > canvas.width + 50) return;

        ctx.save();
        ctx.translate(screenX + this.width/2, this.y + this.height/2);
        ctx.rotate(this.rotation);

        // Handle
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-2, -10, 4, 16);

        // Head
        ctx.fillStyle = '#404040';
        ctx.fillRect(-6, -14, 12, 8);

        // Highlight
        ctx.fillStyle = '#606060';
        ctx.fillRect(-4, -12, 8, 2);

        ctx.restore();
    }

    stomp() {
        // Hammers can't be stomped - they hurt Mario
    }
}

// Coin effect
let coinEffects = [];

function createCoinEffect(x, y) {
    coinEffects.push({
        x: x,
        y: y,
        vy: -8,
        life: 30,
        rotation: 0
    });
}

// Brick debris effect
let brickDebris = [];

function createBrickDebris(x, y) {
    // Create 4 debris pieces
    const positions = [
        {vx: -3, vy: -8},
        {vx: 3, vy: -8},
        {vx: -2, vy: -6},
        {vx: 2, vy: -6}
    ];
    for (let pos of positions) {
        brickDebris.push({
            x: x + TILE_SIZE/2,
            y: y + TILE_SIZE/2,
            vx: pos.vx,
            vy: pos.vy,
            rotation: 0,
            life: 60
        });
    }
}

function updateBrickDebris() {
    for (let i = brickDebris.length - 1; i >= 0; i--) {
        let debris = brickDebris[i];
        debris.x += debris.vx;
        debris.y += debris.vy;
        debris.vy += 0.4;
        debris.rotation += 0.2;
        debris.life--;

        if (debris.life <= 0 || debris.y > canvas.height) {
            brickDebris.splice(i, 1);
        }
    }
}

function drawBrickDebris() {
    for (let debris of brickDebris) {
        const screenX = debris.x - camera.x;

        ctx.save();
        ctx.translate(screenX, debris.y);
        ctx.rotate(debris.rotation);

        // Draw small brick piece
        ctx.fillStyle = '#c06820';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#905010';
        ctx.fillRect(-6, -6, 12, 2);
        ctx.fillRect(-6, -6, 2, 12);
        ctx.fillStyle = '#d88840';
        ctx.fillRect(-4, -4, 4, 4);

        ctx.restore();
    }
}

// Bump enemies standing on a block
function bumpEnemiesOnBlock(platform) {
    for (let enemy of enemies) {
        if (enemy.isDead) continue;

        // Check if enemy is standing on this block
        if (enemy.x + enemy.width > platform.x &&
            enemy.x < platform.x + platform.width &&
            enemy.y + enemy.height >= platform.y - 5 &&
            enemy.y + enemy.height <= platform.y + 5) {
            // Bump the enemy
            if (enemy.bump) {
                enemy.bump();
            } else {
                // For Goombas, just kill them
                enemy.isDead = true;
                enemy.vy = -5;
                gameState.score += 100;
            }
        }
    }
}

function updateCoinEffects() {
    for (let i = coinEffects.length - 1; i >= 0; i--) {
        let coin = coinEffects[i];
        coin.y += coin.vy;
        coin.vy += 0.3;
        coin.life--;
        coin.rotation += 0.3;

        if (coin.life <= 0) {
            coinEffects.splice(i, 1);
        }
    }
}

function drawCoinEffects() {
    for (let coin of coinEffects) {
        const screenX = coin.x - camera.x;
        const scale = Math.abs(Math.cos(coin.rotation));

        // SNES style coin
        ctx.fillStyle = '#ffdd00';
        ctx.fillRect(screenX - 6 * scale, coin.y - 8, 12 * scale, 16);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(screenX - 3 * scale, coin.y - 6, 6 * scale, 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(screenX - 2 * scale, coin.y - 4, 2 * scale, 8);
    }
}

// Platform/Block definitions
let platforms = [];
let enemies = [];
let mario;

// ===============================
// PROCEDURAL LEVEL GENERATION
// ===============================

// Random number helper with seed support
let levelSeed = Date.now();

function seededRandom() {
    levelSeed = (levelSeed * 1103515245 + 12345) & 0x7fffffff;
    return levelSeed / 0x7fffffff;
}

function randomInt(min, max) {
    return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function randomChoice(array) {
    return array[Math.floor(seededRandom() * array.length)];
}

// Level generation with guaranteed completability
function generateLevel(useSameSeed = false) {
    // Use same seed for retry, or generate new seed for new level
    if (!useSameSeed) {
        levelSeed = Date.now() + gameState.level * 1000; // Different seed per level
        gameState.currentLevelSeed = levelSeed;
    } else {
        levelSeed = gameState.currentLevelSeed; // Retry with same seed
    }

    platforms = [];
    enemies = [];
    gameState.flagY = canvas.height - TILE_SIZE * 2 - TILE_SIZE * 10;

    const levelWidth = 150; // in tiles
    const groundY = canvas.height - TILE_SIZE * 2;

    // Track level structure for completability validation
    let groundMap = new Array(levelWidth).fill(true); // true = ground exists
    let obstacleMap = new Array(levelWidth).fill(0);  // height of obstacle
    let gapZones = [];      // areas with gaps (don't place enemies)
    let pipePositions = []; // pipe x positions

    // ================================
    // STEP 1: Generate ground with gaps
    // ================================

    // Rules for gaps:
    // - Maximum gap width: 3 tiles (jumpable)
    // - Minimum ground between gaps: 8 tiles (safe landing + run-up)
    // - No gaps in first 10 tiles or last 15 tiles

    let lastGapEnd = 0;
    let x = 10; // Start considering gaps after safe zone

    while (x < levelWidth - 20) {
        // Random chance for a gap
        if (seededRandom() < 0.15 && x - lastGapEnd >= 10) {
            const gapWidth = randomInt(2, 3); // 2-3 tiles max

            // Mark gap in ground map
            for (let g = 0; g < gapWidth; g++) {
                if (x + g < levelWidth) {
                    groundMap[x + g] = false;
                }
            }

            // Record gap zone (don't place enemies here)
            gapZones.push({start: x - 2, end: x + gapWidth + 2});

            lastGapEnd = x + gapWidth;
            x += gapWidth + randomInt(10, 15); // Ensure safe distance after gap
        } else {
            x++;
        }
    }

    // Create ground platforms
    for (let x = 0; x < levelWidth; x++) {
        if (groundMap[x]) {
            platforms.push({
                x: x * TILE_SIZE,
                y: groundY,
                width: TILE_SIZE,
                height: TILE_SIZE * 2,
                type: 'ground'
            });
        }
    }

    // ================================
    // STEP 2: Add pipes (obstacles)
    // ================================

    // Rules for pipes:
    // - Height: 2-4 tiles (all jumpable)
    // - Not near gaps (need 5+ tiles of ground before and after)
    // - Minimum 8 tiles between pipes

    let lastPipeX = 0;
    x = 15;

    while (x < levelWidth - 25) {
        if (seededRandom() < 0.12 && x - lastPipeX >= 10) {
            // Check if safe to place pipe (no nearby gaps)
            let safeToPlace = true;
            for (let check = x - 3; check <= x + 4; check++) {
                if (check >= 0 && check < levelWidth && !groundMap[check]) {
                    safeToPlace = false;
                    break;
                }
            }

            if (safeToPlace) {
                const pipeHeight = randomInt(2, 4);

                // Record obstacle height
                obstacleMap[x] = pipeHeight;
                obstacleMap[x + 1] = pipeHeight;

                // Create pipe
                for (let h = 0; h < pipeHeight; h++) {
                    platforms.push({
                        x: x * TILE_SIZE,
                        y: groundY - (pipeHeight - h) * TILE_SIZE,
                        width: TILE_SIZE * 2,
                        height: TILE_SIZE,
                        type: h === 0 ? 'pipe-top' : 'pipe'
                    });
                }

                pipePositions.push(x);
                lastPipeX = x;
                x += randomInt(10, 18);
            } else {
                x++;
            }
        } else {
            x++;
        }
    }

    // ================================
    // STEP 3: Add floating block clusters
    // ================================

    // Rules for blocks:
    // - Height: 4-5 tiles above ground (reachable by jump)
    // - Not directly above gaps
    // - Cluster of 3-6 blocks with mix of brick and question

    let lastBlockX = 0;
    x = 8;
    let mushroomCount = 0;
    let fireFlowerCount = 0;
    let starPlaced = false;
    const maxMushrooms = 6;    // Increased from previous
    const maxFireFlowers = 4;  // Increased fire flowers
    const starPosition = randomInt(40, 100); // Random position for guaranteed star

    while (x < levelWidth - 20) {
        if (seededRandom() < 0.22 && x - lastBlockX >= 6) { // More blocks, closer together
            // Check if ground exists below
            let hasGround = true;
            for (let check = x; check < x + 5 && check < levelWidth; check++) {
                if (!groundMap[check]) {
                    hasGround = false;
                    break;
                }
            }

            if (hasGround) {
                const clusterWidth = randomInt(3, 6);
                // Block height: 4 tiles above ground (y = groundY - 4*TILE_SIZE)
                // In tile coords from top: canvas is 15 tiles, ground is at 13, blocks at 9
                const blockYTile = 9; // Fixed height that's reachable

                for (let b = 0; b < clusterWidth; b++) {
                    const blockX = x + b;
                    if (blockX >= levelWidth - 15) break;

                    // Determine block type
                    let blockType = 'brick';
                    let hasMushroom = false;
                    let hasFireFlower = false;
                    let hasStar = false;

                    if (seededRandom() < 0.4) { // More question blocks (40% vs 30%)
                        blockType = 'question';

                        // Check if this is the star position
                        if (!starPlaced && Math.abs(blockX - starPosition) < 5) {
                            hasStar = true;
                            starPlaced = true;
                        }
                        // Power-up distribution - higher rates
                        else if (seededRandom() < 0.7) { // 70% chance for power-up (vs 40%)
                            const roll = seededRandom();
                            if (roll < 0.4 && mushroomCount < maxMushrooms) {
                                hasMushroom = true;
                                mushroomCount++;
                            } else if (roll < 0.8 && fireFlowerCount < maxFireFlowers) {
                                hasFireFlower = true;
                                fireFlowerCount++;
                            } else if (mushroomCount < maxMushrooms) {
                                hasMushroom = true;
                                mushroomCount++;
                            }
                        }
                    }

                    platforms.push({
                        x: blockX * TILE_SIZE,
                        y: blockYTile * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                        type: blockType,
                        hasMushroom: hasMushroom,
                        hasFireFlower: hasFireFlower,
                        hasStar: hasStar,
                        hit: false
                    });
                }

                lastBlockX = x + clusterWidth;
                x += clusterWidth + randomInt(5, 10); // Closer block clusters
            } else {
                x++;
            }
        } else {
            x++;
        }
    }

    // Guarantee at least one star if not placed yet
    if (!starPlaced) {
        // Find a question block to add star to
        for (let platform of platforms) {
            if (platform.type === 'question' && !platform.hasMushroom &&
                !platform.hasFireFlower && !platform.hasStar && !platform.hit) {
                platform.hasStar = true;
                starPlaced = true;
                break;
            }
        }
    }

    // ================================
    // STEP 4: Add stair platforms (optional floating platforms)
    // ================================

    x = 20;
    while (x < levelWidth - 25) {
        if (seededRandom() < 0.08) {
            // Check for gap nearby - add stepping stone
            let nearGap = false;
            for (let zone of gapZones) {
                if (x >= zone.start && x <= zone.end + 3) {
                    nearGap = true;
                    break;
                }
            }

            if (nearGap) {
                // Add helpful stepping stone platform
                const stairY = randomInt(6, 8);
                const stairWidth = randomInt(2, 4);

                for (let s = 0; s < stairWidth; s++) {
                    platforms.push({
                        x: (x + s) * TILE_SIZE,
                        y: stairY * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                        type: 'brick'
                    });
                }
                x += stairWidth + 10;
            } else {
                x++;
            }
        } else {
            x++;
        }
    }

    // ================================
    // STEP 5: Goal stairs (always same structure)
    // ================================

    const stairStartX = levelWidth - 15;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j <= i; j++) {
            platforms.push({
                x: (stairStartX + i) * TILE_SIZE,
                y: groundY - (j + 1) * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
                type: 'stair'
            });
        }
    }

    // Set goal position (after stairs)
    GOAL_X = (stairStartX + 8) * TILE_SIZE;

    // ================================
    // STEP 6: Place enemies safely
    // ================================

    // Difficulty scales with level number (1-10)
    // Level 1: Very easy, few enemies, only Goombas
    // Level 5: Medium, moderate enemies, mix of types
    // Level 10: Hard, many enemies, all types including Hammer Bros

    const currentLevel = gameState.level || 1;
    const difficultyScale = (currentLevel - 1) / 9; // 0 at level 1, 1 at level 10

    // Enemy count scales with level: 3-5 at level 1, up to 15-20 at level 10
    const minEnemies = Math.floor(3 + difficultyScale * 12);
    const maxEnemies = Math.floor(5 + difficultyScale * 15);
    const numEnemies = randomInt(minEnemies, maxEnemies);

    // Minimum spacing between enemies (more spread out in early levels)
    const enemySpacing = Math.floor(8 - difficultyScale * 3); // 8 at level 1, 5 at level 10

    let enemyPositions = [];
    let lastEnemyX = 0;
    let attempts = 0;

    while (enemyPositions.length < numEnemies && attempts < 200) {
        attempts++;
        const ex = randomInt(10, levelWidth - 20); // Start enemies further from spawn

        // Check if position is safe
        let safe = true;

        // Not too close to last enemy
        if (Math.abs(ex - lastEnemyX) < enemySpacing) safe = false;

        // Not in gap zone
        for (let zone of gapZones) {
            if (ex >= zone.start && ex <= zone.end) {
                safe = false;
                break;
            }
        }

        // Not on or near pipes
        for (let pipeX of pipePositions) {
            if (ex >= pipeX - 2 && ex <= pipeX + 3) {
                safe = false;
                break;
            }
        }

        // Must have ground
        if (!groundMap[ex]) safe = false;

        // Not too close to existing enemies
        for (let pos of enemyPositions) {
            if (Math.abs(ex - pos) < enemySpacing) {
                safe = false;
                break;
            }
        }

        if (safe) {
            enemyPositions.push(ex);
            lastEnemyX = ex;
        }
    }

    // Create enemies based on level difficulty
    for (let i = 0; i < enemyPositions.length; i++) {
        const ex = enemyPositions[i];
        const progress = ex / levelWidth; // 0 to 1, how far into level
        const roll = seededRandom();

        // Enemy type availability based on level
        // Level 1-2: Only Goombas
        // Level 3-4: Goombas + Koopas
        // Level 5-6: + Para-Koopas
        // Level 7-8: + Hammer Bros (rare)
        // Level 9-10: Full variety, Hammer Bros more common

        if (currentLevel <= 2) {
            // Levels 1-2: Only Goombas (very easy)
            enemies.push(new Goomba(ex * TILE_SIZE, groundY - TILE_SIZE));
        } else if (currentLevel <= 4) {
            // Levels 3-4: Goombas and Koopas
            if (roll < 0.7) {
                enemies.push(new Goomba(ex * TILE_SIZE, groundY - TILE_SIZE));
            } else {
                enemies.push(new Koopa(ex * TILE_SIZE, groundY - TILE_SIZE - 8));
            }
        } else if (currentLevel <= 6) {
            // Levels 5-6: Add Para-Koopas
            if (roll < 0.5) {
                enemies.push(new Goomba(ex * TILE_SIZE, groundY - TILE_SIZE));
            } else if (roll < 0.8) {
                enemies.push(new Koopa(ex * TILE_SIZE, groundY - TILE_SIZE - 8));
            } else {
                const pattern = seededRandom() < 0.5 ? 'vertical' : 'horizontal';
                enemies.push(new ParaKoopa(ex * TILE_SIZE, groundY - TILE_SIZE * 4, pattern));
            }
        } else if (currentLevel <= 8) {
            // Levels 7-8: Add Hammer Bros (rare)
            if (roll < 0.35) {
                enemies.push(new Goomba(ex * TILE_SIZE, groundY - TILE_SIZE));
            } else if (roll < 0.6) {
                enemies.push(new Koopa(ex * TILE_SIZE, groundY - TILE_SIZE - 8));
            } else if (roll < 0.85) {
                const pattern = seededRandom() < 0.5 ? 'vertical' : 'horizontal';
                enemies.push(new ParaKoopa(ex * TILE_SIZE, groundY - TILE_SIZE * 4, pattern));
            } else {
                enemies.push(new HammerBro(ex * TILE_SIZE, groundY - TILE_SIZE - 12));
            }
        } else {
            // Levels 9-10: Full difficulty, more Hammer Bros
            if (roll < 0.25) {
                enemies.push(new Goomba(ex * TILE_SIZE, groundY - TILE_SIZE));
            } else if (roll < 0.45) {
                enemies.push(new Koopa(ex * TILE_SIZE, groundY - TILE_SIZE - 8));
            } else if (roll < 0.70) {
                const pattern = seededRandom() < 0.5 ? 'vertical' : 'horizontal';
                enemies.push(new ParaKoopa(ex * TILE_SIZE, groundY - TILE_SIZE * 4, pattern));
            } else {
                enemies.push(new HammerBro(ex * TILE_SIZE, groundY - TILE_SIZE - 12));
            }
        }
    }

    // ================================
    // STEP 6b: Place Bill Blasters (cannons) - only level 4+
    // ================================

    let cannonPositions = [];
    if (currentLevel >= 4) {
        // Cannon chance increases with level
        const cannonChance = 0.04 + (currentLevel - 4) * 0.02; // 4% at level 4, up to 16% at level 10
        x = 30;
        while (x < levelWidth - 30) {
            if (seededRandom() < cannonChance) {
                // Check if safe position
                let safeForCannon = groundMap[x] && groundMap[x+1];
                for (let zone of gapZones) {
                    if (x >= zone.start - 3 && x <= zone.end + 3) {
                        safeForCannon = false;
                        break;
                    }
                }
                for (let pipeX of pipePositions) {
                    if (Math.abs(x - pipeX) < 5) {
                        safeForCannon = false;
                        break;
                    }
                }

                if (safeForCannon) {
                    enemies.push(new BillBlaster(x * TILE_SIZE, groundY - TILE_SIZE * 2));
                    cannonPositions.push(x);
                    x += Math.floor(25 - currentLevel); // Closer together at higher levels
                } else {
                    x++;
                }
            } else {
                x++;
            }
        }
    }

    // ================================
    // STEP 6c: Place jumping fish (Cheep Cheeps) - only level 3+
    // ================================

    if (currentLevel >= 3) {
        // Place fish near gaps (they jump from below)
        const fishChance = 0.3 + difficultyScale * 0.4; // 30% at level 3, up to 70% at level 10
        for (let zone of gapZones) {
            if (seededRandom() < fishChance) {
                const fishX = (zone.start + zone.end) / 2;
                enemies.push(new CheepCheep(fishX * TILE_SIZE, canvas.height + 50));
            }
        }

        // Also add some fish in random positions (more at higher levels)
        const numFish = randomInt(0, Math.floor(difficultyScale * 4));
        for (let i = 0; i < numFish; i++) {
            const fishX = randomInt(20, levelWidth - 30);
            enemies.push(new CheepCheep(fishX * TILE_SIZE, canvas.height + 50));
        }
    }

    // ================================
    // STEP 7: Create Mario at start
    // ================================

    mario = new Mario(3 * TILE_SIZE, groundY - TILE_SIZE * 2);

    // ================================
    // STEP 8: Validate level (debug)
    // ================================

    console.log(`Level generated with seed: ${levelSeed}`);
    console.log(`Gaps: ${gapZones.length}, Pipes: ${pipePositions.length}, Enemies: ${enemies.length}`);
}

// ===============================
// SNES-STYLE DRAWING FUNCTIONS
// ===============================

function drawBackground() {
    // Sky gradient - SNES style
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#6088ff');
    gradient.addColorStop(0.6, '#90b8ff');
    gradient.addColorStop(1, '#c0e0ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clouds - SNES style
    drawCloudSNES(100 - (camera.x * 0.3) % 800, 50);
    drawCloudSNES(350 - (camera.x * 0.3) % 800, 70);
    drawCloudSNES(600 - (camera.x * 0.3) % 800, 40);
    drawCloudSNES(900 - (camera.x * 0.3) % 800, 80);

    // Hills - SNES style
    drawHillSNES(100 - (camera.x * 0.5) % 600, canvas.height - TILE_SIZE * 2, 80);
    drawHillSNES(400 - (camera.x * 0.5) % 600, canvas.height - TILE_SIZE * 2, 120);
    drawHillSNES(700 - (camera.x * 0.5) % 600, canvas.height - TILE_SIZE * 2, 60);

    // Bushes
    drawBushSNES(150 - (camera.x * 0.7) % 500, canvas.height - TILE_SIZE * 2);
    drawBushSNES(380 - (camera.x * 0.7) % 500, canvas.height - TILE_SIZE * 2);
    drawBushSNES(650 - (camera.x * 0.7) % 500, canvas.height - TILE_SIZE * 2);
}

function drawCloudSNES(x, y) {
    // SNES style cloud with shading
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 8, 26, 0, Math.PI * 2);
    ctx.arc(x + 44, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 22, y + 4, 18, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#f8f8ff';
    ctx.beginPath();
    ctx.arc(x + 22, y - 12, 16, 0, Math.PI * 2);
    ctx.fill();
}

function drawHillSNES(x, y, width) {
    // SNES style hill with gradient effect
    ctx.fillStyle = '#40a040';
    ctx.beginPath();
    ctx.moveTo(x - width, y);
    ctx.quadraticCurveTo(x, y - width * 0.8, x + width, y);
    ctx.fill();

    // Highlight band
    ctx.fillStyle = '#60c060';
    ctx.beginPath();
    ctx.moveTo(x - width * 0.8, y);
    ctx.quadraticCurveTo(x, y - width * 0.6, x + width * 0.8, y);
    ctx.quadraticCurveTo(x, y - width * 0.5, x - width * 0.8, y);
    ctx.fill();

    // Spots
    ctx.fillStyle = '#308030';
    ctx.beginPath();
    ctx.arc(x - width/3, y - width/4, 4, 0, Math.PI * 2);
    ctx.arc(x + width/4, y - width/3, 3, 0, Math.PI * 2);
    ctx.arc(x - width/6, y - width/2.5, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawBushSNES(x, y) {
    // SNES style bush
    ctx.fillStyle = '#40a040';
    ctx.beginPath();
    ctx.arc(x, y - 12, 18, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 10, 14, 0, Math.PI * 2);
    ctx.arc(x - 18, y - 10, 14, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#60c060';
    ctx.beginPath();
    ctx.arc(x, y - 16, 10, 0, Math.PI * 2);
    ctx.arc(x + 18, y - 14, 8, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlatforms() {
    for (let platform of platforms) {
        const screenX = platform.x - camera.x;

        // Skip if off screen
        if (screenX < -TILE_SIZE * 2 || screenX > canvas.width + TILE_SIZE) continue;

        switch(platform.type) {
            case 'ground':
                drawGroundTileSNES(screenX, platform.y);
                break;
            case 'brick':
                drawBrickBlockSNES(screenX, platform.y);
                break;
            case 'stair':
                drawStairBlockSNES(screenX, platform.y);
                break;
            case 'question':
                drawQuestionBlockSNES(screenX, platform.y, platform.hit);
                break;
            case 'pipe-top':
                drawPipeTopSNES(screenX, platform.y);
                break;
            case 'pipe':
                drawPipeBodySNES(screenX, platform.y);
                break;
        }
    }
}

function drawGroundTileSNES(x, y) {
    // SNES style ground with better texture
    ctx.fillStyle = '#c06820';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Brick pattern
    ctx.fillStyle = '#905010';
    ctx.fillRect(x, y, TILE_SIZE, 2);
    ctx.fillRect(x + TILE_SIZE/2 - 1, y, 2, TILE_SIZE/2);
    ctx.fillRect(x, y + TILE_SIZE/2, TILE_SIZE, 2);
    ctx.fillRect(x + TILE_SIZE/4 - 1, y + TILE_SIZE/2, 2, TILE_SIZE/2);
    ctx.fillRect(x + TILE_SIZE * 3/4 - 1, y + TILE_SIZE/2, 2, TILE_SIZE/2);

    // Highlights
    ctx.fillStyle = '#d88840';
    ctx.fillRect(x + 2, y + 4, TILE_SIZE/2 - 4, 2);
    ctx.fillRect(x + 2, y + TILE_SIZE/2 + 4, TILE_SIZE/4 - 4, 2);
}

function drawBrickBlockSNES(x, y) {
    // SNES style brick
    ctx.fillStyle = '#c06820';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Mortar lines
    ctx.fillStyle = '#905010';
    ctx.fillRect(x, y + TILE_SIZE/4 - 1, TILE_SIZE, 2);
    ctx.fillRect(x, y + TILE_SIZE/2 - 1, TILE_SIZE, 2);
    ctx.fillRect(x, y + TILE_SIZE * 3/4 - 1, TILE_SIZE, 2);
    ctx.fillRect(x + TILE_SIZE/2 - 1, y, 2, TILE_SIZE/4);
    ctx.fillRect(x + TILE_SIZE/4 - 1, y + TILE_SIZE/4, 2, TILE_SIZE/4);
    ctx.fillRect(x + TILE_SIZE * 3/4 - 1, y + TILE_SIZE/4, 2, TILE_SIZE/4);
    ctx.fillRect(x + TILE_SIZE/2 - 1, y + TILE_SIZE/2, 2, TILE_SIZE/4);
    ctx.fillRect(x + TILE_SIZE/4 - 1, y + TILE_SIZE * 3/4, 2, TILE_SIZE/4);
    ctx.fillRect(x + TILE_SIZE * 3/4 - 1, y + TILE_SIZE * 3/4, 2, TILE_SIZE/4);

    // Highlights
    ctx.fillStyle = '#d88840';
    ctx.fillRect(x + 2, y + 2, 4, 2);
    ctx.fillRect(x + TILE_SIZE/2 + 2, y + TILE_SIZE/4 + 2, 4, 2);
    ctx.fillRect(x + 2, y + TILE_SIZE/2 + 2, 4, 2);
    ctx.fillRect(x + TILE_SIZE/2 + 2, y + TILE_SIZE * 3/4 + 2, 4, 2);

    // Border
    ctx.strokeStyle = '#603000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawStairBlockSNES(x, y) {
    // SNES style stair block (stone texture)
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Highlights
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(x, y, TILE_SIZE, 2);
    ctx.fillRect(x, y, 2, TILE_SIZE);

    // Shadows
    ctx.fillStyle = '#606060';
    ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
    ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);

    // Stone texture
    ctx.fillStyle = '#707070';
    ctx.fillRect(x + 8, y + 8, 4, 4);
    ctx.fillRect(x + 20, y + 16, 4, 4);
    ctx.fillRect(x + 12, y + 22, 3, 3);
}

function drawQuestionBlockSNES(x, y, hit) {
    if (hit) {
        // Used block
        ctx.fillStyle = '#704020';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#905030';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeStyle = '#402010';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        return;
    }

    // SNES style animated question block
    const pulse = Math.sin(Date.now() / 150) * 10;

    // Base
    ctx.fillStyle = `rgb(${220 + pulse}, ${160 + pulse}, 0)`;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Inner border
    ctx.fillStyle = `rgb(${180 + pulse}, ${120 + pulse}, 0)`;
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Shine
    ctx.fillStyle = `rgb(${255}, ${200 + pulse}, ${50 + pulse})`;
    ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // Question mark with shadow
    ctx.fillStyle = '#000';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + TILE_SIZE/2 + 1, y + TILE_SIZE/2 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText('?', x + TILE_SIZE/2, y + TILE_SIZE/2);

    // Border
    ctx.strokeStyle = '#804000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
}

function drawPipeTopSNES(x, y) {
    // SNES style pipe top
    const pipeWidth = TILE_SIZE * 2 + 8;

    // Main color
    ctx.fillStyle = '#00a000';
    ctx.fillRect(x - 4, y, pipeWidth, TILE_SIZE);

    // Highlight
    ctx.fillStyle = '#40d040';
    ctx.fillRect(x - 2, y + 2, 8, TILE_SIZE - 4);

    // Mid tone
    ctx.fillStyle = '#20c020';
    ctx.fillRect(x + 8, y + 2, pipeWidth - 24, TILE_SIZE - 4);

    // Shadow
    ctx.fillStyle = '#008000';
    ctx.fillRect(x + pipeWidth - 12, y + 2, 8, TILE_SIZE - 4);

    // Rim highlight
    ctx.fillStyle = '#60e060';
    ctx.fillRect(x - 4, y, pipeWidth, 3);

    // Rim shadow
    ctx.fillStyle = '#006000';
    ctx.fillRect(x - 4, y + TILE_SIZE - 3, pipeWidth, 3);

    // Border
    ctx.strokeStyle = '#004000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y, pipeWidth, TILE_SIZE);
}

function drawPipeBodySNES(x, y) {
    // SNES style pipe body
    ctx.fillStyle = '#00a000';
    ctx.fillRect(x, y, TILE_SIZE * 2, TILE_SIZE);

    // Highlight
    ctx.fillStyle = '#40d040';
    ctx.fillRect(x + 2, y, 8, TILE_SIZE);

    // Mid tone
    ctx.fillStyle = '#20c020';
    ctx.fillRect(x + 12, y, TILE_SIZE * 2 - 24, TILE_SIZE);

    // Shadow
    ctx.fillStyle = '#008000';
    ctx.fillRect(x + TILE_SIZE * 2 - 10, y, 8, TILE_SIZE);

    // Lines
    ctx.strokeStyle = '#006000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + TILE_SIZE);
    ctx.moveTo(x + TILE_SIZE * 2, y);
    ctx.lineTo(x + TILE_SIZE * 2, y + TILE_SIZE);
    ctx.stroke();
}

// Draw goal (flag pole and castle)
function drawGoal() {
    const screenX = GOAL_X - camera.x;
    if (screenX < -200 || screenX > canvas.width + 100) return;

    // Flag pole
    const poleX = screenX;
    const poleTop = canvas.height - TILE_SIZE * 2 - TILE_SIZE * 10;
    const poleBottom = canvas.height - TILE_SIZE * 2;

    // Pole shadow
    ctx.fillStyle = '#404040';
    ctx.fillRect(poleX + 4, poleTop, 6, poleBottom - poleTop);

    // Pole
    ctx.fillStyle = '#808080';
    ctx.fillRect(poleX, poleTop, 6, poleBottom - poleTop);
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(poleX, poleTop, 3, poleBottom - poleTop);

    // Pole top ball
    ctx.fillStyle = '#40c040';
    ctx.beginPath();
    ctx.arc(poleX + 3, poleTop, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#60e060';
    ctx.beginPath();
    ctx.arc(poleX + 1, poleTop - 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Flag
    let flagY = gameState.isVictory ?
        Math.min(gameState.flagY + mario.slideY, poleBottom - 32) :
        poleTop + 8;

    ctx.fillStyle = '#00a000';
    ctx.beginPath();
    ctx.moveTo(poleX + 6, flagY);
    ctx.lineTo(poleX + 36, flagY + 12);
    ctx.lineTo(poleX + 6, flagY + 24);
    ctx.closePath();
    ctx.fill();

    // Flag highlight
    ctx.fillStyle = '#40d040';
    ctx.beginPath();
    ctx.moveTo(poleX + 6, flagY);
    ctx.lineTo(poleX + 26, flagY + 8);
    ctx.lineTo(poleX + 6, flagY + 16);
    ctx.closePath();
    ctx.fill();

    // Castle
    const castleX = screenX + TILE_SIZE * 4;
    const castleY = canvas.height - TILE_SIZE * 2 - TILE_SIZE * 5;

    // Castle base
    ctx.fillStyle = '#c06820';
    ctx.fillRect(castleX, castleY + TILE_SIZE * 2, TILE_SIZE * 4, TILE_SIZE * 3);

    // Castle door
    ctx.fillStyle = '#000';
    ctx.fillRect(castleX + TILE_SIZE * 1.25, castleY + TILE_SIZE * 3, TILE_SIZE * 1.5, TILE_SIZE * 2);
    ctx.fillStyle = '#402000';
    ctx.fillRect(castleX + TILE_SIZE * 1.5, castleY + TILE_SIZE * 3.5, TILE_SIZE, TILE_SIZE * 1.5);

    // Castle top
    ctx.fillStyle = '#c06820';
    ctx.fillRect(castleX + TILE_SIZE * 0.5, castleY + TILE_SIZE, TILE_SIZE * 3, TILE_SIZE);

    // Battlements
    ctx.fillStyle = '#c06820';
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(castleX + i * TILE_SIZE, castleY, TILE_SIZE * 0.7, TILE_SIZE);
    }

    // Castle highlights
    ctx.fillStyle = '#d88840';
    ctx.fillRect(castleX + 2, castleY + TILE_SIZE * 2 + 2, TILE_SIZE * 4 - 4, 4);
    ctx.fillRect(castleX + TILE_SIZE * 0.5 + 2, castleY + TILE_SIZE + 2, TILE_SIZE * 3 - 4, 4);

    // Castle windows
    ctx.fillStyle = '#000';
    ctx.fillRect(castleX + TILE_SIZE * 0.7, castleY + TILE_SIZE * 2.3, TILE_SIZE * 0.5, TILE_SIZE * 0.5);
    ctx.fillRect(castleX + TILE_SIZE * 2.8, castleY + TILE_SIZE * 2.3, TILE_SIZE * 0.5, TILE_SIZE * 0.5);
}

// Enemy collision check
// Check mushroom collisions
function checkMushroomCollisions() {
    if (mario.isDead || gameState.isVictory) return;

    for (let i = mushrooms.length - 1; i >= 0; i--) {
        let mushroom = mushrooms[i];
        if (mushroom.emerging) continue; // Can't collect while emerging

        if (mario.x < mushroom.x + mushroom.width &&
            mario.x + mario.width > mushroom.x &&
            mario.y < mushroom.y + mushroom.height &&
            mario.y + mario.height > mushroom.y) {
            // Collect mushroom
            mario.powerUp();
            mushrooms.splice(i, 1);
        }
    }
}

// Check fire flower collisions
function checkFireFlowerCollisions() {
    if (mario.isDead || gameState.isVictory) return;

    for (let i = fireFlowers.length - 1; i >= 0; i--) {
        let flower = fireFlowers[i];
        if (flower.emerging) continue; // Can't collect while emerging

        if (mario.x < flower.x + flower.width &&
            mario.x + mario.width > flower.x &&
            mario.y < flower.y + flower.height &&
            mario.y + mario.height > flower.y) {
            // Collect fire flower
            mario.fireFlowerPowerUp();
            fireFlowers.splice(i, 1);
        }
    }
}

function checkStarCollisions() {
    if (mario.isDead || gameState.isVictory) return;

    for (let i = stars.length - 1; i >= 0; i--) {
        let star = stars[i];
        if (star.emerging) continue; // Can't collect while emerging

        if (mario.x < star.x + star.width &&
            mario.x + mario.width > star.x &&
            mario.y < star.y + star.height &&
            mario.y + mario.height > star.y) {
            // Collect star
            mario.starPowerUp();
            stars.splice(i, 1);
        }
    }
}

function checkEnemyCollisions() {
    if (mario.isDead || gameState.isVictory) return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        if (enemy.isDead) continue;

        // Skip collision during kick cooldown (Koopa shells)
        if (enemy.kickCooldown && enemy.kickCooldown > 0) continue;

        // Cheep Cheep only collides when jumping (visible)
        if (enemy instanceof CheepCheep && !enemy.isJumping) continue;

        if (mario.x < enemy.x + enemy.width &&
            mario.x + mario.width > enemy.x &&
            mario.y < enemy.y + enemy.height &&
            mario.y + mario.height > enemy.y) {

            // Star power - kill enemies on contact!
            if (mario.hasStarPower) {
                // Can't kill Bill Blaster (cannon)
                if (enemy instanceof BillBlaster) {
                    continue;
                }
                // Remove hammers
                if (enemy instanceof Hammer) {
                    enemies.splice(i, 1);
                    continue;
                }
                // Kill all other enemies
                enemy.isDead = true;
                enemy.vy = -5;
                gameState.score += 200;
                soundGen.playStomp();
                continue;
            }

            // Hammers always hurt Mario (can't be stomped)
            if (enemy instanceof Hammer) {
                mario.takeDamage();
                enemies.splice(i, 1); // Remove hammer after hit
                continue;
            }

            // Bill Blaster (cannon) - can't be killed, Mario bounces off
            if (enemy instanceof BillBlaster) {
                mario.vy = -8;
                continue;
            }

            // Check if Mario is falling on top of enemy
            if (mario.vy > 0 && mario.y + mario.height < enemy.y + enemy.height/2 + 10) {
                enemy.stomp();
                mario.vy = -8; // Bounce
            } else {
                // For Koopa shells - if stationary, kick it instead of taking damage
                if (enemy.isShell && !enemy.isMovingShell) {
                    const direction = mario.x < enemy.x ? 1 : -1;
                    enemy.kick(direction);
                } else if (enemy.isMovingShell) {
                    // Moving shell hurts Mario
                    mario.takeDamage();
                } else {
                    // Regular enemy - Mario takes damage
                    mario.takeDamage();
                }
            }
        }
    }
}

// Check shell collisions with other enemies
function checkShellCollisions() {
    for (let enemy of enemies) {
        if (enemy.checkShellCollisions) {
            enemy.checkShellCollisions();
        }
    }
}

// Check fireball collisions with enemies
function checkFireballCollisions() {
    for (let i = fireballs.length - 1; i >= 0; i--) {
        let fireball = fireballs[i];

        for (let j = enemies.length - 1; j >= 0; j--) {
            let enemy = enemies[j];
            if (enemy.isDead) continue;

            if (fireball.x < enemy.x + enemy.width &&
                fireball.x + fireball.width > enemy.x &&
                fireball.y < enemy.y + enemy.height &&
                fireball.y + fireball.height > enemy.y) {

                // Enemy hit by fireball
                enemy.isDead = true;
                enemy.deathTimer = 0;
                gameState.score += 200;
                soundGen.playFireHit();

                // Remove fireball
                fireballs.splice(i, 1);
                break;
            }
        }
    }
}

// Update camera
function updateCamera() {
    // Follow Mario
    const targetX = mario.x - canvas.width / 3;
    camera.x = Math.max(0, targetX);
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = String(gameState.score).padStart(6, '0');
    document.getElementById('coins').textContent = String(gameState.coins).padStart(2, '0');
    document.getElementById('time').textContent = gameState.time;
    document.getElementById('world').textContent = `${gameState.world}-${gameState.level}`;
}

// Timer
let lastTime = Date.now();
function updateTimer() {
    if (gameState.isGameOver || mario.isDead || gameState.isVictory) return;

    const now = Date.now();
    if (now - lastTime >= 400) { // Roughly every 400ms
        gameState.time--;
        lastTime = now;

        if (gameState.time <= 0) {
            mario.die();
        }
    }
}

// Game loop
function gameLoop() {
    if (!gameState.isGameOver) {
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Skip updates when paused (but still draw)
        if (!gameState.isPaused) {
            // Update
            mario.update();
            updateCamera();

        if (!gameState.isVictory) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                if (!enemies[i].update()) {
                    enemies.splice(i, 1);
                }
            }

            // Update mushrooms
            for (let i = mushrooms.length - 1; i >= 0; i--) {
                if (!mushrooms[i].update()) {
                    mushrooms.splice(i, 1);
                }
            }

            // Update fire flowers
            for (let i = fireFlowers.length - 1; i >= 0; i--) {
                if (!fireFlowers[i].update()) {
                    fireFlowers.splice(i, 1);
                }
            }

            // Update stars
            for (let i = stars.length - 1; i >= 0; i--) {
                if (!stars[i].update()) {
                    stars.splice(i, 1);
                }
            }

            // Update fireballs
            for (let i = fireballs.length - 1; i >= 0; i--) {
                if (!fireballs[i].update()) {
                    fireballs.splice(i, 1);
                }
            }

            checkEnemyCollisions();
            checkMushroomCollisions();
            checkFireFlowerCollisions();
            checkStarCollisions();
            checkFireballCollisions();
            checkShellCollisions();
        }

            updateCoinEffects();
            updateBrickDebris();
            updateTimer();
        } // End isPaused check

        // Draw
        drawBackground();
        drawPlatforms();
        drawGoal();

        for (let enemy of enemies) {
            enemy.draw();
        }

        // Draw mushrooms
        for (let mushroom of mushrooms) {
            mushroom.draw();
        }

        // Draw fire flowers
        for (let flower of fireFlowers) {
            flower.draw();
        }

        // Draw stars
        for (let star of stars) {
            star.draw();
        }

        // Draw fireballs
        for (let fireball of fireballs) {
            fireball.draw();
        }

        mario.draw();
        drawCoinEffects();
        drawBrickDebris();

        // Draw pause overlay
        if (gameState.isPaused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '32px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
            ctx.font = '16px monospace';
            ctx.fillText('Tap RESUME to continue', canvas.width / 2, canvas.height / 2 + 40);
        }

        // Update UI
        updateUI();
    }

    requestAnimationFrame(gameLoop);
}

// Retry same level (after game over)
function retryLevel() {
    const currentWorld = gameState.world;
    const currentLevel = gameState.level;
    const currentSeed = gameState.currentLevelSeed;
    const currentScore = gameState.score; // Keep score on retry

    gameState = {
        score: currentScore,
        coins: 0,
        time: 400,
        isGameOver: false,
        isPaused: false,
        isVictory: false,
        flagY: canvas.height - TILE_SIZE * 2 - TILE_SIZE * 10,
        victorySequence: 0,
        world: currentWorld,
        level: currentLevel,
        currentLevelSeed: currentSeed
    };
    camera.x = 0;
    mushrooms = [];
    fireFlowers = [];
    stars = [];
    fireballs = [];
    brickDebris = [];
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('victory').style.display = 'none';
    generateLevel(true); // Use same seed
    lastTime = Date.now();
    startBGM();
}

// Advance to next level (after victory)
function nextLevel() {
    const currentScore = gameState.score;
    const currentCoins = gameState.coins;
    let nextWorld = gameState.world;
    let nextLevel = gameState.level + 1;

    // Save Mario's power-up state
    const marioIsBig = mario.isBig;
    const marioHasFire = mario.hasFire;

    // Check if game complete (reached 1-10)
    if (nextLevel > 10) {
        showGameComplete();
        return;
    }

    gameState = {
        score: currentScore,
        coins: currentCoins,
        time: 400,
        isGameOver: false,
        isPaused: false,
        isVictory: false,
        flagY: canvas.height - TILE_SIZE * 2 - TILE_SIZE * 10,
        victorySequence: 0,
        world: nextWorld,
        level: nextLevel,
        currentLevelSeed: 0
    };
    camera.x = 0;
    mushrooms = [];
    fireFlowers = [];
    stars = [];
    fireballs = [];
    brickDebris = [];
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('victory').style.display = 'none';
    generateLevel(false); // New seed for new level

    // Restore Mario's power-up state
    if (marioHasFire) {
        mario.isBig = true;
        mario.hasFire = true;
        mario.height = 56;
        mario.y -= 24;
    } else if (marioIsBig) {
        mario.isBig = true;
        mario.height = 56;
        mario.y -= 24;
    }

    lastTime = Date.now();
    startBGM();
}

// Show game complete screen
function showGameComplete() {
    document.getElementById('victory').style.display = 'none';
    document.getElementById('gameComplete').style.display = 'block';
    document.getElementById('finalScore').textContent = gameState.score;
}

// Full restart (new game from 1-1)
function restartGame() {
    gameState = {
        score: 0,
        coins: 0,
        time: 400,
        isGameOver: false,
        isPaused: false,
        isVictory: false,
        flagY: canvas.height - TILE_SIZE * 2 - TILE_SIZE * 10,
        victorySequence: 0,
        world: 1,
        level: 1,
        currentLevelSeed: 0
    };
    camera.x = 0;
    mushrooms = [];
    fireFlowers = [];
    stars = [];
    fireballs = [];
    brickDebris = [];
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('victory').style.display = 'none';
    document.getElementById('gameComplete').style.display = 'none';
    generateLevel(false);
    lastTime = Date.now();
    startBGM();
}

// Start game (called from start screen)
let gameStarted = false;
function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    // Initialize audio (requires user interaction)
    initAudio();

    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';

    // Start BGM
    startBGM();
}

// Initialize
generateLevel();
gameLoop();
