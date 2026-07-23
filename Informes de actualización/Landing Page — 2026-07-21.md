# Informe — Landing Page para captación de clientela
**Fecha:** 2026-07-21

> ℹ️ Este informe **no corresponde a una versión `V F2 XXXX`** — `landing.html` es una página de marketing independiente, en la raíz del repo, que no se carga desde `index.html` ni desde ningún módulo de `js/`/`css/`. No toca el footer de versión de la app, no requiere bump de `CACHE_NAME` en `sw.js`, y no se copia a `Respaldos/`. Es parte del plan de comercialización (`MD/Plan Comercializacion — Foresee 2.0.md`), ítem "landing page".

## Solicitud del usuario
Construir una landing page atractiva para captación de clientes, conectada visualmente a la app. La primera versión (hero con maqueta de teléfono falsa, texto en Georgia serif) fue rechazada: "muy sencilla, no aporta nada, no me parece atractiva y no se conecta a la app". El usuario adjuntó `land.html` — una landing más antigua con videos reales de onboarding, ilustraciones propias de Cloudinary y una encuesta de investigación — pidiendo "algo así pero mejorado". Más tarde pidió explícitamente adaptar la landing para explicar **todas** las funciones de la app, "sencilla y detalladamente", "de forma interactiva".

También, en medio del trabajo, el usuario corrigió el registro (voseo argentino en el chat y en el copy de la landing — "usás", "conta", "compartí", "decidís") pidiendo lenguaje neutro latinoamericano (venezolano/colombiano), con "tú" en vez de "vos". Esto quedó guardado en memoria persistente (`feedback_lenguaje_neutro.md`) para todas las sesiones futuras, no solo esta.

## Análisis previo al cambio
- Se verificó que todas las URLs de Cloudinary (7 videos de onboarding + ilustraciones) referenciadas en `land.html` seguían respondiendo HTTP 200, antes de reutilizarlas.
- Se identificó, con la tabla de "Secciones" de `CLAUDE.md`, cuáles de las 12 pestañas de la app **no** tenían ningún video de onboarding ni mención explícita en la landing: Metas de Ahorro, Saldos, Configuración, Importar, y Voz como sección propia (solo se mencionaba de pasada en el paso 4 del video walkthrough).
- Se decidió no fabricar contenido para esas 5 secciones sin video — en cambio, se diseñó una sección nueva, aparte del recorrido en video, con un explorador interactivo (clic para ver detalle) que cubre las 12 secciones por igual, con los íconos reales de la app (los mismos `res.cloudinary.com/.../*.png` que usa el tab-bar en `index.html`).

## Modificaciones realizadas

### 1. Reconstrucción completa de `landing.html` (REEMPLAZO)
Se reescribió la landing tomando `land.html` como referencia de estructura y activos reales (no como copia literal):
- Nav + hero con imagen de fondo real (`.hero-bg`, opacidad 0.16), fila de estadísticas, doble CTA.
- Sección narrativa "Del peso a la salida" con ilustración real del peso de las deudas.
- Recorrido de 7 pasos en video real (`.steps-grid`), cada uno con su video y poster de Cloudinary.
- Sección de beneficios con ilustración + lista de checks + chips.
- Segunda sección narrativa ("El verdadero tesoro").
- Franja de confianza (3 tarjetas: banco no vinculado, datos aislados, sin rastreo).
- Encuesta completa de 10 preguntas (mailto a albertomatosgil@gmail.com), restyled.
- CTA final + footer con contacto.
- Paleta propia (`--bg:#0a0c11`, `--accent:#4f8fff`, `--warm:#f0b84f`) con tema claro vía `@media (prefers-color-scheme: light)`, usando los tokens reales de Gris Perla de la app.

### 2. Fix — texto del hero invisible al cargar (REEMPLAZO)
El hero tenía una animación de entrada CSS (`@keyframes rise`) que no terminaba de asentarse en cargas reales (`animationPlayState` quedaba en `running` mucho después de la duración declarada, diagnosticado con Playwright). Tras dos intentos de ajuste sin éxito, se eliminó la animación por completo — el texto ahora es visible por defecto, sin depender de timing de CSS. Se mantiene solo el bloque `@media (prefers-reduced-motion: reduce)` simplificado.

