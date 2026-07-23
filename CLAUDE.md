# Foresee 2.0 — Gestor de Presupuesto Web

## Qué es Foresee 2.0
Foresee 2.0 es la **reconstrucción completa** de Foresee (la app original vive en `Proyecto-Anterior/`, single-file, ~17.800 líneas). Misma funcionalidad al 100% ("ni una función menos"), misma estética visual (tema oscuro azul-marino + tema claro "Gris Perla", mismos íconos de Cloudinary, mismos tokens de color) — pero con código depurado y modular (ES modules nativos, sin build step, sin librerías nuevas más allá de las que ya usaba el origen). Layout idéntico al origen: barra de pestañas fija arriba (un cambio a "fija abajo" se probó en V F2 0001 y se revirtió en V F2 0003 a pedido del usuario, por diferencias de estilo/comportamiento con el origen).

App web de gestión de presupuesto personal, pensada principalmente para móvil: ingresos, gastos, saldos, deudas y proyecciones futuras.

### Funcionalidades principales
- **Registro de transacciones** — ingresos y gastos con categoría, banco, fecha y descripción. Entrada por calculadora o por voz (NLP en español)
- **Categorías y bancos** — personalizables por el usuario
- **Tarjetas de crédito** — seguimiento de deuda, pagos y alertas (en pantalla + notificación nativa al 80%+ del límite)
- **Gastos comunes** — distribución de gastos compartidos entre personas
- **Gastos recurrentes** — suscripciones y pagos fijos mensuales, con auto-registro
- **Transferencias internas** — movimientos entre cuentas propias
- **Saldos** — balance en tiempo real por banco y total (motor único `lib/balances.js`)
- **Reportes y presupuesto** — tablas de ingresos/gastos con comparativa mensual
- **Proyección financiera** — estimación de saldo futuro basada en patrones
- **Importar** — CSV/Excel de bancos (BoA, Chase, Wells Fargo) y foto de extracto (OCR con Tesseract.js), con detección de duplicados y de transferencias Zelle
- **Escaneo de recibos** — OCR de un ticket de compra dentro del modal de nueva transacción
- **Exportar** — Excel (.xlsx) con 4 hojas y fórmulas, y PDF
- **Modo oscuro/claro** — con transición suave y tokens CSS
- **PWA instalable** — manifest + service worker, prompt de pantalla completa, pull-to-refresh, swipe entre pestañas
- **Notificaciones** — alertas del navegador para recordatorios (recurrentes, presupuesto, tarjetas)
- **Cambio de mes automático** — transición y archivo del ciclo mensual sin borrar histórico
- **Onboarding** — tutorial en video, datos de demo, recuperación de contraseña, selección de moneda

### Tecnologías
- **ES modules nativos** — `<script type="module">`, sin bundler ni build step
- **Firebase 11.6.1** — Auth + Firestore (`initializeFirestore` con `persistentLocalCache`), Cloud Messaging lazy-loaded para push
- **Chart.js 4.4.4** — gráficos de ingresos/gastos
- **jsPDF 2.5.1 + autotable** — exportación a PDF
- **SheetJS (xlsx) 0.18.5** — exportación a Excel
- **Tesseract.js 5** (CDN, carga lazy) — OCR de extractos bancarios y recibos
- **Web Speech API** — entrada por voz

Mismo proyecto Firebase (`wittfinances-282f1`) y mismas rutas de Firestore que el origen — **compatibilidad total de datos** con la app anterior y sus Cloud Functions.

Publicado en GitHub Pages: `https://alberthoma.github.io/Foresee/` (repo `https://github.com/Alberthoma/Foresee`)

---

## Desarrollo local

**No hay sistema de build.** ES modules nativos servidos como archivos estáticos.

Para previsualizar localmente:
- `python -m http.server 8765` desde la raíz del proyecto, o
- VS Code → extensión **Live Server** → clic derecho en `index.html`

No hay comandos de build, lint, ni tests automatizados. La verificación se hace con `node --check` sobre cada módulo (sintaxis) + pruebas manuales/Playwright en el navegador.

