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

// BGM - TwinBee style upbeat chiptune
let bgmInterval = null;
let bgmStep = 0;
let bgmBeat = 0;

// ツインビー風のポップで明るいメロディ（Fメジャー基調）
// Note: 0 = rest
const bgmMelody = [
    // イントロ・Aメロ（明るく跳ねるような感じ）
    698, 698, 880, 880, 1047, 1047, 880, 0,
    784, 784, 698, 698, 659, 659, 698, 0,
    698, 698, 880, 880, 1047, 1047, 1175, 0,
    1319, 1175, 1047, 880, 784, 698, 784, 0,
    // Bメロ（サビ前の盛り上がり）
    880, 880, 1047, 1047, 1175, 1175, 1319, 0,
    1175, 1175, 1047, 1047, 880, 880, 784, 0,
    880, 1047, 1175, 1319, 1397, 1319, 1175, 1047,
    880, 784, 698, 659, 587, 659, 698, 0,
    // サビ（キャッチーなフレーズ）
    1047, 0, 1047, 1175, 1319, 0, 1175, 1047,
    880, 0, 880, 784, 698, 0, 784, 880,
    1047, 0, 1047, 1175, 1319, 1397, 1568, 0,
    1397, 1319, 1175, 1047, 880, 784, 698, 0,
    // サビ後半
    1319, 0, 1319, 1175, 1047, 0, 880, 784,
    880, 0, 880, 1047, 1175, 0, 1047, 880,
    698, 784, 880, 1047, 1175, 1319, 1397, 1568,
    1760, 1568, 1397, 1319, 1175, 1047, 880, 0
];

// ベースライン（ルート音を刻む）
const bgmBass = [
    // Aメロ
    349, 0, 349, 0, 349, 0, 349, 349,
    294, 0, 294, 0, 294, 0, 294, 294,
    349, 0, 349, 0, 349, 0, 349, 349,
    392, 0, 392, 0, 349, 0, 349, 349,
    // Bメロ
    440, 0, 440, 0, 440, 0, 440, 440,
    392, 0, 392, 0, 392, 0, 392, 392,
    349, 0, 349, 0, 349, 0, 349, 349,
    294, 0, 294, 0, 262, 0, 294, 349,
    // サビ
    349, 0, 349, 0, 440, 0, 440, 0,
    294, 0, 294, 0, 349, 0, 349, 0,
    349, 0, 349, 0, 440, 0, 523, 0,
    392, 0, 349, 0, 294, 0, 349, 349,
    // サビ後半
    440, 0, 440, 0, 349, 0, 349, 0,
    294, 0, 294, 0, 392, 0, 392, 0,
    349, 0, 349, 0, 440, 0, 523, 0,
    587, 0, 523, 0, 440, 0, 349, 349
];

// ドラムパターン
const drumPattern = [
    1, 0, 2, 0, 1, 0, 2, 2,  // 1=kick, 2=snare, 3=hihat
    1, 0, 2, 0, 1, 0, 2, 0,
    1, 0, 2, 0, 1, 0, 2, 2,
    1, 0, 2, 0, 1, 2, 1, 2
];

// アルペジオ/コード
const arpPattern = [
    523, 659, 784, 659, 523, 659, 784, 659,
    494, 622, 740, 622, 494, 622, 740, 622,
    523, 659, 784, 659, 523, 659, 784, 659,
    587, 698, 880, 698, 587, 698, 880, 698
];

function playDrum(type) {
    if (!soundEnabled || !audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;

        if (type === 1) {
            // Kick drum
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 2) {
            // Snare (noise-like)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now);
            osc.stop(now + 0.1);

            // Add noise component
            const noise = audioContext.createOscillator();
            const noiseGain = audioContext.createGain();
            noise.type = 'square';
            noise.frequency.setValueAtTime(400, now);
            noiseGain.gain.setValueAtTime(0.1, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            noise.connect(noiseGain);
            noiseGain.connect(audioContext.destination);
            noise.start(now);
            noise.stop(now + 0.08);
        } else if (type === 3) {
            // Hi-hat
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.start(now);
            osc.stop(now + 0.03);
        }
    } catch (e) {}
}

function playMelodyNote(freq, duration, volume = 0.18) {
    if (!soundEnabled || !audioContext || freq === 0) return;
    try {
        const now = audioContext.currentTime;

        // Main melody (square wave with slight detune for richness)
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 1.003, now); // Slight detune

        gain.gain.setValueAtTime(volume, now);
        gain.gain.setValueAtTime(volume * 0.8, now + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    } catch (e) {}
}

function playBassNote(freq, duration) {
    if (!soundEnabled || !audioContext || freq === 0) return;
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq / 2, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.9);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {}
}

