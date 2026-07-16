# Sesión 2026-07-15 — Reconstrucción completa de Foresee 2.0

**Fecha:** 2026-07-15
**Versión activa al cierre:** V F2 0001
**Tipo:** Código + Infraestructura (git/deploy)

## Resumen

Se reconstruyó desde cero la app Foresee (origen: `Proyecto-Anterior/index.html`, un único archivo de ~17.800 líneas, V FSA 0061) como **Foresee 2.0**: misma funcionalidad al 100%, misma estética visual, pero con código modular (ES modules nativos, sin build step). El trabajo se hizo en 9 fases siguiendo el plan de `Claude_Plan.MD`. Al cierre, la app está completa y publicada en `https://alberthoma.github.io/Foresee/`. También se resolvió una investigación de infraestructura sobre por qué el sitio no cargaba, y se limpió una carpeta duplicada del proyecto.

## Qué es Foresee

App web de gestión de presupuesto personal (mobile-first): registro de transacciones (calculadora o voz), categorías/bancos personalizables, tarjetas de crédito, gastos comunes y recurrentes, transferencias internas, saldos en tiempo real, reportes y presupuesto por categoría, proyección financiera, importación de extractos bancarios (CSV/Excel/foto con OCR), escaneo de recibos, exportación a Excel/PDF, modo oscuro/claro, PWA instalable, notificaciones, y cambio de mes automático. Usa Firebase (Auth + Firestore) como backend — mismo proyecto (`wittfinances-282f1`) y mismas rutas que la app original, para compatibilidad total de datos.

## Mandato de diseño

Confirmado explícitamente al inicio: preservar la estética visual al 100% (mismo tema oscuro/claro "Gris Perla", mismos íconos Cloudinary, mismos tokens de color). Único cambio de layout aprobado: mover la barra de pestañas de arriba a abajo (fija). Simplificaciones aprobadas del plan: unificar los formularios de nueva/editar transacción y proyección en un solo modal calculadora; un solo motor de cálculo de saldos (antes duplicado 5 veces); eliminar código muerto (`exportCSV`, tokens CSS duplicados, etc.); unificar patrones repetidos (`fillSelect`, apertura/cierre de modales, filas de info, botones de selección).

## Las 9 fases (build → verify → report, con confirmación del usuario entre cada una)

1. **Esqueleto** — estructura base, tema oscuro/claro, tab-bar inferior, auth, dashboard.
2. **Registros** — calculadora unificada, categorías, transferencias, saldo corrido.
3. **Recurrentes + Proyección** — auto-registro con cooldown de 60s, reutiliza la calculadora.
4. **Saldos + Reportes + Presupuesto** — motor único de saldos (`lib/balances.js`), 7 bloques de reportes con Chart.js.
   - 🐛 Bug reportado por el usuario con capturas: Presupuesto y Reportes no eran responsivos en móvil. Diagnosticado y corregido (ver sección de bugs abajo).
5. **Tarjetas + Gastos Comunes** — amortización francesa, distribución equal/percentage/manual.
6. **Configuración** — CRUD de categorías/bancos/descripciones, exportar JSON/Excel, eliminar cuenta.
7. **Voz** — parser NLP en español (fechas, montos, categorías por fuzzy match).
   - 🐛 Bug autodescubierto probando la propia frase de ejemplo de la app: monto duplicado (15+15=30 en vez de 15.45). Corregido y **explícitamente informado al usuario** en vez de arreglarlo en silencio, dado el mandato de "misma funcionalidad exacta". Ver detalle abajo — probablemente el bug también existe en el origen.
8. **Importar (CSV/Excel/OCR)** — el pipeline más complejo: `cleanBankDescription`, detección de banco, `pairZelleRows`, detección de duplicados, OCR de extracto (parser de escritorio + fallback móvil), escáner de recibos. Se leyó primero `Proyecto-Anterior/MD/Pipeline de Importación CSV — Referencia.md` (las 12 lecciones aprendidas) antes de tocar código, tal como indica ese documento.
9. **PWA + cierre** — manifest.json/sw.js (copiados casi intactos del origen), pantalla completa, pull-to-refresh, swipe entre pestañas, y una **auditoría de paridad completa**: diff de todos los `id` de HTML entre origen y reconstrucción + cruce de todos los call-sites de `sendBrowserNotification`. Esto encontró y corrigió **3 funciones que se habían saltado en fases anteriores** (ver abajo) — no eran parte del plan de fases, se detectaron solo por la auditoría sistemática al cierre.

## Bugs y gaps encontrados (y cómo)

