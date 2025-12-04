// ========================
// PUYO PUYO 2D - CUTE VERSION
// ========================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// Game constants
const COLS = 6;
const ROWS = 12;
const HIDDEN_ROWS = 1;

// Cute pastel colors - distinguishable! (coral, mint, skyblue, lemon, grape)
const COLORS = ['#FF7F7F', '#B5EAD7', '#A7C7E7', '#FFF0B3', '#B19CD9'];
const COLOR_NAMES = ['coral', 'mint', 'skyblue', 'lemon', 'grape'];

// Game state
let board = [];
let currentPuyo = null;
let nextPuyo = null;
let score = 0;
let chains = 0;
let maxChains = 0;
let level = 1;
let gameOver = false;
let paused = false;
let animating = false;
let lastDrop = 0;
let dropInterval = 1000;
let cellSize = 40;
let boardOffsetX = 0;
let boardOffsetY = 0;

// Audio
let audioCtx = null;
let masterGain = null;
let musicGain = null;
let musicEnabled = true;
let musicPlayer = null;

// ========================
// CANVAS SETUP
// ========================

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;

    // Calculate cell size based on available space
    const availableWidth = maxWidth * 0.5;
    const availableHeight = maxHeight * 0.85;

    cellSize = Math.min(
        Math.floor(availableWidth / COLS),
        Math.floor(availableHeight / ROWS),
        50
    );

    canvas.width = maxWidth;
    canvas.height = maxHeight;

    // Center the board
    boardOffsetX = (canvas.width - COLS * cellSize) / 2;
    boardOffsetY = (canvas.height - ROWS * cellSize) / 2;

    render();
}

window.addEventListener('resize', resizeCanvas);

// ========================
// AUDIO INITIALIZATION
// ========================

function initAudio() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.4;
    musicGain.connect(masterGain);

    // Resume audio context on user interaction (for iOS)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(freq, duration, type = 'sine') {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// ========================
// PERFUME-STYLE MUSIC
// ========================

class PerfumeMusicPlayer {
    constructor(audioCtx, masterGain) {
        this.audioCtx = audioCtx;
        this.masterGain = masterGain;
        this.isPlaying = false;
        this.nodes = [];
        this.timeouts = [];
        this.currentBeat = 0;
        this.bpm = 128;
        this.beatLength = 60 / this.bpm;
        this.setupEffects();
    }

    setupEffects() {
        this.compressor = this.audioCtx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;

        this.filter = this.audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 8000;
        this.filter.Q.value = 1;

        this.delay = this.audioCtx.createDelay();
        this.delay.delayTime.value = this.beatLength * 0.75;
        this.delayGain = this.audioCtx.createGain();
        this.delayGain.gain.value = 0.2;

        this.delay.connect(this.delayGain);
        this.delayGain.connect(this.delay);
        this.delayGain.connect(this.compressor);

        this.filter.connect(this.compressor);
        this.compressor.connect(this.masterGain);
    }

    noteToFreq(note, octave) {
        const notes = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
        return 440 * Math.pow(2, (notes[note] - 9) / 12 + (octave - 4));
    }

