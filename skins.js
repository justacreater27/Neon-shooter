export const Skins = {
    available: [
        {
            id: 'default',
            name: 'Neon Pilot',
            color: 0x00ffff,
            emissive: 0x008888,
            trail: 0x00ffff,
            unlocked: true
        },
        {
            id: 'ninja',
            name: 'Cyber Ninja',
            color: 0xff0000,
            emissive: 0x880000,
            trail: 0xff0000,
            unlocked: false,
            requirement: 'Defeat first boss'
        },
        {
            id: 'robot',
            name: 'Neon Robot',
            color: 0x00ff00,
            emissive: 0x008800,
            trail: 0x00ff00,
            unlocked: false,
            requirement: 'Reach score 10000'
        },
        {
            id: 'phantom',
            name: 'Hologram Phantom',
            color: 0xff00ff,
            emissive: 0x880088,
            trail: 0xff00ff,
            unlocked: false,
            requirement: 'Collect 500 coins'
        },
        {
            id: 'plasma',
            name: 'Plasma Knight',
            color: 0xffff00,
            emissive: 0x888800,
            trail: 0xffff00,
            unlocked: false,
            requirement: 'Complete untouchable run'
        },
        {
            id: 'void',
            name: 'Dark Void',
            color: 0x8800ff,
            emissive: 0x440088,
            trail: 0x8800ff,
            unlocked: false,
            requirement: 'Defeat 5 bosses'
        }
    ],

    selected: 'default',

    init: function () {
        this.load();
    },

    load: function () {
        const saved = localStorage.getItem('rungle_skins');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.selected = data.selected || 'default';

                // Restore unlocked status
                if (data.unlocked) {
                    data.unlocked.forEach(id => {
                        const skin = this.available.find(s => s.id === id);
                        if (skin) skin.unlocked = true;
                    });
                }
            } catch (e) {
                console.error('Failed to load skins:', e);
            }
        }
    },

    save: function () {
        const data = {
            selected: this.selected,
            unlocked: this.available.filter(s => s.unlocked).map(s => s.id)
        };
        localStorage.setItem('rungle_skins', JSON.stringify(data));
    },

    select: function (id) {
        const skin = this.available.find(s => s.id === id);
        if (skin && skin.unlocked) {
            this.selected = id;
            this.save();
            return true;
        }
        return false;
    },

    unlock: function (id) {
        const skin = this.available.find(s => s.id === id);
        if (skin && !skin.unlocked) {
            skin.unlocked = true;
            this.save();
            return true;
        }
        return false;
    },

    getCurrent: function () {
        return this.available.find(s => s.id === this.selected) || this.available[0];
    },

    apply: function (mesh) {
        const skin = this.getCurrent();
        if (mesh && mesh.material) {
            mesh.material.color.setHex(skin.color);
            mesh.material.emissive.setHex(skin.emissive);
        }
    },

    checkUnlocks: function (stats) {
        // Check various conditions for unlocking skins
        if (stats.bossesDefeated >= 1) this.unlock('ninja');
        if (stats.score >= 10000) this.unlock('robot');
        if (stats.coinsCollected >= 500) this.unlock('phantom');
        if (stats.untouchableRun) this.unlock('plasma');
        if (stats.bossesDefeated >= 5) this.unlock('void');

        this.save();
    }
};
