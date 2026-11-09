# Avisaya

App de averías para hoteles: recepción y limpieza avisan (con foto) y el técnico recibe el parte, marca que va de camino, lo repara y lo cierra.

```
avisaya/
├── supabase/01_esquema.sql         ← base de datos (pegar en Supabase → SQL Editor)
│                                     Si ya lo ejecutaste antes, vuelve a ejecutar 01, 02 y 03 en orden: se actualizan sin perder datos.
├── supabase/02_notificaciones.sql  ← avisos con el móvil bloqueado (pegar después del 01)
├── supabase/03_busqueda.sql        ← buscador de partes (pegar después del 01)
├── supabase/04_chat.sql            ← chat del equipo de cada hotel (pegar después del 03)
├── supabase/05_avisos.sql          ← avisos generales del tablón (pegar después del 04)
├── supabase/06_chats.sql           ← bandeja de chats, chat global con técnicos y «leído» (pegar después del 05)
├── supabase/07_borrar.sql          ← administración y recepción pueden eliminar partes y avisos (pegar después del 06)
├── supabase/08_registro.sql        ← los chats no se borran y lo eliminado queda en un registro (pegar después del 07)
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
- **Varios hoteles por persona**: un técnico (o cualquiera) puede unirse a varios hoteles con sus códigos (Ajustes → Añadir otro hotel) y ve todos los partes juntos, con el nombre del hotel en cada tarjeta y en cada notificación, y un selector para ver uno solo.
- Cada persona solo ve los hoteles a los que pertenece.
- **Cambio rápido de hotel**: tocando el nombre del hotel arriba; la app recuerda el último elegido.
- **Equipo** (solo administración, en Ajustes): cambiar el departamento de cada persona, darle o quitarle hoteles, nombrar más administradores y desactivar cuentas sin borrar su historial.
- **¿Olvidaste tu contraseña?** en tres pasos: correo → código → pantalla de contraseña nueva.
- **Solicitudes de acceso**: quien se registra con el código de un hotel queda pendiente; administración recibe un aviso y lo aprueba (eligiendo su departamento) o lo rechaza en Ajustes → Equipo.
- **Buscador**: por habitación, tipo de avería, texto, código (PT-…) o nombre, también en partes antiguos y sin necesidad de tildes. **Filtro por fecha** (hoy, ayer, 7 o 30 días, o un rango a elegir).
- **Detalle de cada parte** con historial y tiempos, e **informe PDF** para guardar o enviar (WhatsApp, correo…).

## Recuperar contraseña (configurar una vez en Supabase)
En Supabase → **Authentication → Emails → Reset password**, añade el código al mensaje, por ejemplo:

```
<p>Tu código para cambiar la contraseña de Avisaya es: <b>{{ .Token }}</b></p>
```

En la app: «¿Olvidaste tu contraseña?» → correo → código → pantalla para la contraseña nueva.

## Notificaciones con el móvil bloqueado
- Base de datos: ejecutar `supabase/02_notificaciones.sql` en el SQL Editor.
- No funcionan en Expo Go: hace falta la versión de desarrollo propia (`eas build --profile development`).
- En la app, **Ajustes → Avisos con la app cerrada** dice si están activos en ese móvil.

## Siguiente fase
- Panel web para recepción en ordenador.
- Informes: averías por habitación y tiempos de reparación.
- Publicación en App Store y Google Play.