### 3. Nueva sección "Explora Foresee" — explorador interactivo de las 12 funciones (INSERCIÓN)
Sección `#funciones`, entre "Cómo funciona" y "Beneficios":
- Lista de 12 botones (uno por sección de la app: Registros, Voz, Proyección, Gastos Recurrentes, Gastos Comunes, Tarjetas y Préstamos, Metas de Ahorro, Saldos, Reportes, Presupuesto, Configuración, Importar), cada uno con el ícono real de Cloudinary que usa esa pestaña en `index.html` (Importar usa el mismo emoji ⬇ que la app, ya que ahí tampoco tiene ícono de Cloudinary).
- Panel de detalle a la derecha (debajo en mobile) que cambia con un clic, mostrando el nombre y una descripción breve y simple de qué hace esa función — en JS vanilla, sin dependencias nuevas.
- En mobile, la lista se vuelve una fila horizontal con scroll (`overflow-x: auto`), y el panel de detalle queda debajo.
- Se agregó el link "Funciones" al nav.

### 4. Corrección de lenguaje — voseo → neutro (REEMPLAZO, ~20 instancias)
Al adaptar el copy de `land.html`, se reintrodujeron sin querer expresiones de voseo (Construí, Automatizá, Registrá, Mirá, Anticipá, Reuní, convertí, Imaginá, marcá, elegí, Empezá, convertilo, Ayudanos, definí, recibí, cerrá, priorizá, ajustá, trazás, buscás, Liquidá). Se detectaron con `grep` antes de mostrarle nada al usuario y se corrigieron todas a su forma neutra con "tú" (ej. "Construí" → "Construye", "Automatizá" → "Automatiza").

## Verificación
- `grep` exhaustivo de patrones de voseo sobre `landing.html` completo — sin coincidencias reales (solo falsos positivos como "más", "buscas calma").
- Playwright headless, sirviendo con `python -m http.server 8765`:
  - Hero fresco (dark) — texto visible, sin animación rota.
  - Sección "Explora Foresee" — captura inicial (Registros activo), clic en "Metas de Ahorro", clic en "Importar" (verifica fallback de emoji + estado activo) — todas cambian correctamente el panel de detalle.
  - Recorrido completo de scroll en desktop-dark, desktop-light y mobile (390px) — sin errores de consola ni `pageerror`.
  - Sección "Explora Foresee" en tema claro — contraste y legibilidad correctos.

## Estado final (primera parte)
- `landing.html` queda terminado, revisado y aprobado por el usuario para publicar.
- No se tocó `index.html`, `css/`, `js/` ni `sw.js` — la app en producción no se ve afectada por este cambio.
- `land.html` (la landing anterior que sirvió de referencia) se mantiene en el repo sin cambios, como archivo de origen/inspiración.

---

## Actualización — mismo día, segunda ronda de cambios

### 1. Hero — imagen de la meditación + más efectos
El usuario prefirió la estética de la ilustración "El verdadero tesoro" (mujer meditando en un jardín, `10_v1xmfj.png` de `land.html`) sobre el hero original (imagen de fondo desvanecida del "camino al tesoro"). Se rehizo el hero como layout de dos columnas (texto + tarjeta de imagen), con resplandor dorado detrás de la tarjeta, animación de flotación suave, y destellos ✦ decorativos — todo respetando `prefers-reduced-motion`. Se agregaron además efectos en el resto de la página: brillo que atraviesa los botones primarios al pasar el mouse, zoom suave en las imágenes narrativas, resplandor azul en las tarjetas de video al pasar el mouse, y rebote/giro en los íconos de confianza.

**Respaldo antes de este cambio:** `Respaldos/landing.html — 2026-07-21 (version publicada, hero oscuro)/landing.html`.

### 2. Comparativa real contra 3 landing pages de la competencia
A pedido explícito del usuario ("no te solo copies y pegues... analiza bien"), se hizo `WebFetch` real (no memoria ni suposición) de YNAB, Fintonic y Goodbudget, analizando: mensaje del hero, prueba social, CTA, manejo de precio, mecanismos de captura de leads, y cómo explican la seguridad de datos bancarios. Hallazgos clave:
- Ninguna de las tres tiene una encuesta de investigación en su landing — todas van directo a un signup de un solo campo.
- YNAB y Fintonic ganan credibilidad con números de impacto reales (que Foresee no puede reclamar aún, al no tener usuarios activos) o con especificidad regulatoria concreta (número de licencia, norma PSD2) en vez de reassurance genérico.
- Ninguna de las tres muestra precio en la landing principal.

