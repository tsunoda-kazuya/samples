// Gravity Puzzle v1.5
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const debugInfo = document.getElementById('debugInfo');
const scoreDisplay = document.getElementById('score');

// Audio context
let audioCtx = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Play a chiptune tone with envelope
function playChipTone(freq, duration, type = 'square', volume = 0.15, attack = 0.01, decay = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.linearRampToValueAtTime(volume * 0.7, now + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
}

// Arpeggio helper
function playArpeggio(notes, interval, type = 'square', volume = 0.12) {
    notes.forEach((note, i) => {
        setTimeout(() => playChipTone(note, 0.15, type, volume), i * interval);
    });
}

// Sound effects
function playMatchSound(chainCount) {
    if (!audioCtx) return;
    const baseFreq = 523 + (chainCount - 1) * 150;
    playArpeggio([baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2], 40, 'square', 0.2);
}

function playGravityChangeSound() {
    if (!audioCtx) return;
    playChipTone(196, 0.08, 'square', 0.12);
    setTimeout(() => playChipTone(262, 0.08, 'square', 0.1), 30);
}

function playGameOverSound() {
    if (!audioCtx) return;
    playArpeggio([392, 330, 262, 196], 150, 'sawtooth', 0.2);
}

function playSpawnSound() {
    if (!audioCtx) return;
    playChipTone(1047, 0.03, 'square', 0.08);
}

function playComboReadySound() {
    if (!audioCtx) return;
    playArpeggio([523, 659, 784], 50, 'square', 0.1);
}

// ===============================
// FUNKY CHIPTUNE BGM
// ===============================
let bgmPlaying = false;
let bgmScheduler = null;
let nextNoteTime = 0;
const BPM = 140;
const NOTE_LENGTH = 60 / BPM / 4; // 16th notes

// Catchy melody pattern (notes in Hz, 0 = rest)
const melodyPattern = [
    523, 0, 659, 0, 784, 784, 659, 0,
    523, 0, 392, 0, 523, 0, 659, 523,
    587, 0, 698, 0, 880, 880, 698, 0,
    587, 0, 440, 0, 587, 698, 587, 0,
    523, 0, 659, 0, 784, 784, 659, 0,
    523, 0, 392, 0, 523, 659, 784, 0,
    1047, 0, 880, 0, 784, 0, 659, 0,
    523, 523, 0, 0, 523, 0, 0, 0
];

// Bass pattern
const bassPattern = [
    131, 0, 131, 0, 165, 0, 165, 0,
    175, 0, 175, 0, 196, 0, 196, 0,
    147, 0, 147, 0, 175, 0, 175, 0,
    165, 0, 165, 0, 196, 0, 131, 0,
    131, 0, 131, 0, 165, 0, 165, 0,
    175, 0, 175, 0, 196, 0, 196, 0,
    131, 0, 165, 0, 175, 0, 196, 0,
    262, 0, 196, 0, 131, 0, 0, 0
];

// Drum pattern (1=kick, 2=snare, 3=hihat)
const drumPattern = [
    1, 3, 0, 3, 2, 3, 0, 3,
    1, 3, 1, 3, 2, 3, 0, 3,
    1, 3, 0, 3, 2, 3, 0, 3,
    1, 3, 1, 3, 2, 3, 1, 3,
    1, 3, 0, 3, 2, 3, 0, 3,
    1, 3, 1, 3, 2, 3, 0, 3,
    1, 3, 0, 3, 2, 3, 0, 3,
    1, 1, 2, 2, 1, 2, 1, 2
];

let patternIndex = 0;

function playDrum(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === 1) { // Kick
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 2) { // Snare
        const noise = audioCtx.createBufferSource();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);
        noise.stop(now + 0.1);
    } else if (type === 3) { // Hi-hat
        const noise = audioCtx.createBufferSource();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);
        noise.stop(now + 0.05);
    }
}

