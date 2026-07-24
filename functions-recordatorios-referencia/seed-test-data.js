// Script temporal de prueba — siembra datos en el EMULADOR (no en producción)
// para verificar la Fase 1.2 (due-date math + dedup) antes de enviar nada real.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "wittfinances-282f1";

const admin = require("firebase-admin");
admin.initializeApp({ projectId: "wittfinances-282f1" });

const APP_ID = "wittfinances-282f1";

async function main() {
  const auth = admin.auth();
  const db = admin.firestore();

  const testUser = await auth.createUser({
    email: "test-reminder@example.com",
    password: "test1234",
  });
  console.log("Usuario de prueba creado:", testUser.uid, testUser.email);

  const today = new Date();
  const in5Days = new Date(today);
  in5Days.setDate(today.getDate() + 5);
  const dayFor5 = in5Days.getDate();

  await db
    .doc(`artifacts/${APP_ID}/users/${testUser.uid}/recurringExpenses/exp-test-5d`)
    .set({
      description: "Netflix (prueba +5 días)",
      category: "Entretenimiento",
      bank: "Banco Prueba",
      amount: 30.42,
      day: dayFor5,
    });
  console.log(`Gasto recurrente sembrado con day=${dayFor5} (hoy+5)`);

  await db
    .doc(`artifacts/${APP_ID}/users/${testUser.uid}/user_data/preferences`)
    .set({ emailRemindersEnabled: true }, { merge: true });
  console.log("Preferencia emailRemindersEnabled=true guardada");

  console.log("\nUID de prueba:", testUser.uid);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
