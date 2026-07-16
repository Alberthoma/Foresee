---
name: foresee-find
description: Localiza secciones, funciones, variables o bloques CSS/HTML específicos dentro del archivo index.html del proyecto Foresee App (~13.000+ líneas). Usar este skill cuando se necesite saber en qué línea está algo antes de editarlo, cuando el usuario diga "encuentra", "busca en el código", "dónde está", "en qué línea", "localiza la función", "busca el CSS de", "encuéntra el bloque de", o antes de cualquier edición que requiera conocer el número de línea exacto. Evita leer bloques innecesarios del archivo y reduce drásticamente el tiempo de búsqueda en un archivo de este tamaño.
---

# foresee-find — Localizar código en index.html

Este skill encuentra la ubicación exacta de cualquier elemento en `index.html` (~13.000+ líneas) y devuelve el número de línea y el fragmento relevante, listo para usar con la herramienta Edit.

## Contexto del proyecto

- **Archivo:** `D:\$$$ Proyectos\0 Foresee-App\Foresee-App GitHub\index.html`
- **Tamaño:** ~13.000+ líneas — nunca leer completo, siempre usar Grep + Read con offset/limit
- **Estructura general del archivo:**
  - Líneas 1–50: `<head>`, meta tags, CDN links, manifest
  - Líneas ~50–4000: CSS (dentro de `<style>`)
  - Líneas ~4000–4500: HTML de la app (secciones, modales, navegación)
  - Líneas ~4500–13000+: JavaScript (dentro de `<script>`)

---

## Estrategia de búsqueda

### Paso 1 — Entender qué se busca

Clasificar la búsqueda en una de estas categorías:

| Tipo | Ejemplos | Herramienta principal |
|------|----------|----------------------|
| **Función JS** | `renderDashboard`, `saveTransaction`, `closeModal` | Grep por `function nombreFuncion` o `const nombreFuncion` |
| **Variable / estado** | `appState`, `gastosComunes`, `TRANSFER_ICON` | Grep por el nombre exacto |
| **Bloque CSS** | estilos del modal, `.card`, `#section-dashboard` | Grep por el selector |
| **Elemento HTML** | `<div id="add-registro"`, `#confirm-modal` | Grep por el id o clase |
| **Evento / listener** | listener de un botón, `addEventListener` | Grep por el id del elemento + `addEventListener` |
| **Texto visible** | texto de un label, placeholder, mensaje de error | Grep por el texto exacto entre comillas |

### Paso 2 — Ejecutar Grep

Usar la herramienta Grep con:
- `pattern`: término de búsqueda (nombre de función, selector, id, texto)
- `path`: `D:\$$$ Proyectos\0 Foresee-App\Foresee-App GitHub\index.html`
- `output_mode`: `content`
- `-n`: true (mostrar números de línea)
- `-C`: 3 (mostrar 3 líneas de contexto alrededor del match)

Si el primer Grep devuelve demasiados resultados, refinar el patrón para ser más específico.

### Paso 3 — Leer el fragmento relevante

Una vez identificado el número de línea aproximado, usar Read con:
- `offset`: número de línea del match menos 5
- `limit`: 30–60 líneas (según el tamaño estimado del bloque)

Ajustar el límite si el bloque es más grande (una función larga, un bloque CSS extenso).

### Paso 4 — Devolver resultado al usuario

Presentar el resultado en este formato:

```
📍 Encontrado en línea [N]:

[fragmento de código relevante]

Rango completo del bloque: líneas [inicio]–[fin]
Tipo: [Función JS / Bloque CSS / Elemento HTML / Variable]
```

Si hay múltiples coincidencias relevantes, listarlas todas con su número de línea.

---

## Patrones de búsqueda frecuentes

Usar estos patrones optimizados según lo que se busca:

| Se busca | Patrón Grep |
|----------|-------------|
| Función nombrada | `function renderDashboard` |
| Función flecha asignada | `const renderDashboard =` |
| Selector CSS de sección | `#section-dashboard` |
| Selector CSS de clase | `\.card-header` (escapar el punto) |
| Modal HTML por id | `id="confirm-modal"` |
| Variable de estado | `appState\.gastosComunes` |
| Listener de botón | `add-transaction-btn.*addEventListener` |
| Texto de UI | `"Sin saldos registrados"` |
| Versión en footer | `id="app-version"` |
| CDN o dependencia | `chart\.js\|firebase\|jspdf` |

---

## Casos especiales

### Buscar una sección completa de la app
Las secciones principales tienen este patrón HTML:
```html
<section id="section-dashboard" class="app-section">
```
Buscar por `id="section-[nombre]"` para encontrar el inicio de cada sección.

### Buscar el inicio y fin de una función larga
1. Grep por el nombre de la función → línea de inicio
2. Desde esa línea, leer 100–200 líneas para encontrar el cierre `}`
3. Reportar el rango completo

### Buscar dónde se llama una función
Grep por el nombre de la función sin `function` delante:
- `renderDashboard\(` → encuentra todas las llamadas

### No encontrado en el primer intento
Si el primer Grep no devuelve resultados:
1. Intentar variaciones del nombre (camelCase, snake_case, abreviado)
2. Buscar por fragmento parcial del código
3. Buscar por texto cercano que el usuario recuerde
4. Informar al usuario si tras 3 intentos no se encuentra

---

## Reglas importantes

- **Nunca leer el archivo completo** — siempre Grep primero, luego Read con offset y limit acotado
- **Reportar siempre el número de línea exacto** — es la información clave para poder usar Edit después
- **Si el usuario quiere editar** — entregar el fragmento exacto en el formato que necesita Edit: `old_string` con suficiente contexto para ser único en el archivo
- **Zona CSS vs JS** — si no está claro si algo es CSS o JS, buscar en ambas zonas (líneas 50–4000 para CSS, 4500+ para JS)
