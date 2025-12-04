// ZzFX - Zuper Zmall Zound Zynth - Micro Edition
// MIT License - Copyright 2019 Frank Force
// https://github.com/KilledByAPixel/ZzFX

// This is a minified/adapted version for our use case
declare global {
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

const zzfxV = 0.3; // Volume
let zzfxX: AudioContext | undefined;

export const initAudio = () => {
    if (typeof window === 'undefined') return;
    if (!zzfxX) {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        zzfxX = new AudioContextCtor();
    }
    if (zzfxX.state === 'suspended') {
        zzfxX.resume();
    }
};

export const zzfx = (...t: (number | undefined)[]) => {
    if (!zzfxX) initAudio();
    if (!zzfxX) return;

    const volumeRaw = t[0] ?? 1;
    const frequency = t[2] ?? 220;
    const length = t[3] ?? 0.1;
    const attack = t[4] ?? 0.05;
    const slide = t[5] ?? 0;
    const noise = t[6] ?? 0;
    const modulation = t[7] ?? 0;
    const modulationPhase = t[8] ?? 0;

    let volume = volumeRaw;

    // Apply global volume
    volume *= zzfxV;

    // Generate audio buffer
    const sampleRate = 44100;
    const size = length * sampleRate | 0;
    const buffer = zzfxX.createBuffer(1, size, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < size; i++) {
        // Generate waveform
        const p = i / sampleRate;
        const f = frequency * (1 + slide * p);
        const m = modulation * Math.sin(modulationPhase * Math.PI * 2 * p);
        const s = Math.sin(f * Math.PI * 2 * p + m);
        const n = noise * (Math.random() * 2 - 1);

        // Envelope
        let e = 1;
        if (p < attack) {
            e = p / attack;
        } else {
            e = 1 - (p - attack) / (length - attack);
        }

        data[i] = (s * (1 - noise) + n) * e * volume;
    }

    // Play sound
    const source = zzfxX.createBufferSource();
    source.buffer = buffer;
    source.connect(zzfxX.destination);
    source.start();
    return source;
};

// Sound Presets
// Parameters: [volume, randomness, frequency, length, attack, slide, noise, modulation, modulationPhase]
export const playSound = {
    // UI Sounds
    click: () => zzfx(1, .05, 500, .05, .01, 0, 0, 0, 0),
    hover: () => zzfx(.5, .05, 800, .03, .01, 0, 0, 0, 0),

    // Combat Sounds
    attackSlash: () => zzfx(1, .05, 200, .2, .01, -.5, .5, 0, 0), // Noise burst with slide down
    attackFire: () => zzfx(1, .05, 100, .5, .1, 0, 1, 0, 0), // Long noise
    attackZap: () => zzfx(1, .05, 800, .2, .01, -.5, 0, 50, 0), // High freq with modulation

    // Impact Sounds
    hit: () => zzfx(1, .05, 100, .2, .01, -.5, .8, 0, 0), // Low noise burst
    crit: () => zzfx(1, .05, 300, .4, .01, -.2, .5, 20, 0), // Punchier noise with modulation

    // Reward Sounds
    coin: () => zzfx(.8, .05, 1200, .1, .01, 0, 0, 0, 0), // High ping
    success: () => {
        // Play a major triad arpeggio
        setTimeout(() => zzfx(.5, .05, 440, .2, .05, 0, 0, 0, 0), 0);
        setTimeout(() => zzfx(.5, .05, 554, .2, .05, 0, 0, 0, 0), 100);
        setTimeout(() => zzfx(.5, .05, 659, .4, .05, 0, 0, 0, 0), 200);
    },
    defeat: () => {
        // Play a descending tritone
        setTimeout(() => zzfx(.5, .05, 300, .4, .1, -.5, 0, 10, 0), 0);
        setTimeout(() => zzfx(.5, .05, 200, .6, .1, -.5, 0, 10, 0), 300);
    },

    // Level Up / Victory
    victory: () => {
        const speed = 100;
        [440, 554, 659, 880].forEach((freq, i) => {
            setTimeout(() => zzfx(.6, .05, freq, .3, .05, 0, 0, 0, 0), i * speed);
        });
    }
};
