import * as Phaser from 'phaser';
import { SoundEffects } from '../audio/SoundEffects';

export const MINI_GAME_DEFS = [
    {
        id: 'space-invaders',
        label: 'Space Invaders',
        intro: 'De la rouille galactique attaque le vaisseau. Nettoie tout ça pour gagner en performance.'
    },
    {
        id: 'tetris',
        label: 'Tetris',
        intro: 'Le vaisseau est très mal organisé. Range et libère de la place pour gagner en maniabilité.'
    },
    {
        id: 'pacman',
        label: 'Pacman',
        intro: 'Un virus informatique s\'est déployé dans le système. Sécurise les données au plus vite.'
    },
    {
        id: 'arkanoid',
        label: 'Arkanoid',
        intro: 'Les réacteurs s\'entartrent avec du calcaire spatial. Retire le (bloc par bloc) pour améliorer leur efficacité.'
    },
    {
        id: 'pinball',
        label: 'Pinball',
        intro: 'Détends-toi, fais une partie de flipper et tu seras en meilleure condition pour piloter.'
    }
];

export function getMiniGameTargetScore (roundIndex, difficultyLevel, difficultyTable = {}, miniGameBalance = {})
{
    const safeRound = Math.max(1, roundIndex);
    const difficultyMultiplier = difficultyTable[difficultyLevel] ?? difficultyTable.normal ?? 1;
    const baseTargetScore = miniGameBalance.baseTargetScore ?? 1000;

    return baseTargetScore * safeRound * difficultyMultiplier;
}

export function getMiniGameDurationSeconds (roundIndex, difficultyLevel, miniGameBalance = {})
{
    const safeRound = Math.max(1, roundIndex);
    const durationTable = miniGameBalance.durationSecondsByDifficulty ?? {};
    const baseDuration = durationTable[difficultyLevel] ?? durationTable.normal ?? 45;
    const perRoundBonus = miniGameBalance.roundDurationBonusSeconds ?? 0;
    const maxBonus = miniGameBalance.maxRoundDurationBonusSeconds ?? Number.POSITIVE_INFINITY;
    const extraDuration = Math.min(maxBonus, Math.max(0, safeRound - 1) * perRoundBonus);

    return baseDuration + extraDuration;
}

function getMiniGameDefById (id)
{
    return MINI_GAME_DEFS.find((game) => game.id === id) ?? MINI_GAME_DEFS[0];
}

function randomMiniGameId ()
{
    return Phaser.Utils.Array.GetRandom(MINI_GAME_DEFS).id;
}

export class MiniGameChallenge
{
    constructor (scene, options)
    {
        this.scene = scene;
        this.onComplete = options.onComplete;
        this.targetScore = options.targetScore;
        this.roundIndex = Math.max(1, options.roundIndex ?? 1);
        this.difficultyLevel = options.difficultyLevel ?? 'normal';
        this.difficultyTable = options.difficultyTable ?? {};
        this.balance = options.miniGameBalance ?? {};
        // Demande gameplay: le chrono des mini-jeux est fixe a 5 minutes.
        this.duration = 300;
        this.elapsed = 0;
        this.score = 0;
        this.finished = false;
        this.maxAttempts = this.difficultyLevel === 'normal' ? 2 : 1;
        this.remainingAttempts = this.maxAttempts;
        this.attemptScores = [];
        this.lives = this.getInitialLivesForDifficulty();
        this.keyState = {};
        this.cooldowns = {};
        const scoreGainTable = this.balance.scoreGainMultiplierByDifficulty ?? {};
        const speedTable = this.balance.gameplaySpeedMultiplierByDifficulty ?? {};
        this.scoreGainMultiplier = scoreGainTable[this.difficultyLevel] ?? scoreGainTable.normal ?? 1;
        this.gameplaySpeedMultiplier = speedTable[this.difficultyLevel] ?? speedTable.normal ?? 1;
        this.sfxCooldowns = {};

        const gameId = options.gameId || randomMiniGameId();
        this.gameDef = getMiniGameDefById(gameId);

        this.originX = options.originX ?? (scene.scale.width * 0.5 - 340);
        this.originY = options.originY ?? (scene.scale.height * 0.5 - 235);
        this.arenaWidth = 680;
        this.arenaHeight = 420;

        this.container = scene.add.container(0, 0).setDepth(options.depth ?? 140);
        this.background = scene.add.rectangle(scene.scale.width * 0.5, scene.scale.height * 0.5, 760, 540, 0x031325, 0.95)
            .setStrokeStyle(2, 0x7cf0ff, 0.6);
        this.titleText = scene.add.text(scene.scale.width * 0.5, scene.scale.height * 0.5 - 236, this.gameDef.label.toUpperCase(), {
            fontFamily: 'Arial Black',
            fontSize: 34,
            color: '#f4f7fb'
        }).setOrigin(0.5);
        this.subtitleText = scene.add.text(scene.scale.width * 0.5, scene.scale.height * 0.5 - 196, this.gameDef.intro, {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#9cd8ff',
            align: 'center',
            wordWrap: { width: 680 }
        }).setOrigin(0.5);
        this.targetText = scene.add.text(scene.scale.width * 0.5, scene.scale.height * 0.5 - 148, `Objectif: ${this.targetScore} pts`, {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#6cff98'
        }).setOrigin(0.5);
        this.hudText = scene.add.text(this.originX + 8, this.originY - 28, '', {
            fontFamily: 'Courier',
            fontSize: 16,
            color: '#d9ecff'
        }).setOrigin(0, 0);
        this.tetrisNextLabel = scene.add.text(0, 0, 'SUIVANTE', {
            fontFamily: 'Courier',
            fontSize: 14,
            color: '#9cd8ff'
        }).setOrigin(0.5).setVisible(false);
        this.retryText = scene.add.text(this.originX + this.arenaWidth * 0.5, this.originY + this.arenaHeight * 0.5, '', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#ffd166',
            stroke: '#091018',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setVisible(false);
        this.retryTextTimer = null;

        this.graphics = scene.add.graphics().setDepth((options.depth ?? 140) + 1);
        this.container.add([this.background, this.titleText, this.subtitleText, this.targetText, this.hudText, this.graphics, this.tetrisNextLabel, this.retryText]);

        this.keydownHandler = (event) => {
            const key = event.key.toUpperCase();
            this.keyState[key] = true;

            if (event.code === 'ShiftLeft')
            {
                this.keyState.SHIFTLEFT = true;
            }

            if (event.code === 'ShiftRight')
            {
                this.keyState.SHIFTRIGHT = true;
            }

            if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'Space')
            {
                this.keyState.SPACE = true;
            }
        };

        this.keyupHandler = (event) => {
            const key = event.key.toUpperCase();
            this.keyState[key] = false;

            if (event.code === 'ShiftLeft')
            {
                this.keyState.SHIFTLEFT = false;
            }

            if (event.code === 'ShiftRight')
            {
                this.keyState.SHIFTRIGHT = false;
            }

            if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'Space')
            {
                this.keyState.SPACE = false;
            }
        };

        scene.input.keyboard.on('keydown', this.keydownHandler);
        scene.input.keyboard.on('keyup', this.keyupHandler);

