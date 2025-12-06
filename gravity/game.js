// Gravity Puzzle - Balanced Implementation
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const debugInfo = document.getElementById('debugInfo');
const scoreDisplay = document.getElementById('score');

// Game constants
const COLS = 6;
const ROWS = 8;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];
const MATCH_COUNT = 3; // Number needed to match

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
let gravity = { x: 0, y: 1 }; // Default: down
let score = 0;
let chainCount = 0;
let gameRunning = false;
let gameOver = false;
let gamePaused = false;
let gameStarted = false;
let orientationPermission = false;
let isProcessing = false; // Prevent input during chain resolution

// Device orientation data
let tiltX = 0;
let tiltY = 0;

// Get a color that won't create a match at position
function getSafeColor(row, col) {
    const forbidden = new Set();

    // Check horizontal (left)
    if (col >= 2) {
        const c1 = board[row][col-1]?.color;
        const c2 = board[row][col-2]?.color;
        if (c1 && c1 === c2) forbidden.add(c1);
    }

    // Check vertical (up)
    if (row >= 2) {
        const c1 = board[row-1]?.[col]?.color;
        const c2 = board[row-2]?.[col]?.color;
        if (c1 && c1 === c2) forbidden.add(c1);
    }

    // Filter available colors
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

    // Fill bottom half with non-matching blocks
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

// Request device orientation permission (iOS 13+)
async function requestOrientationPermission() {
    debugInfo.textContent = '傾き許可リクエスト中...';

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires permission request
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            console.log('Orientation permission response:', response);
            if (response === 'granted') {
                orientationPermission = true;
                window.addEventListener('deviceorientation', handleOrientation);
                debugInfo.textContent = '傾き検知: 有効';
                return true;
            } else {
                debugInfo.textContent = '傾き検知: 拒否（スワイプで操作）';
                return false;
            }
        } catch (e) {
            console.log('Orientation error:', e);
            debugInfo.textContent = '傾き検知: エラー';
            return false;
        }
    } else if (window.DeviceOrientationEvent) {
        // Android or older iOS - no permission needed
        window.addEventListener('deviceorientation', handleOrientation);
        orientationPermission = true;
        debugInfo.textContent = '傾き検知: 有効';
        return true;
    } else {
        // No orientation support
        debugInfo.textContent = '傾き非対応（スワイプで操作）';
        return false;
    }
}

// Handle device orientation
function handleOrientation(event) {
    tiltX = event.beta || 0;
    tiltY = event.gamma || 0;
}

function getGravityDirection() {
    if (gravity.y > 0) return '↓';
    if (gravity.y < 0) return '↑';
    if (gravity.x > 0) return '→';
    if (gravity.x < 0) return '←';
    return '•';
}

// Update gravity based on tilt
function updateGravityFromTilt() {
    if (isProcessing) return;

    const threshold = 25;
    const adjustedTiltX = tiltX - 45;

    let newGravity = { ...gravity };

    if (Math.abs(tiltY) > Math.abs(adjustedTiltX)) {
        if (tiltY > threshold) {
            newGravity = { x: 1, y: 0 };
        } else if (tiltY < -threshold) {
            newGravity = { x: -1, y: 0 };
        }
    } else {
        if (adjustedTiltX > threshold) {
            newGravity = { x: 0, y: 1 };
        } else if (adjustedTiltX < -threshold) {
            newGravity = { x: 0, y: -1 };
        }
    }

    if (newGravity.x !== gravity.x || newGravity.y !== gravity.y) {
        gravity = newGravity;
    }
}

// Apply gravity - returns true if any block moved
function applyGravity() {
    let moved = false;

    // Determine iteration order based on gravity
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

                // Move as far as possible in gravity direction
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
                    board[newRow][newCol] = board[row][col];
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

    // Check 4 directions
    connected = connected.concat(findConnected(row-1, col, color, visited));
    connected = connected.concat(findConnected(row+1, col, color, visited));
    connected = connected.concat(findConnected(row, col-1, color, visited));
    connected = connected.concat(findConnected(row, col+1, color, visited));

    return connected;
}

