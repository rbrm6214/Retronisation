import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_BALANCE } from '../config/balance';
import { WAVE_SEQUENCE } from '../data/waves';
import { ArcadeEnemy } from '../entities/enemies/ArcadeEnemy';
import { Cruiser } from '../entities/enemies/Cruiser';
import { Asteroid } from '../entities/hazards/Asteroid';
import { SoundEffects } from '../audio/SoundEffects';
import { MINI_GAME_DEFS, MiniGameChallenge, getMiniGameTargetScore } from '../minigames/MiniGameChallenge';
import { Scene } from 'phaser';

export class Game extends Scene
{
    static SCENE_DISTANCE_TARGET = 5000;

    constructor ()
    {
        super('Game');
    }

    create (data = {})
    {
        const persistedDifficulty = typeof window !== 'undefined' ? window.localStorage.getItem('parsec.difficulty') : null;
        const requestedDifficulty = data.difficultyLevel || persistedDifficulty || GAME_BALANCE.difficulty.defaultLevel;
        const validLevels = Object.keys(GAME_BALANCE.difficulty.fuelConsumptionMultiplier);

        this.difficultyLevel = validLevels.includes(requestedDifficulty) ? requestedDifficulty : GAME_BALANCE.difficulty.defaultLevel;

        this.cameras.main.setBackgroundColor(0x040812);

        this.worldWidth = this.scale.width;
        this.worldHeight = this.scale.height;
        this.cockpitTopHeight = 112;
        this.cockpitBottomHeight = 146;
        this.gameplayBottomInset = 118;
        this.gameplayTop = this.cockpitTopHeight;
        this.gameplayBottom = this.worldHeight - this.gameplayBottomInset;
        this.scrollOffset = 0;
        this.terrainStep = GAME_BALANCE.terrain.step;
        this.crashCount = 0;
        this.lastShotAt = 0;
        this.score = 0;
        this.roundIndex = 1;
        this.waveInRound = 1;
        this.waveIndex = 1;
        this.spawnedEnemies = 0;
        this.destroyedEnemies = 0;
        this.enemySpawnTimer = 0;
        this.waveSpawnComplete = false;
        this.starfield = [];
        this.activeEnemies = [];
        this.tunnel = null;
        this.tunnelScheduled = false;
        this.sceneIndex = 1;
        this.sceneDistance = 0;
        this.totalDistance = 0;
        this.gamePhase = 'wave';
        this.transitionTimer = 0;
        this.waveSummaryReady = false;
        this.completeRoundAfterCurrentBelt = false;
        this.roundSummaryOverlay = null;
        this.audioPauseOverlay = null;
        this.activeMiniGameChallenge = null;
        this.manualUpgradePrompt = null;
        this.manualMiniGamePreviewOverlay = null;
        this.manualMiniGameResultOverlay = null;
        this.pendingManualMiniGameDecision = null;
        this.pendingManualMiniGameResult = null;
        this.activeManualMiniGameDef = null;
        this.bombCooldown = 0;
        this.lastBombUseAt = -1000;
        this.bombSequence = null;
        this.godMode = false;
        this.godSequenceProgress = 0;
        this.boostSequenceProgress = 0;
        this.bugSequenceProgress = 0;
        this.roundStats = {
            shots: 0,
            fuelTunnelsTaken: 0,
            bombsUsed: 0,
            boostsUsed: 0,
            lostHullDuringRound: false,
            enemyWaveRatios: [],
            asteroidWaveRatios: [],
            hadAnyWaveAtZeroFuel: false,
            hullRepairWasPossible: false,
            hullRepairUsed: false
        };
        this.waveStats = {
            shots: 0,
            wasFuelAlwaysEmpty: false
        };
        this.currentBeltStats = {
            spawned: 0,
            destroyed: 0
        };
        this.waveSpawnPlan = [];
        this.controlState = {
            accelerating: false,
            braking: false,
            climbing: false,
            descending: false
        };
        this.activeAsteroids = [];
        this.asteroidBeltTimer = 0;
        this.asteroidSpawnTimer = 0;
        this.defaultNotice = '';
        this.noticeMessage = this.defaultNotice;
        this.debugCollisionEnabled = false;
        this.lowFuelAlertTimer = 0;
        this.terrainProfile = this.createTerrainProfile(GAME_BALANCE.terrain.profileLength);
        this.playerState = {
            x: GAME_BALANCE.player.startX,
            y: GAME_BALANCE.player.startY,
            previousY: GAME_BALANCE.player.startY,
            speed: GAME_BALANCE.player.cruiseSpeed,
            targetSpeed: GAME_BALANCE.player.cruiseSpeed,
            minSpeed: GAME_BALANCE.player.minSpeed,
            maxSpeed: GAME_BALANCE.player.maxSpeed,
            verticalVelocity: 0,
            fuel: GAME_BALANCE.player.startFuel,
            hull: GAME_BALANCE.player.hull,
            invulnerability: 0,
            bombs: GAME_BALANCE.bombs.initialCount,
            boostCharge: GAME_BALANCE.boost.initialChargeByDifficulty[this.difficultyLevel] ?? 0,
            boostActive: false,
            boostTimer: 0,
            speedCheatBonus: 0,
            upgrades: {
                cannon: GAME_BALANCE.upgrades.cannon.baseLevel,
                reactor: GAME_BALANCE.upgrades.reactor.baseLevel,
                hull: GAME_BALANCE.upgrades.hull.baseLevel,
                shield: GAME_BALANCE.upgrades.shield.baseLevel,
                cooling: GAME_BALANCE.upgrades.cooling.baseLevel,
                reservoir: GAME_BALANCE.upgrades.reservoir.baseLevel,
                bomb: GAME_BALANCE.upgrades.bomb.baseLevel
            },
            upgradePoints: 2,
            upgradePointsUsed: 0,
            upgradePointsHasUsed: true,
            upgradePointsUnused: false,
            manualUpgradeUsed: false,
            shieldHealth: 0
        };

        this.nearMissActive = false;
        this.lastNearMissSoundTime = 0;
        this.lastSpeedChangeTime = 0;
        this.lastVerticalMovementTime = 0;
        this.lastVerticalMovementDirection = 0; // -1: ascending, 0: none, 1: descending
        this.lastTrackedSpeed = GAME_BALANCE.player.cruiseSpeed;
        this.tunnelRechargeAudioActive = false;
        this.lastTunnelRechargeTime = 0;

        this.createBackdrop();

        this.terrainGraphics = this.add.graphics();
        this.tunnelGraphics = this.add.graphics().setDepth(2);
        this.asteroidGraphics = this.add.graphics().setDepth(3);
        this.debugCollisionGraphics = this.add.graphics().setDepth(30);
        this.shotGroup = this.add.group();
        this.enemyShotGroup = this.add.group();

        this.playerShip = this.add.triangle(this.playerState.x, this.playerState.y, 38, 11, 0, 22, 0, 0, 0x8df3ff)
            .setStrokeStyle(2, 0xffffff, 0.9)
            .setOrigin(0.45, 0.5);

        this.playerCollisionLocalPoints = [
            { x: this.playerShip.geom.x1 - this.playerShip.displayOriginX, y: this.playerShip.geom.y1 - this.playerShip.displayOriginY },
            { x: this.playerShip.geom.x2 - this.playerShip.displayOriginX, y: this.playerShip.geom.y2 - this.playerShip.displayOriginY },
            { x: this.playerShip.geom.x3 - this.playerShip.displayOriginX, y: this.playerShip.geom.y3 - this.playerShip.displayOriginY }
        ];
        this.playerCollisionPolygon = this.getPlayerCollisionPolygon();

        this.engineGlow = this.add.triangle(this.playerState.x - 24, this.playerState.y, 0, 8, 14, 16, 14, 0, 0xff974f)
            .setOrigin(0.5, 0.5)
            .setAlpha(0);

        this.retroTopGlow = this.add.triangle(this.playerState.x + 8, this.playerState.y - 8, 0, 0, 0, 8, 14, 4, 0x88d0ff)
            .setOrigin(0.5, 0.5)
            .setAlpha(0);

        this.shieldCircle = this.add.circle(this.playerState.x, this.playerState.y, 32, 0x88d0ff, 0.15)
            .setStrokeStyle(2, 0x88d0ff, 0.35)
            .setOrigin(0.5, 0.5);

        this.retroBottomGlow = this.add.triangle(this.playerState.x + 8, this.playerState.y + 8, 0, 0, 0, 8, 14, 4, 0x88d0ff)
            .setOrigin(0.5, 0.5)
            .setAlpha(0);

        this.maneuverTopGlow = this.add.triangle(this.playerState.x - 16, this.playerState.y - 10, 0, 6, 12, 3, -3, -6, 0xff974f)
            .setOrigin(-0.1, 0)
            .setAlpha(0);

        this.maneuverBottomGlow = this.add.triangle(this.playerState.x - 16, this.playerState.y + 10, 0, 6, 12, -2, -3, -6, 0xff974f)
            .setOrigin(-0.1, 0)
            .setAlpha(0);

        this.hudText = this.add.text(this.worldWidth * 0.5, 20, '', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#eaf6ff',
            lineSpacing: 8,
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(100);

        this.noticeText = this.add.text(24, this.worldHeight - 48, this.noticeMessage, {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#7cf0ff'
        }).setDepth(100);

        this.tunnelFuelText = this.add.text(0, 0, 'Fuel', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#ffd166'
        }).setDepth(100).setOrigin(0.5, 0.5).setVisible(false);

        this.createCockpitHud();

        this.keys = this.input.keyboard.addKeys({
            up: 'UP',
            down: 'DOWN',
            left: 'LEFT',
            right: 'RIGHT',
            z: 'Z',
            q: 'Q',
            s: 'S',
            d: 'D',
            fire: 'SPACE',
            action1e: 'E',
            action1a: 'A',
            action1enter: 'ENTER',
            action2left: 'SHIFT',
            action2right: 'SHIFT',
            debug: 'K',
            menu: 'ESC'
        });

        this.input.keyboard.on('keydown-K', () => {
            this.debugCollisionEnabled = !this.debugCollisionEnabled;
            this.setNotice(this.debugCollisionEnabled ? 'Debug collisions: ON' : 'Debug collisions: OFF');
            this.debugDistanceText.setVisible(this.debugCollisionEnabled);

            if (!this.debugCollisionEnabled)
            {
                this.debugCollisionGraphics.clear();
            }
        });

        this.input.keyboard.on('keydown', (event) => {
            this.updateGodSequence(event.key);
        });

        this.configureWavePlan();

        this.drawTerrain();
        this.refreshHud();
        this.setNotice(`Round ${this.roundIndex} - Manche ${this.waveInRound}: ${this.currentWaveLabel}.`);

        // Start ambient music
        SoundEffects.startAmbientMusic();

        EventBus.emit('current-scene-ready', this);
    }

    update (time, delta)
    {
        if (this.activeMiniGameChallenge)
        {
            SoundEffects.stopManeuverThruster();
            SoundEffects.stopBoostThruster();
            this.activeMiniGameChallenge.update(delta / 1000);
            return;
        }

        if (this.roundSummaryOverlay || this.audioPauseOverlay)
        {
            SoundEffects.stopManeuverThruster();
            SoundEffects.stopBoostThruster();
            return;
        }

        const deltaSeconds = delta / 1000;

        // Update round timer
        this.roundTimeElapsed += deltaSeconds;
        const minutes = Math.floor(this.roundTimeElapsed / 60);
        const seconds = Math.floor(this.roundTimeElapsed % 60);
        this.roundTimerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

        this.updateActions(time, deltaSeconds);
        this.updateBombSequence(deltaSeconds);
        this.updateFlight(deltaSeconds);
        this.updateWeapons(time, deltaSeconds);
        this.updateShots(deltaSeconds);

        // Keep updating leftover enemies so they can naturally leave the screen
        // even after we already switched to the next scene.
        if (this.isWavePhase() || this.activeEnemies.length > 0)
        {
            this.updateEnemies(deltaSeconds);
        }

        // Same for asteroids: continue stepping until they are out of view.
        if (this.isBeltPhase() || this.activeAsteroids.length > 0)
        {
            this.updateAsteroidBelt(deltaSeconds);
        }

        // Enemy shots always update (even during transitions)
        this.updateEnemyShots(deltaSeconds);
        this.updateShield(deltaSeconds);
        this.resolveShotClashes();
        this.updateTunnel(deltaSeconds);
        this.updateBoostCharge(deltaSeconds);

        const travelled = this.playerState.speed * deltaSeconds * GAME_BALANCE.terrain.scrollFactor;

        this.scrollOffset += travelled;
        this.sceneDistance += travelled;
        this.totalDistance += travelled;
        this.updateSceneProgression();
        this.drawBackdrop(deltaSeconds);
        this.drawTerrain();
        this.resolveTerrainCollision();
        this.updateFuelAlert(deltaSeconds);
        this.drawCollisionDebugOverlay();
        this.refreshHud();
    }

    get scoreMultiplier ()
    {
        const table = GAME_BALANCE.difficulty.scoreMultiplier;

        return table[this.difficultyLevel] ?? table.normal;
    }

    get currentWaveConfigs ()
    {
        return this.waveSpawnPlan.map((entry) => entry.config);
    }

    get currentWaveConfig ()
    {
        return this.currentWaveConfigs[0] ?? WAVE_SEQUENCE[0];
    }

    get currentWaveLabel ()
    {
        return this.currentWaveConfigs.map((cfg) => cfg.label).join(' + ');
    }

    get wavesInCurrentRound ()
    {
        return this.roundIndex === GAME_BALANCE.progression.rounds
            ? GAME_BALANCE.progression.finalRoundWaves
            : GAME_BALANCE.progression.wavesPerRound;
    }

    get inTunnel ()
    {
        if (!this.tunnel || this.tunnel.done) { return false; }

        const playerPolygon = this.getPlayerCollisionPolygon();
        const minWorldX = Math.min(...playerPolygon.map((point) => point.x + this.scrollOffset));
        const maxWorldX = Math.max(...playerPolygon.map((point) => point.x + this.scrollOffset));
        const minY = Math.min(...playerPolygon.map((point) => point.y));
        const maxY = Math.max(...playerPolygon.map((point) => point.y));
        // Raise refuel zone slightly so it still triggers near the tunnel ceiling.
        const refuelTopMargin = Math.max(0, GAME_BALANCE.tunnel.entryMarginTop - 16);
        // Expand refuel zone horizontally: more forgiving on left entry, slightly on right exit.
        const refuelLeftExtension = 72;
        const refuelRightExtension = 28;
        const insidePassageY = minY >= this.tunnel.ceilingY + refuelTopMargin &&
            maxY <= this.tunnel.floorY - GAME_BALANCE.tunnel.entryMarginBottom;

        return minWorldX >= (this.tunnelInnerStart - refuelLeftExtension) &&
            maxWorldX <= (this.tunnelInnerEnd + refuelRightExtension) &&
            insidePassageY;
    }

    isWavePhase ()
    {
        return this.gamePhase === 'wave' || this.gamePhase === 'wave-exit';
    }

    isBeltPhase ()
    {
        return this.gamePhase === 'belt' || this.gamePhase === 'belt-exit';
    }

    get fuelConsumptionMultiplier ()
    {
        const table = GAME_BALANCE.difficulty.fuelConsumptionMultiplier;

        return table[this.difficultyLevel] ?? table.normal;
    }

    get tunnelInnerStart ()
    {
        if (!this.tunnel) { return 0; }

        return this.tunnel.worldStart + GAME_BALANCE.tunnel.mouthMargin;
    }

    get tunnelInnerEnd ()
    {
        if (!this.tunnel) { return 0; }

        return this.tunnel.worldEnd - GAME_BALANCE.tunnel.mouthMargin;
    }

    isInsideTunnelSpan (worldX)
    {
        return !!this.tunnel && !this.tunnel.done && worldX >= this.tunnel.worldStart && worldX <= this.tunnel.worldEnd;
    }

    isInsideTunnelEntryShaft (worldX)
    {
        return !!this.tunnel && !this.tunnel.done && worldX >= this.tunnel.worldStart && worldX < this.tunnelInnerStart;
    }

    isInsideTunnelExitShaft (worldX)
    {
        return !!this.tunnel && !this.tunnel.done && worldX > this.tunnelInnerEnd && worldX <= this.tunnel.worldEnd;
    }

    isInsideTunnelInterior (worldX)
    {
        return !!this.tunnel && !this.tunnel.done && worldX >= this.tunnelInnerStart && worldX <= this.tunnelInnerEnd;
    }

    isOnTunnelLaunchRail ()
    {
        if (!this.tunnel || this.tunnel.done)
        {
            return false;
        }

        const playerWorldX = this.playerState.x + this.scrollOffset;

        if (!this.isInsideTunnelSpan(playerWorldX))
        {
            return false;
        }

        const playerPolygon = this.getPlayerCollisionPolygon();
        const playerBottomY = Math.max(...playerPolygon.map((point) => point.y));
        const contactTolerance = 2;

        return playerBottomY <= this.tunnel.ceilingY + contactTolerance;
    }

    getTunnelLane (y)
    {
        if (!this.tunnel) { return 'outside'; }

        if (y < this.tunnel.ceilingY + GAME_BALANCE.tunnel.entryMarginTop)
        {
            return 'above';
        }

        if (y > this.tunnel.floorY - GAME_BALANCE.tunnel.entryMarginBottom)
        {
            return 'below';
        }

        return 'inside';
    }

    getWaveTypeCountForRound (round)
    {
        if (round >= GAME_BALANCE.progression.rounds)
        {
            return WAVE_SEQUENCE.length;
        }

        return Phaser.Math.Clamp(round, 1, WAVE_SEQUENCE.length - 1);
    }

    getWaveTypeIndexes (round, waveInRound)
    {
        if (round >= GAME_BALANCE.progression.rounds)
        {
            return WAVE_SEQUENCE.map((_, index) => index);
        }

        const count = this.getWaveTypeCountForRound(round);
        const startIndex = (waveInRound - 1) % WAVE_SEQUENCE.length;
        const indexes = [];

        for (let i = 0; i < count; i++)
        {
            indexes.push((startIndex + i) % WAVE_SEQUENCE.length);
        }

        return indexes;
    }

    configureWavePlan ()
    {
        const waveTypeIndexes = this.getWaveTypeIndexes(this.roundIndex, this.waveInRound);

        this.waveSpawnPlan = waveTypeIndexes.map((typeIndex) => {
            const config = WAVE_SEQUENCE[typeIndex];

            return {
                config,
                spawned: 0,
                quota: config.enemyQuota
            };
        });

        this.spawnedEnemies = 0;
        this.destroyedEnemies = 0;
        this.waveSpawnComplete = false;
        this.enemySpawnTimer = Math.min(...this.waveSpawnPlan.map((entry) => entry.config.spawnInterval));
        this.waveStats.shots = 0;
        this.waveStats.wasFuelAlwaysEmpty = this.playerState.fuel <= 0;
    }

    isWaveSpawnPlanComplete ()
    {
        return this.waveSpawnPlan.every((entry) => entry.spawned >= entry.quota);
    }

    addScore (basePoints)
    {
        const appliedPoints = Math.round(basePoints * this.scoreMultiplier);

        this.score += appliedPoints;

        return appliedPoints;
    }

