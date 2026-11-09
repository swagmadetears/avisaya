# Banda sonora del vídeo, generada con código: comercial serio y potente (Re menor, 100 ppm),
# con la locución encima y la música bajando sola cuando habla el narrador.
import json, sys, wave
import numpy as np

SR = 44100; DUR = 65.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
nota = lambda n: 440 * 2 ** ((n - 69) / 12)
BPM = 100; TIEMPO = 60 / BPM; COMPAS = 4 * TIEMPO

def poner(buf, inicio, sonido, vol=1.0):
    i = int(inicio * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(sonido))
    buf[i:j] += sonido[: j - i] * vol

def suave(x, n=200):
    k = np.ones(n) / n
    return np.convolve(x, k, mode='same')

musica = np.zeros(N)
# --- colchón: acordes Dm – Bb – F – C, un compás cada uno, sierra filtrada y desafinada ---
ACORDES = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]]
def sierra(f, d):
    tt = np.arange(int(d * SR)) / SR
    return 2 * ((tt * f) % 1) - 1
c = 0; tc = 0.0
while tc < DUR:
    d = COMPAS + 0.6
    tt = np.arange(int(d * SR)) / SR
    env = np.minimum(1, tt / 0.5) * np.minimum(1, (d - tt) / 0.6)
    voz = np.zeros(len(tt))
    for n in ACORDES[c % 4]:
        for det in (-0.12, 0.12):
            voz += sierra(nota(n + 12) * 2 ** (det / 12), d)
    voz = suave(voz, 18)  # filtro paso bajo sencillo: suena oscuro
    poner(musica, tc, voz * env * 0.016)
    # bajo
    b = np.sin(2 * np.pi * nota(ACORDES[c % 4][0] - 12) * tt) + 0.3 * np.sin(2 * np.pi * nota(ACORDES[c % 4][0]) * tt)
    poner(musica, tc, b * env * 0.09)
    c += 1; tc += COMPAS

# --- percusión ---
def bombo(fuerza=1.0):
    tt = np.arange(int(0.45 * SR)) / SR
    f = 48 + 90 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) * fuerza
def caja():
    tt = np.arange(int(0.3 * SR)) / SR
    r = rng.standard_normal(len(tt))
    r = r - suave(r, 6)  # quita graves
    return (r * 0.6 + 0.4 * np.sin(2 * np.pi * 190 * tt)) * np.exp(-tt * 16)
def charles():
    tt = np.arange(int(0.06 * SR)) / SR
    r = rng.standard_normal(len(tt)); r = r - suave(r, 3)
    return r * np.exp(-tt * 70)
def golpe():  # «boom» de tráiler
    tt = np.arange(int(2.2 * SR)) / SR
    f = 34 + 60 * np.exp(-tt * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.8)
    r = suave(rng.standard_normal(len(tt)), 30) * np.exp(-tt * 3)
    return sub + 0.6 * r

pulso = np.arange(0, DUR, TIEMPO)
for k, x in enumerate(pulso):
    tiempo = k % 4
    if 4.6 <= x < 11:            # el problema: solo un latido grave
        if tiempo == 0: poner(musica, x, bombo(0.7), 0.35)
    elif 11 <= x < 52:           # la explicación: ritmo completo
        poner(musica, x, bombo(), 0.42 if tiempo in (0, 2) else 0.0)
        if tiempo in (1, 3): poner(musica, x, caja(), 0.16)
        poner(musica, x, charles(), 0.05); poner(musica, x + TIEMPO / 2, charles(), 0.035)
# golpes en los momentos fuertes
for x in [0.15, 11.0, 52.0, 53.5, 55.0, 56.5, 58.5]:
    poner(musica, x, golpe(), 0.42)
# subidas suaves antes de cada escena (muy bajitas: no molestan)
for x in [11.0, 21.0, 29.0, 37.0, 45.0, 52.0]:
    d = 1.2; tt = np.arange(int(d * SR)) / SR
    r = suave(rng.standard_normal(len(tt)), 12) * (tt / d) ** 2
    poner(musica, x - d, r, 0.05)

# --- locución ---
guion = json.load(open(sys.argv[1] + '/guion.json'))
voz = np.zeros(N)
for inicio, archivo, _ in guion:
    with wave.open(archivo.replace('.wav', '_p.wav')) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
        if w.getnchannels() == 2: x = x[::2]
    poner(voz, inicio, x)
voz = voz / (np.max(np.abs(voz)) + 1e-9) * 0.9

# la música baja cuando habla el narrador (y sube despacio al callar)
env = suave(np.abs(voz), int(0.15 * SR))
env = env / (env.max() + 1e-9)
duck = 1 - 0.55 * np.clip(env * 4, 0, 1)
duck = suave(duck, int(0.25 * SR))

musica *= np.minimum(1, t / 0.8) * np.minimum(1, (DUR - t) / 3.0)
musica = musica / (np.max(np.abs(musica)) + 1e-9) * 0.75
mezcla = musica * duck * 0.8 + voz
mezcla = np.tanh(mezcla * 1.2) / np.tanh(1.2)  # limitador suave
mezcla = mezcla / np.max(np.abs(mezcla)) * 0.92
est = np.stack([mezcla, mezcla * 0.98 + np.roll(musica * duck, 300) * 0.02], axis=1)
with wave.open('musica.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((est * 32767).astype(np.int16).tobytes())
print('ok')
