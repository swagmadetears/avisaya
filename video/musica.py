# Banda sonora del vídeo, generada con código: neo jazz alegre (piano eléctrico, contrabajo que camina,
# batería con escobillas y ride en swing, vibráfono) que cambia de armonía en cada parte. Sin voz:
# la locución se añadirá después encima.
import wave
import numpy as np

SR = 44100; DUR = 65.0
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(11)
f = lambda n: 440 * 2 ** ((n - 69) / 12)
BPM = 96; B = 60 / BPM          # un tiempo
SW = 0.64                        # swing: la corchea de «y» cae tarde
mus = np.zeros(N)

def poner(inicio, s, vol=1.0):
    i = int(inicio * SR)
    if i >= N or i < 0: return
    j = min(N, i + len(s)); mus[i:j] += s[: j - i] * vol

def suave(x, n):
    return np.convolve(x, np.ones(n) / n, mode='same')

def rhodes(n, d, vel=1.0):  # piano eléctrico: FM suave con campanita y trémolo
    tt = np.arange(int(d * SR)) / SR
    fr = f(n); mod = np.sin(2 * np.pi * fr * tt) * 1.2 * np.exp(-tt * 5)
    s = np.sin(2 * np.pi * fr * tt + mod) + 0.25 * np.sin(2 * np.pi * 2 * fr * tt) * np.exp(-tt * 3)
    env = np.minimum(1, tt / 0.008) * np.exp(-tt * 1.1) * np.minimum(1, (d - tt) / 0.08)
    return s * env * (1 + 0.12 * np.sin(2 * np.pi * 5.2 * tt)) * vel

def bajo(n, d):  # contrabajo pulsado
    tt = np.arange(int(d * SR)) / SR
    fr = f(n)
    s = np.sin(2 * np.pi * fr * tt) + 0.35 * np.sin(2 * np.pi * 2 * fr * tt) * np.exp(-tt * 6) + 0.12 * np.sin(2 * np.pi * 3 * fr * tt) * np.exp(-tt * 9)
    return s * np.minimum(1, tt / 0.004) * np.exp(-tt * 3.2) * np.minimum(1, (d - tt) / 0.03)

def vibra(n, d=1.6):  # vibráfono
    tt = np.arange(int(d * SR)) / SR
    fr = f(n)
    s = np.sin(2 * np.pi * fr * tt) + 0.3 * np.sin(2 * np.pi * 4 * fr * tt) * np.exp(-tt * 8)
    return s * np.minimum(1, tt / 0.003) * np.exp(-tt * 2.2) * (1 + 0.25 * np.sin(2 * np.pi * 6 * tt))

def ride():
    tt = np.arange(int(0.5 * SR)) / SR
    r = rng.standard_normal(len(tt)); r = r - suave(r, 3)
    ring = sum(np.sin(2 * np.pi * h * tt) for h in (3150, 4720, 6100)) / 3
    return (0.6 * r + 0.5 * ring) * np.exp(-tt * 9)

def escobilla():
    tt = np.arange(int(0.22 * SR)) / SR
    r = rng.standard_normal(len(tt)); r = r - suave(r, 8)
    return r * np.minimum(1, tt / 0.03) * np.exp(-tt * 14)

def bombo():
    tt = np.arange(int(0.3 * SR)) / SR
    fr = 52 + 70 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 10)

# Armonía por partes (acordes de 4 notas + bajo); cada acorde dura un compás
PARTES = [
    (0.0,  [(50, [65, 69, 72, 76]), (43, [65, 69, 71, 76]), (48, [64, 67, 71, 74]), (45, [61, 67, 70, 76])]),   # Dm9 G13 Cmaj9 A7
    (11.0, [(53, [64, 67, 69, 72]), (52, [62, 67, 71, 74]), (50, [65, 69, 72, 76]), (48, [64, 67, 71, 74])]),   # Fmaj9 Em7 Dm9 Cmaj9
    (29.0, [(46, [62, 65, 69, 72]), (45, [61, 64, 67, 71]), (50, [65, 69, 72, 76]), (43, [65, 69, 71, 76])]),   # Bbmaj9 A7 Dm9 G13
    (45.0, [(51, [62, 67, 70, 74]), (50, [65, 69, 72, 76]), (43, [62, 65, 70, 72]), (48, [64, 67, 70, 74])]),   # Ebmaj9 Dm9 G7sus C9
    (58.0, [(53, [64, 67, 69, 72, 76])]),                                                                         # Fmaj9 final
]
COMPAS = 4 * B
def parte_en(x):
    p = PARTES[0]
    for q in PARTES:
        if x >= q[0]: p = q
    return p