// Find and remove matches - returns number of blocks removed
function findAndRemoveMatches() {
    const toRemove = new Set();

    // Check all blocks for groups of 3+
    const checked = new Set();

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col] && !checked.has(`${row},${col}`)) {
                const connected = findConnected(row, col, board[row][col].color, new Set());

                // Mark as checked
                connected.forEach(pos => checked.add(`${pos.row},${pos.col}`));

                // If 3 or more connected, mark for removal
                if (connected.length >= MATCH_COUNT) {
                    connected.forEach(pos => toRemove.add(`${pos.row},${pos.col}`));
                }
            }
        }
    }

    // Remove matched blocks
    if (toRemove.size > 0) {
        chainCount++;
        const chainBonus = chainCount > 1 ? chainCount : 1;
        const points = toRemove.size * 10 * chainBonus;
        score += points;
        scoreDisplay.textContent = `Score: ${score}`;

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

    // Determine spawn edge based on gravity
    let spawnPositions = [];

    if (gravity.y > 0) { // Gravity down, spawn from top
        for (let col = 0; col < COLS; col++) {
            if (!board[0][col]) spawnPositions.push({row: 0, col});
        }
    } else if (gravity.y < 0) { // Gravity up, spawn from bottom
        for (let col = 0; col < COLS; col++) {
            if (!board[ROWS-1][col]) spawnPositions.push({row: ROWS-1, col});
        }
    } else if (gravity.x > 0) { // Gravity right, spawn from left
        for (let row = 0; row < ROWS; row++) {
            if (!board[row][0]) spawnPositions.push({row, col: 0});
        }
    } else { // Gravity left, spawn from right
        for (let row = 0; row < ROWS; row++) {
            if (!board[row][COLS-1]) spawnPositions.push({row, col: COLS-1});
        }
    }

    // Shuffle and pick positions
    spawnPositions.sort(() => Math.random() - 0.5);
    const toAdd = Math.min(count, spawnPositions.length);

    for (let i = 0; i < toAdd; i++) {
        const pos = spawnPositions[i];
        board[pos.row][pos.col] = {
            color: getSafeColor(pos.row, pos.col)
        };
        added.push(pos);
    }

    return added;
}

// Count empty cells
function countEmpty() {
    let count = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (!board[row][col]) count++;
        }
    }
    return count;
}

// Count filled cells
function countBlocks() {
    return ROWS * COLS - countEmpty();
}

// Check if game is over (board is full and no matches possible)
function checkGameOver() {
    if (countEmpty() === 0) {
        // Check if any matches exist
        const checked = new Set();
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col] && !checked.has(`${row},${col}`)) {
                    const connected = findConnected(row, col, board[row][col].color, new Set());
                    connected.forEach(pos => checked.add(`${pos.row},${pos.col}`));
                    if (connected.length >= MATCH_COUNT) {
                        return false; // Match exists
                    }
                }
            }
        }
        return true; // No matches, game over
    }
    return false;
}

