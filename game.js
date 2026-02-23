import * as THREE from 'three';
import { World } from './world.js';
import { Boss } from './boss.js';
import { AI } from './ai.js';
import { Skins } from './skins.js';
import { Achievements } from './achievements.js';
import { Combat } from './combat.js';
import { PowerUps } from './powerups.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';


// --- Shared State ---
const state = {
    score: 0,
    health: 100,
    mode: 'start', // 'start', '2d', 'transition', '3d', 'gameover'
    highScore: 0,
    paused: false
};

// --- Shared Audio System ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {
    shoot: () => playTone('square', 440, 110, 0.05, 0.1),
    explosion: () => {
        playTone('sawtooth', 100, 10, 0.2, 0.3);
        // Bass distortion hit
        playTone('sine', 60, 30, 0.5, 0.4);
    },
    powerup: () => playTone('sine', 440, 1760, 0.1, 0.3),
    hit: () => {
        playTone('triangle', 200, 100, 0.2, 0.1);
        playTone('sine', 40, 20, 0.8, 0.5); // Impact bass
    },
    jump: () => playTone('square', 300, 600, 0.1, 0.1, 'linear'),
    coin: () => playTone('sine', 800, 1200, 0.1, 0.1, 'linear')
};

// Layered Audio Nodes
let ambientHum = null;
let engineNode = null;
let windNode = null;
let bossDrone = null;

function initAudioLayers() {
    if (ambientHum) return;

    // Base Layer: Low cyberpunk hum
    ambientHum = audioCtx.createOscillator();
    const humGain = audioCtx.createGain();
    ambientHum.type = 'sine';
    ambientHum.frequency.setValueAtTime(55, audioCtx.currentTime);
    humGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    ambientHum.connect(humGain);
    humGain.connect(audioCtx.destination);
    ambientHum.start();

    // Speed Layer: Engine
    engineNode = audioCtx.createOscillator();
    const engineGain = audioCtx.createGain();
    engineNode.type = 'sawtooth';
    engineNode.frequency.setValueAtTime(40, audioCtx.currentTime);
    engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
    engineNode.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineNode.start();
    engineNode.gainNode = engineGain;

    // Speed Layer: Wind
    windNode = audioCtx.createBiquadFilter();
    const whiteNoise = audioCtx.createBufferSource();
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    whiteNoise.buffer = buffer;
    whiteNoise.loop = true;

    const windGain = audioCtx.createGain();
    windNode.type = 'lowpass';
    windNode.frequency.setValueAtTime(500, audioCtx.currentTime);
    windGain.gain.setValueAtTime(0, audioCtx.currentTime);
    whiteNoise.connect(windNode);
    windNode.connect(windGain);
    windGain.connect(audioCtx.destination);
    whiteNoise.start();
    windNode.gainNode = windGain;

    // Boss Layer: Deep bass drone
    bossDrone = audioCtx.createOscillator();
    const bossGain = audioCtx.createGain();
    bossDrone.type = 'triangle';
    bossDrone.frequency.setValueAtTime(30, audioCtx.currentTime);
    bossGain.gain.setValueAtTime(0, audioCtx.currentTime);
    bossDrone.connect(bossGain);
    bossGain.connect(audioCtx.destination);
    bossDrone.start();
    bossDrone.gainNode = bossGain;
}

function updateAudioLayers(speed, isBossActive) {
    if (!engineNode) return;
    const speedNorm = Math.min(1, (speed - 20) / 80);

    engineNode.frequency.setTargetAtTime(40 + speedNorm * 60, audioCtx.currentTime, 0.1);
    engineNode.gainNode.gain.setTargetAtTime(speedNorm * 0.05, audioCtx.currentTime, 0.1);

    windNode.frequency.setTargetAtTime(500 + speedNorm * 2000, audioCtx.currentTime, 0.1);
    windNode.gainNode.gain.setTargetAtTime(speedNorm * 0.1, audioCtx.currentTime, 0.1);

    bossDrone.gainNode.gain.setTargetAtTime(isBossActive ? 0.2 : 0, audioCtx.currentTime, 0.5);
}

