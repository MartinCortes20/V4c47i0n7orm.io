#!/usr/bin/env node
// generate-firebase-config.js
// Lee el archivo .env y genera firebase-config.js para producción

const fs = require('fs');
const path = require('path');

// Leer archivo .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parsear variables
const config = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key.startsWith('VITE_FIREBASE_')) {
            const configKey = key.replace('VITE_FIREBASE_', '').toLowerCase()
                .split('_')
                .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
            config[configKey] = value;
        }
    }
});

// Generar archivo JavaScript
const jsContent = `// firebase-config.js
// ⚠️ ARCHIVO AUTO-GENERADO - NO EDITAR MANUALMENTE
// Generado por: generate-firebase-config.js
// Fecha: ${new Date().toISOString()}

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "${config.apiKey}",
    authDomain: "${config.authDomain}",
    projectId: "${config.projectId}",
    storageBucket: "${config.storageBucket}",
    messagingSenderId: "${config.messagingSenderId}",
    appId: "${config.appId}",
    measurementId: "${config.measurementId}"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
window.db = db;

export { app, db, firebaseConfig };
`;

// Escribir archivo
const outputPath = path.join(__dirname, 'public', 'firebase-config.js');
fs.writeFileSync(outputPath, jsContent, 'utf8');

console.log(' firebase-config.js generado exitosamente');
console.log(' Ubicación:', outputPath);