### 3. Cuatro cambios aplicados a partir de la comparativa
1. **Stat-row honesto** — se reemplazaron los stats autorreferenciales ("7 pasos guiados") por hechos estructurales verdaderos que Foresee sí puede reclamar hoy sin datos de adopción: `$0 vinculado a tu banco`, `100% tus datos, en tu cuenta`, `0 contratos ni tarjetas`.
2. **Sección de confianza con hechos técnicos concretos** (`.trust-grid`) — se reemplazó el copy genérico ("datos aislados", "sin rastreo") por las protecciones reales ya implementadas en el proyecto: reglas de seguridad de Firestore con aislamiento por usuario, y Firebase App Check contra bots.
3. **Encuesta rediseñada en 2 pasos** — el formulario de 10 preguntas obligatorias antes de dejar el contacto se reemplazó por: (a) una tarjeta principal de un solo campo (correo) como CTA primario ("Quiero probarlo →"), estilo YNAB/Fintonic/Goodbudget, y (b) un bloque `<details>` opcional ("¿Tienes 2 minutos más? Ayúdanos a mejorar Foresee") con la encuesta recortada de 10 a 6 preguntas: se eliminaron 3 preguntas que medían esencialmente lo mismo ("¿qué tan valioso/útil/cuánto cambiaría?" — sesgo conocido de preguntas hipotéticas), y el NPS ("¿lo recomendarías, 0-10?", inválido antes de usar el producto) se reemplazó por intención de prueba ("¿qué tan probable es que la pruebes este mes?").
4. **Reemplazo del envío por `mailto:`** — poco confiable en varios navegadores (falla en silencio, sobre todo mobile sin cliente de correo configurado). Ambos formularios (captura de correo y encuesta) ahora escriben directo a Firestore (mismo proyecto `wittfinances-282f1` que usa la app) vía el SDK modular de Firebase, con manejo de error que degrada con gracia a un mensaje pidiendo escribir por correo si la escritura falla.

### 4. Cambio en `firestore.rules` — requiere acción del usuario
Se agregaron dos colecciones nuevas de nivel raíz con permiso de **solo `create`** (nunca `read`/`update`/`delete` desde el cliente), con validación de campos como mitigación básica de abuso:
- `landing_leads` — captura de correo del paso 1.
- `landing_survey` — respuestas de la encuesta opcional del paso 2.

**Estas reglas están editadas en el archivo local `firestore.rules` pero no están publicadas todavía** — igual que con Firebase App Check en V F2 0006, hace falta que el usuario pegue el contenido actualizado en Firebase Console → Firestore Database → Reglas, y publique. Mientras no se haga, los formularios de la landing van a mostrar el mensaje de error de respaldo (probado y confirmado que no rompe nada, solo no guarda el dato).

## Verificación (segunda ronda)
- `node --check` sobre el script de módulo de Firebase extraído — sintaxis válida.
- Playwright: recorrido completo dark/light/mobile sin errores de consola.
- Captura de hero (dark, light, mobile) con la imagen de la meditación — sin superposición de texto.
- Sección de confianza y stat-row — capturas verificadas.
- Encuesta: captura colapsada y expandida (clic real en `<summary>`), sin errores.
- Prueba real de envío del formulario de correo contra las reglas **actuales** (todavía no actualizadas) — confirma que falla con el mensaje de respaldo esperado (no rompe la página) y que el botón se reactiva correctamente después del error.
- `grep` exhaustivo de voseo sobre todo el archivo — sin coincidencias.

## Estado final (segunda ronda)
- `landing.html` y `firestore.rules` listos y subidos a git.
- **Pendiente de acción del usuario:** publicar las reglas actualizadas de Firestore en Firebase Console para que los formularios de la landing empiecen a guardar datos de verdad (instrucciones arriba).

---

## Actualización — mismo día, tercera ronda: capturas reales de las 12 secciones

### El problema señalado por el usuario
El usuario marcó, con razón, dos fallas concretas que las dos rondas anteriores no habían resuelto:
1. La sección "Cómo funciona" seguía diciendo **"Un mapa claro, en 7 pasos"** — una frase que databa de cuando la app tenía menos herramientas. Hoy tiene 12, no 7.
2. **Las imágenes se repetían.** Solo existían 7 ilustraciones genéricas (`1`, `2`, `3`, `5`, `6`, `7`, `10` de Cloudinary) para cubrir hero + 2 secciones narrativas + beneficios + 7 tarjetas de video — matemáticamente insuficiente, así que 3 de las 7 tarjetas de "Cómo funciona" repetían poster con otra.