function playTone(type, startDesc, endFreq, vol, duration, ramp = 'exponential') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(startDesc, audioCtx.currentTime);
    if (ramp === 'exponential') {
        osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, endFreq), audioCtx.currentTime + duration);
    } else {
        osc.frequency.linearRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// --- UI Helper ---
const uiState = { lastScore: 0, displayedScore: 0 };
function updateUI() {
    // Score Animation
    const scoreEl = document.getElementById('score-display');
    if (Math.floor(state.score) !== uiState.lastScore) {
        uiState.lastScore = Math.floor(state.score);
        animateScore();
    }

    if (state.mode === '2d') {
        document.getElementById('health-display').innerText = `Integrity: ${state.health}%`;
        document.getElementById('mode-display').innerText = "PHASE 1: NEURAL LINKING";
        document.getElementById('health-bar-container').classList.add('hidden');
    } else if (state.mode === '3d') {
        document.getElementById('health-display').innerText = `Data: ${Math.floor(state.score)}`;
        document.getElementById('mode-display').innerText = "PHASE 2: HYPERSPACE EVOLUTION";
        document.getElementById('health-bar-container').classList.remove('hidden');
    }
}

function animateScore() {
    const target = uiState.lastScore;
    const diff = target - uiState.displayedScore;
    if (diff > 0) {
        uiState.displayedScore += Math.ceil(diff / 5);
        document.getElementById('score-display').innerText = `Data: ${uiState.displayedScore}`;
        requestAnimationFrame(animateScore);
    }
}

function triggerScreenShake() {
    const container = document.getElementById('game-container');
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 300);
}