        this.initGameState();
        this.playMiniGameSfx('start');
        this.render();
    }

    destroy ()
    {
        if (this.scene?.input?.keyboard)
        {
            this.scene.input.keyboard.off('keydown', this.keydownHandler);
            this.scene.input.keyboard.off('keyup', this.keyupHandler);
        }

        this.container?.destroy(true);
        this.container = null;
    }

    update (deltaSeconds)
    {
        if (this.finished)
        {
            return;
        }

        this.elapsed += deltaSeconds;
        this.tickCooldowns(deltaSeconds);
        const gameplayDelta = deltaSeconds * this.gameplaySpeedMultiplier;

        switch (this.gameDef.id)
        {
            case 'space-invaders':
                this.updateSpaceInvaders(gameplayDelta);
                break;
            case 'tetris':
                this.updateTetris(gameplayDelta);
                break;
            case 'pacman':
                this.updatePacman(gameplayDelta);
                break;
            case 'arkanoid':
                this.updateArkanoid(gameplayDelta);
                break;
            case 'pinball':
                this.updatePinball(gameplayDelta);
                break;
            default:
                break;
        }

        if (this.finished)
        {
            return;
        }

        if (this.elapsed >= this.duration)
        {
            this.finish();
            return;
        }

        this.render();
    }

    finish ()
    {
        if (this.finished)
        {
            return;
        }

        this.finished = true;
        this.attemptScores.push(this.score);
        const success = this.score >= this.targetScore;

        this.playMiniGameSfx(success ? 'success' : 'fail');

        this.onComplete?.({
            id: this.gameDef.id,
            label: this.gameDef.label,
            score: this.score,
            attemptScores: [...this.attemptScores],
            targetScore: this.targetScore,
            success
        });

        this.destroy();
    }

    tickCooldowns (deltaSeconds)
    {
        for (const key of Object.keys(this.cooldowns))
        {
            this.cooldowns[key] = Math.max(0, this.cooldowns[key] - deltaSeconds);
        }
    }

    canTrigger (key, cooldown = 0.15)
    {
        const upper = key.toUpperCase();

        if (!this.keyState[upper])
        {
            return false;
        }

        if ((this.cooldowns[upper] ?? 0) > 0)
        {
            return false;
        }

        this.cooldowns[upper] = cooldown;
        return true;
    }

    isDown (...keys)
    {
        return keys.some((key) => !!this.keyState[key.toUpperCase()]);
    }

    addScore (points)
    {
        const adjustedPoints = Math.round(points * this.scoreGainMultiplier);
        this.score = Math.max(0, this.score + adjustedPoints);
    }

    playMiniGameSfx (kind, cooldownMs = 0)
    {
        const now = this.scene?.time?.now ?? 0;
        const nextAllowedAt = this.sfxCooldowns[kind] ?? 0;

        if (cooldownMs > 0 && now < nextAllowedAt)
        {
            return;
        }

        if (cooldownMs > 0)
        {
            this.sfxCooldowns[kind] = now + cooldownMs;
        }

        switch (kind)
        {
            case 'start':
                SoundEffects.tunnelAlert();
                break;
            case 'success':
                SoundEffects.fuelRecharge();
                break;
            case 'fail':
                SoundEffects.playerDamage();
                break;
            case 'retry':
                SoundEffects.tunnelAlert();
                break;
            case 'space-shot':
                SoundEffects.laserShot();
                break;
            case 'space-hit':
                SoundEffects.enemyExplosion();
                break;
            case 'move':
                SoundEffects.boostChargeNearMiss();
                break;
            case 'lock':
                SoundEffects.shieldAbsorbHit();
                break;
            case 'clear':
                SoundEffects.fuelRecharge();
                break;
            case 'pellet':
                SoundEffects.boostChargeNearMiss();
                break;
            case 'power':
                SoundEffects.shieldBreak();
                break;
            case 'ghost':
                SoundEffects.enemyExplosion();
                break;
            case 'bounce':
                SoundEffects.shieldAbsorbHit();
                break;
            case 'brick':
                SoundEffects.asteroidBreak();
                break;
            case 'launch':
                SoundEffects.bombRelease();
                break;
            case 'bumper':
                SoundEffects.collideWithEnemy();
                break;
            default:
                break;
        }
    }

    loseLife (penalty = 0, onSurvive = null)
    {
        if (this.finished)
        {
            return true;
        }

        if (penalty !== 0)
        {
            this.addScore(penalty);
        }

        this.lives = Math.max(0, this.lives - 1);
    this.playMiniGameSfx('fail', 120);

        if (this.lives <= 0)
        {
            if (this.difficultyLevel === 'normal' && this.remainingAttempts > 1 && this.score < this.targetScore)
            {
                this.attemptScores.push(this.score);
                this.remainingAttempts -= 1;
        this.playMiniGameSfx('retry');
                this.showRetryMessage('Meme joueur joue encore');
                this.resetForNextAttempt();
                return false;
            }

            this.finish();
            return true;
        }

        onSurvive?.();
        return false;
    }

    getInitialLivesForDifficulty ()
    {
        return this.difficultyLevel === 'easy' ? 2 : 1;
    }

    resetForNextAttempt ()
    {
        this.score = 0;
        this.elapsed = 0;
        this.lives = this.getInitialLivesForDifficulty();
        this.keyState = {};
        this.cooldowns = {};
        this.initGameState();
    }

    showRetryMessage (text)
    {
        this.retryText.setText(text);
        this.retryText.setVisible(true);

        if (this.retryTextTimer)
        {
            this.retryTextTimer.remove(false);
            this.retryTextTimer = null;
        }

        this.retryTextTimer = this.scene.time.delayedCall(1300, () => {
            this.retryText.setVisible(false);
            this.retryTextTimer = null;
        });
    }

    initGameState ()
    {
        this.state = {
            common: {
                playerX: this.arenaWidth * 0.5,
                playerY: this.arenaHeight - 26
            }
        };

        switch (this.gameDef.id)
        {
            case 'space-invaders':
                this.initSpaceInvaders();
                break;
            case 'tetris':
                this.initTetris();
                break;
            case 'pacman':
                this.initPacman();
                break;
            case 'arkanoid':
                this.initArkanoid();
                break;
            case 'pinball':
                this.initPinball();
                break;
            default:
                this.initSpaceInvaders();
                break;
        }
    }

    initSpaceInvaders (persistedShields = null, persistedShieldCellSize = null)
    {
        const isNormal = this.difficultyLevel === 'normal';
        const isHard = this.difficultyLevel === 'hard';
        const baseEnemySpeed = isHard ? 52 : (isNormal ? 44 : 36);
        const initialShootDelayMin = isHard ? 0.45 : 0.8;
        const initialShootDelayMax = isHard ? 1.05 : 1.8;

        const enemies = [];

        for (let row = 0; row < 3; row++)
        {
            for (let col = 0; col < 8; col++)
            {
                enemies.push({
                    x: 90 + col * 62,
                    y: 80 + row * 44,
                    alive: true
                });
            }
        }

        let shieldCellSize;
        let shields;

        if (persistedShields && persistedShieldCellSize)
        {
            shieldCellSize = persistedShieldCellSize;
            shields = persistedShields;
        }
        else
        {
            const shieldPattern = [
                '..########..',
                '.##########.',
                '############',
                '###.####.###',
                '##..####..##',
                '#..........#'
            ];
            shieldCellSize = 6;
            const shieldWidth = shieldPattern[0].length * shieldCellSize;
            const shieldHeight = shieldPattern.length * shieldCellSize;
            const shieldTopY = this.arenaHeight - 118;
            const shieldCenters = [this.arenaWidth * 0.25, this.arenaWidth * 0.5, this.arenaWidth * 0.75];
            shields = shieldCenters.map((centerX) => ({
                x: Math.round(centerX - shieldWidth * 0.5),
                y: shieldTopY,
                width: shieldWidth,
                height: shieldHeight,
                cells: shieldPattern.map((row) => Array.from(row).map((ch) => (ch === '#' ? 3 : 0)))
            }));
        }

        this.state.spaceInvaders = {
            playerX: this.arenaWidth * 0.5,
            playerAlive: true,
            shots: [],
            enemyShots: [],
            enemies,
            shields,
            shieldCellSize,
            shieldImpactFx: [],
            enemyDirection: 1,
            enemySpeed: baseEnemySpeed,
            shootCooldown: 0,
            enemyShootTimer: Phaser.Math.FloatBetween(initialShootDelayMin, initialShootDelayMax)
        };
    }

    damageSpaceInvadersShieldAt (state, x, y)
    {
        for (const shield of state.shields)
        {
            if (x < shield.x || x >= shield.x + shield.width || y < shield.y || y >= shield.y + shield.height)
            {
                continue;
            }

            const localX = x - shield.x;
            const localY = y - shield.y;
            const col = Math.floor(localX / state.shieldCellSize);
            const row = Math.floor(localY / state.shieldCellSize);

            if (!shield.cells[row] || (shield.cells[row][col] ?? 0) <= 0)
            {
                return false;
            }

            // Cratere local: le point d'impact casse fort, les voisins se degradent.
            for (let dy = -1; dy <= 1; dy++)
            {
                for (let dx = -1; dx <= 1; dx++)
                {
                    const rr = row + dy;
                    const cc = col + dx;

                    if (!shield.cells[rr] || typeof shield.cells[rr][cc] !== 'number' || shield.cells[rr][cc] <= 0)
                    {
                        continue;
                    }

                    const directHit = dx === 0 && dy === 0;
                    const damage = directHit ? 3 : 1;
                    shield.cells[rr][cc] = Math.max(0, shield.cells[rr][cc] - damage);
                }
            }

            state.shieldImpactFx.push({ x, y, ttl: 0.14, maxTtl: 0.14, r: 4 });
            return true;
        }

        return false;
    }

    updateSpaceInvaders (deltaSeconds)
    {
        const state = this.state.spaceInvaders;
        const playerSpeed = 360;
        const isHard = this.difficultyLevel === 'hard';
        const shotDelayMin = isHard ? 0.45 : 0.9;
        const shotDelayMax = isHard ? 1.05 : 1.9;

        for (const fx of state.shieldImpactFx)
        {
            fx.ttl -= deltaSeconds;
        }
        state.shieldImpactFx = state.shieldImpactFx.filter((fx) => fx.ttl > 0);

        if (this.isDown('ARROWLEFT', 'Q'))
        {
            state.playerX -= playerSpeed * deltaSeconds;
        }

        if (this.isDown('ARROWRIGHT', 'D'))
        {
            state.playerX += playerSpeed * deltaSeconds;
        }

        state.playerX = Phaser.Math.Clamp(state.playerX, 24, this.arenaWidth - 24);
        state.shootCooldown = Math.max(0, state.shootCooldown - deltaSeconds);
        state.enemyShootTimer = Math.max(0, state.enemyShootTimer - deltaSeconds);

        if (this.isDown(' ', 'SPACE', 'ENTER') && state.shootCooldown <= 0 && state.shots.length === 0)
        {
            state.shootCooldown = 0.18;
            state.shots.push({ x: state.playerX, y: this.arenaHeight - 48 });
            this.playMiniGameSfx('space-shot', 60);
        }

        let left = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;

        for (const enemy of state.enemies)
        {
            if (!enemy.alive)
            {
                continue;
            }

            enemy.x += state.enemyDirection * state.enemySpeed * deltaSeconds;
            left = Math.min(left, enemy.x);
            right = Math.max(right, enemy.x);
        }

        if (left < 24 || right > this.arenaWidth - 24)
        {
            state.enemyDirection *= -1;

            for (const enemy of state.enemies)
            {
                if (enemy.alive)
                {
                    enemy.y += 14;
                }
            }
        }

        // Contact direct ennemis -> boucliers (grignotage) et joueur (perte de vie)
        for (const enemy of state.enemies)
        {
            if (!enemy.alive)
            {
                continue;
            }

            // Grignoter les boucliers sur le passage des ennemis
            this.damageSpaceInvadersShieldAt(state, enemy.x, enemy.y + 10);
            this.damageSpaceInvadersShieldAt(state, enemy.x - 10, enemy.y + 10);
            this.damageSpaceInvadersShieldAt(state, enemy.x + 10, enemy.y + 10);

            // Contact ennemi -> joueur
            if (Math.abs(enemy.x - state.playerX) < 18 && Math.abs(enemy.y - (this.arenaHeight - 18)) < 18)
            {
                const ended = this.loseLife(-120, () => {
                    state.playerAlive = true;
                    state.playerX = this.arenaWidth * 0.5;
                    state.enemyShots.length = 0;
                });

                if (ended)
                {
                    state.playerAlive = false;
                }

                return;
            }
        }

        if (state.enemyShootTimer <= 0)
        {
            const shootersByColumn = new Map();

            for (const enemy of state.enemies)
            {
                if (!enemy.alive)
                {
                    continue;
                }

                const column = Math.round((enemy.x - 90) / 62);
                const current = shootersByColumn.get(column);

                if (!current || enemy.y > current.y)
                {
                    shootersByColumn.set(column, enemy);
                }
            }

            const shooters = Array.from(shootersByColumn.values());
            const shooter = shooters.length > 0 ? Phaser.Utils.Array.GetRandom(shooters) : null;

            if (shooter)
            {
                state.enemyShots.push({ x: shooter.x, y: shooter.y + 16 });
            }

            state.enemyShootTimer = Phaser.Math.FloatBetween(shotDelayMin, shotDelayMax);
        }

        for (const shot of state.shots)
        {
            shot.y -= 520 * deltaSeconds;
        }

        for (const shot of state.enemyShots)
        {
            shot.y += 280 * deltaSeconds;
        }

        state.shots = state.shots.filter((shot) => shot.y > 0);
        state.enemyShots = state.enemyShots.filter((shot) => shot.y < this.arenaHeight + 12);

        for (const shot of state.shots)
        {
            if (this.damageSpaceInvadersShieldAt(state, shot.x, shot.y))
            {
                shot.y = -100;
            }
        }

        for (const shot of state.enemyShots)
        {
            if (this.damageSpaceInvadersShieldAt(state, shot.x, shot.y))
            {
                shot.y = this.arenaHeight + 100;
            }
        }

        for (const shot of state.shots)
        {
            for (const enemy of state.enemies)
            {
                if (!enemy.alive)
                {
                    continue;
                }

                if (Math.abs(shot.x - enemy.x) < 18 && Math.abs(shot.y - enemy.y) < 16)
                {
                    enemy.alive = false;
                    shot.y = -100;
                    this.addScore(100);
                    this.playMiniGameSfx('space-hit', 50);
                    break;
                }
            }
        }

        state.shots = state.shots.filter((shot) => shot.y > 0);

        for (const shot of state.enemyShots)
        {
            if (Math.abs(shot.x - state.playerX) < 16 && Math.abs(shot.y - (this.arenaHeight - 18)) < 18)
            {
                shot.y = this.arenaHeight + 100;
                const ended = this.loseLife(-120, () => {
                    state.playerAlive = true;
                    state.playerX = this.arenaWidth * 0.5;
                    state.enemyShots.length = 0;
                });

                if (ended)
                {
                    state.playerAlive = false;
                }

                return;
            }
        }

        state.enemyShots = state.enemyShots.filter((shot) => shot.y < this.arenaHeight + 12);

        if (state.enemies.every((enemy) => !enemy.alive))
        {
            const persistedShields = state.shields.map((shield) => ({
                ...shield,
                cells: shield.cells.map((row) => [...row])
            }));
            const persistedShieldCellSize = state.shieldCellSize;

            this.addScore(400);
            this.playMiniGameSfx('clear');
            this.initSpaceInvaders(persistedShields, persistedShieldCellSize);
            this.state.spaceInvaders.enemySpeed += 12;
        }
    }

    initTetris ()
    {
        const cols = 10;
        const rows = 16;
        const isEasy = this.difficultyLevel === 'easy';
        const isHard = this.difficultyLevel === 'hard';
        const dropInterval = isEasy ? 0.50 : (isHard ? 0.32 : 0.42);
        const canShowNextPiece = this.difficultyLevel !== 'hard';
        const pieceSet = [
            { id: 'I', color: 0x6dd3ff, cells: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
            { id: 'O', color: 0xffd166, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
            { id: 'T', color: 0xb388ff, cells: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
            { id: 'L', color: 0xff9f54, cells: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
            { id: 'J', color: 0x7ca6ff, cells: [{ x: -1, y: 1 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }] },
            { id: 'S', color: 0x6cff98, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }] },
            { id: 'Z', color: 0xff6a6a, cells: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] }
        ];
        const nextType = Phaser.Utils.Array.GetRandom(pieceSet);

        this.state.tetris = {
            cols,
            rows,
            grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
            pieceSet,
            piece: null,
            nextType,
            canShowNextPiece,
            dropTimer: 0,
            dropInterval
        };

        this.spawnTetrisPiece();
    }

    getTetrisPieceCells (piece = this.state.tetris.piece)
    {
        if (!piece)
        {
            return [];
        }

        return piece.type.cells.map((cell) => ({
            x: piece.x + cell.x,
            y: piece.y + cell.y
        }));
    }

    canPlaceTetrisPiece (piece, nextX, nextY)
    {
        const state = this.state.tetris;

        for (const cell of piece.type.cells)
        {
            const x = nextX + cell.x;
            const y = nextY + cell.y;

            if (x < 0 || x >= state.cols || y >= state.rows)
            {
                return false;
            }

            if (y >= 0 && state.grid[y][x] !== 0)
            {
                return false;
            }
        }

        return true;
    }

    spawnTetrisPiece ()
    {
        const state = this.state.tetris;
        const type = state.nextType ?? Phaser.Utils.Array.GetRandom(state.pieceSet);
        state.nextType = Phaser.Utils.Array.GetRandom(state.pieceSet);
        const spawnX = Math.floor(state.cols * 0.5);
        const piece = { x: spawnX, y: 0, type };

        if (!this.canPlaceTetrisPiece(piece, piece.x, piece.y))
        {
            const ended = this.loseLife(-250, () => {
                state.grid = Array.from({ length: state.rows }, () => Array(state.cols).fill(0));
            });

            if (ended)
            {
                state.piece = null;
                return;
            }
        }

        state.piece = piece;

        if (!this.canPlaceTetrisPiece(state.piece, state.piece.x, state.piece.y))
        {
            const ended = this.loseLife(-250, () => {
                state.grid = Array.from({ length: state.rows }, () => Array(state.cols).fill(0));
            });

            if (ended)
            {
                state.piece = null;
                return;
            }

            state.piece = {
                x: spawnX,
                y: 0,
                type
            };
        }
    }

    lockTetrisPiece ()
    {
        const state = this.state.tetris;

        for (const cell of this.getTetrisPieceCells(state.piece))
        {
            if (cell.y >= 0 && cell.y < state.rows && cell.x >= 0 && cell.x < state.cols)
            {
                state.grid[cell.y][cell.x] = state.piece.type.color;
            }
        }

        let cleared = 0;

        for (let row = state.rows - 1; row >= 0; row--)
        {
            const full = state.grid[row].every((cell) => cell !== 0);

            if (!full)
            {
                continue;
            }

            cleared += 1;
            state.grid.splice(row, 1);
            state.grid.unshift(Array(state.cols).fill(0));
            row += 1;
        }

        if (cleared > 0)
        {
            const lineClearScores = {
                1: 360,
                2: 900,
                3: 1600,
                4: 2600
            };
            const gainedScore = lineClearScores[cleared] ?? (2600 + (cleared - 4) * 900);
            this.addScore(gainedScore);
            this.playMiniGameSfx('clear');
        }

        this.playMiniGameSfx('lock', 50);
        this.spawnTetrisPiece();
    }

    tryMoveTetrisPiece (dx)
    {
        const state = this.state.tetris;
        const piece = state.piece;

        if (!piece)
        {
            return;
        }

        if (this.canPlaceTetrisPiece(piece, piece.x + dx, piece.y))
        {
            piece.x += dx;
            this.playMiniGameSfx('move', 45);
        }
    }

    hardDropTetrisPiece ()
    {
        const state = this.state.tetris;
        const piece = state.piece;

        if (!piece)
        {
            return;
        }

        let dropDistance = 0;

        while (this.canPlaceTetrisPiece(piece, piece.x, piece.y + 1))
        {
            piece.y += 1;
            dropDistance += 1;
        }

        if (dropDistance > 0)
        {
            this.addScore(dropDistance * 2);
            this.playMiniGameSfx('lock', 40);
        }

        this.lockTetrisPiece();
        state.dropTimer = 0;
    }

    rotateTetrisPieceClockwise ()
    {
        const state = this.state.tetris;
        const piece = state.piece;

        if (!piece || piece.type.id === 'O')
        {
            return;
        }

        const rotatedCells = piece.type.cells.map((cell) => ({
            x: -cell.y,
            y: cell.x
        }));
        const rotatedPiece = {
            ...piece,
            type: {
                ...piece.type,
                cells: rotatedCells
            }
        };

        if (this.canPlaceTetrisPiece(rotatedPiece, rotatedPiece.x, rotatedPiece.y))
        {
            piece.type.cells = rotatedCells;
            this.playMiniGameSfx('move', 45);
            return;
        }

        const wallKickOffsets = [-1, 1, -2, 2];

        for (const offset of wallKickOffsets)
        {
            if (this.canPlaceTetrisPiece(rotatedPiece, rotatedPiece.x + offset, rotatedPiece.y))
            {
                piece.x += offset;
                piece.type.cells = rotatedCells;
                this.playMiniGameSfx('move', 45);
                return;
            }
        }
    }

    updateTetris (deltaSeconds)
    {
        const state = this.state.tetris;

        if (!state.piece)
        {
            return;
        }

        if (this.canTrigger('ARROWLEFT') || this.canTrigger('Q'))
        {
            this.tryMoveTetrisPiece(-1);
        }

        if (this.canTrigger('ARROWRIGHT') || this.canTrigger('D'))
        {
            this.tryMoveTetrisPiece(1);
        }

        if (this.canTrigger('ARROWUP') || this.canTrigger('ARROWDOWN') || this.canTrigger('Z') || this.canTrigger('S'))
        {
            this.rotateTetrisPieceClockwise();
        }

        if (this.canTrigger('SPACE'))
        {
            this.hardDropTetrisPiece();
            return;
        }

        state.dropTimer += deltaSeconds;

        if (state.dropTimer >= state.dropInterval)
        {
            state.dropTimer = 0;

            if (this.canPlaceTetrisPiece(state.piece, state.piece.x, state.piece.y + 1))
            {
                state.piece.y += 1;
            }
            else
            {
                this.lockTetrisPiece();
            }
        }
    }

    initPacman ()
    {
        const cols = 20;
        const rows = 11;
        const walls = new Set();

        // Labyrinthe Pacman classique compact
        const wallPatternMap = [
            "####################",
            "#....#........#....#",
            "#.##.#.######.#.##.#",
            "#.#..............#.#",
            "#.#.##.##  ##.##.#.#",
            "#......#    #......#",
            "#.#.##.######.##.#.#",
            "#.#..............#.#",
            "#.##.#.######.#.##.#",
            "#....#........#....#",
            "####################"
        ];


        for (let y = 0; y < rows; y++)
        {
            for (let x = 0; x < cols; x++)
            {
                if (wallPatternMap[y][x] === '#')
                {
                    walls.add(`${x},${y}`);
                }
            }
        }

        const pellets = new Set();
        const powerPellets = new Set();

        // Ajouter pellets et power-pellets
        for (let y = 1; y < rows - 1; y++)
        {
            for (let x = 1; x < cols - 1; x++)
            {
                if (!walls.has(`${x},${y}`))
                {
                    pellets.add(`${x},${y}`);
                }
            }
        }

        // Placer 2 power-pellets aux coins (bas-gauche et bas-droit pour le mode facile)
        powerPellets.add(`1,1`);
        powerPellets.add(`${cols - 2},${rows - 2}`);
        
        // Retirer les power-pellets des pellets normaux
        powerPellets.forEach((key) => pellets.delete(key));

        // Nombre d'ennemis selon la difficulte: 2 facile, 3 moyen/normal, 4 difficile
        const ghostCount = this.difficultyLevel === 'easy'
            ? 2
            : (this.difficultyLevel === 'hard' ? 4 : 3);
        const ghosts = [];
        const centerX = Math.floor(cols / 2);
        const centerY = Math.floor(rows / 2);

        const ghostSpawns = [
            { x: centerX - 1, y: centerY },
            { x: centerX + 1, y: centerY },
            { x: centerX - 1, y: centerY + 1 },
            { x: centerX + 1, y: centerY + 1 }
        ];

        for (let i = 0; i < ghostCount; i++)
        {
            const spawn = ghostSpawns[i] || ghostSpawns[0];
            ghosts.push({
                x: spawn.x,
                y: spawn.y,
                lastDir: { x: 1, y: 0 },
                vulnerable: false,
                originalSpawn: spawn
            });
        }

        this.state.pacman = {
            cols,
            rows,
            walls,
            pellets,
            powerPellets,
            player: { x: centerX, y: rows - 2 },
            playerSpawn: { x: centerX, y: rows - 2 },
            ghosts,
            moveTimer: 0,
            moveInterval: 0.20,
            ghostTimer: 0,
            ghostInterval: 0.25,
            direction: { x: 0, y: 0 },
            desiredDirection: { x: 0, y: 0 },
            vulnerableTimer: 0,
            vulnerableDuration: 8.0,
            vulnerableBlinkDuration: 2.0,
            vulnerableBlinkInterval: 0.16
        };
    }

    updatePacman (deltaSeconds)
    {
        const state = this.state.pacman;

        if (this.canTrigger('ARROWLEFT', 0.08) || this.canTrigger('Q', 0.08))
        {
            state.desiredDirection = { x: -1, y: 0 };
        }
        else if (this.canTrigger('ARROWRIGHT', 0.08) || this.canTrigger('D', 0.08))
        {
            state.desiredDirection = { x: 1, y: 0 };
        }
        else if (this.canTrigger('ARROWUP', 0.08) || this.canTrigger('Z', 0.08))
        {
            state.desiredDirection = { x: 0, y: -1 };
        }
        else if (this.canTrigger('ARROWDOWN', 0.08) || this.canTrigger('S', 0.08))
        {
            state.desiredDirection = { x: 0, y: 1 };
        }

        state.moveTimer += deltaSeconds;
        state.ghostTimer += deltaSeconds;

        // Gerer la vulnerabilite des ennemis
        if (state.ghosts.some((g) => g.vulnerable))
        {
            state.vulnerableTimer += deltaSeconds;

            if (state.vulnerableTimer >= state.vulnerableDuration)
            {
                state.vulnerableTimer = 0;
                state.ghosts.forEach((g) => { g.vulnerable = false; });
            }
        }

        if (state.moveTimer >= state.moveInterval)
        {
            state.moveTimer = 0;

            // Appliquer la direction souhaitee seulement si elle est praticable.
            const desiredNextX = state.player.x + state.desiredDirection.x;
            const desiredNextY = state.player.y + state.desiredDirection.y;

            if (
                (state.desiredDirection.x !== 0 || state.desiredDirection.y !== 0) &&
                !state.walls.has(`${desiredNextX},${desiredNextY}`)
            )
            {
                state.direction = { ...state.desiredDirection };
            }

            const nextX = state.player.x + state.direction.x;
            const nextY = state.player.y + state.direction.y;

            if (!state.walls.has(`${nextX},${nextY}`))
            {
                state.player.x = nextX;
                state.player.y = nextY;
            }

            const pelletKey = `${state.player.x},${state.player.y}`;

            // Manger une pellet normale
            if (state.pellets.has(pelletKey))
            {
                state.pellets.delete(pelletKey);
                this.addScore(50);
                this.playMiniGameSfx('pellet', 70);
            }

            // Manger un power-pellet (bonus)
            if (state.powerPellets.has(pelletKey))
            {
                state.powerPellets.delete(pelletKey);
                this.addScore(200);
                this.playMiniGameSfx('power');
                state.vulnerableTimer = 0;
                state.ghosts.forEach((g) => { g.vulnerable = true; });
            }
        }

        if (state.ghostTimer >= state.ghostInterval)
        {
            state.ghostTimer = 0;

            for (const ghost of state.ghosts)
            {
                const dirs = [
                    { x: 1, y: 0 },
                    { x: -1, y: 0 },
                    { x: 0, y: 1 },
                    { x: 0, y: -1 }
                ];

                // Interdiction stricte du demi-tour: on retire toujours la direction opposee.
                const oppositeX = -ghost.lastDir.x;
                const oppositeY = -ghost.lastDir.y;
                let candidateDirs = dirs.filter((d) => !(d.x === oppositeX && d.y === oppositeY));

                // Si aucun historique de direction (spawn), autoriser tout.
                if (ghost.lastDir.x === 0 && ghost.lastDir.y === 0)
                {
                    candidateDirs = [...dirs];
                }

                if (ghost.vulnerable)
                {
                    // Mode fuite: diriger loin du joueur
                    candidateDirs.sort((a, b) => {
                        const distA = Math.hypot(
                            (ghost.x + a.x) - state.player.x,
                            (ghost.y + a.y) - state.player.y
                        );
                        const distB = Math.hypot(
                            (ghost.x + b.x) - state.player.x,
                            (ghost.y + b.y) - state.player.y
                        );
                        return distB - distA;
                    });
                }
                else
                {
                    Phaser.Utils.Array.Shuffle(candidateDirs);
                }

                let moved = false;

                for (const dir of candidateDirs)
                {
                    const nx = ghost.x + dir.x;
                    const ny = ghost.y + dir.y;

                    if (!state.walls.has(`${nx},${ny}`))
                    {
                        ghost.x = nx;
                        ghost.y = ny;
                        ghost.lastDir = dir;
                        moved = true;
                        break;
                    }
                }

                // Exception: autoriser le demi-tour uniquement si le fantome est bloque.
                if (!moved)
                {
                    const backDir = { x: oppositeX, y: oppositeY };
                    const backX = ghost.x + backDir.x;
                    const backY = ghost.y + backDir.y;

                    if (!state.walls.has(`${backX},${backY}`))
                    {
                        ghost.x = backX;
                        ghost.y = backY;
                        ghost.lastDir = backDir;
                    }
                }
            }
        }

        // Verifier collision avec ennemis
        for (const ghost of state.ghosts)
        {
            if (ghost.x === state.player.x && ghost.y === state.player.y)
            {
                if (ghost.vulnerable)
                {
                    // Manger l'ennemi vulnerable
                    this.addScore(500);
                    this.playMiniGameSfx('ghost', 90);
                    ghost.x = ghost.originalSpawn.x;
                    ghost.y = ghost.originalSpawn.y;
                    ghost.lastDir = { x: 1, y: 0 };
                    ghost.vulnerable = false;
                }
                else
                {
                    // Ennemi normal: perte de vie
                    this.loseLife(-120, () => {
                        state.player.x = state.playerSpawn.x;
                        state.player.y = state.playerSpawn.y;
                        state.direction = { x: 0, y: 0 };
                        state.desiredDirection = { x: 0, y: 0 };
                    });
                    return;
                }
            }
        }

        // Victoire: toutes pellets mangees
        if (state.pellets.size === 0 && state.powerPellets.size === 0)
        {
            this.addScore(300);
            this.playMiniGameSfx('clear');
            this.initPacman();
        }
    }

    initArkanoid ()
    {
        const isNormal = this.difficultyLevel === 'normal' || this.difficultyLevel === 'medium';
        const isHard = this.difficultyLevel === 'hard';
        const paddleHalfWidth = isHard ? 50 : (isNormal ? 54 : 58);
        const ballSpeedScale = isHard ? 1.14 : 1;

        const bricks = [];

        for (let row = 0; row < 4; row++)
        {
            for (let col = 0; col < 10; col++)
            {
                bricks.push({ x: 52 + col * 58, y: 46 + row * 26, alive: true });
            }
        }

        this.state.arkanoid = {
            paddleX: this.arenaWidth * 0.5,
            paddleHalfWidth,
            ballSpeedScale,
            ball: {
                x: this.arenaWidth * 0.5,
                y: this.arenaHeight - 70,
                vx: 220 * ballSpeedScale,
                vy: -240 * ballSpeedScale
            },
            bricks
        };
    }

    updateArkanoid (deltaSeconds)
    {
        const state = this.state.arkanoid;

        if (this.isDown('ARROWLEFT', 'Q'))
        {
            state.paddleX -= 430 * deltaSeconds;
        }

        if (this.isDown('ARROWRIGHT', 'D'))
        {
            state.paddleX += 430 * deltaSeconds;
        }

        state.paddleX = Phaser.Math.Clamp(state.paddleX, state.paddleHalfWidth + 2, this.arenaWidth - state.paddleHalfWidth - 2);

        state.ball.x += state.ball.vx * deltaSeconds;
        state.ball.y += state.ball.vy * deltaSeconds;

        if (state.ball.x < 8 || state.ball.x > this.arenaWidth - 8)
        {
            state.ball.vx *= -1;
            this.playMiniGameSfx('bounce', 45);
        }

        if (state.ball.y < 8)
        {
            state.ball.vy *= -1;
            this.playMiniGameSfx('bounce', 45);
        }

        if (state.ball.y > this.arenaHeight + 24)
        {
            this.loseLife(-150, () => {
                state.ball.x = state.paddleX;
                state.ball.y = this.arenaHeight - 70;
                state.ball.vx = Phaser.Math.Between(-250, 250) * state.ballSpeedScale;
                state.ball.vy = -240 * state.ballSpeedScale;
            });
            return;
        }

        if (Math.abs(state.ball.y - (this.arenaHeight - 26)) < 10 && Math.abs(state.ball.x - state.paddleX) < (state.paddleHalfWidth + 4))
        {
            state.ball.vy = -Math.abs(state.ball.vy);
            state.ball.vx += (state.ball.x - state.paddleX) * 2.4;
            this.playMiniGameSfx('bounce', 45);
        }

        for (const brick of state.bricks)
        {
            if (!brick.alive)
            {
                continue;
            }

            if (Math.abs(state.ball.x - brick.x) < 26 && Math.abs(state.ball.y - brick.y) < 12)
            {
                brick.alive = false;
                state.ball.vy *= -1;
                this.addScore(80);
                this.playMiniGameSfx('brick', 45);
                break;
            }
        }

        if (state.bricks.every((brick) => !brick.alive))
        {
            this.addScore(500);
            this.playMiniGameSfx('clear');
            this.initArkanoid();
        }
    }

    initPinball ()
    {
        const H = this.arenaHeight;
        const isNormal = this.difficultyLevel === 'normal' || this.difficultyLevel === 'medium';
        const isHard = this.difficultyLevel === 'hard';
        const flipperGapDelta = isHard ? 8 : (isNormal ? 4 : 0);

        const pfLeft    = 28;
        const pfRight   = 598;
        const pfTop     = 16;
        const pfBot     = H - 12;
        const laneLeft  = 610;
        const laneRight = 658;
        const laneMid   = (laneLeft + laneRight) * 0.5;
        const archY0    = 68;

        const FLEFT_PIV_X  = 220 - flipperGapDelta;
        const FRIGHT_PIV_X = 406 + flipperGapDelta;
        const FLIP_PIV_Y   = H - 44;
        const FLIP_LEN     = 88;
        const LF_REST      =  0.42;
        const LF_ACTIVE    = -0.52;
        const RF_REST      = Math.PI - 0.42;
        const RF_ACTIVE    = Math.PI + 0.52;

        const bumpers = [
            { x: 200, y: 110, r: 20, score: 160, glow: 0, color: 0x6cf5ff },
            { x: 313, y:  78, r: 24, score: 300, glow: 0, color: 0xffd166 },
            { x: 426, y: 110, r: 20, score: 160, glow: 0, color: 0xff6a6a },
            { x: 248, y: 210, r: 17, score: 120, glow: 0, color: 0x9cff8d },
            { x: 378, y: 210, r: 17, score: 120, glow: 0, color: 0xb388ff }
        ];

        // laneLeft wall is ONE-WAY:
        //   ball from lane (right side, nx>0) -> NOT blocked, enters playfield freely
        //   ball from playfield (left side, nx<0) -> BLOCKED, cannot re-enter lane
        const walls = [
            { x1: pfLeft,    y1: archY0,  x2: 64,        y2: 42,       r: 0.46 },
            { x1: 64,        y1: 42,      x2: 140,       y2: 24,       r: 0.46 },
            { x1: 140,       y1: 24,      x2: 340,       y2: 16,       r: 0.48 },
            { x1: 340,       y1: 16,      x2: 510,       y2: 24,       r: 0.48 },
            { x1: 510,       y1: 24,      x2: laneLeft,  y2: archY0,   r: 0.46 },
            { x1: pfLeft,    y1: archY0,  x2: pfLeft,    y2: H - 108,  r: 0.46 },
            { x1: laneLeft,  y1: pfTop,   x2: laneLeft,  y2: H - 108,  r: 0.46, oneWay: true },
            { x1: laneRight, y1: pfTop,   x2: laneRight, y2: pfBot,    r: 0.46 },
            { x1: pfLeft,    y1: H - 108, x2: FLEFT_PIV_X - 10,  y2: FLIP_PIV_Y - 8, r: 0.36, isSling: true },
            { x1: laneLeft,  y1: H - 108, x2: FRIGHT_PIV_X + 10, y2: FLIP_PIV_Y - 8, r: 0.36, isSling: true },
        ];

        this.state.pinball = {
            gravity:  620,
            maxSpeed: 920,
            friction: 0.9992,
            pfLeft, pfRight, pfTop, pfBot,
            laneLeft, laneRight, laneMid,
            archY0,
            bumpers,
            walls,
            leftFlipper:  { pivotX: FLEFT_PIV_X,  pivotY: FLIP_PIV_Y, length: FLIP_LEN, restAngle: LF_REST,  activeAngle: LF_ACTIVE, angle: LF_REST,  angularVel: 0 },
            rightFlipper: { pivotX: FRIGHT_PIV_X, pivotY: FLIP_PIV_Y, length: FLIP_LEN, restAngle: RF_REST,  activeAngle: RF_ACTIVE, angle: RF_REST,  angularVel: 0 },
            flare: 0,
            launcher: { phase: 'idle', charge: 0, prevDown: false },
            tilt: { strikes: 0, strikeTimer: 0, lastSpaceDown: false, active: false },
            ball: { x: laneMid, y: pfBot - 12, vx: 0, vy: 0, r: 8, trail: [] }
        };
    }

    updatePinball (deltaSeconds)
    {
        const state = this.state.pinball;
        const ball  = state.ball;
        const lch   = state.launcher;

        // ── Decay effets visuels ──────────────────────────────────────────────
        for (const bumper of state.bumpers)
        {
            bumper.glow = Math.max(0, bumper.glow - deltaSeconds * 2.8);
        }

        state.flare = Math.max(0, state.flare - deltaSeconds * 2.2);

        // ── Flippers ─────────────────────────────────────────────────────────
        const leftActive  = !state.tilt.active && this.isDown('ARROWLEFT', 'Q', 'SHIFTLEFT');
        const rightActive = !state.tilt.active && this.isDown('ARROWRIGHT', 'D', 'SHIFTRIGHT');

        // ── Lanceur FSM ───────────────────────────────────────────────────────
        const launcherDown = this.isDown('ARROWDOWN', 'S');
        const spaceDown = this.isDown('SPACE');

        if (!state.tilt.active)
        {
            if (state.tilt.strikeTimer > 0)
            {
                state.tilt.strikeTimer = Math.max(0, state.tilt.strikeTimer - deltaSeconds);
                if (state.tilt.strikeTimer === 0)
                {
                    state.tilt.strikes = 0;
                }
            }

            if (spaceDown && !state.tilt.lastSpaceDown)
            {
                state.tilt.strikes += 1;
                state.tilt.strikeTimer = 1.35;

                // Nudge: small kick that simulates hitting the cabinet.
                if (lch.phase === 'launched')
                {
                    ball.vx += Phaser.Math.Between(-120, 120);
                    ball.vy -= Phaser.Math.Between(40, 90);
                }

                if (state.tilt.strikes >= 3)
                {
                    state.tilt.active = true;
                    state.tilt.strikes = 0;
                    state.tilt.strikeTimer = 0;
                    this.scene?.setNotice?.('TILT! Flippers bloques jusqu a la fin de la bille.');
                }
            }
        }

        state.tilt.lastSpaceDown = spaceDown;

        if (lch.phase === 'idle' || lch.phase === 'charging')
        {
            // Balle figée dans le couloir pendant idle/charging
            ball.x  = state.laneMid;
            ball.y  = state.pfBot - 12;
            ball.vx = 0;
            ball.vy = 0;
            ball.trail.length = 0;

            if (launcherDown)
            {
                lch.phase  = 'charging';
                lch.charge = Math.min(1, lch.charge + deltaSeconds * 1.6);

                // Auto-lancement à charge max
                if (lch.charge >= 1)
                {
                    this.pinballLaunch(state, ball, 1);
                }
            }
            else if (!launcherDown && lch.prevDown && lch.charge > 0.05)
            {
                // Relâchement: lancement avec la charge accumulée
                this.pinballLaunch(state, ball, lch.charge);
            }
            else if (!launcherDown)
            {
                lch.phase  = 'idle';
                lch.charge = 0;
            }

            lch.prevDown = launcherDown;
            return; // Pas de physique tant que la balle est dans le lanceur
        }

        lch.prevDown = launcherDown;

        // ── Physique balle en jeu (sous-steps anti-tunneling) ────────────────
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const travel = speed * deltaSeconds;
        const maxTravelPerStep = Math.max(3, ball.r * 0.75);
        // Quand un flipper bouge, on force plus de substeps pour eviter le tunneling
        const flipperMoving = leftActive || rightActive;
        const minSteps = flipperMoving ? 12 : 2;
        const steps = Phaser.Math.Clamp(Math.ceil(travel / maxTravelPerStep), minSteps, 16);
        const stepDt = deltaSeconds / steps;

        for (let step = 0; step < steps; step++)
        {
            // Avancer les flippers a l'interieur du substep pour eviter le tunneling
            // FLIP_SPEED reduit a 9 rad/s pour que le deplacement de la pointe par substep
            // reste inferieur au rayon de la balle (9 * dt_sub * 88 < 8 px)
            const FLIP_SPEED = 9;
            this.pinballUpdateFlipper(state.leftFlipper,  leftActive,  FLIP_SPEED, stepDt);
            this.pinballUpdateFlipper(state.rightFlipper, rightActive, FLIP_SPEED, stepDt);

            ball.vy += state.gravity * stepDt;
            ball.vx *= Math.pow(state.friction, stepDt * 60);

            ball.x += ball.vx * stepDt;
            ball.y += ball.vy * stepDt;

            // Collisions parois
            for (const wall of state.walls)
            {
                const vyBefore = ball.vy;
                const hit = this.pinballSegmentCollide(ball, wall.x1, wall.y1, wall.x2, wall.y2, wall.r ?? 0.92, wall.oneWay);

                if (hit && wall.isSling && vyBefore > 0)
                {
                    // Bords roses: legere acceleration tangentielle seulement quand la bille descend
                    const tx = -(wall.y2 - wall.y1);
                    const ty =  (wall.x2 - wall.x1);
                    const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
                    const vDotT = (ball.vx * tx + ball.vy * ty) / tlen;
                    const boost = 18 * Math.sign(vDotT || 1);
                    ball.vx += (tx / tlen) * boost;
                    ball.vy += (ty / tlen) * boost;
                    this.addScore(8);
                    this.playMiniGameSfx('bounce', 45);
                }
            }

            // Aide de transfert: au sommet du couloir, force l'entree sur le plateau.
            if (ball.y <= state.archY0 + 10 && ball.x > state.laneLeft - 2)
            {
                ball.x = state.laneLeft - ball.r - 0.8;
                ball.vx = -Math.max(120, Math.abs(ball.vx) + 80);
            }

            // Collisions flippers
            this.pinballFlipperCollide(state.leftFlipper,  ball, leftActive,  1,  stepDt);
            this.pinballFlipperCollide(state.rightFlipper, ball, rightActive, -1, stepDt);

            // Collisions bumpers
            for (const bumper of state.bumpers)
            {
                const dx  = ball.x - bumper.x;
                const dy  = ball.y - bumper.y;
                const min = bumper.r + ball.r;

                if (dx * dx + dy * dy >= min * min)
                {
                    continue;
                }

                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const nx   = dx / dist;
                const ny   = dy / dist;
                const bumperSpeed = Math.max(260, Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * 1.1 + 80);

                ball.x  = bumper.x + nx * (min + 0.5);
                ball.y  = bumper.y + ny * (min + 0.5);
                ball.vx = nx * bumperSpeed;
                ball.vy = ny * bumperSpeed;
                bumper.glow  = 1;
                state.flare  = 1;
                this.addScore(bumper.score);
                this.playMiniGameSfx('bumper', 60);
            }

            // Vitesse max
            const stepSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (stepSpeed > state.maxSpeed)
            {
                ball.vx = ball.vx / stepSpeed * state.maxSpeed;
                ball.vy = ball.vy / stepSpeed * state.maxSpeed;
            }

            // Rebond plafond
            if (ball.y - ball.r < state.pfTop)
            {
                ball.y  = state.pfTop + ball.r;
                ball.vy = Math.abs(ball.vy) * 0.88;
            }

            // Drain: balle perdue
            if (ball.y > state.pfBot + ball.r + 10)
            {
                this.loseLife(-90, () => {
                    lch.phase  = 'idle';
                    lch.charge = 0;
                    ball.trail.length = 0;
                });
                return;
            }
        }

        // Trail
        ball.trail.push({ x: ball.x, y: ball.y, a: 0.6 });

        if (ball.trail.length > 14)
        {
            ball.trail.shift();
        }

        for (const pt of ball.trail)
        {
            pt.a *= 0.88;
        }

    }

    // Lance la balle hors du couloir avec la charge donnée [0..1]
    pinballLaunch (state, ball, charge)
    {
        const lch   = state.launcher;
        // Vitesse verticale: 320 (faible) -> 900 (max)
        // Petite derive gauche pour entrer plus facilement sur le plateau.
        const power = 320 + 580 * charge;
        ball.vx = -(30 + 90 * charge);
        ball.vy = -power;
        lch.phase  = 'launched';
        lch.charge = 0;
        state.flare = Math.max(state.flare, charge * 0.9);
        this.playMiniGameSfx('launch');
    }

    // Avance l'angle d'un flipper et mesure la vitesse angulaire reelle
    pinballUpdateFlipper (flipper, active, speed, dt)
    {
        const prevAngle = flipper.angle;
        const target    = active ? flipper.activeAngle : flipper.restAngle;
        const diff      = Phaser.Math.Angle.Wrap(target - flipper.angle);
        const step      = speed * dt;

        if (Math.abs(diff) <= step)
        {
            flipper.angle = target;
        }
        else
        {
            flipper.angle += Math.sign(diff) * step;
        }

        // Vitesse angulaire reelle (rad/s) — detecte si le flipper est vraiment en mouvement
        flipper.angularVel = dt > 0 ? Phaser.Math.Angle.Wrap(flipper.angle - prevAngle) / dt : 0;
    }

    // Retourne le segment tip du flipper (pivot → tip)
    pinballFlipperSeg (flipper)
    {
        return {
            x1: flipper.pivotX,
            y1: flipper.pivotY,
            x2: flipper.pivotX + Math.cos(flipper.angle) * flipper.length,
            y2: flipper.pivotY + Math.sin(flipper.angle) * flipper.length
        };
    }

    // Collision balle/flipper.
    // Le flipper est toujours collisionnel (comme un mur).
    // Boost supplementaire seulement si le flipper est reellement en mouvement (angularVel eleve).
    pinballFlipperCollide (flipper, ball, active, sideSign, dt)
    {
        const seg = this.pinballFlipperSeg(flipper);

        // Pushout plus agressif pour les flippers pour eviter le tunneling
        const hit = this.pinballSegmentCollide(ball, seg.x1, seg.y1, seg.x2, seg.y2, 0.55);

        if (!hit)
        {
            return;
        }

        // Le flipper est-il vraiment en train de se deplacer ?
        // On utilise la vitesse angulaire reelle trackee dans pinballUpdateFlipper.
        const MOVING_THRESHOLD = 0.8; // rad/s
        const isMoving = Math.abs(flipper.angularVel ?? 0) > MOVING_THRESHOLD;

        if (!isMoving)
        {
            // Flipper statique (en position haute ou basse) -> rebond standard, pas de boost
            return;
        }

        // Le boost ne doit exister qu'en montee (basse -> haute).
        // En descente (haute -> basse), le flipper reste passif comme un mur.
        const isUpwardStroke = sideSign > 0
            ? (flipper.angularVel ?? 0) < 0
            : (flipper.angularVel ?? 0) > 0;

        if (!isUpwardStroke)
        {
            return;
        }

        // Flipper en mouvement: impulsion progressive selon le point de contact.
        // Plus la bille touche vers la pointe, plus le boost est fort.
        const segDx = seg.x2 - seg.x1;
        const segDy = seg.y2 - seg.y1;
        const segLenSq = segDx * segDx + segDy * segDy;
        const contactT = segLenSq > 0
            ? Phaser.Math.Clamp(((ball.x - seg.x1) * segDx + (ball.y - seg.y1) * segDy) / segLenSq, 0, 1)
            : 0;
        const contactPower = Phaser.Math.Easing.Quadratic.In(0.35 + contactT * 0.65);

        // Flipper en mouvement: impulsion proportionnelle a la vitesse angulaire
        const angVel = flipper.angularVel;
        const tipBoost = Math.abs(angVel) * flipper.length * (0.35 + 0.85 * contactPower);
        ball.vy -= tipBoost;
        ball.vx += sideSign * tipBoost * (0.45 + 0.35 * contactPower);

        // Normaliser pour eviter une vitesse excessive
        const postSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const FLIPPER_MAX_SPEED = 920;
        if (postSpeed > FLIPPER_MAX_SPEED)
        {
            ball.vx = ball.vx / postSpeed * FLIPPER_MAX_SPEED;
            ball.vy = ball.vy / postSpeed * FLIPPER_MAX_SPEED;
        }

        this.addScore(20);
        this.playMiniGameSfx('bumper', 45);
    }

    // Collision balle/segment: deplace la balle hors du segment et reflechit la vitesse.
    // oneWay: si true, la collision est ignoree quand la balle vient du cote droit (nx > 0).
    pinballSegmentCollide (ball, x1, y1, x2, y2, restitution, oneWay = false)
    {
        const sx   = x2 - x1;
        const sy   = y2 - y1;
        const lenSq = sx * sx + sy * sy;

        if (lenSq < 0.0001)
        {
            return false;
        }

        const t  = Math.max(0, Math.min(1, ((ball.x - x1) * sx + (ball.y - y1) * sy) / lenSq));
        const cx = x1 + sx * t;
        const cy = y1 + sy * t;
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        const d2 = dx * dx + dy * dy;

        if (d2 >= ball.r * ball.r)
        {
            return false;
        }

        const d  = Math.sqrt(d2) || 0.001;
        const nx = dx / d;
        const ny = dy / d;
        const pen = ball.r - d;

        if (oneWay && nx > 0)
        {
            return false;
        }

        ball.x += nx * (pen + 0.3);
        ball.y += ny * (pen + 0.3);

        const vDotN = ball.vx * nx + ball.vy * ny;

        if (vDotN < 0)
        {
            ball.vx -= (1 + restitution) * vDotN * nx;
            ball.vy -= (1 + restitution) * vDotN * ny;
        }

        return true;
    }

    render ()
    {
        const remaining = Math.max(0, this.duration - this.elapsed);
        const attemptsLabel = this.maxAttempts > 1
            ? `   Essais: ${this.maxAttempts - this.remainingAttempts + 1}/${this.maxAttempts}`
            : '';
        this.hudText.setText(`Score: ${this.score}   Cible: ${this.targetScore}   Vies: ${this.lives}   Temps: ${remaining.toFixed(1)}s${attemptsLabel}`);
        this.tetrisNextLabel.setVisible(false);

        // Pendant le mini-jeu, masquer titre/introduction/objectif: le HUD cible suffit.
        this.titleText.setVisible(false);
        this.subtitleText.setVisible(false);
        this.targetText.setVisible(false);

        this.graphics.clear();
        this.graphics.lineStyle(2, 0x4ddcff, 0.5);
        this.graphics.strokeRect(this.originX, this.originY, this.arenaWidth, this.arenaHeight);

        switch (this.gameDef.id)
        {
            case 'space-invaders':
                this.renderSpaceInvaders();
                break;
            case 'tetris':
                this.renderTetris();
                break;
            case 'pacman':
                this.renderPacman();
                break;
            case 'arkanoid':
                this.renderArkanoid();
                break;
            case 'pinball':
                this.renderPinball();
                break;
            default:
                break;
        }
    }

    renderSpaceInvaders ()
    {
        const state = this.state.spaceInvaders;

        this.graphics.fillStyle(0x8de9ff, 1);
        this.graphics.fillTriangle(
            this.originX + state.playerX,
            this.originY + this.arenaHeight - 20,
            this.originX + state.playerX - 12,
            this.originY + this.arenaHeight - 2,
            this.originX + state.playerX + 12,
            this.originY + this.arenaHeight - 2
        );

        this.graphics.fillStyle(0xffd166, 1);
        for (const shot of state.shots)
        {
            this.graphics.fillRect(this.originX + shot.x - 2, this.originY + shot.y - 8, 4, 10);
        }

        this.graphics.fillStyle(0xff8f8f, 1);
        for (const shot of state.enemyShots)
        {
            this.graphics.fillRect(this.originX + shot.x - 2, this.originY + shot.y - 2, 4, 10);
        }

        for (const shield of state.shields)
        {
            for (let row = 0; row < shield.cells.length; row++)
            {
                for (let col = 0; col < shield.cells[row].length; col++)
                {
                    const hp = shield.cells[row][col];

                    if (hp <= 0)
                    {
                        continue;
                    }

                    const color = hp >= 3 ? 0x74f6aa : (hp === 2 ? 0x52bf84 : 0x2f6e53);
                    this.graphics.fillStyle(color, 0.92);
                    this.graphics.fillRect(
                        this.originX + shield.x + col * state.shieldCellSize,
                        this.originY + shield.y + row * state.shieldCellSize,
                        state.shieldCellSize,
                        state.shieldCellSize
                    );
                }
            }
        }

        for (const fx of state.shieldImpactFx)
        {
            const t = Phaser.Math.Clamp(fx.ttl / fx.maxTtl, 0, 1);
            const radius = fx.r + (1 - t) * 8;
            this.graphics.lineStyle(2, 0xfff2b3, t * 0.9);
            this.graphics.strokeCircle(this.originX + fx.x, this.originY + fx.y, radius);
        }

        this.graphics.fillStyle(0xff6a6a, 1);
        for (const enemy of state.enemies)
        {
            if (enemy.alive)
            {
                this.graphics.fillRect(this.originX + enemy.x - 14, this.originY + enemy.y - 10, 28, 20);
            }
        }
    }

    renderTetris ()
    {
        const state = this.state.tetris;
        const cellSize = 24;
        const gridX = this.originX + (this.arenaWidth * 0.5 - (state.cols * cellSize * 0.5));
        const gridY = this.originY + 16;

        this.graphics.lineStyle(1, 0x2f5b7b, 0.65);
        this.graphics.strokeRect(gridX, gridY, state.cols * cellSize, state.rows * cellSize);

        for (let row = 0; row < state.rows; row++)
        {
            for (let col = 0; col < state.cols; col++)
            {
                if (state.grid[row][col] !== 0)
                {
                    this.graphics.fillStyle(state.grid[row][col], 0.95);
                    this.graphics.fillRect(gridX + col * cellSize + 1, gridY + row * cellSize + 1, cellSize - 2, cellSize - 2);
                }
            }
        }

        if (state.piece)
        {
            this.graphics.fillStyle(state.piece.type.color, 0.95);

            for (const cell of this.getTetrisPieceCells(state.piece))
            {
                if (cell.y < 0)
                {
                    continue;
                }

                this.graphics.fillRect(
                    gridX + cell.x * cellSize + 1,
                    gridY + cell.y * cellSize + 1,
                    cellSize - 2,
                    cellSize - 2
                );
            }
        }

        if (state.canShowNextPiece && state.nextType)
        {
            const previewX = gridX + state.cols * cellSize + 28;
            const previewY = gridY + 20;

            this.graphics.lineStyle(1, 0x2f5b7b, 0.65);
            this.graphics.strokeRect(previewX - 8, previewY - 10, 132, 116);
            this.tetrisNextLabel.setPosition(previewX + 58, previewY - 24).setVisible(true);

            this.graphics.fillStyle(state.nextType.color, 0.95);

            for (const cell of state.nextType.cells)
            {
                this.graphics.fillRect(
                    previewX + (cell.x + 1.5) * 20,
                    previewY + (cell.y + 1.5) * 20,
                    18,
                    18
                );
            }
        }
    }

    renderPacman ()
    {
        const state = this.state.pacman;
        const tile = 30;
        const offsetX = this.originX + 70;
        const offsetY = this.originY + 28;

        this.graphics.fillStyle(0x0d1f33, 0.9);
        this.graphics.fillRect(offsetX, offsetY, state.cols * tile, state.rows * tile);

        for (const wall of state.walls)
        {
            const [x, y] = wall.split(',').map(Number);
            this.graphics.fillStyle(0x1e4b6b, 0.95);
            this.graphics.fillRect(offsetX + x * tile, offsetY + y * tile, tile, tile);
        }

        this.graphics.fillStyle(0xfff5c2, 1);
        for (const pellet of state.pellets)
        {
            const [x, y] = pellet.split(',').map(Number);
            this.graphics.fillCircle(offsetX + x * tile + tile * 0.5, offsetY + y * tile + tile * 0.5, 3);
        }

        this.graphics.fillStyle(0xff9900, 1);
        for (const powerPellet of state.powerPellets)
        {
            const [x, y] = powerPellet.split(',').map(Number);
            this.graphics.fillCircle(offsetX + x * tile + tile * 0.5, offsetY + y * tile + tile * 0.5, 8);
        }

        this.graphics.fillStyle(0xffcb6d, 1);
        this.graphics.fillCircle(offsetX + state.player.x * tile + tile * 0.5, offsetY + state.player.y * tile + tile * 0.5, tile * 0.38);

        for (const ghost of state.ghosts)
        {
            if (ghost.vulnerable)
            {
                const vulnerableRemaining = Math.max(0, state.vulnerableDuration - state.vulnerableTimer);
                const shouldBlink = vulnerableRemaining <= state.vulnerableBlinkDuration;
                const blinkIsBlue = Math.floor(this.elapsed / state.vulnerableBlinkInterval) % 2 === 0;
                const ghostColor = shouldBlink
                    ? (blinkIsBlue ? 0x3366ff : 0xff6a6a)
                    : 0x3366ff;

                this.graphics.fillStyle(ghostColor, 1);
            }
            else
            {
                this.graphics.fillStyle(0xff6a6a, 1);
            }
            this.graphics.fillCircle(offsetX + ghost.x * tile + tile * 0.5, offsetY + ghost.y * tile + tile * 0.5, tile * 0.34);
        }
    }

    renderArkanoid ()
    {
        const state = this.state.arkanoid;

        this.graphics.fillStyle(0x6cff98, 0.95);
        this.graphics.fillRect(
            this.originX + state.paddleX - state.paddleHalfWidth,
            this.originY + this.arenaHeight - 30,
            state.paddleHalfWidth * 2,
            12
        );

        this.graphics.fillStyle(0xffcb6d, 1);
        this.graphics.fillCircle(this.originX + state.ball.x, this.originY + state.ball.y, 8);

        for (const brick of state.bricks)
        {
            if (!brick.alive)
            {
                continue;
            }

            this.graphics.fillStyle(0x79f2ff, 0.95);
            this.graphics.fillRect(this.originX + brick.x - 24, this.originY + brick.y - 10, 48, 20);
        }
    }

    renderPinball ()
    {
        const state = this.state.pinball;
        const ox    = this.originX;
        const oy    = this.originY;
        const lch   = state.launcher;

        this.graphics.fillStyle(0x071528, 1);
        this.graphics.fillRect(ox + 6, oy + 6, this.arenaWidth - 12, this.arenaHeight - 12);

        this.graphics.fillStyle(0x0b223a, 0.98);
        this.graphics.fillRect(ox + 22, oy + 18, this.arenaWidth - 102, this.arenaHeight - 34);

        this.graphics.fillStyle(0x132c46, 0.95);
        this.graphics.fillRect(
            ox + state.laneLeft,
            oy + state.pfTop,
            state.laneRight - state.laneLeft,
            state.pfBot - state.pfTop
        );

        // ── Flare de flash ───────────────────────────────────────────────────
        if (state.flare > 0)
        {
            this.graphics.fillStyle(0x8be9ff, state.flare * 0.18);
            this.graphics.fillRect(
                ox + state.pfLeft, oy + state.pfTop,
                state.pfRight - state.pfLeft, state.pfBot - state.pfTop
            );
        }

        // ── Parois ───────────────────────────────────────────────────────────
        for (const wall of state.walls)
        {
            const isTopHatSegment = !wall.isSling && wall.y1 <= state.archY0 + 2 && wall.y2 <= state.archY0 + 2;

            if (isTopHatSegment)
            {
                continue;
            }

            const c = wall.isSling ? 0xff8fd8 : 0x7ce8ff;
            const a = wall.isSling ? 0.88 : 0.55;
            const w = wall.isSling ? 2 : 3;
            this.graphics.lineStyle(w, c, a);
            this.graphics.strokeLineShape(
                new Phaser.Geom.Line(ox + wall.x1, oy + wall.y1, ox + wall.x2, oy + wall.y2)
            );
        }

        // Chapeau visuel unique au-dessus du plateau + tube
        const topHatPoints = [
            { x: state.pfLeft, y: state.archY0 },
            { x: 64, y: 42 },
            { x: 140, y: 24 },
            { x: 340, y: 16 },
            { x: 510, y: 24 },
            { x: state.laneLeft, y: state.archY0 },
            { x: state.laneRight, y: state.archY0 + 6 }
        ];

        this.graphics.lineStyle(4, 0x7ce8ff, 0.72);
        for (let i = 0; i < topHatPoints.length - 1; i++)
        {
            const p0 = topHatPoints[i];
            const p1 = topHatPoints[i + 1];
            this.graphics.strokeLineShape(new Phaser.Geom.Line(
                ox + p0.x,
                oy + p0.y,
                ox + p1.x,
                oy + p1.y
            ));
        }

        // ── Bumpers ──────────────────────────────────────────────────────────
        for (const bumper of state.bumpers)
        {
            const gAlpha = 0.40 + bumper.glow * 0.60;
            this.graphics.fillStyle(bumper.color, gAlpha * 0.88);
            this.graphics.fillCircle(ox + bumper.x, oy + bumper.y, bumper.r + bumper.glow * 6);
            this.graphics.lineStyle(2, 0xf7fbff, 0.80 + bumper.glow * 0.20);
            this.graphics.strokeCircle(ox + bumper.x, oy + bumper.y, bumper.r + 2 + bumper.glow * 4);
        }

        // ── Flippers ─────────────────────────────────────────────────────────
        this.graphics.lineStyle(10, 0x6cff98, 0.95);

        const lfSeg = this.pinballFlipperSeg(state.leftFlipper);
        const rfSeg = this.pinballFlipperSeg(state.rightFlipper);

        this.graphics.strokeLineShape(new Phaser.Geom.Line(
            ox + lfSeg.x1, oy + lfSeg.y1, ox + lfSeg.x2, oy + lfSeg.y2
        ));
        this.graphics.strokeLineShape(new Phaser.Geom.Line(
            ox + rfSeg.x1, oy + rfSeg.y1, ox + rfSeg.x2, oy + rfSeg.y2
        ));

        this.graphics.fillStyle(0x9ef7ff, 0.9);
        this.graphics.fillCircle(ox + state.leftFlipper.pivotX,  oy + state.leftFlipper.pivotY,  6);
        this.graphics.fillCircle(ox + state.rightFlipper.pivotX, oy + state.rightFlipper.pivotY, 6);

        // ── Lanceur ──────────────────────────────────────────────────────────
        if (lch.phase === 'idle' || lch.phase === 'charging')
        {
            const barH   = (state.pfBot - state.pfTop - 20) * lch.charge;
            const barAlpha = 0.25 + lch.charge * 0.75;
            const barColor = lch.charge > 0.8 ? 0xff6a6a : (lch.charge > 0.4 ? 0xffd166 : 0x6cff98);

            this.graphics.fillStyle(barColor, barAlpha);
            this.graphics.fillRect(
                ox + state.laneLeft + 8,
                oy + state.pfBot - 10 - barH,
                (state.laneRight - state.laneLeft) - 16,
                barH
            );

            this.graphics.lineStyle(1, barColor, barAlpha * 0.7);
            this.graphics.strokeRect(
                ox + state.laneLeft + 8,
                oy + state.pfTop + 8,
                (state.laneRight - state.laneLeft) - 16,
                state.pfBot - state.pfTop - 16
            );
        }

        // ── Trail ────────────────────────────────────────────────────────────
        for (const pt of state.ball.trail)
        {
            this.graphics.fillStyle(0xfff7df, pt.a * 0.50);
            this.graphics.fillCircle(ox + pt.x, oy + pt.y, 4);
        }

        // ── Balle ─────────────────────────────────────────────────────────────
        const ball = state.ball;
        this.graphics.fillStyle(0xfef4da, 1);
        this.graphics.fillCircle(ox + ball.x, oy + ball.y, ball.r);
        this.graphics.lineStyle(1, 0xffffff, 0.85);
        this.graphics.strokeCircle(ox + ball.x, oy + ball.y, ball.r + 1);
    }
}
