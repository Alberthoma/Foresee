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

## Estado final
- `landing.html` y `firestore.rules` listos y subidos a git.
- **Pendiente de acción del usuario:** publicar las reglas actualizadas de Firestore en Firebase Console para que los formularios de la landing empiecen a guardar datos de verdad (instrucciones arriba).
- Pendiente (fuera del alcance de este informe): continuar el checklist de comercialización más allá del ítem de landing page — ver `MD/Plan Comercializacion — Foresee 2.0.md`.
