// Gravity Puzzle v1.3
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const debugInfo = document.getElementById('debugInfo');
const scoreDisplay = document.getElementById('score');

// Audio context
let audioCtx = null;
let bgmGain = null;
let bgmPlaying = false;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.3;
    bgmGain.connect(audioCtx.destination);
}

// Play a simple tone
function playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Sound effects
function playMatchSound(chainCount) {
    if (!audioCtx) return;
    const baseFreq = 440 + (chainCount - 1) * 100;
    playTone(baseFreq, 0.15, 'sine', 0.4);
    setTimeout(() => playTone(baseFreq * 1.25, 0.15, 'sine', 0.3), 50);
    setTimeout(() => playTone(baseFreq * 1.5, 0.2, 'sine', 0.2), 100);
}

function playGravityChangeSound() {
    if (!audioCtx) return;
    playTone(220, 0.08, 'square', 0.15);
    setTimeout(() => playTone(330, 0.08, 'square', 0.12), 40);
}

function playGameOverSound() {
    if (!audioCtx) return;
    playTone(440, 0.3, 'sawtooth', 0.3);
    setTimeout(() => playTone(330, 0.3, 'sawtooth', 0.25), 200);
    setTimeout(() => playTone(220, 0.5, 'sawtooth', 0.2), 400);
}

function playSpawnSound() {
    if (!audioCtx) return;
    playTone(880, 0.05, 'sine', 0.1);
}

// BGM using simple oscillators
let bgmInterval = null;
const bgmNotes = [
    262, 294, 330, 349, 392, 440, 494, 523,
    523, 494, 440, 392, 349, 330, 294, 262
];
let bgmNoteIndex = 0;

function startBGM() {
    if (!audioCtx || bgmPlaying) return;
    bgmPlaying = true;
    bgmNoteIndex = 0;

    bgmInterval = setInterval(() => {
        if (!gamePaused && gameStarted && !gameOver) {
            const note = bgmNotes[bgmNoteIndex % bgmNotes.length];
            playTone(note, 0.4, 'sine', 0.08);
            bgmNoteIndex++;
        }
    }, 500);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
    bgmPlaying = false;
}

// Game constants
const COLS = 6;
const ROWS = 8;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];
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
let gameRunning = false;
let gameOver = false;
let gamePaused = false;
let gameStarted = false;
let isProcessing = false;

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

    for (let row = ROWS - 4; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            board[row][col] = {
                color: getSafeColor(row, col)
            };
        }
    }

    score = 0;
    chainCount = 0;
    gameOver = false;
    isProcessing = false;
    scoreDisplay.textContent = `Score: ${score}`;
}

function getGravityDirection() {
    if (gravity.y > 0) return '↓';
    if (gravity.y < 0) return '↑';
    if (gravity.x > 0) return '→';
    if (gravity.x < 0) return '←';
    return '•';
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
        const chainBonus = chainCount > 1 ? chainCount : 1;
        const points = toRemove.size * 10 * chainBonus;
        score += points;
        scoreDisplay.textContent = `Score: ${score}`;

        playMatchSound(chainCount);

        if (chainCount > 1) {
            debugInfo.innerHTML = `${chainCount}連鎖! +${points}`;
        }

        toRemove.forEach(key => {
            const [row, col] = key.split(',').map(Number);
            board[row][col] = null;
        });

        return toRemove.size;
    }

    return 0;
}