function scheduleBGMNote() {
    if (!bgmPlaying || !audioCtx) return;

    const melody = melodyPattern[patternIndex];
    const bass = bassPattern[patternIndex];
    const drum = drumPattern[patternIndex];

    if (melody > 0 && !gamePaused) {
        playChipTone(melody, NOTE_LENGTH * 1.5, 'square', 0.1);
    }
    if (bass > 0 && !gamePaused) {
        playChipTone(bass, NOTE_LENGTH * 2, 'triangle', 0.15);
    }
    if (drum > 0 && !gamePaused) {
        playDrum(drum);
    }

    patternIndex = (patternIndex + 1) % melodyPattern.length;
}

function startBGM() {
    if (!audioCtx || bgmPlaying) return;
    bgmPlaying = true;
    patternIndex = 0;
    nextNoteTime = audioCtx.currentTime;

    bgmScheduler = setInterval(() => {
        if (!gamePaused && gameStarted && !gameOver) {
            scheduleBGMNote();
        }
    }, NOTE_LENGTH * 1000);
}

function stopBGM() {
    if (bgmScheduler) {
        clearInterval(bgmScheduler);
        bgmScheduler = null;
    }
    bgmPlaying = false;
}

// Game constants
const COLS = 6;
const ROWS = 8;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#a29bfe'];
const MATCH_COUNT = 3;

// Responsive sizing
let CELL_SIZE;
let BOARD_WIDTH;
let BOARD_HEIGHT;

function resizeCanvas() {
    const maxWidth = Math.min(window.innerWidth - 20, 400);
    CELL_SIZE = Math.floor(maxWidth / COLS);
    BOARD_WIDTH = CELL_SIZE * COLS;
    BOARD_HEIGHT = CELL_SIZE * ROWS;
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let board = [];
let gravity = { x: 0, y: 1 };
let score = 0;
let chainCount = 0;
let combo = 0;
let maxCombo = 0;
let gameRunning = false;
let gameOver = false;
let gamePaused = false;
let gameStarted = false;
let isProcessing = false;
let level = 1;
let blocksCleared = 0;

// Next blocks preview
let nextBlocks = [];
const NEXT_COUNT = 3;

function generateNextBlocks() {
    nextBlocks = [];
    for (let i = 0; i < NEXT_COUNT; i++) {
        nextBlocks.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
}

function getNextBlock() {
    const color = nextBlocks.shift();
    nextBlocks.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    return color;
}

// Get a color that won't create a match at position
function getSafeColor(row, col) {
    const forbidden = new Set();

    if (col >= 2) {
        const c1 = board[row][col-1]?.color;
        const c2 = board[row][col-2]?.color;
        if (c1 && c1 === c2) forbidden.add(c1);
    }

    if (row >= 2) {
        const c1 = board[row-1]?.[col]?.color;
        const c2 = board[row-2]?.[col]?.color;
        if (c1 && c1 === c2) forbidden.add(c1);
    }

    const available = COLORS.filter(c => !forbidden.has(c));
    return available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : COLORS[Math.floor(Math.random() * COLORS.length)];
}

// Initialize board with blocks that don't match
function initBoard() {
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = null;
        }
    }

    for (let row = ROWS - 3; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            board[row][col] = {
                color: getSafeColor(row, col)
            };
        }
    }

    score = 0;
    chainCount = 0;
    combo = 0;
    maxCombo = 0;
    level = 1;
    blocksCleared = 0;
    gameOver = false;
    isProcessing = false;
    gravity = { x: 0, y: 1 };
    generateNextBlocks();
    updateDisplay();
}

function updateDisplay() {
    scoreDisplay.textContent = `Score: ${score}`;
}

function getGravityDirection() {
    if (gravity.y > 0) return '↓';
    if (gravity.y < 0) return '↑';
    if (gravity.x > 0) return '→';
    if (gravity.x < 0) return '←';
    return '•';
}

// Check if there's a potential match with current blocks
function findPotentialMatches() {
    const potentials = [];
    if (!board || board.length === 0) return potentials;

    const checked = new Set();
    for (let row = 0; row < ROWS; row++) {
        if (!board[row]) continue;
        for (let col = 0; col < COLS; col++) {
            const key = `${row},${col}`;
            if (board[row][col] && !checked.has(key)) {
                const color = board[row][col].color;
                const connected = findConnected(row, col, color, new Set());
                connected.forEach(p => checked.add(`${p.row},${p.col}`));
                if (connected.length === 2) {
                    potentials.push(...connected);
                }
            }
        }
    }
    return potentials;
}

