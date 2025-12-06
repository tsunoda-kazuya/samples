// Gravity Puzzle - Minimal Implementation
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const debugInfo = document.getElementById('debugInfo');
const scoreDisplay = document.getElementById('score');

// Game constants
const COLS = 6;
const ROWS = 8;
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'];

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
let gameRunning = false;
let orientationPermission = false;

// Device orientation data
let tiltX = 0; // beta: front-back tilt
let tiltY = 0; // gamma: left-right tilt

// Initialize board with some blocks
function initBoard() {
    console.log('initBoard called, CELL_SIZE:', CELL_SIZE);
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = null;
        }
    }
    // Add initial blocks - guaranteed positions
    const positions = [
        {row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2},
        {row: 1, col: 0}, {row: 1, col: 3},
        {row: 2, col: 2}, {row: 2, col: 4},
        {row: 3, col: 1}, {row: 3, col: 5},
        {row: 4, col: 0}, {row: 4, col: 3},
        {row: 5, col: 2}, {row: 5, col: 4},
        {row: 6, col: 1}, {row: 6, col: 5}
    ];

    positions.forEach((pos, i) => {
        board[pos.row][pos.col] = {
            color: COLORS[i % COLORS.length],
            x: pos.col * CELL_SIZE,
            y: pos.row * CELL_SIZE,
            targetX: pos.col * CELL_SIZE,
            targetY: pos.row * CELL_SIZE
        };
        console.log(`Block at ${pos.row},${pos.col}: x=${pos.col * CELL_SIZE}, y=${pos.row * CELL_SIZE}`);
    });
}

// Request device orientation permission (iOS 13+)
async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response === 'granted') {
                orientationPermission = true;
                window.addEventListener('deviceorientation', handleOrientation);
                debugInfo.textContent = '傾き検知: 有効';
                return true;
            } else {
                debugInfo.textContent = '傾き検知: 拒否されました';
                return false;
            }
        } catch (e) {
            debugInfo.textContent = '傾き検知: エラー ' + e.message;
            return false;
        }
    } else if (window.DeviceOrientationEvent) {
        // Non-iOS or older iOS
        window.addEventListener('deviceorientation', handleOrientation);
        orientationPermission = true;
        debugInfo.textContent = '傾き検知: 有効 (自動)';
        return true;
    } else {
        debugInfo.textContent = '傾き検知: 非対応デバイス';
        // Fall back to keyboard/touch
        return false;
    }
}

// Handle device orientation
function handleOrientation(event) {
    // beta: front-back tilt (-180 to 180)
    // gamma: left-right tilt (-90 to 90)
    tiltX = event.beta || 0;
    tiltY = event.gamma || 0;

    // Count blocks for debug
    let blockCount = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row] && board[row][col]) blockCount++;
        }
    }

    // Update debug info
    debugInfo.innerHTML = `傾き β:${tiltX.toFixed(1)}° γ:${tiltY.toFixed(1)}°<br>重力: ${getGravityDirection()}<br>ブロック数: ${blockCount}`;
}

function getGravityDirection() {
    if (gravity.y > 0) return '↓ 下';
    if (gravity.y < 0) return '↑ 上';
    if (gravity.x > 0) return '→ 右';
    if (gravity.x < 0) return '← 左';
    return '中央';
}

// Update gravity based on tilt
function updateGravity() {
    const threshold = 20; // Degrees needed to change gravity

    // Determine dominant tilt direction
    // Device held in portrait mode: beta ~= 45-90 when upright
    // Adjust for natural holding position (subtract baseline)
    const adjustedTiltX = tiltX - 45; // Assume phone held at ~45 degrees

    if (Math.abs(tiltY) > Math.abs(adjustedTiltX)) {
        // Left-right tilt is dominant
        if (tiltY > threshold) {
            gravity = { x: 1, y: 0 }; // Right
        } else if (tiltY < -threshold) {
            gravity = { x: -1, y: 0 }; // Left
        }
    } else {
        // Front-back tilt is dominant
        if (adjustedTiltX > threshold) {
            gravity = { x: 0, y: 1 }; // Down (tilted toward you)
        } else if (adjustedTiltX < -threshold) {
            gravity = { x: 0, y: -1 }; // Up (tilted away from you)
        }
    }
}

// Apply gravity to all blocks
function applyGravity() {
    let moved = false;

    // Determine iteration order based on gravity direction
    let rowStart, rowEnd, rowStep;
    let colStart, colEnd, colStep;

    if (gravity.y > 0) { // Down
        rowStart = ROWS - 2; rowEnd = -1; rowStep = -1;
        colStart = 0; colEnd = COLS; colStep = 1;
    } else if (gravity.y < 0) { // Up
        rowStart = 1; rowEnd = ROWS; rowStep = 1;
        colStart = 0; colEnd = COLS; colStep = 1;
    } else if (gravity.x > 0) { // Right
        colStart = COLS - 2; colEnd = -1; colStep = -1;
        rowStart = 0; rowEnd = ROWS; rowStep = 1;
    } else { // Left
        colStart = 1; colEnd = COLS; colStep = 1;
        rowStart = 0; rowEnd = ROWS; rowStep = 1;
    }

    for (let row = rowStart; row !== rowEnd; row += rowStep) {
        for (let col = colStart; col !== colEnd; col += colStep) {
            if (board[row][col]) {
                const newRow = row + gravity.y;
                const newCol = col + gravity.x;

                // Check bounds
                if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                    // Check if destination is empty
                    if (!board[newRow][newCol]) {
                        // Move block
                        board[newRow][newCol] = board[row][col];
                        board[row][col] = null;

                        // Update target position for animation
                        board[newRow][newCol].targetX = newCol * CELL_SIZE;
                        board[newRow][newCol].targetY = newRow * CELL_SIZE;

                        moved = true;
                    }
                }
            }
        }
    }

    return moved;
}

