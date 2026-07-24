# Informe — Limpieza de Infraestructura
**Fecha:** 2026-07-24

> ℹ️ Este informe **no corresponde a una versión `V F2 XXXX`** — es una nota de mantenimiento/infraestructura del repositorio, no un cambio de la app (`index.html`/`css`/`js`).

## Contexto
Durante la sesión, mientras se investigaba por qué el proyecto Firebase `wittfinances-282f1` se sentía "compartido" entre varias generaciones de la app, y al revisar por qué ciertos archivos del proyecto no se podían copiar en Windows, se encontraron y resolvieron varios puntos sueltos de limpieza.

## 1. Separación del proyecto Firebase — resuelto sin migrar nada
El usuario preguntó por crear un proyecto Firebase nuevo y separado para Foresee 2.0, ante la sospecha de que compartir `wittfinances-282f1` con versiones anteriores de la app generaba conflictos (cuentas, contraseñas). Se investigó a fondo:
- El proyecto solo tiene **1 App Web registrada** (la que ya usa Foresee 2.0) y **3 Cloud Functions**, las 3 de Foresee 2.0 (`notifyNewLead`, `notifyNewSurvey`, `sendRecurringExpenseReminders`) — no hay nada huérfano de otras apps.
- Las apps anteriores (`Alberthoma/Foresee-App` y `Alberthoma/foresee-web`, en otros repositorios) no tienen su propio proyecto Firebase — están desplegadas usando la misma configuración copiada del proyecto compartido, pero confirmadas por el usuario como **descontinuadas** (sin usuarios reales activos).
- **Solución aplicada (sin migrar nada):** se desactivó GitHub Pages en esos dos repositorios (`Settings → Pages → Source: None`), confirmado por el usuario con capturas. Con eso esas apps quedan inaccesibles para cualquiera — nadie puede crear cuentas ni datos nuevos que choquen con Foresee 2.0. Reversible en cualquier momento (reactivar Pages no borra nada del código).
- Se descartó la migración completa a un proyecto Firebase nuevo (que se había planificado paso a paso) por ser mucho trabajo para un riesgo que, en la práctica, ya no existe.

## 2. Carpeta artefacto `d:$1107 Proyectos` — eliminada
Apareció una carpeta vacía (`d:$1107 Proyectos/# Foresee/functions`) en la raíz del proyecto, generada por un bug conocido de cómo Node/Firebase CLI arma rutas cuando el nombre de la carpeta del proyecto contiene `$$$` (los caracteres se interpretaron como referencias de grupo de una expresión regular al construir una ruta temporal durante uno de los despliegues). No tenía archivos, git ni siquiera la veía (no trackea carpetas vacías). Se eliminó con `rmdir` sin impacto en nada.

## 3. `node_modules/` en las carpetas de Cloud Functions — pendiente de borrar (a pedido del usuario)
Al revisar por qué ciertos archivos no se podían copiar en Windows, se identificó la causa: rutas muy largas y anidadas dentro de `functions/node_modules/` y `functions-recordatorios-referencia/node_modules/` (paquetes `google-gax`, `@google-cloud/firestore`, `@grpc`, `@firebase`, `@sendgrid` — traen archivos `.proto`/`.d.ts` con nombres de carpeta muy largos, hasta ~175 caracteres de ruta relativa). Al copiar la carpeta del proyecto a otro destino, la ruta combinada supera el límite de 260 caracteres de Windows y la copia falla en esos archivos puntuales.

**Confirmado que no son necesarios ni para la app ni para el despliegue:**
- La app web (`index.html`/`js`/`css`) no usa `node_modules` en absoluto — es ES modules puros vía CDN, sin build step.
- `firebase.json` ya tiene `"ignore": ["node_modules", ...]` en las dos codebases — cuando se hace `firebase deploy`, esta carpeta **ni se sube**; Google reinstala las dependencias en su propio Cloud Build a partir de `package.json`/`package-lock.json`.
- Solo existen en disco porque se instalaron localmente esta sesión (`npm install`) para poder correr `require()` y verificar el código antes de desplegarlo — un chequeo de desarrollo, no un requisito de producción.
- Tamaño actual: `functions/node_modules` (59 MB) + `functions-recordatorios-referencia/node_modules` (62 MB) = 121 MB.

**Estado: pendiente de borrar.** El usuario pidió dejarlo documentado acá y no borrarlas todavía — se van a eliminar cuando lo pida explícitamente. Si hace falta volver a probar el código localmente en el futuro, se recrean con `npm install` dentro de cada carpeta.

## 4. Otros puntos sueltos encontrados, sin resolver aún
- **`AGENTS.md`** (raíz del proyecto, sin trackear en git) — copia de `CLAUDE.md` adaptada para otra herramienta de IA (menciones a "Codex" en vez de "Claude"). No lo generó esta sesión; pendiente que el usuario confirme si lo usa con otra herramienta (se conserva) o fue sin querer (se borra).
- **`Proyecto-Anterior/landing - copia.html`** (sin trackear en git desde antes de esta sesión) — archivo suelto sin explicación identificada todavía.
- **`Temporales/`** — carpeta vacía (el contenido que tenía, 6 imágenes sueltas sin relación con el código, ya se había borrado en una sesión anterior, ver `Informes de actualización/Landing Page — 2026-07-21.md`). No estorba, pero no cumple ninguna función ahora mismo.

## Estado final
Separación de proyecto Firebase resuelta sin migración. Carpeta artefacto borrada. `node_modules` de Cloud Functions identificado como no esencial y pendiente de borrado a pedido del usuario. `AGENTS.md`, `Proyecto-Anterior/landing - copia.html` y `Temporales/` quedan como puntos abiertos para una futura limpieza, cada uno a confirmar con el usuario antes de tocar nada.
