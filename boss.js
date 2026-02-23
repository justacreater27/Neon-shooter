import * as THREE from 'three';
import { Achievements } from './achievements.js';
import { Combat } from './combat.js';

export const Boss = {
    active: false,
    state: 'IDLE',
    phase: 0,
    health: 1000,
    maxHealth: 1000,
    mesh: null,
    projectiles: [],
    minions: [],
    timer: 0,
    attackTimer: 0,
    phaseStartTime: 0,
    radius: 4.5,

    // Pooling
    projectilePool: [],
    projGeo: new THREE.SphereGeometry(0.4),
    projMat: new THREE.MeshBasicMaterial({ color: 0xff0000 }),

    init: function (scene) {
        this.scene = scene;
        this.active = false;
        this.defeatedOnce = false;
        this.state = 'IDLE';
        this.projectiles = [];
        this.minions = [];

        // Pre-warm pool
        for (let i = 0; i < 30; i++) {
            const p = new THREE.Mesh(this.projGeo, this.projMat.clone());
            p.visible = false;
            this.scene.add(p);
            this.projectilePool.push(p);
        }
    },

    spawn: function () {
        if (this.active) return;

        this.active = true;
        this.state = 'SPAWNING';
        this.health = this.maxHealth;
        this.phase = 1;
        this.timer = 0;
        this.attackTimer = 0;

        // Create Boss Mesh (Dual layer for better visibility)
        const geo = new THREE.DodecahedronGeometry(4);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x000000,
            emissive: 0xff0000,
            emissiveIntensity: 4.0, // Brighter foreground hierarchy
            wireframe: true
        });

        this.mesh = new THREE.Mesh(geo, mat);

        // Inner Glow Core
        const coreGeo = new THREE.DodecahedronGeometry(3.8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.5 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        this.mesh.add(core);

        this.mesh.position.set(0, 5, -50);
        this.scene.add(this.mesh);

        // World Reaction: Flickering lights on spawn
        const flicker = () => {
            if (!this.active || !this.scene) return;
            const dark = Math.random() > 0.5;
            this.scene.traverse(obj => {
                if (obj.isMesh && obj.material && obj !== this.mesh) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                    materials.forEach(m => {
                        if (m.emissive) m.emissiveIntensity = dark ? 0.05 : 0.3;
                    });
                }
            });
            if (this.timer < 3) setTimeout(flicker, 100);
            else {
                // Reset materials
                this.scene.traverse(obj => {
                    if (obj.isMesh && obj.material) {
                        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                        materials.forEach(m => { if (m.emissive) m.emissiveIntensity = 0.5; });
                    }
                });
            }
        };
        flicker();

        const ui = document.getElementById('boss-ui');
        if (ui) ui.classList.remove('hidden');

        setTimeout(() => {
            this.state = 'PHASE_1';
        }, 2000);
    },

    update: function (dt, playerPos) {
        if (!this.active || !this.mesh) return;

        this.timer += dt;
        this.attackTimer += dt;

        if (this.state === 'SPAWNING') {
            if (this.mesh.position.z < -20) {
                this.mesh.position.z += 15 * dt;
            }
        } else if (this.state === 'PHASE_1') {
            this.mesh.position.x = Math.sin(this.timer * 0.5) * 5;
            if (this.attackTimer > 2.5) { this.laneBlast(playerPos); this.attackTimer = 0; }
            if (this.health < 600) { this.state = 'PHASE_2'; }
        } else if (this.state === 'PHASE_2') {
            this.mesh.position.x = Math.sin(this.timer * 1.5) * 8;
            if (this.attackTimer > 1.8) {
                if (Math.random() > 0.5) this.spreadShot(playerPos);
                else this.spawnMinion();
                this.attackTimer = 0;
            }
            if (this.health < 200) { this.state = 'PHASE_3'; }
        } else if (this.state === 'PHASE_3') {
            this.mesh.position.x = Math.sin(this.timer * 3) * 10;
            this.mesh.scale.setScalar(1 + Math.sin(this.timer * 10) * 0.1);
            if (this.attackTimer > 1.2) { this.rapidFire(playerPos); this.attackTimer = 0; }
            if (this.health < 50) {
                this.state = 'ENRAGED';
                this.mesh.material.emissive.setHex(0xcc00cc); // Toned down
            }
        } else if (this.state === 'ENRAGED') {
            this.mesh.position.x = Math.sin(this.timer * 5) * 12;
            this.mesh.rotation.y += dt * 5;
            const flash = Math.sin(this.timer * 20) > 0;
            this.mesh.material.emissive.setHex(flash ? 0xcc0000 : 0x660000); // Toned down
            if (this.attackTimer > 0.8) { this.shockwave(); this.attackTimer = 0; }
        }

        this.mesh.rotation.x += dt * 0.5;
        this.mesh.rotation.y += dt * 0.3;

        this.updateProjectiles(dt);
        this.updateMinions(dt);

        const bar = document.getElementById('boss-health-bar');
        if (bar) bar.style.width = (this.health / this.maxHealth * 100) + '%';

        if (this.health <= 0 && this.state !== 'DEFEATED') {
            this.defeat();
        }
    },

    laneBlast: function (target) {
        const lane = Math.floor(Math.random() * 3) - 1;
        const LANES = [-6, 0, 6];
        this.fireProjectile(LANES[lane + 1], this.mesh.position.y, this.mesh.position.z, 0xff0000, 25);
    },

    spreadShot: function (target) {
        const LANES = [-6, 0, 6];
        for (let i = 0; i < 3; i++) {
            this.fireProjectile(LANES[i], this.mesh.position.y, this.mesh.position.z, 0xff8800, 20);
        }
    },

    rapidFire: function (target) {
        const targetLane = Math.round(target.x / 6);
        const LANES = [-6, 0, 6];
        this.fireProjectile(LANES[targetLane + 1] || 0, this.mesh.position.y, this.mesh.position.z, 0xff00ff, 30);
    },

    shockwave: function () {
        const LANES = [-6, 0, 6];
        for (let i = 0; i < 3; i++) {
            this.fireProjectile(LANES[i], 0.5, this.mesh.position.z, 0xffff00, 15);
        }
    },

    fireProjectile: function (x, y, z, color, speed) {
        let proj;
        if (this.projectilePool.length > 0) {
            proj = this.projectilePool.pop();
            proj.visible = true;
        } else {
            proj = new THREE.Mesh(this.projGeo, this.projMat.clone());
            this.scene.add(proj);
        }
        proj.material.color.setHex(color);
        proj.position.set(x, y, z);
        proj.userData = { speed: speed, type: 'boss_projectile' };
        this.projectiles.push(proj);
    },

    spawnMinion: function () {
        if (this.minions.length >= 3) return;

        const LANES = [-6, 0, 6];
        const lane = Math.floor(Math.random() * 3);
        const geo = new THREE.ConeGeometry(0.5, 1, 6);
        const mat = new THREE.MeshPhongMaterial({
            color: 0xff3333,
            emissive: 0x880000,
            emissiveIntensity: 0.5
        });
        const minion = new THREE.Mesh(geo, mat);

        minion.position.set(LANES[lane], 1, this.mesh.position.z - 5);
        minion.rotation.x = Math.PI / 2;
        minion.userData = { speed: 12, hp: 1 };

        this.scene.add(minion);
        this.minions.push(minion);
    },

    updateProjectiles: function (dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.position.z += p.userData.speed * dt;

            if (p.position.z > 15) {
                p.visible = false;
                this.projectiles.splice(i, 1);
                this.projectilePool.push(p);
            }
        }
    },

    updateMinions: function (dt) {
        for (let i = this.minions.length - 1; i >= 0; i--) {
            const m = this.minions[i];
            m.position.z += m.userData.speed * dt;
            m.position.y = 1 + Math.sin(Date.now() * 0.005 + i) * 0.2;

            if (m.position.z > 15) {
                this.scene.remove(m);
                this.minions.splice(i, 1);
            }
        }
    },

    takeDamage: function (amount) {
        this.health = Math.max(0, this.health - amount);

        // Reward player with slight health restoration for hitting the boss
        Combat.playerHealth = Math.min(Combat.maxHealth, Combat.playerHealth + 0.5);
        const healthBar = document.getElementById('health-bar');
        if (healthBar) healthBar.style.width = (Combat.playerHealth / Combat.maxHealth * 100) + '%';

        if (this.mesh) {
            this.mesh.material.emissive.setHex(0xffffff);
            this.mesh.material.emissiveIntensity = 2;

            // Boss Shake
            const origPos = this.mesh.position.x;
            this.mesh.position.x += (Math.random() - 0.5) * 2;

            setTimeout(() => {
                if (this.mesh) {
                    this.mesh.material.emissive.setHex(this.state === 'ENRAGED' ? 0xcc00cc : 0x880000);
                    this.mesh.material.emissiveIntensity = 0.5;
                }
            }, 80);
        }

        // Impact shockwave
        this.createImpactRipple(this.mesh.position);
    },

    createImpactRipple: function (pos) {
        const ringGeo = new THREE.TorusGeometry(this.radius, 0.05, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);

        const anim = () => {
            ring.scale.multiplyScalar(1.1);
            ring.material.opacity -= 0.05;
            if (ring.material.opacity > 0) requestAnimationFrame(anim);
            else this.scene.remove(ring);
        };
        anim();
    },

    defeat: function () {
        this.state = 'DEFEATED';
        this.active = false;
        this.defeatedOnce = true;
        this.createExplosion();

        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }

        this.projectiles.forEach(p => p.visible = false);
        this.minions.forEach(m => this.scene.remove(m));
        this.projectiles = [];
        this.minions = [];

        const ui = document.getElementById('boss-ui');
        if (ui) ui.classList.add('hidden');
        Achievements.check(true, 'boss_slayer');
    },

    createExplosion: function () {
        if (!this.mesh) return;
        const pos = this.mesh.position.clone();
        for (let i = 0; i < 40; i++) {
            const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff0000 : 0xff8800 });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.copy(pos);
            particle.userData = {
                vel: new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30),
                life: 2.0
            };
            this.scene.add(particle);
            const animate = () => {
                particle.position.addScaledVector(particle.userData.vel, 0.016);
                particle.userData.life -= 0.04;
                particle.scale.setScalar(particle.userData.life);
                if (particle.userData.life > 0) requestAnimationFrame(animate);
                else this.scene.remove(particle);
            };
            animate();
        }
    },

    cleanup: function () {
        if (this.mesh) { this.scene.remove(this.mesh); this.mesh = null; }
        this.projectiles.forEach(p => p.visible = false);
        this.minions.forEach(m => this.scene.remove(m));
        this.projectiles = [];
        this.minions = [];
        this.active = false;
    }
};