---

## Estado actual

- **Versión activa:** `V F2 0012` (2026-07-22) — botón "❓ Cómo funciona" agregado en la barra de acciones (visible en las 12 secciones), abre un modal con explicación paso a paso + simulacro de la sección activa, contenido centralizado en `js/lib/section-help.js` — material de apoyo al tutorial en video existente
- **Próxima versión:** `V F2 0013`
- **Archivo de entrada:** `index.html` (raíz) — carga `css/base.css`, `css/secciones.css` y `js/main.js`
- **Último informe de sesión:** `MD/Sesion 2026-07-19 — Firebase App Check y Verificacion de Email.md`
- **Último informe de actualización:** `Informes de actualización/V F2 0012 — 2026-07-22.md`
- **Último respaldo:** `Respaldos/V F2 0012 — 2026-07-22/`
- **Landing page (marketing):** `landing/landing.html` (movida por el usuario desde la raíz del repo a su propia carpeta `landing/`) — página de captación de clientes, **independiente del versionado `V F2 XXXX`** (no se carga desde `index.html`, no toca `css/`/`js/`/`sw.js`, no lleva footer de versión ni respaldo en `Respaldos/`). Sus links a la app usan `../index.html` (relativo, porque vive un nivel más adentro que antes). Ver `Informes de actualización/Landing Page — 2026-07-21.md` (tres rondas de cambios documentadas ahí). `landing/land.html` es la landing anterior que sirvió de referencia de estructura/activos; se conserva sin tocar. `landing/capturas-app/` se movió junto con `landing.html`.
  - Hero con la ilustración de "El verdadero tesoro" (mujer meditando), animaciones de flotación/resplandor/destellos, y efectos de hover en botones/tarjetas/imágenes en toda la página.
  - Stat-row, sección de confianza y encuesta rediseñados a partir de una comparativa real (`WebFetch`) contra YNAB, Fintonic y Goodbudget — ver el informe para el detalle de qué se comparó y por qué.
  - La encuesta ahora es un flujo de 2 pasos: captura de correo (un solo campo, CTA principal) + encuesta opcional de 6 preguntas (recortada de las 10 originales) detrás de un `<details>` colapsable.
  - Ambos formularios escriben a Firestore (colecciones nuevas `landing_leads` y `landing_survey`, solo `create`, ver `firestore.rules`) en vez del `mailto:` original, que era poco confiable en mobile.
  - ⚠️ **Pendiente de acción del usuario:** las reglas nuevas de `firestore.rules` (colecciones `landing_leads`/`landing_survey`) están editadas en el repo pero **no publicadas en Firebase Console todavía** — hace falta pegarlas ahí (Firestore Database → Reglas → Publicar), igual que se hizo con App Check en V F2 0006, para que los formularios de la landing empiecen a guardar datos de verdad. Mientras tanto, muestran un mensaje de error de respaldo sin romper la página.
  - **`landing/capturas-app/`** (12 archivos PNG) — capturas reales de las 12 secciones de la app (no ilustraciones de IA), generadas con Playwright + datos de muestra inyectados directo en `appState` (sin login real, sin tocar Firestore). Reemplazan los posters de video repetidos en "Cómo funciona" y alimentan la imagen grande del panel interactivo "Explora Foresee". Si se agrega una 13ª sección a la app en el futuro, hace falta regenerar/agregar su captura acá también — ver el informe del 2026-07-21 para el script y el método exacto.
  - **(2026-07-22, quinta ronda)** El panel "Explora Foresee" ahora tiñe cada herramienta con su color real de la app (mismo hex que `--color-accent` por `#section-X` en `css/base.css`) y suma un desplegable "Descubre cómo funciona" (paso a paso + simulacro) por herramienta, con link a la página nueva **`landing/como-funciona.html`** — versión restyleada (misma paleta navy/dorado de la landing) de `MD/Guia de Usuario — Foresee 2.0.md`, enlazada también desde el nav ("Guía completa"). Ver detalle en `Informes de actualización/Landing Page — 2026-07-21.md`.

