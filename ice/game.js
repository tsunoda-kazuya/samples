// 氷の世界 v1.0
// スマホ専用スライディングパズル

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

// Play a chiptune tone
function playTone(freq, duration, type = 'square', volume = 0.15) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
}

function playSlideSound() {
    playTone(330, 0.1, 'square', 0.1);
}

function playDropSound() {
    playTone(880, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.15), 50);
}

function playClearSound() {
    [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.2, 'square', 0.15), i * 80);
    });
}

function playErrorSound() {
    playTone(200, 0.15, 'sawtooth', 0.1);
}

// BGM
let bgmPlaying = false;
let bgmInterval = null;
const BPM = 100;
let beatIndex = 0;

const melodyPattern = [
    392, 0, 440, 0, 523, 0, 440, 0,
    392, 0, 349, 0, 330, 0, 349, 0,
    392, 0, 440, 0, 523, 0, 587, 0,
    523, 0, 440, 0, 392, 0, 0, 0
];

const bassPattern = [
    131, 0, 0, 0, 165, 0, 0, 0,
    175, 0, 0, 0, 165, 0, 0, 0,
    131, 0, 0, 0, 165, 0, 0, 0,
    175, 0, 0, 0, 131, 0, 0, 0
];

function startBGM() {
    if (bgmPlaying) return;
    bgmPlaying = true;
    beatIndex = 0;

    bgmInterval = setInterval(() => {
        if (!gameStarted || gamePaused) return;

        const melody = melodyPattern[beatIndex];
        const bass = bassPattern[beatIndex];

        if (melody > 0) playTone(melody, 0.12, 'square', 0.08);
        if (bass > 0) playTone(bass, 0.15, 'triangle', 0.1);

        beatIndex = (beatIndex + 1) % melodyPattern.length;
    }, 60000 / BPM / 4);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
    bgmPlaying = false;
}

// Game constants
const COLS = 5;
const ROWS = 5;

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
let board = [];          // 2D array: null or { number: 1-9 }
let holePos = { row: 0, col: COLS - 1 }; // 右上に穴
let nextNumber = 1;      // 次に落とすべき番号
let moves = 0;
let stage = 1;
let gameStarted = false;
let gameCleared = false;
let gamePaused = false;
let isAnimating = false;

// Selected block
let selectedBlock = null;  // { row, col }
let animatingBlocks = [];  // 動いているブロックたち

// Stage definitions
const STAGES = [
    // Stage 1: 簡単な3ブロック
    {
        blocks: [
            { row: 2, col: 2, number: 1 },
            { row: 2, col: 1, number: 2 },
            { row: 2, col: 0, number: 3 }
        ],
        hole: { row: 0, col: 4 }
    },
    // Stage 2: 4ブロック
    {
        blocks: [
            { row: 3, col: 1, number: 1 },
            { row: 2, col: 3, number: 2 },
            { row: 1, col: 1, number: 3 },
            { row: 3, col: 3, number: 4 }
        ],
        hole: { row: 0, col: 4 }
    },
    // Stage 3: 5ブロック配置難しめ
    {
        blocks: [
            { row: 4, col: 0, number: 1 },
            { row: 4, col: 4, number: 2 },
            { row: 2, col: 2, number: 3 },
            { row: 0, col: 0, number: 4 },
            { row: 2, col: 4, number: 5 }
        ],
        hole: { row: 0, col: 4 }
    },
    // Stage 4: 6ブロック
    {
        blocks: [
            { row: 4, col: 2, number: 1 },
            { row: 3, col: 0, number: 2 },
            { row: 2, col: 4, number: 3 },
            { row: 1, col: 1, number: 4 },
            { row: 3, col: 3, number: 5 },
            { row: 4, col: 0, number: 6 }
        ],
        hole: { row: 0, col: 4 }
    },
    // Stage 5: 7ブロック複雑
    {
        blocks: [
            { row: 4, col: 4, number: 1 },
            { row: 3, col: 1, number: 2 },
            { row: 2, col: 3, number: 3 },
            { row: 1, col: 0, number: 4 },
            { row: 0, col: 2, number: 5 },
            { row: 3, col: 4, number: 6 },
            { row: 4, col: 1, number: 7 }
        ],
        hole: { row: 0, col: 4 }
    }
];