// Find and remove matches (3+ same color in a line)
function findAndRemoveMatches() {
    const toRemove = new Set();

    // Check horizontal matches
    for (let row = 0; row < ROWS; row++) {
        let count = 1;
        let startCol = 0;
        for (let col = 1; col <= COLS; col++) {
            const current = board[row][col];
            const prev = board[row][col - 1];

            if (current && prev && current.color === prev.color) {
                count++;
            } else {
                if (count >= 3 && prev) {
                    for (let i = startCol; i < col; i++) {
                        toRemove.add(`${row},${i}`);
                    }
                }
                count = 1;
                startCol = col;
            }
        }
    }

    // Check vertical matches
    for (let col = 0; col < COLS; col++) {
        let count = 1;
        let startRow = 0;
        for (let row = 1; row <= ROWS; row++) {
            const current = board[row] ? board[row][col] : null;
            const prev = board[row - 1] ? board[row - 1][col] : null;

            if (current && prev && current.color === prev.color) {
                count++;
            } else {
                if (count >= 3 && prev) {
                    for (let i = startRow; i < row; i++) {
                        toRemove.add(`${i},${col}`);
                    }
                }
                count = 1;
                startRow = row;
            }
        }
    }

    // Remove matched blocks
    if (toRemove.size > 0) {
        score += toRemove.size * 10;
        scoreDisplay.textContent = `Score: ${score}`;

        toRemove.forEach(key => {
            const [row, col] = key.split(',').map(Number);
            board[row][col] = null;
        });

        return true;
    }

    return false;
}

// Add new blocks periodically
let blockTimer = 0;
function maybeAddBlock(deltaTime) {
    blockTimer += deltaTime;
    if (blockTimer > 2000) { // Every 2 seconds
        blockTimer = 0;

        // Find empty cells
        const emptyCells = [];
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (!board[row][col]) {
                    emptyCells.push({ row, col });
                }
            }
        }

        if (emptyCells.length > 0) {
            const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            board[cell.row][cell.col] = {
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                x: cell.col * CELL_SIZE,
                y: cell.row * CELL_SIZE,
                targetX: cell.col * CELL_SIZE,
                targetY: cell.row * CELL_SIZE
            };
        }
    }
}

// Animate blocks moving
function animateBlocks() {
    const speed = 0.2;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const block = board[row][col];
            if (block) {
                block.x += (block.targetX - block.x) * speed;
                block.y += (block.targetY - block.y) * speed;
            }
        }
    }
}

// Draw game
let drawCount = 0;
function draw() {
    drawCount++;
    if (drawCount % 60 === 1) {
        console.log('draw called, BOARD_WIDTH:', BOARD_WIDTH, 'BOARD_HEIGHT:', BOARD_HEIGHT, 'CELL_SIZE:', CELL_SIZE);
    }

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

    // Draw blocks using grid position directly (not block.x/y)
    let blocksDrawn = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const block = board[row][col];
            if (block) {
                const padding = 3;
                ctx.fillStyle = block.color;
                // Use row/col position directly instead of block.x/y
                ctx.fillRect(
                    col * CELL_SIZE + padding,
                    row * CELL_SIZE + padding,
                    CELL_SIZE - padding * 2,
                    CELL_SIZE - padding * 2
                );
                blocksDrawn++;
            }
        }
    }
    if (drawCount % 60 === 1) {
        console.log('Blocks drawn:', blocksDrawn);
    }

    // Draw gravity indicator
    const centerX = BOARD_WIDTH / 2;
    const centerY = BOARD_HEIGHT / 2;
    const arrowLength = 30;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + gravity.x * arrowLength, centerY + gravity.y * arrowLength);
    ctx.stroke();

    // Arrow head
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(
        centerX + gravity.x * arrowLength,
        centerY + gravity.y * arrowLength,
        6, 0, Math.PI * 2
    );
    ctx.fill();
}

// Keyboard controls (for desktop testing)
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
            gravity = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            gravity = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            gravity = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            gravity = { x: 1, y: 0 };
            break;
    }
});

// Game loop
let lastTime = 0;
let gravityTimer = 0;
let matchTimer = 0;

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (gameRunning) {
        // Update gravity from device orientation
        if (orientationPermission) {
            updateGravity();
        }

        // Apply gravity periodically
        gravityTimer += deltaTime;
        if (gravityTimer > 100) { // Every 100ms
            gravityTimer = 0;
            applyGravity();
        }

        // Check matches periodically
        matchTimer += deltaTime;
        if (matchTimer > 300) { // Every 300ms
            matchTimer = 0;
            findAndRemoveMatches();
        }

        // Add new blocks
        maybeAddBlock(deltaTime);

        // Animate
        animateBlocks();
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
startButton.addEventListener('click', async () => {
    console.log('Start button clicked');
    debugInfo.textContent = 'ゲーム開始処理中...';

    try {
        await requestOrientationPermission();
    } catch (e) {
        console.log('Orientation error:', e);
        debugInfo.textContent = '傾き検知: 非対応 (キーボードで操作)';
    }

    initBoard();
    gameRunning = true;
    startButton.style.display = 'none';

    // Debug: count blocks
    let count = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) count++;
        }
    }
    debugInfo.innerHTML = `ゲーム開始！<br>ブロック数: ${count}<br>矢印キーで操作`;
    console.log('Game started, blocks:', count);
});

// Initialize board immediately for testing
initBoard();
gameRunning = true;
startButton.style.display = 'none';

// Initial draw
draw();
requestAnimationFrame(gameLoop);
