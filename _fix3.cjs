const fs = require('fs');
let src = fs.readFileSync('src/game/minigames/MiniGameChallenge.js', 'utf8');

// 1. Pass wall object to pinballSegmentCollide so it can check oneWay
src = src.replace(
    `            const hit = this.pinballSegmentCollide(ball, wall.x1, wall.y1, wall.x2, wall.y2, wall.r ?? 0.92);`,
    `            const hit = this.pinballSegmentCollide(ball, wall.x1, wall.y1, wall.x2, wall.y2, wall.r ?? 0.92, wall.oneWay);`
);

// 2. Fix launch: give leftward vx so ball crosses laneLeft (one-way) while going up
src = src.replace(
`    // Lance la balle hors du couloir avec la charge donnée [0..1]
    pinballLaunch (state, ball, charge)
    {
        const lch   = state.launcher;
        // Vitesse verticale: 320 (faible) → 900 (max)
        // La balle monte droit dans le couloir, heurte l'arche et est naturellement
        // déviée vers la gauche dans le playfield par la géométrie de l'arche
        const power = 320 + 580 * charge;
        ball.vx = 0;     // droit vers le haut
        ball.vy = -power;
        lch.phase  = 'launched';
        lch.charge = 0;
        state.flare = Math.max(state.flare, charge * 0.9);
    }`,
`    // Lance la balle hors du couloir avec la charge donnée [0..1]
    // La balle monte avec un léger vx gauche pour traverser le mur one-way (laneLeft)
    pinballLaunch (state, ball, charge)
    {
        const lch  = state.launcher;
        const power = 300 + 600 * charge;
        // vx gauche proportionnel à la charge: faible = reste bas, fort = monte haut et entre
        ball.vx = -(30 + 90 * charge);
        ball.vy = -power;
        lch.phase  = 'launched';
        lch.charge = 0;
        state.flare = Math.max(state.flare, charge * 0.9);
    }`
);

// 3. Add oneWay support to pinballSegmentCollide
src = src.replace(
    `    // Collision balle/segment: déplace la balle hors du segment et réfléchit la vitesse
    pinballSegmentCollide (ball, x1, y1, x2, y2, restitution)`,
    `    // Collision balle/segment: déplace la balle hors du segment et réfléchit la vitesse
    // oneWay: si true, ne bloque la balle que si elle vient du côté gauche (nx < 0)
    //         autrement dit: la balle venant de droite (nx > 0) passe librement
    pinballSegmentCollide (ball, x1, y1, x2, y2, restitution, oneWay = false)`
);

src = src.replace(
    `        const vDotN = ball.vx * nx + ball.vy * ny;

        if (vDotN < 0)
        {
            ball.vx -= (1 + restitution) * vDotN * nx;
            ball.vy -= (1 + restitution) * vDotN * ny;
        }

        return true;
    }

    // Gate one-way: depuis la zone de sortie du couloir, la balle ne peut pas revenir dans le couloir
    pinballGate (state, ball)
    {
        // La sortie du couloir est sur le bord gauche du couloir (laneLeft), zone haute
        if (ball.y > state.gateY2)
        {
            return;
        }

        // Si la balle est dans le playfield (à gauche de laneLeft) et se dirige vers la droite
        if (ball.x + ball.r > state.laneLeft && ball.x < state.laneLeft + 10 && ball.vx > 0)
        {
            ball.x  = state.laneLeft - ball.r - 0.3;
            ball.vx = -Math.abs(ball.vx) * 0.75;
        }
    }`,
    `        // oneWay: autoriser la balle venant du côté droit (nx > 0 = balle à droite du segment)
        if (oneWay && nx > 0)
        {
            return false;
        }

        const vDotN = ball.vx * nx + ball.vy * ny;

        if (vDotN < 0)
        {
            ball.vx -= (1 + restitution) * vDotN * nx;
            ball.vy -= (1 + restitution) * vDotN * ny;
        }

        return true;
    }`
);

// 4. Remove pinballGate call
src = src.replace(
    `\n        // Gate one-way: empêche la balle de revenir dans le couloir par la gauche\n        this.pinballGate(state, ball);\n`,
    `\n`
);

fs.writeFileSync('src/game/minigames/MiniGameChallenge.js', src, 'utf8');
console.log('OK - oneWay + launch + gate applied');
