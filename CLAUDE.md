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

- **Versión activa:** `V F2 0004` (2026-07-16) — bump de `CACHE_NAME` en `sw.js` (v5→v6) para invalidar la caché vieja de CSS/JS
- **Próxima versión:** `V F2 0005`
- **Archivo de entrada:** `index.html` (raíz) — carga `css/base.css`, `css/secciones.css` y `js/main.js`
- **Último informe de sesión:** `MD/Sesion 2026-07-15 — Reconstruccion Foresee 2.0.md`
- **Último informe de actualización:** `Informes de actualización/V F2 0004 — 2026-07-16.md`

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

### Paso 1 — Editar el/los módulo/s correspondientes
Usar **Edit** para cambios puntuales. Un archivo modular rara vez supera las ~700 líneas, así que **Write completo** es aceptable solo para archivos nuevos, nunca para reescribir uno existente con contenido significativo.

### Paso 2 — Actualizar versión en el footer
```html
<p id="app-version">Foresee 2.0 — V F2 XXXX</p>
```

### Paso 3 — Crear informe (para cambios no triviales)
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

### Paso 4 — Actualizar este CLAUDE.md
- **Versión activa** → nuevo número
- **Próxima versión** → XXXX + 1
- **Último informe de sesión** → si corresponde
- Agregar fila al **Historial de versiones**

### Paso 5 — Publicar
Ejecutar el skill `/foresee2-commit` — hace todo automáticamente: actualiza el footer, crea el informe (si aplica), actualiza CLAUDE.md, hace commit y push a GitHub.

---

## ⚠️ Protocolo de corrección (versión incorrecta)

Igual que en el proyecto anterior:

1. El informe de esa versión se marca al inicio: `> ⚠️ SUPERADO — El fix fue incorrecto. Ver V F2 XXXX para la solución correcta.`
2. La versión mala **no se revierte** — queda registrada con su número
3. La siguiente versión es el intento de corrección, con nota `> Corrige el intento fallido de V F2 XXXX.`

---

## 📝 Protocolo de cierre de sesión

Mismas frases disparadoras que el proyecto anterior: *"cierra la sesión", "guarda todo lo de esta sesión", "documenta la sesión", "procede a cerrar"*.

1. Proponer un título para la sesión, confirmar con el usuario.
2. Crear `MD/Sesion YYYY-MM-DD — Titulo.md` con: resumen, un bloque por tema trabajado (contexto → qué se encontró → decisión → resultado), estado al cierre, pendientes, commits de la sesión.
3. Commit + push del documento.

---

## 🖥️ Git y publicación

### Configuración del repo
- **Remote:** `https://github.com/Alberthoma/Foresee.git`
- **Rama:** `main`
- **GitHub Pages:** activado, sirve desde `main` / raíz — `https://alberthoma.github.io/Foresee/`

> ⚠️ **Estado al 2026-07-15:** esta carpeta (`# Reforma`, próximamente `# Foresee`) **todavía no tiene `.git` inicializado**. El contenido ya está publicado en GitHub (idéntico, verificado byte a byte salvo finales de línea), pero para hacer cambios futuros y publicarlos hay que inicializar el repo local aquí (`git init` + `git remote add origin ...` + `git branch -M main` + primer `git fetch`/`git reset` para alinear con lo que ya hay en GitHub) o clonar el repo de nuevo en esta carpeta. Ver `MD/Sesion 2026-07-15 — Reconstruccion Foresee 2.0.md` para el detalle completo de esta investigación.
- **`Proyecto-Anterior/`** se sube al repo como referencia (sin su propio `.git` interno, para no romper Pages con un submódulo roto — ya pasó una vez y se corrigió).
- **`backup/`** en el repo contiene los documentos de planificación originales (PDF/MD), no es un backup del código.

### Flujo para publicar cambios
Editar el/los módulo/s → ejecutar `/foresee2-commit` (hace el resto solo). Si el skill no está disponible, `git add -A && git commit -m "..." && git push origin main` manual.

---

## 🗺️ Arquitectura de la app

> 📍 **Mapa detallado de código** (qué contiene y qué exporta cada archivo `.js`/`.css`, y una guía rápida de "dónde busco esto"): ver [`MD/Arquitectura y Mapa de Código — Foresee 2.0.md`](MD/Arquitectura%20y%20Mapa%20de%20C%C3%B3digo%20%E2%80%94%20Foresee%202.0.md). Consultarlo antes de buscar a mano en qué archivo vive una función — el skill `/foresee2-mapa` hace esto automáticamente.

### Secciones (data-section, iguales al origen)

| Sección | data-section | Módulo principal |
|---------|--------------|-------------------|
| Registros | `registros` | `js/secciones/registros.js` |
| Voz | `voz` | `js/secciones/voz.js` |
| Proyección | `proyeccion` | `js/secciones/proyeccion.js` |
| Gastos Recurrentes | `recurrentes` | `js/secciones/recurrentes.js` |
| Gastos Comunes | `gastos-comunes` | `js/secciones/comunes.js` |
| Tarjetas / Préstamos | `tarjetas` | `js/secciones/tarjetas.js` |
| Saldos | `saldos` | `js/secciones/saldos.js` |
| Reportes | `reportes` | `js/secciones/reportes.js` |
| Presupuesto | `presupuesto` | `js/secciones/presupuesto.js` |
| Configuración | `configuracion` | `js/secciones/configuracion.js` |
| Importar | `importar` | `js/secciones/importar.js` |

### Estado global `appState` (`js/state.js`)

Mismos campos que el origen: `transactions`, `projections`, `recurringExpenses`, `creditCards`, `gastosComunes`, `categories`, `banks`, `descriptions`, `categoryBudgets`, `openingBalance`, `userAlias`, `currency`, `notificationsEnabled`/`emailRemindersEnabled`/`pushRemindersEnabled`, `budgetAlertsShown`, `lastMonthProcessed`, `filterMonth`/`filterBank`/`filterCategory`, `currentTab`, `currentUser`.

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

---

## Deuda técnica / pendiente
- **Repo local sin inicializar** en esta carpeta — ver nota en "Git y publicación"
- **`x Foresee`** (carpeta duplicada con `.git` propio) fue eliminada el 2026-07-15 tras confirmar que no tenía nada que no estuviera ya en GitHub o en esta carpeta
- **Sin tests automatizados** — verificación manual + Playwright ad-hoc, igual que el origen
- **Repo de GitHub** trae de más `Proyecto-Anterior/` completo (imágenes, videos, backups del app viejo) y una carpeta `backup/` con documentos de planificación — no rompe nada pero infla el tamaño del repo (~6MB); queda como está a pedido del usuario
