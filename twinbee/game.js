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
let gameCleared = false;
let score = 0;
let lives = 3;
let stage = 1;
let frameCount = 0;
let scrollY = 0;
let stageFrameCount = 0;
const BOSS_SPAWN_TIME = 1800; // 30秒でボス出現
const MAX_STAGE = 5;

// Boss
let boss = null;
let bossDefeated = false;
let stageClearTimer = 0;

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
    shotLevel: 3,      // 1=single, 2=double, 3=spread (初期は3)
    hasShield: false,
    speedUp: 0,
    options: [],       // trailing options
    armLeft: true,     // arms can be shot off
    armRight: true,
    invincible: 0
};

// Bullets
let playerBullets = [];
let enemyBullets = [];

// Bells and clouds
let bells = [];
let clouds = [];

// Enemies
let airEnemies = [];

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

    // Cloud gradient（明るい白い雲）
    const cloudGrad = ctx.createRadialGradient(0, -5, 0, 0, 5, 30);
    cloudGrad.addColorStop(0, '#FFFFFF');
    cloudGrad.addColorStop(0.5, '#F5F5F5');
    cloudGrad.addColorStop(1, '#E0E0E0');

    ctx.fillStyle = cloudGrad;

    // Fluffy cloud shape
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

    // 鈴がある場合はキラキラエフェクト
    if (cloud.hasBell && frameCount % 20 < 10) {
        ctx.fillStyle = 'rgba(255, 255, 100, 0.8)';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
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

function drawBackground() {
    // ===== 全画面が空 =====
    // 美しい空のグラデーション（上から下へ）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGradient.addColorStop(0, '#0066CC');    // 上部: 濃い青
    skyGradient.addColorStop(0.3, '#1E90FF');  //
    skyGradient.addColorStop(0.5, '#87CEEB');  // 中: 明るい空色
    skyGradient.addColorStop(0.7, '#B0E0E6');  // 下: 淡い水色
    skyGradient.addColorStop(1, '#E0F6FF');    // 最下部: ほぼ白
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 背景の雲（複数レイヤーで奥行き感）
    // 遠くの雲（小さく、ゆっくり）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 4; i++) {
        const cloudX = ((i * 100 + scrollY * 0.05) % (GAME_WIDTH + 80)) - 40;
        const cloudY = 50 + i * 40;
        drawBackgroundCloud(cloudX, cloudY, 0.4);
    }

    // 中間の雲
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 5; i++) {
        const cloudX = ((i * 80 + scrollY * 0.1 + 30) % (GAME_WIDTH + 100)) - 50;
        const cloudY = 120 + i * 60;
        drawBackgroundCloud(cloudX, cloudY, 0.6);
    }

    // 近くの雲（大きく、速く）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 3; i++) {
        const cloudX = ((i * 120 + scrollY * 0.2 + 60) % (GAME_WIDTH + 120)) - 60;
        const cloudY = 280 + i * 80;
        drawBackgroundCloud(cloudX, cloudY, 0.8);
    }

    // 太陽（右上に配置）
    const sunX = GAME_WIDTH - 50;
    const sunY = 60;

    // 太陽のグロー
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60);
    sunGlow.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
    sunGlow.addColorStop(0.3, 'rgba(255, 255, 100, 0.3)');
    sunGlow.addColorStop(1, 'rgba(255, 255, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 60, 0, Math.PI * 2);
    ctx.fill();

    // 太陽本体
    const sunGrad = ctx.createRadialGradient(sunX - 5, sunY - 5, 0, sunX, sunY, 25);
    sunGrad.addColorStop(0, '#FFFFEE');
    sunGrad.addColorStop(0.5, '#FFFF00');
    sunGrad.addColorStop(1, '#FFD700');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 25, 0, Math.PI * 2);
    ctx.fill();
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

// =====================================================
// GAME LOGIC
// =====================================================

