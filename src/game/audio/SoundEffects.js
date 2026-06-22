/**
 * Synthetic sound effects using Web Audio API.
 * No external audio files needed — generates tones/noise on demand.
 */

let audioContext = null;
let audioUnlocked = false;
let audioUnlockListenersAttached = false;
let pendingAudioStartCallbacks = [];
let audioMuteFlags = {
    shots: false,
    thrusters: false,
    ambient: false,
    all: false
};
let ambientMusicOscillators = [];
let ambientMusicGains = [];
let ambientMusicActive = false;
let ambientMusicLfo = null;
let introMusicOscillators = [];
let introMusicGains = [];
let introMusicActive = false;
let introMusicLfo = null;
let introMusicPulseTimer = null;
let introMusicStep = 0;
let maneuverThrusterOsc = null;
let maneuverThrusterGain = null;
let boostThrusterOsc = null;
let boostThrusterGain = null;

function canPlay (category = 'general')
{
    if (audioMuteFlags.all)
    {
        return false;
    }

    if (category === 'shot' && audioMuteFlags.shots)
    {
        return false;
    }

    if (category === 'thruster' && audioMuteFlags.thrusters)
    {
        return false;
    }

    if (category === 'ambient' && audioMuteFlags.ambient)
    {
        return false;
    }

    return true;
}

