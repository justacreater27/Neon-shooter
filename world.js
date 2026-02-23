import * as THREE from 'three';

export const World = {
    scene: null,
    floorSegments: [],
    buildings: [],
    bgBuildings: [],
    obstacles: [],
    collectibles: [],
    billboards: [],
    drones: [],
    debris: null,

    // Pooling
    obstaclePool: [],
    coinPool: [],
    shieldPool: [],

    // Shared Geometries
    barrierGeo: new THREE.BoxGeometry(1.8, 1.2, 1.2),
    coinGeo: new THREE.IcosahedronGeometry(0.6),
    shieldGeo: new THREE.TorusKnotGeometry(0.4, 0.1, 32, 8),
    buildingGeo: new THREE.BoxGeometry(8, 1, 8),

    viewDistance: 1000,
    segmentLength: 10,
    speed: 0,
    laneWidth: 6,
    roadArches: [],
    megastructures: [],
    energyRails: [],
    foregroundObjects: [],

    init: function (scene) {
        this.scene = scene;
        this.cleanup();
        this.lastZ = 0;

        // Pre-warm pools
        for (let i = 0; i < 20; i++) {
            const obs = new THREE.Mesh(this.barrierGeo, new THREE.MeshPhongMaterial({
                color: 0xff00ff,
                emissive: 0xff00ff,
                emissiveIntensity: 0.5,
                shininess: 100
            }));
            obs.visible = false;
            this.scene.add(obs);
            this.obstaclePool.push(obs);

            const coin = new THREE.Mesh(this.coinGeo, new THREE.MeshStandardMaterial({
                color: 0xffff00,
                emissive: 0xaa8800,
                metalness: 0.8,
                roughness: 0.2
            }));
            coin.visible = false;
            this.scene.add(coin);
            this.coinPool.push(coin);
        }

        for (let i = 0; i < 100; i++) {
            this.createSegment(-i * this.segmentLength);
        }

        this.createSky();
        this.createDebris();
        this.createBackground();
        this.createEnergyRails();
        this.createMegastructures();
    },

    createDebris: function () {
        const count = 200;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 60;
            pos[i * 3 + 1] = Math.random() * 20;
            pos[i * 3 + 2] = -Math.random() * 500;
            sizes[i] = Math.random() * 2;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            color: 0x00f2ff,
            size: 0.5,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });

        this.debris = new THREE.Points(geo, mat);
        this.scene.add(this.debris);
    },

    createBackground: function () {
        // Distant Skyline
        for (let i = 0; i < 30; i++) {
            this.spawnBGBuilding(-i * 40 - 200);
        }
    },

    spawnBGBuilding: function (z) {
        const h = Math.random() * 150 + 100;
        const bGeo = new THREE.BoxGeometry(20, h, 20);
        const bMat = new THREE.MeshBasicMaterial({
            color: 0x020205,
            transparent: true,
            opacity: 0.6 // Dimmer for depth
        });
        const b = new THREE.Mesh(bGeo, bMat);
        const side = Math.random() > 0.5 ? 1 : -1;
        b.position.set(side * (Math.random() * 200 + 250), h / 2 - 50, z);
        this.scene.add(b);
        this.bgBuildings.push(b);
    },

    createMegastructures: function () {
        // Massive distant structures
        for (let i = 0; i < 5; i++) {
            const geo = new THREE.BoxGeometry(200, 1000, 200);
            const mat = new THREE.MeshStandardMaterial({ color: 0x010102, metalness: 1, roughness: 0.2 });
            const m = new THREE.Mesh(geo, mat);
            m.position.set((Math.random() - 0.5) * 1500, 400, -1500 - i * 800);
            this.scene.add(m);
            this.megastructures.push(m);

            // Giant Hologram above it
            if (Math.random() > 0.3) {
                const hGeo = new THREE.PlaneGeometry(300, 150);
                const hMat = new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? 0x00f2ff : 0xff00ff,
                    transparent: true,
                    opacity: 0.1,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending
                });
                const holo = new THREE.Mesh(hGeo, hMat);
                holo.position.set(m.position.x, 600, m.position.z + 50);
                this.scene.add(holo);
                this.megastructures.push(holo);
            }
        }
    },

    createEnergyRails: function () {
        const railGeo = new THREE.BoxGeometry(0.5, 0.5, 1000);
        const railMat = new THREE.MeshStandardMaterial({
            color: 0x00f2ff,
            emissive: 0x00f2ff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.3
        });

        const leftRail = new THREE.Mesh(railGeo, railMat);
        leftRail.position.set(-18, 0.25, -450);
        this.scene.add(leftRail);
        this.energyRails.push(leftRail);

        const rightRail = new THREE.Mesh(railGeo, railMat.clone());
        rightRail.position.set(18, 0.25, -450);
        this.scene.add(rightRail);
        this.energyRails.push(rightRail);
    },

    createSky: function () {
        const geo = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        for (let i = 0; i < 4000; i++) {
            vertices.push((Math.random() - 0.5) * 2000, Math.random() * 1000 - 100, (Math.random() - 0.5) * 2000);
            const c = new THREE.Color();
            c.setHSL(0.6, 0.8, Math.random() * 0.5 + 0.5);
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const mat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.8 });
        this.starField = new THREE.Points(geo, mat);
        this.scene.add(this.starField);

        // Dark Upper Sky Plane for contrast
        const skyGeo = new THREE.PlaneGeometry(2000, 1000);
        const skyMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        this.skyPlane = new THREE.Mesh(skyGeo, skyMat);
        this.skyPlane.position.set(0, 400, -1000); // Behind buildings
        this.scene.add(this.skyPlane);
    },

    createSegment: function (z) {
        const geo = new THREE.PlaneGeometry(50, this.segmentLength);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x010103,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(geo, mat);
        floor.rotation.x = -Math.PI / 2;

        // Vertical Curvature Simulation
        const curve = Math.sin(z * 0.01) * 2;
        floor.position.set(0, curve, z);

        this.scene.add(floor);
        this.floorSegments.push(floor);

        // Neon Grid Lines
        const lMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.15 });
        const laneMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.1 });

        for (let i = -1; i <= 1; i++) {
            const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, this.segmentLength), i === 0 ? lMat : laneMat);
            line.position.x = i * this.laneWidth;
            line.position.z = 0.05;
            floor.add(line);

            // Road Grid Texture simulation (horizontal lines)
            for (let j = 0; j < 5; j++) {
                const gridLine = new THREE.Mesh(new THREE.PlaneGeometry(50, 0.08), lMat);
                gridLine.position.y = (j / 5 - 0.5) * this.segmentLength;
                gridLine.position.z = 0.03;
                gridLine.userData.isGrid = true;
                floor.add(gridLine);
            }

            // Subtle road edge pulse glow
            if (i !== 0) {
                const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, this.segmentLength), new THREE.MeshBasicMaterial({
                    color: 0x0088ff,
                    transparent: true,
                    opacity: 0.02,
                    blending: THREE.AdditiveBlending
                }));
                glow.position.x = i * this.laneWidth;
                floor.add(glow);
            }
        }

        // Overhead Neon Arches every ~500 units
        if (Math.abs(z % 500) < this.segmentLength) {
            this.spawnArch(z, curve);
        }

        // Foreground Silhouettes (Poles)
        if (Math.random() > 0.8) {
            this.spawnForegroundObject(z, curve);
        }

        this.spawnBuildings(z, curve);
        if (Math.random() > 0.85) this.spawnDrone(z, curve);
    },

    spawnArch: function (z, y) {
        const archGeo = new THREE.TorusGeometry(18, 0.2, 8, 32, Math.PI);
        const archMat = new THREE.MeshStandardMaterial({
            color: 0x00f2ff,
            emissive: 0x00f2ff,
            emissiveIntensity: 2,
            metalness: 0.8,
            roughness: 0.2
        });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(0, y - 0.5, z);
        this.scene.add(arch);
        this.roadArches.push(arch);
    },

    spawnForegroundObject: function (z, y) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 30),
            new THREE.MeshBasicMaterial({ color: 0x020205 })
        );
        // Fast moving foreground silhouette
        pole.position.set(side * 18, y + 15, z);
        this.scene.add(pole);
        this.foregroundObjects.push(pole);
    },

    spawnBuildings: function (z, yOffset = 0) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const h = Math.random() * 60 + 30;
        const bGeo = new THREE.BoxGeometry(10, h, 10);

        // Premium Cyberpunk Material with Magenta/Purple variations
        const bColors = [0x050512, 0x080515, 0x050818, 0x0a0510];
        const bMat = new THREE.MeshStandardMaterial({
            color: bColors[Math.floor(Math.random() * bColors.length)],
            metalness: 0.9,
            roughness: 0.1
        });
        const b = new THREE.Mesh(bGeo, bMat);
        b.position.set(side * (Math.random() * 20 + 35), h / 2 - 5 + yOffset, z);

        // Add Window Grid Pattern
        const windowGeo = new THREE.PlaneGeometry(8, h * 0.8, 4, 10);
        const windowMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: side > 0 ? 0x00f2ff : 0xaa00ff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });

        // Create windows by adding small emissive planes or using a texture-like approach with multiple meshes
        // For performance, we can add a few vertical strips and horizontal "floors"
        for (let i = 0; i < 3; i++) {
            const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.1, h * 0.7), new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x00ffff : 0xff00ff,
                transparent: true,
                opacity: 0.8
            }));
            strip.position.set(side * -5.05, 0, (i - 1) * 2.5);
            strip.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
            b.add(strip);
        }

        // Window Grid
        const floorCount = Math.floor(h / 3);
        const gridGroup = new THREE.Group();
        for (let f = 0; f < floorCount; f++) {
            if (Math.random() > 0.3) { // 70% chance of room being lit
                const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshBasicMaterial({
                    color: side > 0 ? 0x00f2ff : 0xaa00ff,
                    transparent: true,
                    opacity: 0.4 + Math.random() * 0.4
                }));
                win.position.set(side * -5.02, (f - floorCount / 2) * 3, (Math.random() - 0.5) * 6);
                win.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
                if (Math.random() > 0.9) win.userData.flicker = true;
                gridGroup.add(win);
            }
        }
        b.add(gridGroup);
        b.userData.windows = gridGroup;

        this.scene.add(b);
        this.buildings.push(b);

        // Holographic Billboards
        if (Math.random() > 0.7) {
            this.spawnBillboard(b, h);
        }
    },

    spawnBillboard: function (parent, buildingHeight) {
        const w = 12, h = 6;
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0x00f2ff : 0xff00ff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const billboard = new THREE.Mesh(geo, mat);
        billboard.position.set(0, buildingHeight * 0.3, 6);
        billboard.userData = {
            flickerTimer: 0,
            originalOpacity: 0.4
        };
        parent.add(billboard);
        this.billboards.push(billboard);
    },

    spawnDrone: function (z, yOffset = 0) {
        const drone = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, 0.5),
            new THREE.MeshBasicMaterial({ color: 0xff0044 })
        );
        drone.position.set((Math.random() - 0.5) * 100, Math.random() * 20 + 10 + yOffset, z);
        drone.userData = {
            speed: Math.random() * 20 + 20,
            sinOffset: Math.random() * Math.PI * 2
        };
        this.scene.add(drone);
        this.drones.push(drone);
    },

    update: function (speed, dt, bossActive = false) {
        const moveDist = speed * dt;
        const time = Date.now() * 0.001;
        const speedFactor = speed / 20;

        // Parallax Movement
        this.floorSegments.forEach(f => {
            f.position.z += moveDist;
            // Lane floor animation (moving grid flow)
            f.children.forEach(c => {
                if (c.userData.isGrid) {
                    c.position.y += speed * 0.2 * dt; // Flowing effect
                    if (c.position.y > this.segmentLength / 2) c.position.y -= this.segmentLength;
                }
                if (c.material && c.material.opacity) {
                    // Reactive pulsing
                    c.material.opacity = (bossActive ? 0.05 : 0.1) + Math.sin(time * 5 * speedFactor + f.position.z * 0.5) * 0.05;
                }
            });
        });

        this.buildings.forEach(b => {
            b.position.z += moveDist;
            // Micro-animation: pulse reaction to speed
            const s = 1 + Math.sin(time * speedFactor + b.position.z * 0.1) * 0.01;
            b.scale.set(s, 1, s);

            // Window Flickering & Color variation
            if (b.userData.windows) {
                b.userData.windows.children.forEach(w => {
                    if (w.userData.flicker && Math.random() > 0.98) {
                        w.visible = !w.visible;
                    }
                });
            }
        });

        this.foregroundObjects.forEach(p => {
            p.position.z += moveDist;
        });

        this.bgBuildings.forEach(b => {
            b.position.z += moveDist * 0.4;
        });

        this.megastructures.forEach(m => {
            m.position.z += moveDist * 0.1; // Very slow
            if (m.position.z > 500) m.position.z -= 4000;
        });

        this.roadArches.forEach(a => {
            a.position.z += moveDist;
        });

        this.energyRails.forEach(r => {
            r.position.z += moveDist;
            if (r.position.z > 500) r.position.z -= 1000;
            // Subtle pulse
            if (r.material) r.material.emissiveIntensity = 0.5 + Math.sin(time * 3) * 0.2;
        });

        this.drones.forEach(d => {
            d.position.z += moveDist + d.userData.speed * dt;
            d.position.y += Math.sin(time * 2 + d.userData.sinOffset) * 0.05;
        });

        // Debris movement
        if (this.debris) {
            const posAttr = this.debris.geometry.attributes.position;
            for (let i = 0; i < posAttr.count; i++) {
                posAttr.setZ(i, posAttr.getZ(i) + moveDist * 1.2);
                if (posAttr.getZ(i) > 20) posAttr.setZ(i, -500);
            }
            posAttr.needsUpdate = true;
        }

        // Starfield subtle rotation
        if (this.starField) {
            this.starField.rotation.y += 0.0001;
            this.starField.rotation.z += 0.00005;
        }

        // Billboards micro-animations (flicker)
        this.billboards.forEach(b => {
            b.userData.flickerTimer -= dt;
            if (b.userData.flickerTimer <= 0) {
                if (Math.random() > 0.95) {
                    b.visible = !b.visible;
                    b.userData.flickerTimer = Math.random() * 0.1 + 0.05;
                } else {
                    b.visible = true;
                    b.userData.flickerTimer = Math.random() * 2;
                }
            }
        });

        // Recycled floor
        if (this.floorSegments[0].position.z > 20) {
            const first = this.floorSegments.shift();
            const lastZ = this.floorSegments[this.floorSegments.length - 1].position.z;
            const newZ = lastZ - this.segmentLength;
            const curve = Math.sin(newZ * 0.01) * 2;
            first.position.set(0, curve, newZ);
            this.floorSegments.push(first);
        }

        // Cleanup distant buildings
        this.cleanupList(this.buildings, 100);
        this.cleanupList(this.bgBuildings, 150, true);
        this.cleanupList(this.drones, 100);
        this.cleanupList(this.roadArches, 100);
        this.cleanupList(this.foregroundObjects, 100);

        this.updateEntities(this.obstacles, moveDist, dt, true);
        this.updateEntities(this.collectibles, moveDist, dt, false);
    },

    cleanupList: function (list, dist, isBG = false) {
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].position.z > dist) {
                this.scene.remove(list[i]);
                list.splice(i, 1);
                if (isBG) this.spawnBGBuilding(-this.viewDistance - Math.random() * 200);
            }
        }
    },

    updateEntities: function (list, moveDist, dt, isObstacle) {
        for (let i = list.length - 1; i >= 0; i--) {
            const obj = list[i];
            obj.position.z += moveDist;
            // Micro-animation for obstacles
            if (isObstacle) {
                obj.rotation.y += dt;
                obj.scale.setScalar(1 + Math.sin(Date.now() * 0.005 + obj.position.z) * 0.05);
            }
            if (obj.position.z > 15) {
                this.deactivateEntity(obj, list, i, isObstacle);
            }
        }
    },

    deactivateEntity: function (obj, list, index, isObstacle) {
        obj.visible = false;
        list.splice(index, 1);
        if (isObstacle) this.obstaclePool.push(obj);
        else if (obj.userData.type === 'coin') this.coinPool.push(obj);
        else this.shieldPool.push(obj);
    },

    spawnObject: function (z, difficulty) {
        if (Math.random() > 0.85 / (difficulty || 1)) return;
        const LANES = [-6, 0, 6];
        const laneIdx = Math.floor(Math.random() * 3);
        const xPos = LANES[laneIdx];
        const type = Math.random();

        if (type < 0.6) {
            let obs = this.obstaclePool.length > 0 ? this.obstaclePool.pop() : null;
            if (!obs) {
                obs = new THREE.Mesh(this.barrierGeo, new THREE.MeshPhongMaterial({
                    color: 0xff00ff,
                    emissive: 0xff00ff,
                    emissiveIntensity: 0.5
                }));
                this.scene.add(obs);
            }
            const h = Math.random() > 0.5 ? 1.2 : 2.5;
            obs.scale.y = h / 1.2;
            obs.position.set(xPos, h / 2, z);
            obs.visible = true;
            obs.userData = { type: 'barrier', h: h };
            this.obstacles.push(obs);
        } else {
            const isCoin = type < 0.85;
            let coll = isCoin ? (this.coinPool.pop()) : (this.shieldPool.pop());
            if (!coll) {
                coll = new THREE.Mesh(isCoin ? this.coinGeo : this.shieldGeo,
                    new THREE.MeshStandardMaterial({
                        color: isCoin ? 0xffff00 : 0x00ff00,
                        emissive: isCoin ? 0xaa8800 : 0x008800,
                        metalness: 0.8,
                        roughness: 0.2
                    }));
                this.scene.add(coll);
            }
            coll.position.set(xPos, 1.5, z);
            coll.visible = true;
            coll.userData = { type: isCoin ? 'coin' : 'shield' };
            coll.rotation.y = Math.random() * Math.PI * 2;
            this.collectibles.push(coll);
        }
    },

    cleanup: function () {
        [this.floorSegments, this.buildings, this.bgBuildings, this.megastructures, this.obstacles, this.collectibles, this.drones, this.roadArches, this.energyRails, this.foregroundObjects].forEach(list => {
            if (list) list.forEach(obj => this.scene.remove(obj));
        });
        if (this.debris) this.scene.remove(this.debris);
        if (this.starField) this.scene.remove(this.starField);

        this.floorSegments = []; this.buildings = []; this.bgBuildings = []; this.megastructures = [];
        this.obstacles = []; this.collectibles = []; this.drones = []; this.billboards = [];
        this.roadArches = []; this.energyRails = []; this.foregroundObjects = [];
    }
};

