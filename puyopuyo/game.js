// ========================
// PUYO PUYO GAME
// ========================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// Game constants
const COLS = 6;
const ROWS = 12;
const HIDDEN_ROWS = 1;
const CELL_SIZE = 40;
const COLORS = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6'];
const COLOR_NAMES = ['red', 'green', 'blue', 'yellow', 'purple'];

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
let dropInterval = 1000;
let lastDrop = 0;
let animating = false;
let musicEnabled = true;

// Audio context for chiptune music
let audioCtx = null;
let musicGain = null;
let musicPlaying = false;

// Initialize audio context
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.3;
        musicGain.connect(audioCtx.destination);
    }
}

// 8-bit style sound effect
function playSound(frequency, duration, type = 'square') {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Play move sound
function playMoveSound() {
    playSound(200, 0.05);
}

// Play rotate sound
function playRotateSound() {
    playSound(400, 0.08);
}

// Play drop sound
function playDropSound() {
    playSound(150, 0.1);
}

// Play chain sound (pitch increases with chain)
function playChainSound(chainCount) {
    const baseFreq = 300 + chainCount * 100;
    playSound(baseFreq, 0.2);
    setTimeout(() => playSound(baseFreq * 1.5, 0.2), 100);
    setTimeout(() => playSound(baseFreq * 2, 0.3), 200);
}

// Play game over sound
function playGameOverSound() {
    let freq = 400;
    for (let i = 0; i < 5; i++) {
        setTimeout(() => playSound(freq - i * 50, 0.3, 'sawtooth'), i * 150);
    }
}

// ========================
// CHIPTUNE MUSIC GENERATOR
// ========================

class ChiptuneMusicPlayer {
    constructor(audioCtx, masterGain) {
        this.audioCtx = audioCtx;
        this.masterGain = masterGain;
        this.isPlaying = false;
        this.oscillators = [];
        this.timeouts = [];
        this.currentBeat = 0;
        this.bpm = 140;
        this.beatLength = 60 / this.bpm;
    }

    // Musical notes to frequencies
    noteToFreq(note, octave) {
        const notes = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
        const semitone = notes[note];
        return 440 * Math.pow(2, (semitone - 9) / 12 + (octave - 4));
    }

    // Play a single note
    playNote(freq, duration, type, volume = 0.15, delay = 0) {
        if (!this.isPlaying) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        const startTime = this.audioCtx.currentTime + delay;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gain.gain.setValueAtTime(volume, startTime + duration * 0.7);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);

        this.oscillators.push({ osc, gain });
    }

    // Main melody pattern (catchy and upbeat)
    playMelody(beat) {
        const melodyPattern = [
            ['E', 5], ['G', 5], ['A', 5], ['B', 5],
            ['A', 5], ['G', 5], ['E', 5], ['D', 5],
            ['C', 5], ['D', 5], ['E', 5], ['G', 5],
            ['A', 5], ['G', 5], ['E', 5], ['C', 5],
            ['D', 5], ['E', 5], ['F#', 5], ['G', 5],
            ['A', 5], ['B', 5], ['A', 5], ['G', 5],
            ['E', 5], ['D', 5], ['C', 5], ['D', 5],
            ['E', 5], ['G', 5], ['E', 5], ['C', 5],
        ];

        const noteIndex = beat % melodyPattern.length;
        const [note, octave] = melodyPattern[noteIndex];
        const freq = this.noteToFreq(note, octave);
        this.playNote(freq, this.beatLength * 0.8, 'square', 0.12);
    }

    // Bass line
    playBass(beat) {
        const bassPattern = [
            ['C', 3], ['C', 3], ['G', 2], ['G', 2],
            ['A', 2], ['A', 2], ['E', 2], ['E', 2],
            ['F', 2], ['F', 2], ['C', 3], ['C', 3],
            ['G', 2], ['G', 2], ['G', 2], ['G', 2],
        ];

        const noteIndex = Math.floor(beat / 2) % bassPattern.length;
        const [note, octave] = bassPattern[noteIndex];
        const freq = this.noteToFreq(note, octave);
        this.playNote(freq, this.beatLength * 1.8, 'triangle', 0.2);
    }

    // Arpeggio harmony
    playArpeggio(beat) {
        const chords = [
            [['C', 4], ['E', 4], ['G', 4]],
            [['A', 3], ['C', 4], ['E', 4]],
            [['F', 3], ['A', 3], ['C', 4]],
            [['G', 3], ['B', 3], ['D', 4]],
        ];

        const chordIndex = Math.floor(beat / 8) % chords.length;
        const noteInChord = beat % 3;
        const [note, octave] = chords[chordIndex][noteInChord];
        const freq = this.noteToFreq(note, octave);
        this.playNote(freq, this.beatLength * 0.4, 'square', 0.06);
    }

    // Drum pattern using noise
    playDrums(beat) {
        const pattern = beat % 4;

        if (pattern === 0 || pattern === 2) {
            // Kick drum simulation
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
        }

        if (pattern === 2) {
            // Snare simulation using noise
            const bufferSize = this.audioCtx.sampleRate * 0.1;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.audioCtx.createBufferSource();
            const noiseGain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();
            noise.buffer = buffer;
            filter.type = 'highpass';
            filter.frequency.value = 1000;
            noiseGain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noise.start();
        }

        // Hi-hat on every beat
        const hihatBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.03, this.audioCtx.sampleRate);
        const hihatData = hihatBuffer.getChannelData(0);
        for (let i = 0; i < hihatData.length; i++) {
            hihatData[i] = Math.random() * 2 - 1;
        }
        const hihat = this.audioCtx.createBufferSource();
        const hihatGain = this.audioCtx.createGain();
        const hihatFilter = this.audioCtx.createBiquadFilter();
        hihat.buffer = hihatBuffer;
        hihatFilter.type = 'highpass';
        hihatFilter.frequency.value = 5000;
        hihatGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        hihatGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.03);
        hihat.connect(hihatFilter);
        hihatFilter.connect(hihatGain);
        hihatGain.connect(this.masterGain);
        hihat.start();
    }

    // Main loop
    scheduleNextBeat() {
        if (!this.isPlaying) return;

        this.playMelody(this.currentBeat);
        this.playBass(this.currentBeat);
        this.playArpeggio(this.currentBeat);
        this.playDrums(this.currentBeat);

        this.currentBeat++;

        const timeout = setTimeout(() => {
            this.scheduleNextBeat();
        }, this.beatLength * 1000);

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
        this.oscillators.forEach(({ osc, gain }) => {
            try {
                osc.stop();
            } catch (e) {}
        });
        this.oscillators = [];
    }
}