    playSupersaw(freq, duration, volume = 0.08) {
        if (!this.isPlaying) return;
        const startTime = this.audioCtx.currentTime;
        const detunes = [-12, -7, -3, 0, 3, 7, 12];

        detunes.forEach(detune => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.detune.value = detune;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume / detunes.length, startTime + 0.02);
            gain.gain.setValueAtTime(volume / detunes.length * 0.7, startTime + 0.1);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc.connect(gain);
            gain.connect(this.filter);

            osc.start(startTime);
            osc.stop(startTime + duration);
            this.nodes.push({ osc, gain });
        });
    }

    playPluck(freq, duration, volume = 0.12) {
        if (!this.isPlaying) return;
        const startTime = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc2.type = 'square';
        osc2.frequency.value = freq * 2;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(5000, startTime);
        filter.frequency.exponentialRampToValueAtTime(500, startTime + duration * 0.5);
        filter.Q.value = 5;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.delay);
        gain.connect(this.filter);

        osc.start(startTime);
        osc.stop(startTime + duration);
        osc2.start(startTime);
        osc2.stop(startTime + duration);
        this.nodes.push({ osc, gain });
    }

    playVocoderPad(freqs, duration, volume = 0.06) {
        if (!this.isPlaying) return;
        const startTime = this.audioCtx.currentTime;

        freqs.forEach(freq => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            filter.type = 'bandpass';
            filter.frequency.value = freq * 2;
            filter.Q.value = 8;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume / freqs.length, startTime + 0.3);
            gain.gain.setValueAtTime(volume / freqs.length, startTime + duration - 0.3);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.filter);

            osc.start(startTime);
            osc.stop(startTime + duration);
            this.nodes.push({ osc, gain });
        });
    }

    playKick() {
        if (!this.isPlaying) return;
        const startTime = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, startTime);
        osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);

        gain.gain.setValueAtTime(0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        osc.connect(gain);
        gain.connect(this.compressor);

        osc.start(startTime);
        osc.stop(startTime + 0.3);

        this.filter.frequency.setValueAtTime(2000, startTime);
        this.filter.frequency.linearRampToValueAtTime(8000, startTime + this.beatLength * 0.8);

        this.nodes.push({ osc, gain });
    }

    playSnare() {
        if (!this.isPlaying) return;
        const startTime = this.audioCtx.currentTime;

        const osc = this.audioCtx.createOscillator();
        const oscGain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, startTime);
        osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.1);
        oscGain.gain.setValueAtTime(0.3, startTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
        osc.connect(oscGain);
        oscGain.connect(this.compressor);
        osc.start(startTime);
        osc.stop(startTime + 0.1);

        const bufferSize = this.audioCtx.sampleRate * 0.15;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioCtx.createBufferSource();
        const noiseGain = this.audioCtx.createGain();
        const noiseFilter = this.audioCtx.createBiquadFilter();

        noise.buffer = buffer;
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 3000;
        noiseGain.gain.setValueAtTime(0.25, startTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.compressor);
        noise.start(startTime);

        this.nodes.push({ osc, gain: oscGain });
    }

    playHihat(open = false) {
        if (!this.isPlaying) return;
        const startTime = this.audioCtx.currentTime;
        const duration = open ? 0.2 : 0.05;

        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        gain.gain.setValueAtTime(open ? 0.1 : 0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);
        noise.start(startTime);
    }

    playChords(beat) {
        const section = Math.floor(beat / 32) % 2;
        const chordIndex = Math.floor(beat / 8) % 4;

        const progressions = [
            [
                [['A', 4], ['C#', 5], ['E', 5]],
                [['F#', 4], ['A', 4], ['C#', 5]],
                [['D', 4], ['F#', 4], ['A', 4]],
                [['E', 4], ['G#', 4], ['B', 4]],
            ],
            [
                [['C#', 4], ['E', 4], ['G#', 4]],
                [['A', 4], ['C#', 5], ['E', 5]],
                [['B', 4], ['D#', 5], ['F#', 5]],
                [['E', 4], ['G#', 4], ['B', 4]],
            ]
        ];

        const chord = progressions[section][chordIndex];
        const beatInChord = beat % 8;

        if (beatInChord === 0) {
            const freqs = chord.map(([note, oct]) => this.noteToFreq(note, oct));
            this.playVocoderPad(freqs, this.beatLength * 7.5, 0.05);
        }

        if (beatInChord === 0 || beatInChord === 4) {
            const [note, oct] = chord[0];
            this.playSupersaw(this.noteToFreq(note, oct), this.beatLength * 0.5, 0.1);
        }
    }

    playArpeggio(beat) {
        const chordIndex = Math.floor(beat / 8) % 4;

        const progressions = [
            [['A', 5], ['C#', 6], ['E', 6], ['A', 6]],
            [['F#', 5], ['A', 5], ['C#', 6], ['F#', 6]],
            [['D', 5], ['F#', 5], ['A', 5], ['D', 6]],
            [['E', 5], ['G#', 5], ['B', 5], ['E', 6]],
        ];

        const arpNotes = progressions[chordIndex];
        const noteIndex = beat % 4;
        const [note, oct] = arpNotes[noteIndex];

        const subBeat = beat % 8;
        const pattern = [1, 0, 1, 1, 0, 1, 1, 0];

        if (pattern[subBeat]) {
            this.playPluck(this.noteToFreq(note, oct), this.beatLength * 0.3, 0.1);
        }
    }

    playLead(beat) {
        const bar = Math.floor(beat / 16) % 4;
        const beatInBar = beat % 16;

        const melodies = [
            { 0: ['E', 5], 2: ['F#', 5], 4: ['G#', 5], 6: ['A', 5], 8: ['B', 5], 12: ['A', 5] },
            { 0: ['C#', 6], 4: ['B', 5], 8: ['A', 5], 10: ['G#', 5], 12: ['F#', 5], 14: ['E', 5] },
            { 0: ['A', 5], 2: ['A', 5], 4: ['B', 5], 6: ['C#', 6], 8: ['B', 5], 12: ['A', 5] },
            { 0: ['E', 5], 4: ['G#', 5], 6: ['A', 5], 8: ['E', 5], 12: ['E', 5], 14: ['E', 5] },
        ];

        const melody = melodies[bar];
        if (melody[beatInBar]) {
            const [note, oct] = melody[beatInBar];
            this.playSupersaw(this.noteToFreq(note, oct), this.beatLength * 1.5, 0.08);
        }
    }

    playBass(beat) {
        const chordIndex = Math.floor(beat / 8) % 4;
        const bassNotes = [['A', 2], ['F#', 2], ['D', 2], ['E', 2]];
        const [note, oct] = bassNotes[chordIndex];

        const beatInChord = beat % 8;
        if (beatInChord === 0 || beatInChord === 4 || beatInChord === 6) {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const startTime = this.audioCtx.currentTime;

            osc.type = 'sine';
            osc.frequency.value = this.noteToFreq(note, oct);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.setValueAtTime(0.2, startTime + this.beatLength * 0.5);
            gain.gain.linearRampToValueAtTime(0, startTime + this.beatLength * 1.5);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(startTime);
            osc.stop(startTime + this.beatLength * 1.5);
            this.nodes.push({ osc, gain });
        }
    }

    playDrums(beat) {
        const pattern = beat % 16;

        if (pattern % 4 === 0) {
            this.playKick();
        }

        if (pattern === 4 || pattern === 12) {
            this.playSnare();
        }

        const hihatPattern = [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1];
        if (hihatPattern[pattern]) {
            this.playHihat(pattern === 7 || pattern === 15);
        }
    }

    scheduleNextBeat() {
        if (!this.isPlaying) return;

        const beat = this.currentBeat;

        this.playDrums(beat);
        this.playBass(beat);
        this.playChords(beat);
        this.playArpeggio(beat);

        if (beat >= 32) {
            this.playLead(beat);
        }

        this.currentBeat++;

        const timeout = setTimeout(() => this.scheduleNextBeat(), (this.beatLength / 4) * 1000);
        this.timeouts.push(timeout);
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentBeat = 0;
        this.scheduleNextBeat();
    }

    stop() {
        this.isPlaying = false;
        this.timeouts.forEach(t => clearTimeout(t));
        this.timeouts = [];
        this.nodes.forEach(({ osc }) => { try { osc.stop(); } catch (e) {} });
        this.nodes = [];
    }
}

