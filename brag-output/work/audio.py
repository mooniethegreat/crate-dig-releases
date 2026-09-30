"""Crate Dig 1.0.9 soundtrack: lo-fi boom-bap in A minor at 90 BPM, with SFX tuned to the key
and sent through the same room as the music. Timeline matches video.html (1 beat = 2/3 s)."""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
BPM = 90
BEAT = 60 / BPM
DUR = 32 * BEAT                      # 21.333 s
N = int(round(DUR * SR))
rng = np.random.default_rng(1009)

def b(x):  # beats → seconds
    return x * BEAT

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def buf():
    return np.zeros((2, N))

def place(bus, sig, t, gain=1.0, pan=0.0):
    """Add mono or stereo sig at time t (s) with equal-power pan."""
    i = int(round(t * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
    n = min(sig.shape[1], N - i)
    if i < 0:
        sig = sig[:, -i:]; n = min(sig.shape[1], N); i = 0
    bus[:, i:i + n] += gain * sig[:, :n]

def env_adsr(n, a=0.005, d=0.3, s=0.6, r=0.1, hold=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e = e * (s + (1 - s) * np.exp(-np.maximum(0, t - a) / d))
    if hold is not None:
        rel = np.clip((t - hold) / r, 0, 1)
        e = e * (1 - rel)
    return e

def lp(x, fc, order=2):
    sos = signal.butter(order, fc, 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)

def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)

def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)

def wobble(t):
    """Tape wow shared by every pitched part, so SFX and music drift together."""
    return 1 + 0.0018 * np.sin(2 * np.pi * 0.55 * t) + 0.0007 * np.sin(2 * np.pi * 3.1 * t + 1)

# ------------------------------------------------------------------ instruments
def rhodes(m, dur, vel=1.0, t0=0.0):
    f = mtof(m)
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f * wobble(t + t0)) / SR
    idx = 1.3 * np.exp(-t / 0.35) * vel
    tone = np.sin(ph + idx * np.sin(ph)) + 0.22 * np.sin(2 * ph) * np.exp(-t / 0.7)
    tine = 0.07 * np.sin(ph * 14.0) * np.exp(-t / 0.035)
    e = env_adsr(n, a=0.004, d=1.6, s=0.25, r=0.35, hold=dur)
    return (tone + tine) * e * vel

def chord_stereo(notes, dur, vel, t0):
    """Rhodes chord with gentle stereo tremolo (autopan)."""
    mono = sum(rhodes(m, dur, vel * (0.9 if k else 1.0), t0) for k, m in enumerate(notes)) / len(notes) ** 0.6
    t = np.arange(mono.size) / SR + t0
    trem = 0.18 * np.sin(2 * np.pi * 4.2 * t)
    return np.vstack([mono * (1 + trem), mono * (1 - trem)])

def bass(m, dur, vel=1.0, t0=0.0):
    f = mtof(m)
    n = int((dur + 0.2) * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f * wobble(t + t0)) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    x = np.tanh(1.6 * x) / np.tanh(1.6)
    e = env_adsr(n, a=0.008, d=0.5, s=0.7, r=0.08, hold=dur)
    return lp(x * e * vel, 420)

def lead(m, dur, vel=1.0, t0=0.0):
    """Breathy flute-ish line, band-limited like a sample playing from the app."""
    f = mtof(m)
    n = int((dur + 0.35) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.18) / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib * wobble(t + t0)) / SR
    x = np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    breath = bp(rng.standard_normal(n), 900, 4000) * 0.06
    e = env_adsr(n, a=0.045, d=0.6, s=0.75, r=0.22, hold=dur)
    return bp((x + breath) * e * vel, 260, 3800)

def kick(vel=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = 46 + 85 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.32) * np.minimum(1, t / 0.001)
    click = lp(rng.standard_normal(n) * np.exp(-t / 0.003), 3000) * 0.25
    return np.tanh(1.4 * (x + click)) * vel

def snare(vel=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 186 * t) * np.exp(-t / 0.07)
    nz = bp(rng.standard_normal(n), 1300, 6500) * np.exp(-t / 0.15)
    return lp(0.55 * body + 0.9 * nz, 7000) * vel