> Nomenclatura `V F2 XXXX` (Foresee **2**) para no confundirla con `V FSA XXXX` del proyecto anterior — son dos apps distintas en dos repos distintos.

---

## 🗣️ Protocolo de cada petición (importante — pedido explícito del usuario, 2026-07-15)

Para cualquier petición que implique **modificar algo** (código, configuración, documentos):

1. Primero compartir opinión/sugerencias (si las hay) y un plan concreto de qué se va a hacer.
2. Esperar la aprobación del usuario.
3. Recién ahí ejecutar: modificación → verificación → reporte.

No aplica a preguntas puramente informativas (explicar algo, mostrar contenido) que no impliquen cambiar ningún archivo — esas se responden directo.

---

## 🔄 Protocolo de inicio de sesión

Antes de tocar cualquier código, en este orden:

1. Leer este `CLAUDE.md` — versión activa y estado
2. Leer el último documento en `MD/` — conocer el estado exacto de la última sesión
3. Ubicar el módulo relevante (ver tabla de arquitectura más abajo) y leerlo completo — los archivos son chicos (decenas a ~700 líneas), no hace falta leer por rangos
4. Confirmar con el usuario desde qué punto continuar
5. Nunca asumir que el trabajo anterior se completó — verificar el estado real de los archivos

---

## 📋 Protocolo de cambio — obligatorio en cada modificación

### Paso 1 — Respaldo (automático, antes de tocar nada)
Igual espíritu que el proyecto anterior (que respaldaba su único `index.html` en `Backup/`), adaptado a la arquitectura modular: como la app hoy vive repartida en ~28 archivos (`index.html` es solo el shell), un respaldo útil tiene que copiar **todo el árbol de la app**, no un solo archivo.

Antes de commitear la versión, copiar el estado que se va a publicar a `Respaldos/V F2 XXXX — YYYY-MM-DD/`:
```bash
mkdir -p "Respaldos/V F2 XXXX — YYYY-MM-DD"
cp index.html manifest.json sw.js "Respaldos/V F2 XXXX — YYYY-MM-DD/"
cp -r css js "Respaldos/V F2 XXXX — YYYY-MM-DD/"
```
Lo hace `/foresee2-commit` automáticamente — no hace falta a mano. Este respaldo es un complemento visual/manual para restaurar sin usar git (ver sección "🆘 Si algo sale mal" más abajo); **no reemplaza** al historial de git, que ya guarda una foto completa de cada versión.

> ⚠️ No usar la carpeta `backup/` (minúscula) para esto — esa ya existe y es para los documentos de planificación originales (PDF/MD), no para código. `Respaldos/` es una carpeta distinta.

### Paso 2 — Editar el/los módulo/s correspondientes
Usar **Edit** para cambios puntuales. Un archivo modular rara vez supera las ~700 líneas, así que **Write completo** es aceptable solo para archivos nuevos, nunca para reescribir uno existente con contenido significativo.

### Paso 3 — Actualizar versión en el footer
```html
<p id="app-version">Foresee 2.0 — V F2 XXXX</p>
```

### Paso 4 — Crear informe (para cambios no triviales)
Crear `Informes de actualización/V F2 XXXX — YYYY-MM-DD.md`:
```markdown
# Informe de Actualización — V F2 XXXX
**Fecha:** YYYY-MM-DD

## Solicitud del usuario
[qué pidió]

## Análisis previo al cambio
[qué se analizó antes de tocar código]

## Modificaciones realizadas
[lista numerada: qué se cambió, en qué archivo/módulo, tipo REEMPLAZO/INSERCIÓN/ELIMINACIÓN]

## Verificación
[node --check, prueba manual/Playwright, capturas si aplica]

## Estado final
[cómo quedó, si hay algo pendiente]
```
Para cambios menores (typos, ajustes de estilo puntuales) no hace falta informe — alcanza con el mensaje de commit descriptivo.

