# Banda sonora del vídeo, generada con código: pad suave, pulso ligero, «toques» y barridos.
import numpy as np, wave
SR = 44100; DUR = 65.0
t = np.arange(int(SR * DUR)) / SR
out = np.zeros_like(t)
nota = lambda n: 440 * 2 ** ((n - 69) / 12)
# acordes (Am, F, C, G), 4 s cada uno, voces suaves con ataque lento
acordes = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
for i in range(int(DUR // 4) + 1):
    a, b = i * 4.0, i * 4.0 + 4.6
    m = (t >= a) & (t < b)
    tt = t[m] - a
    env = np.minimum(1, tt / 1.2) * np.minimum(1, (4.6 - tt) / 1.2)
    for n in acordes[i % 4]:
        f = nota(n)
        out[m] += 0.05 * env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt + 0.3)) * (1 + 0.15 * np.sin(2 * np.pi * 0.3 * tt))
    # bajo
    f = nota(acordes[i % 4][0] - 12)
    out[m] += 0.07 * env * np.sin(2 * np.pi * f * tt)
# pulso suave (96 ppm) desde la escena 3 hasta el cierre
bpm = 96; paso = 60 / bpm
for k in np.arange(11.0, 58.0, paso):
    m = (t >= k) & (t < k + 0.25)
    tt = t[m] - k
    out[m] += 0.12 * np.exp(-tt * 18) * np.sin(2 * np.pi * (70 - 30 * tt) * tt)
# toques del dedo
for k in [12.5, 14.3, 17.6, 19.0, 24.0, 26.2, 31.2, 33.6, 39.35]:
    m = (t >= k) & (t < k + 0.08)
    tt = t[m] - k
    out[m] += 0.18 * np.exp(-tt * 70) * np.sin(2 * np.pi * 2200 * tt)
# notificación (dos notas) al llegar el aviso y la respuesta del chat
for k in [21.7, 42.6]:
    for j, n in enumerate([84, 88]):
        a = k + j * 0.12
        m = (t >= a) & (t < a + 0.5)
        tt = t[m] - a
        out[m] += 0.08 * np.exp(-tt * 8) * np.sin(2 * np.pi * nota(n) * tt)
# barridos en los cambios de escena
rng = np.random.default_rng(3)
for k in [4.4, 10.8, 20.8, 28.8, 36.8, 44.8, 51.8, 57.8]:
    m = (t >= k - 0.5) & (t < k + 0.4)
    tt = t[m] - (k - 0.5)
    ruido = rng.standard_normal(m.sum())
    ruido = np.convolve(ruido, np.ones(40) / 40, mode='same')
    out[m] += 0.25 * np.sin(np.pi * tt / 0.9) ** 2 * ruido
# entrada y salida
out *= np.minimum(1, t / 1.5) * np.minimum(1, (DUR - t) / 2.5)
out = out / np.max(np.abs(out)) * 0.8
est = np.stack([out, np.roll(out, 220)], axis=1)
with wave.open('musica.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((est * 32767).astype(np.int16).tobytes())
print('ok')