function startMusic() {
    if (!audioCtx || !musicEnabled) return;
    if (!musicPlayer) {
        musicPlayer = new PerfumeMusicPlayer(audioCtx, musicGain);
    }
    musicPlayer.start();
}

function stopMusic() {
    if (musicPlayer) musicPlayer.stop();
}

// ========================
// GAME LOGIC
// ========================

function initBoard() {
    board = [];
    for (let y = 0; y < ROWS + HIDDEN_ROWS; y++) {
        board[y] = [];
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
        }
    }
}

function createPuyo() {
    return {
        color1: Math.floor(Math.random() * COLORS.length),
        color2: Math.floor(Math.random() * COLORS.length),
        x: 2,
        y: 0,
        rotation: 0 // 0: up, 1: right, 2: down, 3: left
    };
}

function getSecondPuyoPos(puyo) {
    const offsets = [
        { x: 0, y: -1 }, // up
        { x: 1, y: 0 },  // right
        { x: 0, y: 1 },  // down
        { x: -1, y: 0 }  // left
    ];
    return {
        x: puyo.x + offsets[puyo.rotation].x,
        y: puyo.y + offsets[puyo.rotation].y
    };
}

function isValidPosition(x, y) {
    return x >= 0 && x < COLS && y < ROWS + HIDDEN_ROWS && (y < 0 || board[y][x] === null);
}