// Initialize stage
function initStage(stageNum) {
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = null;
        }
    }

    const stageData = STAGES[(stageNum - 1) % STAGES.length];
    holePos = { ...stageData.hole };

    stageData.blocks.forEach(b => {
        board[b.row][b.col] = { number: b.number };
    });

    nextNumber = 1;
    moves = 0;
    gameCleared = false;
    selectedBlock = null;
    animatingBlocks = [];
    isAnimating = false;

    updateDisplay();
}

function updateDisplay() {
    scoreDisplay.textContent = `Stage ${stage} | Moves: ${moves}`;
}

// Check if position is the hole
function isHole(row, col) {
    return row === holePos.row && col === holePos.col;
}

// Get block at position
function getBlock(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return board[row][col];
}

// Slide block in direction until it hits something
// Returns the path and final position
function calculateSlide(startRow, startCol, direction) {
    const dr = direction.row;
    const dc = direction.col;

    let row = startRow;
    let col = startCol;
    const path = [{ row, col }];

    while (true) {
        const nextRow = row + dr;
        const nextCol = col + dc;

        // Check bounds
        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
            break;
        }

        // Check if it's the hole - block falls in
        if (isHole(nextRow, nextCol)) {
            path.push({ row: nextRow, col: nextCol, isHole: true });
            return { path, fellInHole: true };
        }

        // Check if there's another block
        if (board[nextRow][nextCol]) {
            break;
        }

        row = nextRow;
        col = nextCol;
        path.push({ row, col });
    }

    return { path, fellInHole: false };
}

// Execute slide with animation
async function executeSlide(row, col, direction) {
    if (isAnimating) return;

    const block = board[row][col];
    if (!block) return;

    const result = calculateSlide(row, col, direction);

    if (result.path.length <= 1) {
        // Didn't move
        playErrorSound();
        return;
    }

    isAnimating = true;
    playSlideSound();

    // Remove from original position
    board[row][col] = null;

    // Animate
    const finalPos = result.path[result.path.length - 1];
    block.animating = true;
    block.startX = col * CELL_SIZE;
    block.startY = row * CELL_SIZE;
    block.targetX = finalPos.col * CELL_SIZE;
    block.targetY = finalPos.row * CELL_SIZE;
    block.progress = 0;

    animatingBlocks.push({
        block,
        finalRow: finalPos.row,
        finalCol: finalPos.col,
        fellInHole: result.fellInHole
    });

    // Wait for animation
    await animateSlide();

    moves++;
    updateDisplay();

    // Check if block fell in hole
    if (result.fellInHole) {
        if (block.number === nextNumber) {
            // Correct order!
            playDropSound();
            nextNumber++;

            // Check if stage cleared
            if (checkStageClear()) {
                gameCleared = true;
                playClearSound();
            }
        } else {
            // Wrong order - game over for this stage
            playErrorSound();
            debugInfo.textContent = `${block.number}を落とした！${nextNumber}が必要`;
            setTimeout(() => {
                initStage(stage);
            }, 1500);
        }
    } else {
        // Place block at final position
        block.animating = false;
        board[finalPos.row][finalPos.col] = block;
    }

    isAnimating = false;
    selectedBlock = null;
}

function animateSlide() {
    return new Promise(resolve => {
        const animate = () => {
            let allDone = true;

            animatingBlocks.forEach(ab => {
                if (ab.block.progress < 1) {
                    ab.block.progress += 0.15;
                    if (ab.block.progress > 1) ab.block.progress = 1;
                    allDone = false;
                }
            });

            if (allDone) {
                animatingBlocks = [];
                resolve();
            } else {
                requestAnimationFrame(animate);
            }
        };
        animate();
    });
}