| # | Qué | Cómo se encontró | Fix |
|---|---|---|---|
| 1 | `#budget-table` sin CSS mobile + `max-width:0` heredado rompía el ancho de la columna "Totales" | Usuario probó en su celular y mandó capturas | Regla `nth-child` específica + `max-width:none` |
| 2 | `.rep-savings-row` cambiaba de 2 a 1 columna por orden de cascada CSS a ≤480px | Mismo reporte del usuario | Reafirmar la regla dentro del media query de 480px |
| 3 | Voz: "el quince... por quince con cuarenta y cinco" daba $30.45 en vez de $15.45 | Autodescubierto probando la frase de ejemplo del propio hint de la UI | `parseSpanishNumber(rem)` en vez de `parseSpanishNumber(norm)` — evita contar "quince" dos veces (una de la fecha, otra del monto) |
| 4 | Tarjetas "Ingresos"/"Gastos" del dashboard no abrían la calculadora directo (solo navegaban a Registros) | Auditoría de paridad de IDs en Fase 9 | Abrir `calc-modal` pre-configurado income/expense, igual que el origen |
| 5 | `checkCreditCardNotifications` (notif nativa al 80%+ del límite de una tarjeta) faltaba por completo | Auditoría de paridad de IDs en Fase 9 | Portada a `tarjetas.js`, registrada vía `onStateChange` |
| 6 | Bloque entero de Filosofía/Privacidad/Términos/Cookies (botones + 4 modales + footer) faltaba — no estaba en ninguna fase del plan original | Auditoría de paridad de IDs en Fase 9 | Portado completo, reutilizando el modal manager genérico en vez de los ~8 listeners manuales del origen |

**Nota sobre el bug #3:** se confirmó que la lógica portada era una copia fiel del algoritmo original (no se alteró nada al portarlo), lo que sugiere que este bug probablemente existe también en `Proyecto-Anterior/index.html` — no se tocó ese archivo (fuera de alcance), pero vale la pena saberlo si se retoma esa app.

## Infraestructura — la saga de GitHub Pages

Después de cerrar las 9 fases, el usuario preguntó por un archivo `bash.sh` suelto en la raíz (un script de push apuntando al repo viejo `Alberthoma/Foresee-App` — no lo generé yo, se eliminó sin problema, no tenía ninguna referencia desde el código).

Luego surgió el problema real: **"no puedo cargar la app en la web desde mi repo"**. Investigación:

1. El usuario había creado un repo nuevo, `Alberthoma/Foresee` (vacío según él en un primer momento).
2. `git ls-remote` mostró que **no estaba vacío** — ya tenía un commit con el contenido completo de Foresee 2.0, byte a byte idéntico a esta carpeta (única diferencia: finales de línea CRLF, inofensivo).
3. GitHub Pages devolvía 404 — no estaba activado. Se le indicó activarlo manualmente (Settings → Pages → branch `main` / root), porque requiere su sesión de GitHub.
4. El usuario mandó una captura del 404 genérico de GitHub después de intentarlo.
5. Se descubrió una carpeta paralela **`x Foresee`** (con `.git` propio conectado al mismo repo) que el usuario había creado por su cuenta, con **6 commits en `origin/main` que esta sesión no conocía** — incluyendo uno crítico: *"Corrige despliegue de GitHub Pages: elimina submódulo roto Proyecto-Anterior"*. Es decir: **alguien (el usuario, u otra sesión/herramienta) ya había diagnosticado y corregido el problema real** — `Proyecto-Anterior` se había subido como submódulo git roto, lo que rompía el build de Pages.
6. Se re-verificó `https://alberthoma.github.io/Foresee/` → **200 OK**. El sitio ya estaba funcionando.
7. Se confirmó que `x Foresee` no tenía nada insustituible (su único commit sin subir era un volcado gigante de 349 archivos, en su mayoría contenido de `Proyecto-Anterior` ya presente en otro lado) y se eliminó a pedido del usuario.
8. Se intentó renombrar `# Reforma` → `# Foresee` (pedido del usuario) pero Windows lo bloquea con "en uso" — casi seguro porque VSCode tiene la carpeta abierta como workspace y mantiene el handle. **No se pudo completar.**

### ⚠️ Importante — por qué no se renombró la carpeta
Esta sesión de Claude Code (y la memoria persistente asociada) está indexada por la ruta exacta `d:\$$$ Proyectos\# Reforma`. Si se renombra la carpeta:
- El código de la app **no se rompe** (nada depende del nombre de la carpeta padre).
- Esta conversación específica **no se puede retomar** apuntando a la ruta nueva.
- La memoria de Claude para este proyecto (indexada por ruta) **no se transfiere automáticamente**.

Por eso se creó este documento y se actualizó `CLAUDE.md` **dentro del proyecto** — sobreviven a cualquier rename porque viajan con los archivos, a diferencia de la memoria del sistema (atada a la ruta vieja).