    createBackdrop ()
    {
        this.add.image(512, 384, 'background').setAlpha(0.1);

        for (let index = 0; index < 64; index++)
        {
            const star = this.add.circle(
                Math.random() * this.worldWidth,
                Phaser.Math.Between(this.gameplayTop + 8, Math.max(this.gameplayTop + 8, this.gameplayBottom - 8)),
                Math.random() > 0.82 ? 2 : 1,
                0xd7ecff,
                Math.random() * 0.7 + 0.2
            );

            this.starfield.push({
                sprite: star,
                speedFactor: Math.random() * 0.35 + 0.1
            });
        }
    }

    drawBackdrop (deltaSeconds)
    {
        for (const star of this.starfield)
        {
            star.sprite.x -= this.playerState.speed * star.speedFactor * deltaSeconds;

            if (star.sprite.x < -4)
            {
                star.sprite.x = this.worldWidth + 4;
                star.sprite.y = Phaser.Math.Between(this.gameplayTop + 8, Math.max(this.gameplayTop + 8, this.gameplayBottom - 8));
            }
        }

        this.playerShip.setPosition(this.playerState.x, this.playerState.y);
        this.playerCollisionPolygon = this.getPlayerCollisionPolygon();
        this.engineGlow.setPosition(this.playerState.x - 24, this.playerState.y);
        this.retroTopGlow.setPosition(this.playerState.x + 8, this.playerState.y - 8);
        this.retroBottomGlow.setPosition(this.playerState.x + 8, this.playerState.y + 8);
        this.shieldCircle.setPosition(this.playerState.x, this.playerState.y);
        this.maneuverTopGlow.setPosition(this.playerState.x - 16, this.playerState.y - 10);
        this.maneuverBottomGlow.setPosition(this.playerState.x - 16, this.playerState.y + 10);

        const boostThrustersActive = this.playerState.boostActive;
        this.engineGlow.scaleX = 1 + ((this.playerState.speed - this.playerState.minSpeed) / (this.getMaxSpeedWithUpgrades() - this.playerState.minSpeed)) * 0.8;
        this.engineGlow.alpha = (this.controlState.accelerating || boostThrustersActive) ? (0.55 + Math.random() * 0.35) : 0;
        this.retroTopGlow.alpha = this.controlState.braking ? (0.35 + Math.random() * 0.2) : 0;
        this.retroBottomGlow.alpha = this.controlState.braking ? (0.35 + Math.random() * 0.2) : 0;
        this.maneuverTopGlow.alpha = 0;
        this.maneuverBottomGlow.alpha = 0;

        if (boostThrustersActive)
        {
            // During boost, show D + Z + S thrusters simultaneously.
            this.maneuverBottomGlow.rotation = 2.35619449; // South-west
            this.maneuverTopGlow.rotation = -2.35619449; // North-west
            this.maneuverBottomGlow.alpha = 0.45 + Math.random() * 0.2;
            this.maneuverTopGlow.alpha = 0.45 + Math.random() * 0.2;
        }
        else if (this.controlState.climbing)
        {
            this.maneuverBottomGlow.rotation = 2.35619449; // South-west
            this.maneuverBottomGlow.alpha = 0.45 + Math.random() * 0.2;
        }
        else if (this.controlState.descending)
        {
            this.maneuverTopGlow.rotation = -2.35619449; // North-west
            this.maneuverTopGlow.alpha = 0.45 + Math.random() * 0.2;
        }

        this.playerShip.alpha = this.playerState.invulnerability > 0 && Math.floor(this.playerState.invulnerability * 20) % 2 === 0 ? 0.35 : 1;
    }

    createTerrainProfile (length)
    {
        const profile = [];
        let currentHeight = 78;

        for (let index = 0; index < length; index++)
        {
            currentHeight += Math.floor(Math.random() * ((GAME_BALANCE.terrain.variation * 2) + 1)) - GAME_BALANCE.terrain.variation;
            currentHeight = Math.max(GAME_BALANCE.terrain.minHeight, Math.min(GAME_BALANCE.terrain.maxHeight, currentHeight));
            profile.push(currentHeight);
        }

        return profile;
    }

    sampleGroundHeightAtX (screenX)
    {
        const worldX = screenX + this.scrollOffset;

        if (this.tunnel && !this.tunnel.done)
        {
            const terrainClearanceMargin = GAME_BALANCE.tunnel.mouthMargin * 0.7;
            const leftClearStart = this.tunnel.worldStart - terrainClearanceMargin;
            const rightClearEnd = this.tunnel.worldEnd + terrainClearanceMargin;

            // Keep the whole tunnel corridor clear, with extra margins at both mouths.
            if (worldX >= leftClearStart && worldX <= rightClearEnd)
            {
                return this.tunnel.floorY;
            }
        }

        const worldIndex = worldX / this.terrainStep;
        const leftIndex = Math.floor(worldIndex) % this.terrainProfile.length;
        const rightIndex = (leftIndex + 1) % this.terrainProfile.length;
        const interpolation = worldIndex - Math.floor(worldIndex);
        const leftValue = this.terrainProfile[(leftIndex + this.terrainProfile.length) % this.terrainProfile.length];
        const rightValue = this.terrainProfile[(rightIndex + this.terrainProfile.length) % this.terrainProfile.length];
        const terrainHeight = leftValue + ((rightValue - leftValue) * interpolation);

        return this.gameplayBottom - terrainHeight;
    }

    drawTerrain ()
    {
        this.terrainGraphics.clear();
        this.terrainGraphics.fillStyle(0x081b2d, 1);
        this.terrainGraphics.lineStyle(3, 0x63d7ff, 0.95);

        const points = [{ x: 0, y: this.gameplayBottom }];

        for (let x = 0; x <= this.worldWidth + this.terrainStep; x += this.terrainStep)
        {
            points.push({ x, y: this.sampleGroundHeightAtX(x) });
        }

        points.push({ x: this.worldWidth, y: this.gameplayBottom });

        this.terrainGraphics.beginPath();
        this.terrainGraphics.moveTo(points[0].x, points[0].y);

        for (const point of points.slice(1))
        {
            this.terrainGraphics.lineTo(point.x, point.y);
        }

        this.terrainGraphics.closePath();
        this.terrainGraphics.fillPath();
        this.terrainGraphics.strokePath();
    }

    updateFlight (deltaSeconds)
    {
        const hasFuel = this.playerState.fuel > 0;
        const verticalControlFactor = hasFuel ? 1 : (1 / GAME_BALANCE.fuel.noFuelVerticalSpeedDivider);
        const reactorMobilityMultiplier = this.getReactorMobilityMultiplier();
        const verticalAcceleration = GAME_BALANCE.player.verticalAcceleration * reactorMobilityMultiplier;
        const verticalMaxVelocity = GAME_BALANCE.player.verticalMaxVelocity * reactorMobilityMultiplier;
        const speedStep = GAME_BALANCE.player.speedStep * reactorMobilityMultiplier;
        const speedResponse = GAME_BALANCE.player.speedResponse * reactorMobilityMultiplier;
        const isClimbing = this.keys.up.isDown || this.keys.z.isDown;
        const isDescending = this.keys.down.isDown || this.keys.s.isDown;
        const isBraking = this.keys.left.isDown || this.keys.q.isDown;
        const isAccelerating = this.keys.right.isDown || this.keys.d.isDown;
        const hasVerticalInput = isClimbing || isDescending;

        this.controlState.accelerating = hasFuel && isAccelerating;
        this.controlState.braking = hasFuel && isBraking;
        this.controlState.climbing = isClimbing;
        this.controlState.descending = isDescending;

        if (isClimbing)
        {
            this.playerState.verticalVelocity -= verticalAcceleration * verticalControlFactor * deltaSeconds;
        }

        if (isDescending)
        {
            this.playerState.verticalVelocity += verticalAcceleration * verticalControlFactor * deltaSeconds;
        }

        if (hasFuel && isBraking)
        {
            const drainAmount = ((GAME_BALANCE.fuel.brakeDrainPerSecond * 0.5) * this.fuelConsumptionMultiplier / this.getConsumptionDivisor()) * deltaSeconds;
            this.playerState.fuel = Math.max(0, this.playerState.fuel - drainAmount);
            this.playerState.targetSpeed = Math.max(this.playerState.minSpeed, this.playerState.targetSpeed - (speedStep * deltaSeconds));
        }

        if (hasFuel && isAccelerating)
        {
            const drainAmount = (GAME_BALANCE.fuel.accelDrainPerSecond * this.fuelConsumptionMultiplier / this.getConsumptionDivisor()) * deltaSeconds;
            this.playerState.fuel = Math.max(0, this.playerState.fuel - drainAmount);
            this.playerState.targetSpeed = Math.min(this.getMaxSpeedWithUpgrades(), this.playerState.targetSpeed + (speedStep * deltaSeconds));
        }

        if (hasFuel && hasVerticalInput)
        {
            const drainAmount = (GAME_BALANCE.fuel.verticalDrainPerSecond * this.fuelConsumptionMultiplier / this.getConsumptionDivisor()) * deltaSeconds;
            this.playerState.fuel = Math.max(0, this.playerState.fuel - drainAmount);
        }

        this.playerState.speed = Phaser.Math.Linear(
            this.playerState.speed,
            this.playerState.targetSpeed,
            Math.min(1, speedResponse * deltaSeconds)
        );

        const boostSpeedTarget = this.getBoostSpeedTarget();

        // Hard safety clamp to avoid any unintended speed overflow.
        const absoluteMaxSpeed = Math.max(boostSpeedTarget, this.getMaxSpeedWithUpgrades());
        this.playerState.targetSpeed = Phaser.Math.Clamp(this.playerState.targetSpeed, this.playerState.minSpeed, absoluteMaxSpeed);
        this.playerState.speed = Phaser.Math.Clamp(this.playerState.speed, this.playerState.minSpeed, absoluteMaxSpeed);

        if (this.playerState.boostActive)
        {
            this.playerState.boostTimer -= deltaSeconds;
            this.playerState.speed = boostSpeedTarget;
            this.playerState.targetSpeed = boostSpeedTarget;

            if (this.playerState.boostTimer <= 0)
            {
                this.playerState.boostActive = false;
                this.playerState.boostTimer = 0;
                this.playerState.targetSpeed = Phaser.Math.Clamp(this.playerState.targetSpeed, this.playerState.minSpeed, this.getMaxSpeedWithUpgrades());
                this.playerState.speed = Math.min(this.playerState.speed, this.getMaxSpeedWithUpgrades());
            }
        }

        this.playerState.verticalVelocity *= Math.max(0, 1 - (GAME_BALANCE.player.verticalDrag * deltaSeconds));
        this.playerState.verticalVelocity = Phaser.Math.Clamp(
            this.playerState.verticalVelocity,
            -verticalMaxVelocity,
            verticalMaxVelocity
        );
        this.playerState.previousY = this.playerState.y;
        this.playerState.y += this.playerState.verticalVelocity * deltaSeconds;
        const minGameplayY = Math.max(GAME_BALANCE.player.minY, this.gameplayTop + 10);
        const maxGameplayY = this.gameplayBottom - 10;
        this.playerState.y = Math.max(minGameplayY, Math.min(maxGameplayY, this.playerState.y));

        if (this.playerState.y === minGameplayY || this.playerState.y === maxGameplayY)
        {
            this.playerState.verticalVelocity = 0;
        }

        // Keep one shared thruster sound active while maneuver keys are held.
        const maneuvering = (hasFuel && (isAccelerating || isBraking)) || hasVerticalInput;
        if (maneuvering)
        {
            SoundEffects.startManeuverThruster();
        }
        else
        {
            SoundEffects.stopManeuverThruster();
        }

        // Keep boost propulsor sound active during all boost duration.
        if (this.playerState.boostActive)
        {
            SoundEffects.startBoostThruster();
        }
        else
        {
            SoundEffects.stopBoostThruster();
        }

        this.resolveTunnelPlayerCollision();
        this.playerState.invulnerability = Math.max(0, this.playerState.invulnerability - deltaSeconds);
    }

    updateWeapons (time, deltaSeconds)
    {
        if (
            this.playerState.fuel > 0 &&
            this.keys.fire.isDown &&
            time > this.lastShotAt + GAME_BALANCE.weapons.fireDelayMs
        )
        {
            this.lastShotAt = time;
            const cannonLevel = this.playerState.upgrades.cannon;
            const baseFuelCost = GAME_BALANCE.weapons.fuelPerShot * this.fuelConsumptionMultiplier;
            const divisor = this.getConsumptionDivisor();
            const fuelCost = (baseFuelCost * cannonLevel) / divisor;
            
            this.playerState.fuel = Math.max(0, this.playerState.fuel - fuelCost);
            this.waveStats.shots += 1;
            this.roundStats.shots += 1;
            SoundEffects.laserShot();

            // Cannon patterns based on level
            const cannonAngles = this.getCannonAngles(cannonLevel);

            for (const angle of cannonAngles)
            {
                const rad = angle * Math.PI / 180;
                const dx = Math.cos(rad) * 26;
                const dy = Math.sin(rad) * 26;

                const shot = this.add.rectangle(this.playerState.x + dx, this.playerState.y + dy, 18, 4, 0xffc857)
                    .setStrokeStyle(1, 0xfff5c2, 1)
                    .setAngle(angle);

                shot.shotAngle = angle;
                shot.collisionLocalPoints = this.getRectangleLocalPoints(shot.width, shot.height, shot.displayOriginX, shot.displayOriginY);
                this.shotGroup.add(shot);
            }
        }
    }

    updateActions (time, deltaSeconds)
    {
        this.bombCooldown = Math.max(0, this.bombCooldown - deltaSeconds);

        const bombPressed = Phaser.Input.Keyboard.JustDown(this.keys.action1e) ||
            Phaser.Input.Keyboard.JustDown(this.keys.action1a) ||
            Phaser.Input.Keyboard.JustDown(this.keys.action1enter);

        if (bombPressed)
        {
            this.tryUseBomb(time);
        }

        const boostPressed = Phaser.Input.Keyboard.JustDown(this.keys.action2left) ||
            Phaser.Input.Keyboard.JustDown(this.keys.action2right);

        if (boostPressed)
        {
            this.tryActivateBoost();
        }
    }

    tryActivateBoost ()
    {
        const boostCfg = GAME_BALANCE.boost;
        const cost = boostCfg.fuelCostByDifficulty[this.difficultyLevel] ?? boostCfg.fuelCostByDifficulty.normal;

        if (this.playerState.boostActive || this.playerState.boostCharge < 100 || this.playerState.fuel < cost)
        {
            return;
        }

        this.playerState.boostCharge = 0;
        this.playerState.fuel = Math.max(0, this.playerState.fuel - cost);
        this.playerState.boostActive = true;
        this.playerState.boostTimer = this.getBoostDurationWithUpgrades();
        SoundEffects.startBoostThruster();
        this.roundStats.boostsUsed += 1;
        this.setNotice('BOOST ENGAGE ' + this.getBoostDurationWithUpgrades().toFixed(1) + 's');
    }

    tryUseBomb (time)
    {
        if (
            this.playerState.bombs <= 0 ||
            this.bombCooldown > 0 ||
            this.bombSequence ||
            time < this.lastBombUseAt + GAME_BALANCE.bombs.keyRepeatGuardMs
        )
        {
            return;
        }

        this.lastBombUseAt = time;
        this.bombCooldown = GAME_BALANCE.bombs.cooldownSeconds;
        this.playerState.bombs -= 1;
        this.roundStats.bombsUsed += 1;

        SoundEffects.bombRelease();

        const cfg = GAME_BALANCE.bombs;
        const startX = this.playerState.x + 18;
        const startY = this.playerState.y;
        const detonationX = startX + cfg.detonationAheadPx;
        const detonationY = startY;

        const projectile = this.add.circle(startX, startY, 6, 0xff9f54, 0.95)
            .setStrokeStyle(2, 0xffe5c7, 0.85)
            .setDepth(26);
        const fuse = this.add.rectangle(startX + 5, startY - 5, 6, 2, 0xffe188, 0.95)
            .setAngle(-28)
            .setDepth(27);
        const fx = this.add.graphics().setDepth(25);

        this.bombSequence = {
            phase: 'travel',
            elapsed: 0,
            travelDuration: cfg.projectileTravelSeconds,
            blastDuration: this.getExplosionDurationWithUpgrades(),
            startX,
            startY,
            detonationX,
            detonationY,
            projectile,
            fuse,
            fx,
            eliminated: 0,
            maxRadius: 0
        };

        this.setNotice('Bombe lancee...');
    }

    isObjectVisibleOnScreen (obj, margin = 28)
    {
        if (!obj || obj.active === false)
        {
            return false;
        }

        return obj.x >= -margin && obj.x <= this.worldWidth + margin && obj.y >= -margin && obj.y <= this.worldHeight + margin;
    }

    collectBombTargets (centerX, centerY)
    {
        const targets = [];

        for (const enemy of [...this.activeEnemies])
        {
            if (!this.isObjectVisibleOnScreen(enemy, 40))
            {
                continue;
            }

            targets.push({
                kind: 'enemy',
                ref: enemy,
                distance: Phaser.Math.Distance.Between(centerX, centerY, enemy.x, enemy.y),
                eliminated: false
            });
        }

        for (const ast of [...this.activeAsteroids])
        {
            if (!this.isObjectVisibleOnScreen(ast, 40))
            {
                continue;
            }

            targets.push({
                kind: 'asteroid',
                ref: ast,
                distance: Phaser.Math.Distance.Between(centerX, centerY, ast.x, ast.y),
                eliminated: false
            });
        }

        for (const shot of [...this.enemyShotGroup.getChildren()])
        {
            if (!this.isObjectVisibleOnScreen(shot, 20))
            {
                continue;
            }

            targets.push({
                kind: 'enemyShot',
                ref: shot,
                distance: Phaser.Math.Distance.Between(centerX, centerY, shot.x, shot.y),
                eliminated: false
            });
        }

        for (const shot of [...this.shotGroup.getChildren()])
        {
            if (!this.isObjectVisibleOnScreen(shot, 20))
            {
                continue;
            }

            targets.push({
                kind: 'playerShot',
                ref: shot,
                distance: Phaser.Math.Distance.Between(centerX, centerY, shot.x, shot.y),
                eliminated: false
            });
        }

        targets.sort((a, b) => a.distance - b.distance);

        return targets;
    }

