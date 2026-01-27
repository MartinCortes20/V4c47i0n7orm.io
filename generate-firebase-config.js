#!/usr/bin/env node
// generate-firebase-config.js
// Lee el archivo .env y genera firebase-config.js para producción

const fs = require('fs');
const path = require('path');

console.log('🔧 Generando firebase-config.js...\n');

// Leer archivo .env
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
    console.error('❌ Error: No se encontró el archivo .env');
    console.error('   Crea uno desde .env.example: cp .env.example .env');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');

// Parsear variables con mejor manejo
const config = {};
const lines = envContent.split('\n');

lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Ignorar líneas vacías y comentarios
    if (!trimmed || trimmed.startsWith('#')) {
        return;
    }
    
    // Buscar el primer = para separar key y value
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
        return;
    }
    
    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();
    
    // Remover comillas si existen
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    
    console.log(`   ${key}: ${value ? '✓' : '✗'}`);
    
    // Convertir nombre de variable a nombre de config
    if (key.startsWith('VITE_FIREBASE_')) {
        const configKey = key.replace('VITE_FIREBASE_', '')
            .toLowerCase()
            .split('_')
            .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
        
        config[configKey] = value;
    }
});

// Verificar que tengamos todas las keys necesarias
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
const missingKeys = requiredKeys.filter(key => !config[key] || config[key] === '');

if (missingKeys.length > 0) {
    console.error('\n❌ Error: Faltan las siguientes configuraciones:');
    missingKeys.forEach(key => console.error(`   - ${key}`));
    console.error('\n   Verifica tu archivo .env');
    process.exit(1);
}

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

// IMPORTANTE: Hacer db disponible globalmente para compatibilidad
window.db = db;

export { app, db, firebaseConfig };
`;

// Escribir archivo
const outputPath = path.join(__dirname, 'public', 'firebase-config.js');

// Crear carpeta public si no existe
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(outputPath, jsContent, 'utf8');

console.log('\n✅ firebase-config.js generado exitosamente');
console.log('📁 Ubicación:', outputPath);
console.log('\n💡 window.db está disponible globalmente');
console.log('💡 También puedes usar: import { db } from "./firebase-config.js"');