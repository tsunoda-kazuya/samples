// ========================
// PUYO PUYO 3D GAME
// ========================

// Three.js setup
let scene, camera, renderer;
let puyoMeshes = [];
let currentPuyoMeshes = [];
let ghostMeshes = [];
let particleSystems = [];

// Game constants
const COLS = 6;
const ROWS = 12;
const HIDDEN_ROWS = 1;
const CELL_SIZE = 1;
// Cute pastel colors for girls!
const COLORS = [0xFFB7C5, 0xB5EAD7, 0xA7C7E7, 0xFFF0B3, 0xE8D5E8];
const COLOR_NAMES = ['pink', 'mint', 'skyblue', 'lemon', 'lavender'];

// Sparkle particles
let sparkleParticles = [];
let heartParticles = [];

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

// Camera settings
let cameraMode = 0;
// Adjusted camera distance for mobile - further back to fit more on screen
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
// Mobile: move camera down to show board higher on screen (lower cameraY = board appears higher)
const cameraZ = isMobile ? 16 : 15;
const cameraY = isMobile ? 4 : 6;  // Lower camera position
const lookAtY = isMobile ? 5 : 6;  // Look slightly up
const cameraModes = [
    { pos: { x: 3, y: cameraY, z: cameraZ }, lookAt: { x: 3, y: lookAtY, z: 0 } },
    { pos: { x: 12, y: 6, z: 12 }, lookAt: { x: 3, y: 6, z: 0 } },
    { pos: { x: 3, y: 15, z: 10 }, lookAt: { x: 3, y: 6, z: 0 } },
    { pos: { x: -5, y: 8, z: 14 }, lookAt: { x: 3, y: 6, z: 0 } }
];

// Animation
let bounceTime = 0;

// Audio
let audioCtx = null;
let musicGain = null;

// Next canvas for 2D preview
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// ========================
// THREE.JS INITIALIZATION
// ========================

function initThree() {
    try {
        // Scene - cute pastel gradient background
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xFFF0F5); // Lavender blush
        scene.fog = new THREE.Fog(0xFFE4EC, 20, 40);

        // Camera
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        updateCameraPosition();

        // Renderer with fallback options for mobile
        const canvas = document.getElementById('gameCanvas');
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: !isMobile, // Disable antialiasing on mobile for performance
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false
        });
    } catch (e) {
        console.error('WebGL initialization failed:', e);
        alert('3D表示に失敗しました: ' + e.message);
        return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = !isMobile; // Disable shadows on mobile
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Soft, warm lighting for cute look
    const ambientLight = new THREE.AmbientLight(0xfff0f5, 0.8);
    scene.add(ambientLight);

    // Main pink-tinted light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    scene.add(mainLight);

    // Soft pink fill light
    const fillLight = new THREE.DirectionalLight(0xffb6c1, 0.5);
    fillLight.position.set(-5, 5, 5);
    scene.add(fillLight);

    // Lavender rim light
    const rimLight = new THREE.DirectionalLight(0xdda0dd, 0.4);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // Create game board frame
    createBoardFrame();

    // Create background elements
    createBackground();

    // Create sparkle effects
    createSparkles();

    // Handle resize
    window.addEventListener('resize', onWindowResize);
}

function updateCameraPosition() {
    const mode = cameraModes[cameraMode];
    camera.position.set(mode.pos.x, mode.pos.y, mode.pos.z);
    camera.lookAt(mode.lookAt.x, mode.lookAt.y, mode.lookAt.z);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function createBoardFrame() {
    // Cute pastel board back panel
    const backGeometry = new THREE.BoxGeometry(COLS + 0.5, ROWS + 0.5, 0.3);
    const backMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFF5EE, // Seashell white
        metalness: 0.1,
        roughness: 0.9
    });
    const backPanel = new THREE.Mesh(backGeometry, backMaterial);
    backPanel.position.set(COLS / 2 - 0.5, ROWS / 2 - 0.5, -0.3);
    backPanel.receiveShadow = true;
    scene.add(backPanel);

    // Soft pink grid lines
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0xFFB6C1, transparent: true, opacity: 0.4 });

    for (let x = 0; x <= COLS; x++) {
        const points = [
            new THREE.Vector3(x - 0.5, -0.5, 0),
            new THREE.Vector3(x - 0.5, ROWS - 0.5, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, gridMaterial);
        scene.add(line);
    }

    for (let y = 0; y <= ROWS; y++) {
        const points = [
            new THREE.Vector3(-0.5, y - 0.5, 0),
            new THREE.Vector3(COLS - 0.5, y - 0.5, 0)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, gridMaterial);
        scene.add(line);
    }

    // Cute pink frame with sparkle
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFB6C1,
        emissive: 0xFF69B4,
        emissiveIntensity: 0.2,
        metalness: 0.3,
        roughness: 0.5
    });

    // Top frame
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(COLS + 1, 0.4, 0.5), frameMaterial);
    topFrame.position.set(COLS / 2 - 0.5, ROWS, 0);
    scene.add(topFrame);

    // Bottom frame
    const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(COLS + 1, 0.4, 0.5), frameMaterial);
    bottomFrame.position.set(COLS / 2 - 0.5, -1, 0);
    scene.add(bottomFrame);

    // Left frame
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.4, ROWS + 1, 0.5), frameMaterial);
    leftFrame.position.set(-1, ROWS / 2 - 0.5, 0);
    scene.add(leftFrame);

    // Right frame
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.4, ROWS + 1, 0.5), frameMaterial);
    rightFrame.position.set(COLS, ROWS / 2 - 0.5, 0);
    scene.add(rightFrame);

    // Add cute corner decorations (hearts)
    addCornerHearts();
}