## Cómo le gusta trabajar al usuario (observado en esta sesión)

- Dirige el avance por fases, confirmando con "continua" al final de cada reporte — espera un reporte claro de cierre de fase antes de seguir, no que se sigan encadenando cambios sin pausa.
- Prueba personalmente con su cuenta real y manda capturas cuando algo falla — espera que la verificación (build → verify → report) sea proactiva de mi parte también, no solo reactiva a sus reportes.
- Prefiere que los bugs encontrados (incluso los sutiles, como el de voz) se le informen explícitamente en vez de corregirlos en silencio — especialmente cuando el mandato es "misma funcionalidad exacta".
- Es metódico con el proceso: el proyecto anterior tiene protocolos explícitos (inicio de sesión, cambio, corrección, cierre de sesión), versionado incremental con changelog, informes por cambio, y skills para automatizar lo repetitivo. Esta reconstrucción adoptó el mismo espíritu (ver `CLAUDE.md` nuevo).
- No es experto en internals de git (necesitó que se le explicara paso a paso el problema de GitHub Pages) pero es organizado y quiere trazabilidad — prefiere que se investigue a fondo antes de tomar acciones destructivas (borrar carpetas/commits), y lo valida bien cuando se le muestra evidencia concreta antes de actuar.
- Trabaja en español.

## Memoria interna de Claude — contenido completo (por si no carga en una sesión nueva)

Esta sesión también guardó 4 archivos en la memoria persistente de Claude Code, indexada por la ruta `d:\$$$ Proyectos\# Reforma`. Si en una sesión futura la carpeta tiene otro nombre, esos archivos **no se cargan solos** — acá está su contenido completo, reproducido, para no depender de eso.

### 1. Perfil del usuario (`user_profile.md`)
> El usuario (Alberto) es dueño/desarrollador no-profesional de Foresee, una app de finanzas personales que construye principalmente con asistencia de Claude Code. Trabaja en español. No es experto en internals de git/infraestructura (necesita explicaciones paso a paso de conceptos como GitHub Pages, submódulos rotos, estado local vs remoto) pero es muy organizado con el proceso de desarrollo: mantiene protocolos explícitos documentados (inicio de sesión, protocolo de cambio, cierre de sesión), versionado incremental con changelog detallado, informes por cada cambio, y skills de Claude Code para automatizar tareas repetitivas.
>
> Tiene dos proyectos Foresee en paralelo: el original (`Proyecto-Anterior/`, single-file ~17.800 líneas, "V FSA XXXX", repo `Alberthoma/Foresee-App`) y la reconstrucción modular "Foresee 2.0" ("V F2 XXXX", repo `Alberthoma/Foresee`).

### 2. Cómo le gusta trabajar (`feedback_working_style.md`)
> **Ritmo por fases, con confirmación explícita.** Cuando el trabajo se divide en fases, el usuario dirige el avance diciendo "continua" después de leer el reporte de cierre de cada fase. Espera un reporte claro al final de cada fase antes de seguir, no que se encadenen fases sin pausa ni resumen. *Cómo aplicar:* al completar una fase o bloque grande de trabajo, parar y reportar, no seguir de largo aunque "sea obvio" que hay que continuar.
>
> **Verificación proactiva esperada, no solo reactiva.** El usuario prueba personalmente y manda capturas cuando encuentra un bug, pero también espera que la verificación de mi parte sea proactiva: build → verificar (node --check, Playwright, capturas a distintos viewports) → recién ahí reportar como terminado. Confirmado en la práctica: la auditoría de paridad de IDs al cierre de la Fase 9 encontró 3 gaps reales que el usuario no había pedido revisar, y se valoró explícitamente. *Cómo aplicar:* no reportar una tarea como completa sin verificación real, y en cierres de proyecto grandes, hacer una auditoría sistemática en vez de confiar en que "seguí el plan" alcanza.
>
> **Transparencia total sobre bugs encontrados, incluso los que el usuario no notaría.** Con un mandato de "misma funcionalidad exacta", si se encuentra un bug sutil durante un porteo, no corregirlo en silencio — informarlo explícitamente. El usuario no objetó cuando esto pasó (bug del parser de voz) — confirma que es el nivel de transparencia esperado.
>
> **Investigar antes de acciones destructivas en git/infraestructura, pero confía en la evidencia.** Autoriza acciones destructivas con relativa rapidez una vez que se le muestra evidencia concreta de que es seguro — no hace falta preguntar varias veces si ya se investigó. Pero si aparece algo genuinamente incierto (commits no vistos, una rama desconocida), pausar y mostrarle el hallazgo antes de actuar, no asumir que una autorización anterior sigue aplicando sobre información nueva. Ejemplo: autorizó borrar "x Foresee"; antes de hacerlo se encontraron 6 commits remotos desconocidos (incluida la corrección real de su problema de GitHub Pages) — se le mostró eso primero, y recién después se confirmó que borrar era seguro.
>
> **Prefiere infraestructura persistente en el repo, no solo en la memoria de Claude.** Al explicarle que la memoria de Claude Code está atada a la ruta exacta de la carpeta, pidió explícitamente documentación dentro del propio proyecto para que sobreviva a cualquier rename o sesión nueva. *Cómo aplicar:* para proyectos con protocolos de sesión, documentar en archivos versionados del repo (CLAUDE.md, informes) sobre depender solo de la memoria interna.