// ==========================================================================================
// GAME 2D MODULE
// ==========================================================================================
const Game2D = {
    canvas: document.getElementById('canvas-2d'),
    ctx: document.getElementById('canvas-2d').getContext('2d'),
    animationId: null,
    player: null,
    projectiles: [],
    enemies: [],
    particles: [],
    stars: [],
    powerups: [],
    frameCount: 0,
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false, Space: false },
    mouse: { x: 0, y: 0, isDown: false },

    init: function () {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindInput();

        this.canvas.style.display = 'block';
        state.health = 100;
        this.player = new Player2D(this.canvas.width / 2, this.canvas.height - 100);
        this.projectiles = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        this.stars = [];
        for (let i = 0; i < 100; i++) this.stars.push(new Star2D(this.canvas.width, this.canvas.height));

        this.loop();
    },

    cleanup: function () {
        cancelAnimationFrame(this.animationId);
        this.canvas.style.display = 'none';
        // Remove listeners if strict, but simpler to just ignore updates
    },

    resize: function () {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    bindInput: function () {
        if (this.inputsBound) return;
        this.inputsBound = true;

        window.addEventListener('keydown', (e) => {
            if (state.mode === '2d') {
                if (this.keys.hasOwnProperty(e.key) || e.code === 'Space') this.keys[e.key] = true;
                if (e.code === 'Space') e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (state.mode === '2d') {
                if (this.keys.hasOwnProperty(e.key) || e.code === 'Space') this.keys[e.key] = false;
            }
        });
        window.addEventListener('mousedown', () => { if (state.mode === '2d') this.mouse.isDown = true; });
        window.addEventListener('mouseup', () => { if (state.mode === '2d') this.mouse.isDown = false; });
        window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    },

    loop: function () {
        if (state.mode !== '2d') return;
        if (state.paused) return;

        // Transition Check
        if (state.score >= 2500) {
            transitionTo3D();
            return;
        }

        this.ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        this.stars.forEach(star => { star.update(this.canvas.height); star.draw(this.ctx); });

        // Player
        this.player.update(this.canvas, this.keys, this.mouse);
        this.player.draw(this.ctx);

        // Projectiles
        this.projectiles.forEach((p, i) => {
            p.update(this.canvas);
            p.draw(this.ctx);
            if (p.markedForDeletion) this.projectiles.splice(i, 1);
        });

        // Enemies
        this.spawnEnemies();
        this.enemies.forEach((enemy, i) => {
            enemy.update(this.canvas, this.player);
            enemy.draw(this.ctx);

            // Collision: Projectile -> Enemy
            this.projectiles.forEach((p) => {
                if (p.isEnemy) return;
                const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (dist < enemy.size + p.radius) {
                    enemy.health--;
                    p.markedForDeletion = true;
                    sounds.hit();
                    if (enemy.health <= 0) {
                        enemy.markedForDeletion = true;
                        state.score += 100;
                        updateUI();
                        sounds.explosion();
                        this.createExplosion(enemy.x, enemy.y, enemy.color);
                    }
                }
            });

            // Collision: Enemy -> Player
            const distP = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
            if (distP < this.player.size + enemy.size) {
                enemy.markedForDeletion = true;
                state.health -= 15;
                updateUI();
                sounds.explosion();
                triggerScreenShake();
                this.createExplosion(this.player.x, this.player.y, '#f00');
                if (state.health <= 0) gameOver();
            }

            if (enemy.markedForDeletion) this.enemies.splice(i, 1);
        });

        // Particles
        this.particles.forEach((p, i) => {
            p.update();
            p.draw(this.ctx);
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        this.animationId = requestAnimationFrame(() => this.loop());
        this.frameCount++;
    },

    spawnEnemies: function () {
        if (this.frameCount % 50 === 0) {
            this.enemies.push(new Enemy2D(this.canvas));
        }
    },

    createExplosion: function (x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle2D(x, y, color));
        }
    }
};

// --- Classes for 2D ---
class Player2D {
    constructor(x, y) { this.x = x; this.y = y; this.size = 20; this.speed = 7; this.color = '#0ff'; this.lastShot = 0; }
    update(canvas, keys, mouse) {
        if ((keys.ArrowLeft || keys.a) && this.x > this.size) this.x -= this.speed;
        if ((keys.ArrowRight || keys.d) && this.x < canvas.width - this.size) this.x += this.speed;
        if ((keys.ArrowUp || keys.w) && this.y > this.size) this.y -= this.speed;
        if ((keys.ArrowDown || keys.s) && this.y < canvas.height - this.size) this.y += this.speed;

        if (keys.Space || mouse.isDown) { // Shooting
            if (Game2D.projectiles.length < 20 && Date.now() - this.lastShot > 150) { // Limit fire rate
                Game2D.projectiles.push(new Projectile2D(this.x, this.y - this.size, 0, -10));
                sounds.shoot();
                this.lastShot = Date.now();
            }
        }
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.beginPath(); ctx.moveTo(0, -this.size); ctx.lineTo(-this.size, this.size); ctx.lineTo(this.size, this.size);
        ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
    }
}
class Projectile2D {
    constructor(x, y, dx, dy) { this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.radius = 4; this.markedForDeletion = false; }
    update() { this.x += this.dx; this.y += this.dy; if (this.y < 0 || this.y > window.innerHeight) this.markedForDeletion = true; }
    draw(ctx) { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = '#ff0'; ctx.fill(); }
}
class Enemy2D {
    constructor(canvas) {
        this.size = 20; this.x = Math.random() * (canvas.width - 40) + 20; this.y = -20;
        this.dy = Math.random() * 2 + 2; this.health = 2; this.color = '#f0f'; this.markedForDeletion = false;
    }
    update(canvas) { this.y += this.dy; if (this.y > canvas.height + 20) this.markedForDeletion = true; }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}
class Particle2D {
    constructor(x, y, color) { this.x = x; this.y = y; this.dx = (Math.random() - 0.5) * 5; this.dy = (Math.random() - 0.5) * 5; this.life = 1; this.color = color; }
    update() { this.x += this.dx; this.y += this.dy; this.life -= 0.03; }
    draw(ctx) { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; }
}
class Star2D {
    constructor(w, h) { this.x = Math.random() * w; this.y = Math.random() * h; this.size = Math.random() * 2; }
    update(h) { this.y += 0.5; if (this.y > h) this.y = 0; }
    draw(ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(this.x, this.y, this.size, this.size); }
}

// ==========================================================================================
// GAME 3D MODULE (Three.js)
// ==========================================================================================
const Game3D = {
    scene: null, camera: null, renderer: null,
    player: null, floorSegments: [], obstacles: [], collectibles: [],
    frameId: null,
    playerLane: 0, targetX: 0, isJumping: false, verticalVelocity: 0,
    gameSpeed: 0,
    clock: new THREE.Clock(),
    LANES: [-6, 0, 6],

    getWorldPos: function (obj) {
        if (!obj) return new THREE.Vector3();
        const v = new THREE.Vector3();
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(v);
        return v;
    },

    init: function () {
        const container = document.getElementById('container-3d');
        container.innerHTML = '';

        // Scene, Camera, Renderer
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.0025);
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 4, 6);
        this.camera.lookAt(0, 0, -10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        container.appendChild(this.renderer.domElement);

        // Post-Processing - Visual Hierarchy & Color Balance
        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.85);
        bloomPass.threshold = 0.3; // Higher threshold to focus on highlight
        bloomPass.strength = 0.75; // Further reduced for clarity
        bloomPass.radius = 0.6;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
        this.composer.addPass(new OutputPass());

        // Light
        const dl = new THREE.DirectionalLight(0x00f2ff, 1.5); // Cyan key light
        dl.position.set(20, 40, -50);
        this.scene.add(dl);

        const magentaAccent = new THREE.DirectionalLight(0xff00ff, 1.0); // Magenta accent
        magentaAccent.position.set(-30, 20, -100);
        this.scene.add(magentaAccent);

        this.scene.add(new THREE.AmbientLight(0x050510, 0.5));

        // Player - Updated Material for Foreground Brilliance
        const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 3, // Bright but controlled
            metalness: 0.9,
            roughness: 0.1
        });
        this.player = new THREE.Mesh(geo, mat);
        this.player.position.y = 0.5;
        this.scene.add(this.player);

        // Shield Mesh - Thinner wireframe
        const sGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const sMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.2, // Reduced opacity
            depthWrite: false
        });
        this.shieldMesh = new THREE.Mesh(sGeo, sMat);
        this.shieldMesh.visible = false;
        this.player.add(this.shieldMesh);

        // Volumetric Fog Gradient Simulation
        this.scene.fog = new THREE.FogExp2(0x020205, 0.0035);

        // Initialize Modules
        World.init(this.scene);
        Boss.init(this.scene);
        AI.init();
        Skins.init();
        Achievements.init();
        PowerUps.init();

        Skins.apply(this.player);

        this.gameSpeed = 20;
        this.playerLane = 0;
        this.targetX = 0;
        this.isJumping = false;
        this.hasShield = false;
        this.baseFOV = 60;
        this.lightStreaks = [];
        this.cameraRecoil = 0;
        this.shakeIntensity = 0;

        initAudioLayers();

        this.projectiles = [];
        Combat.init(this.scene);

        if (!this.inputsBound) {
            this.inputsBound = true;
            window.addEventListener('keydown', (e) => {
                if (state.mode !== '3d') return;
                this.handleInput(e);

                if (e.code === 'Space') {
                    e.preventDefault();
                    if (Combat.shoot(this.player.position)) {
                        sounds.shoot();
                        this.createLightStreak(this.player.position);
                        this.cameraRecoil = 0.5; // Recoil effect
                    }
                }
            });
        }

        this.loop();
    },

    createLightStreak: function (pos) {
        const geo = new THREE.CylinderGeometry(0.02, 0.02, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.6 });
        const streak = new THREE.Mesh(geo, mat);
        streak.position.copy(pos);
        streak.rotation.x = Math.PI / 2;
        streak.userData = { life: 1.0 };
        this.scene.add(streak);
        this.lightStreaks.push(streak);
    },

    shoot: function () {
        const shot = Combat.shoot(this.player.position);
        if (shot) {
            sounds.shoot();
            this.createLightStreak(this.player.position);
        }
    },

    loop: function () {
        if (state.mode !== '3d') return;
        if (state.paused) return;
        this.frameId = requestAnimationFrame(() => this.loop());

        const dt = this.clock.getDelta();
        const time = Date.now() * 0.001;

        // Move Player
        this.player.position.x += (this.targetX - this.player.position.x) * 15 * dt;
        if (Math.abs(this.player.position.x - this.targetX) < 0.01) this.player.position.x = this.targetX;

        // Jump
        if (this.isJumping) {
            this.player.position.y += this.verticalVelocity * dt;
            this.verticalVelocity -= 40 * dt;
            if (this.player.position.y <= 0.5) {
                this.player.position.y = 0.5; this.isJumping = false;
            }
            this.player.rotation.x -= 8 * dt;
        } else {
            this.player.rotation.x = 0;
            // Physical tilt
            const tilt = (this.targetX - this.player.position.x) * 0.15;
            this.player.rotation.z = -tilt;
            // Camera Tilt
            this.camera.rotation.z = -tilt * 0.3;
            this.camera.position.x = tilt * 0.5;
        }

        // Speed & Score
        if (!Boss.active) {
            this.gameSpeed = Math.min(100, this.gameSpeed + 0.5 * dt);
        } else {
            this.gameSpeed = Math.max(20, this.gameSpeed - 2 * dt);
        }

        const dist = this.gameSpeed * dt;
        state.score += dist;
        updateUI();

        // FOV Dynamic Scaling
        this.camera.fov = this.baseFOV + (this.gameSpeed - 20) * 0.15;
        this.camera.updateProjectionMatrix();

        // Sky Color Shift & Boss Spawn Reaction
        const teal = new THREE.Color(0x004444);
        const magenta = new THREE.Color(0x440044);
        const mix = (Math.sin(time * 0.2) + 1) / 2;
        const baseFogColor = teal.clone().lerp(magenta, mix);
        const fogColor = Boss.active ? new THREE.Color(0x050105) : baseFogColor;
        const targetDensity = (Boss.active ? 0.006 : 0.002) + (this.gameSpeed - 20) * 0.00005;

        this.scene.fog.color.lerp(fogColor, 0.1);
        this.scene.fog.density += (targetDensity - this.scene.fog.density) * 0.05;
        this.renderer.setClearColor(this.scene.fog.color);

        // Audio Update
        updateAudioLayers(this.gameSpeed, Boss.active);

        // Camera Micro-Motion
        const speedShake = Math.max(0, (this.gameSpeed - 60) * 0.001);
        this.shakeIntensity = Math.max(this.shakeIntensity, speedShake);

        if (this.shakeIntensity > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
        }

        if (this.cameraRecoil > 0) {
            this.camera.position.z += this.cameraRecoil;
            this.cameraRecoil *= 0.8;
            if (this.cameraRecoil < 0.01) this.cameraRecoil = 0;
        } else {
            this.camera.position.z += (6 - this.camera.position.z) * 0.1;
        }

        // Modules Update
        World.update(this.gameSpeed, dt, Boss.active);
        Boss.update(dt, this.player.position);
        Combat.update(dt, this.player.position, this.gameSpeed);
        PowerUps.update(dt);
        AI.update(state.score);

        // Achievement checks
        Achievements.checkSpeed(this.gameSpeed);
        Achievements.checkSurvival();

        // Light Streaks Update
        for (let i = this.lightStreaks.length - 1; i >= 0; i--) {
            const s = this.lightStreaks[i];
            s.position.z -= 100 * dt;
            s.userData.life -= dt * 2;
            s.material.opacity = s.userData.life * 0.6;
            if (s.userData.life <= 0) {
                this.scene.remove(s);
                this.lightStreaks.splice(i, 1);
            }
        }

        // Spawning Logic
        this.spawnAccumulator = (this.spawnAccumulator || 0) + dist;
        const threshold = 40 - Math.min(25, this.gameSpeed * 0.3);

        if (this.spawnAccumulator > threshold) {
            this.spawnAccumulator = 0;

            if (!Boss.active) {
                World.spawnObject(-500, AI.difficulty);

                if (Math.random() < 0.35 && AI.difficulty > 1.2) {
                    const lane = Math.floor(Math.random() * 3) - 1;
                    Combat.spawnEnemy(-500, lane, AI.difficulty);
                }
            } else {
                // Energy Orbs
                const lane = Math.floor(Math.random() * 3) - 1;
                const LANES = [-6, 0, 6];
                const geo = new THREE.SphereGeometry(0.5);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.8 });
                const orb = new THREE.Mesh(geo, mat);
                orb.position.set(LANES[lane + 1], 1, -500);
                orb.userData = { type: 'energy_orb' };
                this.scene.add(orb);
                World.collectibles.push(orb);
            }
        }

        // Boss Trigger - Lowered for easier verification and faster action
        if (state.score > 2600 && !Boss.active && !Boss.defeatedOnce) {
            Boss.spawn();
            Boss.defeatedOnce = false; // Internal flag to prevent immediate respawn if desired
        }

        // Compute World Positions for Collisions
        const playerWorldPos = new THREE.Vector3();
        this.player.updateMatrixWorld();
        this.player.getWorldPosition(playerWorldPos);

        // Combat Collisions
        Combat.checkCollisions(
            playerWorldPos,
            () => {
                if (this.hasShield) {
                    this.hasShield = false;
                    if (this.shieldMesh) this.shieldMesh.visible = false;
                    sounds.powerup();
                } else if (Combat.playerHealth <= 0) {
                    gameOver();
                } else {
                    triggerScreenShake();
                    this.shakeIntensity = 0.4;
                }
            },
            (enemy) => {
                state.score += 150;
                sounds.explosion();
            }
        );

        // Collision Logic
        this.checkCollisions(World.obstacles, true);
        this.checkCollisions(World.collectibles, false);
        Combat.postUpdate();

        // Particles Update
        if (this.particles) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.position.addScaledVector(p.userData.vel, dt);
                p.userData.life -= 2 * dt;
                p.scale.setScalar(p.userData.life);
                if (p.userData.life <= 0) {
                    this.scene.remove(p);
                    this.particles.splice(i, 1);
                }
            }
        }

        // Render pass
        this.composer.render();
    },

    checkCollisions: function (list, isObstacle) {
        const playerPos = this.getWorldPos(this.player);
        const playerRadius = 2.0;
        const itemRadius = 1.5;

        for (let i = list.length - 1; i >= 0; i--) {
            const obj = list[i];
            const objPos = this.getWorldPos(obj);
            const distance = playerPos.distanceTo(objPos);

            if (distance < (playerRadius + (isObstacle ? 1.0 : itemRadius))) {
                if (isObstacle) {
                    if (this.player.position.y - 0.4 < obj.userData.h) {
                        if (this.hasShield) {
                            this.hasShield = false;
                            this.player.material.emissive.setHex(0x008888);
                            sounds.powerup();
                            this.scene.remove(obj);
                            list.splice(i, 1);
                            AI.recordAction('crash');
                            for (let k = 0; k < 10; k++) this.createParticle(objPos.x, objPos.y, objPos.z, 0xffffff);
                        } else {
                            gameOver();
                        }
                    }
                } else {
                    if (obj.userData.type === 'coin' || obj.userData.type === 'energy_orb') {
                        state.score += (obj.userData.type === 'coin') ? 500 : 200;
                        sounds.coin();
                        if (obj.userData.type === 'coin') Achievements.unlock('coin_hoarder');
                        for (let k = 0; k < 5; k++) this.createParticle(objPos.x, objPos.y, objPos.z, 0xffff00);
                    }
                    if (obj.userData.type === 'shield') {
                        this.hasShield = true;
                        if (this.shieldMesh) {
                            this.shieldMesh.visible = true;
                            this.shieldMesh.scale.setScalar(1);
                        }
                    }
                    this.scene.remove(obj);
                    list.splice(i, 1);
                }
            }
        }
    }
};