function canMove(puyo, dx, dy, newRotation = puyo.rotation) {
    const newX = puyo.x + dx;
    const newY = puyo.y + dy;

    if (!isValidPosition(newX, newY)) return false;

    const testPuyo = { ...puyo, x: newX, y: newY, rotation: newRotation };
    const second = getSecondPuyoPos(testPuyo);

    return isValidPosition(second.x, second.y);
}

function movePuyo(dx, dy) {
    if (!currentPuyo || animating) return false;

    if (canMove(currentPuyo, dx, dy)) {
        currentPuyo.x += dx;
        currentPuyo.y += dy;
        if (dx !== 0) playSound(400, 0.05);
        render();
        return true;
    }
    return false;
}

function rotatePuyo(direction) {
    if (!currentPuyo || animating) return;

    const newRotation = (currentPuyo.rotation + direction + 4) % 4;

    // Try rotation
    if (canMove(currentPuyo, 0, 0, newRotation)) {
        currentPuyo.rotation = newRotation;
        playSound(500, 0.05);
        render();
        return;
    }

    // Wall kick
    const kicks = [[-1, 0], [1, 0], [0, -1]];
    for (const [kx, ky] of kicks) {
        if (canMove(currentPuyo, kx, ky, newRotation)) {
            currentPuyo.x += kx;
            currentPuyo.y += ky;
            currentPuyo.rotation = newRotation;
            playSound(500, 0.05);
            render();
            return;
        }
    }
}

function hardDrop() {
    if (!currentPuyo || animating) return;

    while (canMove(currentPuyo, 0, 1)) {
        currentPuyo.y++;
        score += 1;
    }

    playSound(200, 0.1);
    lockPuyo();
}

function lockPuyo() {
    if (!currentPuyo) return;

    const second = getSecondPuyoPos(currentPuyo);

    // Place puyos on board
    if (currentPuyo.y >= 0 && currentPuyo.y < ROWS + HIDDEN_ROWS) {
        board[currentPuyo.y][currentPuyo.x] = currentPuyo.color1;
    }
    if (second.y >= 0 && second.y < ROWS + HIDDEN_ROWS) {
        board[second.y][second.x] = currentPuyo.color2;
    }

    playSound(150, 0.1);

    currentPuyo = null;
    processChains();
}

function applyGravity() {
    let moved = false;
    for (let x = 0; x < COLS; x++) {
        for (let y = ROWS + HIDDEN_ROWS - 2; y >= 0; y--) {
            if (board[y][x] !== null && board[y + 1][x] === null) {
                board[y + 1][x] = board[y][x];
                board[y][x] = null;
                moved = true;
            }
        }
    }
    return moved;
}

function findConnected(x, y, color, visited) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS + HIDDEN_ROWS) return [];
    if (visited[y][x] || board[y][x] !== color) return [];

    visited[y][x] = true;
    let connected = [{ x, y }];

    connected = connected.concat(findConnected(x + 1, y, color, visited));
    connected = connected.concat(findConnected(x - 1, y, color, visited));
    connected = connected.concat(findConnected(x, y + 1, color, visited));
    connected = connected.concat(findConnected(x, y - 1, color, visited));

    return connected;
}

function clearMatches(chainNum) {
    const visited = Array(ROWS + HIDDEN_ROWS).fill(null).map(() => Array(COLS).fill(false));
    let puyosCleared = 0;
    let groupsCleared = 0;
    let colorsCleared = new Set();

    for (let y = 0; y < ROWS + HIDDEN_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null && !visited[y][x]) {
                const color = board[y][x];
                const connected = findConnected(x, y, color, visited);

                if (connected.length >= 4) {
                    groupsCleared++;
                    colorsCleared.add(color);
                    puyosCleared += connected.length;

                    connected.forEach(pos => {
                        board[pos.y][pos.x] = null;
                    });

                    // Sound effect for clearing
                    playSound(600 + chainNum * 100, 0.15);
                }
            }
        }
    }

    if (puyosCleared === 0) return 0;

    // Score calculation
    const chainBonus = Math.min(999, chainNum === 1 ? 0 : Math.pow(2, chainNum + 1));
    const groupBonus = groupsCleared > 1 ? (groupsCleared - 1) * 2 : 0;
    const colorBonus = colorsCleared.size > 1 ? Math.pow(2, colorsCleared.size - 1) : 0;
    const totalBonus = Math.max(1, chainBonus + groupBonus + colorBonus);

    score += puyosCleared * 10 * totalBonus;

    return puyosCleared;
}