// Process chain reactions
async function processChains() {
    isProcessing = true;
    chainCount = 0;

    while (true) {
        // Apply gravity until stable
        while (applyGravity()) {
            await sleep(50);
        }

        // Check for matches
        const removed = findAndRemoveMatches();
        if (removed === 0) break;

        await sleep(200);
    }

    // Add new blocks if too few remain
    const blockCount = countBlocks();
    if (blockCount < ROWS * COLS * 0.4) {
        const toAdd = Math.floor(Math.random() * 3) + 2;
        addNewBlocks(toAdd);

        // Apply gravity to new blocks
        while (applyGravity()) {
            await sleep(50);
        }
    }

    // Check game over
    if (checkGameOver()) {
        gameOver = true;
    }

    chainCount = 0;
    isProcessing = false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Draw grid
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

    // Draw blocks
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const block = board[row][col];
            if (block) {
                const padding = 3;
                ctx.fillStyle = block.color;
                ctx.fillRect(
                    col * CELL_SIZE + padding,
                    row * CELL_SIZE + padding,
                    CELL_SIZE - padding * 2,
                    CELL_SIZE - padding * 2
                );
            }
        }
    }

    // Draw gravity indicator
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getGravityDirection(), BOARD_WIDTH/2, BOARD_HEIGHT/2);

    // Draw overlays
    if (!gameStarted) {
        // Start screen
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#4ecdc4';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GRAVITY', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 60);
        ctx.fillText('PUZZLE', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 25);

        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText('スマホを傾けて重力を操作', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 15);
        ctx.fillText('同じ色を3つ繋げて消そう', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 38);

        ctx.fillStyle = '#ffe66d';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('▶ タップでスタート', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 90);
    } else if (gameOver) {
        // Game over screen
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
        // Pause screen
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
let lastGravity = { x: 0, y: 1 };

function setGravity(newGravity) {
    if (isProcessing || gameOver) return;
    if (newGravity.x === gravity.x && newGravity.y === gravity.y) return;

    gravity = newGravity;
    processChains();
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // Space or Escape to pause/unpause
    if (e.key === ' ' || e.key === 'Escape') {
        if (gameStarted && !gameOver) {
            gamePaused = !gamePaused;
        }
        return;
    }

    // Enter to start/restart
    if (e.key === 'Enter') {
        if (!gameStarted) {
            initBoard();
            gameStarted = true;
            gameRunning = true;
        } else if (gameOver) {
            initBoard();
            gameOver = false;
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

// Touch/click handler
canvas.addEventListener('click', async (e) => {
    if (!gameStarted) {
        // Start game
        await requestOrientationPermission();
        initBoard();
        gameStarted = true;
        gameRunning = true;
    } else if (gameOver) {
        // Restart
        initBoard();
        gameOver = false;
    } else if (gamePaused) {
        // Resume
        gamePaused = false;
    }
});

// Swipe controls for mobile (fallback when orientation not available)
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    if (!gameStarted || gameOver || gamePaused) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
    if (!gameStarted || gameOver || gamePaused || isProcessing) return;
    if (orientationPermission) return; // Use tilt instead

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    // Require minimum swipe distance and speed
    const minDist = 30;
    const maxTime = 500;

    if (dt > maxTime) return;
    if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;

    e.preventDefault();

    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > 0) {
            setGravity({ x: 1, y: 0 }); // Right
        } else {
            setGravity({ x: -1, y: 0 }); // Left
        }
    } else {
        // Vertical swipe
        if (dy > 0) {
            setGravity({ x: 0, y: 1 }); // Down
        } else {
            setGravity({ x: 0, y: -1 }); // Up
        }
    }
}, { passive: false });

// Game loop
let lastOrientationCheck = 0;

function gameLoop(timestamp) {
    if (gameRunning && !gameOver && !gamePaused && gameStarted) {
        // Update gravity from device orientation (throttled)
        if (orientationPermission && timestamp - lastOrientationCheck > 200) {
            lastOrientationCheck = timestamp;
            const oldGravity = { ...gravity };
            updateGravityFromTilt();
            if (oldGravity.x !== gravity.x || oldGravity.y !== gravity.y) {
                processChains();
            }
        }

        // Update debug info
        if (orientationPermission) {
            debugInfo.innerHTML = `傾き β:${tiltX.toFixed(0)}° γ:${tiltY.toFixed(0)}°<br>ブロック: ${countBlocks()}`;
        } else {
            debugInfo.innerHTML = `矢印キー操作 / Space:ポーズ<br>ブロック: ${countBlocks()}`;
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Hide the HTML start button (we use canvas overlay instead)
startButton.style.display = 'none';

// Initial draw
draw();
requestAnimationFrame(gameLoop);
