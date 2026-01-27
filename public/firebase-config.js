// firebase-config.js
// ⚠️ ARCHIVO AUTO-GENERADO - NO EDITAR MANUALMENTE
// Generado por: generate-firebase-config.js
// Fecha: 2026-01-27T04:42:07.749Z

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCcBqpSXsz_wqm3xyg0NSJYnvQTK0NhkXg",
    authDomain: "formatovacaciones.firebaseapp.com",
    projectId: "formatovacaciones",
    storageBucket: "formatovacaciones.firebasestorage.app",
    messagingSenderId: "753669687689",
    appId: "1:753669687689:web:b37af5de6ba6b1391ef958",
    measurementId: "G-LMKRM8VKM7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// IMPORTANTE: Hacer db disponible globalmente para compatibilidad
window.db = db;

export { app, db, firebaseConfig };
