import * as Phaser from 'phaser';

export class ArcadeEnemy extends Phaser.GameObjects.Triangle
{
    constructor (scene, x, y, waveConfig)
    {
        const geometry = ArcadeEnemy.getGeometryForType(waveConfig.type);

        super(scene, x, y, ...geometry.points, geometry.fillColor);

        this.setStrokeStyle(2, geometry.strokeColor, 0.95);
        this.setOrigin(0.5, 0.5);

        this.label = waveConfig.label;
        this.type = waveConfig.type;
        this.points = waveConfig.scoreValue;
        this.baseY = y;
        this.amplitude = Phaser.Math.Between(waveConfig.amplitudeMin, waveConfig.amplitudeMax);
        this.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
        this.phaseSpeed = Phaser.Math.FloatBetween(waveConfig.phaseSpeedMin, waveConfig.phaseSpeedMax);
        this.speed = Phaser.Math.Between(waveConfig.speedMin, waveConfig.speedMax);
        this.wraps = 0;
        this.wrapShift = waveConfig.wrapShift;
        this.verticalDrift = Phaser.Math.FloatBetween(-1, 1);
        this.rotationSpeed = Phaser.Math.FloatBetween(0.8, 1.5);
        this.movement = waveConfig.movement;
        this.direction = waveConfig.type === 'saucer' ? 1 : -1;
    }

    static getGeometryForType (type)
    {
        if (type === 'ltf')
        {
            return {
                points: [2, 14, 32, 2, 24, 24],
                fillColor: 0xffd966,
                strokeColor: 0xfffacc
            };
        }

        if (type === 'saucer')
        {
            return {
                points: [6, 20, 24, 2, 44, 20],
                fillColor: 0xf59a23,
                strokeColor: 0xffc966
            };
        }

        if (type === 'satellite')
        {
            return {
                points: [10, 0, 18, 8, 10, 16, 2, 8],
                fillColor: 0xdd00ff,
                strokeColor: 0xff66ff
            };
        }

        return {
            points: [2, 10, 30, 2, 30, 22],
            fillColor: 0xff7b7b,
            strokeColor: 0xffe0e0
        };
    }

    step (deltaSeconds, playerSpeed)
    {
        this.phase += deltaSeconds * this.phaseSpeed;

        if (this.direction === 1)
        {
            // Saucer: spawns left, overtakes player from behind
            this.x += (this.speed - playerSpeed * 0.58) * deltaSeconds;
            this.y = this.baseY + Math.sin(this.phase) * this.amplitude;
            this.rotation = -0.12;
            return;
        }

        this.x -= ((playerSpeed * 0.58) + this.speed) * deltaSeconds;

        if (this.movement === 'zigzag')
        {
            this.y = this.baseY + Math.sin(this.phase) * this.amplitude;
            this.rotation = Math.sin(this.phase * this.rotationSpeed) * 0.18;
            return;
        }

        this.baseY += this.verticalDrift * 28 * deltaSeconds;
        this.y = this.baseY + (Math.sign(Math.sin(this.phase)) * this.amplitude * 0.55);
        this.rotation = Math.sign(Math.sin(this.phase * 1.2)) * 0.08;
    }

    recycle (worldWidth, worldHeight, baseSpawnYMin, baseSpawnYMarginBottom)
    {
        this.x = this.direction === 1 ? -40 : worldWidth + 40;
        this.baseY = Phaser.Math.Clamp(
            this.baseY + Phaser.Math.Between(-this.wrapShift, this.wrapShift),
            baseSpawnYMin,
            worldHeight - baseSpawnYMarginBottom
        );
        this.wraps += 1;
        this.verticalDrift = Phaser.Math.FloatBetween(-1, 1);
    }
}