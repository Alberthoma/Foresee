# Cloud Functions — notificaciones por correo de la landing

Dos funciones (`notifyNewLead`, `notifyNewSurvey`) que se disparan solas cuando alguien deja su correo o responde la encuesta en `landing/landing.html`, y te mandan un correo de aviso a `albertomatosgil@gmail.com` usando tu propia cuenta de Gmail como servidor de envío (gratis, sin servicios de terceros).

Esto **no se despliega solo** — a diferencia del resto de la app (que se publica a GitHub Pages con un simple `git push`), las Cloud Functions viven en los servidores de Firebase y hay que subirlas aparte, una sola vez (y de nuevo cada vez que se edite `functions/index.js`).

## Paso 1 — Generar una "Contraseña de aplicación" de Google

Esto **no es tu contraseña normal de Gmail** — es una contraseña de 16 caracteres que Google genera específicamente para que una app externa (esta función) pueda enviar correos en tu nombre, sin darle tu contraseña real.

1. Necesitas tener activa la **verificación en dos pasos** en tu cuenta de Google (si no la tienes, Google te la va a pedir activar primero: [myaccount.google.com/security](https://myaccount.google.com/security)).
2. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Ponle un nombre (ej. "Foresee Landing") y presiona **Crear**.
4. Google te muestra una contraseña de 16 letras (ej. `abcd efgh ijkl mnop`) — cópiala tal cual, **sin espacios**. No la vas a volver a ver, así que guárdala en un lugar seguro por si acaso.

## Paso 2 — Instalar el Firebase CLI (si no lo tienes)

Desde una terminal, en cualquier carpeta:
```bash
npm install -g firebase-tools
firebase login
```
Esto último abre el navegador para que inicies sesión con la cuenta de Google dueña del proyecto `wittfinances-282f1`.

## Paso 3 — Guardar los secretos (nunca en el código)

Desde la raíz del proyecto (`d:\$$$ Proyectos\# Foresee`):
```bash
firebase functions:secrets:set GMAIL_USER
```
Te va a pedir un valor — escribe tu correo completo: `albertomatosgil@gmail.com`.

```bash
firebase functions:secrets:set GMAIL_APP_PASSWORD
```
Te va a pedir un valor — pega la contraseña de 16 caracteres del Paso 1 (sin espacios).

## Paso 4 — Instalar dependencias y desplegar

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

La primera vez que despliegas funciones en un proyecto, Firebase puede pedirte confirmar que quieres habilitar el plan **Blaze** (pago por uso) — ya lo tienes activo según tu panel, así que no debería pedirte nada nuevo ahí. El despliegue tarda uno o dos minutos.

## Verificar que funciona

Deja tu correo en el formulario de la landing (como ya probaste) y revisa tu bandeja de Gmail — debería llegarte un correo "🎉 Nuevo interesado en Foresee" en segundos. Si no llega, revisa los logs:
```bash
firebase functions:log
```

## Si en el futuro se edita `functions/index.js`

Hay que volver a correr `firebase deploy --only functions` para que el cambio quede activo — no pasa solo con el `git push` normal del resto del proyecto.
