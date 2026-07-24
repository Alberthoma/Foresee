# Informe — Cloud Functions y Notificaciones
**Fecha:** 2026-07-24

> ℹ️ Este informe **no corresponde a una versión `V F2 XXXX`** — todo lo de acá es infraestructura de backend (Cloud Functions/Firestore rules), no el frontend de la app. No toca `index.html`/`css`/`js` del lado cliente salvo donde se indique explícitamente.

## Solicitud del usuario
En sesiones previas se había construido la landing (`landing/landing.html`) con formularios que escriben a Firestore (`landing_leads`, `landing_survey`), pero sin ninguna forma de enterarse cuando alguien los llena salvo revisando Firestore a mano. El usuario pidió: (1) automatizar un aviso por correo cuando esto pase, usando su propio Gmail; (2) de paso, verificar si las notificaciones push al celular (que recordaba de la app anterior, y creía basadas en Twilio) seguían funcionando; (3) documentar todo el proceso para que una futura sesión no repita la misma confusión por falta de documentación; (4) al confirmar que las notificaciones de "gastos recurrentes" sí llegaban pero descubrir que tarjetas/deudas no tenían ningún aviso por correo o push, pidió agregarlo.

## Parte 1 — Notificaciones de la landing (`notifyNewLead`, `notifyNewSurvey`)

### Qué se construyó
Dos Cloud Functions nuevas (`functions/index.js`), gatilladas por `onDocumentCreated` en `landing_leads` y `landing_survey`, que mandan un correo a `albertomatosgil@gmail.com` usando el propio Gmail del usuario como servidor SMTP (Nodemailer + una "contraseña de aplicación" de Google, sin costo, sin depender de un tercero como SendGrid).

### Cómo se desplegó
- Se generó la contraseña de aplicación (el usuario la compartió en el chat sin querer — se le avisó del riesgo y se recomendó rotarla después).
- Se guardaron `GMAIL_USER`/`GMAIL_APP_PASSWORD` en Secret Manager vía `firebase functions:secrets:set --data-file` (nunca escritos en el código ni en el historial de comandos con el valor plano — se usaron archivos temporales borrados de inmediato después de cada uso).
- **Bug encontrado y corregido en el camino:** los archivos temporales de los secretos se escribieron primero con `Set-Content -Encoding utf8` (PowerShell 5.1 agrega BOM con ese encoding) — el secreto quedaba con un carácter invisible al principio, lo que habría roto la autenticación con Gmail en silencio. Se detectó revisando los bytes del secreto ya guardado, y se corrigió reescribiendo con `[System.IO.File]::WriteAllText(..., ASCIIEncoding)`.
- **Bug del propio Firebase CLI:** la versión instalada (14.19.1) desplegaba "0 Functions Deployed" sin avisar ningún error — parecía exitoso pero no creaba nada. Se resolvió actualizando el CLI a 15.24.0.
- **Aviso esperado, no error:** el primer despliegue real falló con "Permission denied while using the Eventarc Service Agent" — es normal la primera vez que un proyecto usa Cloud Functions de 2da generación (los permisos tardan unos minutos en propagarse). Se esperó y se reintentó con éxito.
- **Se encontró una función ya existente en producción** (`sendRecurringExpenseReminders`, ver Parte 3) que no vivía en ningún repo — el primer intento de `firebase deploy --only functions` (sin nombres explícitos) avisó que la iba a borrar por no reconocerla, y se abortó solo (modo no interactivo). No se perdió nada, pero fue la señal de que hacía falta investigar y documentar (de ahí la Parte 3).
- Verificación end-to-end: se creó un documento de prueba directo en Firestore (vía API REST, con el token de `gcloud`), se confirmó en los logs que la función respondió HTTP 200 sin errores, y se borró el documento de prueba después.

### Estado final
`notifyNewLead` y `notifyNewSurvey` activas y verificadas. Ver `functions/README.md` para cómo volver a desplegar si se edita el código.

## Parte 2 — Investigación de Twilio y diagnóstico de por qué no llegaban las notificaciones

Se investigó a fondo si Twilio formaba parte de Foresee 2.0, como recordaba el usuario de la app anterior: **no hay ninguna mención de Twilio en ningún archivo de este repo** (ni en el código actual, ni en `Proyecto-Anterior/`, ni en ninguna de las Cloud Functions activas). Sí existen credenciales de Twilio guardadas en el sistema `runtimeconfig` legado de este proyecto Firebase, con fecha de **octubre de 2025** (antes de que existiera Foresee 2.0) — configuración huérfana, no usada por nada desplegado actualmente.

El mecanismo real de push al celular es **Firebase Cloud Messaging** (`js/firebase.js` → `loadMessaging()`, `js/secciones/configuracion.js` → `handlePushReminderToggle()`), ya implementado correctamente en el cliente.

