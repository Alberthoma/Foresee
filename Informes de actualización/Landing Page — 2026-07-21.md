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

## Estado final
- `landing.html` queda terminado, revisado y aprobado por el usuario para publicar.
- No se tocó `index.html`, `css/`, `js/` ni `sw.js` — la app en producción no se ve afectada por este cambio.
- `land.html` (la landing anterior que sirvió de referencia) se mantiene en el repo sin cambios, como archivo de origen/inspiración.
- Pendiente (fuera del alcance de este informe): continuar el checklist de comercialización más allá del ítem de landing page — ver `MD/Plan Comercializacion — Foresee 2.0.md`.