// Apply gravity - returns true if any block moved
function applyGravity() {
    let moved = false;

    const rowOrder = gravity.y > 0 ?
        [...Array(ROWS).keys()].reverse() :
        [...Array(ROWS).keys()];
    const colOrder = gravity.x > 0 ?
        [...Array(COLS).keys()].reverse() :
        [...Array(COLS).keys()];

    for (const row of rowOrder) {
        for (const col of colOrder) {
            if (board[row][col]) {
                let newRow = row;
                let newCol = col;

                while (true) {
                    const nextRow = newRow + gravity.y;
                    const nextCol = newCol + gravity.x;

                    if (nextRow < 0 || nextRow >= ROWS ||
                        nextCol < 0 || nextCol >= COLS) break;
                    if (board[nextRow][nextCol]) break;

                    newRow = nextRow;
                    newCol = nextCol;
                }

                if (newRow !== row || newCol !== col) {
                    const block = board[row][col];
                    block.animX = (col - newCol) * CELL_SIZE;
                    block.animY = (row - newRow) * CELL_SIZE;
                    board[newRow][newCol] = block;
                    board[row][col] = null;
                    moved = true;
                }
            }
        }
    }

    return moved;
}

// Find connected blocks of same color using flood fill
function findConnected(row, col, color, visited) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return [];
    if (!board[row]) return [];
    if (visited.has(`${row},${col}`)) return [];
    if (!board[row][col] || board[row][col].color !== color) return [];

    visited.add(`${row},${col}`);
    let connected = [{row, col}];

    connected = connected.concat(findConnected(row-1, col, color, visited));
    connected = connected.concat(findConnected(row+1, col, color, visited));
    connected = connected.concat(findConnected(row, col-1, color, visited));
    connected = connected.concat(findConnected(row, col+1, color, visited));

    return connected;
}

// Find and remove matches
function findAndRemoveMatches() {
    const toRemove = new Set();
    const checked = new Set();

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col] && !checked.has(`${row},${col}`)) {
                const connected = findConnected(row, col, board[row][col].color, new Set());
                connected.forEach(pos => checked.add(`${pos.row},${pos.col}`));

                if (connected.length >= MATCH_COUNT) {
                    connected.forEach(pos => toRemove.add(`${pos.row},${pos.col}`));
                }
            }
        }
    }

    if (toRemove.size > 0) {
        chainCount++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        // Score: blocks * 10 * chain * (1 + combo/10)
        const chainBonus = chainCount > 1 ? chainCount : 1;
        const comboBonus = 1 + combo * 0.1;
        const points = Math.floor(toRemove.size * 10 * chainBonus * comboBonus);
        score += points;
        blocksCleared += toRemove.size;

        // Level up every 30 blocks
        const newLevel = Math.floor(blocksCleared / 30) + 1;
        if (newLevel > level) {
            level = newLevel;
            playArpeggio([523, 659, 784, 1047], 60, 'square', 0.15);
        }

        playMatchSound(chainCount);
        updateDisplay();

        if (chainCount > 1) {
            debugInfo.innerHTML = `${chainCount}連鎖! +${points}<br>Combo: ${combo}`;
        }

        toRemove.forEach(key => {
            const [row, col] = key.split(',').map(Number);
            // Add explosion animation
            board[row][col].exploding = true;
        });

        // Actually remove after brief delay for animation
        setTimeout(() => {
            toRemove.forEach(key => {
                const [row, col] = key.split(',').map(Number);
                board[row][col] = null;
            });
        }, 100);

        return toRemove.size;
    }

    return 0;
}