El usuario preguntó explícitamente si yo podía generar o mandar a crear imágenes nuevas y diferentes.

### La respuesta: no generación de imágenes — capturas reales de la app
No tengo una herramienta de generación de imágenes disponible en este entorno. En vez de eso, se tomó una vía mejor y más honesta: **capturar la interfaz real de la app** (`index.html`) con datos de ejemplo, en vez de seguir dependiendo del pool limitado de 7 ilustraciones de IA.

**Cómo se hizo:** con Playwright, sirviendo la app localmente, se importó `js/state.js` directo en el navegador y se asignaron datos de muestra realistas (transacciones, tarjetas, metas, gastos recurrentes, categorías con íconos reales, etc.) al `appState` — sin tocar Firebase Auth ni Firestore, sin loguearse con una cuenta real. Se fuerza la vista a `view-content`, se oculta el modal de login y los toasts, y se captura cada una de las 12 secciones (`data-section`) por separado. Resultado: 12 capturas reales, únicas, de la interfaz de verdad — no maquetas ni arte genérico.

Las 12 capturas quedan en `capturas-app/` en la raíz del repo (`capture-registros.png`, `capture-voz.png`, ... `capture-importar.png`).

### Cambios aplicados
1. **"Cómo funciona" reescrito**: encabezado ahora dice "El corazón del flujo, en 7 pasos", con una línea aclarando que Foresee tiene 12 herramientas en total y un link directo a "Explora las 12 →" (la sección de abajo). Los 7 posters de video se reemplazaron por 7 capturas reales, cada una distinta y correspondiente a su paso real (sin repetir ninguna).
2. **"Explora Foresee" (panel interactivo de 12 funciones)**: se agregó `feat-detail-shot`, una imagen grande con la captura real de cada sección, mostrada junto a la descripción cuando se hace clic en cada una de las 12 — antes solo mostraba un ícono pequeño de 26-56px.

### Un bug encontrado y corregido en el camino
Al usar `object-fit: cover` (el valor original) para los posters de video, la captura de "Gastos Comunes" (con una relación de aspecto inusualmente ancha, 1248×225) se recortaba exactamente en una franja vacía del centro de la imagen — se veía en negro, no por un error de carga sino por un mal recorte. Se cambió `.step-card video` de `object-fit: cover` a `object-fit: contain` (con fondo `var(--bg-2)`) para que las 7 capturas, con relaciones de aspecto muy distintas entre sí, se muestren siempre completas sin recortes accidentales.

### Verificación
- Las 12 capturas se revisaron una por una — datos de muestra coherentes (categorías con íconos reales del proyecto, bancos reales BoA/Chase/Wells Fargo, tarjetas con barra de progreso, metas de ahorro, gráficos reales de Chart.js en Reportes, etc.), sin errores de página.
- Clic real (Playwright) en los 12 botones del panel "Explora Foresee", uno por uno — sin errores de consola, cada uno actualiza correctamente ícono + título + descripción + captura grande.
- Las 7 tarjetas de "Cómo funciona" verificadas visualmente después del fix de `object-fit` — las 7 muestran contenido real y distinto, ninguna repetida.
- Recorrido completo dark/light/mobile (390px) — sin errores de consola, sin overflow horizontal.
- `grep` de voseo sobre todo el archivo — sin coincidencias.

## Estado final (tercera ronda)
- `landing.html`, `firestore.rules` y la carpeta nueva `capturas-app/` (12 archivos PNG) listos y subidos a git.
- **Pendiente de acción del usuario:** publicar las reglas actualizadas de Firestore en Firebase Console (ver ronda anterior).

---

## Actualización — mismo día, cuarta ronda: el usuario mueve la landing a su propia carpeta

