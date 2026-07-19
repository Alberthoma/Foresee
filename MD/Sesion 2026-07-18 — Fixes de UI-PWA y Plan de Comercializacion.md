# Sesión 2026-07-18 — Fixes de UI/PWA y Plan de Comercialización

**Fecha:** 2026-07-18
**Versión activa al cierre:** V F2 0005
**Tipo:** Mixta (Código, Infraestructura, Planificación)

## Resumen
Se revirtió el layout de la tab-bar a como estaba en el origen (V F2 0003), se corrigió un problema de caché del service worker que impedía que los cambios llegaran a usuarios con visitas previas (V F2 0004), se rediseñó la interacción de Registros/Proyección — fila desplegable en vez de botón "i", íconos de categoría más grandes en mobile (V F2 0005). Aparte, se agregó un protocolo de respaldo que faltaba desde la migración del proyecto original, se auditó `CLAUDE.md` contra el del proyecto anterior, y arrancó formalmente el plan de comercialización de la app: seguridad de Firestore revisada y corregida, checklist interactivo, posicionamiento de mercado.

## 1. Tab-bar de vuelta a top + eliminación del swipe
- El usuario reportó 4 diferencias vs. el origen: tab-bar abajo en vez de arriba, botones de altura inconsistente en mobile, un borde que el origen no tiene, y un swipe que a veces sacaba de la app al deslizar a la derecha.
- Se comparó línea por línea contra `Proyecto-Anterior/index Origen.html` para encontrar la causa exacta de cada uno: el cambio deliberado de layout de V F2 0001 (posición), `align-items: center` agregado a `#tab-bar` (altura), `border-top` + `background-color` agregados (borde), y una función `setupSwipeNavigation` nueva en `js/lib/pwa.js` sin ningún equivalente en el origen (el swipe) — con listeners `passive: true` que competían con el gesto nativo de "volver atrás" del navegador.
- **V F2 0003:** tab-bar revertida a `top`, sin borde, altura uniforme, swipe eliminado por completo (−40 líneas netas, sin dejar código muerto).

## 2. Caché del service worker no invalidada
- El usuario reportó que en el teléfono no veía el fix de V F2 0003 aunque el footer ya mostraba la versión nueva.
- Causa: `sw.js` sirve todo excepto el documento HTML con `cache-first`; `CACHE_NAME` no se había incrementado, así que `css/base.css` y `js/lib/pwa.js` seguían sirviéndose desde la caché vieja.
- Se explicó por qué esto nunca hacía falta en el proyecto original: ahí todo el CSS/JS vivía inline en `index.html`, que el service worker siempre sirve de la red — nunca pasaba por la rama cacheada. En Foresee 2.0, la modularización (mejora real de mantenibilidad) hace que los archivos externos sí queden atrapados en caché.
- **V F2 0004:** bump de `CACHE_NAME` (v5→v6), y se agregó el paso al protocolo de `/foresee2-commit` para que futuras versiones que toquen `.css`/`.js` no repitan el problema.

## 3. Filas desplegables + íconos de categoría más grandes
- Pedido: sacar el botón "i" de banco/descripción en Registros/Proyección y usar la fila completa como desplegable (tap para expandir), para poder agrandar el ícono 3D de categoría en mobile.
- Se reutilizó el helper `toggleInfoRow` (`js/lib/ui.js`) ya existente — solo cambió el disparador, de un botón a la fila entera, excluyendo checkbox, categoría editable y descripción editable (que conservan su propio comportamiento).
- Al liberar la columna de banco en mobile, se extendió el mismo agrandado de ícono (22px→34px) a Recurrentes y Presupuesto, que comparten la clase `.cat-display` pero nunca tuvieron botón "i".
- **V F2 0005:** −13 líneas netas. Verificado con Playwright headless (mock de `appState`, sin login real) en las 4 tablas, mobile y desktop.

## 4. Protocolo de respaldo (faltaba desde la migración)
- El usuario notó que el proyecto anterior respaldaba su único `index.html` completo antes de cada versión (`Backup/antes de V FSA XXXX.html`, automatizado en el `.bat` de push), y que ese paso no se había portado a Foresee 2.0 al modularizar la app.
- Se agregó un respaldo equivalente de **todo el árbol de la app** (no un solo archivo, ya que ahora son ~28 archivos) en `Respaldos/V F2 XXXX — FECHA/`, automatizado como nuevo Paso 1 de `/foresee2-commit`.
- Se agregó una sección "🆘 Si algo sale mal" en `CLAUDE.md` con dos vías de reversión: copiar el respaldo de archivos (sin git), o comandos de git copiables (`git show`, `git checkout -- archivo`, `git revert`) — pensada para un usuario que no es experto en git.
- Se creó el respaldo base de la versión activa (`Respaldos/V F2 0005 — 2026-07-18/`).