def hat(vel=1.0, open_=False):
    n = int((0.4 if open_ else 0.12) * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7500) * np.exp(-t / (0.16 if open_ else 0.028))
    return x * vel

def crash(vel=1.0):
    n = int(2.2 * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 4500) * np.exp(-t / 0.9) * np.minimum(1, t / 0.004)
    return lp(x, 11000) * vel

# ------------------------------------------------------------------ SFX (tuned to A minor)
def tick(m=93, vel=1.0):
    """Reel pawl: wood click + a tiny tuned ping."""
    n = int(0.09 * SR); t = np.arange(n) / SR
    click = bp(rng.standard_normal(n), 1800, 5200) * np.exp(-t / 0.004)
    ping = np.sin(2 * np.pi * mtof(m) * t) * np.exp(-t / 0.022)
    return (0.7 * click + 0.45 * ping) * vel

def bell(notes, vel=1.0, dec=1.4):
    n = int((dec * 2.2) * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = mtof(m)
        ph = 2 * np.pi * np.cumsum(f * wobble(t)) / SR
        out += np.sin(ph + 0.9 * np.exp(-t / 0.25) * np.sin(3.5 * ph)) * np.exp(-t / dec)
    return out * np.minimum(1, t / 0.003) * vel / len(notes)

def pluck(m, vel=1.0):
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = mtof(m)
    ph = 2 * np.pi * f * t
    x = (np.sin(ph) + 0.35 * np.sin(2 * ph) * np.exp(-t / 0.08) + 0.12 * np.sin(3 * ph) * np.exp(-t / 0.04))
    return lp(x * np.exp(-t / 0.28) * np.minimum(1, t / 0.002), 5000) * vel

def ui_click(vel=1.0):
    n = int(0.04 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t / 0.0025) + 0.3 * np.sin(2 * np.pi * 2637 * t) * np.exp(-t / 0.006)
    return x * vel

def whoosh(dur, f0, f1, vel=1.0, q=1.4):
    """Band-passed noise whose centre glides f0→f1, rise-fall envelope."""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 256
    zi = None
    for s in range(0, n, blk):
        u = s / n
        fc = f0 * (f1 / f0) ** u
        bw = fc / q
        lo, hi = max(40, fc - bw / 2), min(SR / 2 - 100, fc + bw / 2)
        sos = signal.butter(2, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[s:s + blk], zi = signal.sosfilt(sos, x[s:s + blk], zi=zi)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * u) ** 1.6
    return out * e * vel

# ------------------------------------------------------------------ arrangement
music, drums, sfx, lead_bus = buf(), buf(), buf(), buf()
sends_m, sends_s = buf(), buf()   # reverb sends

CH = {   # Rhodes voicings (MIDI) and bass roots
    'Am9':   ([55, 59, 60, 64], 45),
    'E7sus': ([57, 59, 62, 64], 40),
    'E7':    ([56, 59, 62, 64], 40),
    'E7b9':  ([56, 59, 62, 65], 40),
    'Fmaj9': ([57, 60, 64, 67], 41),
    'Em7':   ([55, 59, 62, 66], 40),
    'Dm9':   ([53, 57, 60, 64], 38),
    'AmEnd': ([55, 59, 60, 64, 69], 45),
}
prog = [(0, 4, 'Am9'), (4, 1, 'E7sus'), (5, 1, 'E7'), (6, 4, 'Fmaj9'), (10, 4, 'Em7'), (14, 4, 'Dm9'),
        (18, 4, 'Am9'), (22, 2, 'Dm9'), (24, 2, 'E7b9'), (26, 2, 'Fmaj9'), (28, 2, 'Em7'), (30, 2, 'AmEnd')]

for st, ln, name in prog:
    notes, root = CH[name]
    t0 = b(st)
    vel = 0.95 if st < 6 else 1.0
    c = chord_stereo(notes, b(ln) + (0.9 if name == 'AmEnd' else 0.05), vel, t0)
    place(music, c, t0, 0.42)
    place(sends_m, c, t0, 0.42 * 0.3)
    if ln == 4 and st >= 6:   # lo-fi re-strike on the "and" of 3
        c2 = chord_stereo(notes, b(1.3), 0.55, t0 + b(2.5))
        place(music, c2, t0 + b(2.5), 0.42); place(sends_m, c2, t0 + b(2.5), 0.12)
    # bass from the drop
    if st >= 6:
        pat = [(0, 1.4, 0), (1.75, 0.35, 0), (2.5, 0.4, 7), (3, 0.9, 0)] if ln == 4 else [(0, 1.4, 0), (1.5, 0.4, 7)]
        if name == 'AmEnd':
            pat = [(0, 1.8, 0)]
        for off, d, iv in pat:
            place(music, bass(root + iv, b(d), 1.0, t0 + b(off)), t0 + b(off), 0.55)

# drums: bar downbeats at beats 2, 6, 10, … (beats 0–2 are a pickup)
SW = 0.33 * b(0.25)   # swing on odd 16ths
def step_time(beat16):
    base = b(beat16 / 4)
    return base + (SW if beat16 % 2 == 1 else 0)

K_STEPS, S_STEPS = [0, 7, 10], [4, 12]
for s16 in range(0, 32 * 4):
    beat = s16 / 4
    if beat >= 30.25:
        break
    rel = (s16 - 8) % 16          # step within the bar (bars start at beat 2)
    t = step_time(s16) + rng.normal(0, 0.003)
    roul = 22 <= beat < 26        # thinned-out roulette section
    muffled = beat < 6
    hv = (0.55 if rel % 4 == 0 else 0.35) * (0.8 + 0.4 * rng.random())
    if rel % 2 == 0 and not (beat >= 30):
        place(drums, hat(hv, open_=(rel == 14 and not muffled and int(beat) % 8 == 5)), t, 0.28, pan=0.25)
    if not roul:
        if rel in K_STEPS:
            place(drums, kick(0.95 if rel == 0 else 0.75), t, 0.85)
        if rel in S_STEPS:
            sn = snare(0.9 + 0.1 * rng.random())
            place(drums, sn, t, 0.5, pan=-0.05); place(sends_m, sn, t, 0.08)
        if rel == 15 and int(beat) % 8 == 5:
            place(drums, snare(0.25), t, 0.5)
    else:
        if rel in S_STEPS:  # rim-ish ghost keeps time under the roulette ticks
            place(drums, snare(0.35), t, 0.3)
# hits
place(drums, kick(1.0), b(6), 0.85); place(drums, crash(0.6), b(6), 0.22, pan=0.2); place(sends_m, crash(0.6), b(6), 0.05)
place(drums, kick(1.0), b(26), 0.9); place(drums, crash(0.7), b(26), 0.25, pan=-0.2); place(sends_m, crash(0.7), b(26), 0.06)
place(drums, kick(1.0), b(30), 0.9); place(drums, crash(0.5), b(30), 0.2, pan=0.15)
place(drums, kick(0.8), b(24), 0.6)   # roulette landing thump

# lead: enters as the roulette sample plays, carries into the outro
MEL = [(24.0, 0.45, 76), (24.5, 0.45, 74), (25.0, 0.7, 71), (25.75, 0.25, 68),
       (26.0, 1.4, 72), (27.5, 0.45, 69),
       (28.0, 0.7, 71), (28.75, 0.25, 74), (29.0, 0.9, 72),
       (30.0, 1.9, 69)]
for st, d, m in MEL:
    x = lead(m, b(d), 0.9, b(st))
    place(lead_bus, x, b(st), 0.40, pan=-0.12)
    place(sends_s, x, b(st), 0.10)

# ---- SFX
def sfx(sig, t, gain, pan=0.0, send=0.3):
    place(sfx_bus, sig, t, gain, pan); place(sends_s, sig, t, gain * send)
sfx_bus = sfx  # placeholder replaced below
sfx_bus = buf()

# Scene 1 reel ticks: cards 3→14 cross the needle with cubicOut(t/2); ticks at every half card.
def cubic_out_inv(p):
    return 1 - (1 - p) ** (1 / 3)
for k in range(1, 23):
    p = k / 22
    t = 2.0 * cubic_out_inv(p)
    if t >= 1.98:
        continue
    vel = 0.55 + 0.45 * (1 - p) ** 0.5
    sfx(tick(93 if k % 2 else 88, vel), t, 0.16, pan=(-0.15 if k % 2 else 0.15), send=0.25)
sfx(bell([81, 88], 1.0, 1.2), b(3), 0.30, pan=0.0, send=0.45)           # landing: A5 + E6
sfx(pluck(69, 0.9), b(3), 0.16, send=0.3)

# riser into the drop + record flight
sfx(whoosh(b(1.1), 300, 4200, 1.0, 2.0), b(4.9), 0.10, send=0.35)
sfx(whoosh(0.72, 2600, 500, 1.0, 1.4), b(6), 0.14, pan=-0.35, send=0.3)
sfx(pluck(76, 0.7), 4.72, 0.15, pan=-0.5, send=0.35)                      # record lands in the headline

# Scene 2: play click
sfx(ui_click(1.0), 6.0, 0.13, pan=0.35, send=0.15)

# Scene 3: panel pops out, two Add folder clicks with plucks
sfx(whoosh(0.32, 500, 2600, 1.0, 1.6), b(12) - 0.02, 0.10, pan=0.1, send=0.3)
for tc, m in [(26 / 3, 76), (28 / 3, 81)]:
    sfx(ui_click(1.0), tc, 0.13, pan=0.2, send=0.15)
    sfx(pluck(m, 1.0), tc + 0.01, 0.22, pan=0.15, send=0.35)

# Scene 4: relaunch (close ↓, reopen ↑), saved-index chips, check for updates
sfx(whoosh(0.3, 2400, 420, 1.0, 1.4), b(16), 0.11, send=0.3)
sfx(whoosh(0.42, 420, 2600, 1.0, 1.4), b(16) + 0.28, 0.11, send=0.3)
for i, m in enumerate([72, 76, 81]):                                        # C5 E5 A5 over Dm9
    sfx(bell([m + 12], 0.9, 0.5), b(16) + 0.72 + 0.14 * i, 0.10, pan=0.2, send=0.4)
sfx(ui_click(1.0), 12.0, 0.13, pan=0.25, send=0.15)
sfx(whoosh(0.5, 900, 3000, 1.0, 1.8), 12.0, 0.07, pan=0.25, send=0.3)
for tr, notes, g in [(12.22, [76], 0.10), (12.38, [81, 84], 0.15), (12.54, [76], 0.10)]:
    sfx(bell(notes, 1.0, 0.45), tr, g, pan=0.2, send=0.4)
sfx(pluck(79, 0.8), 12.85, 0.12, pan=0.2, send=0.35)                       # Scan selected appears

# Scene 5: window reshape, roulette reel ticks decelerating into the landing on beat 24
sfx(whoosh(0.4, 2000, 600, 1.0, 1.4), b(22), 0.10, send=0.3)
ra, rb = b(22) + 0.24, b(24)
for k in range(1, 16):
    p = k / 16
    t = ra + (rb - ra) * cubic_out_inv(p)
    sfx(tick(88 if k % 2 else 93, 0.6 + 0.4 * (1 - p)), t, 0.13, pan=(0.25 if k % 2 else 0.35), send=0.25)
sfx(bell([76, 80], 1.0, 1.0), b(24), 0.24, pan=0.25, send=0.45)            # E5 + G#5 over E7b9

# Scene 6: CTA sparkle on the final chord
sfx(bell([81, 88, 93], 1.0, 1.6), b(30), 0.16, send=0.5)

# vinyl crackle + hiss (louder in the hook)
t_all = np.arange(N) / SR
crk = np.zeros(N)
nclicks = int(DUR * 38)
pos = rng.integers(0, N - 200, nclicks)
amp = rng.exponential(0.25, nclicks) * rng.choice([-1, 1], nclicks)
crk[pos] = amp
crk = bp(crk, 900, 7000)
hiss = bp(rng.standard_normal(N), 2000, 9000) * 0.012
crackle_gain = np.where(t_all < b(6), 0.55, 0.28)
crackle = (crk + hiss) * crackle_gain
place(music, np.vstack([crackle, np.roll(crackle, 97)]), 0, 0.5)

# ------------------------------------------------------------------ bus processing
# kick-driven ducking on music + lead
kick_env = np.zeros(N)
for s16 in range(0, 32 * 4):
    beat = s16 / 4
    rel = (s16 - 8) % 16
    if rel == 0 and not (22 <= beat < 26) and beat <= 30:
        i = int(step_time(s16) * SR)
        L = int(0.25 * SR)
        kick_env[i:i + L] = np.maximum(kick_env[i:i + L], np.exp(-np.arange(min(L, N - i)) / (0.09 * SR)))
duck = 1 - 0.28 * kick_env

music = music * duck
lead_bus = lead_bus * duck

# time-varying lowpass on the music+drums bus: muffled hook, opens on the drop; dips during the relaunch
def cutoff(t):
    if t < b(5.2):
        return 900.0
    if t < b(6):
        u = (t - b(5.2)) / b(0.8)
        return 900 * (18000 / 900) ** (u ** 2)
    if b(16) <= t < b(16) + 0.75:
        u = (t - b(16)) / 0.75
        d = np.sin(np.pi * u)
        return 18000 * (900 / 18000) ** d
    return 18000.0

def tv_lowpass(x):
    out = np.zeros_like(x)
    blk = 128
    zi = None
    for s in range(0, N, blk):
        fc = min(cutoff(s / SR), SR / 2 * 0.95)
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((2, sos.shape[0], 2))
        for ch in range(2):
            out[ch, s:s + blk], zi[ch] = signal.sosfilt(sos, x[ch, s:s + blk], zi=zi[ch])
    return out

groove = tv_lowpass(music + drums)
send_total = tv_lowpass(sends_m) + sends_s

# shared room: decorrelated stereo exponential-noise IR, damped highs, short predelay
def make_ir(rt60=1.5, pre=0.018):
    n = int((rt60 * 1.2) * SR)
    t = np.arange(n) / SR
    decay = np.exp(-6.91 * t / rt60)
    irs = []
    for ch in range(2):
        x = rng.standard_normal(n) * decay
        x = lp(x, 5200)
        x = np.concatenate([np.zeros(int(pre * SR)), x])
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    return irs
ir = make_ir()
rev = np.vstack([signal.fftconvolve(send_total[c], ir[c])[:N] for c in range(2)])
rev = hp(rev, 180)

mix = groove + lead_bus + sfx_bus + 0.55 * rev
mix = hp(mix, 28)
mix = mix + 0.3 * hp(mix, 2800)   # gentle presence shelf for small speakers

# gentle tape saturation + fade out
fade = np.ones(N)
fl = int(0.55 * SR)
fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
fi = int(0.004 * SR)
fade[:fi] = np.linspace(0, 1, fi)
mix = mix * fade
peak = np.max(np.abs(mix))
mix = mix / peak * 0.9
mix = np.tanh(1.25 * mix) / np.tanh(1.25)
mix = mix / np.max(np.abs(mix)) * 0.89

wavfile.write('audio_raw.wav', SR, (mix.T * 32767).astype(np.int16))
print('wrote audio_raw.wav', mix.shape, 'dur', N / SR)

if __name__ == '__main__':
    import sys
    if '--stems' in sys.argv:
        def rms_db(x, a, bnd):
            seg_ = x[:, int(a * SR):int(bnd * SR)]
            return 20 * np.log10(np.sqrt(np.mean(seg_ ** 2)) + 1e-9)
        def peak_db(x, a, bnd):
            seg_ = x[:, int(a * SR):int(bnd * SR)]
            return 20 * np.log10(np.max(np.abs(seg_)) + 1e-9)
        sc = 0.9 / peak
        for name, (a, bnd) in {'hook': (0, 4), 'reveal': (4, 8), 'folders': (8, 10.67), 'rescan': (10.67, 14.67), 'roulette': (14.67, 17.33), 'outro': (17.33, 21.3)}.items():
            print(f"{name:9s} groove {rms_db(groove*sc,a,bnd):6.1f} rms/{peak_db(groove*sc,a,bnd):6.1f} pk | sfx {rms_db(sfx_bus*sc,a,bnd):6.1f} rms/{peak_db(sfx_bus*sc,a,bnd):6.1f} pk | lead {rms_db(lead_bus*sc,a,bnd):6.1f} | rev {rms_db(0.55*rev*sc,a,bnd):6.1f}")