### Paso 5 — Actualizar este CLAUDE.md
- **Versión activa** → nuevo número
- **Próxima versión** → XXXX + 1
- **Último informe de sesión** → si corresponde
- **Último respaldo** → `Respaldos/V F2 XXXX — YYYY-MM-DD/`
- Agregar fila al **Historial de versiones**

### Paso 6 — Publicar
Ejecutar el skill `/foresee2-commit` — hace todo automáticamente: crea el respaldo, actualiza el footer, crea el informe (si aplica), actualiza CLAUDE.md, hace commit y push a GitHub.

---

## ⚠️ Protocolo de corrección (versión incorrecta)

Igual que en el proyecto anterior:

1. El informe de esa versión se marca al inicio: `> ⚠️ SUPERADO — El fix fue incorrecto. Ver V F2 XXXX para la solución correcta.`
2. La versión mala **no se revierte** — queda registrada con su número
3. La siguiente versión es el intento de corrección, con nota `> Corrige el intento fallido de V F2 XXXX.`

---

## 🆘 Si algo sale mal — cómo revertir

Dos formas de volver atrás, de la más simple a la más precisa. No hace falta ser experto en git para usar la primera.

### Opción A — Copiar el respaldo de archivos (la más simple)
Cada versión tiene su carpeta en `Respaldos/V F2 XXXX — YYYY-MM-DD/` con una copia completa de `index.html`, `manifest.json`, `sw.js`, `css/` y `js/` tal como quedaron en esa versión. Para volver a ese estado exacto:
1. Copiar el contenido de esa carpeta encima de la raíz del proyecto (reemplazando `index.html`, `manifest.json`, `sw.js`, `css/`, `js/`).
2. Pedirle a Claude que corra `/foresee2-commit` para publicar la vuelta atrás como una versión nueva (nunca se "borra" una versión — se corrige con una versión más, igual que el protocolo de corrección de arriba).

### Opción B — git (más preciso, permite ver un solo archivo o toda la versión)
Cada versión publicada es también un commit completo. Comandos copiables:
```bash
# Ver el historial con qué versión es cada commit
git log --oneline

# Ver exactamente qué cambió en una versión (ej: V F2 0005)
git show <hash-del-commit>

# Traer UN archivo puntual de vuelta a como estaba en otra versión, sin tocar el resto
git checkout <hash-del-commit> -- ruta/al/archivo

# Deshacer una versión entera manteniendo el historial (crea un commit nuevo que la revierte)
git revert <hash-del-commit>
```
Si no se sabe el hash, pedirle a Claude "buscá el commit de V F2 XXXX" — puede encontrarlo por el mensaje de commit (todos arrancan con `V F2 XXXX — `).

**Nunca usar `git reset --hard` ni `git push --force`** para esto salvo que el usuario lo pida explícitamente — `git revert` es igual de efectivo y no reescribe el historial.

---

## 📝 Protocolo de cierre de sesión

Mismas frases disparadoras que el proyecto anterior: *"cierra la sesión", "guarda todo lo de esta sesión", "documenta la sesión", "procede a cerrar"*.

1. Proponer un título para la sesión, confirmar con el usuario.
2. Crear `MD/Sesion YYYY-MM-DD — Titulo.md`:
   ```markdown
   # Sesión YYYY-MM-DD — Título

   **Fecha:** YYYY-MM-DD
   **Versión activa al cierre:** V F2 XXXX
   **Tipo:** [Código / Infraestructura / Documentación / Planificación / Mixta]

   ## Resumen
   [dos o tres líneas: qué se trabajó y cuál fue el resultado]

   ## [Una sección por cada tema o bloque de trabajo]
   - Contexto o punto de partida
   - Lo que se analizó o encontró
   - Decisión tomada y por qué
   - Resultado o solución aplicada

   ## Estado al cierre
   [tabla o lista: componente → estado actual]

   ## Pendiente para próxima sesión
   [si hay algo sin terminar o que requiere seguimiento]

   ## Commits de esta sesión
   | Hash | Mensaje |
   |------|---------|
   | `xxxxxxx` | mensaje |
   ```
