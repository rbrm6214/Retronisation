const fs = require('fs');
let src = fs.readFileSync('src/game/minigames/MiniGameChallenge.js', 'utf8');

const startMarker = '    initPinball ()\n    {';
const startMarker = '    initPinball ()\n    {\n        // \u2500\u2500 Dimensions de la table';
const startMarker = '    initPinball ()\n    {\n        // \u2500\u2500 Dimensions de la table';
const endMarker   = '\n    updatePinball (deltaSeconds)';

const startIdx = src.indexOf(startMarker);
const endIdx   = src.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) { console.log('MARKERS NOT FOUND'); process.exit(1); }

const newBody = `    initPinball ()
    {
        const H = this.arenaHeight;

        const pfLeft    = 28;
        const pfTop     = 16;
        const pfBot     = H - 12;
        const laneLeft  = 610;
        const laneRight = 658;
        const laneMid   = (laneLeft + laneRight) * 0.5;
        const archY0    = 68;

        const FLEFT_PIV_X  = 220;
        const FRIGHT_PIV_X = 406;
        const FLIP_PIV_Y   = H - 44;
        const FLIP_LEN     = 88;
        const LF_REST      =  0.42;
        const LF_ACTIVE    = -0.52;
        const RF_REST      = Math.PI - 0.42;
        const RF_ACTIVE    = Math.PI + 0.52;

        const bumpers = [
            { x: 200, y: 110, r: 20, score: 160, glow: 0, color: 0x6cf5ff },
            { x: 313, y:  78, r: 24, score: 220, glow: 0, color: 0xffd166 },
            { x: 426, y: 110, r: 20, score: 160, glow: 0, color: 0xff6a6a },
            { x: 248, y: 210, r: 17, score: 120, glow: 0, color: 0x9cff8d },
            { x: 378, y: 210, r: 17, score: 120, glow: 0, color: 0xb388ff }
        ];

        // laneLeft wall is ONE-WAY:
        //   ball from lane (right, nx>0): NOT blocked -> enters playfield freely
        //   ball from playfield (left, nx<0): BLOCKED -> cannot re-enter lane
        const walls = [
            { x1: pfLeft,    y1: archY0,  x2: 64,        y2: 42,       r: 0.90 },
            { x1: 64,        y1: 42,      x2: 140,       y2: 24,       r: 0.90 },
            { x1: 140,       y1: 24,      x2: 340,       y2: 16,       r: 0.92 },
            { x1: 340,       y1: 16,      x2: 510,       y2: 24,       r: 0.92 },
            { x1: 510,       y1: 24,      x2: laneLeft,  y2: archY0,   r: 0.90 },
            { x1: pfLeft,    y1: archY0,  x2: pfLeft,    y2: H - 108,  r: 0.92 },
            { x1: laneLeft,  y1: pfTop,   x2: laneLeft,  y2: H - 108,  r: 0.92, oneWay: true },
            { x1: laneRight, y1: pfTop,   x2: laneRight, y2: pfBot,    r: 0.90 },
            { x1: pfLeft,    y1: H - 108, x2: FLEFT_PIV_X - 10,  y2: FLIP_PIV_Y - 8, r: 1.12, isSling: true },
            { x1: laneLeft,  y1: H - 108, x2: FRIGHT_PIV_X + 10, y2: FLIP_PIV_Y - 8, r: 1.12, isSling: true },
        ];

        this.state.pinball = {
            gravity:  620,
            maxSpeed: 920,
            friction: 0.9992,
            pfLeft, pfTop, pfBot,
            laneLeft, laneRight, laneMid,
            archY0,
            bumpers,
            walls,
            leftFlipper:  { pivotX: FLEFT_PIV_X,  pivotY: FLIP_PIV_Y, length: FLIP_LEN, restAngle: LF_REST,  activeAngle: LF_ACTIVE, angle: LF_REST,  angularVel: 0 },
            rightFlipper: { pivotX: FRIGHT_PIV_X, pivotY: FLIP_PIV_Y, length: FLIP_LEN, restAngle: RF_REST,  activeAngle: RF_ACTIVE, angle: RF_REST,  angularVel: 0 },
            flare: 0,
            launcher: { phase: 'idle', charge: 0, prevDown: false },
            ball: { x: laneMid, y: pfBot - 12, vx: 0, vy: 0, r: 8, trail: [] }
        };
    }`;

const result = src.slice(0, startIdx) + newBody + src.slice(endIdx);
fs.writeFileSync('src/game/minigames/MiniGameChallenge.js', result, 'utf8');
console.log('OK - initPinball rewritten, chars written:', result.length);