function addCornerHearts() {
    const heartShape = new THREE.Shape();
    const x = 0, y = 0;
    heartShape.moveTo(x + 0.25, y + 0.25);
    heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
    heartShape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
    heartShape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 0.95);
    heartShape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
    heartShape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
    heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

    const heartGeometry = new THREE.ExtrudeGeometry(heartShape, {
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 3
    });

    const heartMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF69B4,
        emissive: 0xFF1493,
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.3
    });

    // Corner positions
    const corners = [
        { x: -1.3, y: ROWS + 0.3, rot: 0 },
        { x: COLS + 0.3, y: ROWS + 0.3, rot: 0 },
        { x: -1.3, y: -1.3, rot: 0 },
        { x: COLS + 0.3, y: -1.3, rot: 0 }
    ];

    corners.forEach(corner => {
        const heart = new THREE.Mesh(heartGeometry, heartMaterial);
        heart.position.set(corner.x, corner.y, 0.2);
        heart.scale.set(0.5, 0.5, 0.5);
        heart.rotation.z = Math.PI;
        scene.add(heart);
    });
}

function createBackground() {
    // Cute floating star particles in background
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 150;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const starColors = [
        [1, 0.71, 0.76],    // Pink
        [0.87, 0.63, 0.87], // Plum
        [1, 0.94, 0.7],     // Light yellow
        [0.68, 0.85, 0.90], // Light blue
        [0.71, 0.92, 0.84]  // Mint
    ];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 8;

        const color = starColors[Math.floor(Math.random() * starColors.length)];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        vertexColors: true
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

// Create floating sparkle effects
function createSparkles() {
    const sparkleCount = 30;

    for (let i = 0; i < sparkleCount; i++) {
        const sparkleGeo = new THREE.OctahedronGeometry(0.08, 0);
        const sparkleMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });
        const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);

        sparkle.position.set(
            (Math.random() - 0.5) * 20 + 3,
            Math.random() * 15,
            (Math.random() - 0.5) * 10
        );

        sparkle.userData = {
            originalY: sparkle.position.y,
            speed: 0.5 + Math.random() * 1,
            offset: Math.random() * Math.PI * 2
        };

        scene.add(sparkle);
        sparkleParticles.push(sparkle);
    }
}

// ========================
// PUYO 3D MODELS - SUPER CUTE VERSION
// ========================

function createPuyoMesh(colorIndex, isGhost = false) {
    const color = COLORS[colorIndex];

    // Slightly squished sphere for cuter look
    const geometry = new THREE.SphereGeometry(0.44, 32, 32);

    let material;
    if (isGhost) {
        material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            metalness: 0.1,
            roughness: 0.9
        });
    } else {
        // Shiny, candy-like material
        material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.2,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.15
        });
    }

    const puyo = new THREE.Group();
    const body = new THREE.Mesh(geometry, material);
    body.scale.set(1, 0.9, 1); // Slightly squished
    body.castShadow = true;
    body.receiveShadow = true;
    puyo.add(body);

    if (!isGhost) {
        // Big cute eyes
        const eyeGeometry = new THREE.SphereGeometry(0.13, 16, 16);
        const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.5
        });

        // Cute dark brown pupils instead of black
        const eyePupilMaterial = new THREE.MeshStandardMaterial({
            color: 0x3D2314,
            metalness: 0.2,
            roughness: 0.3
        });

        // Left eye - bigger and cuter
        const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
        leftEyeWhite.position.set(-0.14, 0.08, 0.36);
        leftEyeWhite.scale.set(1, 1.1, 0.6);
        puyo.add(leftEyeWhite);

        const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), eyePupilMaterial);
        leftPupil.position.set(-0.14, 0.1, 0.44);
        puyo.add(leftPupil);

        // Left eye sparkle (kawaii!)
        const leftSparkle = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        leftSparkle.position.set(-0.11, 0.13, 0.48);
        puyo.add(leftSparkle);

        // Right eye
        const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
        rightEyeWhite.position.set(0.14, 0.08, 0.36);
        rightEyeWhite.scale.set(1, 1.1, 0.6);
        puyo.add(rightEyeWhite);

        const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), eyePupilMaterial);
        rightPupil.position.set(0.14, 0.1, 0.44);
        puyo.add(rightPupil);

        // Right eye sparkle
        const rightSparkle = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        rightSparkle.position.set(0.17, 0.13, 0.48);
        puyo.add(rightSparkle);

        // Cute rosy cheeks (blush)
        const cheekMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFB6C1,
            transparent: true,
            opacity: 0.6
        });

        const leftCheek = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), cheekMaterial);
        leftCheek.position.set(-0.25, -0.05, 0.38);
        leftCheek.rotation.y = -0.3;
        puyo.add(leftCheek);

        const rightCheek = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), cheekMaterial);
        rightCheek.position.set(0.25, -0.05, 0.38);
        rightCheek.rotation.y = 0.3;
        puyo.add(rightCheek);

        // Main highlight/shine (bigger and shinier)
        const highlightGeometry = new THREE.SphereGeometry(0.14, 16, 16);
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7
        });
        const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        highlight.position.set(-0.18, 0.22, 0.28);
        puyo.add(highlight);

        // Secondary small highlight
        const highlight2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 16, 16),
            highlightMaterial
        );
        highlight2.position.set(-0.08, 0.28, 0.3);
        puyo.add(highlight2);

        // Cute small mouth (smile)
        const smileShape = new THREE.Shape();
        smileShape.absarc(0, 0, 0.06, Math.PI * 0.1, Math.PI * 0.9, false);
        const smileGeo = new THREE.ShapeGeometry(smileShape);
        const smileMat = new THREE.MeshBasicMaterial({
            color: 0x3D2314,
            side: THREE.DoubleSide
        });
        const smile = new THREE.Mesh(smileGeo, smileMat);
        smile.position.set(0, -0.1, 0.42);
        smile.scale.set(0.8, 0.5, 1);
        puyo.add(smile);
    }

    puyo.userData = { colorIndex, isGhost };
    return puyo;
}

