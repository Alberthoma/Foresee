---
name: foresee-commit
description: Ejecuta el protocolo completo de cierre de versión para el proyecto Foresee App. Usar este skill inmediatamente después de cualquier cambio en index.html. Activar cuando el usuario diga "commit", "cierra la versión", "registra el cambio", "nueva versión", "cerrar sesión", "subir cambios", "publicar versión", o cuando termine de modificar index.html y necesite actualizar el número de versión en el footer, crear el informe de actualización, actualizar CLAUDE.md, y preparar el push a GitHub. No esperar a que el usuario describa los pasos — ejecutar el protocolo completo de forma autónoma.
---

# foresee-commit — Protocolo de cierre de versión

Este skill automatiza el protocolo obligatorio que debe ejecutarse después de cada cambio en `index.html` del proyecto Foresee.

## Contexto del proyecto

- **Raíz del proyecto:** `D:\$$$ Proyectos\0 Foresee-App\Foresee-App GitHub\`
- **Archivo principal:** `index.html` (~13.000+ líneas — nunca reescribir completo, siempre usar Edit)
- **Sistema de versiones:** `V FSA XXXX` — número de 4 dígitos con ceros a la izquierda, se incrementa en 1 por cada cambio
- **Versión en el footer del archivo:** `<p id="app-version">V FSA XXXX</p>`
- **Fuente de verdad de la versión actual:** campo `**Versión activa:**` en `CLAUDE.md`

---

## Pasos — ejecutar en este orden exacto

### Paso 1 — Leer la versión actual

Leer `CLAUDE.md` y extraer la versión del campo:
```
- **Versión activa:** `V FSA XXXX`
```

Calcular:
- `ACTUAL` = número actual (ej: 0018)
- `SIGUIENTE` = ACTUAL + 1, con ceros a la izquierda (ej: 0019)
- `DESPUES` = ACTUAL + 2 (ej: 0020) — para el campo "Próxima versión"
- `HOY` = fecha actual en formato YYYY-MM-DD

### Paso 2 — Pedir descripción del cambio

Si la conversación ya contiene una descripción clara de qué se cambió, usarla directamente.

Si no, hacer esta única pregunta al usuario:
> "¿Qué cambio se realizó en esta versión? (descripción breve para el informe)"

Esperar la respuesta antes de continuar.

### Paso 3 — Actualizar versión en index.html

Usar la herramienta **Edit** (nunca Write) para buscar y reemplazar en `index.html`:
- **Buscar:** `<p id="app-version">V FSA [ACTUAL]</p>`
- **Reemplazar:** `<p id="app-version">V FSA [SIGUIENTE]</p>`

Si el número en index.html no coincide con CLAUDE.md, confiar en CLAUDE.md como fuente de verdad.

### Paso 4 — Crear el informe de actualización

Crear el archivo: `Informes de actualización\V FSA [SIGUIENTE] — [HOY].md`

Usar esta estructura exacta — rellenar todas las secciones con contenido real del contexto de la conversación, nunca dejar placeholders:

```markdown
# Informe de Actualización — V FSA [SIGUIENTE]
**Fecha:** [HOY]

---

## Solicitud del usuario
[Lo que el usuario pidió hacer]

## Análisis previo al cambio
[Qué se analizó antes de tocar el código: causa del bug, sección afectada, dependencias revisadas]

## Modificaciones realizadas

### 1. [Nombre del cambio] (`index.html` — línea XXXX)
- **Tipo:** REEMPLAZO / INSERCIÓN / ELIMINACIÓN
- **Antes:** `[código anterior si aplica]`
- **Después:** `[código nuevo si aplica]`
- **Por qué:** [razón del cambio]

## Estado final
[Cómo quedó funcionando. Si hay algo pendiente, indicarlo aquí.]
```

### Paso 5 — Actualizar CLAUDE.md

Aplicar estos cambios con la herramienta **Edit**:

1. `**Versión activa:** \`V FSA [ACTUAL]\`` → `**Versión activa:** \`V FSA [SIGUIENTE]\``
2. `**Próxima versión:** \`V FSA [SIGUIENTE]\`` → `**Próxima versión:** \`V FSA [DESPUES]\``
3. `**Último informe:**` → actualizar con el nombre del nuevo informe
4. `**Último backup:**` → actualizar con `Backup\antes de V FSA [SIGUIENTE] — [HOY].html` (el bat lo crea al hacer push)

### Paso 6 — Agregar fila al historial en CLAUDE.md

Localizar la tabla de historial en CLAUDE.md y agregar al final:
```
| V FSA [SIGUIENTE] | [HOY] | [Resumen de una línea del cambio] |
```

Si la versión fue un intento fallido (el usuario lo indica), agregar con emoji de advertencia:
```
| V FSA [SIGUIENTE] ⚠️ | [HOY] | SUPERADO — [descripción breve], ver V FSA [SIGUIENTE+1] |
```

### Paso 7 — Crear backup de index.html

Antes de hacer commit, crear el backup usando Bash:

```bash
cd "D:/$$$ Proyectos/0 Foresee-App/Foresee-App GitHub"

# Detectar el número más alto en Backup/
MAX=0
for f in Backup/antes\ de\ V\ FSA\ *.html; do
  num=$(echo "$f" | grep -oP '\d{4}' | head -1)
  [ "$num" -gt "$MAX" ] && MAX=$num
done
NEXT=$(printf "%04d" $((MAX + 1)))
TODAY=$(date +%Y-%m-%d)

cp "index.html" "Backup/antes de V FSA $NEXT — $TODAY.html"
```

Actualizar también el campo `**Último backup:**` en CLAUDE.md con el nombre del backup creado.

### Paso 8 — Hacer commit y push a GitHub

Ejecutar via Bash desde la raíz del proyecto:

```bash
cd "D:/$$$ Proyectos/0 Foresee-App/Foresee-App GitHub"
git add -A
git commit -m "V FSA [SIGUIENTE] — [descripción breve del cambio]" \
  --author="Alberthoma <albertomatosgil@gmail.com>"
git push --force-with-lease origin main
```

Si `--force-with-lease` falla, reintentar con `git push --force origin main`.

### Paso 9 — Confirmar resultado

Mostrar este resumen al usuario:

```
✅ Versión V FSA [SIGUIENTE] publicada en GitHub.

Archivos actualizados y subidos:
• index.html — versión en el pie de página actualizada
• Backup/antes de V FSA [SIGUIENTE] — [HOY].html — backup creado
• Informes de actualización/V FSA [SIGUIENTE] — [HOY].md — informe creado
• CLAUDE.md — versión activa, próxima, backup, informe e historial actualizados

URL: https://github.com/Alberthoma/Foresee-App
```

---

## Reglas importantes

- **Nunca usar Write en index.html** — 13.000+ líneas. Siempre Edit con el bloque exacto.
- **El informe debe tener contenido real** — extraer del contexto de la conversación. Nunca dejar placeholders del template.
- **Si hay duda sobre el número de versión** — CLAUDE.md es la fuente de verdad, no el footer de index.html.
- **Versión SUPERADO** — si el usuario indica que el cambio fue incorrecto, registrar igual con el número siguiente y marcar en el historial con ⚠️.
- **El push usa --force-with-lease** — la versión local siempre tiene prioridad sobre el remoto.
