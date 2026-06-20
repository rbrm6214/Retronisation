import * as Phaser from 'phaser';

export class Asteroid extends Phaser.GameObjects.Polygon
{
    static computePolygonCentroid (points)
    {
        let twiceArea = 0;
        let cx = 0;
        let cy = 0;

        for (let i = 0; i < points.length; i++)
        {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const cross = (p1.x * p2.y) - (p2.x * p1.y);

            twiceArea += cross;
            cx += (p1.x + p2.x) * cross;
            cy += (p1.y + p2.y) * cross;
        }

        if (Math.abs(twiceArea) < 0.0001)
        {
            let avgX = 0;
            let avgY = 0;

            for (const point of points)
            {
                avgX += point.x;
                avgY += point.y;
            }

            return {
                x: avgX / points.length,
                y: avgY / points.length
            };
        }

        return {
            x: cx / (3 * twiceArea),
            y: cy / (3 * twiceArea)
        };
    }

    static computeCollisionOffset (points, displayOriginX, displayOriginY)
    {
        const centroid = Asteroid.computePolygonCentroid(points);

        // Convert from polygon geometry space to the GameObject local space
        // used by x/y/rotation (which is relative to displayOrigin).
        return {
            x: centroid.x - displayOriginX,
            y: centroid.y - displayOriginY
        };
    }

    constructor (scene, x, y, radius, speed)
    {
        const sides = Phaser.Math.Between(6, 10);
        const points = [];
        const jitter = radius * 0.3;

        for (let i = 0; i < sides; i++)
        {
            const angle = (i / sides) * Math.PI * 2;
            const r = radius * Phaser.Math.FloatBetween(0.45, 1.0) + (Math.random() - 0.5) * jitter;

            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }

        super(scene, x, y, points, 0x6b7d8a);

        this.setStrokeStyle(2, 0xa8c0cc, 0.85);
        this.setOrigin(0.5, 0.5);

        this.radius = radius;
        this.speed = speed;
        this.rotDir = Math.random() > 0.5 ? 1 : -1;
        this.rotSpeed = Phaser.Math.FloatBetween(0.4, 1.1);
        this.vy = Phaser.Math.FloatBetween(-18, 18);
        this.scoreValue = Math.round(radius * 3);
        const geometryPoints = this.geom?.points ?? points;

        this.collisionLocalPoints = geometryPoints.map((point) => ({
            x: point.x - this.displayOriginX,
            y: point.y - this.displayOriginY
        }));

        this.collisionLocalOffset = Asteroid.computeCollisionOffset(
            geometryPoints,
            this.displayOriginX,
            this.displayOriginY
        );
        this.collisionCenter = this.getCollisionCenterAt(this.x, this.y, this.rotation);
        this.collisionPolygon = this.getCollisionPolygonAt(this.x, this.y, this.rotation);
    }

    getCollisionCenterAt (x, y, rotation)
    {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const ox = this.collisionLocalOffset.x;
        const oy = this.collisionLocalOffset.y;

        return {
            x: x + (ox * cos) - (oy * sin),
            y: y + (ox * sin) + (oy * cos)
        };
    }

    getCollisionCenter ()
    {
        return this.collisionCenter;
    }

    getCollisionPolygonAt (x, y, rotation)
    {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        return this.collisionLocalPoints.map((point) => ({
            x: x + (point.x * cos) - (point.y * sin),
            y: y + (point.x * sin) + (point.y * cos)
        }));
    }

    getCollisionPolygon ()
    {
        return this.collisionPolygon;
    }

    step (deltaSeconds, scrollSpeed = 0)
    {
        this.x -= (this.speed + scrollSpeed) * deltaSeconds;
        this.y += this.vy * deltaSeconds;
        this.rotation += this.rotDir * this.rotSpeed * deltaSeconds;
        this.collisionCenter = this.getCollisionCenterAt(this.x, this.y, this.rotation);
        this.collisionPolygon = this.getCollisionPolygonAt(this.x, this.y, this.rotation);
    }
}
