export const GAME_BALANCE = {
    difficulty: {
        levels: ['newbie', 'easy', 'normal', 'hard'],
        defaultLevel: 'easy',
        fuelConsumptionMultiplier: {
            newbie: 0.125,
            easy: 0.25,
            normal: 0.5,
            hard: 1
        },
        shotFuelConsumptionMultiplier: {
            newbie: 0.05,
            easy: 0.25,
            normal: 0.5,
            hard: 1
        },
        scoreMultiplier: {
            newbie: 1,
            easy: 1,
            normal: 2,
            hard: 3
        },
        startingHullUpgradeLevel: {
            newbie: 5,
            easy: 3,
            normal: 3,
            hard: 3
        }
    },
    terrain: {
        step: 32,
        profileLength: 96,
        minHeight: 36,
        maxHeight: 180,
        variation: 17,
        scrollFactor: 0.75
    },
    player: {
        startX: 224,
        startY: 280,
        minY: 60,
        maxYMargin: 100,
        hull: 3,
        startFuel: 100,
        maxHeat: 100,
        minSpeed: 120,
        maxSpeed: 420,
        cruiseSpeed: 210,
        speedStep: 120,
        speedResponse: 3.6,
        boostSpeed: 750,
        boostDuration: 3,
        verticalAcceleration: 780,
        verticalDrag: 4.6,
        verticalMaxVelocity: 260,
        invulnerabilityDuration: 1.25
    },
    weapons: {
        fireDelayMs: 140,
        heatPerShot: 18,
        heatCooldownPerSecond: 28,
        shotSpeed: 640,
        fuelPerShot: 1.5,
        terrainImpactHeat: 20,
        damageImpactHeat: 24
    },
    fuel: {
        accelDrainPerSecond: 5.4,
        brakeDrainPerSecond: 4.8,
        verticalDrainPerSecond: 6.2,
        noFuelVerticalSpeedDivider: 3,
        lowFuelThreshold: 18,
        criticalFuelThreshold: 10,
        criticalAlertInterval: 0.75
    },
    enemies: {
        collisionWidth: 26,
        collisionHeight: 22,
        shotCollisionWidth: 24,
        shotCollisionHeight: 16,
        wrapOffset: 40,
        baseSpawnYMin: 110,
        baseSpawnYMarginBottom: 210
    },
    enemyShots: {
        scrollCompensationFactor: 0.75,
        rearScrollCompensationFactor: 0.45,
        playerHitWidth: 18,
        playerHitHeight: 14
    },
    progression: {
        rounds: 7,
        wavesPerRound: 7,
        finalRoundWaves: 1,
        waveExitTimeout: 8,
        sceneDistanceMultiplierByDifficulty: {
            newbie: 0.5,
            easy: 1,
            normal: 1,
            hard: 1
        },
        finalRoundDistanceMultiplierByDifficulty: {
            newbie: 4,
            easy: 4,
            normal: 5,
            hard: 6
        }
    },
    scoring: {
        waveClear: 200,
        waveNoShotBonus: 150,
        fuelTunnelPenalty: -100,
        roundClear: 1000,
        chronoBonuses: [
            { label: 'Lièvre', thresholdSeconds: 155, points: 1000 },
            { label: 'Cheval', thresholdSeconds: 130, points: 2000 },
            { label: 'Guépard', thresholdSeconds: 105, points: 3000 }
        ],
        survivantBonus: 1000,
        nettoyeurBonus: 1750,
        destructeurBonus: 1500,
        insouciantBonus: 1000,
        panneBonus: 1000,
        anguilleBonus: 1000,
        chameauBonus: 1000,
        pacifisteBonus: 1000,
        piloteBonus: 1500,
        bombScoreFactor: 0.5
    },
    bombs: {
        initialCount: 3,
        cooldownSeconds: 0.35,
        keyRepeatGuardMs: 150,
        projectileTravelSeconds: 0.12,
        detonationAheadPx: 50,
        explosionDurationSeconds: 1.1,
        explosionPadding: 64
    },
    repair: {
        difficultyMultiplier: {
            newbie: 1,
            easy: 1,
            normal: 2,
            hard: 3
        },
        baseCosts: {
            hull: 1000,
            bombs: 1000,
            fuelStep: 100,
            boostStep: 50
        },
        stepPercent: 10,
        resaleFactor: 0.5
    },
    boost: {
        initialChargeByDifficulty: {
            newbie: 50,
            easy: 50,
            normal: 25,
            hard: 0
        },
        fuelCostByDifficulty: {
            newbie: 7,
            easy: 7,
            normal: 10,
            hard: 16
        },
        nearMissOuterMargin: 56,
        nearMissInnerMargin: 10,
        nearMissChargePerSecond: 35,
        playerApproxRadius: 18
    },
    tunnel: {
        triggerFuelThreshold: 35,
        everySceneInterval: 3,
        everySceneOffset: 2,
        distanceAhead: 320,
        width: 720,
        passageHeight: 148,
        mouthMargin: 92,
        wallThickness: 18,
        entryMarginTop: 10,
        entryMarginBottom: 14,
        missGraceDistance: 120,
        refuelRate: 24
    },
    asteroidBelt: {
        baseDuration: 12,
        durationPerWave: 2.5,
        maxDuration: 38,
        spawnInterval: 0.55,
        speedMin: 180,
        speedMax: 340,
        scrollCompensationFactor: 0.75,
        radiusMin: 14,
        radiusMax: 36,
        collisionRadius: 20,
        shotAsteroidRadiusScale: 0.28,
        playerHitRadius: 22,
        playerAsteroidRadiusScale: 0.38,
        backgroundColor: 0x021a08
    },
    upgrades: {
        pointsPerRound: 2,
        maxPointsPerRound: 2,
        manualPointsPerRound: 1,
        breakEvenBonusPointsNextRound: 1,
        cannon: {
            minLevel: 1,
            maxLevel: 7,
            baseLevel: 1
        },
        reactor: {
            minLevel: 1,
            maxLevel: 7,
            baseLevel: 1,
            speedMaxIncrement: 75,
            boostDurationIncrement: 0.5
        },
        hull: {
            minLevel: 3,
            maxLevel: 10,
            baseLevel: 3,
            lifePerLevel: 1
        },
        shield: {
            minLevel: 0,
            maxLevel: 7,
            baseLevel: 0,
            fuelCostPerSecond: 1,
            fuelReductionPerLevel: 0.12
        },
        cooling: {
            minLevel: 1,
            maxLevel: 7,
            baseLevel: 1
        },
        reservoir: {
            minLevel: 1,
            maxLevel: 7,
            baseLevel: 1
        },
        bomb: {
            minLevel: 3,
            maxLevel: 10,
            baseLevel: 3,
            bombPerLevel: 1,
            explosionDurationIncrement: 0.5
        }
    },
    miniGames: {
        baseTargetScore: 1000,
        durationSecondsByDifficulty: {
            newbie: 55,
            easy: 55,
            normal: 50,
            hard: 45
        },
        roundDurationBonusSeconds: 5,
        maxRoundDurationBonusSeconds: 35,
        scoreGainMultiplierByDifficulty: {
            newbie: 1.08,
            easy: 1.08,
            normal: 1,
            hard: 0.92
        },
        gameplaySpeedMultiplierByDifficulty: {
            newbie: 0.92,
            easy: 0.92,
            normal: 1,
            hard: 1.12
        }
    }
};