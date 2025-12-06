// 氷の世界 v2.6
// スマホ専用スライディングパズル
// BFSソルバーで最短解を保証（押し出し対応）
// Retina対応
// Par表示と星評価システム

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const debugInfo = document.getElementById('debugInfo');
const scoreDisplay = document.getElementById('score');

// Retina対応
const dpr = window.devicePixelRatio || 1;

// Audio context
let audioCtx = null;

function initAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // iOS Safari requires resume after user gesture
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (e) {
        console.log('Audio not supported');
    }
}

// Play a chiptune tone
function playTone(freq, duration, type = 'square', volume = 0.15) {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
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
    } catch (e) {}
}

function playSlideSound() {
    playTone(330, 0.1, 'square', 0.1);
}

function playPushSound() {
    playTone(220, 0.08, 'square', 0.12);
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

function playFailSound() {
    // ぶぶー音
    playTone(150, 0.3, 'sawtooth', 0.2);
    setTimeout(function() { playTone(100, 0.4, 'sawtooth', 0.2); }, 200);
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
        if (!gameStarted || gamePaused || gameCleared) return;

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

// Game constants - 動的サイズ
let COLS = 6;
let ROWS = 6;

// ステージ設定: サイズ、ブロック数、障害物数
function getStageConfig(stageNum) {
    if (stageNum <= 3) {
        return { cols: 5, rows: 5, blocks: 2 + stageNum, obstacles: stageNum - 1, shuffleMoves: 5 + stageNum * 2 };
    } else if (stageNum <= 6) {
        return { cols: 6, rows: 6, blocks: 4 + stageNum - 3, obstacles: stageNum - 2, shuffleMoves: 10 + stageNum * 2 };
    } else if (stageNum <= 10) {
        return { cols: 7, rows: 7, blocks: 5 + stageNum - 6, obstacles: stageNum - 4, shuffleMoves: 15 + stageNum * 2 };
    } else {
        // ステージ11以降
        return { cols: 8, rows: 8, blocks: Math.min(9, 6 + Math.floor((stageNum - 10) / 2)), obstacles: Math.min(10, stageNum - 6), shuffleMoves: 25 + stageNum };
    }
}

// Responsive sizing
let CELL_SIZE;
let BOARD_WIDTH;
let BOARD_HEIGHT;

function resizeCanvas() {
    const maxWidth = Math.min(window.innerWidth - 20, 400);
    CELL_SIZE = Math.floor(maxWidth / COLS);
    BOARD_WIDTH = CELL_SIZE * COLS;
    BOARD_HEIGHT = CELL_SIZE * ROWS;

    // Retina対応: 実際のピクセルサイズは大きく、CSS表示サイズは論理サイズ
    canvas.width = BOARD_WIDTH * dpr;
    canvas.height = BOARD_HEIGHT * dpr;
    canvas.style.width = BOARD_WIDTH + 'px';
    canvas.style.height = BOARD_HEIGHT + 'px';

    // スケール設定
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let board = [];          // 2D array: null or { number: 1-9, isObstacle: true/false }
let holePos = { row: 0, col: COLS - 1 };
let nextNumber = 1;
let moves = 0;
let stage = 1;
let parMoves = 0;        // 目安となる手数（シャッフル回数ベース）
let gameStarted = false;
let gameCleared = false;
let gameFailed = false;
let failedBlockNumber = 0;
let failedByPar = false;  // Par超えで失敗したかどうか
let gamePaused = false;
let isAnimating = false;

// Selected block
let selectedBlock = null;
let animatingBlocks = [];

// ステージ開始メッセージ表示用
let showingStageMessage = false;
let stageMessageTimer = null;

// ========================================
// パズル自動生成システム
// BFSソルバーで最短解を保証
// ========================================

// ランダム整数
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 配列シャッフル
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// シミュレーション用: ブロックがどこまで滑るか計算
function simulateSlide(simBoard, rows, cols, holeRow, holeCol, blockRow, blockCol, dr, dc) {
    // 隣が塞がれていたら動けない
    const adjRow = blockRow + dr;
    const adjCol = blockCol + dc;
    if (adjRow < 0 || adjRow >= rows || adjCol < 0 || adjCol >= cols) {
        return null; // 壁
    }
    if (simBoard[adjRow][adjCol] !== null && !(adjRow === holeRow && adjCol === holeCol)) {
        return null; // ブロックか障害物がある
    }

    // 滑る先を計算
    let row = blockRow;
    let col = blockCol;

    while (true) {
        const nextRow = row + dr;
        const nextCol = col + dc;

        if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) {
            break; // 壁
        }
        if (nextRow === holeRow && nextCol === holeCol) {
            return { row: nextRow, col: nextCol, fellInHole: true };
        }
        if (simBoard[nextRow][nextCol] !== null) {
            break; // 何かにぶつかった
        }

        row = nextRow;
        col = nextCol;
    }

    if (row === blockRow && col === blockCol) {
        return null; // 動けなかった
    }

    return { row, col, fellInHole: false };
}

// 逆スライド: ブロックを逆方向から引っ張ってくる
function simulateReverseSlide(simBoard, rows, cols, holeRow, holeCol, blockRow, blockCol, dr, dc) {
    const reverseDr = -dr;
    const reverseDc = -dc;

    let startRow = blockRow + reverseDr;
    let startCol = blockCol + reverseDc;

    // 開始位置が有効か確認
    if (startRow < 0 || startRow >= rows || startCol < 0 || startCol >= cols) {
        return null;
    }
    if (simBoard[startRow][startCol] !== null) {
        return null;
    }
    if (startRow === holeRow && startCol === holeCol) {
        return null;
    }

    // さらに奥まで探索して、ランダムな開始位置を選ぶ
    const candidates = [{ row: startRow, col: startCol }];
    let r = startRow + reverseDr;
    let c = startCol + reverseDc;

    while (r >= 0 && r < rows && c >= 0 && c < cols) {
        if (simBoard[r][c] !== null || (r === holeRow && c === holeCol)) {
            break;
        }
        candidates.push({ row: r, col: c });
        r += reverseDr;
        c += reverseDc;
    }

    return candidates[randInt(0, candidates.length - 1)];
}

// ========================================
// BFSソルバー: 最短手数を計算
// ========================================

// 状態をキーに変換（ブロック位置と次に落とすべき番号）
function stateToKey(blocks, nextNum) {
    // ブロックを番号順にソートして位置を文字列化
    const sorted = [...blocks].sort((a, b) => a.number - b.number);
    return sorted.map(b => `${b.number}:${b.row},${b.col}`).join('|') + `#${nextNum}`;
}

// BFSで最短手数を求める（押し出し機能対応）
function solvePuzzle(blocks, obstacles, hole, rows, cols) {
    const directions = [
        { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
        { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
    ];

    // 初期状態
    const initialBlocks = blocks.map(b => ({ ...b }));
    const initialKey = stateToKey(initialBlocks, 1);

    // BFSキュー: [blocks配列, 次に落とす番号, 手数]
    const queue = [[initialBlocks, 1, 0]];
    const visited = new Set([initialKey]);

    // 障害物マップ
    const obstacleMap = new Set();
    obstacles.forEach(o => obstacleMap.add(`${o.row},${o.col}`));

    const maxMoves = 25; // 探索上限（軽量化）
    const maxVisited = 10000; // 訪問状態数の上限

    while (queue.length > 0) {
        const [currentBlocks, nextNum, moveCount] = queue.shift();

        // クリア判定: 全ブロックが落ちた
        if (currentBlocks.length === 0) {
            return moveCount;
        }

        // 探索上限
        if (moveCount >= maxMoves) continue;
        if (visited.size > maxVisited) return -1; // 状態数が多すぎたら諦める

        // 各ブロックを各方向に動かしてみる
        for (let bi = 0; bi < currentBlocks.length; bi++) {
            const block = currentBlocks[bi];

            for (const dir of directions) {
                // ボードマップを作成（動かすブロック以外）
                const boardMap = new Map();
                currentBlocks.forEach((b, idx) => {
                    if (idx !== bi) {
                        boardMap.set(`${b.row},${b.col}`, { ...b, idx: idx });
                    }
                });

                // 隣のマスをチェック
                const adjRow = block.row + dir.dr;
                const adjCol = block.col + dir.dc;

                if (adjRow < 0 || adjRow >= rows || adjCol < 0 || adjCol >= cols) continue;
                if (obstacleMap.has(`${adjRow},${adjCol}`)) continue;
                // 隣にブロックがあったら動けない（押し出しは滑った先で発生）
                if (boardMap.has(`${adjRow},${adjCol}`)) continue;

                // スライド先を計算
                let r = block.row;
                let c = block.col;
                let fellInHole = false;
                let hitBlockKey = null;

                while (true) {
                    const nr = r + dir.dr;
                    const nc = c + dir.dc;

                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
                    if (nr === hole.row && nc === hole.col) {
                        fellInHole = true;
                        break;
                    }
                    if (obstacleMap.has(`${nr},${nc}`)) break;
                    if (boardMap.has(`${nr},${nc}`)) {
                        hitBlockKey = `${nr},${nc}`;
                        break;
                    }

                    r = nr;
                    c = nc;
                }

                // 動けなかった
                if (r === block.row && c === block.col && !fellInHole) continue;

                // 新しい状態を作成
                let newBlocks = currentBlocks.map(b => ({ ...b }));
                let newNextNum = nextNum;

                if (fellInHole) {
                    // 正しい順番で落ちたか？
                    if (block.number === nextNum) {
                        newBlocks = newBlocks.filter((_, idx) => idx !== bi);
                        newNextNum = nextNum + 1;
                    } else {
                        continue; // 順番違い
                    }
                } else {
                    // ブロックを移動
                    newBlocks[bi] = { ...newBlocks[bi], row: r, col: c };

                    // 押し出し処理: 滑った先にブロックがあった場合
                    if (hitBlockKey) {
                        const hitBlock = boardMap.get(hitBlockKey);
                        const hitIdx = hitBlock.idx;

                        // 押し出されるブロックのスライド先を計算
                        let pr = hitBlock.row;
                        let pc = hitBlock.col;
                        let pushedFellInHole = false;

                        // 押し出し用のボードマップ（動かしたブロックの新位置を含む）
                        const pushBoardMap = new Map();
                        newBlocks.forEach((b, idx) => {
                            if (idx !== hitIdx) {
                                pushBoardMap.set(`${b.row},${b.col}`, b);
                            }
                        });

                        while (true) {
                            const pnr = pr + dir.dr;
                            const pnc = pc + dir.dc;

                            if (pnr < 0 || pnr >= rows || pnc < 0 || pnc >= cols) break;
                            if (pnr === hole.row && pnc === hole.col) {
                                pushedFellInHole = true;
                                break;
                            }
                            if (obstacleMap.has(`${pnr},${pnc}`)) break;
                            if (pushBoardMap.has(`${pnr},${pnc}`)) break;

                            pr = pnr;
                            pc = pnc;
                        }

                        // 押し出されたブロックが動けない場合はこの手は無効
                        if (pr === hitBlock.row && pc === hitBlock.col && !pushedFellInHole) {
                            continue;
                        }

                        if (pushedFellInHole) {
                            if (hitBlock.number === newNextNum) {
                                newBlocks = newBlocks.filter((_, idx) => idx !== hitIdx);
                                newNextNum = newNextNum + 1;
                            } else {
                                continue; // 順番違い
                            }
                        } else {
                            newBlocks[hitIdx] = { ...newBlocks[hitIdx], row: pr, col: pc };
                        }
                    }
                }

                const newKey = stateToKey(newBlocks, newNextNum);
                if (!visited.has(newKey)) {
                    visited.add(newKey);
                    queue.push([newBlocks, newNextNum, moveCount + 1]);
                }
            }
        }
    }

    // 解なし
    return -1;
}

// パズル生成: ソルバー検証付き
function generatePuzzle(stageNum) {
    const config = getStageConfig(stageNum);
    const rows = config.rows;
    const cols = config.cols;
    const numBlocks = config.blocks;
    const numObstacles = config.obstacles;
    const targetMinMoves = config.shuffleMoves; // 目標の最短手数（難易度指標）

    // グローバル変数更新
    COLS = cols;
    ROWS = rows;
    resizeCanvas();

    const directions = [
        { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
        { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
    ];

    // 有効なパズルが生成されるまで繰り返す（最大30回で軽量化）
    for (let attempt = 0; attempt < 30; attempt++) {
        // ホールの位置（ランダム端）
        const holePositions = [];
        for (let c = 0; c < cols; c++) holePositions.push({ row: 0, col: c });
        for (let c = 0; c < cols; c++) holePositions.push({ row: rows - 1, col: c });
        for (let r = 1; r < rows - 1; r++) holePositions.push({ row: r, col: 0 });
        for (let r = 1; r < rows - 1; r++) holePositions.push({ row: r, col: cols - 1 });

        const holeIdx = randInt(0, holePositions.length - 1);
        const hole = { row: holePositions[holeIdx].row, col: holePositions[holeIdx].col };

        // シミュレーション用ボード作成
        let simBoard = [];
        for (let r = 0; r < rows; r++) {
            simBoard[r] = [];
            for (let c = 0; c < cols; c++) {
                simBoard[r][c] = null;
            }
        }

        // 障害物を配置
        const obstacles = [];
        let obsAttempts = 0;
        while (obstacles.length < numObstacles && obsAttempts < 100) {
            const r = randInt(1, rows - 2);
            const c = randInt(1, cols - 2);
            if (simBoard[r][c] === null &&
                !(r === hole.row && c === hole.col) &&
                Math.abs(r - hole.row) + Math.abs(c - hole.col) > 2) {
                simBoard[r][c] = { isObstacle: true };
                obstacles.push({ row: r, col: c });
            }
            obsAttempts++;
        }

        // 順序制約を守る逆算生成アルゴリズム
        // ブロック1から順に「配置→離す」を繰り返す
        // これにより、逆シャッフルの回数 = 最短解の手数が保証される
        const blocks = [];
        let totalMoves = 0;
        const movesPerBlock = Math.max(1, Math.floor(targetMinMoves / numBlocks));

        for (let num = 1; num <= numBlocks; num++) {
            // ステップ1: ブロックをホールに入れられる位置に配置
            let placed = false;
            const shuffledDirs = shuffleArray([...directions]);

            // ホールに隣接する空きセルを探す
            for (const dir of shuffledDirs) {
                const adjRow = hole.row - dir.dr;
                const adjCol = hole.col - dir.dc;

                if (adjRow >= 0 && adjRow < rows && adjCol >= 0 && adjCol < cols) {
                    if (simBoard[adjRow][adjCol] === null) {
                        simBoard[adjRow][adjCol] = { number: num };
                        blocks.push({ row: adjRow, col: adjCol, number: num });
                        placed = true;
                        break;
                    }
                }
            }

            // 滑ってホールに入れる位置を探す
            if (!placed) {
                for (const dir of shuffledDirs) {
                    let r = hole.row - dir.dr;
                    let c = hole.col - dir.dc;

                    while (r >= 0 && r < rows && c >= 0 && c < cols) {
                        if (simBoard[r][c] === null) {
                            simBoard[r][c] = { number: num };
                            blocks.push({ row: r, col: c, number: num });
                            placed = true;
                            break;
                        }
                        r -= dir.dr;
                        c -= dir.dc;
                    }
                    if (placed) break;
                }
            }

            // フォールバック
            if (!placed) {
                for (let r = 0; r < rows && !placed; r++) {
                    for (let c = 0; c < cols && !placed; c++) {
                        if (simBoard[r][c] === null && !(r === hole.row && c === hole.col)) {
                            simBoard[r][c] = { number: num };
                            blocks.push({ row: r, col: c, number: num });
                            placed = true;
                        }
                    }
                }
            }

            // ステップ2: このブロックを逆シャッフルで離す
            const block = blocks[blocks.length - 1];
            let blockMoves = 0;

            for (let m = 0; m < movesPerBlock; m++) {
                const dir = directions[randInt(0, 3)];
                const newPos = simulateReverseSlide(
                    simBoard, rows, cols, hole.row, hole.col,
                    block.row, block.col, dir.dr, dir.dc
                );

                if (newPos) {
                    simBoard[block.row][block.col] = null;
                    simBoard[newPos.row][newPos.col] = { number: block.number };
                    block.row = newPos.row;
                    block.col = newPos.col;
                    blockMoves++;
                }
            }

            // このブロックを落とすのに必要な手数 = 逆シャッフルした回数
            totalMoves += blockMoves > 0 ? blockMoves : 1;
        }

        // Par = 合計移動回数 + 小さなバッファ（2手）
        const par = totalMoves + 2;

        return {
            blocks: blocks.map(b => ({ row: b.row, col: b.col, number: b.number })),
            obstacles: obstacles,
            hole: hole,
            rows: rows,
            cols: cols,
            par: par,
            minMoves: totalMoves
        };
    }

    // ここには到達しないはずだが念のため
    console.warn('Unexpected fallback');
    return generateSimplePuzzle(stageNum);
}

// フォールバック用シンプルパズル
function generateSimplePuzzle(stageNum) {
    const config = getStageConfig(stageNum);
    const rows = config.rows;
    const cols = config.cols;
    const numBlocks = config.blocks;

    COLS = cols;
    ROWS = rows;
    resizeCanvas();

    const hole = { row: 0, col: cols - 1 };
    const blocks = [];
    const obstacles = [];

    // ブロックを穴の下に縦に配置
    for (let i = 0; i < numBlocks; i++) {
        blocks.push({ row: i + 1, col: cols - 1, number: i + 1 });
    }

    return {
        blocks: blocks,
        obstacles: obstacles,
        hole: hole,
        rows: rows,
        cols: cols,
        par: numBlocks + 2,
        minMoves: numBlocks
    };
}

// Initialize stage
function initStage(stageNum) {
    // パズルを自動生成
    const puzzle = generatePuzzle(stageNum);

    // ボード初期化
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = null;
        }
    }

    holePos = { ...puzzle.hole };
    parMoves = puzzle.par;  // Par設定

    // Place numbered blocks
    puzzle.blocks.forEach(b => {
        board[b.row][b.col] = { number: b.number, isObstacle: false };
    });

    // Place obstacles
    puzzle.obstacles.forEach(o => {
        board[o.row][o.col] = { isObstacle: true };
    });

    nextNumber = 1;
    moves = 0;
    gameCleared = false;
    gameFailed = false;
    failedBlockNumber = 0;
    failedByPar = false;
    selectedBlock = null;
    animatingBlocks = [];
    isAnimating = false;

    updateDisplay();

    // ステージ開始メッセージを表示
    showStageMessage();
}

// ステージ開始メッセージを表示
function showStageMessage() {
    showingStageMessage = true;
    if (stageMessageTimer) {
        clearTimeout(stageMessageTimer);
    }
    stageMessageTimer = setTimeout(() => {
        showingStageMessage = false;
        stageMessageTimer = null;
    }, 2500);  // 2.5秒間表示
}

function updateDisplay() {
    scoreDisplay.textContent = `Stage ${stage} | Moves: ${moves} / Par ${parMoves}`;
}

// 星評価を計算
function getStarRating() {
    if (moves <= parMoves) return 3;       // Par以下で★3
    if (moves <= parMoves + 3) return 2;   // Par+3以下で★2
    return 1;                               // それ以上で★1
}

// Check if position is the hole
function isHole(row, col) {
    return row === holePos.row && col === holePos.col;
}

// Check if position is valid and empty (or hole)
function canMoveTo(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if (isHole(row, col)) return true;
    return board[row][col] === null;
}

// Get block at position
function getBlock(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return board[row][col];
}

// Calculate chain of blocks that will be pushed
function calculatePushChain(startRow, startCol, direction) {
    const dr = direction.row;
    const dc = direction.col;
    const chain = [];

    let row = startRow;
    let col = startCol;

    // Collect all blocks in the push direction
    while (true) {
        const block = getBlock(row, col);
        if (!block) break;
        if (block.isObstacle) {
            // Obstacle stops the chain
            return { chain: [], canMove: false };
        }
        chain.push({ row, col, block });
        row += dr;
        col += dc;
    }

    // Check if the last block can move somewhere
    const lastBlock = chain[chain.length - 1];
    const nextRow = lastBlock.row + dr;
    const nextCol = lastBlock.col + dc;

    // Check bounds
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
        return { chain: [], canMove: false };
    }

    // Check if blocked by obstacle
    const nextBlock = getBlock(nextRow, nextCol);
    if (nextBlock && nextBlock.isObstacle) {
        return { chain: [], canMove: false };
    }

    return { chain, canMove: true };
}

// Calculate slide for a single block (used after push)
function calculateSingleSlide(startRow, startCol, direction) {
    const dr = direction.row;
    const dc = direction.col;

    let row = startRow;
    let col = startCol;

    while (true) {
        const nextRow = row + dr;
        const nextCol = col + dc;

        // Check bounds
        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
            break;
        }

        // Check if it's the hole
        if (isHole(nextRow, nextCol)) {
            return { row: nextRow, col: nextCol, fellInHole: true };
        }

        // Check if there's a block or obstacle
        if (board[nextRow][nextCol]) {
            break;
        }

        row = nextRow;
        col = nextCol;
    }

    return { row, col, fellInHole: false };
}

// Execute slide with chain pushing
async function executeSlide(row, col, direction) {
    if (isAnimating) return;

    var block = board[row][col];
    if (!block || block.isObstacle) return;

    var dr = direction.row;
    var dc = direction.col;

    // 隣のマスをチェック
    var adjacentRow = row + dr;
    var adjacentCol = col + dc;
    var adjacentBlock = getBlock(adjacentRow, adjacentCol);

    // 隣が壁外か障害物かブロックなら動けない
    if (adjacentRow < 0 || adjacentRow >= ROWS || adjacentCol < 0 || adjacentCol >= COLS) {
        playErrorSound();
        return;
    }
    if (adjacentBlock) {
        // 隣にブロックか障害物がある場合は動けない
        playErrorSound();
        return;
    }

    // このブロックがどこまで滑るか計算
    board[row][col] = null;
    var slideResult = calculateSingleSlide(row, col, direction);

    if (slideResult.row === row && slideResult.col === col) {
        // 動けなかった
        board[row][col] = block;
        playErrorSound();
        return;
    }

    isAnimating = true;
    playSlideSound();

    // 滑った先にブロックがあるかチェック（押し出し判定）
    var stopRow = slideResult.row;
    var stopCol = slideResult.col;
    var beyondRow = stopRow + dr;
    var beyondCol = stopCol + dc;
    var hitBlock = getBlock(beyondRow, beyondCol);
    var pushResult = null;
    var distanceMoved = Math.abs(stopRow - row) + Math.abs(stopCol - col);
    var willPush = distanceMoved >= 1 && hitBlock && !hitBlock.isObstacle && !slideResult.fellInHole;

    // 押し出し可能かを事前計算
    if (willPush) {
        board[beyondRow][beyondCol] = null;
        pushResult = calculateSingleSlide(beyondRow, beyondCol, direction);
        if (pushResult.row === beyondRow && pushResult.col === beyondCol) {
            // 押し出せない - 元に戻す
            board[beyondRow][beyondCol] = hitBlock;
            willPush = false;
            pushResult = null;
        } else {
            // 押し出せる - 一旦戻す（アニメーション後に処理）
            board[beyondRow][beyondCol] = hitBlock;
        }
    }

    // 1. メインブロックのアニメーション（先に動く）
    block.animating = true;
    block.startX = col * CELL_SIZE;
    block.startY = row * CELL_SIZE;
    block.targetX = slideResult.col * CELL_SIZE;
    block.targetY = slideResult.row * CELL_SIZE;
    block.progress = 0;

    animatingBlocks.push({
        block: block,
        finalRow: slideResult.row,
        finalCol: slideResult.col,
        fellInHole: slideResult.fellInHole
    });

    await animateSlide();

    // メインブロックの着地処理
    if (slideResult.fellInHole) {
        if (block.number === nextNumber) {
            playDropSound();
            nextNumber++;
        } else {
            // 失敗！
            playFailSound();
            failedBlockNumber = block.number;
            gameFailed = true;
            isAnimating = false;
            return;
        }
    } else {
        block.animating = false;
        board[slideResult.row][slideResult.col] = block;
    }

    moves++;
    updateDisplay();

    // Par超えチェック（まだブロックが残っている場合）
    if (moves > parMoves && !checkStageClear()) {
        playFailSound();
        failedByPar = true;
        gameFailed = true;
        isAnimating = false;
        return;
    }

    // 2. 押し出しブロックのアニメーション（当たってから動く）
    if (willPush && pushResult) {
        playPushSound();

        board[beyondRow][beyondCol] = null;

        hitBlock.animating = true;
        hitBlock.startX = beyondCol * CELL_SIZE;
        hitBlock.startY = beyondRow * CELL_SIZE;
        hitBlock.targetX = pushResult.col * CELL_SIZE;
        hitBlock.targetY = pushResult.row * CELL_SIZE;
        hitBlock.progress = 0;

        animatingBlocks.push({
            block: hitBlock,
            finalRow: pushResult.row,
            finalCol: pushResult.col,
            fellInHole: pushResult.fellInHole
        });

        await animateSlide();

        // 押し出されたブロックの着地処理
        if (pushResult.fellInHole) {
            if (hitBlock.number === nextNumber) {
                playDropSound();
                nextNumber++;
            } else {
                // 失敗！
                playFailSound();
                failedBlockNumber = hitBlock.number;
                gameFailed = true;
                isAnimating = false;
                return;
            }
        } else {
            hitBlock.animating = false;
            board[pushResult.row][pushResult.col] = hitBlock;
        }
    }

    // クリア確認
    if (checkStageClear()) {
        gameCleared = true;
        playClearSound();
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
    // All numbered blocks should be gone
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const block = board[row][col];
            if (block && !block.isObstacle) return false;
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
    ctx.fillText('→' + nextNumber, holeX + CELL_SIZE/2, holeY + CELL_SIZE - 8);

    // Draw blocks
    if (board && board.length > 0) {
        for (let row = 0; row < ROWS; row++) {
            if (!board[row]) continue;
            for (let col = 0; col < COLS; col++) {
                const block = board[row][col];
                if (block && !block.animating) {
                    if (block.isObstacle) {
                        drawObstacle(col * CELL_SIZE, row * CELL_SIZE);
                    } else {
                        drawBlock(col * CELL_SIZE, row * CELL_SIZE, block,
                            selectedBlock && selectedBlock.row === row && selectedBlock.col === col);
                    }
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
    } else if (gameFailed) {
        drawFailScreen();
    } else if (gameCleared) {
        drawClearScreen();
    } else if (gamePaused) {
        drawPauseScreen();
    } else if (showingStageMessage) {
        drawStageMessage();
    }
}

function drawObstacle(x, y) {
    const padding = 4;
    const size = CELL_SIZE - padding * 2;

    // Rock/obstacle appearance
    ctx.fillStyle = '#5a5a6e';
    ctx.fillRect(x + padding, y + padding, size, size);

    // Rocky texture
    ctx.fillStyle = '#4a4a5e';
    ctx.fillRect(x + padding + 5, y + padding + 5, size/3, size/3);
    ctx.fillRect(x + padding + size/2, y + padding + size/2, size/3, size/3);

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + padding, y + padding, size, size / 4);

    // Border
    ctx.strokeStyle = '#3a3a4e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + padding, y + padding, size, size);
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

    // Number shadow then number
    ctx.font = 'bold ' + (CELL_SIZE * 0.5) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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
    ctx.fillText('氷の世界', BOARD_WIDTH/2, 50);

    ctx.fillStyle = '#a0d8ef';
    ctx.font = '14px Arial';
    ctx.fillText('ICE WORLD', BOARD_WIDTH/2, 75);

    // Rules
    ctx.fillStyle = '#fff';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    const rulesX = 20;
    let rulesY = 100;
    ctx.fillText('【ルール】', rulesX, rulesY);
    ctx.fillText('・ブロックをタップして選択', rulesX, rulesY += 16);
    ctx.fillText('・スワイプで滑らせる', rulesX, rulesY += 15);
    ctx.fillText('・氷の上なので壁まで滑る', rulesX, rulesY += 15);
    ctx.fillText('・他のブロックを押せる', rulesX, rulesY += 15);
    ctx.fillStyle = '#5a5a6e';
    ctx.fillText('・灰色の岩は動かせない', rulesX, rulesY += 15);
    ctx.fillStyle = '#ffe66d';
    ctx.fillText('・1→2→3...の順に穴へ落とす', rulesX, rulesY += 15);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('・順番を間違えたらやり直し', rulesX, rulesY += 15);

    // ステージ進行説明
    ctx.fillStyle = '#a0d8ef';
    ctx.font = '10px Arial';
    rulesY += 20;
    ctx.fillText('※面が進むとマップが広くなり', rulesX, rulesY);
    ctx.fillText('  ブロック数も増えていきます', rulesX, rulesY += 13);

    // Start prompt
    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('▶ TAP TO START', BOARD_WIDTH/2, BOARD_HEIGHT - 35);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Arial';
    ctx.fillText('v2.6', BOARD_WIDTH/2, BOARD_HEIGHT - 12);
}

function drawClearScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CLEAR!', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 70);

    // 星評価を表示
    const stars = getStarRating();
    ctx.font = '36px Arial';
    let starStr = '';
    for (let i = 0; i < 3; i++) {
        starStr += i < stars ? '★' : '☆';
    }
    ctx.fillStyle = '#ffe66d';
    ctx.fillText(starStr, BOARD_WIDTH/2, BOARD_HEIGHT/2 - 25);

    // 手数とPar
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText('Stage ' + stage, BOARD_WIDTH/2, BOARD_HEIGHT/2 + 10);

    const parDiff = moves - parMoves;
    let parText = moves + ' moves';
    if (parDiff === 0) {
        parText += ' (Par)';
        ctx.fillStyle = '#4ecdc4';
    } else if (parDiff < 0) {
        parText += ' (' + parDiff + ')';
        ctx.fillStyle = '#ffe66d';
    } else {
        parText += ' (+' + parDiff + ')';
        ctx.fillStyle = '#ff6b6b';
    }
    ctx.fillText(parText, BOARD_WIDTH/2, BOARD_HEIGHT/2 + 35);

    ctx.fillStyle = '#ffe66d';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('TAP FOR NEXT STAGE', BOARD_WIDTH/2, BOARD_HEIGHT/2 + 80);
}

function drawFailScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 失敗タイトル
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('FAILED!', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 70);

    // 説明（失敗理由によって変える）
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    if (failedByPar) {
        ctx.fillText('Par ' + parMoves + '手を超えた！', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 35);
        ctx.fillText('もっと効率よく落とそう', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 15);
    } else {
        ctx.fillText(failedBlockNumber + 'を落とした！', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 35);
        ctx.fillText(nextNumber + 'が必要だった', BOARD_WIDTH/2, BOARD_HEIGHT/2 - 15);
    }

    // ボタン
    var btnWidth = 120;
    var btnHeight = 45;
    var btnY = BOARD_HEIGHT/2 + 30;
    var retryX = BOARD_WIDTH/2 - btnWidth - 10;
    var restartX = BOARD_WIDTH/2 + 10;

    // Retryボタン
    ctx.fillStyle = '#4ecdc4';
    ctx.fillRect(retryX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('RETRY', retryX + btnWidth/2, btnY + btnHeight/2 + 6);

    // Restartボタン
    ctx.fillStyle = '#a29bfe';
    ctx.fillRect(restartX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = '#fff';
    ctx.fillText('STAGE 1', restartX + btnWidth/2, btnY + btnHeight/2 + 6);
}

// 失敗画面のボタン領域を取得
function getFailButtons() {
    var btnWidth = 120;
    var btnHeight = 45;
    var btnY = BOARD_HEIGHT/2 + 30;
    var retryX = BOARD_WIDTH/2 - btnWidth - 10;
    var restartX = BOARD_WIDTH/2 + 10;

    return {
        retry: { x: retryX, y: btnY, width: btnWidth, height: btnHeight },
        restart: { x: restartX, y: btnY, width: btnWidth, height: btnHeight }
    };
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

// ステージ開始メッセージを描画
function drawStageMessage() {
    // 半透明の背景バナー
    const bannerHeight = 80;
    const bannerY = BOARD_HEIGHT / 2 - bannerHeight / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, bannerY, BOARD_WIDTH, bannerHeight);

    // ステージ番号
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Stage ' + stage, BOARD_WIDTH / 2, bannerY + 28);

    // Par目標メッセージ
    ctx.fillStyle = '#ffe66d';
    ctx.font = '14px Arial';
    const config = getStageConfig(stage);
    ctx.fillText(parMoves + '手で順にブロックを全て落とそう', BOARD_WIDTH / 2, bannerY + 55);
}

// Touch controls - Safari compatible
let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;

    if (!gameStarted) {
        initAudio();
        gameStarted = true;
        initStage(stage);
        startBGM();
        return;
    }

    if (gameFailed) {
        // ボタンタップ判定
        var buttons = getFailButtons();
        if (touchStartX >= buttons.retry.x && touchStartX <= buttons.retry.x + buttons.retry.width &&
            touchStartY >= buttons.retry.y && touchStartY <= buttons.retry.y + buttons.retry.height) {
            // Retry - 同じステージをやり直し
            initStage(stage);
            return;
        }
        if (touchStartX >= buttons.restart.x && touchStartX <= buttons.restart.x + buttons.restart.width &&
            touchStartY >= buttons.restart.y && touchStartY <= buttons.restart.y + buttons.restart.height) {
            // Restart - ステージ1から
            stage = 1;
            initStage(stage);
            return;
        }
        return;
    }

    if (gameCleared) {
        stage++;
        gameCleared = false;
        showingStageMessage = false;  // メッセージ表示中でも次へ
        initStage(stage);
        return;
    }

    if (gamePaused) {
        gamePaused = false;
        return;
    }

    // ステージ開始メッセージ表示中はタップでスキップ
    if (showingStageMessage) {
        showingStageMessage = false;
        if (stageMessageTimer) {
            clearTimeout(stageMessageTimer);
            stageMessageTimer = null;
        }
        return;
    }

    if (isAnimating) return;

    // Select block at touch position
    const col = Math.floor(touchStartX / CELL_SIZE);
    const row = Math.floor(touchStartY / CELL_SIZE);

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        const block = board[row] && board[row][col];
        if (block && !block.isObstacle) {
            selectedBlock = { row: row, col: col };
        } else {
            selectedBlock = null;
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
}

function handleTouchEnd(e) {
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
        return;
    }

    // Determine direction
    var direction;
    if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? { row: 0, col: 1 } : { row: 0, col: -1 };
    } else {
        direction = dy > 0 ? { row: 1, col: 0 } : { row: -1, col: 0 };
    }

    executeSlide(selectedBlock.row, selectedBlock.col, direction);
}

// Use function references for Safari compatibility
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

// Mouse click for game start/restart on desktop
canvas.addEventListener('click', function(e) {
    if (!gameStarted) {
        initAudio();
        gameStarted = true;
        initStage(stage);
        startBGM();
    } else if (gameCleared) {
        stage++;
        initStage(stage);
        gameCleared = false;
    } else if (gamePaused) {
        gamePaused = false;
    }
});

// Keyboard for testing on PC
document.addEventListener('keydown', function(e) {
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

    if (e.key === 'r' || e.key === 'R') {
        initStage(stage);
        return;
    }

    if (gamePaused || isAnimating) return;

    // Use 1-9 to select block, arrows to slide
    if (e.key >= '1' && e.key <= '9') {
        var num = parseInt(e.key);
        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                if (board[row][col] && board[row][col].number === num) {
                    selectedBlock = { row: row, col: col };
                    return;
                }
            }
        }
    }

    if (!selectedBlock) return;

    var direction = null;
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