function updateBoardMeshes() {
    // Remove old meshes
    puyoMeshes.forEach(mesh => scene.remove(mesh));
    puyoMeshes = [];

    // Create new meshes for board
    for (let y = HIDDEN_ROWS; y < ROWS + HIDDEN_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== null) {
                const mesh = createPuyoMesh(board[y][x]);
                const displayY = ROWS - 1 - (y - HIDDEN_ROWS);
                mesh.position.set(x, displayY, 0);

                // Add subtle bounce animation based on position
                mesh.userData.baseY = displayY;
                mesh.userData.bounceOffset = (x + y) * 0.5;

                scene.add(mesh);
                puyoMeshes.push(mesh);
            }
        }
    }
}

function updateCurrentPuyoMeshes() {
    // Remove old current puyo meshes
    currentPuyoMeshes.forEach(mesh => scene.remove(mesh));
    currentPuyoMeshes = [];
    ghostMeshes.forEach(mesh => scene.remove(mesh));
    ghostMeshes = [];

    if (!currentPuyo || animating) return;

    // Main puyo
    const displayY1 = ROWS - 1 - (currentPuyo.y - HIDDEN_ROWS);
    const mesh1 = createPuyoMesh(currentPuyo.color1);
    mesh1.position.set(currentPuyo.x, displayY1, 0);
    scene.add(mesh1);
    currentPuyoMeshes.push(mesh1);

    // Second puyo
    const second = getSecondPuyoPos(currentPuyo);
    const displayY2 = ROWS - 1 - (second.y - HIDDEN_ROWS);
    const mesh2 = createPuyoMesh(currentPuyo.color2);
    mesh2.position.set(second.x, displayY2, 0);
    scene.add(mesh2);
    currentPuyoMeshes.push(mesh2);

    // Ghost preview
    let ghostY = currentPuyo.y;
    while (canMove({ ...currentPuyo, y: ghostY }, 0, 1)) {
        ghostY++;
    }

    if (ghostY !== currentPuyo.y) {
        const ghostPuyo = { ...currentPuyo, y: ghostY };
        const ghostSecond = getSecondPuyoPos(ghostPuyo);

        const ghostDisplayY1 = ROWS - 1 - (ghostPuyo.y - HIDDEN_ROWS);
        const ghostMesh1 = createPuyoMesh(ghostPuyo.color1, true);
        ghostMesh1.position.set(ghostPuyo.x, ghostDisplayY1, 0);
        scene.add(ghostMesh1);
        ghostMeshes.push(ghostMesh1);

        const ghostDisplayY2 = ROWS - 1 - (ghostSecond.y - HIDDEN_ROWS);
        const ghostMesh2 = createPuyoMesh(ghostPuyo.color2, true);
        ghostMesh2.position.set(ghostSecond.x, ghostDisplayY2, 0);
        scene.add(ghostMesh2);
        ghostMeshes.push(ghostMesh2);
    }
}

// ========================
// CUTE PARTICLE EFFECTS - Hearts and Stars!
// ========================

function createExplosionParticles(x, y, colorIndex) {
    const particleCount = 25;
    const color = COLORS[colorIndex];

    // Create cute heart and star shaped particles
    for (let i = 0; i < particleCount; i++) {
        let particleMesh;

        if (Math.random() > 0.5) {
            // Star shape
            const starShape = new THREE.Shape();
            const outerRadius = 0.1;
            const innerRadius = 0.04;
            const spikes = 5;

            for (let j = 0; j < spikes * 2; j++) {
                const radius = j % 2 === 0 ? outerRadius : innerRadius;
                const angle = (j * Math.PI) / spikes - Math.PI / 2;
                const px = Math.cos(angle) * radius;
                const py = Math.sin(angle) * radius;
                if (j === 0) starShape.moveTo(px, py);
                else starShape.lineTo(px, py);
            }
            starShape.closePath();

            const starGeo = new THREE.ShapeGeometry(starShape);
            const starMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFFD700 : 0xFFFFFF,
                transparent: true,
                opacity: 1,
                side: THREE.DoubleSide
            });
            particleMesh = new THREE.Mesh(starGeo, starMat);
        } else {
            // Heart shape
            const heartShape = new THREE.Shape();
            heartShape.moveTo(0, 0.05);
            heartShape.bezierCurveTo(0.05, 0.1, 0.1, 0.05, 0.1, 0);
            heartShape.bezierCurveTo(0.1, -0.05, 0.05, -0.1, 0, -0.08);
            heartShape.bezierCurveTo(-0.05, -0.1, -0.1, -0.05, -0.1, 0);
            heartShape.bezierCurveTo(-0.1, 0.05, -0.05, 0.1, 0, 0.05);

            const heartGeo = new THREE.ShapeGeometry(heartShape);
            const heartMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? color : 0xFF69B4,
                transparent: true,
                opacity: 1,
                side: THREE.DoubleSide
            });
            particleMesh = new THREE.Mesh(heartGeo, heartMat);
        }

        particleMesh.position.set(x, y, 0.5);
        particleMesh.userData = {
            velocity: {
                x: (Math.random() - 0.5) * 0.4,
                y: Math.random() * 0.3 + 0.1,
                z: (Math.random() - 0.5) * 0.4
            },
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            life: 1.0,
            decay: 0.015 + Math.random() * 0.01
        };

        scene.add(particleMesh);
        heartParticles.push(particleMesh);
    }
}