El usuario reorganizó los archivos manualmente: `landing.html`, `land.html` y `capturas-app/` pasaron de la raíz del repo a una carpeta nueva, `landing/`. Al publicar este cambio se detectó y corrigió lo necesario para que la página siguiera funcionando desde su nueva ubicación:
- Los 6 links de `landing.html` que apuntaban a `index.html` (nav, hero, CTA final, footer) usaban una ruta relativa que asumía que `landing.html` vivía junto a `index.html` en la raíz. Al moverse un nivel más adentro, esa ruta ya no resolvía. Se corrigieron los 6 a `../index.html`.
- Las referencias a `capturas-app/capture-*.png` (19 en total) no necesitaron cambios — esa carpeta se movió junto con `landing.html`, así que la ruta relativa entre ambos se mantiene igual.
- `land.html` no tiene ninguna referencia local (ni a `index.html` ni a `capturas-app/`), así que no requirió ningún cambio.
- Se actualizaron las referencias de ruta en `CLAUDE.md` (de `landing.html` a `landing/landing.html`).

**Nota aparte, no relacionada con la landing:** al revisar el estado de git para este commit, se encontraron también borrados (hechos por el usuario, no por mí) 6 archivos `Temporales/1.jpeg` … `6.jpeg` — contenido que ya se había identificado en una sesión anterior como clutter sin relación con el código (imágenes sueltas). Se incluyeron en este mismo commit como parte de la limpieza, ya que el usuario los había borrado directamente del disco antes de pedir la publicación.

### Verificación
- Playwright: recorrido completo (scroll de la página completa) en desktop y mobile desde la nueva ruta `landing/landing.html`, verificando que los 6 links a `index.html` resuelvan a la ruta absoluta correcta y que ninguna de las 12 capturas ni el resto de recursos fallen al cargar (0 requests fallidos, 0 errores de consola).

## Estado final
- `landing/landing.html`, `landing/land.html`, `landing/capturas-app/` y `CLAUDE.md` actualizados y subidos a git, reflejando la nueva ubicación.
- **Pendiente de acción del usuario:** publicar las reglas actualizadas de Firestore en Firebase Console (sin cambios respecto a la ronda anterior).
- Pendiente (fuera del alcance de este informe): continuar el checklist de comercialización más allá del ítem de landing page — ver `MD/Plan Comercializacion — Foresee 2.0.md`.

---

## Actualización — 2026-07-22, quinta ronda: color por herramienta, "Descubre cómo funciona" y página secundaria

### Contexto
En la misma sesión se había redactado una guía de usuario nueva (`MD/Guia de Usuario — Foresee 2.0.md`, con versión HTML/PDF) explicando las 12 herramientas de la app en detalle (para-qué-sirve + paso a paso + simulacro), pensada para reemplazar el material del tutorial existente. A partir de esa guía, el usuario pidió tres cosas relacionadas:
1. Un botón **dentro de la app** (no en la landing) que muestre ese contenido por sección — resuelto aparte como `V F2 0012` (ver informe de esa versión).
2. Rediseñar la landing reutilizando la identidad visual de la guía.
3. Convertir la guía en una página secundaria enlazada desde la landing.

Se decidió no relanzar `landing.html` desde cero (ya había pasado por 4 rondas de ajuste con el usuario) sino aplicar la identidad de la guía de forma dirigida: color real por herramienta (los mismos valores de `--color-accent` que usa cada `#section-X` en `css/base.css`) en la única parte de la landing que mapea 1 a 1 con las 12 secciones — el explorador interactivo — más una tipografía monoespaciada para etiquetas/eyebrows, ya usada en la guía para ese mismo propósito.

### Modificaciones realizadas

#### 1. Color real por herramienta en "Explora Foresee" (`landing/landing.html`)
- Cada entrada de `FEATURES` (script al final del archivo) ahora incluye `accent` con el hex exacto que esa sección tiene en la app real (ej. Tarjetas `#f05252`, Recurrentes `#22c97a`, Presupuesto `#7c5cfc`).
- Al seleccionar una herramienta, `selectFeature()` fija `--feat-accent` en `.feat-explorer`; ese custom property tiñe el punto de color en la lista, el borde activo, el fondo del ícono, y (nuevo) el botón y panel de "Descubre cómo funciona".
- Se agregó un punto de color (`.feat-dot`) delante de cada ítem de la lista, visible en desktop (oculto en la fila horizontal de mobile para no saturar).

#### 2. Botón "Descubre cómo funciona" en el panel de detalle (INSERCIÓN)
Debajo de la descripción corta de cada herramienta (que ya existía), un botón desplegable revela paso a paso + un simulacro con datos de ejemplo — contenido adaptado de la guía de usuario, uno por cada una de las 12 herramientas, embebido en el mismo array `FEATURES`. Se colapsa automáticamente al cambiar de herramienta. Incluye un link final ("Ver la guía completa de esta herramienta →") a la página nueva, con ancla a la sección correspondiente.