3. Commit + push del documento (`git push origin main` normal — nunca `--force`/`--force-with-lease` para esto, este repo puede tener cambios hechos fuera de la sesión).

Si el usuario retoma la misma sesión más tarde el mismo día, actualizar el documento existente con lo nuevo en vez de crear uno duplicado.

---

## 🖥️ Git y publicación

### Configuración del repo
- **Remote:** `https://github.com/Alberthoma/Foresee.git`
- **Rama:** `main`
- **GitHub Pages:** activado, sirve desde `main` / raíz — `https://alberthoma.github.io/Foresee/`
- **Repo local:** inicializado y alineado con `origin/main` (se resolvió el 2026-07-15 — ver `MD/Sesion 2026-07-15 — Reconstruccion Foresee 2.0.md` para el detalle de esa investigación si hace falta contexto histórico).
- **`Proyecto-Anterior/`** se sube al repo como referencia (sin su propio `.git` interno, para no romper Pages con un submódulo roto — ya pasó una vez y se corrigió).
- **`backup/`** en el repo contiene los documentos de planificación originales (PDF/MD), no es un backup del código.

### Flujo para publicar cambios
Editar el/los módulo/s → ejecutar `/foresee2-commit` (hace el resto solo). Si el skill no está disponible, `git add -A && git commit -m "..." && git push origin main` manual.

---

## 🗺️ Arquitectura de la app

> 📍 **Mapa detallado de código** (qué contiene y qué exporta cada archivo `.js`/`.css`, y una guía rápida de "dónde busco esto"): ver [`MD/Arquitectura y Mapa de Código — Foresee 2.0.md`](MD/Arquitectura%20y%20Mapa%20de%20C%C3%B3digo%20%E2%80%94%20Foresee%202.0.md). Consultarlo antes de buscar a mano en qué archivo vive una función — el skill `/foresee2-mapa` hace esto automáticamente.
>
> 🗺️ **Guía para el usuario, no técnica** (ejemplos tipo "quiero cambiar el tamaño de las fuentes, ¿dónde lo hago?"): ver [`MD/Guia Rapida — Donde Modificar CSS y JS.md`](MD/Guia%20Rapida%20%E2%80%94%20Donde%20Modificar%20CSS%20y%20JS.md).
>
> 🔍 **Buscador de código** (`herramientas/buscador.html`) — herramienta interna aparte de la app, NO se publica en producción. Le escribís al usuario "archivo:línea" para lo que busca. Si se tocó bastante código en la sesión, correr `node herramientas/build-index.js` para refrescar `herramientas/index-data.js` antes de cerrar.

### Secciones (data-section, iguales al origen)

| Sección | data-section | Módulo principal |
|---------|--------------|-------------------|
| Registros | `registros` | `js/secciones/registros.js` |
| Voz | `voz` | `js/secciones/voz.js` |
| Proyección | `proyeccion` | `js/secciones/proyeccion.js` |
| Gastos Recurrentes | `recurrentes` | `js/secciones/recurrentes.js` |
| Gastos Comunes | `gastos-comunes` | `js/secciones/comunes.js` |
| Tarjetas / Préstamos | `tarjetas` | `js/secciones/tarjetas.js` |
| Metas de Ahorro | `metas` | `js/secciones/metas.js` |
| Saldos | `saldos` | `js/secciones/saldos.js` |
| Reportes | `reportes` | `js/secciones/reportes.js` |
| Presupuesto | `presupuesto` | `js/secciones/presupuesto.js` |
| Configuración | `configuracion` | `js/secciones/configuracion.js` |
| Importar | `importar` | `js/secciones/importar.js` |

### Estado global `appState` (`js/state.js`)

