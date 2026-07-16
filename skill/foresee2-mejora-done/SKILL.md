---
name: foresee2-mejora-done
description: Marca una mejora del plan de Foresee 2.0 como completada y sincroniza CLAUDE.md (y MD/plan-mejoras.md si existe). Usar cuando el usuario diga "marca la mejora como hecha", "completé la mejora X", "mejora terminada", "actualiza el plan", "marca como completado", o al terminar de implementar cualquier mejora planificada para Foresee 2.0. Ejecutar siempre junto a o después de foresee2-commit.
---

# foresee2-mejora-done — Marcar mejora como completada (Foresee 2.0)

Actualiza el estado de una mejora planificada en `CLAUDE.md` (y en `MD/plan-mejoras.md` si el usuario retoma ese documento del proyecto original, adaptado a Foresee 2.0). Mantiene todo en sincronía sin riesgo de olvidar actualizar un archivo.

## Contexto del proyecto

- **Tabla de mejoras:** si existe una sección "Mejoras planificadas" en `CLAUDE.md`, esa es la fuente de verdad principal.
- **Plan detallado (opcional):** `MD/plan-mejoras.md` — solo si el usuario decide portar y mantener ese documento para Foresee 2.0. Si no existe, omitir los pasos que lo mencionan.
- **Versión activa:** leer de `CLAUDE.md`, campo `**Versión activa:** \`V F2 XXXX\``.

Nota: Foresee 2.0 nació ya con las 7 mejoras del proyecto original incorporadas de fábrica (donut interactivo, presupuesto por categoría, notificaciones inteligentes, importar CSV/Excel/foto, escaneo de recibos, etc. — ver `js/secciones/reportes.js`, `presupuesto.js`, `importar.js`). Este skill sirve para **mejoras nuevas** que se planifiquen a partir de acá, no para las ya incluidas en la reconstrucción.

---

## Pasos — ejecutar en este orden

### Paso 1 — Identificar qué mejora se completó
Si el usuario especificó cuál, usarla directamente. Si no, preguntar: "¿Qué mejora se completó?"

### Paso 2 — Leer la versión actual
Leer `CLAUDE.md`, campo `**Versión activa:** \`V F2 XXXX\``. Esta es la versión en la que se completó la mejora. Obtener también la fecha de hoy (YYYY-MM-DD).

### Paso 3 — Actualizar CLAUDE.md
En la sección de mejoras/pendientes de `CLAUDE.md` (crearla si no existe todavía, junto a la tabla de "Historial de versiones"), marcar la mejora como completada:
```
| [nombre de la mejora] | ✅ Completado (V F2 XXXX, YYYY-MM-DD) |
```
Usar **Edit** — cambio puntual, no reescribir el archivo.

### Paso 4 — Actualizar MD/plan-mejoras.md (solo si existe)
Si el usuario mantiene ese documento:
- Tabla de estado: `⏳ Pendiente` / `🔄 En progreso` → `✅ Completado`, columna Versión → `V F2 [XXXX]`
- Sección de detalle: `**Estado:**` → `✅ Completado`, `**Versión completada:**` → `V F2 [XXXX] ([HOY])`

### Paso 5 — Confirmar al usuario
```
✅ Mejora [nombre] marcada como completada en V F2 [XXXX].

Archivos actualizados:
• CLAUDE.md
• MD/plan-mejoras.md (si aplica)
```

---

## Reglas importantes

- **Usar Edit, no Write** — cambios puntuales únicamente.
- **La versión registrada es la activa al momento de marcar** — leer de CLAUDE.md, no asumir.
- **Este skill no crea el informe ni actualiza el footer** — eso lo hace `/foresee2-commit`. Correr ambos en conjunto cuando se cierra una mejora.
- Si una mejora se descarta, usar ❌ en vez de ✅ y anotar por qué.
