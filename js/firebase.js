// Foresee 2.0 — firebase.js
// Único punto de import del SDK de Firebase (CDN). Todo el resto de la
// app importa instancias y funciones desde aquí, nunca directo del CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Mismo proyecto Firebase que el origen — compatibilidad total de datos.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCTicX5tqqVr3pK_RFqgvqpRavsUuTvS2g",
  authDomain: "wittfinances-282f1.firebaseapp.com",
  projectId: "wittfinances-282f1",
  storageBucket: "wittfinances-282f1.firebasestorage.app",
  messagingSenderId: "998192322959",
  appId: "1:998192322959:web:e2afcdd7f47da3767853fa",
};

// Clave pública VAPID (Firebase Console → Cloud Messaging → Web
// configuration) — no es secreta, se necesita en el cliente para
// suscribirse al push, igual que el resto de FIREBASE_CONFIG.
export const FCM_VAPID_KEY =
  "BGw0CDJqc5DyU4V6-n9PiJMa_EmBhd5rQU6yDpMtHPjVGx9MnrB0MvbjWab79fEzLSiE2hiPDWPeC1_XGTNfQO0";

export const APP_ID = FIREBASE_CONFIG.projectId;
export const DB_COL = (uid, col) => `artifacts/${APP_ID}/users/${uid}/${col}`;
export const DB_PREF = (uid) =>
  `artifacts/${APP_ID}/users/${uid}/user_data/preferences`;
export const DB_GASTOS_COMUNES = (uid) =>
  `artifacts/${APP_ID}/users/${uid}/user_data/gastosComunes`;

export const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(firebaseApp);
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Carga diferida — nunca a nivel de módulo, solo cuando el usuario activa
// el toggle de push. Navegadores sin soporte (Safari viejo, contexto no
// seguro) lanzarían excepción si esto corriera al cargar la página.
export async function loadMessaging() {
  return import("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js");
}

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  doc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
};