let musicPlayer = null;

function startMusic() {
    if (!audioCtx || !musicEnabled) return;
    if (!musicPlayer) {
        musicPlayer = new ChiptuneMusicPlayer(audioCtx, musicGain);
    }
    musicPlayer.start();
}

function stopMusic() {
    if (musicPlayer) {
        musicPlayer.stop();
    }
}

// ========================
// GAME LOGIC
// ========================

// Initialize board
function initBoard() {
    board = [];
    for (let y = 0; y < ROWS + HIDDEN_ROWS; y++) {
        board[y] = [];
        for (let x = 0; x < COLS; x++) {
            board[y][x] = null;
        }
    }
}

// Create new puyo pair
function createPuyo() {
    return {
        x: 2,
        y: 0,
        color1: Math.floor(Math.random() * COLORS.length),
        color2: Math.floor(Math.random() * COLORS.length),
        rotation: 0 // 0: up, 1: right, 2: down, 3: left
    };
}

// Get second puyo position based on rotation
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

// Check if position is valid
function isValidPosition(x, y) {
    return x >= 0 && x < COLS && y < ROWS + HIDDEN_ROWS && (y < 0 || board[y][x] === null);
}

// Check if puyo can move to position
function canMove(puyo, dx, dy, newRotation = puyo.rotation) {
    const newX = puyo.x + dx;
    const newY = puyo.y + dy;

    const tempPuyo = { ...puyo, x: newX, y: newY, rotation: newRotation };
    const second = getSecondPuyoPos(tempPuyo);

    return isValidPosition(newX, newY) && isValidPosition(second.x, second.y);
}

// Move puyo
function movePuyo(dx, dy) {
    if (!currentPuyo || animating || paused || gameOver) return false;

    if (canMove(currentPuyo, dx, dy)) {
        currentPuyo.x += dx;
        currentPuyo.y += dy;
        if (dx !== 0) playMoveSound();
        return true;
    }
    return false;
}

