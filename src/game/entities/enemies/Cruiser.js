import * as Phaser from 'phaser';

export class Cruiser extends Phaser.GameObjects.Rectangle
{
    static getStyleForType (type)
    {
        if (type === 'dramite')   { return { w: 52, h: 18, fill: 0x2a7b4c, stroke: 0x90f0b8 }; }
        if (type === 'bynite')    { return { w: 40, h: 26, fill: 0xf07020, stroke: 0xffc090 }; }
        if (type === 'satellite') { return { w: 30, h: 30, fill: 0xee00ff, stroke: 0xff99ff }; }

        return { w: 44, h: 24, fill: 0x6b3fd9, stroke: 0xc0a8f8 };
    }

    constructor (scene, x, y, waveConfig, onFire)
    {
        const style = Cruiser.getStyleForType(waveConfig.type);

        super(scene, x, y, style.w, style.h, style.fill);

        this.setStrokeStyle(2, style.stroke, 0.95);
        this.setOrigin(0.5, 0.5);

        this.label = waveConfig.label;
        this.type = waveConfig.type;
        this.points = waveConfig.scoreValue;
        this.hitWidth = style.w - 14;
        this.hitHeight = style.h - 8;
        this.speed = Phaser.Math.Between(waveConfig.speedMin, waveConfig.speedMax);
        this.amplitude = Phaser.Math.Between(waveConfig.amplitudeMin, waveConfig.amplitudeMax);
        this.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
        this.phaseSpeed = Phaser.Math.FloatBetween(waveConfig.phaseSpeedMin, waveConfig.phaseSpeedMax);
        this.baseY = y;
        this.wraps = 0;
        this.wrapShift = waveConfig.wrapShift;
        this.shotIntervalMin = waveConfig.shotIntervalMin;
        this.shotIntervalMax = waveConfig.shotIntervalMax;
        this.shotSpeed = waveConfig.shotSpeed;
        this.shotCount = waveConfig.shotCount ?? 1;
        this.shotSpread = waveConfig.shotSpread ?? 0;
        this.hitsLeft = waveConfig.hitsLeft ?? 1;
        this.direction = -1;
        this.shotCooldown = Phaser.Math.FloatBetween(1.0, 2.2);
        this.onFire = onFire;
    }

    step (deltaSeconds, playerSpeed, playerX, playerY)
    {
        this.phase += deltaSeconds * this.phaseSpeed;
        this.x -= ((playerSpeed * 0.45) + this.speed) * deltaSeconds;
        this.y = this.baseY + Math.sin(this.phase) * this.amplitude;

        this.shotCooldown -= deltaSeconds;

        if (this.shotCooldown <= 0 && this.x > 40 && this.x < this.scene.scale.width - 40)
        {
            this.shotCooldown = Phaser.Math.FloatBetween(this.shotIntervalMin, this.shotIntervalMax);
            this.onFire(this.x, this.y, playerX, playerY, this.shotSpeed, this.shotCount, this.shotSpread);
        }
    }

    recycle (worldWidth, worldHeight, baseSpawnYMin, baseSpawnYMarginBottom)
    {
        this.x = worldWidth + 40;
        this.baseY = Phaser.Math.Clamp(
            this.baseY + Phaser.Math.Between(-this.wrapShift, this.wrapShift),
            baseSpawnYMin,
            worldHeight - baseSpawnYMarginBottom
        );
        this.wraps += 1;
        this.shotCooldown = Phaser.Math.FloatBetween(this.shotIntervalMin, this.shotIntervalMax);
    }
}
