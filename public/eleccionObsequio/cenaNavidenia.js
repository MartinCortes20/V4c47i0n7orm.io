// Configuración de Firebase
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
let formularioValido = false;

// Elementos DOM
const form = document.getElementById('cenaForm');
const nombreInput = document.getElementById('nombre');
const numEmpleadoInput = document.getElementById('numEmpleado');
const opcionPavo = document.getElementById('pavo');
const opcionPierna = document.getElementById('pierna');
const enviarBtn = document.getElementById('enviarBtn');
const mensajeDiv = document.getElementById('mensaje');
const modal = document.getElementById('modalConfirmacion');
const confirmacionTexto = document.getElementById('confirmacionTexto');
const btnEditar = document.getElementById('btnEditar');
const btnEnviar = document.getElementById('btnEnviar');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    opcionPavo.addEventListener('click', () => seleccionarOpcion('pavo'));
    opcionPierna.addEventListener('click', () => seleccionarOpcion('pierna'));
    
    form.addEventListener('submit', manejarEnvioFormulario);
    
    // Validar en tiempo real si el número de empleado ya existe
    numEmpleadoInput.addEventListener('blur', verificarNumEmpleado);
    
    // Validar campos en tiempo real
    nombreInput.addEventListener('input', function() {
        if (this.value.trim() !== '') {
            ocultarError('nombre');
        }
        verificarCampos();
    });
    
    numEmpleadoInput.addEventListener('input', function() {
        if (this.value.trim() !== '') {
            ocultarError('numEmpleado');
        }
        verificarCampos();
    });
    
    // Manejar clic en botón deshabilitado
    enviarBtn.addEventListener('click', function(e) {
        if (this.disabled) {
            e.preventDefault();
            
            // Mostrar mensajes de error según lo que falte
            if (nombreInput.value.trim() === '') {
                mostrarError('nombre', 'Por favor ingresa tu nombre completo');
            }
            
            if (numEmpleadoInput.value.trim() === '') {
                mostrarError('numEmpleado', 'Por favor ingresa tu número de empleado');
            }
            
            if (seleccion === null) {
                mostrarMensaje('Por favor selecciona una opción de cena', 'error');
            }
        }
    });
    
    // Manejar botones del modal
    btnEditar.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    btnEnviar.addEventListener('click', enviarFormulario);
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
    
    formularioValido = nombreValido && numEmpleadoValido && opcionValida && !numEmpleadoExiste;
    enviarBtn.disabled = !formularioValido;
    
    return formularioValido;
}

// Mostrar u ocultar mensajes de error
function mostrarError(elemento, mensaje) {
    const errorDiv = document.getElementById(elemento + 'Error');
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    document.getElementById(elemento).classList.add('error');
}

function ocultarError(elemento) {
    document.getElementById(elemento + 'Error').style.display = 'none';
    document.getElementById(elemento).classList.remove('error');
}

// Función para manejar el envío del formulario
function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    // Validar campos
    let camposValidos = true;
    
    if (nombreInput.value.trim() === '') {
        mostrarError('nombre', 'Por favor ingresa tu nombre completo');
        camposValidos = false;
    }
    
    if (numEmpleadoInput.value.trim() === '') {
        mostrarError('numEmpleado', 'Por favor ingresa tu número de empleado');
        camposValidos = false;
    }
    
    if (seleccion === null) {
        mostrarMensaje('Por favor selecciona una opción de cena', 'error');
        camposValidos = false;
    }
    
    if (!camposValidos || numEmpleadoExiste) {
        return;
    }
    
    // Mostrar modal de confirmación
    const nombre = nombreInput.value.trim().toUpperCase();
    const tipoCena = seleccion.toUpperCase();
    confirmacionTexto.innerHTML = `¿Estás seguro <strong>${nombre}</strong>?<br>Elegiste <strong>${tipoCena}</strong>`;
    modal.style.display = 'flex';
}

// Función para enviar el formulario
async function enviarFormulario() {
    // Obtener y limpiar datos
    const nombre = nombreInput.value.trim().toUpperCase();
    const numEmpleado = numEmpleadoInput.value.trim();
    
    // Cerrar modal
    modal.style.display = 'none';
    
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
        
        // Deshabilitar el formulario después del envío
        nombreInput.disabled = true;
        numEmpleadoInput.disabled = true;
        opcionPavo.style.pointerEvents = 'none';
        opcionPierna.style.pointerEvents = 'none';
        opcionPavo.style.opacity = '0.7';
        opcionPierna.style.opacity = '0.7';
        enviarBtn.disabled = true;
        
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