# --- armonía y bajo ---
x = 0.0; idx = 0
while x < 58.0:
    ini, acordes = parte_en(x)
    raiz, notas = acordes[int((x - ini) / COMPAS + 1e-6) % len(acordes)]
    nxt_ini, nxt_ac = parte_en(x + COMPAS)
    sig = nxt_ac[int((x + COMPAS - nxt_ini) / COMPAS + 1e-6) % len(nxt_ac)][0]
    # piano: comping con ritmo distinto en cada parte
    patron = [(0, 1.6), (2.5, 1.2)] if ini < 11 else [(0, 0.9), (1.5, 0.5), (2.5, 1.2)] if ini < 29 else [(0.5, 0.8), (2, 0.6), (3.5, 0.4)] if ini < 45 else [(0, 0.5), (1, 0.5), (1.5, 0.4), (3, 0.9)]
    for p, d in patron:
        cuando = x + (int(p) + (SW if p % 1 else 0)) * B
        for k, n in enumerate(notas):
            poner(cuando + k * 0.012, rhodes(n, d * B + 0.3, 0.9 if k else 1.0), 0.045)
    # bajo: camina por notas del acorde y se acerca al siguiente
    if x >= 4.6:
        linea = [raiz, raiz + 7, raiz + (4 if (notas[0] - raiz) % 12 in (4, 11) else 3), sig + (1 if (raiz - sig) % 12 > 6 else -1)]
        for k, n in enumerate(linea):
            poner(x + k * B, bajo(n, B * 0.95), 0.2)
    else:
        poner(x, bajo(raiz, COMPAS), 0.16)
    x += COMPAS; idx += 1

# --- batería: escobillas y ride en swing (entra en la parte 2, se anima en la 4) ---
x = 0.0; k = 0
while x < 58.0:
    tiempo = k % 4
    if x >= 4.6:
        poner(x, ride(), 0.05)
        if tiempo in (1, 3): poner(x + SW * B, ride(), 0.035)
        if tiempo in (1, 3): poner(x, escobilla(), 0.11)
        if x >= 11:
            if tiempo == 0 or (tiempo == 2 and x >= 29): poner(x, bombo(), 0.32)
            if x >= 45 and tiempo == 3: poner(x + SW * B, bombo(), 0.22)
    x += B; k += 1

# --- vibráfono: frases cortas y distintas en cada parte (respuesta, no bucle) ---
FRASES = {
    1.2:  [(0, 76), (0.64, 79), (1, 81), (2, 79), (2.64, 76)],
    13.5: [(0, 72), (0.5, 74), (1, 76), (1.64, 79), (3, 77), (3.64, 76)],
    23.5: [(0, 81), (1, 79), (1.64, 77), (2, 76), (3, 74)],
    31.5: [(0, 74), (0.64, 77), (1, 81), (2, 84), (2.64, 81), (3, 79)],
    39.5: [(0, 79), (0.5, 77), (1, 76), (1.64, 74), (2.5, 72)],
    46.0: [(0, 74), (0.64, 77), (1, 79), (1.64, 82), (2, 81), (3, 79), (3.64, 77)],
    52.0: [(0, 81)], 53.5: [(0, 84)], 55.0: [(0, 86)], 56.5: [(0, 88)],
    58.6: [(0, 76), (0.25, 79), (0.5, 84), (0.75, 88)],
}
for ini, frase in FRASES.items():
    for b, n in frase:
        poner(ini + b * B, vibra(n), 0.07)

# final: acorde abierto que se queda sonando
for k, n in enumerate([41, 53, 64, 67, 69, 72, 76]):
    poner(58.5 + k * 0.03, rhodes(n, 6.0, 1.0) if n > 50 else bajo(n, 4.0), 0.05 if n > 50 else 0.22)
# barridos de transición, muy suaves
for x in [11.0, 21.0, 29.0, 37.0, 45.0, 52.0]:
    d = 0.9; tt = np.arange(int(d * SR)) / SR
    r = rng.standard_normal(len(tt)); r = r - suave(r, 4)
    poner(x - d, r * (tt / d) ** 3, 0.018)

# eco corto de sala (que no suene a seco de ordenador)
sala = np.zeros(N)
for retraso, g in [(0.031, 0.22), (0.047, 0.16), (0.083, 0.1), (0.121, 0.06)]:
    i = int(retraso * SR); sala[i:] += mus[:-i] * g
mus = mus + sala
mus *= np.minimum(1, t / 0.6) * np.minimum(1, (DUR - t) / 3.5)
mus = np.tanh(mus / np.max(np.abs(mus)) * 1.6) / np.tanh(1.6) * 0.9
izq = mus; der = np.roll(mus, 180) * 0.97 + mus * 0.03
with wave.open('musica.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([izq, der], axis=1) * 32767).astype(np.int16).tobytes())
print('ok')