function checkStageClear() {
    // All blocks should be in the hole
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) return false;
        }
    }
    return true;
}

// Drawing
function draw() {
    // Background - ice theme
    ctx.fillStyle = '#e0f4ff';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Draw ice grid
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const x = col * CELL_SIZE;
            const y = row * CELL_SIZE;

            // Ice tile
            const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
            gradient.addColorStop(0, '#cceeff');
            gradient.addColorStop(0.5, '#ffffff');
            gradient.addColorStop(1, '#b3e0ff');
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

            // Ice cracks
            ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 10, y + 10);
            ctx.lineTo(x + CELL_SIZE - 15, y + CELL_SIZE / 2);
            ctx.stroke();
        }
    }

    // Draw hole
    const holeX = holePos.col * CELL_SIZE;
    const holeY = holePos.row * CELL_SIZE;
    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(holeX + 5, holeY + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    ctx.fillStyle = '#0a0a2e';
    ctx.beginPath();
    ctx.arc(holeX + CELL_SIZE/2, holeY + CELL_SIZE/2, CELL_SIZE/3, 0, Math.PI * 2);
    ctx.fill();

    // Draw "GOAL" text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GOAL', holeX + CELL_SIZE/2, holeY + CELL_SIZE/2);

    // Draw next number indicator
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(`→${nextNumber}`, holeX + CELL_SIZE/2, holeY + CELL_SIZE - 8);

    // Draw blocks
    if (board && board.length > 0) {
        for (let row = 0; row < ROWS; row++) {
            if (!board[row]) continue;
            for (let col = 0; col < COLS; col++) {
                const block = board[row][col];
                if (block && !block.animating) {
                    drawBlock(col * CELL_SIZE, row * CELL_SIZE, block,
                        selectedBlock && selectedBlock.row === row && selectedBlock.col === col);
                }
            }
        }
    }

    // Draw animating blocks
    animatingBlocks.forEach(ab => {
        const block = ab.block;
        const x = block.startX + (block.targetX - block.startX) * block.progress;
        const y = block.startY + (block.targetY - block.startY) * block.progress;

        // Fade out if falling into hole
        if (ab.fellInHole && block.progress > 0.7) {
            ctx.globalAlpha = 1 - (block.progress - 0.7) / 0.3;
        }

        drawBlock(x, y, block, false);
        ctx.globalAlpha = 1;
    });

    // Draw overlays
    if (!gameStarted) {
        drawTitleScreen();
    } else if (gameCleared) {
        drawClearScreen();
    } else if (gamePaused) {
        drawPauseScreen();
    }
}

function drawBlock(x, y, block, isSelected) {
    const padding = 4;
    const size = CELL_SIZE - padding * 2;

    // Block shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + padding + 3, y + padding + 3, size, size);

    // Block body - color based on number
    const colors = [
        '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#a29bfe',
        '#fd79a8', '#74b9ff', '#55a3ff', '#ff7675'
    ];
    const color = colors[(block.number - 1) % colors.length];

    // Highlight if selected
    if (isSelected) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + padding - 3, y + padding - 3, size + 6, size + 6);
    }

    ctx.fillStyle = color;
    ctx.fillRect(x + padding, y + padding, size, size);

    // Block shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + padding, y + padding, size, size / 3);

    // Number
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${CELL_SIZE * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(block.number.toString(), x + CELL_SIZE/2, y + CELL_SIZE/2);

    // Number shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText(block.number.toString(), x + CELL_SIZE/2 + 2, y + CELL_SIZE/2 + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(block.number.toString(), x + CELL_SIZE/2, y + CELL_SIZE/2);
}

function drawTitleScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Title
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('氷の世界', BOARD_WIDTH/2, 60);

    ctx.fillStyle = '#a0d8ef';
    ctx.font = '14px Arial';
    ctx.fillText('ICE WORLD', BOARD_WIDTH/2, 85);

    // Rules
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    const rulesX = 25;
    let rulesY = 115;
    ctx.fillText('【ルール】', rulesX, rulesY);
    ctx.fillText('・ブロックをタップして選択', rulesX, rulesY += 20);
    ctx.fillText('・スワイプで滑らせる', rulesX, rulesY += 18);
    ctx.fillText('・氷の上なので壁まで滑る', rulesX, rulesY += 18);
    ctx.fillStyle = '#ffe66d';
    ctx.fillText('・1→2→3...の順に穴へ落とす', rulesX, rulesY += 18);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('・順番を間違えたらやり直し', rulesX, rulesY += 18);

    // Start prompt
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('▶ TAP TO START', BOARD_WIDTH/2, BOARD_HEIGHT - 40);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Arial';
    ctx.fillText('v1.0', BOARD_WIDTH/2, BOARD_HEIGHT - 15);
}

function drawClearScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CLEAR!', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 40);

    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText(`Stage ${stage}`, BOARD_WIDTH/2, BOARD_HEIGHT/2);
    ctx.fillText(`${moves} moves`, BOARD_WIDTH/2, BOARD_HEIGHT/2 + 25);

    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('TAP FOR NEXT STAGE', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 70);
}

function drawPauseScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', BOARD_WIDTH/2, BOARD_HEIGHT/2);

    ctx.fillStyle = '#ffe66d';
    ctx.font = '16px Arial';
    ctx.fillText('TAP TO RESUME', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 40);
}

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
    touchStartTime = Date.now();

    if (!gameStarted) {
        initAudio();
        gameStarted = true;
        initStage(stage);
        startBGM();
        return;
    }

    if (gameCleared) {
        stage++;
        initStage(stage);
        gameCleared = false;
        return;
    }

    if (gamePaused) {
        gamePaused = false;
        return;
    }

    if (isAnimating) return;

    // Select block at touch position
    const col = Math.floor(touchStartX / CELL_SIZE);
    const row = Math.floor(touchStartY / CELL_SIZE);

    if (board[row] && board[row][col]) {
        selectedBlock = { row, col };
    } else {
        selectedBlock = null;
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();

    if (!gameStarted || gameCleared || gamePaused || isAnimating) return;
    if (!selectedBlock) return;

    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const endX = touch.clientX - rect.left;
    const endY = touch.clientY - rect.top;

    const dx = endX - touchStartX;
    const dy = endY - touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Need minimum swipe distance
    if (distance < 30) {
        // Just a tap - keep selection
        return;
    }

    // Determine direction
    let direction;
    if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? { row: 0, col: 1 } : { row: 0, col: -1 };
    } else {
        direction = dy > 0 ? { row: 1, col: 0 } : { row: -1, col: 0 };
    }

    executeSlide(selectedBlock.row, selectedBlock.col, direction);
}, { passive: false });

// Keyboard for testing on PC
document.addEventListener('keydown', (e) => {
    if (!gameStarted) {
        initAudio();
        gameStarted = true;
        initStage(stage);
        startBGM();
        return;
    }

    if (gameCleared) {
        stage++;
        initStage(stage);
        gameCleared = false;
        return;
    }

    if (e.key === 'Escape') {
        gamePaused = !gamePaused;
        return;
    }

    if (gamePaused || isAnimating) return;

    // For testing: use 1-9 to select block, arrows to slide
    if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key);
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col] && board[row][col].number === num) {
                    selectedBlock = { row, col };
                    return;
                }
            }
        }
    }

    if (!selectedBlock) return;

    let direction = null;
    switch (e.key) {
        case 'ArrowUp': direction = { row: -1, col: 0 }; break;
        case 'ArrowDown': direction = { row: 1, col: 0 }; break;
        case 'ArrowLeft': direction = { row: 0, col: -1 }; break;
        case 'ArrowRight': direction = { row: 0, col: 1 }; break;
    }

    if (direction) {
        executeSlide(selectedBlock.row, selectedBlock.col, direction);
    }
});

// Game loop
function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}

// Hide HTML button
startButton.style.display = 'none';

// Start
requestAnimationFrame(gameLoop);