## 5. Auditoría de CLAUDE.md contra el proyecto anterior
- A pedido del usuario, se revisó `Proyecto-Anterior/CLAUDE.md` línea por línea buscando protocolos que no se hubieran portado a Foresee 2.0.
- Se corrigieron dos notas obsoletas en `CLAUDE.md` (todavía decían "repo local sin inicializar", desactualizado desde el 2026-07-15).
- Se portó la plantilla completa de cierre de sesión (con tabla de commits hash/mensaje y el campo "Versión activa al cierre") — **sin** portar el uso de `git push --force-with-lease` que tenía el proyecto original en ese paso, porque ese mismo proyecto ya había identificado que este repo puede tener cambios hechos fuera de la sesión.
- Quedaron identificadas pero sin recrear (no había contenido fuente que rescatar) dos secciones que si tenía el proyecto anterior: "Plan de Comercialización" y "Mejoras planificadas" — se retomó la primera en el punto 6 de esta sesión.

## 6. Plan de comercialización
- El usuario pidió una opinión honesta sobre si la app está lista para comercializar y qué le falta frente al mercado (Mint, YNAB, Monarch Money, Copilot Money).
- Se identificó un posicionamiento de nicho real: app bilingüe (ES/EN) que no requiere vincular la cuenta bancaria a un tercero, con foco inicial en el mercado hispanohablante de EE.UU. (mayor tasa de "unbanked/underbanked" según la FDIC) — en vez de competir de frente con apps que ganan por sincronización bancaria automática (Plaid), algo que Foresee no tiene.
- **Seguridad de Firestore:** el usuario compartió las reglas reales desde Firebase Console. Se revisaron contra la estructura de rutas del código (`js/firebase.js`) — el aislamiento entre usuarios ya estaba bien implementado (nadie puede leer/escribir datos de otro usuario). Se corrigió un detalle menor (`{appId}` aceptaba cualquier valor, ahora fijo a `wittfinances-282f1`) y se llevaron las reglas al repo como código (`firestore.rules`, `firebase.json`, `.firebaserc`), algo que no existía versionado. El usuario ya publicó el fix en Firebase Console y lo confirmó con una captura.
- Se creó `MD/Plan Comercializacion — Foresee 2.0.md`: posicionamiento, hallazgo de que los Términos actuales dicen "no autorizado para uso comercial" (hay que reemplazarlos), y un checklist de 21 pasos.
- Se publicó un **checklist interactivo** (Claude Artifact) para que el usuario marque avances y reordene prioridades sin tener que pedirle a Claude que edite el documento cada vez — con botón para copiar el orden final y sincronizarlo al `.md`/PDF del repo. El usuario ya lo usó una vez para reordenar; documento, PDF y artifact quedaron sincronizados.

## Estado al cierre
| Componente | Estado |
|---|---|
| App Foresee 2.0 | ✅ V F2 0005 publicada — tab-bar, swipe y filas desplegables corregidos |
| Service worker | ✅ `CACHE_NAME` al día (v7) |
| Protocolo de respaldo | ✅ Implementado, con respaldo base ya creado |
| Seguridad de Firestore | ✅ Revisada, corregida (`appId` fijo) y publicada en Firebase Console |
| Plan de comercialización | 🔄 En marcha — checklist de 21 pasos, próximo ítem: Firebase App Check |
| "Reinicio" al volver a la pestaña | ❓ Sin confirmar — sospecha fuerte de que es un artefacto de Live Server (reload al reconectar su WebSocket), no de la app; falta probar en `alberthoma.github.io/Foresee` fuera de Live Server |

## Pendiente para próxima sesión
1. Confirmar si el "reinicio" al cambiar de pestaña ocurre también en la versión publicada (fuera de Live Server) — si no ocurre ahí, se cierra como no-bug de la app.
2. Seguir el checklist de comercialización desde el ítem 3 (Firebase App Check) — orden completo y actualizado en `MD/Plan Comercializacion — Foresee 2.0.md` (o el checklist interactivo enlazado ahí).
3. Detalle menor de seguridad dejado a propósito para el final: validar la *forma* de los datos en las reglas de Firestore (hoy solo valida quién escribe, no qué escribe).
4. Pendiente heredado de la sesión del 2026-07-15, sigue sin resolver: decidir si `backup/` y `Proyecto-Anterior/` completo se quieren seguir subiendo al repo tal cual (~6MB de más) o limpiar el historial en algún momento.

## Commits de esta sesión
| Hash | Mensaje |
|------|---------|
| `34ca0bf` | V F2 0003 — tab-bar de vuelta a top (igual que el origen), sin swipe entre pestañas |
| `d0cc2f4` | V F2 0004 — bump de CACHE_NAME en sw.js para invalidar caché vieja de CSS/JS |
| `92a58c1` | V F2 0005 — filas de Registros/Proyección desplegables al toque, íconos de categoría más grandes en mobile |
| `69c9697` | Agrega protocolo de respaldo antes de cada versión (CLAUDE.md + skill) |
| `afdf69c` | Limpia notas obsoletas de CLAUDE.md y porta protocolo de cierre de sesión del proyecto anterior |
| `1fad694` | Agrega plan de comercialización de Foresee 2.0 |
| `c98d97a` | Trae las reglas de Firestore al repo como código y reordena el plan de comercialización |
| `1f1fb53` | Marca la regla de Firestore como publicada y agrega el PDF del plan de comercialización |
| `87f25b6` | Reordena el checklist de comercialización según prioridad del usuario |