// Add new blocks from the opposite side of gravity
function addNewBlocks(count, useNext = false) {
    const added = [];
    let spawnPositions = [];

    if (gravity.y > 0) {
        for (let col = 0; col < COLS; col++) {
            if (!board[0][col]) spawnPositions.push({row: 0, col, offsetY: -CELL_SIZE * 2});
        }
    } else if (gravity.y < 0) {
        for (let col = 0; col < COLS; col++) {
            if (!board[ROWS-1][col]) spawnPositions.push({row: ROWS-1, col, offsetY: CELL_SIZE * 2});
        }
    } else if (gravity.x > 0) {
        for (let row = 0; row < ROWS; row++) {
            if (!board[row][0]) spawnPositions.push({row, col: 0, offsetX: -CELL_SIZE * 2});
        }
    } else {
        for (let row = 0; row < ROWS; row++) {
            if (!board[row][COLS-1]) spawnPositions.push({row, col: COLS-1, offsetX: CELL_SIZE * 2});
        }
    }

    spawnPositions.sort(() => Math.random() - 0.5);
    const toAdd = Math.min(count, spawnPositions.length);

    for (let i = 0; i < toAdd; i++) {
        const pos = spawnPositions[i];
        const color = useNext ? getNextBlock() : getSafeColor(pos.row, pos.col);
        board[pos.row][pos.col] = {
            color: color,
            animX: pos.offsetX || 0,
            animY: pos.offsetY || 0,
            isNew: true
        };
        added.push(pos);
    }

    return added;
}

// Count empty cells
function countEmpty() {
    let count = 0;
    for (let row = 0; row < ROWS; row++) {
        if (!board[row]) continue;
        for (let col = 0; col < COLS; col++) {
            if (!board[row][col]) count++;
        }
    }
    return count;
}

function countBlocks() {
    return ROWS * COLS - countEmpty();
}

// Check if game is over
function checkGameOver() {
    if (countEmpty() === 0) {
        const checked = new Set();
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col] && !checked.has(`${row},${col}`)) {
                    const connected = findConnected(row, col, board[row][col].color, new Set());
                    connected.forEach(pos => checked.add(`${pos.row},${pos.col}`));
                    if (connected.length >= MATCH_COUNT) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    return false;
}