function showChainPopup(chainCount) {
    const popup = document.getElementById('chainPopup');
    const cuteMessages = ['', 'すごい!', 'キラキラ!', 'やったね!', 'さいこう!', 'かわいい!'];
    const message = cuteMessages[Math.min(chainCount, cuteMessages.length - 1)] || '!!!';
    popup.innerHTML = `${chainCount}れんさ!<br><span style="font-size: 24px">${message}</span>`;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 1000);
}

async function processChains() {
    animating = true;
    let chainCount = 0;

    while (true) {
        while (applyGravity()) {
            render();
            await new Promise(r => setTimeout(r, 50));
        }

        const cleared = clearMatches(chainCount + 1);
        if (cleared === 0) break;

        chainCount++;
        chains = chainCount;
        if (chainCount > maxChains) maxChains = chainCount;

        if (chainCount > 1) {
            showChainPopup(chainCount);
        }

        updateUI();
        render();
        await new Promise(r => setTimeout(r, 300));
    }

    animating = false;

    // Check game over
    if (board[0][2] !== null || board[1][2] !== null) {
        endGame();
        return;
    }

    spawnNextPuyo();
}

function spawnNextPuyo() {
    currentPuyo = nextPuyo || createPuyo();
    currentPuyo.x = 2;
    currentPuyo.y = 0;
    currentPuyo.rotation = 0;

    nextPuyo = createPuyo();
    renderNext();
    render();

    // Level up
    const newLevel = Math.floor(score / 1000) + 1;
    if (newLevel > level) {
        level = newLevel;
        dropInterval = Math.max(200, 1000 - (level - 1) * 100);
    }
}

function endGame() {
    gameOver = true;
    stopMusic();

    document.getElementById('finalScore').textContent = score.toLocaleString();
    document.getElementById('maxChain').textContent = maxChains;
    document.getElementById('gameOver').style.display = 'block';

    // Game over sound
    [200, 150, 100].forEach((freq, i) => {
        setTimeout(() => playSound(freq, 0.3), i * 150);
    });
}

// ========================
// RENDERING
// ========================