function updateHeartParticles() {
    for (let i = heartParticles.length - 1; i >= 0; i--) {
        const p = heartParticles[i];
        const v = p.userData.velocity;

        p.position.x += v.x;
        p.position.y += v.y;
        p.position.z += v.z;
        p.rotation.z += p.userData.rotationSpeed;

        v.y -= 0.008; // Gentle gravity

        p.userData.life -= p.userData.decay;
        p.material.opacity = p.userData.life;
        p.scale.setScalar(0.8 + p.userData.life * 0.5);

        if (p.userData.life <= 0) {
            scene.remove(p);
            heartParticles.splice(i, 1);
        }
    }
}

// Legacy particle function for compatibility
function createExplosionParticlesLegacy(x, y, colorIndex) {
    const particleCount = 20;
    const color = COLORS[colorIndex];

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = 0;

        velocities.push({
            x: (Math.random() - 0.5) * 0.3,
            y: (Math.random() - 0.5) * 0.3 + 0.1,
            z: (Math.random() - 0.5) * 0.3
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: color,
        size: 0.15,
        transparent: true,
        opacity: 1
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData = {
        velocities,
        life: 1,
        decay: 0.02
    };

    scene.add(particles);
    particleSystems.push(particles);
}

function updateParticles() {
    for (let i = particleSystems.length - 1; i >= 0; i--) {
        const particles = particleSystems[i];
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.userData.velocities;

        for (let j = 0; j < velocities.length; j++) {
            positions[j * 3] += velocities[j].x;
            positions[j * 3 + 1] += velocities[j].y;
            positions[j * 3 + 2] += velocities[j].z;
            velocities[j].y -= 0.01; // gravity
        }

        particles.geometry.attributes.position.needsUpdate = true;
        particles.userData.life -= particles.userData.decay;
        particles.material.opacity = particles.userData.life;

        if (particles.userData.life <= 0) {
            scene.remove(particles);
            particleSystems.splice(i, 1);
        }
    }
}

// ========================
// AUDIO SYSTEM
// ========================

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.3;
        musicGain.connect(audioCtx.destination);
    }
}

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

function playMoveSound() { playSound(200, 0.05); }
function playRotateSound() { playSound(400, 0.08); }
function playDropSound() { playSound(150, 0.1); }

function playChainSound(chainCount) {
    const baseFreq = 300 + chainCount * 100;
    playSound(baseFreq, 0.2);
    setTimeout(() => playSound(baseFreq * 1.5, 0.2), 100);
    setTimeout(() => playSound(baseFreq * 2, 0.3), 200);
}

function playGameOverSound() {
    let freq = 400;
    for (let i = 0; i < 5; i++) {
        setTimeout(() => playSound(freq - i * 50, 0.3, 'sawtooth'), i * 150);
    }
}

// ========================
// CHIPTUNE MUSIC
// ========================

// ========================
// PERFUME-STYLE ELECTROPOP MUSIC
// ========================

class PerfumeMusicPlayer {
    constructor(audioCtx, masterGain) {
        this.audioCtx = audioCtx;
        this.masterGain = masterGain;
        this.isPlaying = false;
        this.nodes = [];
        this.timeouts = [];
        this.currentBeat = 0;
        this.bpm = 128; // Classic electropop tempo
        this.beatLength = 60 / this.bpm;

        // Create effects chain
        this.setupEffects();
    }

