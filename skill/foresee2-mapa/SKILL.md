---
name: foresee2-mapa
description: Ubica en qué archivo de Foresee 2.0 (arquitectura modular, ES modules) vive una función, un estilo o una funcionalidad específica, sin tener que leer los ~28 módulos para orientarse. Usar cuando el usuario diga "dónde está", "qué archivo", "busca la función", "en qué módulo", "cómo está organizado esto", "localiza el código de", o antes de cualquier edición donde no esté claro de entrada qué archivo corresponde tocar. Reemplaza para este proyecto al skill foresee-find del proyecto original (que resolvía un problema distinto: navegar un único archivo de 17.000+ líneas por rangos de línea).
---

# foresee2-mapa — Ubicar código en Foresee 2.0

A diferencia del proyecto original (un solo `index.html` de ~17.800 líneas, que necesitaba Grep + Read por rangos de línea para no perderse), Foresee 2.0 es modular: ~28 archivos `.js` de entre 15 y 709 líneas, organizados por responsabilidad. El problema ya no es "encontrar la línea exacta dentro de un archivo gigante" sino "identificar cuál de los ~28 archivos chicos corresponde" — una vez identificado, se lee entero, no hace falta Read con offset/limit.

## Paso 1 — Consultar el mapa
Leer `MD/Arquitectura y Mapa de Código — Foresee 2.0.md`. Tiene:
- Tabla de `css/base.css` por bloque numerado (tema, header, tab-bar, modales, footer, etc.)
- Tabla de `css/secciones.css` por sección de la app
- Tabla de `js/lib/` (motores/helpers compartidos entre varias pestañas) con su lista de exports y para qué sirve cada uno
- Tabla de `js/secciones/` (una pestaña = un archivo) con su lista de exports
- Una sección "Preguntas frecuentes al ubicar código" con atajos directos para los pedidos más comunes (saldo mal calculado, modal que no cierra, parseo de banco, etc.)

## Paso 2 — Regla de oro para decidir lib/ vs secciones/
- ¿El pedido menciona **una sola pestaña** de la app (ej. "en Tarjetas...", "en Reportes...")? → `js/secciones/<nombre>.js`
- ¿El pedido es sobre algo que **se repite en varias pantallas** (saldos, modales, formato de moneda, el modal de nueva transacción)? → probablemente `js/lib/`
- ¿No está claro? Grep el nombre de la función/texto visible directo sobre `js/` — con archivos de este tamaño, un solo Grep sin filtros ya acota a 1-2 candidatos.

## Paso 3 — Leer el archivo completo
Una vez identificado, usar **Read sin offset/limit** — el archivo más grande del proyecto (`configuracion.js`) tiene 709 líneas, entra entero sin problema. No aplicar la estrategia de "leer por rangos" del proyecto original, ya no hace falta.

## Paso 4 — Si el mapa quedó desactualizado
Si se agrega o se elimina un archivo, o cambian sus exports principales, actualizar `MD/Arquitectura y Mapa de Código — Foresee 2.0.md` en el mismo cambio (tabla correspondiente) — no dejar que se desincronice del código real.

---

## Casos especiales

### Buscar dónde se abre un modal
Todos los modales pasan por el gestor genérico de `js/lib/ui.js` (`openModal`/`closeModal`/`registerModal`/`initModalSystem`). Buscar primero quién llama `openModal("nombre-del-modal")` — normalmente en el `init*()` del módulo dueño de ese modal (ej. `cc-modal` → `initTarjetas()` en `tarjetas.js`).

### Buscar dónde se calcula un saldo
Siempre `js/lib/balances.js` — no hay implementaciones alternativas en otros archivos (a diferencia del origen, que las tenía duplicadas 5 veces).

### Buscar un texto visible de la interfaz (label, placeholder, mensaje)
Grep directo del texto entre comillas sobre `js/secciones/` — cada texto vive en el módulo de su propia pestaña, no hay strings centralizados de i18n.

### No encontrado en el primer intento
1. Revisar la tabla de `js/lib/` — puede ser un helper compartido con nombre menos obvio (ej. `sharesDescriptionWord` en `utils.js`, no en la sección donde se usa)
2. Grep por fragmento parcial del nombre
3. Si tras esto no aparece, puede ser una función interna no exportada de `main.js` (bootstrap/wiring) — Grep ahí también