// ==========================================================================================
// MASTER CONTROLLER
// ==========================================================================================

function togglePause() {
    if (state.mode !== '2d' && state.mode !== '3d') return;

    state.paused = !state.paused;
    const pauseScreen = document.getElementById('pause-screen');

    if (state.paused) {
        pauseScreen.classList.remove('hidden');
        audioCtx.suspend();
    } else {
        pauseScreen.classList.add('hidden');
        audioCtx.resume();
        // Resume loops if they were stopped
        if (state.mode === '2d') Game2D.loop();
        if (state.mode === '3d') Game3D.loop();
    }
}

function transitionTo3D() {
    state.mode = 'transition';
    Game2D.cleanup();

    const warp = document.getElementById('warp-screen');
    warp.classList.remove('hidden');
    warp.classList.add('warp-active');

    setTimeout(() => {
        state.mode = '3d';
        updateUI();
        Game3D.init();

        // Unlock First Warp achievement
        Achievements.unlock('first_warp');

        // Fade out white screen
        warp.classList.remove('warp-active');
        setTimeout(() => warp.classList.add('hidden'), 1000);
    }, 1500);
}

function gameOver() {
    state.mode = 'gameover';
    Game2D.cleanup();
    Game3D.cleanup();
    document.getElementById('final-score').innerText = Math.floor(state.score);
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function restartGame() {
    state.score = 0;
    state.mode = '2d';
    document.getElementById('start-btn').blur();
    document.getElementById('restart-btn').blur();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');

    // Clear 3D container
    document.getElementById('container-3d').innerHTML = '';
    Game3D.cleanup(); // Ensure 3D loop stops

    updateUI();

    audioCtx.resume();
    Game2D.init();
}

// Global Event Listeners
document.getElementById('start-btn').addEventListener('click', restartGame);
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', () => location.reload());

window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
    }
});

// Initial UI
updateUI();