// Rotate puyo
function rotatePuyo(direction) {
    if (!currentPuyo || animating || paused || gameOver) return;

    const newRotation = (currentPuyo.rotation + direction + 4) % 4;

    // Try normal rotation
    if (canMove(currentPuyo, 0, 0, newRotation)) {
        currentPuyo.rotation = newRotation;
        playRotateSound();
        return;
    }

    // Try wall kick
    const kicks = [
        { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 0, y: -1 }, { x: 1, y: -1 }, { x: -1, y: -1 }
    ];

    for (const kick of kicks) {
        if (canMove(currentPuyo, kick.x, kick.y, newRotation)) {
            currentPuyo.x += kick.x;
            currentPuyo.y += kick.y;
            currentPuyo.rotation = newRotation;
            playRotateSound();
            return;
        }
    }
}

// Lock puyo in place
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

    playDropSound();

    // Start chain reaction
    setTimeout(() => processChains(), 100);
}

// Apply gravity to make puyos fall
function applyGravity() {
    let moved = false;

    for (let x = 0; x < COLS; x++) {
        for (let y = ROWS + HIDDEN_ROWS - 2; y >= 0; y--) {
            if (board[y][x] !== null) {
                let newY = y;
                while (newY + 1 < ROWS + HIDDEN_ROWS && board[newY + 1][x] === null) {
                    newY++;
                }
                if (newY !== y) {
                    board[newY][x] = board[y][x];
                    board[y][x] = null;
                    moved = true;
                }
            }
        }
    }

    return moved;
}

// Find connected puyos of same color
function findConnected(startX, startY, color, visited = new Set()) {
    const key = `${startX},${startY}`;
    if (visited.has(key)) return [];
    if (startX < 0 || startX >= COLS || startY < 0 || startY >= ROWS + HIDDEN_ROWS) return [];
    if (board[startY][startX] !== color) return [];

    visited.add(key);
    let connected = [{ x: startX, y: startY }];

    // Check all 4 directions
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of directions) {
        connected = connected.concat(findConnected(startX + dx, startY + dy, color, visited));
    }

    return connected;
}

// Find all groups of 4+ connected puyos
function findMatches() {
    const matches = [];
    const checked = new Set();

    for (let y = HIDDEN_ROWS; y < ROWS + HIDDEN_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const key = `${x},${y}`;
            if (board[y][x] !== null && !checked.has(key)) {
                const connected = findConnected(x, y, board[y][x]);
                connected.forEach(p => checked.add(`${p.x},${p.y}`));

                if (connected.length >= 4) {
                    matches.push(connected);
                }
            }
        }
    }

    return matches;
}

// Remove matched puyos and calculate score
function removeMatches(matches, chainCount) {
    let puyosCleared = 0;
    let colorBonus = new Set();
    let groupBonus = 0;

    for (const group of matches) {
        colorBonus.add(board[group[0].y][group[0].x]);
        groupBonus += Math.max(0, group.length - 4);

        for (const { x, y } of group) {
            board[y][x] = null;
            puyosCleared++;
        }
    }

    // Calculate score (simplified puyo puyo scoring)
    const chainPower = chainCount === 1 ? 0 : Math.pow(2, chainCount + 1) * 8;
    const colorBonusValue = Math.max(0, (colorBonus.size - 1) * 3);
    const totalBonus = Math.max(1, chainPower + colorBonusValue + groupBonus);

    const points = puyosCleared * 10 * totalBonus;
    score += points;

    return puyosCleared;
}

// Process chain reactions
async function processChains() {
    animating = true;
    let chainCount = 0;

    while (true) {
        // Apply gravity first
        while (applyGravity()) {
            render();
            await sleep(50);
        }

        // Find matches
        const matches = findMatches();
        if (matches.length === 0) break;

        chainCount++;
        chains = chainCount;
        if (chainCount > maxChains) maxChains = chainCount;

        // Play chain sound
        playChainSound(chainCount);

        // Flash and remove
        for (let flash = 0; flash < 3; flash++) {
            render(matches, flash % 2 === 0);
            await sleep(100);
        }

        removeMatches(matches, chainCount);
        render();
        await sleep(100);

        updateUI();
    }

    animating = false;

    // Spawn next puyo
    spawnNextPuyo();
}

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Spawn next puyo
function spawnNextPuyo() {
    if (gameOver) return;

    currentPuyo = nextPuyo;
    nextPuyo = createPuyo();

    // Check game over (spawn position blocked)
    const second = getSecondPuyoPos(currentPuyo);
    if (board[currentPuyo.y][currentPuyo.x] !== null ||
        (second.y >= 0 && board[second.y][second.x] !== null)) {
        endGame();
    }
}

