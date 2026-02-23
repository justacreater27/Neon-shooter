export const Achievements = {
    list: {
        'first_warp': {
            title: 'First Warp',
            desc: 'Reach 3D mode',
            unlocked: false,
            reward: 500
        },
        'speed_demon': {
            title: 'Speed Demon',
            desc: 'Reach speed 60',
            unlocked: false,
            reward: 1000
        },
        'boss_slayer': {
            title: 'Boss Slayer',
            desc: 'Defeat 3 bosses',
            unlocked: false,
            count: 0,
            target: 3,
            reward: 2000
        },
        'coin_hoarder': {
            title: 'Coin Hoarder',
            desc: 'Collect 1000 coins',
            unlocked: false,
            count: 0,
            target: 1000,
            reward: 1500
        },
        'untouchable': {
            title: 'Untouchable',
            desc: 'Complete a run without taking damage',
            unlocked: false,
            reward: 3000
        },
        'rungle_master': {
            title: 'Rungle Master',
            desc: 'Survive 20 minutes',
            unlocked: false,
            reward: 5000
        }
    },

    sessionData: {
        damageTaken: 0,
        startTime: 0
    },

    init: function () {
        this.load();
        this.sessionData = {
            damageTaken: 0,
            startTime: Date.now()
        };
    },

    load: function () {
        const saved = localStorage.getItem('rungle_achievements');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                for (let key in data) {
                    if (this.list[key]) {
                        this.list[key] = { ...this.list[key], ...data[key] };
                    }
                }
            } catch (e) {
                console.error('Failed to load achievements:', e);
            }
        }
    },

    save: function () {
        localStorage.setItem('rungle_achievements', JSON.stringify(this.list));
    },

    unlock: function (id) {
        const achievement = this.list[id];
        if (!achievement || achievement.unlocked) return;

        achievement.unlocked = true;
        this.save();
        this.showPopup(achievement);

        return achievement.reward || 0;
    },

    check: function (condition, id, value) {
        const achievement = this.list[id];
        if (!achievement || achievement.unlocked) return 0;

        // Handle counting achievements
        if (achievement.target) {
            if (value !== undefined) {
                achievement.count = value;
            } else if (condition) {
                achievement.count = (achievement.count || 0) + 1;
            }

            if (achievement.count >= achievement.target) {
                return this.unlock(id);
            }
        } else {
            // Simple boolean achievements
            if (condition) {
                return this.unlock(id);
            }
        }

        this.save();
        return 0;
    },

    checkSpeed: function (speed) {
        return this.check(speed >= 60, 'speed_demon');
    },

    checkBoss: function () {
        return this.check(true, 'boss_slayer');
    },

    checkCoins: function (totalCoins) {
        return this.check(true, 'coin_hoarder', totalCoins);
    },

    checkUntouchable: function () {
        if (this.sessionData.damageTaken === 0) {
            return this.unlock('untouchable');
        }
        return 0;
    },

    checkSurvival: function () {
        const elapsed = (Date.now() - this.sessionData.startTime) / 1000 / 60; // minutes
        return this.check(elapsed >= 20, 'rungle_master');
    },

    recordDamage: function () {
        this.sessionData.damageTaken++;
    },

    showPopup: function (achievement) {
        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 3px solid #0ff;
            border-radius: 10px;
            padding: 30px;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 0 30px rgba(0,255,255,0.5);
            animation: achievementPop 0.5s ease-out forwards;
        `;

        popup.innerHTML = `
            <div style="font-size: 24px; color: #0ff; margin-bottom: 10px;">🏆 ACHIEVEMENT UNLOCKED!</div>
            <div style="font-size: 32px; color: #fff; font-weight: bold; margin-bottom: 10px;">${achievement.title}</div>
            <div style="font-size: 18px; color: #aaa; margin-bottom: 15px;">${achievement.desc}</div>
            <div style="font-size: 20px; color: #ffff00;">+${achievement.reward} Score</div>
        `;

        document.body.appendChild(popup);

        // Add animation keyframes if not exists
        if (!document.getElementById('achievement-styles')) {
            const style = document.createElement('style');
            style.id = 'achievement-styles';
            style.textContent = `
                @keyframes achievementPop {
                    0% { transform: translate(-50%, -50%) scale(0); }
                    50% { transform: translate(-50%, -50%) scale(1.1); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes achievementFade {
                    0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }

        // Remove after delay
        setTimeout(() => {
            popup.style.animation = 'achievementFade 0.5s ease-out forwards';
            setTimeout(() => {
                document.body.removeChild(popup);
            }, 500);
        }, 3000);
    },

    getProgress: function () {
        const total = Object.keys(this.list).length;
        const unlocked = Object.values(this.list).filter(a => a.unlocked).length;
        return { unlocked, total, percentage: (unlocked / total * 100).toFixed(0) };
    }
};