### 3. Estado del proyecto (`project_foresee2.md`)
> Foresee 2.0 es una reconstrucción completa y modular (ES modules, sin build step) de la app original Foresee (`Proyecto-Anterior/`, single-file, V FSA 0061). Se completó en 9 fases el 2026-07-15 con la misma funcionalidad y estética visual que el origen.
>
> **Estado clave al cierre de esta sesión:**
> - App completa, publicada en `https://alberthoma.github.io/Foresee/` (repo `Alberthoma/Foresee`, rama `main`).
> - La carpeta de trabajo (`# Reforma` en esta sesión) no tiene `.git` inicializado localmente — el contenido ya está en GitHub (subido desde otra carpeta, `x Foresee`, que se eliminó tras confirmar que no tenía nada único) pero para publicar cambios futuros desde esta carpeta hace falta inicializar el repo local o clonarlo de nuevo acá.
> - Se creó `CLAUDE.md` y dos skills adaptados (`foresee2-commit`, `foresee2-mejora-done`, fuente en `skill/` dentro del proyecto, instalados en `~/.claude/skills/`) — reemplazan para este proyecto a los skills del proyecto original.
> - Todo lo verificado en esta sesión fue con `appState` simulado (Playwright + mock), nunca con la cuenta real de Firebase del usuario — falta ese QA real.

### 4. Índice (`MEMORY.md`)
> - Perfil del usuario — dueño de Foresee, organizado con protocolos/versionado, no experto en git
> - Cómo le gusta trabajar — fases con confirmación, verificación proactiva, transparencia sobre bugs, cautela antes de destruir
> - Proyecto Foresee 2.0 — reconstrucción completada 2026-07-15, publicada, pendiente git local + QA real

## Estado al cierre

| Componente | Estado |
|---|---|
| App Foresee 2.0 | ✅ Completa — 9 fases, funcionalidad y estética 1:1 con el origen |
| Publicación (GitHub Pages) | ✅ Live en `alberthoma.github.io/Foresee` |
| Repo GitHub `Alberthoma/Foresee` | ✅ Tiene el contenido completo y actualizado |
| Repo git local en `# Reforma` | ❌ No inicializado — pendiente si se quiere seguir publicando cambios desde acá |
| Carpeta `x Foresee` (duplicada) | ✅ Eliminada |
| Rename `# Reforma` → `# Foresee` | ⏳ Pendiente — bloqueado por Windows mientras VSCode tenga la carpeta abierta |
| `CLAUDE.md` del proyecto nuevo | ✅ Creado, adaptado del original |
| Skills adaptados | ✅ `foresee2-commit`, `foresee2-mejora-done` (ver `skill/` en este proyecto) |

## Pendiente para próxima sesión

1. **Renombrar la carpeta** (si se sigue queriendo) — cerrar VSCode, renombrar desde el Explorador de Windows, reabrir apuntando a la carpeta nueva. Esa próxima sesión arranca sin memoria previa — este documento y `CLAUDE.md` son el punto de partida.
2. **Inicializar git localmente** en esta carpeta (o clonar el repo existente) si se quiere volver a publicar cambios desde acá — ver nota en `CLAUDE.md` sección "Git y publicación".
3. **QA real del usuario** con su cuenta de Firebase — todo lo verificado en esta sesión fue con `appState` simulado vía Playwright (no hay forma de loguearse con una cuenta real desde este entorno); falta la prueba end-to-end real que el usuario suele hacer.
4. Confirmar si `backup/` y el `Proyecto-Anterior/` completo se quieren seguir subiendo al repo tal cual, o limpiar el historial más adelante (se dejó como está a pedido explícito del usuario el 2026-07-15).

## Commits de esta sesión

Ninguno — esta sesión de Claude Code no hizo commits ni push (no había repo git local en `# Reforma`). Los 7 commits existentes en `Alberthoma/Foresee` (incluida la corrección de GitHub Pages) fueron hechos fuera de esta sesión, probablemente desde la carpeta `x Foresee` ya eliminada.