// Hard drop
function hardDrop() {
    if (!currentPuyo || animating || paused || gameOver) return;

    while (canMove(currentPuyo, 0, 1)) {
        currentPuyo.y++;
    }
    lockPuyo();
}

// End game
function endGame() {
    gameOver = true;
    playGameOverSound();
    stopMusic();

    document.getElementById('finalScore').textContent = score;
    document.getElementById('maxChain').textContent = maxChains;
    document.getElementById('gameOver').style.display = 'block';
}

// ========================
// RENDERING
// ========================

// Draw a single puyo
function drawPuyo(context, x, y, colorIndex, flash = false, size = CELL_SIZE) {
    if (colorIndex === null) return;

    const centerX = x * size + size / 2;
    const centerY = y * size + size / 2;
    const radius = size / 2 - 3;

    const color = flash ? '#ffffff' : COLORS[colorIndex];

    // Main body
    const gradient = context.createRadialGradient(
        centerX - radius/3, centerY - radius/3, 0,
        centerX, centerY, radius
    );
    gradient.addColorStop(0, lightenColor(color, 30));
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, darkenColor(color, 20));

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();

    // Highlight
    context.beginPath();
    context.arc(centerX - radius/3, centerY - radius/3, radius/4, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
    context.fill();

    // Eyes
    if (!flash) {
        const eyeOffset = radius / 4;
        const eyeRadius = radius / 6;

        // Left eye
        context.beginPath();
        context.arc(centerX - eyeOffset, centerY - eyeOffset/2, eyeRadius, 0, Math.PI * 2);
        context.fillStyle = '#000';
        context.fill();

        // Right eye
        context.beginPath();
        context.arc(centerX + eyeOffset, centerY - eyeOffset/2, eyeRadius, 0, Math.PI * 2);
        context.fillStyle = '#000';
        context.fill();

        // Tiny highlights in eyes
        context.beginPath();
        context.arc(centerX - eyeOffset + eyeRadius/3, centerY - eyeOffset/2 - eyeRadius/3, eyeRadius/3, 0, Math.PI * 2);
        context.fillStyle = '#fff';
        context.fill();

        context.beginPath();
        context.arc(centerX + eyeOffset + eyeRadius/3, centerY - eyeOffset/2 - eyeRadius/3, eyeRadius/3, 0, Math.PI * 2);
        context.fillStyle = '#fff';
        context.fill();
    }
}

// Color helpers
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

// Main render function
function render(flashGroups = [], flash = false) {
    // Clear canvas
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(canvas.width, y * CELL_SIZE);
        ctx.stroke();
    }

    // Create set of flashing positions
    const flashSet = new Set();
    if (flash) {
        for (const group of flashGroups) {
            for (const { x, y } of group) {
                flashSet.add(`${x},${y}`);
            }
        }
    }

    // Draw board puyos
    for (let y = HIDDEN_ROWS; y < ROWS + HIDDEN_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const displayY = y - HIDDEN_ROWS;
            const shouldFlash = flashSet.has(`${x},${y}`);
            drawPuyo(ctx, x, displayY, board[y][x], shouldFlash);
        }
    }

    // Draw current puyo
    if (currentPuyo && !animating) {
        const displayY = currentPuyo.y - HIDDEN_ROWS;
        drawPuyo(ctx, currentPuyo.x, displayY, currentPuyo.color1);

        const second = getSecondPuyoPos(currentPuyo);
        const secondDisplayY = second.y - HIDDEN_ROWS;
        drawPuyo(ctx, second.x, secondDisplayY, currentPuyo.color2);

        // Draw ghost (preview of where puyo will land)
        drawGhost();
    }

    // Draw next puyo preview
    renderNext();
}