Mismos campos que el origen (`transactions`, `projections`, `recurringExpenses`, `creditCards`, `gastosComunes`, `categories`, `banks`, `descriptions`, `categoryBudgets`, `openingBalance`, `userAlias`, `currency`, `notificationsEnabled`/`emailRemindersEnabled`/`pushRemindersEnabled`, `budgetAlertsShown`, `lastMonthProcessed`, `filterMonth`/`filterBank`/`filterCategory`, `currentTab`, `currentUser`) más `savingsGoals` (V F2 0008, Metas de Ahorro — no existía en el origen).

Patrón pub-sub: `onStateChange(fn)` registra renderers, `scheduleRenderAll()` los dispara con debounce de 50ms tras cada `onSnapshot` de Firestore.

### Estructura de archivos

```
index.html                  — shell: head, body, templates, todos los modales
css/base.css                 — tokens, tema oscuro/claro, header, tab-bar, modal base, footer
css/secciones.css            — estilos específicos de cada sección
js/firebase.js                — único punto de import del SDK de Firebase
js/state.js                   — appState + listeners de Firestore + scheduler de render
js/main.js                    — bootstrap: auth, navegación, wiring global
js/lib/                       — helpers compartidos entre secciones
  ui.js                        — modal manager genérico, toasts, fillSelect, tema
  balances.js                  — motor único de saldos (reemplaza 5 implementaciones del origen)
  utils.js                     — formatCurrency, fechas, sharesDescriptionWord, etc.
  calc-modal.js                — calculadora unificada (Registros + Proyección)
  category-modal.js            — selector de categoría + buildCatDisplay
  import-pipeline.js           — parseo CSV/XLSX, cleanBankDescription, dedup, Zelle
  ocr.js                        — Tesseract.js: extracto bancario + recibos
  recurring-engine.js           — auto-registro de recurrentes
  month-transition.js           — cambio de mes / archivo
  exports.js                    — Excel/PDF
  voice-parser.js + number-parser.js — NLP de voz en español
  notifications.js, icons.js, pwa.js
js/secciones/                 — un módulo por pestaña (ver tabla arriba) + dashboard.js, onboarding.js
manifest.json, sw.js           — PWA
Proyecto-Anterior/              — la app original completa, se mantiene como referencia
```

---

## 🤖 Skills disponibles

| Skill | Cuándo usarlo |
|---|---|
| `/foresee2-commit` | Al terminar cualquier cambio — actualiza footer, informe, CLAUDE.md, commit y push |
| `/foresee2-mejora-done` | Al completar una mejora del plan de mejoras (si se retoma `MD/plan-mejoras.md`) |

No existe un equivalente a `foresee-find` del proyecto anterior — no hace falta: con archivos modulares de cientos de líneas (no 17.000+), `Grep`/`Glob` directo alcanza sin estrategia especial de búsqueda por rangos.

### Reinstalar skills (si se pierden)
Los fuentes están en `skill/` dentro de este proyecto:
```bash
cp "skill/foresee2-commit/SKILL.md" "$HOME/.claude/skills/foresee2-commit/SKILL.md"
cp "skill/foresee2-mejora-done/SKILL.md" "$HOME/.claude/skills/foresee2-mejora-done/SKILL.md"
```

---

## Directrices de código

### Entrega de código
- **Nunca** entregar código truncado — siempre bloques completos
- Indicar archivo y tipo de cambio (REEMPLAZO / INSERCIÓN / ELIMINACIÓN)
- Describir en 1-2 líneas qué hace cada bloque y por qué

### Interfaz y estilos
- Preservar la estética visual exacta del origen (paleta, íconos Cloudinary, tokens)
- **CSS puro** — sin Tailwind, Bootstrap ni librerías externas
- **Mobile-first** — breakpoints: 480px, 640px, 768px, 1024px, 1280px
- Layout idéntico al origen — tab-bar fija arriba (el intento de moverla abajo en V F2 0001 se revirtió en V F2 0003)

### Seguridad
- No insertar datos del usuario en el DOM vía `innerHTML` — usar `createTextNode`/`textContent`
- Solo `console.error` para errores reales — no `console.log`
- Validar inputs antes de enviar a Firestore
- No usar `eval()`, `new Function()` con datos dinámicos, ni `innerHTML` con datos del usuario

