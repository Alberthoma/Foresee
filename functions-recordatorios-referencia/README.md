# Cloud Function `sendRecurringExpenseReminders` — código de referencia

⚠️ **Esta carpeta NO se despliega desde aquí.** `firebase.json` apunta a `functions/` (las notificaciones de la landing, ver `functions/README.md`), no a esta carpeta. Esto es una **copia de referencia** del código que ya está desplegado en producción, descargada directo del bucket de Cloud Build (`gs://gcf-v2-sources-998192322959-us-central1/sendRecurringExpenseReminders/function-source.zip`) el 2026-07-24, porque **hasta ese día este código no vivía en ningún repo** — solo existía en la nube, sin historial de git, sin poder verlo ni editarlo desde el proyecto.

Se trajo al repo para que quede documentado y no se repita la confusión de la sesión del 2026-07-24: al desplegar las funciones nuevas de la landing (`functions/`), `firebase deploy` avisó que iba a **borrar** esta función porque no la reconocía en el código local — no se borró (se abortó el despliegue automáticamente en modo no-interactivo), pero fue una señal clara de que había un componente de producción invisible para cualquiera que trabajara en este repo sin saber que existía.

## ✅ Ahora SÍ se despliega desde aquí (actualizado 2026-07-24)
`firebase.json` tiene dos codebases: `default` (→ `functions/`, notificaciones de la landing) y `recordatorios` (→ esta carpeta). Para desplegar solo esta función:
```bash
firebase deploy --only functions:recordatorios:sendRecurringExpenseReminders
```
Siempre con el nombre completo `recordatorios:sendRecurringExpenseReminders` — nunca `--only functions` a secas, para no arriesgar la otra codebase.

## Qué hace

Una única Cloud Function programada (`onSchedule`, corre todos los días **9:00 AM hora de Nueva York**), que:

1. Recorre **todos los usuarios** de la app (`collectionGroup("recurringExpenses")` — cruza todas las cuentas, no una sola).
2. Para cada gasto recurrente, calcula si vence hoy, mañana, o en 5 días (mismo cálculo "barrido día por día" que usa el cliente, ver comentario en `src/sendRecurringReminders.js`).
3. Si el usuario tiene `emailRemindersEnabled` y/o `pushRemindersEnabled` en `artifacts/wittfinances-282f1/users/{uid}/user_data/preferences` (los mismos toggles de Configuración → Notificaciones en la app), manda el recordatorio por ese canal:
   - **Correo** (`src/emailChannel.js`) — vía **SendGrid** (`@sendgrid/mail`), no Gmail. Secreto `SENDGRID_API_KEY` en Secret Manager. Remitente `albertomatosgil@gmail.com` (verificado en SendGrid como "Single Sender").
   - **Push** (`src/pushChannel.js`) — vía **Firebase Cloud Messaging**, leyendo los tokens guardados en `artifacts/wittfinances-282f1/users/{uid}/fcmTokens/` (los mismos que guarda `js/secciones/configuracion.js` cuando activas el toggle de push en el navegador). Tokens inválidos/expirados se auto-borran.
4. Lleva un registro de deduplicación en la colección `emailReminderLog` (`{uid}_{expenseId}_{fecha}_{umbral}_{canal}`) para no mandar el mismo recordatorio dos veces — cada canal se reintenta independiente si falla.

### Tarjetas y Préstamos (agregado 2026-07-24)
La misma función ahora también recorre `creditCards` (campo `dueDate`, no `day`) con el mismo esquema de 5/1/0 días y los mismos dos canales (correo/push), usando la misma fórmula de "Pago Mensual Estimado" (amortización francesa) que ya usa la app en `js/secciones/tarjetas.js`. Antes, tarjetas y deudas **solo tenían alerta dentro de la app** (banner + notificación nativa del navegador, solo si estaba abierta, y solo por 80%+ de línea de crédito usada — nunca por fecha de vencimiento). Código en `src/creditCardReminders.js`, aislado en su propio `try/catch` dentro del handler de `sendRecurringExpenseReminders` para que un bug ahí nunca pueda afectar el barrido de gastos recurrentes (ya probado en producción desde antes). Claves de dedup con prefijo `cc_` para no colisionar con las de gastos recurrentes en la misma colección `emailReminderLog`.

Verificado antes de desplegar: pruebas locales de la lógica pura (matching de umbrales, caso especial de meses de 28 días, fórmula de cuota) sin tocar Firestore/SendGrid/FCM — todas pasaron. Pendiente: confirmar en los logs después de la corrida diaria de las 9am (o forzar una corrida manual si el usuario lo pide).

## Dependencias / infraestructura

- `firebase-admin`, `firebase-functions`, `@sendgrid/mail` (ver `package.json`).
- Runtime: Node.js 22.
- Secreto: `SENDGRID_API_KEY` (Secret Manager — no está en este repo, hay que gestionarlo aparte en Firebase Console o `firebase functions:secrets:access SENDGRID_API_KEY` si hace falta verlo).
- **NO usa Twilio.** Existe una configuración vieja de Twilio (`token`, `sid`, `number`, `whatsapp_from`) en el sistema legado `runtimeconfig` de este mismo proyecto Firebase, de octubre 2025 — no la usa ninguna función actualmente desplegada ni ningún código de este repo ni de `Proyecto-Anterior/`. Parece configuración huérfana de un intento anterior (quizás pensado para WhatsApp) que nunca se conectó a nada, o de una función que existió y se borró sin dejar rastro. Ver la sección de notificaciones en `CLAUDE.md` para el detalle completo de esta investigación.

## Si hace falta editar y volver a desplegar

1. Copiar el contenido de esta carpeta a una carpeta de trabajo temporal (o cambiar temporalmente el `"source"` en `firebase.json` a `functions-recordatorios-referencia`).
2. Editar lo que haga falta.
3. `firebase deploy --only functions:sendRecurringExpenseReminders` (siempre con el nombre explícito — nunca `--only functions` a secas mientras convivan dos carpetas de funciones distintas, para no arriesgar borrar la otra).
4. Volver a copiar el código final actualizado a esta carpeta de referencia, para que el repo quede sincronizado con lo que está en producción.

**Mejor a futuro:** unificar esta función dentro de `functions/` (un solo codebase, un solo `package.json`, un solo `firebase deploy --only functions` que despliegue las tres sin riesgo de confundir cuál borra cuál). No se hizo en esta sesión porque implica tocar una función en producción que ya sirve a varios usuarios reales, y no era lo que se pidió — queda como mejora pendiente, a decidir con el usuario.