// Draw ghost puyo
function drawGhost() {
    if (!currentPuyo) return;

    // Find landing position
    let ghostY = currentPuyo.y;
    while (canMove({ ...currentPuyo, y: ghostY }, 0, 1)) {
        ghostY++;
    }

    if (ghostY === currentPuyo.y) return;

    const ghostPuyo = { ...currentPuyo, y: ghostY };
    const second = getSecondPuyoPos(ghostPuyo);

    ctx.globalAlpha = 0.3;
    drawPuyo(ctx, ghostPuyo.x, ghostPuyo.y - HIDDEN_ROWS, ghostPuyo.color1);
    drawPuyo(ctx, second.x, second.y - HIDDEN_ROWS, ghostPuyo.color2);
    ctx.globalAlpha = 1;
}

// Render next puyo preview
function renderNext() {
    nextCtx.fillStyle = '#0f0f23';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (nextPuyo) {
        const previewSize = 35;
        const offsetX = (nextCanvas.width - previewSize) / 2;

        // Draw next puyo pair vertically
        drawPuyoPreview(nextCtx, offsetX / previewSize, 2, nextPuyo.color1, previewSize);
        drawPuyoPreview(nextCtx, offsetX / previewSize, 1, nextPuyo.color2, previewSize);
    }
}

function drawPuyoPreview(context, x, y, colorIndex, size) {
    const centerX = x * size + size / 2 + 10;
    const centerY = y * size + size / 2;
    const radius = size / 2 - 2;

    const color = COLORS[colorIndex];

    const gradient = context.createRadialGradient(
        centerX - radius/3, centerY - radius/3, 0,
        centerX, centerY, radius
    );
    gradient.addColorStop(0, lightenColor(color, 30));
    gradient.addColorStop(0.7, color);
    gradient.addColorStop(1, darkenColor(color, 20));

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();

    // Eyes
    const eyeOffset = radius / 4;
    const eyeRadius = radius / 6;

    context.beginPath();
    context.arc(centerX - eyeOffset, centerY - eyeOffset/2, eyeRadius, 0, Math.PI * 2);
    context.fillStyle = '#000';
    context.fill();

    context.beginPath();
    context.arc(centerX + eyeOffset, centerY - eyeOffset/2, eyeRadius, 0, Math.PI * 2);
    context.fillStyle = '#000';
    context.fill();
}

// Update UI elements
function updateUI() {
    document.getElementById('score').textContent = score.toLocaleString();
    document.getElementById('chains').textContent = chains;
    document.getElementById('level').textContent = level;
}

// ========================
// GAME LOOP
// ========================

function gameLoop(timestamp) {
    if (!paused && !gameOver && !animating && currentPuyo) {
        // Auto drop
        if (timestamp - lastDrop > dropInterval) {
            if (!movePuyo(0, 1)) {
                lockPuyo();
            }
            lastDrop = timestamp;
        }
    }

    render();
    requestAnimationFrame(gameLoop);
}

// ========================
// INPUT HANDLING
// ========================

document.addEventListener('keydown', (e) => {
    if (gameOver || paused) {
        if (e.key === 'Enter' && gameOver) {
            startGame();
        }
        return;
    }

    switch (e.key) {
        case 'ArrowLeft':
            movePuyo(-1, 0);
            break;
        case 'ArrowRight':
            movePuyo(1, 0);
            break;
        case 'ArrowDown':
            if (movePuyo(0, 1)) {
                score += 1;
                updateUI();
            }
            break;
        case 'z':
        case 'Z':
            rotatePuyo(-1);
            break;
        case 'x':
        case 'X':
            rotatePuyo(1);
            break;
        case ' ':
            hardDrop();
            break;
    }

    e.preventDefault();
});

// ========================
// BUTTON HANDLERS
// ========================

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('pauseBtn').addEventListener('click', togglePause);
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

    if (musicEnabled) {
        startMusic();
    }

    lastDrop = performance.now();
}

function togglePause() {
    paused = !paused;
    document.getElementById('pauseBtn').textContent = paused ? 'RESUME' : 'PAUSE';

    if (paused) {
        stopMusic();
    } else if (musicEnabled && !gameOver) {
        startMusic();
    }
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    document.getElementById('muteBtn').textContent = musicEnabled ? 'MUSIC: ON' : 'MUSIC: OFF';

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

// Initial render
initBoard();
render();
updateUI();

// Start game loop
requestAnimationFrame(gameLoop);

// Show instructions
console.log('🎮 PUYO PUYO');
console.log('Press START to begin!');
console.log('Controls: ← → (move), ↓ (soft drop), Z/X (rotate), SPACE (hard drop)');