#### 3. Página secundaria nueva `landing/como-funciona.html` (INSERCIÓN)
Versión de la guía restyleada con la identidad de `landing.html` (mismo `:root` de colores navy/dorado, mismo Georgia serif, mismo nav con logo y CTA) en vez de la paleta azul-primaria que usa el Artifact original de la guía — para que se sienta parte del mismo sitio, no un documento aparte. Incluye: hero corto, un TOC de chips con punto de color por herramienta, y las 12 secciones con borde de color real, para-qué-sirve, paso a paso, simulacro y "se conecta con" — generadas por JS desde un array `TOOLS` (mismo patrón de datos que `FEATURES`, sin `innerHTML`, con `createElement`/`textContent`). CTA final a `../index.html` y footer con vuelta a la landing.

#### 4. Nav actualizado (`landing/landing.html`)
Se agregó el link "Guía completa" → `como-funciona.html`, entre "Beneficios" y "Encuesta".

#### 5. Token tipográfico nuevo
`--font-mono` agregado al `:root` de ambos archivos, aplicado a `.eyebrow` (ya existente) y a las nuevas etiquetas mono ("SIMULACRO", "HERRAMIENTA") — el mismo lenguaje de "etiqueta tipo ficha" que ya usaba la guía.

### Verificación
- Playwright, sirviendo el repo completo localmente (`python -m http.server` desde la raíz, para que las rutas relativas `../index.html` y `capturas-app/` resuelvan igual que en producción):
  - Nav: el link "Guía completa" apunta a `como-funciona.html`.
  - Explorador: el color (`--feat-accent`) cambia correctamente al seleccionar distintas herramientas (verificado Registros `#4f8fff` → Tarjetas `#f05252`).
  - El botón "Descubre cómo funciona" abre/cierra el panel (`hidden` se quita/pone), los 3 pasos y el simulacro de Tarjetas se renderizan correctos, y el link de "ver guía completa" apunta a `como-funciona.html#tarjetas`.
  - `como-funciona.html`: las 12 secciones (`.tool`) se generan sin errores de consola ni `pageerror`.
  - Capturas en modo oscuro y claro (desktop) — el color por herramienta se ve consistente en ambos temas, buen contraste.
  - Mobile (390px) en ambas páginas: `scrollWidth === clientWidth` en las dos, sin overflow horizontal.
- No se tocó `firestore.rules`, ni la lógica de los formularios de leads/encuesta — siguen intactos.

## Estado final
- `landing/landing.html` (explorador con color real + desplegable) y `landing/como-funciona.html` (página nueva) listos y verificados.
- Sigue pendiente la misma acción del usuario de rondas anteriores: publicar las reglas de Firestore en Firebase Console.

---

## Actualización — 2026-07-22, sexta ronda: la imagen del hero deja de ser una tarjeta con bordes

### El problema señalado por el usuario
Tras ver la quinta ronda, el usuario fue explícito: "la landing quedó exactamente igual" — la ronda anterior solo había tocado el explorador "Explora Foresee" y el nav, sin rediseñar el resto de la página a propósito (para no adivinar a ciegas qué no le convencía). Preguntado qué específicamente no funcionaba, señaló cuatro cosas: el estilo visual en general, las animaciones/efectos, la estructura/orden del contenido, y en particular — la imagen de la mujer meditando ("el verdadero tesoro") está bien como imagen, pero **no debe verse como una tarjeta con bordes**; debe **fundirse con el fondo**, como hace `land.html` (la landing de referencia más antigua, conservada en el repo).

### Análisis
Se revisó `landing/land.html` para entender el tratamiento exacto que el usuario señalaba: su `.hero-bg` es una imagen de fondo absoluta (`position: absolute; inset: 0`), a `opacity: 0.25`, con `background-size: cover` — es decir, una textura de fondo detrás del contenido, no un elemento visual aparte. En cambio, `landing.html` (V5) usaba `.hero-visual-card`: una tarjeta con `border`, `box-shadow`, `border-radius` y animación de flotación — exactamente lo opuesto de lo que pedía el usuario.

