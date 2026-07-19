# Guía Rápida — Dónde Modifico Esto

Referencia para vos (no hace falta que la lea Claude — es para que vos sepas más o menos dónde vive cada cosa antes de pedir un cambio, o para entender qué archivo te va a decir que tocó). Para el detalle técnico completo de cada archivo, ver [`Arquitectura y Mapa de Código`](Arquitectura%20y%20Mapa%20de%20C%C3%B3digo%20%E2%80%94%20Foresee%202.0.md).

## Regla general, en una frase
- **¿Es sobre cómo se ve algo?** (tamaño, color, espacio, forma) → **CSS** → `css/base.css` o `css/secciones.css`.
- **¿Es sobre cómo se comporta algo?** (qué pasa al tocar un botón, cómo se calcula un número, qué se guarda) → **JS** → `js/lib/` o `js/secciones/`.

---

## Ejemplo resuelto: "quiero cambiar el tamaño de las fuentes"

Está centralizado — **no hay que buscar cada texto uno por uno**. En `css/base.css`, sección 1 (Variables), hay 6 tamaños definidos una sola vez:

```css
--font-xs: 0.7rem;    /* etiquetas chicas, textos secundarios */
--font-sm: 1rem;      /* texto normal en tablas/formularios */
--font-base: 0.9rem;  /* texto base de toda la app */
--font-md: 1rem;
--font-lg: 1.15rem;   /* subtítulos */
--font-xl: 1.35rem;   /* títulos */
```

Cambiás uno de esos 6 valores ahí, y se actualiza automáticamente en **toda la app** (todos los módulos usan `var(--font-sm)`, etc., no un número escrito a mano). Si en cambio querés agrandar el texto de **una sola pantalla** (ej. solo los montos de Registros), eso ya no es la variable general — hay que ir al bloque específico de esa sección en `css/secciones.css`.

---

## CSS — dónde busco esto

| Quiero cambiar... | Archivo | Qué buscar |
|---|---|---|
| Tamaño de letra en general | `css/base.css` | Sección 1, variables `--font-*` |
| Colores del tema oscuro/claro | `css/base.css` | Sección 1 (oscuro) y 1b (claro, "Gris Perla") |
| El color de acento de una pestaña puntual (ej. Tarjetas es rojo, Presupuesto es violeta) | `css/base.css` | Bloque "Acento por sección", justo después de las variables |
| Espaciado entre elementos (paddings, separación) | `css/base.css` | Variables `--space-xs/sm/md/lg/xl` |
| La barra de pestañas (arriba, íconos, alto) | `css/base.css` | Sección 6 "Tab bar" |
| Cualquier modal (ventana emergente) — tamaño, fondo | `css/base.css` | Sección 10 "Modal base" (aplica a todos); si es de una pestaña puntual, el bloque de esa pestaña en `secciones.css` |
| El dashboard (tarjetas de Saldo/Ingresos/Gastos) | `css/base.css` | Sección 8 "Main layout + dashboard" |
| Una tabla puntual (Registros, Proyección, Recurrentes, Presupuesto) | `css/secciones.css` | Buscar el bloque de esa sección (están en el orden en que se construyeron) |
| Las tarjetas de Tarjetas de Crédito o Metas de Ahorro | `css/secciones.css` | Clases `.cc-card*` — **las dos pestañas comparten el mismo CSS**, cambiar ahí afecta a ambas |
| Cómo se ve en el celular (menos de 768px de ancho) | `css/base.css` / `css/secciones.css` | Buscar `@media (max-width: 768px)` — hay uno en cada archivo |
| Los íconos 3D de categoría | No es CSS — son imágenes | Se cambian en `js/lib/category-modal.js` (URLs de Cloudinary) o en Configuración dentro de la app |

## JS — dónde busco esto

| Quiero cambiar... | Archivo |
|---|---|
| Cómo se calcula el saldo (en cualquier pantalla) | `js/lib/balances.js` |
| El formulario/calculadora de nueva transacción o proyección | `js/lib/calc-modal.js` |
| El selector de categorías (íconos, nombres) | `js/lib/category-modal.js` |
| Cómo se interpreta lo que decís por voz | `js/lib/voice-parser.js` (entender la frase) vs `js/secciones/voz.js` (la pantalla) |
| Importar CSV/Excel de banco, o foto de extracto/recibo | `js/lib/import-pipeline.js` (texto) / `js/lib/ocr.js` (foto) |
| Un gráfico de Reportes | `js/secciones/reportes.js` |
| Notificaciones del navegador | `js/lib/notifications.js` |
| Qué se guarda o se borra en cada pestaña | El archivo de esa pestaña en `js/secciones/` (ej. `metas.js`, `tarjetas.js`) |
| Un mensaje de error o de éxito que ves en pantalla | Generalmente en el mismo archivo de la acción (buscá el texto entre comillas con `Grep`) |
| Qué pasa al iniciar sesión, cambiar de pestaña, o el menú principal | `js/main.js` |

---

## Si no sabés si es CSS o JS
Preguntá tal cual como lo pensás vos (ej. "quiero que el botón de guardar sea más grande") — no hace falta que sepas de antemano si es CSS o JS. Este documento es para que entiendas *después* qué tocó Claude y por qué, no un requisito para pedir el cambio.
