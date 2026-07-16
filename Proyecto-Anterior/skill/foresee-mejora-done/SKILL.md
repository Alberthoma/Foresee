---
name: foresee-mejora-done
description: Marca una mejora del plan de Foresee App como completada y sincroniza automáticamente CLAUDE.md y plan-mejoras.md. Usar cuando el usuario diga "marca la mejora como hecha", "completé la mejora X", "mejora terminada", "actualiza el plan", "marca como completado", o cuando se termine de implementar cualquiera de las mejoras planificadas (gráfico de categorías, presupuesto por categoría, notificaciones, importar CSV/Excel, metas de ahorro, deudas/préstamos, escaneo de recibos). Ejecutar siempre junto a o después de foresee-commit.
---

# foresee-mejora-done — Marcar mejora como completada

Este skill actualiza el estado de una mejora planificada en los dos archivos que la registran: `CLAUDE.md` y `MD/plan-mejoras.md`. Mantiene ambos archivos en sincronía sin riesgo de olvidar actualizar uno de los dos.

## Contexto del proyecto

- **Tabla de mejoras en CLAUDE.md:** sección "Mejoras planificadas"
- **Plan detallado:** `MD/plan-mejoras.md` — tabla "Estado general" + sección de detalle de cada mejora
- **Versión activa:** leer de `CLAUDE.md` campo `**Versión activa:**`

### Las 7 mejoras planificadas

| # | Nombre |
|---|--------|
| 1 | Gráfico de categorías (donut interactivo) |
| 2 | Presupuesto por categoría |
| 3 | Notificaciones inteligentes |
| 4 | Importar CSV/Excel de bancos |
| 5 | Metas de ahorro |
| 6 | Deudas y préstamos |
| 7 | Escaneo de recibos (OCR) |

---

## Pasos — ejecutar en este orden

### Paso 1 — Identificar qué mejora se completó

Si el usuario especificó el número o nombre de la mejora, usarlo directamente.

Si no, preguntar:
> "¿Qué mejora se completó? (número del 1 al 7 o nombre)"

### Paso 2 — Leer la versión actual

Leer `CLAUDE.md` y extraer el valor de `**Versión activa:** \`V FSA XXXX\``.
Esta es la versión en la que se completó la mejora.

Obtener también la fecha de hoy en formato YYYY-MM-DD.

### Paso 3 — Actualizar tabla en CLAUDE.md

En la sección "Mejoras planificadas" de `CLAUDE.md`, localizar la fila de la mejora completada y cambiar:
- `⏳ Pendiente` → `✅ Completado`

Ejemplo:
```
| 1 | Gráfico de categorías (donut interactivo) | ✅ Completado |
```

Si la mejora estaba en estado 🔄 En progreso, cambiarla también a ✅ Completado.

Usar la herramienta **Edit** — cambio puntual, no reescribir el archivo.

### Paso 4 — Actualizar tabla de estado en plan-mejoras.md

En `MD/plan-mejoras.md`, en la sección "Estado general", localizar la fila de la mejora y:
- Cambiar `⏳ Pendiente` (o `🔄 En progreso`) → `✅ Completado`
- Cambiar `—` en la columna Versión → `V FSA [XXXX]`

Ejemplo:
```
| 1 | Gráfico de categorías (donut interactivo) | ✅ Completado | V FSA 0019 |
```

### Paso 5 — Actualizar sección de detalle en plan-mejoras.md

En `MD/plan-mejoras.md`, localizar la sección `### MEJORA [N] — [nombre]` correspondiente y:
- Cambiar la línea `**Estado:** ⏳ Pendiente` → `**Estado:** ✅ Completado`
- Cambiar la línea `**Versión completada:** —` → `**Versión completada:** V FSA [XXXX] ([HOY])`

Ejemplo:
```markdown
**Estado:** ✅ Completado
**Versión completada:** V FSA 0019 (2026-06-15)
```

### Paso 6 — Verificar si todas las mejoras están completas

Leer la tabla de estado en `MD/plan-mejoras.md`. Si todas las 7 mejoras muestran ✅ Completado, agregar al final de la tabla en CLAUDE.md:

```
> 🎉 Todas las mejoras planificadas completadas en V FSA [XXXX].
```

### Paso 7 — Confirmar al usuario

Mostrar este resumen:

```
✅ Mejora [N] — [nombre] marcada como completada en V FSA [XXXX].

Archivos actualizados:
• CLAUDE.md — tabla de mejoras actualizada
• MD/plan-mejoras.md — tabla de estado y sección de detalle actualizadas

[Si quedan mejoras pendientes:]
Próxima mejora pendiente: [N+1] — [nombre de la siguiente en ⏳]

[Si todas completadas:]
🎉 ¡Todas las mejoras del plan están completadas!
```

---

## Reglas importantes

- **Siempre actualizar ambos archivos** — CLAUDE.md y plan-mejoras.md deben quedar en sync. Nunca actualizar uno sin el otro.
- **Usar Edit, no Write** — cambios puntuales únicamente.
- **La versión registrada es la activa al momento de marcar** — leer de CLAUDE.md, no asumir.
- **Este skill no crea el informe ni actualiza el footer** — eso lo hace `foresee-commit`. Este skill solo actualiza el estado del plan de mejoras.
- Si una mejora se marca como descartada (el usuario lo indica), usar ❌ en lugar de ✅ y agregar nota en el detalle explicando por qué.