// Add new blocks from the opposite side of gravity
function addNewBlocks(count) {
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
        board[pos.row][pos.col] = {
            color: getSafeColor(pos.row, pos.col),
            animX: pos.offsetX || 0,
            animY: pos.offsetY || 0
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

        await sleep(200);
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

    for (let row = 0; row < ROWS; row++) {
        if (!board[row]) continue;
        for (let col = 0; col < COLS; col++) {
            const block = board[row][col];
            if (block) {
                if (block.animX) block.animX *= 0.85;
                if (block.animY) block.animY *= 0.85;
                if (Math.abs(block.animX || 0) < 1) block.animX = 0;
                if (Math.abs(block.animY || 0) < 1) block.animY = 0;

                const padding = 3;
                const x = col * CELL_SIZE + padding + (block.animX || 0);
                const y = row * CELL_SIZE + padding + (block.animY || 0);

                ctx.fillStyle = block.color;
                ctx.fillRect(x, y, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2);
            }
        }
    }

    // Draw gravity indicator
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getGravityDirection(), BOARD_WIDTH/2, BOARD_HEIGHT/2);

    // Draw touch indicator when touching
    if (activeTouchId !== null && gameStarted && !gameOver && !gamePaused) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(touchCurrentX, touchCurrentY, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw overlays
    if (!gameStarted) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GRAVITY', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 60);
        ctx.fillText('PUZZLE', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 25);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px Arial';
        ctx.fillText('v1.3', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 130);

        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText('スワイプで重力を操作', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 15);
        ctx.fillText('同じ色を3つ繋げて消そう', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 38);

        ctx.fillStyle = '#ffe66d';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('▶ タップでスタート', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 90);
    } else if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 30);

        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${score}`, BOARD_WIDTH/2, BOARD_HEIGHT/2 + 15);

        ctx.fillStyle = '#ffe66d';
        ctx.font = '18px Arial';
        ctx.fillText('タップでリスタート', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 55);
    } else if (gamePaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 20);

        ctx.fillStyle = '#ffe66d';
        ctx.font = '18px Arial';
        ctx.fillText('タップで再開', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 25);
    }
}

// Handle gravity change
function setGravity(newGravity) {
    if (isProcessing || gameOver) return;
    if (newGravity.x === gravity.x && newGravity.y === gravity.y) return;

    gravity = newGravity;
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
// TOUCH CONTROLS (Mario-style continuous tracking)
// ===============================

let activeTouchId = null;
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let lastGravityFromTouch = null;
const DEAD_ZONE = 15;  // Minimum distance to register direction

function getDirectionFromTouch() {
    const dx = touchCurrentX - touchStartX;
    const dy = touchCurrentY - touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < DEAD_ZONE) {
        return null;
    }

    // Determine direction based on angle
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal
        return dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    } else {
        // Vertical
        return dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
}

function updateGravityFromTouch() {
    if (!gameStarted || gameOver || gamePaused || isProcessing) return;

    const newDirection = getDirectionFromTouch();
    if (newDirection) {
        // Only trigger if direction changed
        if (!lastGravityFromTouch ||
            newDirection.x !== lastGravityFromTouch.x ||
            newDirection.y !== lastGravityFromTouch.y) {
            lastGravityFromTouch = newDirection;
            setGravity(newDirection);
        }
    }
}

// Handle touch start - also handles tap for start/restart/resume
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];

    // Handle game state transitions on tap
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

    // Start tracking touch for swipe
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

// Handle touch move - continuous direction tracking
canvas.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeTouchId) {
            const rect = canvas.getBoundingClientRect();
            touchCurrentX = touch.clientX - rect.left;
            touchCurrentY = touch.clientY - rect.top;

            // Update gravity continuously while moving
            updateGravityFromTouch();

            e.preventDefault();
            break;
        }
    }
}, { passive: false });

// Handle touch end
canvas.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
            // One final check on release
            updateGravityFromTouch();

            activeTouchId = null;
            lastGravityFromTouch = null;
            break;
        }
    }
}, { passive: true });

// Handle touch cancel
canvas.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
            activeTouchId = null;
            lastGravityFromTouch = null;
            break;
        }
    }
}, { passive: true });

// Click handler for PC
canvas.addEventListener('click', (e) => {
    // Only handle click if not a touch device (touch events handle this)
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
const SPAWN_INTERVAL = 3000;

function gameLoop(timestamp) {
    if (gameRunning && !gameOver && !gamePaused && gameStarted) {
        // Spawn new blocks periodically
        if (!isProcessing && timestamp - lastBlockSpawn > SPAWN_INTERVAL) {
            lastBlockSpawn = timestamp;
            spawnNewBlock();
        }

        // Update debug info
        debugInfo.innerHTML = `スワイプで操作<br>ブロック: ${countBlocks()}`;
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Spawn a new block and let it fall
async function spawnNewBlock() {
    if (isProcessing || gameOver) return;

    const added = addNewBlocks(1);
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
        }

        if (checkGameOver()) {
            gameOver = true;
            stopBGM();
            playGameOverSound();
        }
    }
}

// Hide the HTML start button (we use canvas overlay instead)
startButton.style.display = 'none';

// Initial draw
draw();
requestAnimationFrame(gameLoop);