### Rendimiento
- Una sola pasada de array (`reduce`) sobre múltiples `filter` + `map`
- Event delegation en listas dinámicas
- No acumular listeners — verificar que no se re-adjunten en cada render

### Convenciones
- No usar `window.*` para comunicación entre módulos — `import`/`export` de ES modules
- No agregar dependencias externas sin consultarlo primero
- No agregar abstracciones/generalidad no pedida — priorizar código directo y legible sobre el patrón "por si acaso"
- Reutilizar helpers ya existentes en `js/lib/` antes de reimplementar (ej. `formatCurrency`, `sharesDescriptionWord`, el modal manager) — el origen tenía patrones duplicados 5-8 veces; esta reconstrucción existe justamente para no repetir eso

### Verificación antes de reportar terminado
- `node --check` sobre cada módulo tocado (sintaxis de ES modules)
- Servir localmente y probar con Playwright headless cuando no hay forma de loguearse con una cuenta real (mock de `appState` vía `import("/js/state.js")`)
- Para cambios visuales/responsive: capturar a 390px de viewport y verificar `scrollWidth === clientWidth` (sin overflow horizontal)

---

## Historial de versiones

| Versión | Fecha | Cambio |
|---------|-------|--------|
| V F2 0001 | 2026-07-15 | Reconstrucción completa de Foresee (origen: `Proyecto-Anterior/`, V FSA 0061) en 9 fases: esqueleto, registros, recurrentes+proyección, saldos+reportes+presupuesto, tarjetas+comunes, configuración, voz, importar (CSV/Excel/OCR), PWA+cierre. Misma funcionalidad, misma estética, arquitectura modular con ES modules. Publicado en `alberthoma.github.io/Foresee`. |
| V F2 0002 | 2026-07-15 | Fix cierre de formularios (x cierra directo, confirm-modal con z-index corregido para el clic en el fondo), fix pantalla completa al cerrar sesión, fix "Total banco" cortado en Recurrentes mobile, fix padding de bordes en 4 tablas mobile. |
| V F2 0003 | 2026-07-16 | Tab-bar de vuelta a `top` (revierte el cambio de layout de V F2 0001, ahora idéntica al origen): sin borde, fondo transparente, botones de altura uniforme. Eliminada por completo la función de swipe entre pestañas (`js/lib/pwa.js`) — no existía en el origen y provocaba que el usuario saliera de la app al deslizar hacia la derecha. |
| V F2 0004 | 2026-07-16 | Bump de `CACHE_NAME` en `sw.js` (v5→v6) — V F2 0003 no llegaba a los usuarios con caché previa porque el service worker sirve CSS/JS `cache-first`. Se agregó este paso al protocolo de `/foresee2-commit` para futuras versiones que toquen `.css`/`.js`. |
| V F2 0005 | 2026-07-18 | En Registros/Proyección, la fila completa ahora se despliega al tocarla (reemplaza el botón "i" de banco/descripción). Íconos de categoría más grandes en mobile en las 4 tablas que los usan (Registros, Proyección, Recurrentes, Presupuesto). Bump de `CACHE_NAME` (v6→v7). |
| V F2 0006 | 2026-07-19 | Firebase App Check inicializado en `js/firebase.js` (ReCaptchaV3Provider) — modo monitor, no bloquea nada todavía hasta que el usuario active "Enforce" en Firebase Console. Bump de `CACHE_NAME` (v7→v8). |
| V F2 0007 | 2026-07-19 | Recordatorio de verificación de email: correo automático al registrarse (`sendEmailVerification`) + aviso descartable en el dashboard (no bloquea el uso de la app). Bump de `CACHE_NAME` (v8→v9). |
| V F2 0008 | 2026-07-19 | Nueva pestaña "Metas de Ahorro" (`js/secciones/metas.js`, primera pestaña nueva desde la reconstrucción): monto objetivo, fecha opcional, barra de progreso, aportes manuales — reutiliza casi toda la familia de clases CSS `.cc-card-*` de Tarjetas. Nueva colección Firestore `savingsGoals`. Bump de `CACHE_NAME` (v9→v10). |
| V F2 0009 | 2026-07-19 | Fix: Chrome ofrecía guardar como contraseña los campos numéricos "Ahorrado"/"Objetivo" (Metas) y los 4 campos inline de Tarjetas — 2 campos numéricos adyacentes sin `autocomplete` calzan con el patrón que Chrome usa para detectar un login. Se agrega `autocomplete="off"` a los 6 inputs. Solo toca `index.html` (sin CSS/JS), no requiere bump de `CACHE_NAME`. |
| V F2 0010 | 2026-07-19 | El backup JSON de Configuración (exportar/importar) ahora incluye `gastosComunes` y `currency` — faltaban comparado con todo lo que guarda `appState`. `gastosComunes` se restaura aparte (es un documento único, no una colección, no encaja en el helper `importCol` existente). Bump de `CACHE_NAME` (v10→v11). |
| V F2 0011 | 2026-07-19 | Pestaña "Tarjetas de Crédito" renombrada a "Tarjetas y Préstamos" (Deudas y Préstamos del plan de comercialización resuelto sin sección nueva — los mismos campos de una tarjeta sirven para un préstamo). Fix: el botón "⚙ Filtros" de Proyección y Reportes no tenía ningún listener (solo Registros lo tenía, scopeado a sí mismo) — se centralizó en `js/main.js` para cubrir los tres. Bump de `CACHE_NAME` (v11→v12). |
| V F2 0012 | 2026-07-22 | Botón "❓ Cómo funciona" agregado una sola vez en `#action-bar` (visible en las 12 secciones) — abre un modal genérico (`#section-help-modal`) con para-qué-sirve + paso a paso + simulacro de la sección activa. Contenido nuevo en `js/lib/section-help.js` (separado de `index.html`/`main.js`, mismo patrón que `js/lib/icons.js`), adaptado de la guía de usuario redactada en esta sesión (`MD/Guia de Usuario — Foresee 2.0.md`). Bump de `CACHE_NAME` (v12→v13). |