function render() {
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#ffe6f2');
    gradient.addColorStop(0.3, '#fff0f5');
    gradient.addColorStop(0.6, '#e6f0ff');
    gradient.addColorStop(1, '#f0e6ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw board background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(boardOffsetX - 5, boardOffsetY - 5, COLS * cellSize + 10, ROWS * cellSize + 10);

    // Draw board border
    ctx.strokeStyle = '#FFB6C1';
    ctx.lineWidth = 4;
    ctx.strokeRect(boardOffsetX - 5, boardOffsetY - 5, COLS * cellSize + 10, ROWS * cellSize + 10);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 182, 193, 0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(boardOffsetX + x * cellSize, boardOffsetY);
        ctx.lineTo(boardOffsetX + x * cellSize, boardOffsetY + ROWS * cellSize);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(boardOffsetX, boardOffsetY + y * cellSize);
        ctx.lineTo(boardOffsetX + COLS * cellSize, boardOffsetY + y * cellSize);
        ctx.stroke();
    }

    // Draw placed puyos
    for (let y = HIDDEN_ROWS; y < ROWS + HIDDEN_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                drawPuyo(
                    boardOffsetX + x * cellSize + cellSize / 2,
                    boardOffsetY + (y - HIDDEN_ROWS) * cellSize + cellSize / 2,
                    board[y][x],
                    cellSize - 4
                );
            }
        }
    }

    // Draw current puyo
    if (currentPuyo && !animating) {
        // Draw ghost
        let ghostY = currentPuyo.y;
        while (canMove({ ...currentPuyo, y: ghostY }, 0, 1)) {
            ghostY++;
        }
        if (ghostY > currentPuyo.y) {
            const ghostSecond = getSecondPuyoPos({ ...currentPuyo, y: ghostY });
            drawPuyo(
                boardOffsetX + currentPuyo.x * cellSize + cellSize / 2,
                boardOffsetY + (ghostY - HIDDEN_ROWS) * cellSize + cellSize / 2,
                currentPuyo.color1,
                cellSize - 4,
                true
            );
            drawPuyo(
                boardOffsetX + ghostSecond.x * cellSize + cellSize / 2,
                boardOffsetY + (ghostSecond.y - HIDDEN_ROWS) * cellSize + cellSize / 2,
                currentPuyo.color2,
                cellSize - 4,
                true
            );
        }

        // Draw actual puyo (show even if partially above board)
        const second = getSecondPuyoPos(currentPuyo);
        const displayY1 = currentPuyo.y - HIDDEN_ROWS;
        const displayY2 = second.y - HIDDEN_ROWS;

        if (displayY1 >= -1) {
            drawPuyo(
                boardOffsetX + currentPuyo.x * cellSize + cellSize / 2,
                boardOffsetY + displayY1 * cellSize + cellSize / 2,
                currentPuyo.color1,
                cellSize - 4
            );
        }
        if (displayY2 >= -1) {
            drawPuyo(
                boardOffsetX + second.x * cellSize + cellSize / 2,
                boardOffsetY + displayY2 * cellSize + cellSize / 2,
                currentPuyo.color2,
                cellSize - 4
            );
        }
    }
}

