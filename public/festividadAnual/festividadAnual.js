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
let numEmpleadoExiste = false;
let nombreCompletoExiste = false;
let formularioValido = false;

// Elementos DOM
const form = document.getElementById('fiestaForm');
const nombreInput = document.getElementById('nombre');
const apellidoPaternoInput = document.getElementById('apellidoPaterno');
const apellidoMaternoInput = document.getElementById('apellidoMaterno');
const numEmpleadoInput = document.getElementById('numEmpleado');
const enviarBtn = document.getElementById('enviarBtn');
const mensajeDiv = document.getElementById('mensaje');
const modal = document.getElementById('modalConfirmacion');
const confirmacionTexto = document.getElementById('confirmacionTexto');
const btnEditar = document.getElementById('btnEditar');
const btnEnviar = document.getElementById('btnEnviar');

// Sistema de Notificaciones
class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.createContainer();
    }
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 5000, dismissible = true) {
        const notification = this.createNotification(message, type, dismissible);
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Mostrar con animación
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Auto-dismiss si se especifica duración
        if (duration > 0 && dismissible) {
            notification.classList.add('auto-dismiss');
            setTimeout(() => {
                this.hide(notification);
            }, duration);
        }
        
        return notification;
    }
    
    createNotification(message, type, dismissible) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            success: '✓',
            error: '⚠',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <div class="notification-icon">${iconMap[type] || 'ℹ'}</div>
            <div class="notification-content">${message}</div>
            ${dismissible ? '<button class="notification-close">×</button>' : ''}
        `;
        
        // Evento para cerrar
        if (dismissible) {
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                this.hide(notification);
            });
        }
        
        return notification;
    }
    
    hide(notification) {
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 400);
    }
    
    hideAll() {
        this.notifications.forEach(notification => {
            this.hide(notification);
        });
    }
    
    error(message, duration = 0) {
        return this.show(message, 'error', duration);
    }
    
    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }
    
    warning(message, duration = 7000) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// Inicializar sistema de notificaciones
const notifications = new NotificationSystem();

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    form.addEventListener('submit', manejarEnvioFormulario);
    
    // Validar en tiempo real si el número de empleado ya existe
    numEmpleadoInput.addEventListener('blur', verificarNumEmpleado);
    
    // Validar nombre completo cuando se completen todos los campos de nombre
    nombreInput.addEventListener('blur', verificarNombreCompletoSiEstaCompleto);
    apellidoPaternoInput.addEventListener('blur', verificarNombreCompletoSiEstaCompleto);
    apellidoMaternoInput.addEventListener('blur', verificarNombreCompletoSiEstaCompleto);
    
    // Validar campos en tiempo real
    nombreInput.addEventListener('input', function() {
        validarSoloLetras(this);
        if (this.value.trim() !== '') {
            ocultarError('nombre');
        }
        verificarCampos();
    });
    
    apellidoPaternoInput.addEventListener('input', function() {
        validarSoloLetras(this);
        if (this.value.trim() !== '') {
            ocultarError('apellidoPaterno');
        }
        verificarCampos();
    });
    
    apellidoMaternoInput.addEventListener('input', function() {
        validarSoloLetras(this);
        if (this.value.trim() !== '') {
            ocultarError('apellidoMaterno');
        }
        verificarCampos();
    });
    
    numEmpleadoInput.addEventListener('input', function() {
        validarSoloNumeros(this);
        // Limitar a 6 caracteres
        if (this.value.length > 6) {
            this.value = this.value.slice(0, 6);
        }
        if (this.value.trim() !== '') {
            ocultarError('numEmpleado');
        }
        verificarCampos();
    });
    
    // Manejar botones del modal
    btnEditar.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    btnEnviar.addEventListener('click', enviarFormulario);
});

// Función para validar solo letras
function validarSoloLetras(input) {
    input.value = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    input.value = input.value.toUpperCase();
}

// Función para validar solo números
function validarSoloNumeros(input) {
    input.value = input.value.replace(/\D/g, '');
}

// Función para verificar si el número de empleado ya existe
async function verificarNumEmpleado() {
    const numEmpleado = numEmpleadoInput.value.trim();
    
    if (!numEmpleado) return;
    
    // Verificar que tenga exactamente 6 caracteres
    if (numEmpleado.length !== 6) {
        notifications.error(' El número de empleado debe tener exactamente 6 dígitos');
        enviarBtn.disabled = true;
        return;
    }
    
    try {
        const querySnapshot = await db.collection('fiestaFinAnio')
            .where('numEmpleado', '==', numEmpleado)
            .get();
            
        numEmpleadoExiste = !querySnapshot.empty;
        
        if (numEmpleadoExiste) {
            notifications.error(' Este número de empleado ya ha confirmado su asistencia');
            enviarBtn.disabled = true;
        } else {
            // Solo limpiar mensaje si no hay otros errores
            if (mensajeDiv.classList.contains('error') && 
                mensajeDiv.textContent.includes('número de empleado')) {
                mensajeDiv.textContent = '';
                mensajeDiv.className = 'mensaje';
            }
            verificarCampos();
        }
    } catch (error) {
        console.error('Error verificando número de empleado:', error);
        notifications.error(' Error al verificar el número de empleado. Intenta nuevamente');
    }
}

// Función para verificar nombre completo solo si está completo
async function verificarNombreCompletoSiEstaCompleto() {
    const nombre = nombreInput.value.trim();
    const apellidoPaterno = apellidoPaternoInput.value.trim();
    const apellidoMaterno = apellidoMaternoInput.value.trim();
    
    if (nombre && apellidoPaterno && apellidoMaterno) {
        await verificarNombreCompleto();
    }
}

// Función para verificar si el nombre completo ya existe
async function verificarNombreCompleto() {
    const nombre = nombreInput.value.trim().toUpperCase();
    const apellidoPaterno = apellidoPaternoInput.value.trim().toUpperCase();
    const apellidoMaterno = apellidoMaternoInput.value.trim().toUpperCase();
    const nombreCompleto = `${nombre} ${apellidoPaterno} ${apellidoMaterno}`;
    
    if (!nombre || !apellidoPaterno || !apellidoMaterno) return false;
    
    try {
        const querySnapshot = await db.collection('fiestaFinAnio')
            .where('nombre', '==', nombreCompleto)
            .get();
            
        nombreCompletoExiste = !querySnapshot.empty;
        
        if (nombreCompletoExiste) {
            notifications.error('Este nombre completo ya ha confirmado su asistencia');
            enviarBtn.disabled = true;
        } else {
            // Solo limpiar mensaje si no hay otros errores
            if (mensajeDiv.classList.contains('error') && 
                mensajeDiv.textContent.includes('nombre completo')) {
                mensajeDiv.textContent = '';
                mensajeDiv.className = 'mensaje';
            }
            verificarCampos();
        }
        return nombreCompletoExiste;
    } catch (error) {
        console.error('Error verificando nombre completo:', error);
        notifications.error('Error al verificar el nombre completo. Intenta nuevamente');
        return true; // Asumir que existe para prevenir envío
    }
}

// Función para verificar si todos los campos están completos
function verificarCampos() {
    const nombreValido = nombreInput.value.trim() !== '';
    const apellidoPaternoValido = apellidoPaternoInput.value.trim() !== '';
    const apellidoMaternoValido = apellidoMaternoInput.value.trim() !== '';
    const numEmpleadoValido = numEmpleadoInput.value.trim() !== '' && numEmpleadoInput.value.trim().length === 6;
    
    formularioValido = nombreValido && apellidoPaternoValido && apellidoMaternoValido && 
                      numEmpleadoValido && !numEmpleadoExiste && !nombreCompletoExiste;
    enviarBtn.disabled = !formularioValido;
    
    return formularioValido;
}

// Mostrar u ocultar mensajes de error
function mostrarError(elemento, mensaje) {
    const errorDiv = document.getElementById(elemento + 'Error');
    if (errorDiv) {
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
        document.getElementById(elemento).classList.add('error');
    }
}

function ocultarError(elemento) {
    const errorDiv = document.getElementById(elemento + 'Error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        document.getElementById(elemento).classList.remove('error');
    }
}

// Función para validar todos los campos y mostrar errores específicos
function validarTodosLosCampos() {
    let todosValidos = true;
    let camposFaltantes = [];
    
    // Limpiar errores previos
    ocultarError('nombre');
    ocultarError('apellidoPaterno');
    ocultarError('apellidoMaterno');
    ocultarError('numEmpleado');
    
    // Validar cada campo
    if (nombreInput.value.trim() === '') {
        mostrarError('nombre', 'Por favor ingresa tu(s) nombre(s)');
        camposFaltantes.push('Nombre(s)');
        todosValidos = false;
    }
    
    if (apellidoPaternoInput.value.trim() === '') {
        mostrarError('apellidoPaterno', 'Por favor ingresa tu apellido paterno');
        camposFaltantes.push('Apellido Paterno');
        todosValidos = false;
    }
    
    if (apellidoMaternoInput.value.trim() === '') {
        mostrarError('apellidoMaterno', 'Por favor ingresa tu apellido materno');
        camposFaltantes.push('Apellido Materno');
        todosValidos = false;
    }
    
    if (numEmpleadoInput.value.trim() === '') {
        mostrarError('numEmpleado', 'Por favor ingresa tu número de empleado');
        camposFaltantes.push('Número de Empleado');
        todosValidos = false;
    } else if (numEmpleadoInput.value.trim().length !== 6) {
        mostrarError('numEmpleado', 'El número de empleado debe tener exactamente 6 dígitos');
        camposFaltantes.push('Número de Empleado (6 dígitos)');
        todosValidos = false;
    }
    
    // Mostrar notificación con campos faltantes
    if (camposFaltantes.length > 0) {
        const mensaje = camposFaltantes.length === 1 
            ? `⚠️ Falta completar: ${camposFaltantes[0]}`
            : `⚠️ Faltan completar los siguientes campos:\n• ${camposFaltantes.join('\n• ')}`;
        
        notifications.error(mensaje);
    }
    
    return todosValidos;
}

// Función para manejar el envío del formulario
async function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    // Validar todos los campos y mostrar errores específicos
    const camposValidos = validarTodosLosCampos();
    
    if (!camposValidos) {
        return;
    }
    
    // Verificar duplicados antes de mostrar el modal
    if (numEmpleadoExiste) {
        notifications.error(' Este número de empleado ya ha confirmado su asistencia');
        return;
    }
    
    // Verificar nombre completo antes del modal
    const nombreDuplicado = await verificarNombreCompleto();
    if (nombreDuplicado) {
        return;
    }
    
    // Si llegamos aquí, todo está válido, mostrar modal de confirmación
    const nombre = nombreInput.value.trim().toUpperCase();
    const apellidoPaterno = apellidoPaternoInput.value.trim().toUpperCase();
    const apellidoMaterno = apellidoMaternoInput.value.trim().toUpperCase();
    const nombreCompleto = `${nombre} ${apellidoPaterno} ${apellidoMaterno}`;
    
    confirmacionTexto.innerHTML = `¿<strong>${nombreCompleto}</strong> Estás segura o seguro? <br>Estás a punto de confirmar tu asistencia a la Fiesta de Fin de Año`;
    modal.style.display = 'flex';
}

// Función para enviar el formulario
async function enviarFormulario() {
    // Obtener y limpiar datos
    const nombre = nombreInput.value.trim().toUpperCase();
    const apellidoPaterno = apellidoPaternoInput.value.trim().toUpperCase();
    const apellidoMaterno = apellidoMaternoInput.value.trim().toUpperCase();
    const nombreCompleto = `${nombre} ${apellidoPaterno} ${apellidoMaterno}`;
    const numEmpleado = numEmpleadoInput.value.trim();
    
    // Cerrar modal
    modal.style.display = 'none';
    
    // Mostrar notificación de proceso
    notifications.info('Procesando tu confirmación...', 0);
    
    // Deshabilitar botón durante el envío
    enviarBtn.disabled = true;
    enviarBtn.textContent = 'Enviando...';
    
    try {
        // Verificar una vez más antes de guardar (por seguridad)
        const querySnapshot = await db.collection('fiestaFinAnio')
            .where('numEmpleado', '==', numEmpleado)
            .get();
            
        if (!querySnapshot.empty) {
            notifications.hideAll();
            notifications.error(' Este número de empleado ya ha confirmado su asistencia');
            enviarBtn.disabled = false;
            enviarBtn.textContent = 'Confirmar asistencia';
            return;
        }
        
        const querySnapshot2 = await db.collection('fiestaFinAnio')
            .where('nombre', '==', nombreCompleto)
            .get();
            
        if (!querySnapshot2.empty) {
            notifications.hideAll();
            notifications.error(' Este nombre completo ya ha confirmado su asistencia');
            enviarBtn.disabled = false;
            enviarBtn.textContent = 'Confirmar asistencia';
            return;
        }
        
        // Guardar en Firebase
        await db.collection('fiestaFinAnio').add({
            nombre: nombreCompleto,
            apellidoPaterno: apellidoPaterno,
            apellidoMaterno: apellidoMaterno,
            numEmpleado: numEmpleado,
            fecha: new Date()
        });
        
        // Limpiar notificaciones anteriores y mostrar éxito
        notifications.hideAll();
        notifications.success(` ¡Gracias ${nombre}! Tu asistencia ha sido confirmada exitosamente`, 8000);
        
        // Mostrar mensaje de éxito también en el área del formulario
        mostrarMensaje(`¡Gracias ${nombre}! Tu asistencia ha sido confirmada exitosamente.`, 'exito');
        
        // Deshabilitar el formulario después del envío
        nombreInput.disabled = true;
        apellidoPaternoInput.disabled = true;
        apellidoMaternoInput.disabled = true;
        numEmpleadoInput.disabled = true;
        enviarBtn.disabled = true;
        
    } catch (error) {
        console.error('Error al guardar en Firebase:', error);
        notifications.hideAll();
        notifications.error(' Error al confirmar tu asistencia. Por favor intenta nuevamente');
        mostrarMensaje('Error al confirmar tu asistencia. Intenta nuevamente.', 'error');
        enviarBtn.disabled = false;
    } finally {
        enviarBtn.textContent = 'Confirmar asistencia';
    }
}

// Función para mostrar mensajes (mantenida para compatibilidad)
function mostrarMensaje(mensaje, tipo) {
    mensajeDiv.textContent = mensaje;
    mensajeDiv.className = 'mensaje';
    
    if (tipo === 'exito') {
        mensajeDiv.classList.add('exito');
    } else if (tipo === 'error') {
        mensajeDiv.classList.add('error');
    }
    
    // Ocultar mensaje después de 5 segundos solo si es de éxito
    if (tipo === 'exito') {
        setTimeout(() => {
            mensajeDiv.textContent = '';
            mensajeDiv.className = 'mensaje';
        }, 5000);
    }
}