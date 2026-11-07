# Avisaya

App de averías para hoteles: recepción y limpieza avisan (con foto) y el técnico recibe el parte, marca que va de camino, lo repara y lo cierra.

```
avisaya/
├── supabase/01_esquema.sql   ← base de datos (pegar en Supabase → SQL Editor)
└── movil/                    ← app para iPhone y Android (Expo / React Native)
```

---

## Probar la app en tu móvil (PC con Windows)

### 1. Lo que necesitas instalado (solo la primera vez)
- **Node.js LTS**: https://nodejs.org
- **Git**: https://git-scm.com
- En el móvil, la app **Expo Go** (App Store o Google Play).

### 2. Descargar el código (solo la primera vez)
Abre **PowerShell** (botón Inicio → escribe «PowerShell»).

Primero permite que PowerShell ejecute `npm` (solo una vez; si pregunta, responde `S`):

```bash
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Si no te deja (PC de empresa), usa `npm.cmd` y `npx.cmd` en lugar de `npm` y `npx` en todos los comandos.

Después pega:

```bash
cd $HOME\Documents
```

```bash
git clone -b primera-version https://github.com/swagmadetears/avisaya.git
```

```bash
cd avisaya\movil
```

```bash
npm install
```

### 3. Arrancar
Desde la carpeta `avisaya\movil`:

```bash
npx expo start --tunnel
```

Saldrá un **código QR** en la pantalla.
- **Android**: abre Expo Go → «Scan QR code».
- **iPhone**: abre la **Cámara** y apunta al QR.

La primera vez tarda un poco en cargar. Para pararlo: `Ctrl + C`.

`--tunnel` hace que funcione aunque el móvil y el PC no estén en la misma WiFi. Si te pregunta si quieres instalar `@expo/ngrok`, responde que sí (`Y`).

### 4. Actualizar cuando haya cambios nuevos
```bash
git pull
```

```bash
npm install
```

---

## Primera vez dentro de la app
1. **Crear cuenta** con tu correo y una contraseña.
2. Pantalla «Tu hotel» → **Crear hotel**. Quedas como administrador.
3. En **Ajustes** (rueda arriba a la derecha) verás el **código del hotel**. Compártelo.
4. Para probar como técnico: en otro móvil (o cerrando sesión), crea otra cuenta → **Tengo un código** → escribe el código y elige **Técnico**.

---

## Qué hay hecho
- Cuentas con correo y contraseña.
- Hoteles con código para unirse; roles: administración, recepción, limpieza y técnico.
- Crear partes con habitación, tipo de avería, descripción, foto, prioridad y «no vender».
- El técnico: **Voy para allá → He llegado, empiezo → Resuelto** (o «Falta una pieza»). **«Me lo quedo yo»** si otro técnico está más cerca.
- Todo en tiempo real y aviso dentro de la app (con vibración) cuando llega algo.
- Cada hotel solo ve sus datos.

## Siguiente fase
- Notificaciones push con el móvil bloqueado (requiere una «development build» con EAS).
- Panel web para recepción en ordenador.
- Informes: averías por habitación y tiempos de reparación.
- Publicación en App Store y Google Play.