function playArpNote(freq, duration) {
    if (!soundEnabled || !audioContext || freq === 0) return;
    try {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {}
}

function startBGM() {
    if (bgmInterval) return;
    bgmStep = 0;
    bgmBeat = 0;

    // テンポ: 約150 BPM (1拍 = 100ms, 16分音符 = 100ms)
    const tempo = 100;

    bgmInterval = setInterval(() => {
        if (!gamePaused && soundEnabled && audioContext) {
            const melodyIdx = bgmStep % bgmMelody.length;
            const bassIdx = bgmStep % bgmBass.length;
            const drumIdx = bgmStep % drumPattern.length;
            const arpIdx = bgmStep % arpPattern.length;

            // メロディ（8分音符刻み風）
            if (bgmStep % 2 === 0) {
                const melodyNote = bgmMelody[Math.floor(melodyIdx / 2) % (bgmMelody.length / 2)];
                playMelodyNote(melodyNote, 0.18);
            }

            // ベース
            const bassNote = bgmBass[bassIdx];
            playBassNote(bassNote, 0.09);

            // ドラム
            const drum = drumPattern[drumIdx];
            if (drum > 0) {
                playDrum(drum);
            }
            // ハイハットを裏拍で
            if (bgmStep % 2 === 1) {
                playDrum(3);
            }

            // アルペジオ（控えめに）
            if (bgmStep % 4 === 0) {
                const arpNote = arpPattern[Math.floor(arpIdx / 4) % (arpPattern.length / 4)];
                playArpNote(arpNote * 2, 0.15);
            }

            bgmStep++;
            bgmBeat = (bgmBeat + 1) % 16;
        }
    }, 100);
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

    // 影（地上に落ちる）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main body - グラデーション
    const bodyGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 16);
    bodyGrad.addColorStop(0, '#B0E0FF');
    bodyGrad.addColorStop(0.5, '#87CEEB');
    bodyGrad.addColorStop(1, '#5BA3D9');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body outline
    ctx.strokeStyle = '#3A7CA5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Body highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-5, -6, 5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit window - グラデーション
    const cockpitGrad = ctx.createRadialGradient(-2, -6, 0, 0, -4, 8);
    cockpitGrad.addColorStop(0, '#FFED8A');
    cockpitGrad.addColorStop(0.6, '#FFD700');
    cockpitGrad.addColorStop(1, '#DAA520');
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.ellipse(0, -4, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cockpit shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -6, 3, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Pilot face
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DEB887';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Cheeks
    ctx.fillStyle = 'rgba(255, 150, 150, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -3, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -3, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-2, -5, 1.2, 0, Math.PI * 2);
    ctx.arc(2, -5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Eye highlights
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-1.5, -5.5, 0.5, 0, Math.PI * 2);
    ctx.arc(2.5, -5.5, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Arms (boxing gloves) - より詳細に
    if (player.armLeft) {
        // Arm connector
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(-14, -1, 5, 6);
        ctx.strokeStyle = '#5BA3D9';
        ctx.lineWidth = 1;
        ctx.strokeRect(-14, -1, 5, 6);

        // Glove - グラデーション
        const gloveGrad = ctx.createRadialGradient(-17, 0, 0, -18, 2, 7);
        gloveGrad.addColorStop(0, '#FF9999');
        gloveGrad.addColorStop(0.6, '#FF6B6B');
        gloveGrad.addColorStop(1, '#CC4444');
        ctx.fillStyle = gloveGrad;
        ctx.beginPath();
        ctx.ellipse(-18, 2, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#AA3333';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Glove highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-20, 0, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    if (player.armRight) {
        // Arm connector
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(9, -1, 5, 6);
        ctx.strokeStyle = '#5BA3D9';
        ctx.lineWidth = 1;
        ctx.strokeRect(9, -1, 5, 6);

        // Glove
        const gloveGrad = ctx.createRadialGradient(17, 0, 0, 18, 2, 7);
        gloveGrad.addColorStop(0, '#FF9999');
        gloveGrad.addColorStop(0.6, '#FF6B6B');
        gloveGrad.addColorStop(1, '#CC4444');
        ctx.fillStyle = gloveGrad;
        ctx.beginPath();
        ctx.ellipse(18, 2, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#AA3333';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Glove highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(16, 0, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Feet - グラデーション
    const feetGrad = ctx.createRadialGradient(0, 13, 0, 0, 14, 6);
    feetGrad.addColorStop(0, '#FF9999');
    feetGrad.addColorStop(1, '#FF6B6B');
    ctx.fillStyle = feetGrad;
    ctx.beginPath();
    ctx.ellipse(-6, 14, 6, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CC4444';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(6, 14, 6, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Propeller on top - アニメーション改良
    const propAngle = frameCount * 0.5;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // プロペラブレード（回転）
    for (let i = 0; i < 4; i++) {
        const angle = propAngle + (i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(Math.cos(angle) * 12, -18 + Math.sin(angle) * 3);
        ctx.stroke();
    }

    // Propeller hub
    const hubGrad = ctx.createRadialGradient(-1, -19, 0, 0, -18, 4);
    hubGrad.addColorStop(0, '#FFE44D');
    hubGrad.addColorStop(1, '#DAA520');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(0, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shield effect - より豪華に
    if (player.hasShield) {
        const shieldSize = 24 + Math.sin(frameCount * 0.15) * 2;
        // 外側のグロー
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, shieldSize + 4, 0, Math.PI * 2);
        ctx.stroke();
        // メインシールド
        const shieldGrad = ctx.createRadialGradient(0, 0, shieldSize - 5, 0, 0, shieldSize);
        shieldGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        shieldGrad.addColorStop(0.7, 'rgba(0, 255, 255, 0.2)');
        shieldGrad.addColorStop(1, 'rgba(0, 255, 255, 0.6)');
        ctx.fillStyle = shieldGrad;
        ctx.beginPath();
        ctx.arc(0, 0, shieldSize, 0, Math.PI * 2);
        ctx.fill();
        // キラキラエフェクト
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 6; i++) {
            const sparkAngle = frameCount * 0.1 + i * Math.PI / 3;
            const sparkX = Math.cos(sparkAngle) * shieldSize;
            const sparkY = Math.sin(sparkAngle) * shieldSize;
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawOption(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // 影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Small helper ship - グラデーション
    const bodyGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, 10);
    bodyGrad.addColorStop(0, '#FFD080');
    bodyGrad.addColorStop(0.5, '#FFA500');
    bodyGrad.addColorStop(1, '#CC7000');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#996600';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(-3, -4, 3, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pupil（動く）
    const eyeMove = Math.sin(frameCount * 0.1) * 1;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(eyeMove, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlight
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(eyeMove + 1, -3, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBell(bell) {
    ctx.save();
    ctx.translate(bell.x, bell.y);

    // Bell swing animation
    const swing = Math.sin(frameCount * 0.15) * 0.2;
    ctx.rotate(swing);

    // 影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(2, 18, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bell body - グラデーション
    const bellGrad = ctx.createLinearGradient(-10, -12, 10, 12);
    if (bell.colorName === 'YELLOW') {
        bellGrad.addColorStop(0, '#FFF8B0');
        bellGrad.addColorStop(0.3, '#FFD700');
        bellGrad.addColorStop(0.7, '#DAA520');
        bellGrad.addColorStop(1, '#B8860B');
    } else if (bell.colorName === 'BLUE') {
        bellGrad.addColorStop(0, '#87CEEB');
        bellGrad.addColorStop(0.3, '#4169E1');
        bellGrad.addColorStop(0.7, '#0000CD');
        bellGrad.addColorStop(1, '#00008B');
    } else if (bell.colorName === 'WHITE') {
        bellGrad.addColorStop(0, '#FFFFFF');
        bellGrad.addColorStop(0.3, '#F0F0F0');
        bellGrad.addColorStop(0.7, '#D0D0D0');
        bellGrad.addColorStop(1, '#A0A0A0');
    } else if (bell.colorName === 'GREEN') {
        bellGrad.addColorStop(0, '#90EE90');
        bellGrad.addColorStop(0.3, '#32CD32');
        bellGrad.addColorStop(0.7, '#228B22');
        bellGrad.addColorStop(1, '#006400');
    } else if (bell.colorName === 'RED') {
        bellGrad.addColorStop(0, '#FFA0A0');
        bellGrad.addColorStop(0.3, '#FF4444');
        bellGrad.addColorStop(0.7, '#CC0000');
        bellGrad.addColorStop(1, '#8B0000');
    } else {
        bellGrad.addColorStop(0, bell.color);
        bellGrad.addColorStop(1, bell.color);
    }

    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.quadraticCurveTo(-12, 8, 0, 14);
    ctx.quadraticCurveTo(12, 8, 10, -8);
    ctx.quadraticCurveTo(5, -12, 0, -12);
    ctx.quadraticCurveTo(-5, -12, -10, -8);
    ctx.fill();

    // Bell outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner rim
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 10, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Bell clapper
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(0, 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(-1, 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Multiple shine effects
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-4, -4, 4, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(3, 2, 2, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // キラキラエフェクト
    if (frameCount % 20 < 10) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(-5, -6, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawCloud(cloud) {
    ctx.save();
    ctx.translate(cloud.x, cloud.y);

    // 影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(3, 25, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cloud gradient
    const cloudGrad = ctx.createRadialGradient(0, -5, 0, 0, 5, 30);
    if (cloud.hasBell) {
        cloudGrad.addColorStop(0, '#FFFFFF');
        cloudGrad.addColorStop(0.5, '#F5F5F5');
        cloudGrad.addColorStop(1, '#E0E0E0');
    } else {
        cloudGrad.addColorStop(0, '#F0F0F0');
        cloudGrad.addColorStop(0.5, '#D8D8D8');
        cloudGrad.addColorStop(1, '#C0C0C0');
    }

    ctx.fillStyle = cloudGrad;

    // Fluffy cloud shape - より立体的に
    ctx.beginPath();
    ctx.arc(-15, 2, 14, 0, Math.PI * 2);
    ctx.arc(0, -6, 16, 0, Math.PI * 2);
    ctx.arc(15, 2, 14, 0, Math.PI * 2);
    ctx.arc(10, 10, 12, 0, Math.PI * 2);
    ctx.arc(-10, 10, 12, 0, Math.PI * 2);
    ctx.arc(0, 8, 14, 0, Math.PI * 2);
    ctx.fill();

    // 上部のハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(-10, -4, 8, 0, Math.PI * 2);
    ctx.arc(5, -8, 10, 0, Math.PI * 2);
    ctx.fill();

    // 下部の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 22, 6, 0, 0, Math.PI);
    ctx.fill();

    // ベルがある場合のキラキラ
    if (cloud.hasBell && frameCount % 30 < 15) {
        ctx.fillStyle = 'rgba(255, 255, 100, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawBullet(bullet) {
    // Outer glow
    const glowGrad = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, bullet.width);
    glowGrad.addColorStop(0, 'rgba(255, 255, 150, 0.8)');
    glowGrad.addColorStop(0.5, 'rgba(255, 200, 50, 0.4)');
    glowGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.width, 0, Math.PI * 2);
    ctx.fill();

    // Core bullet
    const coreGrad = ctx.createRadialGradient(bullet.x - 1, bullet.y - 2, 0, bullet.x, bullet.y, bullet.width / 2);
    coreGrad.addColorStop(0, '#FFFFFF');
    coreGrad.addColorStop(0.3, '#FFFF80');
    coreGrad.addColorStop(1, '#FFD700');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(bullet.x, bullet.y, bullet.width / 2, bullet.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyBullet(bullet) {
    // Outer glow
    const glowGrad = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, 8);
    glowGrad.addColorStop(0, 'rgba(255, 100, 100, 0.6)');
    glowGrad.addColorStop(0.5, 'rgba(255, 50, 50, 0.3)');
    glowGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Core
    const coreGrad = ctx.createRadialGradient(bullet.x - 1, bullet.y - 1, 0, bullet.x, bullet.y, 4);
    coreGrad.addColorStop(0, '#FFFFFF');
    coreGrad.addColorStop(0.4, '#FF8888');
    coreGrad.addColorStop(1, '#FF2222');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawAirEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    // 影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (enemy.type) {
        case 'bee':
            // Bee enemy - 悪いツインビー風
            // Body gradient
            const beeGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, 14);
            beeGrad.addColorStop(0, '#FF6060');
            beeGrad.addColorStop(0.5, '#CC0000');
            beeGrad.addColorStop(1, '#8B0000');
            ctx.fillStyle = beeGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 13, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#550000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.ellipse(-4, -5, 4, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Cockpit
            const beeCockpit = ctx.createRadialGradient(-1, -4, 0, 0, -2, 6);
            beeCockpit.addColorStop(0, '#FFD080');
            beeCockpit.addColorStop(1, '#996600');
            ctx.fillStyle = beeCockpit;
            ctx.beginPath();
            ctx.ellipse(0, -2, 7, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eyes - 怒り目
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(-3, -3, 3.5, 0, Math.PI * 2);
            ctx.arc(3, -3, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(-3, -2.5, 2, 0, Math.PI * 2);
            ctx.arc(3, -2.5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-3, -2.5, 1, 0, Math.PI * 2);
            ctx.arc(3, -2.5, 1, 0, Math.PI * 2);
            ctx.fill();

            // 怒り眉毛
            ctx.strokeStyle = '#550000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, -6);
            ctx.lineTo(-1, -5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(6, -6);
            ctx.lineTo(1, -5);
            ctx.stroke();
            break;

        case 'spinner':
            // Spinning enemy - グラデーション
            ctx.rotate(frameCount * 0.15);

            const spinGrad = ctx.createLinearGradient(-12, 0, 12, 0);
            spinGrad.addColorStop(0, '#9932CC');
            spinGrad.addColorStop(0.5, '#DA70D6');
            spinGrad.addColorStop(1, '#9932CC');
            ctx.fillStyle = spinGrad;

            // 4枚の羽
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.rotate(i * Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(-3, 0);
                ctx.lineTo(0, -14);
                ctx.lineTo(3, 0);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // Center core
            const spinCore = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
            spinCore.addColorStop(0, '#FFFFFF');
            spinCore.addColorStop(0.5, '#FFB0FF');
            spinCore.addColorStop(1, '#9932CC');
            ctx.fillStyle = spinCore;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#6B238E';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        case 'floater':
            // Floating jellyfish-like enemy
            // Head gradient
            const floatGrad = ctx.createRadialGradient(-3, -5, 0, 0, 0, 14);
            floatGrad.addColorStop(0, '#80FFFF');
            floatGrad.addColorStop(0.5, '#00CED1');
            floatGrad.addColorStop(1, '#008B8B');
            ctx.fillStyle = floatGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 14, Math.PI, 0, false);
            ctx.quadraticCurveTo(14, 5, 10, 4);
            ctx.lineTo(-10, 4);
            ctx.quadraticCurveTo(-14, 5, -14, 0);
            ctx.fill();
            ctx.strokeStyle = '#006666';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Eyes
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(-4, -3, 3, 0, Math.PI * 2);
            ctx.arc(4, -3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-4, -2, 1.5, 0, Math.PI * 2);
            ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Tentacles - より有機的に
            for (let i = -2; i <= 2; i++) {
                const tentGrad = ctx.createLinearGradient(i * 4, 4, i * 4, 20);
                tentGrad.addColorStop(0, '#00CED1');
                tentGrad.addColorStop(1, 'rgba(0, 206, 209, 0.3)');
                ctx.strokeStyle = tentGrad;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(i * 5, 4);
                const wave1 = Math.sin(frameCount * 0.1 + i) * 4;
                const wave2 = Math.sin(frameCount * 0.15 + i * 2) * 3;
                ctx.quadraticCurveTo(i * 5 + wave1, 12, i * 5 + wave2, 20);
                ctx.stroke();
            }
            break;

        case 'bomber':
            // Large bomber enemy
            // Main body
            const bombGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 20);
            bombGrad.addColorStop(0, '#5F7F7F');
            bombGrad.addColorStop(0.5, '#3F5F5F');
            bombGrad.addColorStop(1, '#2F4F4F');
            ctx.fillStyle = bombGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1F3F3F';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Wings
            const wingGrad = ctx.createLinearGradient(-25, 0, -15, 0);
            wingGrad.addColorStop(0, '#CC4030');
            wingGrad.addColorStop(1, '#FF6347');
            ctx.fillStyle = wingGrad;
            ctx.fillRect(-25, -5, 10, 10);
            ctx.strokeStyle = '#AA3020';
            ctx.lineWidth = 1;
            ctx.strokeRect(-25, -5, 10, 10);

            ctx.fillStyle = wingGrad;
            ctx.fillRect(15, -5, 10, 10);
            ctx.strokeRect(15, -5, 10, 10);

            // Cockpit
            const cockGrad = ctx.createRadialGradient(-1, -5, 0, 0, -4, 7);
            cockGrad.addColorStop(0, '#FFFF80');
            cockGrad.addColorStop(0.5, '#FFD700');
            cockGrad.addColorStop(1, '#CC9900');
            ctx.fillStyle = cockGrad;
            ctx.beginPath();
            ctx.arc(0, -4, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#996600';
            ctx.stroke();

            // Propellers
            const propAngle = frameCount * 0.3;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20 + Math.cos(propAngle) * 6, 0);
            ctx.lineTo(-20 - Math.cos(propAngle) * 6, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(20 + Math.cos(propAngle) * 6, 0);
            ctx.lineTo(20 - Math.cos(propAngle) * 6, 0);
            ctx.stroke();
            break;
    }

    ctx.restore();
}

function drawGroundEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    // 地上の敵は遠近法で小さく表示
    const groundStartY = GAME_HEIGHT * 0.5;
    const distanceFromTop = Math.max(0, (enemy.y - groundStartY) / (GAME_HEIGHT - groundStartY));
    const scale = 0.5 + distanceFromTop * 0.3; // 0.5〜0.8のスケール
    ctx.scale(scale, scale);

    // ターゲットマーカー（地上敵の目印）
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(-20, 0);
    ctx.moveTo(20, 0);
    ctx.lineTo(35, 0);
    ctx.moveTo(0, -35);
    ctx.lineTo(0, -20);
    ctx.moveTo(0, 20);
    ctx.lineTo(0, 35);
    ctx.stroke();

    switch (enemy.type) {
        case 'turret':
            // Ground turret - より詳細に
            // Base shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 10, 14, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Base
            const baseGrad = ctx.createLinearGradient(-12, -8, 12, 8);
            baseGrad.addColorStop(0, '#7B8B3F');
            baseGrad.addColorStop(0.5, '#556B2F');
            baseGrad.addColorStop(1, '#3B4B1F');
            ctx.fillStyle = baseGrad;
            ctx.fillRect(-14, -8, 28, 18);
            ctx.strokeStyle = '#2B3B0F';
            ctx.lineWidth = 1;
            ctx.strokeRect(-14, -8, 28, 18);

            // Dome
            const domeGrad = ctx.createRadialGradient(-2, -10, 0, 0, -8, 10);
            domeGrad.addColorStop(0, '#AB7543');
            domeGrad.addColorStop(0.5, '#8B5533');
            domeGrad.addColorStop(1, '#6B3513');
            ctx.fillStyle = domeGrad;
            ctx.beginPath();
            ctx.arc(0, -8, 10, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#4B2503';
            ctx.stroke();

            // Cannon
            const cannonGrad = ctx.createLinearGradient(-4, 0, 4, 0);
            cannonGrad.addColorStop(0, '#555');
            cannonGrad.addColorStop(0.5, '#333');
            cannonGrad.addColorStop(1, '#222');
            ctx.fillStyle = cannonGrad;
            ctx.fillRect(-4, -20, 8, 14);
            ctx.strokeStyle = '#111';
            ctx.strokeRect(-4, -20, 8, 14);

            // Cannon tip
            ctx.fillStyle = '#444';
            ctx.fillRect(-5, -22, 10, 4);
            break;

        case 'tank':
            // Moving tank - より詳細に
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 12, 18, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Treads
            const treadGrad = ctx.createLinearGradient(0, 4, 0, 10);
            treadGrad.addColorStop(0, '#444');
            treadGrad.addColorStop(0.5, '#222');
            treadGrad.addColorStop(1, '#333');
            ctx.fillStyle = treadGrad;
            ctx.fillRect(-18, 2, 36, 8);

            // Tread details
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            for (let i = -16; i < 18; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i, 2);
                ctx.lineTo(i, 10);
                ctx.stroke();
            }

            // Main body
            const tankGrad = ctx.createLinearGradient(-16, -8, 16, 4);
            tankGrad.addColorStop(0, '#8BAE33');
            tankGrad.addColorStop(0.5, '#6B8E23');
            tankGrad.addColorStop(1, '#4B6E13');
            ctx.fillStyle = tankGrad;
            ctx.fillRect(-16, -6, 32, 10);
            ctx.strokeStyle = '#3B5E03';
            ctx.lineWidth = 1;
            ctx.strokeRect(-16, -6, 32, 10);

            // Turret
            const turretGrad = ctx.createRadialGradient(-2, -10, 0, 0, -8, 12);
            turretGrad.addColorStop(0, '#7B9E33');
            turretGrad.addColorStop(1, '#4B6E13');
            ctx.fillStyle = turretGrad;
            ctx.fillRect(-12, -14, 24, 10);
            ctx.strokeStyle = '#3B5E03';
            ctx.strokeRect(-12, -14, 24, 10);

            // Cannon barrel
            ctx.fillStyle = '#333';
            ctx.fillRect(-3, -22, 6, 10);
            ctx.strokeStyle = '#111';
            ctx.strokeRect(-3, -22, 6, 10);
            break;

        case 'building':
            // Building/structure - より詳細に
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.moveTo(-18, 22);
            ctx.lineTo(22, 22);
            ctx.lineTo(22, 26);
            ctx.lineTo(-18, 26);
            ctx.closePath();
            ctx.fill();

            // Main building
            const buildGrad = ctx.createLinearGradient(-18, 0, 18, 0);
            buildGrad.addColorStop(0, '#AB7553');
            buildGrad.addColorStop(0.3, '#8B5533');
            buildGrad.addColorStop(0.7, '#8B5533');
            buildGrad.addColorStop(1, '#6B3513');
            ctx.fillStyle = buildGrad;
            ctx.fillRect(-18, -22, 36, 44);
            ctx.strokeStyle = '#4B2503';
            ctx.lineWidth = 2;
            ctx.strokeRect(-18, -22, 36, 44);

            // Roof
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.moveTo(-20, -22);
            ctx.lineTo(0, -32);
            ctx.lineTo(20, -22);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#4B2503';
            ctx.stroke();

            // Windows (4 windows)
            const winGrad = ctx.createLinearGradient(0, 0, 0, 10);
            winGrad.addColorStop(0, '#87CEEB');
            winGrad.addColorStop(1, '#4682B4');
            ctx.fillStyle = winGrad;
            ctx.fillRect(-14, -16, 10, 12);
            ctx.fillRect(4, -16, 10, 12);
            ctx.fillRect(-14, 2, 10, 12);
            ctx.fillRect(4, 2, 10, 12);

            // Window frames
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            ctx.strokeRect(-14, -16, 10, 12);
            ctx.strokeRect(4, -16, 10, 12);
            ctx.strokeRect(-14, 2, 10, 12);
            ctx.strokeRect(4, 2, 10, 12);

            // Window cross
            ctx.beginPath();
            ctx.moveTo(-9, -16); ctx.lineTo(-9, -4);
            ctx.moveTo(-14, -10); ctx.lineTo(-4, -10);
            ctx.moveTo(9, -16); ctx.lineTo(9, -4);
            ctx.moveTo(4, -10); ctx.lineTo(14, -10);
            ctx.moveTo(-9, 2); ctx.lineTo(-9, 14);
            ctx.moveTo(-14, 8); ctx.lineTo(-4, 8);
            ctx.moveTo(9, 2); ctx.lineTo(9, 14);
            ctx.moveTo(4, 8); ctx.lineTo(14, 8);
            ctx.stroke();

            // Door
            ctx.fillStyle = '#4B2503';
            ctx.fillRect(-5, 10, 10, 12);
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(3, 16, 1.5, 0, Math.PI * 2);
            ctx.fill();
            break;
    }

    ctx.globalAlpha = 1;
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
    // ===== 空のレイヤー（上層） =====
    // 美しい空のグラデーション
    const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT * 0.5);
    skyGradient.addColorStop(0, '#1e90ff');    // 上部: 濃い青
    skyGradient.addColorStop(0.3, '#87CEEB');  // 中: 明るい空色
    skyGradient.addColorStop(0.7, '#B0E0E6');  // 下: 淡い水色
    skyGradient.addColorStop(1, '#E0F6FF');    // 地平線付近: ほぼ白
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55);

    // 遠くの雲（背景装飾）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 5; i++) {
        const cloudX = ((i * 80 + scrollY * 0.1) % (GAME_WIDTH + 60)) - 30;
        const cloudY = 30 + i * 25;
        drawBackgroundCloud(cloudX, cloudY, 0.5 + i * 0.1);
    }

    // ===== 地上レイヤー（下層） =====
    const groundStartY = GAME_HEIGHT * 0.5;

    // 地上のメイングラデーション（遠近感）
    const groundGradient = ctx.createLinearGradient(0, groundStartY, 0, GAME_HEIGHT);
    groundGradient.addColorStop(0, '#90EE90');   // 遠く: 明るい緑
    groundGradient.addColorStop(0.2, '#3CB371'); // 中距離
    groundGradient.addColorStop(0.5, '#228B22'); // 近い
    groundGradient.addColorStop(1, '#006400');   // 最前面: 濃い緑
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, groundStartY, GAME_WIDTH, GAME_HEIGHT - groundStartY);

    // チェッカーボード風の畑パターン
    const tileSize = 32;
    const scrollOffset = (scrollY * 0.8) % tileSize;

    for (let row = 0; row < 12; row++) {
        const y = groundStartY + row * tileSize * 0.7 + scrollOffset * 0.7;
        if (y < groundStartY - tileSize || y > GAME_HEIGHT) continue;

        // 遠近法: 遠くは小さく、近くは大きく
        const perspective = 0.5 + (row / 12) * 0.8;
        const rowTileWidth = tileSize * perspective;
        const rowOffset = (row % 2) * (rowTileWidth / 2);

        for (let col = 0; col < Math.ceil(GAME_WIDTH / rowTileWidth) + 2; col++) {
            const x = col * rowTileWidth + rowOffset - rowTileWidth;

            // 交互に色を変える
            if ((col + row) % 2 === 0) {
                ctx.fillStyle = `rgba(50, 205, 50, ${0.3 + row * 0.05})`;
            } else {
                ctx.fillStyle = `rgba(34, 139, 34, ${0.3 + row * 0.05})`;
            }
            ctx.fillRect(x, y, rowTileWidth - 1, tileSize * 0.7 * perspective - 1);
        }
    }

    // 川（蛇行）
    drawRiver(groundStartY);

    // 道路
    drawRoad(groundStartY);

    // 森/木々のクラスター
    drawTrees(groundStartY);

    // 建物のシルエット（遠景）
    drawDistantBuildings(groundStartY);

    // 地上と空中の境界線（霞み効果）
    const hazeGradient = ctx.createLinearGradient(0, groundStartY - 20, 0, groundStartY + 30);
    hazeGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    hazeGradient.addColorStop(0.5, 'rgba(200, 230, 200, 0.4)');
    hazeGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = hazeGradient;
    ctx.fillRect(0, groundStartY - 20, GAME_WIDTH, 50);
}

function drawBackgroundCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.arc(25, 5, 25, 0, Math.PI * 2);
    ctx.arc(50, 0, 20, 0, Math.PI * 2);
    ctx.arc(15, -10, 15, 0, Math.PI * 2);
    ctx.arc(35, -8, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawRiver(groundStartY) {
    const riverY = groundStartY + 80 + ((scrollY * 0.5) % 150);

    // 川の影
    ctx.fillStyle = 'rgba(0, 50, 100, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-10, riverY + 5);
    for (let x = 0; x <= GAME_WIDTH + 20; x += 15) {
        const wave = Math.sin((x + scrollY * 0.5) * 0.03) * 12;
        ctx.lineTo(x, riverY + wave + 5);
    }
    ctx.lineTo(GAME_WIDTH + 10, riverY + 35);
    ctx.lineTo(-10, riverY + 35);
    ctx.closePath();
    ctx.fill();

    // 川本体
    const riverGradient = ctx.createLinearGradient(0, riverY, 0, riverY + 25);
    riverGradient.addColorStop(0, '#4169E1');
    riverGradient.addColorStop(0.5, '#1E90FF');
    riverGradient.addColorStop(1, '#4169E1');
    ctx.fillStyle = riverGradient;

    ctx.beginPath();
    ctx.moveTo(-10, riverY);
    for (let x = 0; x <= GAME_WIDTH + 20; x += 15) {
        const wave = Math.sin((x + scrollY * 0.5) * 0.03) * 12;
        ctx.lineTo(x, riverY + wave);
    }
    ctx.lineTo(GAME_WIDTH + 10, riverY + 25);
    ctx.lineTo(-10, riverY + 25);
    ctx.closePath();
    ctx.fill();

    // 水面のハイライト
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const waveX = ((scrollY * 2 + i * 100) % (GAME_WIDTH + 50)) - 25;
        ctx.beginPath();
        ctx.moveTo(waveX, riverY + 8 + i * 5);
        ctx.lineTo(waveX + 20, riverY + 8 + i * 5);
        ctx.stroke();
    }
}

function drawRoad(groundStartY) {
    const roadY = groundStartY + 180 + ((scrollY * 0.6) % 200);

    // 道路の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(-10, roadY + 3, GAME_WIDTH + 20, 24);

    // 道路本体
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(-10, roadY, GAME_WIDTH + 20, 20);

    // 道路の境界線
    ctx.fillStyle = '#6B5344';
    ctx.fillRect(-10, roadY, GAME_WIDTH + 20, 3);
    ctx.fillRect(-10, roadY + 17, GAME_WIDTH + 20, 3);

    // 中央線（点線）
    ctx.fillStyle = '#FFD700';
    for (let x = -20 + ((scrollY * 2) % 40); x < GAME_WIDTH + 20; x += 40) {
        ctx.fillRect(x, roadY + 9, 20, 2);
    }
}

function drawTrees(groundStartY) {
    // 木のクラスターを描画
    const treePositions = [
        { x: 20, offset: 0 },
        { x: 80, offset: 50 },
        { x: 150, offset: 100 },
        { x: 220, offset: 30 },
        { x: 280, offset: 80 }
    ];

    for (const tree of treePositions) {
        const treeY = groundStartY + 40 + ((scrollY * 0.4 + tree.offset) % 120);
        if (treeY > groundStartY + 20 && treeY < GAME_HEIGHT - 30) {
            drawTree(tree.x, treeY);
        }
    }
}

function drawTree(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // 木の影
    ctx.fillStyle = 'rgba(0, 50, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 12, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 幹
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-3, 0, 6, 12);

    // 葉（複数の円で）
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(0, -8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#32CD32';
    ctx.beginPath();
    ctx.arc(-5, -5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -6, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3CB371';
    ctx.beginPath();
    ctx.arc(0, -12, 7, 0, Math.PI * 2);
    ctx.fill();

    // ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(-3, -10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawDistantBuildings(groundStartY) {
    // 遠景の建物シルエット
    const buildingData = [
        { x: 50, width: 25, height: 30 },
        { x: 130, width: 20, height: 25 },
        { x: 200, width: 30, height: 35 },
        { x: 270, width: 22, height: 28 }
    ];

    ctx.fillStyle = 'rgba(100, 120, 100, 0.3)';
    for (const b of buildingData) {
        const bY = groundStartY + 10 + ((scrollY * 0.2) % 60);
        if (bY > groundStartY && bY < groundStartY + 50) {
            ctx.fillRect(b.x, bY - b.height, b.width, b.height);
            // 窓
            ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
            for (let wy = 0; wy < 3; wy++) {
                for (let wx = 0; wx < 2; wx++) {
                    ctx.fillRect(b.x + 4 + wx * 10, bY - b.height + 5 + wy * 8, 5, 4);
                }
            }
            ctx.fillStyle = 'rgba(100, 120, 100, 0.3)';
        }
    }
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
    // 序盤は敵の出現率を下げる
    const spawnRate = 0.008 + stage * 0.004;
    if (Math.random() < spawnRate) {
        // 序盤はbomberを出さない
        let types = ['bee', 'spinner', 'floater'];
        if (stage >= 3) {
            types.push('bomber');
        }
        const type = types[Math.floor(Math.random() * types.length)];

        let health = 1;
        let points = 100;
        let shootInterval = 0;

        // ステージに応じて弾の発射間隔を短くする（序盤は長め）
        const difficultyMod = Math.max(1, 5 - stage * 0.5); // stage1=4.5, stage5=2.5, stage10=0

        switch (type) {
            case 'bee':
                health = 1;
                points = 100;
                // 序盤: 540フレーム(9秒)ごと、後半: 120フレーム(2秒)ごと
                shootInterval = Math.floor(120 * difficultyMod);
                break;
            case 'spinner':
                health = 2;
                points = 200;
                // spinnerは弾を撃たない
                shootInterval = 0;
                break;
            case 'floater':
                health = 1;
                points = 150;
                shootInterval = Math.floor(90 * difficultyMod);
                break;
            case 'bomber':
                health = 4;
                points = 500;
                shootInterval = Math.floor(60 * difficultyMod);
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
    if (Math.random() < 0.006 + stage * 0.002) {
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

        // 地上敵は画面下半分（地上エリア）の上端から出現
        // 画面の50%〜55%の位置（地上エリアの開始地点付近）
        const groundStartY = GAME_HEIGHT * 0.5;

        groundEnemies.push({
            x: Math.random() * (GAME_WIDTH - 40) + 20,
            y: groundStartY - 40,  // 地上エリアの少し上から出現
            width: 32,
            height: 32,
            type,
            health,
            points,
            vx: type === 'tank' ? (Math.random() - 0.5) * 1 : 0,
            isGround: true  // 地上敵フラグ
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

    // Draw ground enemies (地上レイヤーに埋め込む感じ)
    // 地上エリアの境界線を示す薄い線
    const groundStartY = GAME_HEIGHT * 0.5;
    ctx.strokeStyle = 'rgba(0, 100, 0, 0.3)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, groundStartY);
    ctx.lineTo(GAME_WIDTH, groundStartY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 地上敵を描画（地上エリア内のみ表示）
    groundEnemies.forEach(e => {
        if (e.y >= groundStartY - 20) {
            drawGroundEnemy(e);
        }
    });

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