function spawnCloud() {
    // 雲の出現率を下げる（画面内に2-3個程度）
    if (Math.random() < 0.008) {
        clouds.push({
            x: Math.random() * (GAME_WIDTH - 60) + 30,
            y: -40,
            width: 40,
            height: 30,
            hasBell: true,  // 全ての雲に鈴がある
            hits: 0
        });
    }
}

function spawnAirEnemy() {
    // 敵の出現率を大幅に下げる（序盤は特に少なく）
    const spawnRate = 0.004 + stage * 0.002;
    if (Math.random() < spawnRate) {
        // 序盤はbomberを出さない（ステージ4から）
        let types = ['bee', 'spinner', 'floater'];
        if (stage >= 4) {
            types.push('bomber');
        }
        const type = types[Math.floor(Math.random() * types.length)];

        let health = 1;
        let points = 100;
        let shootInterval = 0;

        // ステージに応じて弾の発射間隔を短くする（序盤はかなり長め）
        const difficultyMod = Math.max(1.5, 6 - stage * 0.5); // stage1=5.5, stage5=3.5, stage10=1.5

        switch (type) {
            case 'bee':
                health = 1;
                points = 100;
                // 序盤: 660フレーム(11秒)ごと、後半: 180フレーム(3秒)ごと
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
                shootInterval = Math.floor(100 * difficultyMod);
                break;
            case 'bomber':
                health = 4;
                points = 500;
                shootInterval = Math.floor(80 * difficultyMod);
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

    // ショットレベルを下げる（3→2→1→ダメージ）
    if (player.shotLevel > 1) {
        player.shotLevel--;
        player.invincible = 60;
        playHit();
        createParticles(player.x, player.y, '#FF6B6B', 8);
        return;
    }

    // Randomly lose an arm
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
    player.shotLevel = 3;  // 初期は3方向発射
    player.hasShield = false;
    player.speedUp = 0;
    player.speed = 4;
    player.options = [];
    player.armLeft = true;
    player.armRight = true;
}

function checkCollisions() {
    // Player bullets vs clouds（鈴がある雲のみ当たり判定）
    playerBullets.forEach(bullet => {
        clouds.forEach(cloud => {
            // 鈴がない雲は弾が貫通する
            if (!cloud.hasBell) return;

            if (rectCollision(bullet, cloud)) {
                bullet.hit = true;
                cloud.hits++;

                if (cloud.hits >= 3) {
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

// =====================================================
// BOSS SYSTEM
// =====================================================

function spawnBoss() {
    const bossHealth = 30 + stage * 20; // ステージごとに強くなる
    boss = {
        x: GAME_WIDTH / 2,
        y: -60,
        targetY: 80,
        width: 80,
        height: 60,
        health: bossHealth,
        maxHealth: bossHealth,
        phase: 0,
        timer: 0,
        moveDir: 1,
        type: stage // ステージごとに違うボス
    };
    bossDefeated = false;
}

function updateBoss() {
    if (!boss) return;

    // 登場演出
    if (boss.y < boss.targetY) {
        boss.y += 1;
        return;
    }

    boss.timer++;

    // 左右移動
    boss.x += boss.moveDir * (1 + stage * 0.3);
    if (boss.x > GAME_WIDTH - 50) boss.moveDir = -1;
    if (boss.x < 50) boss.moveDir = 1;

    // 攻撃パターン（ステージによって変化）
    const shootInterval = Math.max(30, 60 - stage * 8);

    if (boss.timer % shootInterval === 0) {
        // 基本弾
        enemyBullets.push({
            x: boss.x,
            y: boss.y + 30,
            width: 8,
            height: 8,
            vx: 0,
            vy: 3 + stage * 0.5
        });
    }

    // ステージ2以上: 斜め弾追加
    if (stage >= 2 && boss.timer % (shootInterval * 2) === 0) {
        enemyBullets.push({
            x: boss.x - 20,
            y: boss.y + 20,
            width: 6,
            height: 6,
            vx: -1.5,
            vy: 3
        });
        enemyBullets.push({
            x: boss.x + 20,
            y: boss.y + 20,
            width: 6,
            height: 6,
            vx: 1.5,
            vy: 3
        });
    }

    // ステージ3以上: 狙い撃ち
    if (stage >= 3 && boss.timer % (shootInterval * 3) === 0) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 4;
        enemyBullets.push({
            x: boss.x,
            y: boss.y + 30,
            width: 10,
            height: 10,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed
        });
    }

    // ステージ4以上: 円形弾幕
    if (stage >= 4 && boss.timer % 120 === 0) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            enemyBullets.push({
                x: boss.x,
                y: boss.y,
                width: 6,
                height: 6,
                vx: Math.cos(angle) * 2,
                vy: Math.sin(angle) * 2
            });
        }
    }

    // ステージ5: より激しい攻撃
    if (stage >= 5 && boss.timer % 90 === 0) {
        for (let i = -2; i <= 2; i++) {
            enemyBullets.push({
                x: boss.x + i * 15,
                y: boss.y + 30,
                width: 6,
                height: 6,
                vx: i * 0.5,
                vy: 4
            });
        }
    }
}

function checkBossCollision() {
    if (!boss) return;

    // プレイヤー弾 vs ボス
    for (var i = 0; i < playerBullets.length; i++) {
        if (!boss) break;  // ボスが倒されたらループ終了
        var bullet = playerBullets[i];
        if (rectCollision(bullet, boss)) {
            bullet.hit = true;
            boss.health--;
            createExplosion(bullet.x, bullet.y, 8);

            if (boss.health <= 0) {
                // ボス撃破
                bossDefeated = true;
                score += 5000 * stage;
                var bx = boss.x;
                var by = boss.y;
                createExplosion(bx, by, 60);
                createExplosion(bx - 20, by - 10, 40);
                createExplosion(bx + 20, by + 10, 40);
                playExplosion();
                boss = null;
                stageClearTimer = 120; // 2秒後にステージクリア
                break;
            }
        }
    }

    // プレイヤー vs ボス（体当たり）
    if (boss && rectCollision(player, boss)) {
        playerHit();
    }
}

function drawBoss() {
    if (!boss) return;

    ctx.save();
    ctx.translate(boss.x, boss.y);

    // ボスの体（ステージで色が変わる）
    var bossColors = ['#8B0000', '#4B0082', '#006400', '#8B4513', '#2F4F4F'];
    var bodyColor = bossColors[(boss.type - 1) % bossColors.length];

    // 影（ellipseの代わりにscale+arcを使用）
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.save();
    ctx.translate(5, 40);
    ctx.scale(35/15, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    // メインボディ
    var bodyGrad = ctx.createRadialGradient(-10, -10, 0, 0, 0, 50);
    bodyGrad.addColorStop(0, '#666');
    bodyGrad.addColorStop(0.5, bodyColor);
    bodyGrad.addColorStop(1, '#000');
    ctx.fillStyle = bodyGrad;

    ctx.save();
    ctx.scale(40/30, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    // キャノピー（コクピット）
    ctx.fillStyle = '#333';
    ctx.save();
    ctx.translate(0, -5);
    ctx.scale(20/15, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    var canopyGrad = ctx.createRadialGradient(-5, -10, 0, 0, -5, 15);
    canopyGrad.addColorStop(0, '#87CEEB');
    canopyGrad.addColorStop(0.5, '#4169E1');
    canopyGrad.addColorStop(1, '#000080');
    ctx.fillStyle = canopyGrad;
    ctx.save();
    ctx.translate(0, -5);
    ctx.scale(15/10, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();

    // 左右のウイング
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(-50, 20);
    ctx.lineTo(-30, 15);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(50, 20);
    ctx.lineTo(30, 15);
    ctx.closePath();
    ctx.fill();

    // 砲台
    ctx.fillStyle = '#444';
    ctx.fillRect(-8, 20, 16, 15);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, 35, 6, 0, Math.PI * 2);
    ctx.fill();

    // ダメージエフェクト
    var healthRatio = boss.health / boss.maxHealth;
    if (healthRatio < 0.5) {
        // 煙
        if (frameCount % 10 < 5) {
            ctx.fillStyle = 'rgba(100,100,100,0.5)';
            ctx.beginPath();
            ctx.arc(-15 + Math.random() * 10, -10, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    if (healthRatio < 0.25) {
        // 火花
        if (frameCount % 5 < 3) {
            ctx.fillStyle = '#FF4500';
            ctx.beginPath();
            ctx.arc(15 + Math.random() * 10, 5, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();

    // HPバー
    var barWidth = 100;
    var barHeight = 8;
    var barX = GAME_WIDTH / 2 - barWidth / 2;
    var barY = 25;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
    ctx.fillStyle = '#400';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = healthRatio > 0.25 ? '#F00' : '#FF4500';
    ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);

    // BOSS表示
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', GAME_WIDTH / 2, barY - 5);
}

function nextStage() {
    stage++;
    stageFrameCount = 0;
    bossDefeated = false;

    // 敵弾をクリア
    enemyBullets = [];
    airEnemies = [];

    // スコアボーナス
    score += 1000 * (stage - 1);

    document.getElementById('stage').textContent = stage;
}

function showStageClear() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, GAME_HEIGHT / 2 - 50, GAME_WIDTH, 100);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STAGE ' + stage + ' CLEAR!', GAME_WIDTH / 2, GAME_HEIGHT / 2);

    ctx.fillStyle = '#FFF';
    ctx.font = '14px monospace';
    ctx.fillText('BONUS: ' + (1000 * stage) + ' pts', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25);
}

function showGameClear() {
    ctx.fillStyle = 'rgba(0, 0, 50, 0.8)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONGRATULATIONS!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('ALL STAGES CLEAR!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

    ctx.font = '16px monospace';
    ctx.fillText('FINAL SCORE', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(score.toString().padStart(8, '0'), GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);

    ctx.fillStyle = '#FFF';
    ctx.font = '14px monospace';
    ctx.fillText('TAP TO PLAY AGAIN', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
}

function update() {
    if (gamePaused || gameOver || gameCleared) return;

    frameCount++;
    stageFrameCount++;
    scrollY += SCROLL_SPEED;

    // ステージクリア処理
    if (stageClearTimer > 0) {
        stageClearTimer--;
        if (stageClearTimer === 0) {
            if (stage >= MAX_STAGE) {
                // ゲームクリア
                gameCleared = true;
                stopBGM();
            } else {
                nextStage();
            }
        }
        return;
    }

    // ボス出現チェック
    if (!boss && !bossDefeated && stageFrameCount >= BOSS_SPAWN_TIME) {
        spawnBoss();
    }

    // ボス更新
    updateBoss();

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

        // Bounce at bottom of screen
        if (b.y > GAME_HEIGHT - 30) {
            b.y = GAME_HEIGHT - 30;
            b.vy = -2;
        }
    });
    // 画面下に出た鈴のみ消す（上に出ても残す）
    bells = bells.filter(b => b.y < GAME_HEIGHT + 30);

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

    // Spawn new objects (ボス出現中は雑魚敵を減らす)
    spawnCloud();
    if (!boss) {
        spawnAirEnemy();
    }

    // Check collisions
    checkCollisions();
    checkBossCollision();

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

    // Draw boss
    drawBoss();

    // Draw options
    player.options.forEach(opt => drawOption(opt.x, opt.y));

    // Draw player
    if (!gameOver && !gameCleared) {
        drawTwinBee(player.x, player.y, player.invincible);
    }

    // Draw explosions
    explosions.forEach(exp => drawExplosion(exp));

    // Draw particles
    particles.forEach(p => drawParticle(p));

    // Stage clear overlay
    if (stageClearTimer > 0 && !gameCleared) {
        showStageClear();
    }

    // Game clear overlay
    if (gameCleared) {
        showGameClear();
    }

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
    gameCleared = false;
    gamePaused = false;
    score = 0;
    lives = 3;
    stage = 1;
    frameCount = 0;
    stageFrameCount = 0;
    scrollY = 0;

    // ボス関連の初期化
    boss = null;
    bossDefeated = false;
    stageClearTimer = 0;

    resetPlayer();

    playerBullets = [];
    enemyBullets = [];
    bells = [];
    clouds = [];
    airEnemies = [];
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

// ゲームクリア画面タップでリスタート
canvas.addEventListener('click', function() {
    if (gameCleared) {
        startGame();
    }
});

canvas.addEventListener('touchstart', function(e) {
    if (gameCleared) {
        e.preventDefault();
        startGame();
    }
}, { passive: false });

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

// Touch controls - Analog joystick (Safari compatible)
let joystickActive = false;
let joystickTouchId = null;

function setupTouchControls() {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    const btnShot = document.getElementById('btn-shot');

    if (!joystick || !knob) {
        return;
    }

    const maxDistance = 35;
    let touchStartX = 0;
    let touchStartY = 0;

    function updateJoystick(touchX, touchY) {
        // タッチ開始位置からの相対移動で方向を決定
        var dx = touchX - touchStartX;
        var dy = touchY - touchStartY;
        var distance = Math.sqrt(dx * dx + dy * dy);

        // 最大距離でクランプ
        if (distance > maxDistance) {
            dx = (dx / distance) * maxDistance;
            dy = (dy / distance) * maxDistance;
        }

        // ノブの位置を更新（中心からのオフセット、maxDistanceで正規化）
        var offsetPercent = 35; // ノブの最大移動量(%)
        knob.style.transform = 'translate(' + (-50 + (dx / maxDistance) * offsetPercent) + '%, ' + (-50 + (dy / maxDistance) * offsetPercent) + '%)';

        // 方向キーの状態を更新（デッドゾーン付き）
        var deadzone = 8;
        keys.left = dx < -deadzone;
        keys.right = dx > deadzone;
        keys.up = dy < -deadzone;
        keys.down = dy > deadzone;
    }

    function resetJoystick() {
        knob.style.transform = 'translate(-50%, -50%)';
        keys.left = false;
        keys.right = false;
        keys.up = false;
        keys.down = false;
        joystickActive = false;
        joystickTouchId = null;
        touchStartX = 0;
        touchStartY = 0;
    }

    // Touch start on joystick
    joystick.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // このイベントで開始されたタッチのみを処理
        if (e.changedTouches.length > 0 && joystickTouchId === null) {
            var touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            joystickActive = true;
            // タッチ開始位置を記憶（この位置が中心になる）
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            // タッチ開始時点で即座に更新（タップだけでも反応するように）
            updateJoystick(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    // Safari対応: documentレベルでtouchmoveを監視
    document.addEventListener('touchmove', function(e) {
        if (!joystickActive || joystickTouchId === null) return;

        // すべてのタッチから該当するIDを探す
        for (var i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joystickTouchId) {
                updateJoystick(e.touches[i].clientX, e.touches[i].clientY);
                return;
            }
        }
    }, { passive: false });

    // Safari対応: documentレベルでtouchendを監視
    document.addEventListener('touchend', function(e) {
        if (joystickTouchId === null) return;

        for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                resetJoystick();
                return;
            }
        }
    }, { passive: false });

    document.addEventListener('touchcancel', function(e) {
        if (joystickTouchId === null) return;

        for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                resetJoystick();
                return;
            }
        }
    }, { passive: false });

    // Shot button - 完全に独立したタッチ処理
    if (btnShot) {
        btnShot.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            keys.shot = true;
            btnShot.classList.add('active');
        }, { passive: false });

        btnShot.addEventListener('touchmove', function(e) {
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });

        btnShot.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            keys.shot = false;
            btnShot.classList.remove('active');
        }, { passive: false });

        btnShot.addEventListener('touchcancel', function(e) {
            e.stopPropagation();
            keys.shot = false;
            btnShot.classList.remove('active');
        }, { passive: false });
    }
}

// Initialize
setupTouchControls();
gameLoop();
