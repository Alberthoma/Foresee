---
name: foresee2-commit
description: Ejecuta el protocolo completo de cierre de versión para el proyecto Foresee 2.0 (la reconstrucción modular de Foresee, distinta del proyecto original en Proyecto-Anterior/). Usar este skill inmediatamente después de cualquier cambio de código en este proyecto. Activar cuando el usuario diga "commit", "cierra la versión", "registra el cambio", "nueva versión", "cerrar sesión", "subir cambios", "publicar versión", o cuando termine de modificar algún módulo y necesite actualizar el número de versión en el footer, crear el informe de actualización, actualizar CLAUDE.md, y publicar a GitHub. No esperar a que el usuario describa los pasos — ejecutar el protocolo completo de forma autónoma.
---

# foresee2-commit — Protocolo de cierre de versión (Foresee 2.0)

Este skill automatiza el protocolo obligatorio que debe ejecutarse después de cada cambio de código en el proyecto Foresee 2.0 (arquitectura modular con ES modules, distinto del `foresee-commit` original que edita un único `index.html` de ~13.000 líneas).

## Contexto del proyecto

- **Raíz del proyecto:** carpeta actual del proyecto Foresee 2.0 (ver `CLAUDE.md` en la raíz para confirmar la ruta exacta — pudo haber sido renombrada)
- **Arquitectura:** modular — `index.html` + `css/base.css` + `css/secciones.css` + `js/main.js` + `js/state.js` + `js/firebase.js` + `js/lib/*.js` + `js/secciones/*.js`. Los archivos son chicos (decenas a ~700 líneas) — usar Edit para cambios puntuales, Write solo para archivos nuevos.
- **Sistema de versiones:** `V F2 XXXX` — número de 4 dígitos con ceros a la izquierda, se incrementa en 1 por cada cambio. (Distinto de `V FSA XXXX`, que es el proyecto original — no confundir.)
- **Versión en el footer de `index.html`:** `<p id="app-version">Foresee 2.0 — V F2 XXXX</p>`
- **Fuente de verdad de la versión actual:** campo `**Versión activa:**` en `CLAUDE.md`
- **Repo:** `https://github.com/Alberthoma/Foresee.git`, rama `main`, GitHub Pages activado (root)

---

## Pasos — ejecutar en este orden exacto

### Paso 1 — Leer la versión actual
Leer `CLAUDE.md` y extraer la versión del campo `**Versión activa:** \`V F2 XXXX\``.

Calcular:
- `ACTUAL` = número actual (ej: 0001)
- `SIGUIENTE` = ACTUAL + 1, con ceros a la izquierda (ej: 0002)
- `HOY` = fecha actual en formato YYYY-MM-DD

### Paso 2 — Verificar el repo git local
Antes de nada, correr `git status` en la raíz del proyecto:
- Si da `fatal: not a git repository` → el repo local no está inicializado. Avisar al usuario y ofrecer inicializarlo (`git init`, `git remote add origin https://github.com/Alberthoma/Foresee.git`, alinear con lo que ya hay en GitHub vía `git fetch` + `git reset --mixed origin/main` para no perder el historial remoto) antes de continuar.
- Si el repo existe pero está desalineado con `origin/main` (`git fetch` + comparar), avisar antes de hacer push — no forzar sin mostrar el diff al usuario.

### Paso 3 — Pedir descripción del cambio
Si la conversación ya contiene una descripción clara de qué se cambió, usarla directamente. Si no, preguntar: "¿Qué cambio se realizó en esta versión? (descripción breve para el informe)".

### Paso 4 — Actualizar versión en index.html
Usar **Edit** para buscar y reemplazar:
- **Buscar:** `<p id="app-version">Foresee 2.0 — V F2 [ACTUAL]</p>` (o `Foresee 2.0` a secas si es la primera vez)
- **Reemplazar:** `<p id="app-version">Foresee 2.0 — V F2 [SIGUIENTE]</p>`

### Paso 5 — Crear el informe de actualización (si el cambio no es trivial)
Crear `Informes de actualización/V F2 [SIGUIENTE] — [HOY].md`:
```markdown
# Informe de Actualización — V F2 [SIGUIENTE]
**Fecha:** [HOY]

## Solicitud del usuario
[qué pidió]

## Análisis previo al cambio
[qué se analizó: módulo afectado, dependencias revisadas]

## Modificaciones realizadas
### 1. [Nombre del cambio] (`ruta/al/archivo.js`)
- **Tipo:** REEMPLAZO / INSERCIÓN / ELIMINACIÓN
- **Por qué:** [razón]

## Verificación
[node --check, prueba manual/Playwright]

## Estado final
[cómo quedó, si hay algo pendiente]
```
Para cambios menores (typos, ajustes puntuales de estilo) no hace falta informe — alcanza con un mensaje de commit descriptivo.

