export const AI = {
    stats: {
        laneUsage: [0, 0, 0], // left, center, right
        jumps: 0,
        crashes: 0,
        totalActions: 0,
        avgReactionTime: 600,
        lastObstacleTime: 0
    },

    difficulty: 1.0,
    difficultyTier: 1,
    lastAdjustment: 0,
    adjustmentInterval: 20, // seconds

    init: function () {
        this.stats = {
            laneUsage: [0, 0, 0],
            jumps: 0,
            crashes: 0,
            totalActions: 0,
            avgReactionTime: 600,
            lastObstacleTime: 0
        };
        this.difficulty = 1.0;
        this.difficultyTier = 1;
        this.lastAdjustment = Date.now();
    },

    recordAction: function (type, value) {
        this.stats.totalActions++;

        if (type === 'lane') {
            // value is -1, 0, or 1
            const index = value + 1; // Convert to 0, 1, 2
            this.stats.laneUsage[index]++;
        } else if (type === 'jump') {
            this.stats.jumps++;
        } else if (type === 'crash') {
            this.stats.crashes++;
        }
    },

    update: function (score) {
        // Update difficulty tier based on score
        this.difficultyTier = Math.floor(score / 1000) + 1;

        // Adjust difficulty every interval
        const now = Date.now();
        if ((now - this.lastAdjustment) / 1000 > this.adjustmentInterval) {
            this.adjustDifficulty();
            this.lastAdjustment = now;
        }

        // Base difficulty from tier
        this.difficulty = 1.0 + (this.difficultyTier - 1) * 0.15;
    },

    adjustDifficulty: function () {
        // Analyze player behavior
        const totalLaneChanges = this.stats.laneUsage.reduce((a, b) => a + b, 0);

        if (totalLaneChanges > 0) {
            // Find preferred lane
            const maxUsage = Math.max(...this.stats.laneUsage);
            const preferredLane = this.stats.laneUsage.indexOf(maxUsage);

            // If player heavily favors one lane (>50%), slightly increase difficulty
            if (maxUsage / totalLaneChanges > 0.5) {
                this.difficulty += 0.05;
            }
        }

        // If player rarely jumps, encourage jumping
        const jumpRate = this.stats.totalActions > 0 ? this.stats.jumps / this.stats.totalActions : 0;
        if (jumpRate < 0.1 && this.stats.totalActions > 20) {
            // Will spawn more jump-required obstacles
            this.difficulty += 0.03;
        }

        // Cap difficulty
        this.difficulty = Math.min(3.0, this.difficulty);
    },

    getPreferredLane: function () {
        const maxUsage = Math.max(...this.stats.laneUsage);
        return this.stats.laneUsage.indexOf(maxUsage) - 1; // Convert back to -1, 0, 1
    },

    shouldSpawnInPreferredLane: function () {
        // 15% chance to spawn in preferred lane (adaptive challenge)
        return Math.random() < 0.15;
    },

    shouldSpawnJumpObstacle: function () {
        const jumpRate = this.stats.totalActions > 0 ? this.stats.jumps / this.stats.totalActions : 0;
        // If player avoids jumping, increase jump obstacle chance
        return jumpRate < 0.15 && Math.random() < 0.3;
    },

    getSpawnRate: function () {
        // Logarithmic scaling for spawn rate
        return 1.0 + Math.log(this.difficultyTier + 1) * 0.2;
    },

    getEnemySpeed: function () {
        // Gradually increase enemy speed
        return 5 + this.difficultyTier * 0.5;
    }
};
