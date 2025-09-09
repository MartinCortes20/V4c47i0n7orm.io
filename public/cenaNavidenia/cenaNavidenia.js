// Configuración de Firebase (reemplaza con tu configuración)
const firebaseConfig = {
     apiKey: "AIzaSyCcBqpSXsz_wqm3xyg0NSJYnvQTK0NhkXg",
    authDomain: "formatovacaciones.firebaseapp.com",
    projectId: "formatovacaciones",
    storageBucket: "formatovacaciones.firebasestorage.app",
    messagingSenderId: "753669687689",
    appId: "1:753669687689:web:b37af5de6ba6b1391ef958",
    measurementId: "G-LMKRM8VKM7"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variables globales
let seleccion = null;
let numEmpleadoExiste = false;

// Elementos DOM
const form = document.getElementById('cenaForm');
const nombreInput = document.getElementById('nombre');
const numEmpleadoInput = document.getElementById('numEmpleado');
const opcionPavo = document.getElementById('pavo');
const opcionPierna = document.getElementById('pierna');
const enviarBtn = document.getElementById('enviarBtn');
const mensajeDiv = document.getElementById('mensaje');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    opcionPavo.addEventListener('click', () => seleccionarOpcion('pavo'));
    opcionPierna.addEventListener('click', () => seleccionarOpcion('pierna'));
    
    form.addEventListener('submit', enviarFormulario);
    
    // Validar en tiempo real si el número de empleado ya existe
    numEmpleadoInput.addEventListener('blur', verificarNumEmpleado);
});

// Función para seleccionar una opción
function seleccionarOpcion(opcion) {
    // Remover selección anterior
    opcionPavo.classList.remove('seleccionada');
    opcionPierna.classList.remove('seleccionada');
    
    // Marcar nueva selección
    seleccion = opcion.toUpperCase();
    document.getElementById(opcion).classList.add('seleccionada');
    
    // Habilitar botón si todos los campos están completos
    verificarCampos();
}

// Función para verificar si el número de empleado ya existe
async function verificarNumEmpleado() {
    const numEmpleado = numEmpleadoInput.value.trim();
    
    if (!numEmpleado) return;
    
    try {
        const querySnapshot = await db.collection('cenaNavidenia')
            .where('numEmpleado', '==', numEmpleado)
            .get();
            
        numEmpleadoExiste = !querySnapshot.empty;
        
        if (numEmpleadoExiste) {
            mostrarMensaje('Este número de empleado ya ha realizado su elección.', 'error');
            enviarBtn.disabled = true;
        } else {
            mensajeDiv.textContent = '';
            verificarCampos();
        }
    } catch (error) {
        console.error('Error verificando número de empleado:', error);
        mostrarMensaje('Error al verificar el número de empleado. Intenta nuevamente.', 'error');
    }
}

// Función para verificar si todos los campos están completos
function verificarCampos() {
    const nombreValido = nombreInput.value.trim() !== '';
    const numEmpleadoValido = numEmpleadoInput.value.trim() !== '';
    const opcionValida = seleccion !== null;
    
    enviarBtn.disabled = !(nombreValido && numEmpleadoValido && opcionValida && !numEmpleadoExiste);
}

// Función para enviar el formulario
async function enviarFormulario(e) {
    e.preventDefault();
    
    // Obtener y limpiar datos
    const nombre = nombreInput.value.trim().toUpperCase();
    const numEmpleado = numEmpleadoInput.value.trim();
    
    // Validaciones finales
    if (!nombre || !numEmpleado || !seleccion) {
        mostrarMensaje('Por favor, completa todos los campos y selecciona una opción.', 'error');
        return;
    }
    
    if (numEmpleadoExiste) {
        mostrarMensaje('Este número de empleado ya ha realizado su elección.', 'error');
        return;
    }
    
    // Deshabilitar botón durante el envío
    enviarBtn.disabled = true;
    enviarBtn.textContent = 'Enviando...';
    
    try {
        // Guardar en Firebase
        await db.collection('cenaNavidenia').add({
            nombre: nombre,
            numEmpleado: numEmpleado,
            tipoCena: seleccion,
            fecha: new Date()
        });
        
        // Mostrar mensaje de éxito
        mostrarMensaje(`¡Gracias ${nombre}! Tu elección de ${seleccion} ha sido registrada.`, 'exito');
        
        // Limpiar formulario
        form.reset();
        opcionPavo.classList.remove('seleccionada');
        opcionPierna.classList.remove('seleccionada');
        seleccion = null;
        
    } catch (error) {
        console.error('Error al guardar en Firebase:', error);
        mostrarMensaje('Error al registrar tu elección. Intenta nuevamente.', 'error');
        enviarBtn.disabled = false;
    } finally {
        enviarBtn.textContent = 'Enviar elección';
    }
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo) {
    mensajeDiv.textContent = mensaje;
    mensajeDiv.className = 'mensaje';
    
    if (tipo === 'exito') {
        mensajeDiv.classList.add('exito');
    } else if (tipo === 'error') {
        mensajeDiv.classList.add('error');
    }
    
    // Ocultar mensaje después de 5 segundos
    setTimeout(() => {
        mensajeDiv.textContent = '';
        mensajeDiv.className = 'mensaje';
    }, 5000);
}