Se verificó directo en Firestore por qué el usuario no recibía nada: su documento de preferencias no tenía `pushRemindersEnabled` ni `emailRemindersEnabled`, y no tenía ningún token FCM guardado — el sistema nunca se había activado para su cuenta en esta reconstrucción. Se le explicó cómo activarlo desde Configuración → Notificaciones. El usuario luego confirmó, revisando otra cuenta, que sí le había llegado un correo de recordatorio de un gasto recurrente ese mismo día — confirmando que el sistema de correo funciona correctamente una vez activado.

## Parte 3 — `functions-recordatorios-referencia/`: se documenta y se extiende la función existente

### El hallazgo
`sendRecurringExpenseReminders` — una función programada (corre todos los días 9:00 AM hora de Nueva York) que manda recordatorios de gastos recurrentes por correo (SendGrid) y push (FCM) — ya estaba en producción, pero **su código no vivía en ningún repositorio**, solo en la nube (bucket de Cloud Build). Se descargó (`gcloud storage cp` + extracción del zip) y se trajo al repo como referencia documentada, en una carpeta separada de `functions/` para no mezclar ambos sistemas.

### La pregunta del usuario: ¿los recordatorios de tarjetas/deudas por vencer funcionan?
Se revisó el código descargado: **no**, `sendRecurringExpenseReminders` solo recorría `recurringExpenses`, nunca `creditCards`. Lo único que existía para tarjetas era una alerta dentro de la app (banner + notificación nativa del navegador), solo por 80%+ de línea de crédito usada, nunca por fecha de pago, y solo si la app estaba abierta en ese momento — nada por correo, nada por push, nada en segundo plano.

### La extensión construida
Se agregó un segundo barrido (`src/creditCardReminders.js`) a la misma función, con el mismo esquema de 5/1/0 días que ya tenían los gastos recurrentes, usando los mismos toggles de Configuración y los mismos dos canales:
- Se extrajo la lógica compartida (matching de fechas, dedup) a `src/reminderUtils.js` — refactor mecánico, mismo comportamiento, para no duplicar código entre el barrido de gastos y el de tarjetas.
- Se generalizaron `emailChannel.js` y `pushChannel.js` para aceptar contenido de tarjeta además del de gasto recurrente, reutilizando el mismo envío por SendGrid/FCM.
- El monto que se reporta es el "Pago Mensual Estimado" (amortización francesa), con la misma fórmula que ya usa `js/secciones/tarjetas.js` — portada a mano al lado servidor porque cliente y Cloud Function no comparten código.
- El nuevo barrido corre envuelto en su propio `try/catch` dentro del handler existente, para que un error ahí nunca pueda afectar el resultado ya probado del barrido de gastos recurrentes.
- Claves de deduplicación con prefijo `cc_` en la misma colección `emailReminderLog`, para no colisionar con las de gastos recurrentes.

### `firebase.json` — dos codebases
Se configuró `firebase.json` con dos codebases (`default` → `functions/`, `recordatorios` → `functions-recordatorios-referencia/`) para poder desplegar ambas funciones desde el repo, cada una por separado, sin arriesgar la otra. Regla documentada en `CLAUDE.md`: desplegar siempre con el nombre completo (`firebase deploy --only functions:recordatorios:sendRecurringExpenseReminders`), nunca `--only functions` a secas.

### Verificación antes de desplegar
- `node --check` sobre los 6 archivos (nuevos y modificados) — sin errores.
- `npm install` + `require()` del módulo completo — carga sin errores.
- Pruebas locales de la lógica pura, sin tocar Firestore/SendGrid/FCM: matching de umbrales (vence hoy/mañana/en 5 días/sin match), caso especial de meses de 28 días (día 31 en febrero no debe dar falso positivo ni crashear), extracción de uid desde la ruta del documento, y la fórmula de cuota mensual (contrastada a mano: $3,000 al 24% anual en 12 meses da $283.68, matemáticamente correcto).
- Desplegado con `firebase deploy --only functions:recordatorios:sendRecurringExpenseReminders` → `Successful update operation` (actualizó la función existente en el lugar, no la recreó). Confirmado con `gcloud functions list` y `gcloud scheduler jobs list` que las 3 funciones y el horario programado siguen activos sin cambios.
- **Pendiente:** confirmar en los logs de la corrida natural de las 9am (o forzar una corrida manual, a decidir con el usuario porque afectaría a los 5 usuarios reales registrados, no solo al usuario dueño del proyecto) que el nuevo barrido de tarjetas funciona end-to-end con datos reales.

## Estado final
- `functions/` (landing) y `functions-recordatorios-referencia/` (recordatorios + tarjetas) desplegadas y documentadas, cada una con su propio `README.md`.
- `CLAUDE.md` tiene una sección nueva ("📡 Infraestructura de backend") con todo el detalle de ambas, la investigación de Twilio, y el diagnóstico de por qué no llegaban las notificaciones — para que esto no se repita.
- Pendiente de acción del usuario (sin relación con este trabajo): publicar en Firebase Console las reglas de `firestore.rules` — **ya resuelto en una ronda anterior de esta misma sesión**, no queda nada pendiente ahí.