function drawPuyo(x, y, colorIndex, size, isGhost = false) {
    const color = COLORS[colorIndex];
    const radius = size / 2 - 2;

    ctx.save();

    if (isGhost) {
        ctx.globalAlpha = 0.3;
    }

    // Body gradient
    const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, lightenColor(color, 20));
    gradient.addColorStop(0.8, color);
    gradient.addColorStop(1, darkenColor(color, 15));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    if (!isGhost) {
        // Cheeks
        ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
        ctx.beginPath();
        ctx.arc(x - radius * 0.5, y + radius * 0.1, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + radius * 0.5, y + radius * 0.1, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeOffset = radius / 4;
        const eyeRadius = radius / 5;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(x - eyeOffset, y - eyeOffset/2, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + eyeOffset, y - eyeOffset/2, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#3D2314';
        ctx.beginPath();
        ctx.arc(x - eyeOffset, y - eyeOffset/3, eyeRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeOffset, y - eyeOffset/3, eyeRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Eye sparkles
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - eyeOffset + eyeRadius/3, y - eyeOffset/2 - eyeRadius/3, eyeRadius/4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeOffset + eyeRadius/3, y - eyeOffset/2 - eyeRadius/3, eyeRadius/4, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#3D2314';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y + radius * 0.15, radius * 0.2, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(x - radius * 0.3, y - radius * 0.35, radius * 0.25, radius * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function renderNext() {
    const gradient = nextCtx.createLinearGradient(0, 0, 0, nextCanvas.height);
    gradient.addColorStop(0, '#FFF0F5');
    gradient.addColorStop(1, '#FFE4EC');
    nextCtx.fillStyle = gradient;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (nextPuyo) {
        drawPuyoSmall(nextCtx, 30, 60, nextPuyo.color1, 28);
        drawPuyoSmall(nextCtx, 30, 30, nextPuyo.color2, 28);
    }
}

function drawPuyoSmall(ctx, x, y, colorIndex, size) {
    const color = COLORS[colorIndex];
    const radius = size / 2 - 2;

    const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, lightenColor(color, 20));
    gradient.addColorStop(0.8, color);
    gradient.addColorStop(1, darkenColor(color, 15));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Simple eyes
    ctx.fillStyle = '#3D2314';
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.1, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + radius * 0.25, y - radius * 0.1, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

function lightenColor(color, percent) {
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R}, ${G}, ${B})`;
}

function darkenColor(color, percent) {
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `rgb(${R}, ${G}, ${B})`;
}

function updateUI() {
    document.getElementById('score').textContent = score.toLocaleString();
    document.getElementById('chains').textContent = chains;
}

// ========================
// GAME LOOP
// ========================

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    // Always render every frame
    render();

    // Skip if timestamp is not valid yet
    if (!timestamp) return;

    if (!paused && !gameOver && !animating && currentPuyo) {
        if (timestamp - lastDrop > dropInterval) {
            if (!movePuyo(0, 1)) {
                lockPuyo();
            }
            lastDrop = timestamp;
        }
    }
}

// ========================
// INPUT HANDLING
// ========================

document.addEventListener('keydown', (e) => {
    if (gameOver || paused) {
        if (e.key === 'Enter' && gameOver) startGame();
        return;
    }

    switch (e.key) {
        case 'ArrowLeft': movePuyo(-1, 0); break;
        case 'ArrowRight': movePuyo(1, 0); break;
        case 'ArrowDown':
            if (movePuyo(0, 1)) {
                score += 1;
                updateUI();
            }
            break;
        case 'z': case 'Z': rotatePuyo(-1); break;
        case 'x': case 'X': rotatePuyo(1); break;
        case ' ': hardDrop(); break;
    }
    e.preventDefault();
});

// ========================
// TOUCH CONTROLS
// ========================

function setupTouchControls() {
    const dpadLeft = document.getElementById('dpad-left');
    const dpadRight = document.getElementById('dpad-right');
    const dpadDown = document.getElementById('dpad-down');
    const btnRotateLeft = document.getElementById('btn-rotate-left');
    const btnRotateRight = document.getElementById('btn-rotate-right');
    const btnDrop = document.getElementById('btn-drop');
    const mobileStart = document.getElementById('mobileStartBtn');

    function addTouchHandler(element, action) {
        if (!element) return;

        let intervalId = null;

        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (gameOver || paused) return;
            action();
            if (element === dpadLeft || element === dpadRight || element === dpadDown) {
                intervalId = setInterval(action, 100);
            }
        }, { passive: false });

        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }, { passive: false });

        element.addEventListener('touchcancel', (e) => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }, { passive: false });
    }

    addTouchHandler(dpadLeft, () => movePuyo(-1, 0));
    addTouchHandler(dpadRight, () => movePuyo(1, 0));
    addTouchHandler(dpadDown, () => {
        if (movePuyo(0, 1)) {
            score += 1;
            updateUI();
        }
    });

    addTouchHandler(btnRotateLeft, () => rotatePuyo(-1));
    addTouchHandler(btnRotateRight, () => rotatePuyo(1));
    addTouchHandler(btnDrop, () => hardDrop());

    if (mobileStart) {
        mobileStart.addEventListener('touchend', (e) => {
            e.preventDefault();
            startGame();
            mobileStart.style.display = 'none';
        }, { passive: false });

        mobileStart.addEventListener('click', (e) => {
            startGame();
            mobileStart.style.display = 'none';
        });
    }
}

// ========================
// BUTTON HANDLERS
// ========================

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('muteBtn').addEventListener('click', toggleMusic);
document.getElementById('restartBtn').addEventListener('click', startGame);

function startGame() {
    initAudio();
    initBoard();

    score = 0;
    chains = 0;
    maxChains = 0;
    level = 1;
    gameOver = false;
    paused = false;
    animating = false;
    dropInterval = 1000;

    nextPuyo = createPuyo();
    spawnNextPuyo();

    updateUI();
    document.getElementById('gameOver').style.display = 'none';

    const mobileStart = document.getElementById('mobileStartBtn');
    if (mobileStart) mobileStart.style.display = 'none';

    if (musicEnabled) startMusic();
    // Use a large value so first drop happens after dropInterval
    lastDrop = performance.now();

    console.log('Game started! currentPuyo:', currentPuyo);
    render();
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    document.getElementById('muteBtn').textContent = musicEnabled ? '🎵 ON' : '🎵 OFF';
    if (musicEnabled && !paused && !gameOver) {
        initAudio();
        startMusic();
    } else {
        stopMusic();
    }
}

// ========================
// INITIALIZE
// ========================

resizeCanvas();
initBoard();
renderNext();
updateUI();
setupTouchControls();
requestAnimationFrame(gameLoop);
render();

console.log('PUYO PUYO 2D - Cute Edition');
console.log('Press START to begin!');