    detonateBombSequence ()
    {
        if (!this.bombSequence)
        {
            return;
        }

        const seq = this.bombSequence;

        if (seq.projectile)
        {
            seq.projectile.destroy();
            seq.projectile = null;
        }

        if (seq.fuse)
        {
            seq.fuse.destroy();
            seq.fuse = null;
        }

        seq.phase = 'blast';
        seq.elapsed = 0;

        const corners = [
            { x: 0, y: 0 },
            { x: this.worldWidth, y: 0 },
            { x: 0, y: this.worldHeight },
            { x: this.worldWidth, y: this.worldHeight }
        ];
        const farthestDistance = Math.max(...corners.map((corner) => Phaser.Math.Distance.Between(seq.detonationX, seq.detonationY, corner.x, corner.y)));

        seq.maxRadius = farthestDistance + (GAME_BALANCE.bombs.explosionPadding ?? 0);

        SoundEffects.bombExplosion();

        const flash = this.add.circle(seq.detonationX, seq.detonationY, 8, 0xffd39c, 0.9).setDepth(28);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2.8,
            duration: 140,
            onComplete: () => flash.destroy()
        });

        this.setNotice('Explosion en cours...');
    }

    updateBombSequence (deltaSeconds)
    {
        if (!this.bombSequence)
        {
            return;
        }

        const seq = this.bombSequence;

        if (seq.phase === 'travel')
        {
            seq.elapsed += deltaSeconds;

            const t = Phaser.Math.Clamp(seq.elapsed / Math.max(0.01, seq.travelDuration), 0, 1);
            const x = Phaser.Math.Linear(seq.startX, seq.detonationX, t);
            const y = Phaser.Math.Linear(seq.startY, seq.detonationY, t);

            if (seq.projectile)
            {
                seq.projectile.setPosition(x, y);
            }

            if (seq.fuse)
            {
                seq.fuse.setPosition(x + 5, y - 5);
            }

            seq.fx.clear();
            seq.fx.lineStyle(2, 0xffbb7c, 0.8);
            seq.fx.beginPath();
            seq.fx.moveTo(seq.startX, seq.startY);
            seq.fx.lineTo(x, y);
            seq.fx.strokePath();

            if (t >= 1)
            {
                this.detonateBombSequence();
            }

            return;
        }

        if (seq.phase !== 'blast')
        {
            return;
        }

        seq.elapsed += deltaSeconds;
        const progress = Phaser.Math.Clamp(seq.elapsed / Math.max(0.01, seq.blastDuration), 0, 1);
        const radius = seq.maxRadius * progress;

        seq.fx.clear();
        seq.fx.fillStyle(0xffd49b, 0.08);
        seq.fx.fillCircle(seq.detonationX, seq.detonationY, radius);
        seq.fx.lineStyle(4, 0xffc47b, 0.45);
        seq.fx.strokeCircle(seq.detonationX, seq.detonationY, radius);

        // Live scan: détruire toute entité actuellement dans le rayon de l'explosion.
        for (const enemy of [...this.activeEnemies])
        {
            if (Phaser.Math.Distance.Between(seq.detonationX, seq.detonationY, enemy.x, enemy.y) <= radius)
            {
                this.addScore(enemy.points * GAME_BALANCE.scoring.bombScoreFactor);
                SoundEffects.enemyExplosion();
                this.destroyEnemy(enemy, false, true);
                seq.eliminated += 1;
            }
        }

        for (const ast of [...this.activeAsteroids])
        {
            if (Phaser.Math.Distance.Between(seq.detonationX, seq.detonationY, ast.x, ast.y) <= radius)
            {
                this.addScore(ast.scoreValue * GAME_BALANCE.scoring.bombScoreFactor);
                SoundEffects.asteroidBreak();
                this.removeAsteroid(ast, false, true);
                seq.eliminated += 1;
            }
        }

        for (const shot of [...this.enemyShotGroup.getChildren()])
        {
            if (Phaser.Math.Distance.Between(seq.detonationX, seq.detonationY, shot.x, shot.y) <= radius)
            {
                this.enemyShotGroup.remove(shot, true, true);
                seq.eliminated += 1;
            }
        }

        for (const shot of [...this.shotGroup.getChildren()])
        {
            if (Phaser.Math.Distance.Between(seq.detonationX, seq.detonationY, shot.x, shot.y) <= radius)
            {
                this.shotGroup.remove(shot, true, true);
                seq.eliminated += 1;
            }
        }

        if (progress >= 1)
        {
            seq.fx.clear();
            seq.fx.destroy();
            this.bombSequence = null;
            this.setNotice(`Bombe declenchee. ${seq.eliminated} cibles neutralisees.`);
        }
    }

    updateGodSequence (key)
    {
        if (!key || key.length !== 1)
        {
            return;
        }

        const nextChar = key.toUpperCase();
        const godSequence = 'GOD';
        const boostSequence = 'BOOST';

        if (nextChar === godSequence[this.godSequenceProgress])
        {
            this.godSequenceProgress += 1;

            if (this.godSequenceProgress === godSequence.length)
            {
                this.godMode = true;
                this.godSequenceProgress = 0;
                this.setNotice('Mode GOD active. Vie auto-recuperation active.');
            }
        }
        else
        {
            this.godSequenceProgress = nextChar === godSequence[0] ? 1 : 0;
        }

        if (nextChar === boostSequence[this.boostSequenceProgress])
        {
            this.boostSequenceProgress += 1;

            if (this.boostSequenceProgress === boostSequence.length)
            {
                this.boostSequenceProgress = 0;
                this.playerState.speedCheatBonus += 1000;
                this.playerState.speed += 1000;
                this.playerState.targetSpeed += 1000;
                this.setNotice(`Cheat BOOST active. +1000 vitesse (bonus total: ${this.playerState.speedCheatBonus}).`);
            }
        }
        else
        {
            this.boostSequenceProgress = nextChar === boostSequence[0] ? 1 : 0;
        }

        const bugSequence = 'BUG';

        if (nextChar === bugSequence[this.bugSequenceProgress])
        {
            this.bugSequenceProgress += 1;

            if (this.bugSequenceProgress === bugSequence.length)
            {
                this.bugSequenceProgress = 0;
                this.triggerBugCheat();
            }
        }
        else
        {
            this.bugSequenceProgress = nextChar === bugSequence[0] ? 1 : 0;
        }
    }

    triggerBugCheat ()
    {
        if (this.roundSummaryOverlay)
        {
            return;
        }

        this.score += 999999;
        this.playerState.upgradePoints += 99;

        const panel = this.add.container(0, 0).setDepth(110);
        const summaryContent = this.add.container(0, 0);
        const bg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 760, 500, 0x061124, 0.94)
            .setStrokeStyle(2, 0x6cff98, 0.7);
        const title = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 182, 'MODE BUG ACTIVE', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#6cff98'
        }).setOrigin(0.5);
        const body = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 80, 'Reparations et ameliorations gratuites!\n+999999 Score / +99 Points upgrade', {
            fontFamily: 'Courier',
            fontSize: 22,
            color: '#d9ecff',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);

        summaryContent.add([bg, title, body]);
        panel.add(summaryContent);
        this.roundSummaryOverlay = panel;
        this.repairOverlayPanel = null;
        this.upgradeOverlayPanel = null;

        const closeBugCheat = () => {
            if (!this.roundSummaryOverlay)
            {
                return;
            }

            this.roundSummaryOverlay.destroy(true);
            this.roundSummaryOverlay = null;
            this.repairOverlayPanel = null;
            this.upgradeOverlayPanel = null;
            this.refreshHud();
        };

        const [repairBg, repairText] = this.createSummaryButton(
            this.worldWidth * 0.5 - 230,
            this.worldHeight * 0.5 + 182,
            200,
            56,
            'REPARER',
            () => {
                summaryContent.setVisible(false);
                this.openRepairPanel(summaryContent, closeBugCheat);
            }
        );

        const [upgradeBg, upgradeText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 + 182,
            220,
            56,
            'AMELIORER',
            () => {
                summaryContent.setVisible(false);
                this.openUpgradePanel(summaryContent, closeBugCheat);
            }
        );

        const [resumeBg, resumeText] = this.createSummaryButton(
            this.worldWidth * 0.5 + 230,
            this.worldHeight * 0.5 + 182,
            230,
            56,
            'REPRENDRE',
            closeBugCheat
        );

        summaryContent.add([repairBg, repairText, upgradeBg, upgradeText, resumeBg, resumeText]);
        this.setNotice('MODE BUG: reparations et ameliorations gratuites!');
    }

    updateShots (deltaSeconds)
    {
        for (const shot of this.shotGroup.getChildren())
        {
            shot.prevX = shot.x;
            shot.prevY = shot.y;
            const previousPolygon = this.getObjectCollisionPolygonAt(shot, shot.prevX, shot.prevY, shot.rotation ?? 0);
            const shotAngleRad = (shot.shotAngle ?? 0) * Math.PI / 180;
            const dxRaw = Math.cos(shotAngleRad) * GAME_BALANCE.weapons.shotSpeed * deltaSeconds;
            const dyRaw = Math.sin(shotAngleRad) * GAME_BALANCE.weapons.shotSpeed * deltaSeconds;
            shot.x += dxRaw;
            shot.y += dyRaw;
            const currentPolygon = this.getObjectCollisionPolygon(shot);

            if (this.doesMovingPolygonIntersectTerrain(previousPolygon, currentPolygon))
            {
                this.spawnShotImpact(shot.x, this.sampleGroundHeightAtX(Phaser.Math.Clamp(shot.x, 0, this.worldWidth)), 0xffd166);
                this.shotGroup.remove(shot, true, true);
                continue;
            }

            if (this.doesMovingPolygonIntersectTunnelWalls(previousPolygon, currentPolygon))
            {
                this.spawnShotImpact(shot.x, shot.y, 0xffd166);
                this.shotGroup.remove(shot, true, true);
                continue;
            }

            if (shot.x > this.worldWidth + 24 || shot.x < -24 || shot.y > this.worldHeight + 24 || shot.y < -24)
            {
                this.shotGroup.remove(shot, true, true);
            }
        }
    }

    updateEnemies (deltaSeconds)
    {
        // Only spawn in pure 'wave' phase, not in 'wave-exit'
        if (this.gamePhase === 'wave' && !this.inTunnel)
        {
            const shouldKeepSpawning = this.sceneDistance < Game.SCENE_DISTANCE_TARGET;
            this.enemySpawnTimer -= deltaSeconds;

            if (this.enemySpawnTimer <= 0 && shouldKeepSpawning)
            {
                if (this.isWaveSpawnPlanComplete())
                {
                    for (const planEntry of this.waveSpawnPlan)
                    {
                        planEntry.spawned = 0;
                    }
                    this.waveSpawnComplete = false;
                }

                let spawnedNow = 0;

                for (const planEntry of this.waveSpawnPlan)
                {
                    if (planEntry.spawned >= planEntry.quota)
                    {
                        continue;
                    }

                    this.spawnEnemy(planEntry.config);
                    planEntry.spawned += 1;
                    this.spawnedEnemies += 1;
                    spawnedNow += 1;
                }

                this.waveSpawnComplete = this.isWaveSpawnPlanComplete();

                this.enemySpawnTimer = Math.min(...this.waveSpawnPlan.map((entry) => entry.config.spawnInterval));
            }
        }

        for (const enemy of [...this.activeEnemies])
        {
            const enemyPrevPolygon = this.getObjectCollisionPolygon(enemy);
            const playerPrevPolygon = this.getPlayerCollisionPolygonAt(this.playerState.x, this.playerState.previousY);
            enemy.step(deltaSeconds, this.playerState.speed, this.playerState.x, this.playerState.y);
            this.keepEnemyOutOfTunnel(enemy);
            const enemyCurrentPolygon = this.getObjectCollisionPolygon(enemy);
            const playerCurrentPolygon = this.getPlayerCollisionPolygon();

            // Enemies never recycle between waves; once off-screen they are removed.
            if (enemy.x < -GAME_BALANCE.enemies.wrapOffset || enemy.x > this.worldWidth + GAME_BALANCE.enemies.wrapOffset)
            {
                this.destroyEnemy(enemy, false);
                continue;
            }

            if (this.areMovingPolygonsColliding(playerPrevPolygon, playerCurrentPolygon, enemyPrevPolygon, enemyCurrentPolygon))
            {
                SoundEffects.collideWithEnemy();
                this.damagePlayer(`Collision avec un ${enemy.label.toLowerCase()}`);
                this.destroyEnemy(enemy, false);
                continue;
            }

            for (const shot of this.shotGroup.getChildren())
            {
                const shotPrevPolygon = this.getObjectCollisionPolygonAt(shot, shot.prevX ?? shot.x, shot.prevY ?? shot.y, shot.rotation ?? 0);
                const shotCurrentPolygon = this.getObjectCollisionPolygon(shot);

                if (this.areMovingPolygonsColliding(shotPrevPolygon, shotCurrentPolygon, enemyPrevPolygon, enemyCurrentPolygon))
                {
                    this.shotGroup.remove(shot, true, true);
                    this.hitEnemy(enemy);
                    break;
                }
            }
        }

    }

    completeWave ()
    {
        const destroyedRatio = this.spawnedEnemies > 0 ? (this.destroyedEnemies / this.spawnedEnemies) : 0;

        this.roundStats.enemyWaveRatios.push(destroyedRatio);

        if (this.waveStats.wasFuelAlwaysEmpty)
        {
            this.roundStats.hadAnyWaveAtZeroFuel = true;
        }

        this.addScore(GAME_BALANCE.scoring.waveClear);

        if (this.waveStats.shots === 0)
        {
            this.addScore(GAME_BALANCE.scoring.waveNoShotBonus);
        }

        this.completeRoundAfterCurrentBelt = this.waveInRound >= this.wavesInCurrentRound;

        this.startAsteroidBelt();
    }

    completeRound ()
    {
        const details = [];
        const pointsThisRound = GAME_BALANCE.upgrades.pointsPerRound ?? 2;
        const breakEvenBonusPoints = GAME_BALANCE.upgrades.breakEvenBonusPointsNextRound ?? 1;
        const breakEvenBonus = !this.playerState.upgradePointsHasUsed ? breakEvenBonusPoints : 0;
        const chronoBonuses = [...(GAME_BALANCE.scoring.chronoBonuses ?? [])]
            .sort((a, b) => a.thresholdSeconds - b.thresholdSeconds);

        this.roundStats.hullRepairWasPossible = this.playerState.hull < this.getMaxHullWithUpgrades();

        const enemyCleanupOnAllWaves = this.roundStats.enemyWaveRatios.length > 0 &&
            this.roundStats.enemyWaveRatios.every((ratio) => ratio >= 0.9);
        const asteroidCleanupOnAllWaves = this.roundStats.asteroidWaveRatios.length > 0 &&
            this.roundStats.asteroidWaveRatios.every((ratio) => ratio > 0.75);
        const survivantAchieved = !this.roundStats.lostHullDuringRound;
        const panneAchieved = this.roundStats.hadAnyWaveAtZeroFuel;

        this.addScore(GAME_BALANCE.scoring.roundClear);
        details.push(`Points Round +${Math.round(GAME_BALANCE.scoring.roundClear * this.scoreMultiplier)}`);

        const earnedChronoBonus = chronoBonuses.find((bonus) => this.roundTimeElapsed < bonus.thresholdSeconds);

        if (earnedChronoBonus)
        {
            this.addScore(earnedChronoBonus.points);
            details.push(`Points ${earnedChronoBonus.label} +${Math.round(earnedChronoBonus.points * this.scoreMultiplier)}`);
        }

        if (survivantAchieved)
        {
            this.addScore(GAME_BALANCE.scoring.survivantBonus);
            details.push(`Points Survivant +${Math.round(GAME_BALANCE.scoring.survivantBonus * this.scoreMultiplier)}`);
        }

        if (enemyCleanupOnAllWaves)
        {
            this.addScore(GAME_BALANCE.scoring.nettoyeurBonus);
            details.push(`Points Nettoyeur +${Math.round(GAME_BALANCE.scoring.nettoyeurBonus * this.scoreMultiplier)}`);
        }

        if (asteroidCleanupOnAllWaves)
        {
            this.addScore(GAME_BALANCE.scoring.destructeurBonus);
            details.push(`Points Destructeur +${Math.round(GAME_BALANCE.scoring.destructeurBonus * this.scoreMultiplier)}`);
        }

        if (panneAchieved)
        {
            this.addScore(GAME_BALANCE.scoring.panneBonus);
            details.push(`Points Panne +${Math.round(GAME_BALANCE.scoring.panneBonus * this.scoreMultiplier)}`);
        }

        if (this.roundStats.shots === 0)
        {
            this.addScore(GAME_BALANCE.scoring.anguilleBonus);
            details.push(`Points Anguille +${Math.round(GAME_BALANCE.scoring.anguilleBonus * this.scoreMultiplier)}`);
        }

        if (this.roundStats.fuelTunnelsTaken === 0)
        {
            this.addScore(GAME_BALANCE.scoring.chameauBonus);
            details.push(`Points Chameau +${Math.round(GAME_BALANCE.scoring.chameauBonus * this.scoreMultiplier)}`);
        }

        if (this.roundStats.bombsUsed === 0)
        {
            this.addScore(GAME_BALANCE.scoring.pacifisteBonus);
            details.push(`Points Pacifiste +${Math.round(GAME_BALANCE.scoring.pacifisteBonus * this.scoreMultiplier)}`);
        }

        if (this.roundStats.boostsUsed >= 3)
        {
            this.addScore(GAME_BALANCE.scoring.piloteBonus);
            details.push(`Points Pilote +${Math.round(GAME_BALANCE.scoring.piloteBonus * this.scoreMultiplier)}`);
        }

        if (breakEvenBonus > 0)
        {
            details.push(`Bonus Fourmis +${breakEvenBonus} point d'amelioration`);
        }

        this.showRoundSummary(details, () => {
            if (this.roundIndex >= GAME_BALANCE.progression.rounds)
            {
                SoundEffects.stopAmbientMusic();
                SoundEffects.stopManeuverThruster();
                SoundEffects.stopBoostThruster();
                this.scene.start('Victory', {
                    score: this.score,
                    round: this.roundIndex,
                    wave: this.waveInRound
                });
                return;
            }

            // Upgrade points rules:
            // 1) +2 points every new round
            // 2) +1 Fourmis bonus if zero points were spent during the round that just ended
            this.playerState.upgradePoints += pointsThisRound + breakEvenBonus;
            this.playerState.upgradePointsUnused = breakEvenBonus > 0;
            this.playerState.upgradePointsUsed = 0;
            this.playerState.upgradePointsHasUsed = false;
            this.playerState.manualUpgradeUsed = false;

            // Reinitialize shield health based on shield level
            if (this.playerState.upgrades.shield > 0)
            {
                this.playerState.shieldHealth = this.playerState.upgrades.shield;
            }

            // Reset timer for next round
            this.roundTimeElapsed = 0;

            this.roundIndex += 1;
            this.waveInRound = 1;
            this.waveIndex += 1;
            this.waveSummaryReady = false;
            this.roundStats = {
                shots: 0,
                fuelTunnelsTaken: 0,
                bombsUsed: 0,
                boostsUsed: 0,
                lostHullDuringRound: false,
                enemyWaveRatios: [],
                asteroidWaveRatios: [],
                hadAnyWaveAtZeroFuel: false,
                hullRepairWasPossible: false,
                hullRepairUsed: false
            };

            this.beginWavePhase();
        });
    }

    getRepairDifficultyMultiplier ()
    {
        const table = GAME_BALANCE.repair?.difficultyMultiplier ?? {};

        return table[this.difficultyLevel] ?? table.normal ?? 1;
    }

    createSummaryButton (x, y, width, height, label, onClick)
    {
        const background = this.add.rectangle(x, y, width, height, 0x123455, 0.85)
            .setStrokeStyle(2, 0x7cf0ff, 0.65)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial Black',
            fontSize: 18,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        background.on('pointerover', () => {
            background.setFillStyle(0x1b4f75, 0.95);
            text.setColor('#ffffff');
        });

        background.on('pointerout', () => {
            background.setFillStyle(0x123455, 0.85);
            text.setColor('#e9f7ff');
        });

        background.on('pointerdown', onClick);

        return [background, text];
    }

    createRepairAdjuster (panel, options)
    {
        const {
            y,
            label,
            valueProvider,
            valueFormatter,
            plusAction,
            minusAction,
            canPlus,
            canMinus,
            costLabel
        } = options;

        const labelText = this.add.text(this.worldWidth * 0.5 - 250, y, label, {
            fontFamily: 'Courier',
            fontSize: 24,
            fontStyle: 'bold',
            color: '#d7ecff'
        }).setOrigin(0, 0.5);
        const valueText = this.add.text(this.worldWidth * 0.5 - 40, y, valueFormatter(valueProvider()), {
            fontFamily: 'Courier',
            fontSize: 24,
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5, 0.5);
        const costText = this.add.text(this.worldWidth * 0.5 + 72, y, costLabel, {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#ffd89c'
        }).setOrigin(0.5, 0.5);
        const plusText = this.add.text(this.worldWidth * 0.5 + 190, y, '+', {
            fontFamily: 'Arial Black',
            fontSize: 32,
            color: '#7cf0ff'
        }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
        const minusText = this.add.text(this.worldWidth * 0.5 + 235, y, '-', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#7cf0ff'
        }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

        const setEnabledState = (node, enabled) => {
            node.setColor(enabled ? '#7cf0ff' : '#5b6f80');
            node.disableInteractive();

            if (enabled)
            {
                node.setInteractive({ useHandCursor: true });
            }
        };

        plusText.on('pointerdown', plusAction);
        minusText.on('pointerdown', minusAction);

        const refresh = () => {
            valueText.setText(valueFormatter(valueProvider()));
            setEnabledState(plusText, canPlus());
            setEnabledState(minusText, canMinus());
        };

        panel.add([labelText, valueText, costText, plusText, minusText]);

        return { refresh };
    }

    openRepairPanel (summaryPanel, onResume = null)
    {
        if (this.repairOverlayPanel)
        {
            return;
        }

        summaryPanel.setVisible(false);

        const difficultyMultiplier = this.getRepairDifficultyMultiplier();
        const repairCfg = GAME_BALANCE.repair;
        const stepPercent = repairCfg.stepPercent;
        const resaleFactor = repairCfg.resaleFactor;
        const maxHull = this.getMaxHullWithUpgrades();
        const maxBombs = GAME_BALANCE.bombs.initialCount + (this.playerState.upgrades.bomb - GAME_BALANCE.upgrades.bomb.baseLevel);
        const maxFuel = this.getMaxFuelWithUpgrades();
        const maxBoost = 100;
        const hullCost = repairCfg.baseCosts.hull * difficultyMultiplier;
        const bombsCost = repairCfg.baseCosts.bombs * difficultyMultiplier;
        const fuelCost = repairCfg.baseCosts.fuelStep * difficultyMultiplier;
        const boostCost = repairCfg.baseCosts.boostStep * difficultyMultiplier;

        const repairPanel = this.add.container(0, 0).setDepth(110);
        const bg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 760, 500, 0x031325, 0.96)
            .setStrokeStyle(2, 0x7cf0ff, 0.55);
        const title = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 214, 'REPARATION', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#f4f7fb'
        }).setOrigin(0.5);
        const subTitle = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 178, `Difficulte x${difficultyMultiplier}`, {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#9cd8ff'
        }).setOrigin(0.5);
        const moneyText = this.add.text(this.worldWidth * 0.5 - 250, this.worldHeight * 0.5 - 142, `SCORE/MONEY: ${Math.round(this.score)}`, {
            fontFamily: 'Courier',
            fontSize: 22,
            color: '#ffe4ad'
        }).setOrigin(0, 0.5);

        // Add background and headers first (so adjusters appear on top)
        repairPanel.add([bg, title, subTitle, moneyText]);

        const updateMoney = () => {
            moneyText.setText(`SCORE/MONEY: ${Math.round(this.score)}`);
            this.refreshHud();
            for (const line of adjusters)
            {
                line.refresh();
            }
        };

        const buyHull = () => {
            if (this.playerState.hull >= maxHull || this.score < hullCost)
            {
                return;
            }

            this.score -= hullCost;
            this.playerState.hull += 1;
            this.roundStats.hullRepairUsed = true;
            updateMoney();
        };

        const sellHull = () => {
            if (this.playerState.hull <= 1)
            {
                return;
            }

            this.playerState.hull -= 1;
            this.score += Math.round(hullCost * resaleFactor);
            updateMoney();
        };

        const buyBomb = () => {
            if (this.playerState.bombs >= maxBombs || this.score < bombsCost)
            {
                return;
            }

            this.score -= bombsCost;
            this.playerState.bombs += 1;
            updateMoney();
        };

        const sellBomb = () => {
            if (this.playerState.bombs <= 0)
            {
                return;
            }

            this.playerState.bombs -= 1;
            this.score += Math.round(bombsCost * resaleFactor);
            updateMoney();
        };

        const buyFuel = () => {
            if (this.playerState.fuel >= maxFuel || this.score < fuelCost)
            {
                return;
            }

            this.score -= fuelCost;
            this.playerState.fuel = Math.min(maxFuel, this.playerState.fuel + stepPercent);
            updateMoney();
        };

        const sellFuel = () => {
            if (this.playerState.fuel <= 0)
            {
                return;
            }

            this.playerState.fuel = Math.max(0, this.playerState.fuel - stepPercent);
            this.score += Math.round(fuelCost * resaleFactor);
            updateMoney();
        };

        const buyBoost = () => {
            if (this.playerState.boostCharge >= maxBoost || this.score < boostCost)
            {
                return;
            }

            this.score -= boostCost;
            this.playerState.boostCharge = Math.min(maxBoost, this.playerState.boostCharge + stepPercent);
            updateMoney();
        };

        const sellBoost = () => {
            if (this.playerState.boostCharge <= 0)
            {
                return;
            }

            this.playerState.boostCharge = Math.max(0, this.playerState.boostCharge - stepPercent);
            this.score += Math.round(boostCost * resaleFactor);
            updateMoney();
        };

        const adjusters = [
            this.createRepairAdjuster(repairPanel, {
                y: this.worldHeight * 0.5 - 88,
                label: 'Coque',
                valueProvider: () => this.playerState.hull,
                valueFormatter: (value) => `${value}/${maxHull}`,
                plusAction: buyHull,
                minusAction: sellHull,
                canPlus: () => this.playerState.hull < maxHull && this.score >= hullCost,
                canMinus: () => this.playerState.hull > 1,
                costLabel: `${hullCost}`
            }),
            this.createRepairAdjuster(repairPanel, {
                y: this.worldHeight * 0.5 - 30,
                label: 'Bombes',
                valueProvider: () => this.playerState.bombs,
                valueFormatter: (value) => `${value}/${maxBombs}`,
                plusAction: buyBomb,
                minusAction: sellBomb,
                canPlus: () => this.playerState.bombs < maxBombs && this.score >= bombsCost,
                canMinus: () => this.playerState.bombs > 0,
                costLabel: `${bombsCost}`
            }),
            this.createRepairAdjuster(repairPanel, {
                y: this.worldHeight * 0.5 + 28,
                label: 'Fuel',
                valueProvider: () => this.playerState.fuel,
                valueFormatter: (value) => `${Math.round(value)}%`,
                plusAction: buyFuel,
                minusAction: sellFuel,
                canPlus: () => this.playerState.fuel < maxFuel && this.score >= fuelCost,
                canMinus: () => this.playerState.fuel > 0,
                costLabel: `${fuelCost} (+${stepPercent}%)`
            }),
            this.createRepairAdjuster(repairPanel, {
                y: this.worldHeight * 0.5 + 86,
                label: 'Boost',
                valueProvider: () => this.playerState.boostCharge,
                valueFormatter: (value) => `${Math.round(value)}%`,
                plusAction: buyBoost,
                minusAction: sellBoost,
                canPlus: () => this.playerState.boostCharge < maxBoost && this.score >= boostCost,
                canMinus: () => this.playerState.boostCharge > 0,
                costLabel: `${boostCost} (+${stepPercent}%)`
            })
        ];

        const [retourBg, retourText] = this.createSummaryButton(
            this.worldWidth * 0.5 - 280,
            this.worldHeight * 0.5 + 176,
            160,
            54,
            'RETOUR',
            () => {
                if (!this.repairOverlayPanel)
                {
                    return;
                }

                this.repairOverlayPanel.destroy(true);
                this.repairOverlayPanel = null;
                summaryPanel.setVisible(true);
                this.refreshHud();
            }
        );

        const [amelioBg, amelioText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 + 176,
            200,
            54,
            'AMELIORATION',
            () => {
                if (!this.repairOverlayPanel)
                {
                    return;
                }

                this.repairOverlayPanel.destroy(true);
                this.repairOverlayPanel = null;
                this.openUpgradePanel(summaryPanel, onResume);
            }
        );

        const [reprendreBg, reprendre_Text] = this.createSummaryButton(
            this.worldWidth * 0.5 + 280,
            this.worldHeight * 0.5 + 176,
            180,
            54,
            'REPRENDRE',
            () => {
                if (onResume)
                {
                    onResume();
                    return;
                }

                if (!this.roundSummaryOverlay)
                {
                    return;
                }

                // Destroy all overlay panels and summary at once
                this.roundSummaryOverlay.destroy(true);
                this.roundSummaryOverlay = null;
                this.repairOverlayPanel = null;
                this.upgradeOverlayPanel = null;
                
                this.refreshHud();
                this.beginWavePhase();
            }
        );

        repairPanel.add([retourBg, retourText, amelioBg, amelioText, reprendreBg, reprendre_Text]);
        this.repairOverlayPanel = repairPanel;
        this.roundSummaryOverlay.add(repairPanel);

        updateMoney();
    }

    openUpgradePanel (summaryPanel, onResume = null)
    {
        if (this.upgradeOverlayPanel)
        {
            return;
        }

        const cfg = GAME_BALANCE.upgrades;
        const currentUpgrades = this.playerState.upgrades;
        const pointsLeft = Math.max(0, this.playerState.upgradePoints);

        summaryPanel.setVisible(false);

        const upgradePanel = this.add.container(0, 0).setDepth(110);
        const bg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 800, 560, 0x031325, 0.96)
            .setStrokeStyle(2, 0x7cf0ff, 0.55);
        const title = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 244, 'AMELIORATION', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        const roundMancheInfo = this.add.text(this.worldWidth * 0.5 - 380, this.worldHeight * 0.5 - 250,
            `Round: ${this.roundIndex}/7\nManche: ${this.waveInRound}/${this.wavesInCurrentRound}`, {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#9cd8ff',
            lineSpacing: 4
        }).setOrigin(0, 0);

        const statsText = this.add.text(this.worldWidth * 0.5 - 350, this.worldHeight * 0.5 - 204,
            `Points disponibles: ${pointsLeft}`, {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#9cd8ff'
        }).setOrigin(0, 0.5);

        upgradePanel.add([bg, title, roundMancheInfo, statsText]);

        const upgradeBranches = [
            { key: 'cannon', label: 'Canon', icon: '▸', color: '#ffc857' },
            { key: 'reactor', label: 'Reacteur', icon: '⚡', color: '#ff974f' },
            { key: 'hull', label: 'Coque', icon: '■', color: '#8de9ff' },
            { key: 'shield', label: 'Bouclier', icon: '◎', color: '#88d0ff' },
            { key: 'cooling', label: 'Refroidissement', icon: '❄', color: '#6cff98' },
            { key: 'reservoir', label: 'Reservoir', icon: '▣', color: '#9cffc4' },
            { key: 'bomb', label: 'Bombe', icon: '●', color: '#ff9f54' }
        ];

        for (let i = 0; i < upgradeBranches.length; i++)
        {
            const branch = upgradeBranches[i];
            const branchCfg = cfg[branch.key];
            const currentLevel = currentUpgrades[branch.key];
            const canUpgrade = currentLevel < branchCfg.maxLevel && pointsLeft > 0;
            const rowY = this.worldHeight * 0.5 - 150 + (i * 50);

            const iconText = this.add.text(this.worldWidth * 0.5 - 320, rowY, branch.icon, {
                fontFamily: 'Arial Black',
                fontSize: 24,
                color: branch.color
            }).setOrigin(0.5, 0.5);

            const labelText = this.add.text(this.worldWidth * 0.5 - 270, rowY, branch.label, {
                fontFamily: 'Courier',
                fontSize: 20,
                color: '#d7ecff'
            }).setOrigin(0, 0.5);

            const levelText = this.add.text(this.worldWidth * 0.5 - 40, rowY, `${currentLevel}/${branchCfg.maxLevel}`, {
                fontFamily: 'Courier',
                fontSize: 20,
                color: '#ffffff',
                align: 'right'
            }).setOrigin(1, 0.5);

            const upgradeBtn = this.add.text(this.worldWidth * 0.5 + 50, rowY, canUpgrade ? '[+]' : '[ ]', {
                fontFamily: 'Arial Black',
                fontSize: 28,
                color: canUpgrade ? '#7cf0ff' : '#5b6f80'
            }).setOrigin(0.5, 0.5);

            if (canUpgrade)
            {
                upgradeBtn.setInteractive({ useHandCursor: true });

                upgradeBtn.on('pointerdown', () => {
                    const oldLevel = currentUpgrades[branch.key];
                    currentUpgrades[branch.key] = Math.min(branchCfg.maxLevel, oldLevel + 1);
                    this.playerState.upgradePoints = Math.max(0, this.playerState.upgradePoints - 1);
                    this.playerState.upgradePointsUsed += 1;
                    this.playerState.upgradePointsHasUsed = true;

                    if (branch.key === 'hull')
                    {
                        this.playerState.hull = Math.min(currentUpgrades.hull, this.playerState.hull + 1);
                    }
                    else if (branch.key === 'bomb')
                    {
                        this.playerState.bombs = Math.min(currentUpgrades.bomb, this.playerState.bombs + 1);
                    }
                    else if (branch.key === 'shield')
                    {
                        this.playerState.shieldHealth = currentUpgrades[branch.key];
                    }

                    this.upgradeOverlayPanel.destroy(true);
                    this.upgradeOverlayPanel = null;
                    this.openUpgradePanel(summaryPanel, onResume);
                });

                upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#ffffff'));
                upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#7cf0ff'));
            }

            upgradePanel.add([iconText, labelText, levelText, upgradeBtn]);
        }

        const manualBtnY = this.worldHeight * 0.5 + 90;
        const canUseManual = !this.playerState.manualUpgradeUsed;

        const [retourBg, retourText] = this.createSummaryButton(
            this.worldWidth * 0.5 - 280,
            manualBtnY + 58,
            160,
            54,
            'RETOUR',
            () => {
                if (!this.upgradeOverlayPanel)
                {
                    return;
                }

                this.upgradeOverlayPanel.destroy(true);
                this.upgradeOverlayPanel = null;
                summaryPanel.setVisible(true);
            }
        );

        const [reprendreBg, reprendre_Text] = this.createSummaryButton(
            this.worldWidth * 0.5,
            manualBtnY + 58,
            180,
            54,
            'REPRENDRE',
            () => {
                if (onResume)
                {
                    onResume();
                    return;
                }

                if (!this.roundSummaryOverlay)
                {
                    return;
                }

                this.roundSummaryOverlay.destroy(true);
                this.roundSummaryOverlay = null;
                this.upgradeOverlayPanel = null;
                this.repairOverlayPanel = null;

                this.refreshHud();
                this.beginWavePhase();
            }
        );

        const [manuelBg, manuel_Text] = this.createSummaryButton(
            this.worldWidth * 0.5 + 280,
            manualBtnY + 58,
            200,
            54,
            canUseManual ? 'MANUEL +1' : 'MANUEL [X]',
            () => {
                if (!canUseManual)
                {
                    return;
                }

                this.playerState.manualUpgradeUsed = true;
                this.upgradeOverlayPanel.destroy(true);
                this.upgradeOverlayPanel = null;

                this.openManualMiniGameChallenge((result) => {
                    if (result.success)
                    {
                        this.playerState.upgradePoints += 1;
                        this.setNotice(`${result.label} reussi: +1 point d'amelioration (${result.score}/${result.targetScore}).`);
                    }
                    else
                    {
                        this.setNotice(`${result.label} echoue: aucun point bonus (${result.score}/${result.targetScore}).`);
                    }

                    this.openUpgradePanel(summaryPanel, onResume);
                });
            }
        );

        if (canUseManual)
        {
            manuel_Text.setColor('#6cff98');
        }
        else
        {
            manuel_Text.setColor('#5b6f80');
        }

        upgradePanel.add([retourBg, retourText, reprendreBg, reprendre_Text, manuelBg, manuel_Text]);
        this.upgradeOverlayPanel = upgradePanel;
        this.roundSummaryOverlay.add(upgradePanel);
    }

    createManualMiniGamePreviewOverlay ()
    {
        if (this.manualMiniGamePreviewOverlay)
        {
            return;
        }

        const panel = this.add.container(0, 0).setDepth(180).setVisible(false);
        const overlay = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, this.worldWidth, this.worldHeight, 0x010911, 0.72)
            .setInteractive({ useHandCursor: false });
        const box = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 760, 520, 0x0a1b2b, 0.96)
            .setStrokeStyle(2, 0x7cf0ff, 0.65);

        this.manualMiniGamePreviewTitle = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 208, '', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        this.manualMiniGamePreviewIntro = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 154, '', {
            fontFamily: 'Courier',
            fontSize: 17,
            color: '#9cd8ff',
            align: 'center',
            wordWrap: { width: 680 }
        }).setOrigin(0.5);

        this.manualMiniGamePreviewMeta = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 72, '', {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#d9ecff',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5);

        this.manualMiniGamePreviewControlsTitle = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 + 2, 'Touches', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#6cff98'
        }).setOrigin(0.5);

        this.manualMiniGamePreviewControls = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 + 64, '', {
            fontFamily: 'Courier',
            fontSize: 17,
            color: '#e9f7ff',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5);

        this.manualMiniGamePreviewStartBg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5 + 176, 290, 56, 0x123455, 0.95)
            .setStrokeStyle(2, 0x7cf0ff, 0.7)
            .setInteractive({ useHandCursor: true });
        this.manualMiniGamePreviewStartText = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 + 176, 'DEMARRER', {
            fontFamily: 'Arial Black',
            fontSize: 20,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        this.manualMiniGamePreviewStartBg.on('pointerover', () => {
            this.manualMiniGamePreviewStartBg.setFillStyle(0x1b4f75, 0.98);
            this.manualMiniGamePreviewStartText.setColor('#ffffff');
        });

        this.manualMiniGamePreviewStartBg.on('pointerout', () => {
            this.manualMiniGamePreviewStartBg.setFillStyle(0x123455, 0.95);
            this.manualMiniGamePreviewStartText.setColor('#e9f7ff');
        });

        this.manualMiniGamePreviewStartBg.on('pointerdown', () => this.confirmStartManualMiniGame());

        panel.add([
            overlay,
            box,
            this.manualMiniGamePreviewTitle,
            this.manualMiniGamePreviewIntro,
            this.manualMiniGamePreviewMeta,
            this.manualMiniGamePreviewControlsTitle,
            this.manualMiniGamePreviewControls,
            this.manualMiniGamePreviewStartBg,
            this.manualMiniGamePreviewStartText
        ]);

        this.manualMiniGamePreviewOverlay = panel;
    }

    createManualMiniGameResultOverlay ()
    {
        if (this.manualMiniGameResultOverlay)
        {
            return;
        }

        const panel = this.add.container(0, 0).setDepth(181).setVisible(false);
        const overlay = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, this.worldWidth, this.worldHeight, 0x010911, 0.74)
            .setInteractive({ useHandCursor: false });
        const box = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 760, 470, 0x0a1b2b, 0.97)
            .setStrokeStyle(2, 0x7cf0ff, 0.65);

        this.manualMiniGameResultTitle = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 168, '', {
            fontFamily: 'Arial Black',
            fontSize: 40,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        this.manualMiniGameResultSummary = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 52, '', {
            fontFamily: 'Courier',
            fontSize: 20,
            color: '#d9ecff',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);

        this.manualMiniGameResultGain = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 + 66, '', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#6cff98'
        }).setOrigin(0.5);

        this.manualMiniGameResultContinueBg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5 + 178, 260, 54, 0x123455, 0.95)
            .setStrokeStyle(2, 0x7cf0ff, 0.7)
            .setInteractive({ useHandCursor: true });
        this.manualMiniGameResultContinueText = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 + 178, 'CONTINUER', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#e9f7ff'
        }).setOrigin(0.5);

        this.manualMiniGameResultContinueBg.on('pointerover', () => {
            this.manualMiniGameResultContinueBg.setFillStyle(0x1b4f75, 0.98);
            this.manualMiniGameResultContinueText.setColor('#ffffff');
        });
        this.manualMiniGameResultContinueBg.on('pointerout', () => {
            this.manualMiniGameResultContinueBg.setFillStyle(0x123455, 0.95);
            this.manualMiniGameResultContinueText.setColor('#e9f7ff');
        });
        this.manualMiniGameResultContinueBg.on('pointerdown', () => this.closeManualMiniGameResult());

        panel.add([
            overlay,
            box,
            this.manualMiniGameResultTitle,
            this.manualMiniGameResultSummary,
            this.manualMiniGameResultGain,
            this.manualMiniGameResultContinueBg,
            this.manualMiniGameResultContinueText
        ]);

        this.manualMiniGameResultOverlay = panel;
    }

    getManualMiniGameControlLines (gameId)
    {
        switch (gameId)
        {
            case 'space-invaders':
                return ['Deplacement: Fleches Gauche / Droite (Q / D)', 'Tir: SPACE'];
            case 'tetris':
                return ['Deplacement: Fleches Gauche / Droite', 'Rotation: Fleche Haut ou Bas', 'Drop instantane: SPACE'];
            case 'pacman':
                return ['Deplacement: Fleches directionnelles'];
            case 'arkanoid':
                return ['Deplacement raquette: Fleches Gauche / Droite (Q / D)'];
            case 'pinball':
                return ['Flippers: Fleches Gauche / Droite (Q / D)', 'Lanceur: maintenir puis relacher SPACE'];
            default:
                return ['Commandes: Fleches et SPACE'];
        }
    }

    openManualMiniGamePreview (onDecision)
    {
        this.pendingManualMiniGameDecision = onDecision;
        this.activeManualMiniGameDef = Phaser.Utils.Array.GetRandom(MINI_GAME_DEFS);

        this.createManualMiniGamePreviewOverlay();
        this.createManualMiniGameResultOverlay();

        const targetScore = getMiniGameTargetScore(
            this.roundIndex,
            this.difficultyLevel,
            GAME_BALANCE.difficulty.scoreMultiplier,
            GAME_BALANCE.miniGames
        );
        const timeSeconds = 300;
        const attempts = this.difficultyLevel === 'normal' ? 2 : 1;
        const lives = this.difficultyLevel === 'easy' ? 2 : 1;
        const controls = this.getManualMiniGameControlLines(this.activeManualMiniGameDef.id).join('\n');

        this.manualMiniGamePreviewTitle.setText(this.activeManualMiniGameDef.label.toUpperCase());
        this.manualMiniGamePreviewIntro.setText(this.activeManualMiniGameDef.intro);
        this.manualMiniGamePreviewMeta.setText([
            `Vies: ${lives}   Essais: ${attempts}`,
            `Objectif: ${targetScore} pts`,
            `Temps max: ${Math.floor(timeSeconds / 60)}:${(timeSeconds % 60).toString().padStart(2, '0')}`
        ]);
        this.manualMiniGamePreviewControls.setText(controls);
        this.manualMiniGamePreviewOverlay.setVisible(true);

        if (this.manualMiniGameResultOverlay)
        {
            this.manualMiniGameResultOverlay.setVisible(false);
        }
    }

    confirmStartManualMiniGame ()
    {
        if (!this.pendingManualMiniGameDecision || this.activeMiniGameChallenge || !this.activeManualMiniGameDef)
        {
            return;
        }

        if (this.manualMiniGamePreviewOverlay)
        {
            this.manualMiniGamePreviewOverlay.setVisible(false);
        }

        const targetScore = getMiniGameTargetScore(
            this.roundIndex,
            this.difficultyLevel,
            GAME_BALANCE.difficulty.scoreMultiplier,
            GAME_BALANCE.miniGames
        );

        this.activeMiniGameChallenge = new MiniGameChallenge(this, {
            gameId: this.activeManualMiniGameDef.id,
            targetScore,
            roundIndex: this.roundIndex,
            difficultyLevel: this.difficultyLevel,
            difficultyTable: GAME_BALANCE.difficulty.scoreMultiplier,
            miniGameBalance: GAME_BALANCE.miniGames,
            depth: 130,
            onComplete: (result) => {
                this.activeMiniGameChallenge = null;
                this.pendingManualMiniGameResult = result;
                this.openManualMiniGameResult(result);
            }
        });
    }

    openManualMiniGameResult (result)
    {
        if (!this.manualMiniGameResultOverlay)
        {
            return;
        }

        const title = result.success ? 'SUCCES' : 'ECHEC';
        const titleColor = result.success ? '#6cff98' : '#ff8f8f';
        const gainText = result.success ? '+1 point d\'amelioration' : '+0 point d\'amelioration';
        const gainColor = result.success ? '#6cff98' : '#ffd166';
        const attemptScores = Array.isArray(result.attemptScores) ? result.attemptScores : [result.score];
        const scoreLines = attemptScores.map((score, index) => `Score essai ${index + 1}: ${score}`).join('\n');

        this.manualMiniGameResultTitle.setText(title).setColor(titleColor);
        this.manualMiniGameResultSummary.setText([
            scoreLines,
            `Objectif: ${result.targetScore} pts`
        ]);
        this.manualMiniGameResultGain.setText(gainText).setColor(gainColor);
        this.manualMiniGameResultOverlay.setVisible(true);
    }

    closeManualMiniGameResult ()
    {
        if (!this.pendingManualMiniGameResult || !this.pendingManualMiniGameDecision)
        {
            return;
        }

        if (this.manualMiniGameResultOverlay)
        {
            this.manualMiniGameResultOverlay.setVisible(false);
        }

        const result = this.pendingManualMiniGameResult;
        const callback = this.pendingManualMiniGameDecision;

        this.pendingManualMiniGameResult = null;
        this.pendingManualMiniGameDecision = null;
        this.activeManualMiniGameDef = null;

        callback(result);
    }

    openManualMiniGameChallenge (onDecision)
    {
        if (this.activeMiniGameChallenge)
        {
            return;
        }

        this.openManualMiniGamePreview(onDecision);
    }

    getMaxSpeedWithUpgrades ()
    {
        const baseMax = GAME_BALANCE.player.maxSpeed;
        const reactorLevel = this.playerState.upgrades.reactor;
        const increment = GAME_BALANCE.upgrades.reactor.speedMaxIncrement;

        return baseMax + ((reactorLevel - 1) * increment);
    }

    getBoostDurationWithUpgrades ()
    {
        const baseDuration = GAME_BALANCE.player.boostDuration;
        const reactorLevel = this.playerState.upgrades.reactor;
        const increment = GAME_BALANCE.upgrades.reactor.boostDurationIncrement;

        return baseDuration + ((reactorLevel - 1) * increment);
    }

    getReactorMobilityMultiplier ()
    {
        const baseLevel = GAME_BALANCE.upgrades.reactor.baseLevel;
        const maxLevel = GAME_BALANCE.upgrades.reactor.maxLevel;
        const reactorLevel = Phaser.Math.Clamp(this.playerState.upgrades.reactor, baseLevel, maxLevel);

        return 1 + ((reactorLevel - baseLevel) * 0.12);
    }

    getMaxHullWithUpgrades ()
    {
        const hullLevel = this.playerState.upgrades.hull;

        return hullLevel;
    }

    getMaxFuelWithUpgrades ()
    {
        const reservoirCfg = GAME_BALANCE.upgrades.reservoir;
        const reservoirLevel = Phaser.Math.Clamp(
            this.playerState.upgrades.reservoir,
            reservoirCfg.baseLevel,
            reservoirCfg.maxLevel
        );

        if (reservoirLevel <= reservoirCfg.baseLevel)
        {
            return 100;
        }

        // Level 7 is a special jump to 250% total capacity.
        if (reservoirLevel >= reservoirCfg.maxLevel)
        {
            return 250;
        }

        const nonFinalLevels = reservoirLevel - reservoirCfg.baseLevel;

        return 100 + (nonFinalLevels * 20);
    }

    getShieldFuelCostPerSecond ()
    {
        if (this.playerState.upgrades.shield === 0)
        {
            return 0;
        }

        const baseCost = GAME_BALANCE.upgrades.shield.fuelCostPerSecond * this.fuelConsumptionMultiplier;
        const shieldLevel = this.playerState.upgrades.shield;
        const reduction = GAME_BALANCE.upgrades.shield.fuelReductionPerLevel * shieldLevel;
        const actualPercent = Math.max(0.01, baseCost - reduction);

        return actualPercent;
    }

    getConsumptionDivisor ()
    {
        const coolingLevel = this.playerState.upgrades.cooling;

        return Math.max(1, coolingLevel);
    }

    getScenePacingMultiplier ()
    {
        const baseSpeed = GAME_BALANCE.player.cruiseSpeed;
        const currentSpeed = Math.max(this.playerState?.speed ?? baseSpeed, GAME_BALANCE.player.minSpeed);
        const ratio = currentSpeed / Math.max(1, baseSpeed);

        // Faster ship speed accelerates scene pacing but stays bounded.
        return Phaser.Math.Clamp(ratio, 0.85, 2.2);
    }

    getBoostSpeedTarget ()
    {
        return this.getMaxSpeedWithUpgrades() + 220;
    }

    getExplosionDurationWithUpgrades ()
    {
        const baseDuration = GAME_BALANCE.bombs.explosionDurationSeconds;
        const bombLevel = this.playerState.upgrades.bomb;
        const bombBaseLevel = GAME_BALANCE.upgrades.bomb.baseLevel;
        const increment = GAME_BALANCE.upgrades.bomb.explosionDurationIncrement;

        return baseDuration + ((bombLevel - bombBaseLevel) * increment);
    }

    getCannonAngles (level)
    {
        const clampedLevel = Phaser.Math.Clamp(level, 1, 7);
        const addedAnglesByLevel = {
            1: [0],
            2: [-45, 45],
            3: [-90, 90],
            4: [180],
            5: [-75, 75],
            6: [-135, 135],
            7: [-25, 25]
        };

        const cumulativeAngles = [];

        for (let currentLevel = 1; currentLevel <= clampedLevel; currentLevel++)
        {
            for (const angle of addedAnglesByLevel[currentLevel])
            {
                if (!cumulativeAngles.includes(angle))
                {
                    cumulativeAngles.push(angle);
                }
            }
        }

        return cumulativeAngles;
    }

    showRoundSummary (detailLines, onClose)
    {
        const panel = this.add.container(0, 0).setDepth(110);
        const summaryContent = this.add.container(0, 0);
        const isFinalRound = this.roundIndex >= GAME_BALANCE.progression.rounds;
        const panelHeight = isFinalRound ? 420 : 500;
        const bg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 760, panelHeight, 0x061124, 0.94)
            .setStrokeStyle(2, 0x7cf0ff, 0.45);
        const title = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - (isFinalRound ? 140 : 182), 'Bravo, mais c\'est pas fini', {
            fontFamily: 'Arial Black',
            fontSize: 38,
            color: '#f4f7fb'
        }).setOrigin(0.5);
        const body = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 36, detailLines.join('\n'), {
            fontFamily: 'Courier',
            fontSize: 22,
            color: '#d9ecff',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);

        summaryContent.add([bg, title, body]);
        panel.add(summaryContent);
        this.roundSummaryOverlay = panel;
        this.repairOverlayPanel = null;
        this.upgradeOverlayPanel = null;

        const closeSummary = () => {
            if (!this.roundSummaryOverlay)
            {
                return;
            }

            if (this.roundStats.hullRepairWasPossible && !this.roundStats.hullRepairUsed)
            {
                this.addScore(GAME_BALANCE.scoring.insouciantBonus);
                body.setText(`${body.text}\nPoints Insouciant +${Math.round(GAME_BALANCE.scoring.insouciantBonus * this.scoreMultiplier)}`);
            }

            this.roundSummaryOverlay.destroy(true);
            this.roundSummaryOverlay = null;
            this.repairOverlayPanel = null;
            this.upgradeOverlayPanel = null;
            this.manualUpgradePrompt = null;
            this.input.off('pointerdown', closeSummary);
            this.input.keyboard.off('keydown-ENTER', closeSummary);
            onClose();
        };

        if (isFinalRound)
        {
            const footer = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 + 154, 'ENTREE ou clic pour continuer', {
                fontFamily: 'Arial',
                fontSize: 20,
                color: '#7cf0ff'
            }).setOrigin(0.5);

            summaryContent.add(footer);
            this.input.on('pointerdown', closeSummary);
            this.input.keyboard.on('keydown-ENTER', closeSummary);
            return;
        }

        const [repairBg, repairText] = this.createSummaryButton(
            this.worldWidth * 0.5 - 230,
            this.worldHeight * 0.5 + 182,
            200,
            56,
            'REPARER',
            () => {
                summaryContent.setVisible(false);
                this.openRepairPanel(summaryContent, closeSummary);
            }
        );

        const [upgradeBg, upgradeText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 + 182,
            220,
            56,
            'AMELIORER',
            () => {
                summaryContent.setVisible(false);
                this.openUpgradePanel(summaryContent, closeSummary);
            }
        );

        const [resumeBg, resumeText] = this.createSummaryButton(
            this.worldWidth * 0.5 + 230,
            this.worldHeight * 0.5 + 182,
            230,
            56,
            'REPRENDRE',
            closeSummary
        );

        summaryContent.add([repairBg, repairText, upgradeBg, upgradeText, resumeBg, resumeText]);
    }

    startAsteroidBelt ()
    {
        this.gamePhase = 'wave-exit';
        this.transitionTimer = 0;
    }

    beginAsteroidBelt ()
    {
        this.gamePhase = 'belt';
        this.sceneIndex += 1;
        this.sceneDistance = 0;
        this.tunnelScheduled = false;

        if (this.tunnel && !this.tunnel.done)
        {
            this.tunnel.done = true;
        }

        this.maybeScheduleSceneTunnel();

        const cfg = GAME_BALANCE.asteroidBelt;

        this.asteroidBeltTimer = 0;
        this.asteroidSpawnTimer = 0;
        this.currentBeltStats = {
            spawned: 0,
            destroyed: 0
        };

        this.cameras.main.setBackgroundColor(cfg.backgroundColor);
        this.setNotice(`CAUTION: ASTEROID BELT — tenez 5000 m!`);
    }

    updateAsteroidBelt (deltaSeconds)
    {
        const cfg = GAME_BALANCE.asteroidBelt;
        const scrollImpact = this.playerState.speed * (cfg.scrollCompensationFactor ?? 0);
        this.asteroidSpawnTimer -= deltaSeconds;
        const playerPrevPos = {
            x: this.playerState.x,
            y: this.playerState.previousY
        };
        const playerCurrentPos = {
            x: this.playerState.x,
            y: this.playerState.y
        };

        // Only spawn in pure 'belt' phase, not in 'belt-exit'
        if (this.gamePhase === 'belt' && this.asteroidSpawnTimer <= 0)
        {
            this.asteroidSpawnTimer = cfg.spawnInterval;
            this.spawnAsteroid();
        }

        for (const ast of [...this.activeAsteroids])
        {
            const asteroidPrevPolygon = ast.getCollisionPolygonAt(ast.x, ast.y, ast.rotation);
            const playerPrevPolygon = this.getPlayerCollisionPolygonAt(this.playerState.x, this.playerState.previousY);
            ast.step(deltaSeconds, scrollImpact);
            const asteroidCurrentPolygon = ast.getCollisionPolygon();
            const playerCurrentPolygon = this.getPlayerCollisionPolygon();

            if (ast.x < -cfg.radiusMax)
            {
                this.activeAsteroids = this.activeAsteroids.filter(a => a !== ast);
                ast.destroy();
                continue;
            }

            if (this.areMovingPolygonsColliding(playerPrevPolygon, playerCurrentPolygon, asteroidPrevPolygon, asteroidCurrentPolygon))
            {
                SoundEffects.collideWithAsteroid();
                this.damagePlayer('Collision asteroidale');
                this.removeAsteroid(ast, false);
                continue;
            }

            for (const shot of this.shotGroup.getChildren())
            {
                const shotPrevPos = {
                    x: shot.prevX ?? shot.x,
                    y: shot.prevY ?? shot.y
                };
                const shotCurrentPos = { x: shot.x, y: shot.y };
                const shotHitRadius = Math.max(3, cfg.collisionRadius * 0.2);

                if (this.isMovingCircleCollidingWithPolygon(shotPrevPos, shotCurrentPos, shotHitRadius, asteroidPrevPolygon, asteroidCurrentPolygon))
                {
                    this.shotGroup.remove(shot, true, true);
                    this.addScore(ast.scoreValue);
                    this.removeAsteroid(ast, true, true);
                    break;
                }
            }
        }

    }

    spawnAsteroid ()
    {
        const cfg = GAME_BALANCE.asteroidBelt;
        const radius = Phaser.Math.Between(cfg.radiusMin, cfg.radiusMax);
        const speed  = Phaser.Math.Between(cfg.speedMin, cfg.speedMax) + (this.waveIndex * 6);
        const groundY = this.sampleGroundHeightAtX(this.worldWidth);
        const minAsteroidY = this.gameplayTop + radius + 14;
        const terrainClearance = 70;
        const maxAsteroidY = Math.max(minAsteroidY, groundY - radius - terrainClearance);
        const y = Phaser.Math.Between(minAsteroidY, maxAsteroidY);
        const ast = new Asteroid(this, this.worldWidth + radius + 8, y, radius, speed);

        this.add.existing(ast);
        this.activeAsteroids.push(ast);
        this.currentBeltStats.spawned += 1;
    }

    removeAsteroid (ast, shotDown, countedAsDestroyed = false)
    {
        this.activeAsteroids = this.activeAsteroids.filter(a => a !== ast);
        ast.destroy();

        if (countedAsDestroyed)
        {
            this.currentBeltStats.destroyed += 1;
        }

        if (shotDown)
        {
            SoundEffects.asteroidBreak();
            this.setNotice(`Asteroide detruit. Score ${this.score}.`);
        }
    }

    endAsteroidBelt ()
    {
        const beltDestroyedRatio = this.currentBeltStats.spawned > 0
            ? (this.currentBeltStats.destroyed / this.currentBeltStats.spawned)
            : 0;

        this.roundStats.asteroidWaveRatios.push(beltDestroyedRatio);
        this.gamePhase = 'belt-exit';
        this.transitionTimer = 0;
    }

    beginWavePhase ()
    {
        this.cameras.main.setBackgroundColor(0x040812);
        this.gamePhase = 'wave';
        this.sceneIndex += 1;
        this.sceneDistance = 0;
        if (this.waveSummaryReady)
        {
            this.waveInRound += 1;
            this.waveIndex += 1;
        }
        this.spawnedEnemies = 0;
        this.destroyedEnemies = 0;
        this.tunnelScheduled = false;
        this.waveSummaryReady = false;

        if (this.playerState.upgrades.shield > 0)
        {
            this.playerState.shieldHealth = this.playerState.upgrades.shield;
        }
        else
        {
            this.playerState.shieldHealth = 0;
        }

        if (this.tunnel && !this.tunnel.done)
        {
            this.tunnel.done = true;
        }

        this.configureWavePlan();
        this.maybeScheduleSceneTunnel();
        this.enemySpawnTimer = Math.min(...this.waveSpawnPlan.map((entry) => entry.config.spawnInterval));
        this.setNotice(`Round ${this.roundIndex} - Manche ${this.waveInRound}: ${this.currentWaveLabel}.`);
    }

    updateSceneProgression ()
    {
        const sceneDistanceTarget = Game.SCENE_DISTANCE_TARGET;

        if (this.gamePhase === 'wave' && this.sceneDistance >= sceneDistanceTarget && !this.waveSummaryReady)
        {
            this.waveSummaryReady = true;
            this.completeWave();
            return;
        }

        if (this.gamePhase === 'belt' && this.sceneDistance >= sceneDistanceTarget)
        {
            this.endAsteroidBelt();
            return;
        }

        // Handle transitions
        if (this.gamePhase === 'wave-exit')
        {
            this.beginAsteroidBelt();
            return;
        }

        if (this.gamePhase === 'belt-exit')
        {
            if (this.completeRoundAfterCurrentBelt)
            {
                this.completeRoundAfterCurrentBelt = false;
                this.completeRound();
                return;
            }

            this.beginWavePhase();
        }
    }

    maybeScheduleSceneTunnel ()
    {
        const forcedSpecialBeltTunnel = this.gamePhase === 'belt' && (
            (this.roundIndex === 4 && this.waveInRound === 4) ||
            (this.roundIndex === 5 && this.waveInRound === 4) ||
            (this.roundIndex === 6 && (this.waveInRound === 3 || this.waveInRound === 5))
        );

        if (this.roundIndex === 6 && !forcedSpecialBeltTunnel)
        {
            return;
        }

        if (this.gamePhase === 'wave-exit' || this.gamePhase === 'belt-exit')
        {
            return;
        }

        if (this.currentWaveConfigs.some((cfg) => cfg.noTunnel) && !forcedSpecialBeltTunnel)
        {
            return;
        }

        const shouldOfferTunnel = forcedSpecialBeltTunnel ||
            this.sceneIndex % GAME_BALANCE.tunnel.everySceneInterval === GAME_BALANCE.tunnel.everySceneOffset;

        if (!shouldOfferTunnel || this.tunnelScheduled || (this.tunnel && !this.tunnel.done))
        {
            return;
        }

        this.scheduleTunnel();
    }

    scheduleTunnel ()
    {
        this.tunnelScheduled = true;
        SoundEffects.tunnelAlert();

        const passageHeight = GAME_BALANCE.tunnel.passageHeight;
        const worldStart = this.scrollOffset + this.worldWidth + GAME_BALANCE.tunnel.distanceAhead;

        this.tunnel = {
            worldStart,
            worldEnd: worldStart + GAME_BALANCE.tunnel.width,
            ceilingY: this.gameplayBottom - passageHeight,
            floorY: this.gameplayBottom,
            playerEntered: false,
            completionAnnounced: false,
            missAnnounced: false,
            done: false
        };

        this.setNotice('CAUTION: Tunnel de ravitaillement en approche! Volez bas pour entrer.');
    }

    updateTunnel (deltaSeconds)
    {
        if (!this.tunnel || this.tunnel.done) { return; }

        const inT = this.inTunnel;

        if (inT)
        {
            if (!this.tunnel.playerEntered)
            {
                this.tunnel.playerEntered = true;
                this.tunnelRechargeAudioActive = true;
                this.lastTunnelRechargeTime = 0;
                this.roundStats.fuelTunnelsTaken += 1;
                this.addScore(GAME_BALANCE.scoring.fuelTunnelPenalty);
            }

            if (this.tunnelRechargeAudioActive)
            {
                const now = this.time.now;
                if (now - this.lastTunnelRechargeTime > 350)
                {
                    SoundEffects.fuelRecharge();
                    this.lastTunnelRechargeTime = now;
                }
            }

            this.playerState.fuel = Math.min(this.getMaxFuelWithUpgrades(), this.playerState.fuel + GAME_BALANCE.tunnel.refuelRate * deltaSeconds);
        }
        else
        {
            this.tunnelRechargeAudioActive = false;
        }

        const playerWorldX = this.playerState.x + this.scrollOffset;

        if (this.tunnel.playerEntered && playerWorldX > this.tunnel.worldEnd && !this.tunnel.completionAnnounced)
        {
            this.tunnel.completionAnnounced = true;
            this.setNotice('Ravitaillement complet. Bonne chance!');
        }
        else if (!this.tunnel.playerEntered && playerWorldX > this.tunnel.worldEnd + GAME_BALANCE.tunnel.missGraceDistance && !this.tunnel.missAnnounced)
        {
            this.tunnel.missAnnounced = true;
            this.setNotice('Tunnel rate. Continuez sans ravitaillement.');
        }

        const tunnelScreenEnd = this.tunnel.worldEnd - this.scrollOffset;

        if (tunnelScreenEnd < -GAME_BALANCE.tunnel.missGraceDistance)
        {
            this.tunnel.done = true;
            this.tunnelScheduled = false;
        }

        this.drawTunnelOverlay();
    }

    drawTunnelOverlay ()
    {
        this.tunnelGraphics.clear();

        if (!this.tunnel || this.tunnel.done)
        {
            this.tunnelFuelText.setVisible(false);
            return;
        }

        const scrStart = this.tunnel.worldStart - this.scrollOffset;
        const scrEnd   = this.tunnel.worldEnd   - this.scrollOffset;

        if (scrEnd < 0 || scrStart > this.worldWidth)
        {
            this.tunnelFuelText.setVisible(false);
            return;
        }

        const scrInnerStart = this.tunnelInnerStart - this.scrollOffset;
        const scrInnerEnd = this.tunnelInnerEnd - this.scrollOffset;
        const clampedStart = Math.max(0, scrStart);
        const clampedEnd   = Math.min(this.worldWidth, scrEnd);
        const clampedInnerStart = Math.max(0, scrInnerStart);
        const clampedInnerEnd = Math.min(this.worldWidth, scrInnerEnd);
        const w = clampedEnd - clampedStart;
        const ceilingW = Math.max(0, clampedInnerEnd - clampedStart);
        const floorW = Math.max(0, clampedEnd - clampedInnerStart);
        const wallThickness = GAME_BALANCE.tunnel.wallThickness;

        // Entry shaft (left): hole in floor. Exit shaft (right): opening in ceiling.
        this.tunnelGraphics.fillStyle(0x081b2d, 0.88);
        this.tunnelGraphics.fillRect(clampedStart, this.tunnel.ceilingY - wallThickness, ceilingW, wallThickness);
        this.tunnelGraphics.fillRect(clampedInnerStart, this.tunnel.floorY, floorW, wallThickness);

        this.tunnelGraphics.lineStyle(3, 0x63d7ff, 0.95);
        this.tunnelGraphics.beginPath();
        this.tunnelGraphics.moveTo(clampedStart, this.tunnel.ceilingY);
        this.tunnelGraphics.lineTo(clampedInnerEnd, this.tunnel.ceilingY);
        this.tunnelGraphics.strokePath();

        this.tunnelGraphics.beginPath();
        this.tunnelGraphics.moveTo(clampedInnerStart, this.tunnel.floorY);
        this.tunnelGraphics.lineTo(clampedEnd, this.tunnel.floorY);
        this.tunnelGraphics.strokePath();

        this.tunnelFuelText
            .setVisible(true)
            .setPosition(clampedStart + (w / 2), this.tunnel.floorY - 16);
    }

    spawnEnemy (waveConfig = this.currentWaveConfig)
    {
        const isRearSpawn = waveConfig.movement === 'rear' || waveConfig.type === 'saucer';
        const spawnScreenX = isRearSpawn ? 0 : this.worldWidth;
        const groundYAtSpawn = this.sampleGroundHeightAtX(spawnScreenX);
        const verticalSwingAllowance = waveConfig.amplitudeMax ?? 26;
        const terrainClearance = 38;
        const minEnemyY = Math.max(this.gameplayTop + 24, GAME_BALANCE.enemies.baseSpawnYMin);
        const maxEnemyY = Math.max(
            minEnemyY,
            Math.min(this.gameplayBottom - 40, groundYAtSpawn - verticalSwingAllowance - terrainClearance)
        );
        const baseY = Phaser.Math.Between(minEnemyY, maxEnemyY);
        const spawnX = this.worldWidth + GAME_BALANCE.enemies.wrapOffset;
        let enemy;

        if (waveConfig.type === 'urbite' || waveConfig.type === 'dramite' || waveConfig.type === 'bynite' || waveConfig.type === 'satellite')
        {
            enemy = new Cruiser(this, spawnX, baseY, waveConfig, this.handleCruiserFire.bind(this));
        }
        else if (waveConfig.type === 'saucer')
        {
            enemy = new ArcadeEnemy(this, -GAME_BALANCE.enemies.wrapOffset, baseY, waveConfig);
        }
        else
        {
            enemy = new ArcadeEnemy(this, spawnX, baseY, waveConfig);
        }

        if (isRearSpawn)
        {
            enemy.speed = Math.max(this.playerState.minSpeed, this.getMaxSpeedWithUpgrades() - 100);
        }

        this.add.existing(enemy);
        this.activeEnemies.push(enemy);
    }

    hitEnemy (enemy)
    {
        if (enemy.hitsLeft !== undefined && enemy.hitsLeft > 1)
        {
            enemy.hitsLeft -= 1;
            enemy.setAlpha(0);
            this.addScore(Math.floor(enemy.points * 0.3));
            this.setNotice(`${enemy.label} touche. Devenez invisible — frappe suivante requise. Score ${this.score}.`);
            return;
        }

        this.destroyEnemy(enemy, true, true);
    }

    shouldUsePreciseEnemyFire ()
    {
        if (this.difficultyLevel === 'hard')
        {
            return true;
        }

        if (this.difficultyLevel === 'normal')
        {
            return Math.random() < 0.5;
        }

        return false;
    }

    getPreciseEnemyFireAngle (fromX, fromY, toX, toY, speed, sourceDirection = -1)
    {
        const targetY = Phaser.Math.Clamp(toY, this.gameplayTop + 12, this.gameplayBottom - 12);
        const horizontalAimDistance = 220;
        const targetX = fromX + ((sourceDirection >= 0 ? 1 : -1) * horizontalAimDistance);

        return Math.atan2(targetY - fromY, targetX - fromX);
    }

    getPreciseEnemyFireJitter ()
    {
        if (this.difficultyLevel === 'hard')
        {
            return Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-0.5, 0.5));
        }

        if (this.difficultyLevel === 'normal')
        {
            return Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-1.5, 1.5));
        }

        return 0;
    }

    handleCruiserFire (fromX, fromY, toX, toY, speed, count = 1, spread = 0)
    {
        const sourceDirection = fromX < toX ? 1 : -1;
        const preciseFire = this.shouldUsePreciseEnemyFire();
        const baseAngle = preciseFire
            ? this.getPreciseEnemyFireAngle(fromX, fromY, toX, toY, speed, sourceDirection) + this.getPreciseEnemyFireJitter()
            : Math.atan2(toY - fromY, toX - fromX);

        for (let i = 0; i < count; i++)
        {
            const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
            const angle = baseAngle + offset;
            const shot = this.add.rectangle(fromX, fromY, 10, 5, 0xff33aa)
                .setStrokeStyle(1, 0xff99dd, 0.9)
                .setOrigin(0.5, 0.5);

            shot.vx = Math.cos(angle) * speed;
            shot.vy = Math.sin(angle) * speed;
            shot.sourceDirection = sourceDirection;
            shot.collisionLocalPoints = this.getRectangleLocalPoints(shot.width, shot.height, shot.displayOriginX, shot.displayOriginY);
            this.enemyShotGroup.add(shot);
        }
    }

    updateEnemyShots (deltaSeconds)
    {
        const forwardScrollImpact = this.playerState.speed * GAME_BALANCE.enemyShots.scrollCompensationFactor;
        const rearScrollImpact = this.playerState.speed * (GAME_BALANCE.enemyShots.rearScrollCompensationFactor ?? GAME_BALANCE.enemyShots.scrollCompensationFactor);

        for (const shot of this.enemyShotGroup.getChildren())
        {
            const shotScrollImpact = shot.sourceDirection === 1 ? rearScrollImpact : forwardScrollImpact;
            shot.prevX = shot.x;
            shot.prevY = shot.y;
            const previousPolygon = this.getObjectCollisionPolygonAt(shot, shot.prevX, shot.prevY, shot.rotation ?? 0);
            shot.x += (shot.vx - shotScrollImpact) * deltaSeconds;
            shot.y += shot.vy * deltaSeconds;
            const currentPolygon = this.getObjectCollisionPolygon(shot);

            const shotWorldX = shot.x + this.scrollOffset;

            if (this.doesMovingPolygonIntersectTerrain(previousPolygon, currentPolygon))
            {
                this.spawnShotImpact(shot.x, this.sampleGroundHeightAtX(Phaser.Math.Clamp(shot.x, 0, this.worldWidth)), 0xff66cc);
                this.enemyShotGroup.remove(shot, true, true);
                continue;
            }

            if (this.isInsideTunnelSpan(shotWorldX) && this.doesMovingPolygonIntersectTunnelWalls(previousPolygon, currentPolygon))
            {
                this.spawnShotImpact(shot.x, shot.y, 0xff66cc);
                this.enemyShotGroup.remove(shot, true, true);
                continue;
            }

            if (shot.x < -24 || shot.x > this.worldWidth + 24 || shot.y < -24 || shot.y > this.worldHeight + 24)
            {
                this.enemyShotGroup.remove(shot, true, true);
                continue;
            }

            const shotPrevPolygon = this.getObjectCollisionPolygonAt(shot, shot.prevX, shot.prevY, shot.rotation ?? 0);
            const shotCurrentPolygon = this.getObjectCollisionPolygon(shot);
            const playerPrevPolygon = this.getPlayerCollisionPolygonAt(this.playerState.x, this.playerState.previousY);
            const playerCurrentPolygon = this.getPlayerCollisionPolygon();

            // Check shield collision first
            let shieldBlocked = false;
            if (this.playerState.upgrades.shield > 0 && this.playerState.shieldHealth > 0)
            {
                const shieldRadius = 32;
                const shotCenterX = shot.x;
                const shotCenterY = shot.y;
                const distanceToPlayer = Phaser.Math.Distance.Between(shotCenterX, shotCenterY, this.playerState.x, this.playerState.y);

                if (distanceToPlayer < shieldRadius)
                {
                    shieldBlocked = true;
                    this.playerState.shieldHealth -= 1;
                    SoundEffects.shieldAbsorbHit();
                    if (this.playerState.shieldHealth <= 0)
                    {
                        SoundEffects.shieldBreak();
                    }
                    this.spawnShotImpact(shot.x, shot.y, 0x88d0ff);
                    this.enemyShotGroup.remove(shot, true, true);
                }
            }

            if (!shieldBlocked && this.areMovingPolygonsColliding(shotPrevPolygon, shotCurrentPolygon, playerPrevPolygon, playerCurrentPolygon))
            {
                SoundEffects.collideWithShot();
                this.enemyShotGroup.remove(shot, true, true);
                this.damagePlayer('Tir Urbite');
            }
        }
    }

    updateShield (deltaSeconds)
    {
        if (this.playerState.upgrades.shield <= 0 || this.playerState.shieldHealth <= 0)
        {
            return;
        }

        const shieldCost = this.getShieldFuelCostPerSecond() * deltaSeconds;
        this.playerState.fuel = Math.max(0, this.playerState.fuel - shieldCost);
    }

    resolveShotClashes ()
    {
        if (!this.debugCollisionEnabled)
        {
            return;
        }

        for (const playerShot of [...this.shotGroup.getChildren()])
        {
            for (const enemyShot of [...this.enemyShotGroup.getChildren()])
            {
                const playerShotPrevPolygon = this.getObjectCollisionPolygonAt(playerShot, playerShot.prevX ?? playerShot.x, playerShot.prevY ?? playerShot.y, playerShot.rotation ?? 0);
                const playerShotCurrentPolygon = this.getObjectCollisionPolygon(playerShot);
                const enemyShotPrevPolygon = this.getObjectCollisionPolygonAt(enemyShot, enemyShot.prevX ?? enemyShot.x, enemyShot.prevY ?? enemyShot.y, enemyShot.rotation ?? 0);
                const enemyShotCurrentPolygon = this.getObjectCollisionPolygon(enemyShot);

                if (this.areMovingPolygonsColliding(playerShotPrevPolygon, playerShotCurrentPolygon, enemyShotPrevPolygon, enemyShotCurrentPolygon))
                {
                    this.shotGroup.remove(playerShot, true, true);
                    this.enemyShotGroup.remove(enemyShot, true, true);
                    break;
                }
            }
        }
    }

    updateBoostCharge (deltaSeconds)
    {
        const cfg = GAME_BALANCE.boost;
        let nearMissDetected = false;

        for (const enemy of this.activeEnemies)
        {
            const distance = this.getDistanceBetweenPolygons(this.getPlayerCollisionPolygon(), this.getObjectCollisionPolygon(enemy));

            if (distance < cfg.nearMissOuterMargin && distance > cfg.nearMissInnerMargin)
            {
                nearMissDetected = true;
                break;
            }
        }

        if (!nearMissDetected)
        {
            for (const shot of this.enemyShotGroup.getChildren())
            {
                const distance = this.getDistanceBetweenPolygons(this.getPlayerCollisionPolygon(), this.getObjectCollisionPolygon(shot));

                if (distance < cfg.nearMissOuterMargin && distance > cfg.nearMissInnerMargin)
                {
                    nearMissDetected = true;
                    break;
                }
            }
        }

        if (!nearMissDetected)
        {
            for (const ast of this.activeAsteroids)
            {
                const distance = this.getDistanceBetweenPolygons(
                    this.getPlayerCollisionPolygon(),
                    ast.getCollisionPolygon()
                );

                if (distance < cfg.nearMissOuterMargin && distance > cfg.nearMissInnerMargin)
                {
                    nearMissDetected = true;
                }
            }
        }

        if (nearMissDetected)
        {
            const now = this.time.now;
            if (now - this.lastNearMissSoundTime > 500)
            {
                SoundEffects.boostChargeNearMiss();
                this.lastNearMissSoundTime = now;
            }
            this.playerState.boostCharge = Math.min(100, this.playerState.boostCharge + (cfg.nearMissChargePerSecond * deltaSeconds));
        }

        this.nearMissActive = nearMissDetected;
    }

    areMovingCirclesColliding (fromA, toA, fromB, toB, combinedRadius)
    {
        const relStartX = fromA.x - fromB.x;
        const relStartY = fromA.y - fromB.y;
        const relEndX = toA.x - toB.x;
        const relEndY = toA.y - toB.y;
        const relVelX = relEndX - relStartX;
        const relVelY = relEndY - relStartY;
        const radiusSq = combinedRadius * combinedRadius;
        const startDistSq = (relStartX * relStartX) + (relStartY * relStartY);

        if (startDistSq <= radiusSq)
        {
            return true;
        }

        const a = (relVelX * relVelX) + (relVelY * relVelY);

        if (a <= 0.000001)
        {
            return false;
        }

        const b = 2 * ((relStartX * relVelX) + (relStartY * relVelY));
        const c = startDistSq - radiusSq;
        const discriminant = (b * b) - (4 * a * c);

        if (discriminant < 0)
        {
            return false;
        }

        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / (2 * a);
        const t2 = (-b + sqrtDiscriminant) / (2 * a);

        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }

    getPlayerCollisionPolygonAt (x, y)
    {
        return this.playerCollisionLocalPoints.map((point) => ({
            x: x + point.x,
            y: y + point.y
        }));
    }

    getPlayerCollisionPolygon ()
    {
        return this.getPlayerCollisionPolygonAt(this.playerState.x, this.playerState.y);
    }

    getRectangleLocalPoints (width, height, displayOriginX, displayOriginY)
    {
        return [
            { x: -displayOriginX, y: -displayOriginY },
            { x: width - displayOriginX, y: -displayOriginY },
            { x: width - displayOriginX, y: height - displayOriginY },
            { x: -displayOriginX, y: height - displayOriginY }
        ];
    }

    getObjectCollisionPolygonAt (gameObject, x = gameObject.x, y = gameObject.y, rotation = gameObject.rotation ?? 0)
    {
        let localPoints = gameObject.collisionLocalPoints;

        if (!localPoints)
        {
            if (gameObject.geom?.x1 !== undefined)
            {
                localPoints = [
                    { x: gameObject.geom.x1 - gameObject.displayOriginX, y: gameObject.geom.y1 - gameObject.displayOriginY },
                    { x: gameObject.geom.x2 - gameObject.displayOriginX, y: gameObject.geom.y2 - gameObject.displayOriginY },
                    { x: gameObject.geom.x3 - gameObject.displayOriginX, y: gameObject.geom.y3 - gameObject.displayOriginY }
                ];
            }
            else
            {
                localPoints = this.getRectangleLocalPoints(gameObject.width, gameObject.height, gameObject.displayOriginX, gameObject.displayOriginY);
            }

            gameObject.collisionLocalPoints = localPoints;
        }

        if (Math.abs(rotation) < 0.000001)
        {
            return localPoints.map((point) => ({ x: x + point.x, y: y + point.y }));
        }

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        return localPoints.map((point) => ({
            x: x + (point.x * cos) - (point.y * sin),
            y: y + (point.x * sin) + (point.y * cos)
        }));
    }

    getObjectCollisionPolygon (gameObject)
    {
        return this.getObjectCollisionPolygonAt(gameObject, gameObject.x, gameObject.y, gameObject.rotation ?? 0);
    }

    getDistancePointToSegmentSquared (point, start, end)
    {
        const segmentX = end.x - start.x;
        const segmentY = end.y - start.y;
        const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);

        if (segmentLengthSquared <= 0.000001)
        {
            return Phaser.Math.Distance.Squared(point.x, point.y, start.x, start.y);
        }

        const projection = (((point.x - start.x) * segmentX) + ((point.y - start.y) * segmentY)) / segmentLengthSquared;
        const clampedProjection = Phaser.Math.Clamp(projection, 0, 1);
        const closestX = start.x + (segmentX * clampedProjection);
        const closestY = start.y + (segmentY * clampedProjection);

        return Phaser.Math.Distance.Squared(point.x, point.y, closestX, closestY);
    }

    isPointInsidePolygon (point, polygonPoints)
    {
        return Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(polygonPoints), point.x, point.y);
    }

    getDistanceFromPointToPolygon (point, polygonPoints)
    {
        if (this.isPointInsidePolygon(point, polygonPoints))
        {
            return 0;
        }

        let minDistanceSquared = Number.POSITIVE_INFINITY;

        for (let i = 0; i < polygonPoints.length; i++)
        {
            const start = polygonPoints[i];
            const end = polygonPoints[(i + 1) % polygonPoints.length];
            const distanceSquared = this.getDistancePointToSegmentSquared(point, start, end);

            if (distanceSquared < minDistanceSquared)
            {
                minDistanceSquared = distanceSquared;
            }
        }

        return Math.sqrt(minDistanceSquared);
    }

    doesCircleOverlapPolygon (center, radius, polygonPoints)
    {
        return this.getDistanceFromPointToPolygon(center, polygonPoints) <= radius;
    }

    doPolygonsIntersect (polygonA, polygonB)
    {
        for (const point of polygonA)
        {
            if (this.isPointInsidePolygon(point, polygonB))
            {
                return true;
            }
        }

        for (const point of polygonB)
        {
            if (this.isPointInsidePolygon(point, polygonA))
            {
                return true;
            }
        }

        for (let i = 0; i < polygonA.length; i++)
        {
            const aStart = polygonA[i];
            const aEnd = polygonA[(i + 1) % polygonA.length];
            const aLine = new Phaser.Geom.Line(aStart.x, aStart.y, aEnd.x, aEnd.y);

            for (let j = 0; j < polygonB.length; j++)
            {
                const bStart = polygonB[j];
                const bEnd = polygonB[(j + 1) % polygonB.length];
                const bLine = new Phaser.Geom.Line(bStart.x, bStart.y, bEnd.x, bEnd.y);

                if (Phaser.Geom.Intersects.LineToLine(aLine, bLine))
                {
                    return true;
                }
            }
        }

        return false;
    }

    getDistanceBetweenPolygons (polygonA, polygonB)
    {
        if (this.doPolygonsIntersect(polygonA, polygonB))
        {
            return 0;
        }

        let minDistanceSquared = Number.POSITIVE_INFINITY;

        for (const point of polygonA)
        {
            for (let i = 0; i < polygonB.length; i++)
            {
                const start = polygonB[i];
                const end = polygonB[(i + 1) % polygonB.length];
                const distanceSquared = this.getDistancePointToSegmentSquared(point, start, end);

                if (distanceSquared < minDistanceSquared)
                {
                    minDistanceSquared = distanceSquared;
                }
            }
        }

        for (const point of polygonB)
        {
            for (let i = 0; i < polygonA.length; i++)
            {
                const start = polygonA[i];
                const end = polygonA[(i + 1) % polygonA.length];
                const distanceSquared = this.getDistancePointToSegmentSquared(point, start, end);

                if (distanceSquared < minDistanceSquared)
                {
                    minDistanceSquared = distanceSquared;
                }
            }
        }

        return Math.sqrt(minDistanceSquared);
    }

    interpolatePolygon (fromPolygon, toPolygon, t)
    {
        return fromPolygon.map((point, index) => ({
            x: Phaser.Math.Linear(point.x, toPolygon[index].x, t),
            y: Phaser.Math.Linear(point.y, toPolygon[index].y, t)
        }));
    }

    isMovingCircleCollidingWithPolygon (fromCircle, toCircle, radius, fromPolygon, toPolygon)
    {
        const sampleSteps = 4;

        for (let step = 0; step <= sampleSteps; step++)
        {
            const t = step / sampleSteps;
            const circle = {
                x: Phaser.Math.Linear(fromCircle.x, toCircle.x, t),
                y: Phaser.Math.Linear(fromCircle.y, toCircle.y, t)
            };
            const polygon = step === 0
                ? fromPolygon
                : step === sampleSteps
                    ? toPolygon
                    : this.interpolatePolygon(fromPolygon, toPolygon, t);

            if (this.doesCircleOverlapPolygon(circle, radius, polygon))
            {
                return true;
            }
        }

        return false;
    }

    areMovingPolygonsColliding (fromPolygonA, toPolygonA, fromPolygonB, toPolygonB)
    {
        const sampleSteps = 4;

        for (let step = 0; step <= sampleSteps; step++)
        {
            const t = step / sampleSteps;
            const polygonA = step === 0
                ? fromPolygonA
                : step === sampleSteps
                    ? toPolygonA
                    : this.interpolatePolygon(fromPolygonA, toPolygonA, t);
            const polygonB = step === 0
                ? fromPolygonB
                : step === sampleSteps
                    ? toPolygonB
                    : this.interpolatePolygon(fromPolygonB, toPolygonB, t);

            if (this.doPolygonsIntersect(polygonA, polygonB))
            {
                return true;
            }
        }

        return false;
    }

    getLocalPolygonExtents (localPoints)
    {
        return {
            minY: Math.min(...localPoints.map((point) => point.y)),
            maxY: Math.max(...localPoints.map((point) => point.y))
        };
    }

    getTunnelWallPolygons ()
    {
        if (!this.tunnel || this.tunnel.done)
        {
            return [];
        }

        const scrStart = this.tunnel.worldStart - this.scrollOffset;
        const scrEnd = this.tunnel.worldEnd - this.scrollOffset;

        if (scrEnd < 0 || scrStart > this.worldWidth)
        {
            return [];
        }

        const scrInnerStart = this.tunnelInnerStart - this.scrollOffset;
        const scrInnerEnd = this.tunnelInnerEnd - this.scrollOffset;
        const clampedStart = Math.max(0, scrStart);
        const clampedEnd = Math.min(this.worldWidth, scrEnd);
        const clampedInnerStart = Math.max(0, scrInnerStart);
        const clampedInnerEnd = Math.min(this.worldWidth, scrInnerEnd);
        const wallThickness = GAME_BALANCE.tunnel.wallThickness;
        const polygons = [];

        if (clampedInnerEnd > clampedStart)
        {
            polygons.push({
                type: 'ceiling',
                lineY: this.tunnel.ceilingY,
                polygon: [
                    { x: clampedStart, y: this.tunnel.ceilingY - wallThickness },
                    { x: clampedInnerEnd, y: this.tunnel.ceilingY - wallThickness },
                    { x: clampedInnerEnd, y: this.tunnel.ceilingY },
                    { x: clampedStart, y: this.tunnel.ceilingY }
                ]
            });
        }

        if (clampedEnd > clampedInnerStart)
        {
            polygons.push({
                type: 'floor',
                lineY: this.tunnel.floorY,
                polygon: [
                    { x: clampedInnerStart, y: this.tunnel.floorY },
                    { x: clampedEnd, y: this.tunnel.floorY },
                    { x: clampedEnd, y: this.tunnel.floorY + wallThickness },
                    { x: clampedInnerStart, y: this.tunnel.floorY + wallThickness }
                ]
            });
        }

        return polygons;
    }

    doesPolygonIntersectTunnelWalls (polygon)
    {
        for (const wall of this.getTunnelWallPolygons())
        {
            if (this.doPolygonsIntersect(polygon, wall.polygon))
            {
                return wall;
            }
        }

        return null;
    }

    doesMovingPolygonIntersectTerrain (fromPolygon, toPolygon)
    {
        const sampleSteps = 4;

        for (let step = 0; step <= sampleSteps; step++)
        {
            const t = step / sampleSteps;
            const polygon = step === 0
                ? fromPolygon
                : step === sampleSteps
                    ? toPolygon
                    : this.interpolatePolygon(fromPolygon, toPolygon, t);

            if (this.doesPolygonIntersectTerrain(polygon))
            {
                return true;
            }
        }

        return false;
    }

    doesMovingPolygonIntersectTunnelWalls (fromPolygon, toPolygon)
    {
        const sampleSteps = 4;

        for (let step = 0; step <= sampleSteps; step++)
        {
            const t = step / sampleSteps;
            const polygon = step === 0
                ? fromPolygon
                : step === sampleSteps
                    ? toPolygon
                    : this.interpolatePolygon(fromPolygon, toPolygon, t);
            const wall = this.doesPolygonIntersectTunnelWalls(polygon);

            if (wall)
            {
                return wall;
            }
        }

        return null;
    }

    spawnShotImpact (x, y, color)
    {
        const flash = this.add.circle(x, y, 2, color, 0.95).setDepth(12);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 3.5,
            duration: 90,
            onComplete: () => flash.destroy()
        });
    }

    getTerrainSegmentsBetween (minX, maxX)
    {
        const startX = Math.max(0, Math.floor(minX / this.terrainStep) * this.terrainStep - this.terrainStep);
        const endX = Math.min(this.worldWidth + this.terrainStep, Math.ceil(maxX / this.terrainStep) * this.terrainStep + this.terrainStep);
        const segments = [];
        let previousPoint = { x: startX, y: this.sampleGroundHeightAtX(startX) };

        for (let x = startX + this.terrainStep; x <= endX; x += this.terrainStep)
        {
            const currentPoint = { x, y: this.sampleGroundHeightAtX(x) };

            segments.push({ start: previousPoint, end: currentPoint });
            previousPoint = currentPoint;
        }

        return segments;
    }

    doesPolygonIntersectTerrain (polygon)
    {
        const xs = polygon.map((point) => point.x);
        const minX = Math.max(0, Math.min(...xs));
        const maxX = Math.min(this.worldWidth, Math.max(...xs));
        const terrainSegments = this.getTerrainSegmentsBetween(minX, maxX);

        for (const point of polygon)
        {
            if (point.x >= 0 && point.x <= this.worldWidth && point.y >= this.sampleGroundHeightAtX(point.x))
            {
                return true;
            }
        }

        for (const segment of terrainSegments)
        {
            if (this.isPointInsidePolygon(segment.start, polygon) || this.isPointInsidePolygon(segment.end, polygon))
            {
                return true;
            }

            const terrainLine = new Phaser.Geom.Line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);

            for (let i = 0; i < polygon.length; i++)
            {
                const start = polygon[i];
                const end = polygon[(i + 1) % polygon.length];
                const edge = new Phaser.Geom.Line(start.x, start.y, end.x, end.y);

                if (Phaser.Geom.Intersects.LineToLine(terrainLine, edge))
                {
                    return true;
                }
            }
        }

        return false;
    }

    destroyEnemy (enemy, destroyedByPlayer, countedAsDestroyed = false)
    {
        this.activeEnemies = this.activeEnemies.filter((entry) => entry !== enemy);
        enemy.destroy();

        if (countedAsDestroyed)
        {
            this.destroyedEnemies += 1;
        }

        if (destroyedByPlayer)
        {
            SoundEffects.enemyExplosion();
            this.addScore(enemy.points);
            this.setNotice(`${enemy.label} neutralise. Score ${this.score}.`);
        }
    }

    damagePlayer (reason)
    {
        if (this.playerState.invulnerability > 0)
        {
            return;
        }

        if (this.isOnTunnelLaunchRail())
        {
            return;
        }

        SoundEffects.playerDamage();
        this.playerState.hull -= 1;
        this.roundStats.lostHullDuringRound = true;

        if (this.godMode)
        {
            this.playerState.hull += 1;
        }

        this.playerState.invulnerability = GAME_BALANCE.player.invulnerabilityDuration;
        this.playerState.speed = Math.max(this.playerState.minSpeed, this.playerState.speed - 70);
        this.playerState.targetSpeed = this.playerState.speed;
        this.playerState.verticalVelocity = 0;
        this.setNotice(`${reason}. Integrite ${Math.max(0, this.playerState.hull)}.`);

        if (this.playerState.hull <= 0)
        {
            SoundEffects.gameOver();
            SoundEffects.stopAmbientMusic();
            SoundEffects.stopManeuverThruster();
            SoundEffects.stopBoostThruster();
            this.scene.start('GameOver', {
                score: this.score,
                wave: this.waveIndex,
                crashes: this.crashCount
            });
        }
    }

    setNotice (message)
    {
        this.noticeMessage = message;
        this.noticeText.setText(message);
    }

    createCockpitHud ()
    {
        this.cockpitGraphics = this.add.graphics().setDepth(99);
        this.drawCockpitFrame();

        // Initialize round timer
        this.roundTimeElapsed = 0;
        this.roundTimerText = this.add.text(this.worldWidth * 0.5, 56, '0:00', {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#9cd8ff'
        }).setOrigin(0.5, 0).setDepth(100);

        // Create separate text element for round/manche (positioned left)
        this.roundMancheText = this.add.text(24, 20, '', {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#9cd8ff',
            align: 'left'
        }).setOrigin(0, 0).setDepth(100);

        this.debugDistanceText = this.add.text(24, 66, '', {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#6cff98',
            align: 'left'
        }).setOrigin(0, 0).setDepth(100).setVisible(false);

        this.hudText.setPosition(this.worldWidth * 0.5, 20);
        this.hudText.setStyle({
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#d8f2ff',
            lineSpacing: 7
        });

        const gaugeX = 32;
        const gaugeW = 250;
        const boostY = this.worldHeight - 58;
        const speedY = boostY - 30;  // Move speed gauge much closer to boost
        const fuelGaugeX = this.worldWidth - gaugeW - 32;  // bas à droite

        this.speedGauge = this.createCockpitGauge('VITESSE', gaugeX, speedY, gaugeW, 0x58d7ff);
        this.fuelGauge = this.createCockpitGauge('FUEL', fuelGaugeX, boostY, gaugeW, 0x6cff98);
        this.boostGauge = this.createCockpitGauge('BOOST', gaugeX, boostY, gaugeW, 0xffcb6d);
        const boostFuelCost = GAME_BALANCE.boost.fuelCostByDifficulty[this.difficultyLevel] ?? GAME_BALANCE.boost.fuelCostByDifficulty.normal;
        this.boostFuelCostText = this.add.text(gaugeX + gaugeW + 8, boostY - 11, `(${Math.round(boostFuelCost)})`, {
            fontFamily: 'Courier',
            fontSize: 13,
            color: '#ffcb6d'
        }).setOrigin(0, 0.5).setDepth(100);

        this.soundModeButton = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight - 52, 152, 34, 0x0b2c44, 0.9)
            .setStrokeStyle(2, 0x7cf0ff, 0.7)
            .setInteractive({ useHandCursor: true })
            .setDepth(100);
        this.soundModeButtonText = this.add.text(this.worldWidth * 0.5, this.worldHeight - 52, '', {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#dff8ff'
        }).setOrigin(0.5).setDepth(101);
        this.updateSoundModeButtonLabel();

        this.soundModeButton.on('pointerover', () => {
            this.soundModeButton.setFillStyle(0x164769, 0.95);
        });

        this.soundModeButton.on('pointerout', () => {
            this.soundModeButton.setFillStyle(0x0b2c44, 0.9);
        });

        this.soundModeButton.on('pointerdown', () => {
            this.openAudioPausePanel();
        });

        this.lifeIcons = [];
        this.bombIcons = [];

        const maxHullSlots = 10;
        const maxBombSlots = 10;
        const lifeStartX = this.worldWidth - 250;
        const bombStartX = this.worldWidth - 250;

        this.lifeLabel = this.add.text(this.worldWidth - 250, 26, 'VIES', {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#bde9ff'
        }).setDepth(100);

        this.bombLabel = this.add.text(this.worldWidth - 250, 74, 'BOMBES', {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#bde9ff'
        }).setDepth(100);

        for (let i = 0; i < maxHullSlots; i++)
        {
            const icon = this.add.triangle(lifeStartX + (i * 22), 52, 0, 6, 14, 12, 14, 0, 0x8de9ff)
                .setStrokeStyle(1, 0xffffff, 0.75)
                .setOrigin(0, 0.5)
                .setDepth(100)
                .setVisible(false);

            this.lifeIcons.push(icon);
        }

        for (let i = 0; i < maxBombSlots; i++)
        {
            const icon = this.add.container(bombStartX + (i * 22), 100).setDepth(100).setVisible(false);
            const body = this.add.circle(0, 0, 6, 0xffa24f, 0.95).setStrokeStyle(1, 0xffe5c6, 0.8);
            const fuse = this.add.rectangle(5, -6, 4, 2, 0xffe188, 0.95).setAngle(-30);

            icon.add([body, fuse]);
            this.bombIcons.push(icon);
        }

        // WebGL runtime here does not support this masking path.
        this.gameplayMask = null;
    }

    updateSoundModeButtonLabel ()
    {
        if (!this.soundModeButtonText || !this.soundModeButton)
        {
            return;
        }

        const mode = SoundEffects.getSoundMode();
        const flags = SoundEffects.getAudioMuteFlags();

        if (mode === 'mute')
        {
            this.soundModeButtonText.setText('MUTE');
            this.soundModeButton.setFillStyle(0x0b2c44, 0.9);
            return;
        }

        const mutedParts = [];
        if (flags.shots)
        {
            mutedParts.push('tir');
        }
        if (flags.thrusters)
        {
            mutedParts.push('reacteurs');
        }
        if (flags.ambient)
        {
            mutedParts.push('musique');
        }

        if (mutedParts.length === 0)
        {
            this.soundModeButtonText.setText('SON ON');
            this.soundModeButton.setFillStyle(0x0b2c44, 0.9);
        }
        else
        {
            this.soundModeButtonText.setText(`${mutedParts.join(', ')} OFF`);
            this.soundModeButton.setFillStyle(0x0b2c44, 0.9);
        }
    }

    openAudioPausePanel ()
    {
        if (this.audioPauseOverlay || this.roundSummaryOverlay)
        {
            return;
        }

        const panel = this.add.container(0, 0).setDepth(130);
        const bg = this.add.rectangle(this.worldWidth * 0.5, this.worldHeight * 0.5, 660, 430, 0x061124, 0.95)
            .setStrokeStyle(2, 0x7cf0ff, 0.5);
        const title = this.add.text(this.worldWidth * 0.5, this.worldHeight * 0.5 - 170, 'CONFIGURATION AUDIO', {
            fontFamily: 'Arial Black',
            fontSize: 34,
            color: '#f4f7fb'
        }).setOrigin(0.5);

        const closePanel = () => {
            if (!this.audioPauseOverlay)
            {
                return;
            }

            this.audioPauseOverlay.destroy(true);
            this.audioPauseOverlay = null;
        };

        const setModeAndNotice = (mode, notice) => {
            if (mode === 'all' || mode === 'mute')
            {
                SoundEffects.setSoundMode(mode);
            }
            else
            {
                const flags = SoundEffects.getAudioMuteFlags();
                if (mode === 'toggle-shots')
                {
                    flags.shots = !flags.shots;
                }
                else if (mode === 'toggle-thrusters')
                {
                    flags.thrusters = !flags.thrusters;
                }
                else if (mode === 'toggle-ambient')
                {
                    flags.ambient = !flags.ambient;
                }
                flags.all = false;
                SoundEffects.setAudioMuteFlags(flags);
            }

            this.updateSoundModeButtonLabel();
            this.setNotice(notice);
            closePanel();
        };

        const flags = SoundEffects.getAudioMuteFlags();
        const highlightIfActive = (buttonBg, isActive) => {
            if (isActive)
            {
                buttonBg.setFillStyle(0x1b6e3c, 0.95);
                buttonBg.setStrokeStyle(2, 0x8df7b7, 0.9);
            }
        };

        const [allBg, allText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 - 90,
            360,
            52,
            'ACTIVER SON',
            () => setModeAndNotice('all', 'Audio active.')
        );

        const [noShotBg, noShotText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 - 22,
            360,
            52,
            'COUPER SON DU TIR',
            () => setModeAndNotice('toggle-shots', 'Audio tirs modifie.')
        );
        highlightIfActive(noShotBg, flags.shots && !flags.all);

        const [noThrusterBg, noThrusterText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 + 46,
            360,
            52,
            'COUPER SON DES REACTEURS',
            () => setModeAndNotice('toggle-thrusters', 'Audio reacteurs modifie.')
        );
        highlightIfActive(noThrusterBg, flags.thrusters && !flags.all);

        const [cockpitMuteBg, cockpitMuteText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 + 114,
            360,
            52,
            'COUPER FOND SONORE',
            () => setModeAndNotice('toggle-ambient', 'Audio fond sonore modifie.')
        );
        highlightIfActive(cockpitMuteBg, flags.ambient && !flags.all);

        const [muteBg, muteText] = this.createSummaryButton(
            this.worldWidth * 0.5,
            this.worldHeight * 0.5 + 182,
            360,
            52,
            'COUPER SON',
            () => setModeAndNotice('mute', 'Audio coupe.')
        );

        panel.add([
            bg,
            title,
            allBg,
            allText,
            noShotBg,
            noShotText,
            noThrusterBg,
            noThrusterText,
            cockpitMuteBg,
            cockpitMuteText,
            muteBg,
            muteText
        ]);

        this.audioPauseOverlay = panel;
    }

    drawCockpitFrame ()
    {
        this.cockpitGraphics.clear();

        const w = this.worldWidth;
        const h = this.worldHeight;
        const topPanelHeight = this.cockpitTopHeight ?? 112;
        const bottomPanelHeight = this.cockpitBottomHeight ?? 146;
        const bottomAccentYOuter = h - (bottomPanelHeight - 38);
        const bottomAccentYInner = h - (bottomPanelHeight - 12);
        const sideInset = 4;
        const criticalHull = this.playerState && this.playerState.hull <= 1;
        const criticalBlinkOn = criticalHull && Math.floor(this.time.now / 160) % 2 === 0;

        const panelFillColor = criticalBlinkOn ? 0x2a0606 : 0x020711;
        const panelFillAlpha = criticalBlinkOn ? 0.72 : 0.58;
        const frameColor = criticalBlinkOn ? 0xff4a4a : 0x4ddcff;
        const accentColor = criticalBlinkOn ? 0xff7a7a : 0x79f2ff;
        const frameAlpha = criticalBlinkOn ? 0.95 : 0.8;
        const accentAlpha = criticalBlinkOn ? 0.85 : 0.65;

        this.cockpitGraphics.fillStyle(panelFillColor, panelFillAlpha);
        this.cockpitGraphics.fillRect(0, 0, w, topPanelHeight);
        this.cockpitGraphics.fillRect(0, h - bottomPanelHeight, w, bottomPanelHeight);

        this.cockpitGraphics.lineStyle(3, frameColor, frameAlpha);
        this.cockpitGraphics.strokeRect(sideInset, 12, w - (sideInset * 2), h - 24);

        this.cockpitGraphics.lineStyle(2, accentColor, accentAlpha);
        this.cockpitGraphics.beginPath();
        this.cockpitGraphics.moveTo(sideInset + 2, 108);
        this.cockpitGraphics.lineTo(178, 108);
        this.cockpitGraphics.lineTo(226, 134);
        this.cockpitGraphics.lineTo(w - 226, 134);
        this.cockpitGraphics.lineTo(w - 178, 108);
        this.cockpitGraphics.lineTo(w - (sideInset + 2), 108);
        this.cockpitGraphics.strokePath();

        this.cockpitGraphics.beginPath();
        this.cockpitGraphics.moveTo(sideInset + 2, bottomAccentYOuter);
        this.cockpitGraphics.lineTo(166, bottomAccentYOuter);
        this.cockpitGraphics.lineTo(230, bottomAccentYInner);
        this.cockpitGraphics.lineTo(w - 230, bottomAccentYInner);
        this.cockpitGraphics.lineTo(w - 166, bottomAccentYOuter);
        this.cockpitGraphics.lineTo(w - (sideInset + 2), bottomAccentYOuter);
        this.cockpitGraphics.strokePath();
    }

    createCockpitGauge (label, x, y, width, color)
    {
        const panel = this.add.rectangle(x - 8, y, width + 16, 24, 0x041426, 0.85)
            .setOrigin(0, 0.5)
            .setStrokeStyle(1, 0x4ddcff, 0.45)
            .setDepth(100);
        const fill = this.add.rectangle(x, y, width, 12, color, 0.95)
            .setOrigin(0, 0.5)
            .setDepth(100);
        const labelText = this.add.text(x + 6, y - 15, label, {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#9fdfff'
        }).setDepth(100);
        const valueText = this.add.text(x + width - 4, y - 15, '0%', {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#d9f6ff'
        }).setOrigin(1, 0).setDepth(100);

        return {
            width,
            color,
            fill,
            panel,
            labelText,
            valueText
        };
    }

    updateCockpitGauge (gauge, ratio, labelValue, options = {})
    {
        const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
        gauge.fill.displayWidth = Math.max(2, Math.round(gauge.width * clampedRatio));
        gauge.valueText.setText(labelValue);

        const fillColor = options.fillColor ?? gauge.color;
        const alpha = options.fillAlpha ?? 0.95;
        const valueColor = options.valueColor ?? '#d9f6ff';
        const labelColor = options.labelColor ?? '#9fdfff';

        gauge.fill.setFillStyle(fillColor, alpha);
        gauge.valueText.setColor(valueColor);
        gauge.labelText.setColor(labelColor);
    }

    updateFuelAlert (deltaSeconds)
    {
        if (this.gamePhase === 'wave' && this.playerState.fuel > 0)
        {
            this.waveStats.wasFuelAlwaysEmpty = false;
        }

        const threshold = GAME_BALANCE.fuel.criticalFuelThreshold;
        const isCritical = this.playerState.fuel > 0 && this.playerState.fuel <= threshold;

        if (!isCritical)
        {
            this.lowFuelAlertTimer = 0;
            return;
        }

        this.lowFuelAlertTimer -= deltaSeconds;

        if (this.lowFuelAlertTimer <= 0)
        {
            SoundEffects.lowFuelAlert();
            this.lowFuelAlertTimer = GAME_BALANCE.fuel.criticalAlertInterval;
        }
    }

    resolveTunnelPlayerCollision ()
    {
        if (!this.tunnel || this.tunnel.done)
        {
            return;
        }

        const playerWorldX = this.playerState.x + this.scrollOffset;

        if (!this.isInsideTunnelSpan(playerWorldX))
        {
            return;
        }

        const localExtents = this.getLocalPolygonExtents(this.playerCollisionLocalPoints);
        const previousPolygon = this.getPlayerCollisionPolygonAt(this.playerState.x, this.playerState.previousY);
        const currentPolygon = this.getPlayerCollisionPolygon();
        const wallHit = this.doesPolygonIntersectTunnelWalls(currentPolygon);

        if (!wallHit)
        {
            return;
        }

        if (wallHit.type === 'ceiling')
        {
            const previousBottom = Math.max(...previousPolygon.map((point) => point.y));
            const approachedFromAbove = previousBottom <= this.tunnel.ceilingY;

            this.playerState.y = approachedFromAbove
                ? this.tunnel.ceilingY - localExtents.maxY
                : this.tunnel.ceilingY - localExtents.minY;
            this.playerState.verticalVelocity = 0;

            if (approachedFromAbove)
            {
                this.playerState.boostCharge = 100;
                this.playerState.boostActive = true;
                this.playerState.boostTimer = this.getBoostDurationWithUpgrades();
                SoundEffects.startBoostThruster();
                this.playerState.speed = this.getBoostSpeedTarget();
                this.playerState.targetSpeed = this.getBoostSpeedTarget();
                this.roundStats.boostsUsed += 1;
                this.setNotice('Rail boost: propulsion activee.');
            }

            return;
        }

        this.playerState.y = this.tunnel.floorY - localExtents.maxY;
        this.playerState.verticalVelocity = 0;
    }

    keepEnemyOutOfTunnel (enemy)
    {
        if (!this.tunnel || this.tunnel.done)
        {
            return;
        }

        const enemyWorldX = enemy.x + this.scrollOffset;

        if (!this.isInsideTunnelSpan(enemyWorldX))
        {
            return;
        }

        const collisionPolygon = this.getObjectCollisionPolygon(enemy);
        const wallHit = this.doesPolygonIntersectTunnelWalls(collisionPolygon);

        if (wallHit)
        {
            const localExtents = this.getLocalPolygonExtents(enemy.collisionLocalPoints);

            enemy.y = this.tunnel.ceilingY - localExtents.maxY;

            if (enemy.baseY !== undefined)
            {
                enemy.baseY = Math.min(enemy.baseY, enemy.y);
            }
        }
    }

    resolveTerrainCollision ()
    {
        const playerCollisionPolygon = this.getPlayerCollisionPolygon();

        if (this.doesPolygonIntersectTerrain(playerCollisionPolygon))
        {
            this.crashCount += 1;

            let correctedY = this.playerState.y;

            for (let i = 0; i < playerCollisionPolygon.length; i++)
            {
                const point = playerCollisionPolygon[i];
                const localPoint = this.playerCollisionLocalPoints[i];
                const groundY = this.sampleGroundHeightAtX(Phaser.Math.Clamp(point.x, 0, this.worldWidth));

                correctedY = Math.min(correctedY, groundY - 2 - localPoint.y);
            }

            this.playerState.y = Math.max(90, correctedY);
            this.playerState.speed = this.playerState.minSpeed + 25;
            this.playerState.targetSpeed = this.playerState.speed;
            this.playerState.verticalVelocity = 0;
            SoundEffects.collideWithTerrain();
            this.damagePlayer('Impact terrain detecte');
        }
        // Low fuel notification removed per user request
        if (this.noticeMessage !== this.defaultNotice)
        {
            this.setNotice(this.defaultNotice);
        }
    }

    refreshHud ()
    {
        this.drawCockpitFrame();

        const fuelPercent = Math.round(this.playerState.fuel);
        const maxFuel = this.getMaxFuelWithUpgrades();
        const boostPercent = Math.round(this.playerState.boostCharge);
        const speedValue = Math.round(this.playerState.speed);
        const speedRange = Math.max(1, this.getMaxSpeedWithUpgrades() - this.playerState.minSpeed);
        const speedRatio = (speedValue - this.playerState.minSpeed) / speedRange;
        const criticalThreshold = GAME_BALANCE.fuel.criticalFuelThreshold;
        const fuelCritical = this.playerState.fuel > 0 && this.playerState.fuel <= criticalThreshold;
        const blinkOn = Math.floor(this.time.now / 180) % 2 === 0;

        this.hudText.setText([
            `SCORE   ${this.score}`,
            `DIFF    ${this.difficultyLevel.toUpperCase()}`
        ]);

        this.roundMancheText.setText([
            `Round: ${this.roundIndex}/7`,
            `Manche: ${this.waveInRound}/${this.wavesInCurrentRound}`
        ].join('\n'));

        this.debugDistanceText.setText(`Distance: ${Math.round(this.totalDistance)} m`);
        this.debugDistanceText.setVisible(this.debugCollisionEnabled);

        this.updateCockpitGauge(this.speedGauge, speedRatio, `${speedValue}`);

        if (fuelCritical)
        {
            this.updateCockpitGauge(this.fuelGauge, fuelPercent / maxFuel, `${fuelPercent}%`, {
                fillColor: blinkOn ? 0xff4a4a : 0xff953a,
                fillAlpha: blinkOn ? 0.98 : 0.82,
                valueColor: blinkOn ? '#ffd7d7' : '#ffb49e',
                labelColor: blinkOn ? '#ff9f9f' : '#ffbe9f'
            });
        }
        else if (fuelPercent === 0)
        {
            this.updateCockpitGauge(this.fuelGauge, 0, '0%', {
                fillColor: 0xb31717,
                fillAlpha: 0.95,
                valueColor: '#ffbcbc',
                labelColor: '#ff9f9f'
            });
        }
        else
        {
            this.updateCockpitGauge(this.fuelGauge, fuelPercent / maxFuel, `${fuelPercent}%`);
        }

        this.updateCockpitGauge(this.boostGauge, boostPercent / 100, `${boostPercent}%`);

        for (let i = 0; i < this.lifeIcons.length; i++)
        {
            this.lifeIcons[i].setVisible(i < this.playerState.hull);
        }

        for (let i = 0; i < this.bombIcons.length; i++)
        {
            this.bombIcons[i].setVisible(i < this.playerState.bombs);
        }

        // Update shield visuals
        const shieldRadius = 32;
        const shieldVisible = this.playerState.upgrades.shield > 0 && this.playerState.shieldHealth > 0;
        this.shieldCircle.setRadius(shieldRadius);
        this.shieldCircle.setVisible(shieldVisible);
    }

    drawCollisionDebugOverlay ()
    {
        this.debugCollisionGraphics.clear();

        if (!this.debugCollisionEnabled)
        {
            return;
        }

        const playerCollisionPolygon = this.getPlayerCollisionPolygon();

        this.debugCollisionGraphics.lineStyle(1, 0x45f7ff, 0.95);
        this.debugCollisionGraphics.strokePoints(playerCollisionPolygon, true);

        this.debugCollisionGraphics.lineStyle(1, 0xff6f91, 0.95);
        for (const enemy of this.activeEnemies)
        {
            this.debugCollisionGraphics.strokePoints(this.getObjectCollisionPolygon(enemy), true);
        }

        this.debugCollisionGraphics.lineStyle(1, 0xffd166, 0.95);
        for (const shot of this.shotGroup.getChildren())
        {
            const prevX = shot.prevX ?? shot.x;
            const prevY = shot.prevY ?? shot.y;

            this.debugCollisionGraphics.strokeLineShape(new Phaser.Geom.Line(prevX, prevY, shot.x, shot.y));
            this.debugCollisionGraphics.strokePoints(this.getObjectCollisionPolygon(shot), true);
        }

        this.debugCollisionGraphics.lineStyle(1, 0xff3eb5, 0.95);
        for (const shot of this.enemyShotGroup.getChildren())
        {
            this.debugCollisionGraphics.strokePoints(this.getObjectCollisionPolygon(shot), true);
        }

        this.debugCollisionGraphics.lineStyle(1, 0x4de0ff, 0.9);
        for (const wall of this.getTunnelWallPolygons())
        {
            this.debugCollisionGraphics.strokePoints(wall.polygon, true);
        }

        // Asteroids: visual radius + effective radii used against player/projectiles.
        for (const ast of this.activeAsteroids)
        {
            const collisionPolygon = ast.getCollisionPolygon();
            const collisionCenter = ast.getCollisionCenter();

            this.debugCollisionGraphics.lineStyle(1, 0x7aa2b8, 0.9);
            this.debugCollisionGraphics.strokePoints(playerCollisionPolygon, true);

            this.debugCollisionGraphics.lineStyle(1, 0x63ff8f, 0.95);
            this.debugCollisionGraphics.strokePoints(collisionPolygon, true);

            this.debugCollisionGraphics.lineStyle(1, 0xffb347, 0.95);
            this.debugCollisionGraphics.strokeCircle(collisionCenter.x, collisionCenter.y, 2);
        }
    }
}