function getAudioContext ()
{
    if (!audioContext)
    {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function flushPendingAudioCallbacks ()
{
    if (!audioUnlocked || pendingAudioStartCallbacks.length === 0)
    {
        return;
    }

    const callbacks = pendingAudioStartCallbacks.slice();
    pendingAudioStartCallbacks = [];

    for (const callback of callbacks)
    {
        try
        {
            callback();
        }
        catch (error)
        {
            // Keep audio unlock robust even if one callback fails.
        }
    }
}

function detachAudioUnlockListeners ()
{
    if (!audioUnlockListenersAttached || typeof window === 'undefined')
    {
        return;
    }

    window.removeEventListener('pointerdown', SoundEffects.consumeGestureForAudioUnlock, true);
    window.removeEventListener('touchstart', SoundEffects.consumeGestureForAudioUnlock, true);
    window.removeEventListener('keydown', SoundEffects.consumeGestureForAudioUnlock, true);
    window.removeEventListener('mousedown', SoundEffects.consumeGestureForAudioUnlock, true);
    audioUnlockListenersAttached = false;
}

function attachAudioUnlockListeners ()
{
    if (audioUnlocked || audioUnlockListenersAttached || typeof window === 'undefined')
    {
        return;
    }

    window.addEventListener('pointerdown', SoundEffects.consumeGestureForAudioUnlock, true);
    window.addEventListener('touchstart', SoundEffects.consumeGestureForAudioUnlock, true);
    window.addEventListener('keydown', SoundEffects.consumeGestureForAudioUnlock, true);
    window.addEventListener('mousedown', SoundEffects.consumeGestureForAudioUnlock, true);
    audioUnlockListenersAttached = true;
}

function playTone (frequency, durationMs, volumeStart = 0.3, volumeEnd = 0)
{
    const ctx = getAudioContext();
    const duration = durationMs / 1000;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = frequency;
    osc.type = 'sine';

    gain.gain.setValueAtTime(volumeStart, now);
    gain.gain.linearRampToValueAtTime(volumeEnd, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
}

function playNoise (durationMs, volumeStart = 0.2, volumeEnd = 0)
{
    const ctx = getAudioContext();
    const duration = durationMs / 1000;
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++)
    {
        data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    gain.gain.setValueAtTime(volumeStart, now);
    gain.gain.linearRampToValueAtTime(volumeEnd, now + duration);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
}

export const SoundEffects = {
    isAudioUnlocked ()
    {
        return audioUnlocked;
    },

    runWhenAudioUnlocked (callback)
    {
        if (typeof callback !== 'function')
        {
            return;
        }

        if (audioUnlocked)
        {
            callback();
            return;
        }

        pendingAudioStartCallbacks.push(callback);
        attachAudioUnlockListeners();
    },

    consumeGestureForAudioUnlock ()
    {
        if (audioUnlocked)
        {
            return false;
        }

        let ctx = null;

        try
        {
            ctx = getAudioContext();
        }
        catch (error)
        {
            return true;
        }

        const completeUnlock = () => {
            audioUnlocked = true;
            detachAudioUnlockListeners();
            flushPendingAudioCallbacks();
        };

        if (ctx.state === 'running')
        {
            completeUnlock();
            return true;
        }

        if (typeof ctx.resume === 'function')
        {
            ctx.resume()
                .then(() => {
                    if (ctx.state === 'running')
                    {
                        completeUnlock();
                    }
                })
                .catch(() => {
                    // Ignore: browser still blocked, next gesture will retry.
                });
        }

        return true;
    },

    setSoundMode (mode)
    {
        // Backward-compatible helper used by Game scene menu.
        if (mode === 'all')
        {
            audioMuteFlags = { shots: false, thrusters: false, ambient: false, all: false };
        }
        else if (mode === 'mute')
        {
            audioMuteFlags = { shots: true, thrusters: true, ambient: true, all: true };
        }
        else if (mode === 'no-shots')
        {
            audioMuteFlags.shots = true;
            audioMuteFlags.all = false;
        }
        else if (mode === 'no-thrusters')
        {
            audioMuteFlags.thrusters = true;
            audioMuteFlags.all = false;
        }
        else if (mode === 'no-ambient')
        {
            audioMuteFlags.ambient = true;
            audioMuteFlags.all = false;
        }

        if (!canPlay('thruster'))
        {
            this.stopManeuverThruster();
            this.stopBoostThruster();
        }

        if (!canPlay('ambient'))
        {
            this.stopAmbientMusic();
        }
        else
        {
            this.startAmbientMusic();
        }
    },

    getSoundMode ()
    {
        if (audioMuteFlags.all)
        {
            return 'mute';
        }

        const muted = [];
        if (audioMuteFlags.shots)
        {
            muted.push('shots');
        }
        if (audioMuteFlags.thrusters)
        {
            muted.push('thrusters');
        }
        if (audioMuteFlags.ambient)
        {
            muted.push('ambient');
        }

        if (muted.length === 0)
        {
            return 'all';
        }

        return `custom:${muted.join(',')}`;
    },

    getAudioMuteFlags ()
    {
        return { ...audioMuteFlags };
    },

    setAudioMuteFlags (flags)
    {
        audioMuteFlags = {
            shots: !!flags?.shots,
            thrusters: !!flags?.thrusters,
            ambient: !!flags?.ambient,
            all: !!flags?.all
        };

        if (audioMuteFlags.all)
        {
            audioMuteFlags.shots = true;
            audioMuteFlags.thrusters = true;
            audioMuteFlags.ambient = true;
        }

        if (!audioMuteFlags.all && !audioMuteFlags.thrusters)
        {
            // nothing
        }
        else
        {
            this.stopManeuverThruster();
            this.stopBoostThruster();
        }

        if (audioMuteFlags.all || audioMuteFlags.ambient)
        {
            this.stopAmbientMusic();
        }
        else
        {
            this.startAmbientMusic();
        }
    },

    lowFuelAlert ()
    {
        if (!canPlay())
        {
            return;
        }

        playTone(760, 70, 0.2, 0);
        setTimeout(() => playTone(640, 90, 0.18, 0), 85);
    },

    tunnelAlert ()
    {
        if (!canPlay())
        {
            return;
        }

        // Three rising beeps
        playTone(400, 120, 0.25, 0);
        playTone(550, 120, 0.25, 0);
        playTone(700, 140, 0.25, 0);
    },

    laserShot ()
    {
        if (!canPlay('shot'))
        {
            return;
        }

        // High-frequency tremolo burst
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.08;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator(); // Modulation

        osc.frequency.value = 850;
        osc.type = 'triangle';

        lfo.frequency.value = 12; // Tremolo rate
        lfo.type = 'sine';

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        lfo.connect(gain.gain);
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
        lfo.start(now);
        lfo.stop(now + duration);
    },

    enemyExplosion ()
    {
        if (!canPlay())
        {
            return;
        }

        // White noise burst descending
        playNoise(180, 0.25, 0);

        // Low-frequency rumble underneath
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.18;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + duration);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    },

    playerDamage ()
    {
        if (!canPlay())
        {
            return;
        }

        // Descending tone burst
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.25;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + duration);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    },

    shieldAbsorbHit ()
    {
        if (!canPlay())
        {
            return;
        }

        // Dull/low shield absorb thud
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + duration);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    },

    shieldBreak ()
    {
        if (!canPlay())
        {
            return;
        }

        // Bright/high shield break chime
        playTone(920, 80, 0.16, 0);
        setTimeout(() => playTone(1280, 100, 0.14, 0), 40);
    },

    gameOver ()
    {
        if (!canPlay())
        {
            return;
        }

        // Three descending low tones
        playTone(300, 150, 0.2, 0);
        setTimeout(() => playTone(250, 150, 0.2, 0), 160);
        setTimeout(() => playTone(180, 250, 0.2, 0), 330);
    },

    asteroidBreak ()
    {
        if (!canPlay())
        {
            return;
        }

        // Rock crack: noise burst with mid-frequency tone
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.12;

        // Noise envelope
        playNoise(120, 0.18, 0);

        // Mid-frequency click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + duration);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    },

    collideWithTerrain ()
    {
        if (!canPlay())
        {
            return;
        }

        // Deep impact: low rumble with noise
        playNoise(80, 0.2, 0);
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + duration);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    },

    collideWithAsteroid ()
    {
        if (!canPlay())
        {
            return;
        }

        // Crunchy impact: higher pitch with noise
        playNoise(100, 0.22, 0);
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + duration);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    },

    collideWithEnemy ()
    {
        if (!canPlay())
        {
            return;
        }

        // Metallic clash: higher frequency impact
        playNoise(110, 0.24, 0);
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + duration);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    },

    collideWithShot ()
    {
        if (!canPlay())
        {
            return;
        }

        // Sharp impact: short high-frequency click
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + duration);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    },

    fuelRecharge ()
    {
        if (!canPlay())
        {
            return;
        }

        // Charging sound: ascending tones
        playTone(400, 60, 0.18, 0);
        setTimeout(() => playTone(550, 60, 0.18, 0), 65);
        setTimeout(() => playTone(700, 70, 0.2, 0), 130);
    },

    tunnelRailBoost ()
    {
        if (!canPlay())
        {
            return;
        }

        // Propulsion sound: rising frequency burst
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.4;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + duration);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    },

    boostChargeNearMiss ()
    {
        if (!canPlay())
        {
            return;
        }

        // Short beep for boost charge on near-miss
        playTone(520, 40, 0.1, 0);
    },

    startAmbientMusic ()
    {
        if (!canPlay('ambient'))
        {
            return;
        }

        if (ambientMusicActive)
        {
            return;
        }

        ambientMusicActive = true;
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Retro synth pad: layered sine waves, sustained until explicit stop.
        const notes = [110, 165, 220, 330]; // A2, E3, A3, E4 - A minor chord

        for (const freq of notes)
        {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.08, now); // More audible presence
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            ambientMusicOscillators.push(osc);
            ambientMusicGains.push(gain);
        }

        // Slight wobble effect with LFO
        ambientMusicLfo = ctx.createOscillator();
        ambientMusicLfo.frequency.value = 0.3; // Very slow modulation
        ambientMusicLfo.type = 'sine';

        for (const osc of ambientMusicOscillators)
        {
            const depth = ctx.createGain();
            depth.gain.value = 20; // Slight pitch variation
            ambientMusicLfo.connect(depth);
            depth.connect(osc.frequency);
        }

        ambientMusicLfo.start(now);
    },

    startIntroMusic ()
    {
        if (!canPlay('ambient'))
        {
            return;
        }

        if (!audioUnlocked)
        {
            this.runWhenAudioUnlocked(() => this.startIntroMusic());
            return;
        }

        if (introMusicActive)
        {
            return;
        }

        this.stopAmbientMusic();

        introMusicActive = true;
        introMusicStep = 0;
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Cinematic bed: low drone + slowly moving upper voices.
        const notes = [73.42, 110, 146.83]; // D2, A2, D3

        for (const freq of notes)
        {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.frequency.setValueAtTime(freq, now);
            osc.type = freq >= 140 ? 'triangle' : 'sine';

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.05, now + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);

            introMusicOscillators.push(osc);
            introMusicGains.push(gain);
        }

        introMusicLfo = ctx.createOscillator();
        introMusicLfo.type = 'sine';
        introMusicLfo.frequency.value = 0.11;

        for (const osc of introMusicOscillators)
        {
            const depth = ctx.createGain();
            depth.gain.value = 6;
            introMusicLfo.connect(depth);
            depth.connect(osc.frequency);
        }

        introMusicLfo.start(now);

        // Harmonic movement and sparse arpeggio to avoid repetitive loops.
        const progression = [
            [73.42, 110.00, 146.83, 220.00], // Dm
            [65.41, 98.00, 146.83, 196.00],  // C
            [87.31, 110.00, 146.83, 220.00], // F
            [98.00, 123.47, 164.81, 246.94]  // G
        ];

        const pulse = () => {
            if (!introMusicActive || !canPlay('ambient'))
            {
                return;
            }

            const chord = progression[introMusicStep % progression.length];
            const pickA = chord[introMusicStep % chord.length];
            const pickB = chord[(introMusicStep + 2) % chord.length] * 2;
            const accent = introMusicStep % 4 === 0;
            const baseTime = ctx.currentTime;

            // Update sustained bed frequencies every step.
            if (introMusicOscillators.length >= 3)
            {
                introMusicOscillators[0].frequency.exponentialRampToValueAtTime(chord[0], baseTime + 0.45);
                introMusicOscillators[1].frequency.exponentialRampToValueAtTime(chord[1], baseTime + 0.45);
                introMusicOscillators[2].frequency.exponentialRampToValueAtTime(chord[2], baseTime + 0.45);
            }

            const pluck = (frequency, gainValue, duration, wave = 'triangle') => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = wave;
                osc.frequency.setValueAtTime(frequency, baseTime);
                gain.gain.setValueAtTime(gainValue, baseTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + duration);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(baseTime);
                osc.stop(baseTime + duration + 0.02);
            };

            pluck(pickA, accent ? 0.065 : 0.045, accent ? 0.65 : 0.5, 'triangle');
            pluck(pickB, accent ? 0.04 : 0.028, 0.35, 'sine');

            introMusicStep += 1;
        };

        pulse();
        introMusicPulseTimer = setInterval(pulse, 1200);
    },

    stopIntroMusic ()
    {
        introMusicActive = false;

        if (introMusicPulseTimer)
        {
            clearInterval(introMusicPulseTimer);
            introMusicPulseTimer = null;
        }

        const ctx = getAudioContext();
        const now = ctx.currentTime;

        for (let i = 0; i < introMusicOscillators.length; i++)
        {
            const osc = introMusicOscillators[i];
            const gain = introMusicGains[i];

            try
            {
                if (gain)
                {
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
                }

                osc.stop(now + 0.24);
            }
            catch (e)
            {
                // Already stopped
            }
        }

        if (introMusicLfo)
        {
            try
            {
                introMusicLfo.stop(now + 0.24);
            }
            catch (e)
            {
                // Already stopped
            }
            introMusicLfo = null;
        }

        introMusicOscillators = [];
        introMusicGains = [];
    },

    startManeuverThruster ()
    {
        if (!canPlay('thruster'))
        {
            return;
        }

        if (maneuverThrusterOsc)
        {
            return;
        }

        const ctx = getAudioContext();
        const now = ctx.currentTime;

        maneuverThrusterOsc = ctx.createOscillator();
        maneuverThrusterGain = ctx.createGain();

        maneuverThrusterOsc.type = 'sawtooth';
        maneuverThrusterOsc.frequency.setValueAtTime(260, now);
        maneuverThrusterGain.gain.setValueAtTime(0.0001, now);
        maneuverThrusterGain.gain.exponentialRampToValueAtTime(0.085, now + 0.06);

        maneuverThrusterOsc.connect(maneuverThrusterGain);
        maneuverThrusterGain.connect(ctx.destination);

        maneuverThrusterOsc.start(now);
    },

    stopManeuverThruster ()
    {
        if (!maneuverThrusterOsc || !maneuverThrusterGain)
        {
            return;
        }

        const ctx = getAudioContext();
        const now = ctx.currentTime;

        try
        {
            maneuverThrusterGain.gain.cancelScheduledValues(now);
            maneuverThrusterGain.gain.setValueAtTime(Math.max(0.0001, maneuverThrusterGain.gain.value), now);
            maneuverThrusterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
            maneuverThrusterOsc.stop(now + 0.06);
        }
        catch (e)
        {
            // Ignore stop race conditions
        }

        maneuverThrusterOsc = null;
        maneuverThrusterGain = null;
    },

    startBoostThruster ()
    {
        if (!canPlay('thruster'))
        {
            return;
        }

        if (boostThrusterOsc)
        {
            return;
        }

        const ctx = getAudioContext();
        const now = ctx.currentTime;

        boostThrusterOsc = ctx.createOscillator();
        boostThrusterGain = ctx.createGain();

        boostThrusterOsc.type = 'sawtooth';
        boostThrusterOsc.frequency.setValueAtTime(180, now);
        boostThrusterOsc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
        boostThrusterGain.gain.setValueAtTime(0.0001, now);
        boostThrusterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.08);

        boostThrusterOsc.connect(boostThrusterGain);
        boostThrusterGain.connect(ctx.destination);

        boostThrusterOsc.start(now);
    },

    stopBoostThruster ()
    {
        if (!boostThrusterOsc || !boostThrusterGain)
        {
            return;
        }

        const ctx = getAudioContext();
        const now = ctx.currentTime;

        try
        {
            boostThrusterGain.gain.cancelScheduledValues(now);
            boostThrusterGain.gain.setValueAtTime(Math.max(0.0001, boostThrusterGain.gain.value), now);
            boostThrusterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
            boostThrusterOsc.stop(now + 0.08);
        }
        catch (e)
        {
            // Ignore stop race conditions
        }

        boostThrusterOsc = null;
        boostThrusterGain = null;
    },

    bombRelease ()
    {
        if (!canPlay())
        {
            return;
        }

        // Sharp launch sound: quick ascending burst
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.12;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + duration);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    },

    bombExplosion ()
    {
        if (!canPlay())
        {
            return;
        }

        // Massive explosion: noise burst + low rumble
        playNoise(250, 0.35, 0);

        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const duration = 0.35;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + duration);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);

        // High frequency pop for the impact
        setTimeout(() => {
            playTone(1200, 50, 0.12, 0);
        }, 50);
    },

    stopAmbientMusic ()
    {
        ambientMusicActive = false;
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        for (const osc of ambientMusicOscillators)
        {
            try
            {
                osc.stop(now);
            }
            catch (e)
            {
                // Already stopped
            }
        }

        if (ambientMusicLfo)
        {
            try
            {
                ambientMusicLfo.stop(now);
            }
            catch (e)
            {
                // Already stopped
            }
            ambientMusicLfo = null;
        }

        ambientMusicOscillators = [];
        ambientMusicGains = [];
    }
};