Se descargaron y revisaron las 3 ilustraciones de Cloudinary usadas en hero + los 2 bloques narrativos ("el peso de las deudas", "el verdadero tesoro"): son imágenes generadas por IA con texto propio incrustado en los píxeles (a veces con errores de tipeo, ej. "SAILDA" en vez de "SALIDA", "ROMPECAEZAS" en vez de "ROMPECABEZAS") y, en un caso, una marca de agua "ai" en la esquina. Esto reforzó que la baja opacidad de fondo no es solo una preferencia estética: también diluye estos defectos, que se notan mucho más cuando la imagen se muestra nítida y grande en una tarjeta protagonista.

### Modificaciones realizadas (`landing/landing.html`)

1. **Nueva clase compartida `.atmosphere`/`.atmosphere-bg`** — reemplaza el patrón de tarjeta. La imagen va absoluta detrás de todo el contenido de la sección, a `opacity: 0.24` (0.16 en tema claro) con `filter: saturate(0.85) brightness(0.85)`, y un degradado (`.atmosphere::after`) que funde los bordes superior/inferior de la imagen con `var(--bg)` para que el corte con la sección siguiente no sea brusco.
2. **Hero rehecho**: de layout de 2 columnas (texto + tarjeta de imagen) a una sola columna centrada, con la imagen de la meditación como fondo atmosférico de toda la sección. Se eliminaron `.hero-visual`, `.hero-visual-card`, `.hero-visual-glow`, los 3 `.sparkle` (✦) y sus 3 `@keyframes` (`float-card`, `glow-pulse`, `twinkle`).
3. **Los dos bloques narrativos** ("Del peso a la salida" y "El verdadero tesoro") pasan del layout `.story` (grid 2 columnas, imagen en tarjeta con borde/sombra/zoom-on-hover) al mismo tratamiento `.atmosphere`: texto centrado sobre la imagen de fondo fundida, sin tarjeta.
4. **Imagen de "Beneficios" (rompecabezas)**: no encajaba en el patrón atmosférico (va junto a una lista de beneficios, necesita verse como imagen, no como textura ambiental). Se le quitó el borde/sombra duros y se le agregó una nueva clase `.benefit-img` con un `mask-image: radial-gradient(ellipse...)` que difumina las 4 esquinas — ya no es un rectángulo de bordes duros, pero sigue siendo una imagen protagonista, a diferencia del hero.
5. **Efectos genéricos removidos**: el brillo diagonal que atravesaba los botones primarios al pasar el mouse (`.btn-primary::after`), y la rotación de los íconos de confianza al hacer hover (`scale(1.2) rotate(-6deg)` → `scale(1.1)`, sin rotación). Se mantiene el único mecanismo de movimiento restante: el fade-in al hacer scroll (`.reveal`), que ya era sutil y consistente.
6. **Orden de las secciones**: se revisó pero **no se cambió** — el orden actual (Hero → problema → cómo funciona → explora → beneficios → el verdadero tesoro → confianza → encuesta → CTA) ya sigue un arco narrativo razonable (gancho → problema → mecánica/prueba → pago emocional → confianza → pedido). Si la queja de "estructura" del usuario apuntaba a otra cosa, queda pendiente de una vuelta más de feedback.

### Verificación
- Playwright, dark/light/mobile (390px), con capturas de página completa y zooms puntuales del hero, del bloque "el verdadero tesoro" y de la imagen de Beneficios.
- Confirmado visualmente: el texto del hero es legible sobre la imagen fundida en ambos temas; el corte entre secciones ya no es brusco (el degradado lo disimula); la imagen de Beneficios conserva un suavizado en las esquinas sin verse rota.
- Sin errores de consola ni `pageerror` en ninguna de las 3 capturas. `scrollWidth === clientWidth` en mobile (sin overflow horizontal).
- Se verificó que no quedaran referencias sueltas a las clases eliminadas (`hero-visual`, `sparkle`, `story-img`, `float-card`, `glow-pulse`, `twinkle`) — cero coincidencias tras el cambio.

## Estado final
- `landing/landing.html` con el hero y los dos bloques narrativos fundidos al fondo (sin tarjetas ni bordes), efectos genéricos removidos, listo para revisión del usuario.
- Sigue pendiente la misma acción de rondas anteriores: publicar las reglas de Firestore en Firebase Console.
- Pendiente de confirmar con el usuario: si "estructura/orden del contenido" se refería a algo más allá del tratamiento visual ya corregido.