---

## Deuda técnica / pendiente
- **`x Foresee`** (carpeta duplicada con `.git` propio) fue eliminada el 2026-07-15 tras confirmar que no tenía nada que no estuviera ya en GitHub o en esta carpeta
- **Sin tests automatizados** — verificación manual + Playwright ad-hoc, igual que el origen
- **Repo de GitHub** trae de más `Proyecto-Anterior/` completo (imágenes, videos, backups del app viejo) y una carpeta `backup/` con documentos de planificación — no rompe nada pero infla el tamaño del repo (~6MB); queda como está a pedido del usuario
- **"Reinicio" de la app al cambiar de pestaña del navegador** — sospecha fuerte de que es un artefacto de Live Server (recarga al reconectar su WebSocket), no un bug de la app (no hay ningún listener de `visibilitychange`/`focus`/`reload` en el código). Falta confirmar probando en `alberthoma.github.io/Foresee` fuera de Live Server. Ver detalle en `MD/Sesion 2026-07-18 — Fixes de UI-PWA y Plan de Comercializacion.md`.
- **Comercialización en marcha** — checklist de 21 pasos en `MD/Plan Comercializacion — Foresee 2.0.md` (también como [checklist interactivo](https://claude.ai/code/artifact/70baf7d7-8d72-45a1-b20f-071318d3e7f0)). Firebase App Check ya inicializado (V F2 0006), pendiente que el usuario active "Enforce" en Firebase Console tras confirmar unos días sin problemas. Recordatorio de verificación de email (V F2 0007) y Metas de Ahorro (V F2 0008) ya agregados. Landing page (`landing/landing.html`) ya construida y publicada el 2026-07-21 — ver bullet en "Estado actual" arriba. Próximo ítem: voz en inglés o analítica (ver orden actualizado en el plan).