    setupEffects() {
        // Compressor for that pumping sound
        this.compressor = this.audioCtx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;

        // Filter for synth sweeps
        this.filter = this.audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 8000;
        this.filter.Q.value = 1;

        // Delay for spacey feel
        this.delay = this.audioCtx.createDelay();
        this.delay.delayTime.value = this.beatLength * 0.75;
        this.delayGain = this.audioCtx.createGain();
        this.delayGain.gain.value = 0.2;

        // Reverb simulation with delay feedback
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

    // Supersaw-style synth (multiple detuned oscillators)
    playSupersaw(freq, duration, volume = 0.08) {
        if (!this.isPlaying) return;

        const startTime = this.audioCtx.currentTime;
        const detunes = [-12, -7, -3, 0, 3, 7, 12]; // Cents detune for thick sound

        detunes.forEach(detune => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.detune.value = detune;

            // ADSR envelope
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

    // Plucky synth for arpeggios
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

        // Sharp attack, quick decay
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

    // Vocoder-style pad sound
    playVocoderPad(freqs, duration, volume = 0.06) {
        if (!this.isPlaying) return;

        const startTime = this.audioCtx.currentTime;

        freqs.forEach(freq => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const filter = this.audioCtx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            // Formant-like filter
            filter.type = 'bandpass';
            filter.frequency.value = freq * 2;
            filter.Q.value = 8;

            // Slow attack for pad feel
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

    // Four-on-the-floor kick with sidechain ducking effect
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

        // Sidechain effect - duck the filter
        this.filter.frequency.setValueAtTime(2000, startTime);
        this.filter.frequency.linearRampToValueAtTime(8000, startTime + this.beatLength * 0.8);

        this.nodes.push({ osc, gain });
    }

    // Snappy electro snare
    playSnare() {
        if (!this.isPlaying) return;

        const startTime = this.audioCtx.currentTime;

        // Body
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

        // Noise
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

    // Hi-hat with filtering
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

    // Perfume-style chord progression
    playChords(beat) {
        const section = Math.floor(beat / 32) % 2;
        const chordIndex = Math.floor(beat / 8) % 4;

        // Two different progressions for variety
        const progressions = [
            // Progression A - bright and uplifting
            [
                [['A', 4], ['C#', 5], ['E', 5]], // A major
                [['F#', 4], ['A', 4], ['C#', 5]], // F#m
                [['D', 4], ['F#', 4], ['A', 4]], // D major
                [['E', 4], ['G#', 4], ['B', 4]], // E major
            ],
            // Progression B - more emotional
            [
                [['C#', 4], ['E', 4], ['G#', 4]], // C#m
                [['A', 4], ['C#', 5], ['E', 5]], // A major
                [['B', 4], ['D#', 5], ['F#', 5]], // B major
                [['E', 4], ['G#', 4], ['B', 4]], // E major
            ]
        ];

        const chord = progressions[section][chordIndex];
        const beatInChord = beat % 8;

        // Play pad on chord changes
        if (beatInChord === 0) {
            const freqs = chord.map(([note, oct]) => this.noteToFreq(note, oct));
            this.playVocoderPad(freqs, this.beatLength * 7.5, 0.05);
        }

        // Supersaw stabs on beats 0 and 4
        if (beatInChord === 0 || beatInChord === 4) {
            const [note, oct] = chord[0];
            this.playSupersaw(this.noteToFreq(note, oct), this.beatLength * 0.5, 0.1);
        }
    }

    // Catchy arpeggio pattern
    playArpeggio(beat) {
        const section = Math.floor(beat / 32) % 2;
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

        // Rhythmic pattern - 16th note feel
        const subBeat = beat % 8;
        const pattern = [1, 0, 1, 1, 0, 1, 1, 0]; // Perfume-style pattern

        if (pattern[subBeat]) {
            this.playPluck(this.noteToFreq(note, oct), this.beatLength * 0.3, 0.1);
        }
    }

    // Lead melody - catchy and memorable
    playLead(beat) {
        const bar = Math.floor(beat / 16) % 4;
        const beatInBar = beat % 16;

        // Melody patterns for each bar
        const melodies = [
            // Bar 1 - ascending
            { 0: ['E', 5], 2: ['F#', 5], 4: ['G#', 5], 6: ['A', 5], 8: ['B', 5], 12: ['A', 5] },
            // Bar 2 - descending
            { 0: ['C#', 6], 4: ['B', 5], 8: ['A', 5], 10: ['G#', 5], 12: ['F#', 5], 14: ['E', 5] },
            // Bar 3 - playful
            { 0: ['A', 5], 2: ['A', 5], 4: ['B', 5], 6: ['C#', 6], 8: ['B', 5], 12: ['A', 5] },
            // Bar 4 - resolution
            { 0: ['E', 5], 4: ['G#', 5], 6: ['A', 5], 8: ['E', 5], 12: ['E', 5], 14: ['E', 5] },
        ];

        const melody = melodies[bar];
        if (melody[beatInBar]) {
            const [note, oct] = melody[beatInBar];
            this.playSupersaw(this.noteToFreq(note, oct), this.beatLength * 1.5, 0.08);
        }
    }

    // Sub bass
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

    // Drum pattern
    playDrums(beat) {
        const pattern = beat % 16;

        // Four-on-the-floor kick
        if (pattern % 4 === 0) {
            this.playKick();
        }

        // Snare on 4 and 12
        if (pattern === 4 || pattern === 12) {
            this.playSnare();
        }

        // Hi-hats - offbeat pattern
        const hihatPattern = [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1];
        if (hihatPattern[pattern]) {
            this.playHihat(pattern === 7 || pattern === 15);
        }
    }

    scheduleNextBeat() {
        if (!this.isPlaying) return;

        const beat = this.currentBeat;

        // Play all elements
        this.playDrums(beat);
        this.playBass(beat);
        this.playChords(beat);
        this.playArpeggio(beat);

        // Lead comes in after intro
        if (beat >= 32) {
            this.playLead(beat);
        }

        this.currentBeat++;

        // Schedule next beat (16th notes for tighter rhythm)
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

let musicPlayer = null;

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
        x: 2,
        y: 0,
        color1: Math.floor(Math.random() * COLORS.length),
        color2: Math.floor(Math.random() * COLORS.length),
        rotation: 0
    };
}

function getSecondPuyoPos(puyo) {
    const offsets = [
        { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
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
    const tempPuyo = { ...puyo, x: newX, y: newY, rotation: newRotation };
    const second = getSecondPuyoPos(tempPuyo);
    return isValidPosition(newX, newY) && isValidPosition(second.x, second.y);
}

function movePuyo(dx, dy) {
    if (!currentPuyo || animating || paused || gameOver) return false;
    if (canMove(currentPuyo, dx, dy)) {
        currentPuyo.x += dx;
        currentPuyo.y += dy;
        if (dx !== 0) playMoveSound();
        updateCurrentPuyoMeshes();
        return true;
    }
    return false;
}

function rotatePuyo(direction) {
    if (!currentPuyo || animating || paused || gameOver) return;
    const newRotation = (currentPuyo.rotation + direction + 4) % 4;

    if (canMove(currentPuyo, 0, 0, newRotation)) {
        currentPuyo.rotation = newRotation;
        playRotateSound();
        updateCurrentPuyoMeshes();
        return;
    }

    const kicks = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }, { x: -1, y: -1 }];
    for (const kick of kicks) {
        if (canMove(currentPuyo, kick.x, kick.y, newRotation)) {
            currentPuyo.x += kick.x;
            currentPuyo.y += kick.y;
            currentPuyo.rotation = newRotation;
            playRotateSound();
            updateCurrentPuyoMeshes();
            return;
        }
    }
}

function lockPuyo() {
    if (!currentPuyo) return;
    const second = getSecondPuyoPos(currentPuyo);

    if (currentPuyo.y >= 0 && currentPuyo.y < ROWS + HIDDEN_ROWS) {
        board[currentPuyo.y][currentPuyo.x] = currentPuyo.color1;
    }
    if (second.y >= 0 && second.y < ROWS + HIDDEN_ROWS) {
        board[second.y][second.x] = currentPuyo.color2;
    }

    playDropSound();
    updateBoardMeshes();
    updateCurrentPuyoMeshes();
    setTimeout(() => processChains(), 100);
}

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

function findConnected(startX, startY, color, visited = new Set()) {
    const key = `${startX},${startY}`;
    if (visited.has(key)) return [];
    if (startX < 0 || startX >= COLS || startY < 0 || startY >= ROWS + HIDDEN_ROWS) return [];
    if (board[startY][startX] !== color) return [];

    visited.add(key);
    let connected = [{ x: startX, y: startY }];
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of directions) {
        connected = connected.concat(findConnected(startX + dx, startY + dy, color, visited));
    }
    return connected;
}

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

function removeMatches(matches, chainCount) {
    let puyosCleared = 0;
    let colorBonus = new Set();
    let groupBonus = 0;

    for (const group of matches) {
        colorBonus.add(board[group[0].y][group[0].x]);
        groupBonus += Math.max(0, group.length - 4);

        for (const { x, y } of group) {
            // Create explosion particles
            const displayY = ROWS - 1 - (y - HIDDEN_ROWS);
            createExplosionParticles(x, displayY, board[y][x]);
            board[y][x] = null;
            puyosCleared++;
        }
    }

    const chainPower = chainCount === 1 ? 0 : Math.pow(2, chainCount + 1) * 8;
    const colorBonusValue = Math.max(0, (colorBonus.size - 1) * 3);
    const totalBonus = Math.max(1, chainPower + colorBonusValue + groupBonus);
    const points = puyosCleared * 10 * totalBonus;
    score += points;

    return puyosCleared;
}

function showChainPopup(chainCount) {
    const popup = document.getElementById('chainPopup');
    const cuteMessages = ['', 'すごい！✨', 'キラキラ！💖', 'やったね！🌟', 'さいこう！💕', 'かわいい！🎀'];
    const message = cuteMessages[Math.min(chainCount, cuteMessages.length - 1)] || '💖💖💖';
    popup.innerHTML = `${chainCount}れんさ！<br><span style="font-size: 24px">${message}</span>`;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 1000);
}

async function processChains() {
    animating = true;
    let chainCount = 0;

    while (true) {
        while (applyGravity()) {
            updateBoardMeshes();
            await sleep(50);
        }

        const matches = findMatches();
        if (matches.length === 0) break;

        chainCount++;
        chains = chainCount;
        if (chainCount > maxChains) maxChains = chainCount;

        playChainSound(chainCount);
        showChainPopup(chainCount);

        // Flash effect using emissive intensity
        for (let flash = 0; flash < 3; flash++) {
            puyoMeshes.forEach(mesh => {
                const body = mesh.children[0];
                if (body && body.material) {
                    body.material.emissiveIntensity = flash % 2 === 0 ? 0.8 : 0.1;
                }
            });
            await sleep(100);
        }

        removeMatches(matches, chainCount);
        updateBoardMeshes();
        await sleep(100);
        updateUI();
    }

    animating = false;
    spawnNextPuyo();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnNextPuyo() {
    if (gameOver) return;
    currentPuyo = nextPuyo;
    nextPuyo = createPuyo();

    const second = getSecondPuyoPos(currentPuyo);
    if (board[currentPuyo.y][currentPuyo.x] !== null ||
        (second.y >= 0 && board[second.y][second.x] !== null)) {
        endGame();
    }

    updateCurrentPuyoMeshes();
    renderNext();
}

function hardDrop() {
    if (!currentPuyo || animating || paused || gameOver) return;
    while (canMove(currentPuyo, 0, 1)) {
        currentPuyo.y++;
    }
    lockPuyo();
}

function endGame() {
    gameOver = true;
    playGameOverSound();
    stopMusic();
    document.getElementById('finalScore').textContent = score.toLocaleString();
    document.getElementById('maxChain').textContent = maxChains;
    document.getElementById('gameOver').style.display = 'block';
}

// ========================
// RENDERING
// ========================

function renderNext() {
    // Cute gradient background
    const gradient = nextCtx.createLinearGradient(0, 0, 0, nextCanvas.height);
    gradient.addColorStop(0, '#FFF0F5');
    gradient.addColorStop(1, '#FFE4EC');
    nextCtx.fillStyle = gradient;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (nextPuyo) {
        drawPuyo2D(nextCtx, 28, 58, nextPuyo.color1, 24);
        drawPuyo2D(nextCtx, 28, 28, nextPuyo.color2, 24);
    }
}

function drawPuyo2D(ctx, x, y, colorIndex, size) {
    // Cute pastel colors matching 3D version
    const colors = ['#FFB7C5', '#B5EAD7', '#A7C7E7', '#FFF0B3', '#E8D5E8'];
    const color = colors[colorIndex];
    const radius = size / 2 - 2;

    // Cute candy-like body gradient
    const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, lightenColor(color, 20));
    gradient.addColorStop(0.8, color);
    gradient.addColorStop(1, darkenColor(color, 15));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Cute rosy cheeks
    ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.5, y + radius * 0.1, radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + radius * 0.5, y + radius * 0.1, radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Bigger, cuter eyes
    const eyeOffset = radius / 4;
    const eyeRadius = radius / 5;

    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x - eyeOffset, y - eyeOffset/2, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + eyeOffset, y - eyeOffset/2, eyeRadius, eyeRadius * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute brown pupils
    ctx.fillStyle = '#3D2314';
    ctx.beginPath();
    ctx.arc(x - eyeOffset, y - eyeOffset/3, eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + eyeOffset, y - eyeOffset/3, eyeRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Eye sparkles (kawaii!)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - eyeOffset + eyeRadius/3, y - eyeOffset/2 - eyeRadius/3, eyeRadius/4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + eyeOffset + eyeRadius/3, y - eyeOffset/2 - eyeRadius/3, eyeRadius/4, 0, Math.PI * 2);
    ctx.fill();

    // Cute smile
    ctx.strokeStyle = '#3D2314';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y + radius * 0.15, radius * 0.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Main highlight shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.3, y - radius * 0.35, radius * 0.25, radius * 0.15, -0.5, 0, Math.PI * 2);
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
    const levelEl = document.getElementById('level');
    if (levelEl) levelEl.textContent = level;
}

// ========================
// GAME LOOP
// ========================

function animate(timestamp) {
    requestAnimationFrame(animate);

    // Update puyo bouncing animation - more bouncy and cute!
    bounceTime += 0.06;
    puyoMeshes.forEach(mesh => {
        if (mesh.userData.baseY !== undefined) {
            const bounce = Math.sin(bounceTime + mesh.userData.bounceOffset) * 0.05;
            mesh.position.y = mesh.userData.baseY + bounce;
            // Cute squish effect
            const squish = 1 + Math.sin(bounceTime * 2 + mesh.userData.bounceOffset) * 0.02;
            mesh.scale.set(squish, 1/squish, squish);
        }
    });

    // Update sparkle particles - rotation only, no position changes for stability
    sparkleParticles.forEach(sparkle => {
        sparkle.rotation.x += 0.01;
        sparkle.rotation.y += 0.01;
        // Float animation disabled for stability
        // const floatY = Math.sin(bounceTime * sparkle.userData.speed + sparkle.userData.offset) * 0.5;
        // sparkle.position.y = sparkle.userData.originalY + floatY;
        // Twinkle effect
        sparkle.material.opacity = 0.5 + Math.sin(bounceTime * 3 + sparkle.userData.offset) * 0.5;
    });

    // Update heart/star particles
    updateHeartParticles();

    // Update legacy particles
    updateParticles();

    // Camera sway disabled for stability
    // if (!paused && !gameOver) {
    //     const mode = cameraModes[cameraMode];
    //     camera.position.x = mode.pos.x + Math.sin(bounceTime * 0.3) * 0.15;
    //     camera.position.y = mode.pos.y + Math.cos(bounceTime * 0.2) * 0.08;
    // }

    // Game logic
    if (!paused && !gameOver && !animating && currentPuyo) {
        if (timestamp - lastDrop > dropInterval) {
            if (!movePuyo(0, 1)) {
                lockPuyo();
            }
            lastDrop = timestamp;
        }
    }

    renderer.render(scene, camera);
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
        case 'c': case 'C':
            cameraMode = (cameraMode + 1) % cameraModes.length;
            updateCameraPosition();
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

    // Clear all meshes
    puyoMeshes.forEach(mesh => scene.remove(mesh));
    puyoMeshes = [];
    currentPuyoMeshes.forEach(mesh => scene.remove(mesh));
    currentPuyoMeshes = [];
    ghostMeshes.forEach(mesh => scene.remove(mesh));
    ghostMeshes = [];
    particleSystems.forEach(p => scene.remove(p));
    particleSystems = [];

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

    if (musicEnabled) startMusic();
    lastDrop = performance.now();
}

function togglePause() {
    paused = !paused;
    document.getElementById('pauseBtn').textContent = paused ? 'RESUME' : 'PAUSE';
    if (paused) stopMusic();
    else if (musicEnabled && !gameOver) startMusic();
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
// TOUCH CONTROLS (Mario-style)
// ========================

const touchState = {
    left: false,
    right: false,
    down: false,
    rotateLeft: false,
    rotateRight: false,
    drop: false
};

let activeDpadTouchId = null;
let dpadRepeatInterval = null;

function setupTouchControls() {
    const dpad = document.getElementById('dpad');
    const actionButtons = document.getElementById('actionButtons');
    const mobileStart = document.getElementById('mobileStart');

    // D-pad button elements for visual feedback
    const dpadButtons = {
        left: document.getElementById('dpad-left'),
        right: document.getElementById('dpad-right'),
        down: document.getElementById('dpad-down')
    };

    function clearDpadState() {
        touchState.left = false;
        touchState.right = false;
        touchState.down = false;
        Object.values(dpadButtons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (dpadRepeatInterval) {
            clearInterval(dpadRepeatInterval);
            dpadRepeatInterval = null;
        }
    }

    function executeDpadAction() {
        if (gameOver || paused || animating) return;
        if (touchState.left) movePuyo(-1, 0);
        if (touchState.right) movePuyo(1, 0);
        if (touchState.down) {
            if (movePuyo(0, 1)) {
                score += 1;
                updateUI();
            }
        }
    }

    function updateDpadFromTouch(touch) {
        if (!dpad) return;
        const dpadRect = dpad.getBoundingClientRect();
        const x = touch.clientX - dpadRect.left;
        const y = touch.clientY - dpadRect.top;

        const centerX = dpadRect.width / 2;
        const centerY = dpadRect.height / 2;
        const dx = x - centerX;
        const dy = y - centerY;

        clearDpadState();

        const deadZone = 15;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < deadZone) return;

        // Determine direction based on angle
        if (Math.abs(dx) > Math.abs(dy) * 0.5) {
            // Horizontal dominant
            if (dx > 0) {
                touchState.right = true;
                if (dpadButtons.right) dpadButtons.right.classList.add('active');
            } else {
                touchState.left = true;
                if (dpadButtons.left) dpadButtons.left.classList.add('active');
            }
        }
        if (Math.abs(dy) > Math.abs(dx) * 0.5 && dy > 0) {
            // Down
            touchState.down = true;
            if (dpadButtons.down) dpadButtons.down.classList.add('active');
        }

        // Execute immediately
        executeDpadAction();

        // Start repeat interval
        if (!dpadRepeatInterval && (touchState.left || touchState.right || touchState.down)) {
            dpadRepeatInterval = setInterval(executeDpadAction, 80);
        }
    }

    if (dpad) {
        dpad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (activeDpadTouchId === null) {
                    activeDpadTouchId = touch.identifier;
                    updateDpadFromTouch(touch);
                }
            }
        }, { passive: false });

        dpad.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeDpadTouchId) {
                    updateDpadFromTouch(e.changedTouches[i]);
                    break;
                }
            }
        }, { passive: false });

        dpad.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeDpadTouchId) {
                    activeDpadTouchId = null;
                    clearDpadState();
                    break;
                }
            }
        }, { passive: true });

        dpad.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeDpadTouchId) {
                    activeDpadTouchId = null;
                    clearDpadState();
                    break;
                }
            }
        }, { passive: true });
    }

    // Action buttons handling
    const btnRotateLeft = document.getElementById('btn-rotate-left');
    const btnRotateRight = document.getElementById('btn-rotate-right');
    const btnDrop = document.getElementById('btn-drop');

    const activeTouches = {
        rotateLeft: new Set(),
        rotateRight: new Set(),
        drop: new Set()
    };

    const touchToButtons = new Map();

    function getAllButtonsFromPoint(x, y) {
        const result = [];
        const buttonList = [
            { el: btnRotateLeft, name: 'rotateLeft' },
            { el: btnRotateRight, name: 'rotateRight' },
            { el: btnDrop, name: 'drop' }
        ];

        const expandedMargin = 15; // Larger touch area

        for (const btn of buttonList) {
            if (!btn.el) continue;
            const rect = btn.el.getBoundingClientRect();
            const expandedRect = {
                left: rect.left - expandedMargin,
                right: rect.right + expandedMargin,
                top: rect.top - expandedMargin,
                bottom: rect.bottom + expandedMargin
            };

            if (x >= expandedRect.left && x <= expandedRect.right &&
                y >= expandedRect.top && y <= expandedRect.bottom) {
                result.push(btn.name);
            }
        }

        return result;
    }

    function updateButtonStates() {
        const rotateLeftPressed = activeTouches.rotateLeft.size > 0;
        if (btnRotateLeft) btnRotateLeft.classList.toggle('active', rotateLeftPressed);

        const rotateRightPressed = activeTouches.rotateRight.size > 0;
        if (btnRotateRight) btnRotateRight.classList.toggle('active', rotateRightPressed);

        const dropPressed = activeTouches.drop.size > 0;
        if (btnDrop) btnDrop.classList.toggle('active', dropPressed);
    }

    function processTouchPoint(touch, isStart = false) {
        const touchId = touch.identifier;
        const x = touch.clientX;
        const y = touch.clientY;

        const buttonsNow = getAllButtonsFromPoint(x, y);

        if (!touchToButtons.has(touchId)) {
            touchToButtons.set(touchId, new Set());
        }
        const previousButtons = touchToButtons.get(touchId);

        // Rotate Left - trigger on first touch only
        if (!previousButtons.has('rotateLeft') && buttonsNow.includes('rotateLeft')) {
            previousButtons.add('rotateLeft');
            activeTouches.rotateLeft.add(touchId);
            if (isStart && !gameOver && !paused) rotatePuyo(-1);
        }

        // Rotate Right - trigger on first touch only
        if (!previousButtons.has('rotateRight') && buttonsNow.includes('rotateRight')) {
            previousButtons.add('rotateRight');
            activeTouches.rotateRight.add(touchId);
            if (isStart && !gameOver && !paused) rotatePuyo(1);
        }

        // Drop - trigger on first touch only
        if (!previousButtons.has('drop') && buttonsNow.includes('drop')) {
            previousButtons.add('drop');
            activeTouches.drop.add(touchId);
            if (isStart && !gameOver && !paused) hardDrop();
        }
    }

    function removeTouchState(touchId) {
        activeTouches.rotateLeft.delete(touchId);
        activeTouches.rotateRight.delete(touchId);
        activeTouches.drop.delete(touchId);
        touchToButtons.delete(touchId);
    }

    if (actionButtons) {
        actionButtons.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                processTouchPoint(e.changedTouches[i], true);
            }
            updateButtonStates();
        }, { passive: false });

        actionButtons.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                processTouchPoint(e.changedTouches[i], false);
            }
            updateButtonStates();
        }, { passive: false });

        actionButtons.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                removeTouchState(e.changedTouches[i].identifier);
            }
            updateButtonStates();
        }, { passive: true });

        actionButtons.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                removeTouchState(e.changedTouches[i].identifier);
            }
            updateButtonStates();
        }, { passive: true });
    }

    // Global touch end tracking
    document.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touchId = e.changedTouches[i].identifier;
            if (touchToButtons.has(touchId)) {
                removeTouchState(touchId);
                updateButtonStates();
            }
        }
    }, { passive: true });

    // Mobile start button
    if (mobileStart) {
        mobileStart.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobileStart.style.display = 'none';
            startGame();
        }, { passive: false });

        mobileStart.addEventListener('click', (e) => {
            mobileStart.style.display = 'none';
            startGame();
        });
    }

    // Mouse support for PC testing
    function addMouseHandler(element, action) {
        if (!element) return;
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!gameOver && !paused) action();
        });
    }
    addMouseHandler(dpadButtons.left, () => movePuyo(-1, 0));
    addMouseHandler(dpadButtons.right, () => movePuyo(1, 0));
    addMouseHandler(dpadButtons.down, () => { if (movePuyo(0, 1)) { score += 1; updateUI(); } });
    addMouseHandler(btnRotateLeft, () => rotatePuyo(-1));
    addMouseHandler(btnRotateRight, () => rotatePuyo(1));
    addMouseHandler(btnDrop, () => hardDrop());
}

// Initialize touch controls
setupTouchControls();

// ========================
// INITIALIZE
// ========================

initThree();
initBoard();
renderNext();
updateUI();
animate();

console.log('🎮 PUYO PUYO 3D');
console.log('Press START to begin!');
console.log('Controls: ← → (move), ↓ (soft drop), Z/X (rotate), SPACE (hard drop), C (camera)');
