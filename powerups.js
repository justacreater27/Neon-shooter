import * as THREE from 'three';

export const PowerUps = {
    active: [],
    timers: {},

    types: {
        shield: { color: 0x00ff00, duration: Infinity, icon: '🛡️' },
        slowmo: { color: 0x00ffff, duration: 2, icon: '⏱️' },
        magnet: { color: 0xffff00, duration: 5, icon: '🧲' },
        doubleScore: { color: 0xff00ff, duration: 10, icon: '✨' },
        dash: { color: 0xff8800, duration: 1, icon: '⚡' }
    },

    init: function () {
        this.active = [];
        this.timers = {};
    },

    spawn: function (scene, z, lane) {
        const types = Object.keys(this.types);
        const type = types[Math.floor(Math.random() * types.length)];
        const config = this.types[type];

        const geo = new THREE.TorusGeometry(0.5, 0.15, 16, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.8
        });
        const powerup = new THREE.Mesh(geo, mat);

        powerup.position.set(lane * 2.5, 1, z);
        powerup.rotation.x = Math.PI / 2;
        powerup.userData = { type: 'powerup', powerupType: type };

        scene.add(powerup);
        return powerup;
    },

    activate: function (type, onActivate) {
        const config = this.types[type];
        if (!config) return;

        // Add to active list
        if (!this.active.includes(type)) {
            this.active.push(type);
        }

        // Set timer
        if (config.duration !== Infinity) {
            this.timers[type] = config.duration;
        }

        // Update UI
        this.updateUI();

        // Callback
        if (onActivate) onActivate(type);
    },

    update: function (dt) {
        for (let type in this.timers) {
            this.timers[type] -= dt;

            if (this.timers[type] <= 0) {
                this.deactivate(type);
            }
        }

        this.updateUI();
    },

    deactivate: function (type) {
        const index = this.active.indexOf(type);
        if (index > -1) {
            this.active.splice(index, 1);
        }
        delete this.timers[type];
        this.updateUI();
    },

    isActive: function (type) {
        return this.active.includes(type);
    },

    updateUI: function () {
        const container = document.getElementById('powerup-display');
        if (!container) return;

        container.innerHTML = '';

        for (let type of this.active) {
            const config = this.types[type];
            const div = document.createElement('div');
            div.className = 'powerup-item';
            div.style.cssText = `
                display: inline-block;
                margin: 5px;
                padding: 8px 12px;
                background: rgba(0,0,0,0.7);
                border: 2px solid #${config.color.toString(16).padStart(6, '0')};
                border-radius: 5px;
                color: #${config.color.toString(16).padStart(6, '0')};
                font-size: 14px;
            `;

            const timer = this.timers[type];
            const text = timer ? `${config.icon} ${timer.toFixed(1)}s` : config.icon;
            div.innerText = text;

            container.appendChild(div);
        }
    },

    cleanup: function () {
        this.active = [];
        this.timers = {};
        this.updateUI();
    }
};