// Process chain reactions
async function processChains() {
    isProcessing = true;
    chainCount = 0;

    while (true) {
        while (applyGravity()) {
            await sleep(50);
        }

        const removed = findAndRemoveMatches();
        if (removed === 0) break;

        await sleep(250);
    }

    if (checkGameOver()) {
        gameOver = true;
        stopBGM();
        playGameOverSound();
    }

    chainCount = 0;
    isProcessing = false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Draw game
function draw() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 1;
    for (let row = 0; row <= ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * CELL_SIZE);
        ctx.lineTo(BOARD_WIDTH, row * CELL_SIZE);
        ctx.stroke();
    }
    for (let col = 0; col <= COLS; col++) {
        ctx.beginPath();
        ctx.moveTo(col * CELL_SIZE, 0);
        ctx.lineTo(col * CELL_SIZE, BOARD_HEIGHT);
        ctx.stroke();
    }

    // Find potential matches
    const potentials = findPotentialMatches();
    const potentialSet = new Set(potentials.map(p => `${p.row},${p.col}`));

    for (let row = 0; row < ROWS; row++) {
        if (!board[row]) continue;
        for (let col = 0; col < COLS; col++) {
            const block = board[row][col];
            if (block) {
                if (block.animX) block.animX *= 0.8;
                if (block.animY) block.animY *= 0.8;
                if (Math.abs(block.animX || 0) < 1) block.animX = 0;
                if (Math.abs(block.animY || 0) < 1) block.animY = 0;

                const padding = 3;
                let x = col * CELL_SIZE + padding + (block.animX || 0);
                let y = row * CELL_SIZE + padding + (block.animY || 0);
                let size = CELL_SIZE - padding * 2;

                // Explosion animation
                if (block.exploding) {
                    const scale = 1.2;
                    const offset = (size * scale - size) / 2;
                    x -= offset;
                    y -= offset;
                    size *= scale;
                    ctx.globalAlpha = 0.7;
                }

                ctx.fillStyle = block.color;
                ctx.fillRect(x, y, size, size);

                // Highlight potential matches with pulsing border
                if (potentialSet.has(`${row},${col}`)) {
                    const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, size, size);
                }

                // New block indicator
                if (block.isNew) {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(x, y, size, size);
                    block.isNew = false;
                }

                ctx.globalAlpha = 1;
            }
        }
    }

    // Draw next blocks preview
    if (gameStarted && !gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(5, 5, 25, 80);

        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NEXT', 17, 15);

        nextBlocks.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.fillRect(8, 22 + i * 20, 18, 18);
        });
    }

    // Draw gravity indicator
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getGravityDirection(), BOARD_WIDTH/2, BOARD_HEIGHT/2);

    // Draw level and combo
    if (gameStarted && !gameOver && !gamePaused) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Lv.${level}`, BOARD_WIDTH - 5, 15);
        if (combo > 0) {
            ctx.fillStyle = '#ffe66d';
            ctx.fillText(`${combo} combo`, BOARD_WIDTH - 5, 30);
        }
    }

    // Draw touch indicator when touching
    if (activeTouchId !== null && gameStarted && !gameOver && !gamePaused) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(touchCurrentX, touchCurrentY, 40, 0, Math.PI * 2);
        ctx.fill();

        // Draw direction indicator
        const dx = touchCurrentX - touchStartX;
        const dy = touchCurrentY - touchStartY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > DEAD_ZONE) {
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(touchStartX, touchStartY);
            ctx.lineTo(touchCurrentX, touchCurrentY);
            ctx.stroke();
        }
    }

    // Draw overlays
    if (!gameStarted) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GRAVITY', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 80);
        ctx.fillText('PUZZLE', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 45);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px Arial';
        ctx.fillText('v1.5', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 140);

        ctx.fillStyle = '#fff';
        ctx.font = '13px Arial';
        ctx.fillText('スワイプで重力を操作', BOARD_WIDTH/2, BOARD_HEIGHT/2);
        ctx.fillText('同じ色を3つ繋げて消そう', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 20);
        ctx.fillText('連鎖とコンボで高得点！', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 40);

        ctx.fillStyle = '#ffe66d';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('▶ TAP TO START', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 90);
    } else if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 50);

        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText(`Score: ${score}`, BOARD_WIDTH/2, BOARD_HEIGHT/2);
        ctx.font = '14px Arial';
        ctx.fillText(`Level: ${level}  Max Combo: ${maxCombo}`, BOARD_WIDTH/2, BOARD_HEIGHT/2 + 25);

        ctx.fillStyle = '#ffe66d';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('TAP TO RESTART', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 70);
    } else if (gamePaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 20);

        ctx.fillStyle = '#ffe66d';
        ctx.font = '18px Arial';
        ctx.fillText('TAP TO RESUME', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 25);
    }
}

// Handle gravity change
function setGravity(newGravity) {
    if (isProcessing || gameOver) return;
    if (newGravity.x === gravity.x && newGravity.y === gravity.y) return;

    gravity = newGravity;
    combo = 0; // Reset combo when gravity changes
    playGravityChangeSound();
    processChains();
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Escape') {
        if (gameStarted && !gameOver) {
            gamePaused = !gamePaused;
        }
        return;
    }

    if (e.key === 'Enter') {
        if (!gameStarted) {
            initAudio();
            initBoard();
            gameStarted = true;
            gameRunning = true;
            lastBlockSpawn = performance.now();
            startBGM();
        } else if (gameOver) {
            initBoard();
            gameOver = false;
            lastBlockSpawn = performance.now();
            startBGM();
        }
        return;
    }

    if (gameOver || gamePaused || !gameStarted) return;

    switch (e.key) {
        case 'ArrowUp':
            setGravity({ x: 0, y: -1 });
            break;
        case 'ArrowDown':
            setGravity({ x: 0, y: 1 });
            break;
        case 'ArrowLeft':
            setGravity({ x: -1, y: 0 });
            break;
        case 'ArrowRight':
            setGravity({ x: 1, y: 0 });
            break;
    }
});

// ===============================
// TOUCH CONTROLS
// ===============================

let activeTouchId = null;
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let lastGravityFromTouch = null;
const DEAD_ZONE = 20;

function getDirectionFromTouch() {
    const dx = touchCurrentX - touchStartX;
    const dy = touchCurrentY - touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < DEAD_ZONE) {
        return null;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    } else {
        return dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
}

function updateGravityFromTouch() {
    if (!gameStarted || gameOver || gamePaused || isProcessing) return;

    const newDirection = getDirectionFromTouch();
    if (newDirection) {
        if (!lastGravityFromTouch ||
            newDirection.x !== lastGravityFromTouch.x ||
            newDirection.y !== lastGravityFromTouch.y) {
            lastGravityFromTouch = newDirection;
            setGravity(newDirection);
        }
    }
}

canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];

    if (!gameStarted) {
        initAudio();
        initBoard();
        gameStarted = true;
        gameRunning = true;
        lastBlockSpawn = performance.now();
        startBGM();
        e.preventDefault();
        return;
    }

    if (gameOver) {
        initBoard();
        gameOver = false;
        lastBlockSpawn = performance.now();
        startBGM();
        e.preventDefault();
        return;
    }

    if (gamePaused) {
        gamePaused = false;
        e.preventDefault();
        return;
    }

    if (activeTouchId === null) {
        activeTouchId = touch.identifier;
        const rect = canvas.getBoundingClientRect();
        touchStartX = touch.clientX - rect.left;
        touchStartY = touch.clientY - rect.top;
        touchCurrentX = touchStartX;
        touchCurrentY = touchStartY;
        lastGravityFromTouch = null;
    }

    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeTouchId) {
            const rect = canvas.getBoundingClientRect();
            touchCurrentX = touch.clientX - rect.left;
            touchCurrentY = touch.clientY - rect.top;
            updateGravityFromTouch();
            e.preventDefault();
            break;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
            updateGravityFromTouch();
            activeTouchId = null;
            lastGravityFromTouch = null;
            break;
        }
    }
}, { passive: true });

canvas.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
            activeTouchId = null;
            lastGravityFromTouch = null;
            break;
        }
    }
}, { passive: true });

canvas.addEventListener('click', (e) => {
    if ('ontouchstart' in window) return;

    if (!gameStarted) {
        initAudio();
        initBoard();
        gameStarted = true;
        gameRunning = true;
        lastBlockSpawn = performance.now();
        startBGM();
    } else if (gameOver) {
        initBoard();
        gameOver = false;
        lastBlockSpawn = performance.now();
        startBGM();
    } else if (gamePaused) {
        gamePaused = false;
    }
});

// Game loop
let lastBlockSpawn = 0;

function getSpawnInterval() {
    // Speed up as level increases
    return Math.max(1500, 3000 - (level - 1) * 200);
}

function gameLoop(timestamp) {
    if (gameRunning && !gameOver && !gamePaused && gameStarted) {
        // Spawn new blocks periodically
        if (!isProcessing && timestamp - lastBlockSpawn > getSpawnInterval()) {
            lastBlockSpawn = timestamp;
            spawnNewBlock();
        }

        // Update debug info
        const emptyCount = countEmpty();
        const fillPercent = Math.round((1 - emptyCount / (ROWS * COLS)) * 100);
        debugInfo.innerHTML = `Lv.${level} | ${fillPercent}% full`;
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Spawn a new block and let it fall
async function spawnNewBlock() {
    if (isProcessing || gameOver) return;

    const added = addNewBlocks(1, true);
    if (added.length > 0) {
        playSpawnSound();
        isProcessing = true;
        while (applyGravity()) {
            await sleep(50);
        }
        const removed = findAndRemoveMatches();
        if (removed > 0) {
            await sleep(200);
            await processChains();
        } else {
            isProcessing = false;
            combo = 0; // Reset combo if no match
        }

        if (checkGameOver()) {
            gameOver = true;
            stopBGM();
            playGameOverSound();
        }
    }
}

// Hide the HTML start button
startButton.style.display = 'none';

// Initial draw
draw();
requestAnimationFrame(gameLoop);