### Paso 6 — Actualizar CLAUDE.md
1. `**Versión activa:** \`V F2 [ACTUAL]\`` → `**Versión activa:** \`V F2 [SIGUIENTE]\``
2. `**Próxima versión:** \`V F2 [SIGUIENTE]\`` → `**Próxima versión:** \`V F2 [SIGUIENTE+1]\``
3. `**Último respaldo:**` → `Respaldos/V F2 [SIGUIENTE] — [HOY]/`
4. Agregar fila a la tabla **Historial de versiones**:
   ```
   | V F2 [SIGUIENTE] | [HOY] | [Resumen de una línea del cambio] |
   ```

Si la versión fue un intento fallido (el usuario lo indica), agregar con emoji de advertencia:
```
| V F2 [SIGUIENTE] ⚠️ | [HOY] | SUPERADO — [descripción breve], ver V F2 [SIGUIENTE+1] |
```

### Paso 7 — Bump de CACHE_NAME en sw.js (si se tocó CSS/JS)
El service worker (`sw.js`) sirve `index.html` siempre de la red, pero **todo lo demás (CSS, JS, imágenes) lo sirve `cache-first`** — una vez que un usuario lo cacheó, no vuelve a pedirlo a la red aunque cambie en el servidor. A diferencia del proyecto original (todo el código vivía inline en un único `index.html`, por lo que casi nunca pasaba por la rama cacheada), acá `css/base.css`, `css/secciones.css` y todos los `js/**/*.js` son archivos externos reales — cualquier cambio en ellos queda atrapado en la caché vieja de los usuarios hasta que se invalide.

Si esta versión modificó **cualquier `.css` o `.js`** (no solo `index.html`):
1. Abrir `sw.js` y subir en 1 el número de `CACHE_NAME` (ej: `'foresee-cache-v5'` → `'foresee-cache-v6'`).
2. Mencionarlo en el informe de actualización si se creó uno.

Si el cambio de esta versión tocó **solo** `index.html`/`CLAUDE.md`/Markdown (nada de `css/` o `js/`), este paso no aplica.

### Paso 8 — Verificar antes de publicar
- `node --check` sobre cada archivo `.js` tocado
- Si el cambio es visual/responsive, verificar manualmente o con Playwright (390px de viewport, sin overflow horizontal)

### Paso 9 — Crear el respaldo de archivos
Copiar el estado final (ya editado) de la app a `Respaldos/V F2 [SIGUIENTE] — [HOY]/`, para poder restaurarlo sin depender de git (ver "🆘 Si algo sale mal" en `CLAUDE.md`):
```bash
mkdir -p "Respaldos/V F2 [SIGUIENTE] — [HOY]"
cp index.html manifest.json sw.js "Respaldos/V F2 [SIGUIENTE] — [HOY]/"
cp -r css js "Respaldos/V F2 [SIGUIENTE] — [HOY]/"
```
No usar la carpeta `backup/` (minúscula) — es para documentos de planificación, no para esto.

### Paso 10 — Commit y push
```bash
git add -A
git commit -m "V F2 [SIGUIENTE] — [descripción breve del cambio]"
git push origin main
```
Si el push falla por desalineación con el remoto, hacer `git pull --rebase origin main` primero y avisar al usuario si hay conflictos — nunca `--force` sin confirmar explícitamente.

### Paso 11 — Confirmar resultado
```
✅ Versión V F2 [SIGUIENTE] publicada en GitHub.

Archivos actualizados y subidos:
• index.html — versión en el pie de página actualizada
• Informes de actualización/V F2 [SIGUIENTE] — [HOY].md — informe creado (si aplica)
• Respaldos/V F2 [SIGUIENTE] — [HOY]/ — respaldo completo de la app creado
• CLAUDE.md — versión activa, próxima, respaldo e historial actualizados

URL: https://alberthoma.github.io/Foresee/
```

---

## Reglas importantes

- **No reescribir archivos completos con Write** salvo que sean nuevos — la arquitectura es modular pero cada archivo sigue siendo código real, no un scratch file.
- **El informe debe tener contenido real** — extraído del contexto de la conversación, nunca placeholders del template.
- **Si hay duda sobre el número de versión** — CLAUDE.md es la fuente de verdad, no el footer de index.html.
- **Nunca hacer force-push sin confirmar con el usuario primero** — a diferencia del proyecto original (que usaba `--force-with-lease` por defecto porque era de un solo editor), este repo puede tener cambios hechos fuera de esta sesión (ya pasó una vez — ver `MD/Sesion 2026-07-15 — Reconstruccion Foresee 2.0.md`).
