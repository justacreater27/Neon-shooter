import * as THREE from 'three';
import { Boss } from './boss.js';

export const Combat = {
    projectiles: [],
    enemyProjectiles: [],
    enemies: [],

    // Object Pooling
    projectilePool: [],
    enemyProjectilePool: [],
    particlePool: [],

    // Shared Geometries/Materials
    projectileGeo: new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
    projectileMat: new THREE.MeshBasicMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.9
    }),
    enemyProjGeo: new THREE.SphereGeometry(0.3),
    enemyProjMat: new THREE.MeshBasicMaterial({
        color: 0xff0044,
        transparent: true,
        opacity: 0.9
    }),

    // Weapon Config
    shootCooldown: 0,
    shootDelay: 0.12,

    getWorldPos: function (obj) {
        if (!obj) return new THREE.Vector3();
        const v = new THREE.Vector3();
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(v);
        return v;
    },

    // Player Health
    playerHealth: 100,
    maxHealth: 100,
    invulnerable: false,
    invulnerableTime: 0,
    playerRadius: 2.0, // Standardized as requested

    init: function (scene) {
        this.scene = scene;
        this.cleanup();
        this.shootCooldown = 0;
        this.playerHealth = this.maxHealth;
        this.invulnerable = false;
        this.invulnerableTime = 0;

        // Pre-warm pools
        for (let i = 0; i < 30; i++) {
            const p = new THREE.Mesh(this.projectileGeo, this.projectileMat.clone());
            p.visible = false;
            this.scene.add(p);
            this.projectilePool.push(p);
        }
    },

    // Player Shooting
    shoot: function (playerPos) {
        if (this.shootCooldown > 0) return;

        this.shootCooldown = this.shootDelay;

        let proj;
        if (this.projectilePool.length > 0) {
            proj = this.projectilePool.pop();
            proj.visible = true;
        } else {
            proj = new THREE.Mesh(this.projectileGeo, this.projectileMat.clone());
            this.scene.add(proj);
        }

        proj.position.copy(playerPos);
        proj.position.y += 0.5;
        proj.rotation.x = Math.PI / 2;
        proj.userData = { speed: 180, active: true, trail: [] };

        this.projectiles.push(proj);
        this.createMuzzleFlash(playerPos);

        return true;
    },

    createMuzzleFlash: function (pos) {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.5),
            new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.8 })
        );
        flash.position.copy(pos);
        flash.position.z -= 1;
        this.scene.add(flash);

        const anim = () => {
            flash.scale.multiplyScalar(1.2);
            flash.material.opacity -= 0.1;
            if (flash.material.opacity > 0) requestAnimationFrame(anim);
            else this.scene.remove(flash);
        };
        anim();
    },

    spawnEnemy: function (z, lane, difficulty) {
        const type = Math.random();
        let hp = 1;
        let color = 0xff3366;
        let speed = 8;
        let isShooter = false;
        let size = 0.7;

        if (type > 0.7) { hp = 3; color = 0xffaa00; speed = 4; size = 1.0; }
        if (type > 0.9) { hp = 2; color = 0xdd00ff; isShooter = true; speed = 3; }

        const geo = new THREE.ConeGeometry(size, 1.8, 4); // Low poly for performance/style
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2
        });
        const enemy = new THREE.Mesh(geo, mat);

        const LANES = [-6, 0, 6];
        enemy.position.set(LANES[lane + 1], 1, z);
        enemy.rotation.x = Math.PI;
        enemy.rotation.y = Math.random() * Math.PI;

        enemy.userData = {
            type: 'enemy',
            hp: hp,
            maxHp: hp,
            baseY: 1,
            speed: speed,
            isShooter: isShooter,
            shootTimer: Math.random() * 2 + 1,
            radius: size
        };
        enemy.id = Math.random();

        this.scene.add(enemy);
        this.enemies.push(enemy);
    },

    update: function (dt, playerPos, worldSpeed) {
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        if (this.invulnerable) {
            this.invulnerableTime -= dt;
            if (this.invulnerableTime <= 0) this.invulnerable = false;
        }

        // Update player projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.position.z -= p.userData.speed * dt;
        }

        // Update enemies
        const moveDist = worldSpeed * dt;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.position.z += moveDist + e.userData.speed * dt;
            e.position.y = e.userData.baseY + Math.sin(Date.now() * 0.005 + e.id) * 0.2;
            e.rotation.y += dt * 2;

            if (e.userData.isShooter) {
                e.userData.shootTimer -= dt;
                if (e.userData.shootTimer <= 0) {
                    this.enemyShoot(e.position);
                    e.userData.shootTimer = Math.random() * 1.5 + 1.0;
                }
            }
        }

        // Update enemy projectiles
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            this.enemyProjectiles[i].position.z += (this.enemyProjectiles[i].userData.speed + worldSpeed) * dt;
        }
    },

    postUpdate: function () {
        // Boundary Removal (Run AFTER collisions)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].position.z < -600) {
                this.deactivateProjectile(this.projectiles[i], i);
            }
        }
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].position.z > 20) {
                this.scene.remove(this.enemies[i]);
                this.enemies.splice(i, 1);
            }
        }
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            if (this.enemyProjectiles[i].position.z > 15) {
                this.deactivateEnemyProjectile(this.enemyProjectiles[i], i);
            }
        }
    },

    enemyShoot: function (pos) {
        let proj;
        if (this.enemyProjectilePool.length > 0) {
            proj = this.enemyProjectilePool.pop();
            proj.visible = true;
        } else {
            proj = new THREE.Mesh(this.enemyProjGeo, this.enemyProjMat.clone());
            this.scene.add(proj);
        }

        proj.position.copy(pos);
        proj.userData = { speed: 30, active: true, radius: 0.3 };
        this.enemyProjectiles.push(proj);
    },

    deactivateProjectile: function (p, index) {
        p.visible = false;
        p.userData.active = false;
        this.projectiles.splice(index, 1);
        this.projectilePool.push(p);
    },

    deactivateEnemyProjectile: function (p, index) {
        p.visible = false;
        p.userData.active = false;
        this.enemyProjectiles.splice(index, 1);
        this.enemyProjectilePool.push(p);
    },

    checkCollisions: function (playerWorldPos, onHit, onEnemyKill) {
        const objPos = new THREE.Vector3();
        const bulletPos = new THREE.Vector3();

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const bPos = this.getWorldPos(p);
            let hit = false;

            // Check Boss
            if (Boss.active && Boss.mesh) {
                const bossPos = this.getWorldPos(Boss.mesh);
                const bossRadius = Boss.radius || 4.5;
                const bulletRadius = 0.8;
                const dist = bPos.distanceTo(bossPos);
                if (dist < (bossRadius + bulletRadius)) {
                    Boss.takeDamage(10);
                    this.createExplosion(bPos, 0x00f2ff, 8); // Cyan sparks for impact
                    this.deactivateProjectile(p, i);
                    hit = true;
                }
            }

            if (hit) continue;

            // Check Enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const ePos = this.getWorldPos(e);
                const dist = bPos.distanceTo(ePos);

                if (dist < (e.userData.radius + 0.8)) {
                    e.userData.hp--;
                    e.material.emissive.setHex(0xffffff);
                    e.material.emissiveIntensity = 2;
                    setTimeout(() => {
                        if (e.material) {
                            e.material.emissive.setHex(e.material.color.getHex());
                            e.material.emissiveIntensity = 0.8;
                        }
                    }, 50);

                    this.createExplosion(bPos, 0x00f2ff, 5); // Cyan sparks for impact

                    this.deactivateProjectile(p, i);
                    if (e.userData.hp <= 0) {
                        this.createExplosion(ePos, e.material.color.getHex(), 20);
                        this.scene.remove(e);
                        this.enemies.splice(j, 1);
                        if (onEnemyKill) onEnemyKill(e);
                    }
                    hit = true;
                    break;
                }
            }
        }

        // Enemy projectiles vs Player
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            const pPos = this.getWorldPos(p);
            const dist = pPos.distanceTo(playerWorldPos);

            if (dist < (this.playerRadius + p.userData.radius)) {
                if (!this.invulnerable) {
                    this.takeDamage(10);
                    if (onHit) onHit();
                }
                this.deactivateEnemyProjectile(p, i);
            }
        }

        // Boss Projectiles vs Player
        if (Boss.active) {
            for (let i = Boss.projectiles.length - 1; i >= 0; i--) {
                const p = Boss.projectiles[i];
                const pPos = this.getWorldPos(p);
                const dist = pPos.distanceTo(playerWorldPos);
                if (dist < (this.playerRadius + 0.5)) {
                    if (!this.invulnerable) {
                        this.takeDamage(15);
                        if (onHit) onHit();
                    }
                }
            }
        }

        // Enemies vs Player
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const ePos = this.getWorldPos(e);
            const dist = ePos.distanceTo(playerWorldPos);

            if (dist < (this.playerRadius + e.userData.radius)) {
                if (!this.invulnerable) {
                    this.takeDamage(20);
                    if (onHit) onHit();
                }
                this.scene.remove(e);
                this.enemies.splice(i, 1);
            }
        }
    },

    takeDamage: function (amount) {
        this.playerHealth = Math.max(0, this.playerHealth - amount);
        this.invulnerable = true;
        this.invulnerableTime = 0.5; // 500ms window as requested

        const healthBar = document.getElementById('health-bar');
        if (healthBar) healthBar.style.width = (this.playerHealth / this.maxHealth * 100) + '%';
    },

    createExplosion: function (pos, color, count = 15) {
        // Limited particles for performance
        const maxParticles = 200;
        let activeParticles = 0; // In a real app, track this globally

        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshBasicMaterial({ color: color })
            );
            particle.position.copy(pos);
            particle.userData = {
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 15
                ),
                life: 1.0
            };
            this.scene.add(particle);

            const animate = () => {
                particle.position.addScaledVector(particle.userData.vel, 0.016);
                particle.userData.life -= 0.05;
                particle.scale.setScalar(particle.userData.life);

                if (particle.userData.life > 0) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(particle);
                }
            };
            animate();
        }
    },

    cleanup: function () {
        this.projectiles.forEach(p => this.scene.remove(p));
        this.enemyProjectiles.forEach(p => this.scene.remove(p));
        this.enemies.forEach(e => this.scene.remove(e));
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.enemies = [];
        // Keep pools but hide elements
        this.projectilePool.forEach(p => p.visible = false);
        this.enemyProjectilePool.forEach(p => p.visible = false);
    }
};

