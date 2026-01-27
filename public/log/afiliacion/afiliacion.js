import { collection, addDoc, query, where, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ===== ENVOLVER TODO EN DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {

// Configurar fecha actual
const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const hoy = new Date();
document.getElementById('diaActual').textContent = hoy.getDate();
document.getElementById('mesActual').textContent = meses[hoy.getMonth()];
document.getElementById('anioActual').textContent = hoy.getFullYear();

// Preview de la foto
const inputFoto = document.getElementById('foto');
const previewFoto = document.getElementById('previewFoto');

inputFoto.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        // Validar tamaño (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es demasiado grande. El tamaño máximo es 5MB.');
            inputFoto.value = '';
            return;
        }

        // Validar tipo
        if (!file.type.match('image/(jpeg|jpg|png)')) {
            alert('Solo se permiten imágenes JPG, JPEG o PNG.');
            inputFoto.value = '';
            return;
        }

        // Mostrar preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewFoto.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
});

// Actualizar nombre de firma cuando se escriben los nombres
const actualizarFirma = () => {
    const nombres = document.getElementById('nombres')?.value || '';
    const paterno = document.getElementById('apellidoPaterno')?.value || '';
    const materno = document.getElementById('apellidoMaterno')?.value || '';
    const nombreCompleto = `${nombres} ${paterno} ${materno}`.trim().toUpperCase();
    document.getElementById('nombreFirma').textContent = nombreCompleto;
};

// Agregar listeners a los 3 campos
['nombres', 'apellidoPaterno', 'apellidoMaterno'].forEach(campoId => {
    const elemento = document.getElementById(campoId);
    if (elemento) {
        elemento.addEventListener('input', actualizarFirma);
    }
});

// Botón limpiar
document.getElementById('btnLimpiar').addEventListener('click', () => {
    if (confirm('¿Estás seguro de que deseas limpiar el formulario?')) {
        document.getElementById('formAfiliacion').reset();
        previewFoto.innerHTML = '';
        document.getElementById('nombreFirma').textContent = '';
    }
});

// Función para redimensionar imagen
async function resizeImage(file, maxWidth = 800, maxHeight = 1000, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calcular nuevas dimensiones manteniendo aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    }));
                }, 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Función para convertir imagen a base64
async function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Función para mostrar loading
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.remove();
    }
}

// Función para mostrar modal de éxito
function showSuccessModal(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="success-icon">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <h2>Solicitud Enviada Exitosamente</h2>
            <p>${message}</p>
            <div class="modal-buttons">
                <button class="btn-primary" onclick="location.reload()">Aceptar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Función para mostrar modal de error
function showErrorModal(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="error-icon">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </div>
            <h2>No se Pudo Completar la Solicitud</h2>
            <p>${message}</p>
            <div class="modal-buttons">
                <button class="btn-primary" onclick="this.closest('.modal').remove()">Entendido</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ===== VALIDACIÓN COMPLETA DE CURP =====

// Palabras altisonantes que se reemplazan por X
const palabrasAltisonantes = [
    'BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO',
    'COGE', 'COGI', 'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO',
    'GETA', 'GUEI', 'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKA',
    'KAKO', 'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO',
    'LOCA', 'LOCO', 'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR',
    'MION', 'MOCO', 'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 'PENE',
    'PIPI', 'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO',
    'RUIN', 'SENO', 'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY'
];

// Códigos de estados válidos
const estadosValidos = [
    'AS', 'BC', 'BS', 'CC', 'CS', 'CH', 'CL', 'CM', 'DF', 'DG', 
    'GT', 'GR', 'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC', 
    'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ', 
    'YN', 'ZS', 'NE'
];

// Función para validar fecha completa (incluyendo días según mes)
function validarFecha(anio, mes, dia) {
    // Convertir año de 2 dígitos a 4 dígitos
    const anioCompleto = parseInt(anio) <= new Date().getFullYear() % 100 
        ? 2000 + parseInt(anio) 
        : 1900 + parseInt(anio);
    
    const mesNum = parseInt(mes);
    const diaNum = parseInt(dia);
    
    // Validar mes
    if (mesNum < 1 || mesNum > 12) {
        return { valido: false, error: `el mes "${mes}" no es válido (debe estar entre 01 y 12)` };
    }
    
    // Días por mes
    const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    // Año bisiesto
    if (anioCompleto % 4 === 0 && (anioCompleto % 100 !== 0 || anioCompleto % 400 === 0)) {
        diasPorMes[1] = 29;
    }
    
    // Validar día según el mes
    if (diaNum < 1 || diaNum > diasPorMes[mesNum - 1]) {
        return { 
            valido: false, 
            error: `el día "${dia}" no es válido para el mes ${mes} (debe estar entre 01 y ${diasPorMes[mesNum - 1].toString().padStart(2, '0')})` 
        };
    }
    
    return { valido: true };
}

// Validar CURP completo con todas las reglas
function validarCURPCompleto(curp) {
    // Convertir a mayúsculas y eliminar espacios
    curp = curp.toUpperCase().trim();
    
    // 1. Verificar longitud exacta
    if (curp.length !== 18) {
        return {
            valido: false,
            error: `longitud incorrecta (tiene ${curp.length} caracteres, debe tener exactamente 18)`
        };
    }
    
    // 2. Verificar patrón general básico
    const patronBasico = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{2}$/;
    if (!patronBasico.test(curp)) {
        // Desglosar errores específicos
        
        // Primeros 4 caracteres (letras)
        const primeros4 = curp.substring(0, 4);
        if (!/^[A-Z]{4}$/.test(primeros4)) {
            return {
                valido: false,
                error: `los primeros 4 caracteres "${primeros4}" deben ser solo letras (verifica que no haya números)`
            };
        }
        
        // Fecha (posiciones 5-10)
        const fecha = curp.substring(4, 10);
        if (!/^[0-9]{6}$/.test(fecha)) {
            return {
                valido: false,
                error: `la fecha de nacimiento (posiciones 5-10: "${fecha}") debe contener solo 6 números en formato AAMMDD`
            };
        }
        
        // Sexo (posición 11)
        const sexo = curp[10];
        if (sexo !== 'H' && sexo !== 'M') {
            return {
                valido: false,
                error: `el carácter de sexo "${sexo}" (posición 11) no es válido, debe ser H (Hombre) o M (Mujer)`
            };
        }
        
        // Estado (posiciones 12-13)
        const estado = curp.substring(11, 13);
        if (!estadosValidos.includes(estado)) {
            return {
                valido: false,
                error: `el código de estado "${estado}" (posiciones 12-13) no es válido. Ejemplos válidos: DF, NL, JC, etc.`
            };
        }
        
        // Consonantes internas (posiciones 14-16)
        const consonantes = curp.substring(13, 16);
        if (!/^[B-DF-HJ-NP-TV-Z]{3}$/.test(consonantes)) {
            return {
                valido: false,
                error: `las consonantes internas "${consonantes}" (posiciones 14-16) no son válidas (no pueden ser vocales ni Ñ)`
            };
        }
        
        // Homoclave (posiciones 17-18)
        const homoclave = curp.substring(16, 18);
        if (!/^[0-9A-Z]{2}$/.test(homoclave)) {
            return {
                valido: false,
                error: `la homoclave "${homoclave}" (últimos 2 caracteres) debe ser alfanumérica`
            };
        }
        
        // Error genérico si no se detectó el problema específico
        return {
            valido: false,
            error: 'formato general incorrecto, verifica cada sección de tu CURP'
        };
    }
    
    // 3. Validar fecha de nacimiento completa
    const anio = curp.substring(4, 6);
    const mes = curp.substring(6, 8);
    const dia = curp.substring(8, 10);
    
    const validacionFecha = validarFecha(anio, mes, dia);
    if (!validacionFecha.valido) {
        return validacionFecha;
    }
    
    // 4. Verificar si contiene palabra altisonante
    const primeros4 = curp.substring(0, 4);
    if (palabrasAltisonantes.includes(primeros4)) {
        // Si detectamos palabra altisonante pero no tiene X en posición 2
        if (curp[1] !== 'X') {
            return {
                valido: false,
                error: `los primeros 4 caracteres "${primeros4}" forman una palabra no permitida. En CURPs oficiales esto se corrige con una "X" en la segunda posición`
            };
        }
    }
    
    // 5. Validar estado
    const estado = curp.substring(11, 13);
    if (!estadosValidos.includes(estado)) {
        return {
            valido: false,
            error: `el código de estado "${estado}" no corresponde a ninguna entidad federativa válida`
        };
    }
    
    // 6. Todo correcto
    return { valido: true };
}

// Convertir automáticamente a mayúsculas en tiempo real (SOLO INPUTS DE TEXTO)
const camposMayusculas = ['nombres', 'apellidoPaterno', 'apellidoMaterno', 'lugarNacimiento', 'domicilio'];

camposMayusculas.forEach(campoId => {
    const elemento = document.getElementById(campoId);
    if (elemento) {
        elemento.addEventListener('input', (e) => {
            const cursorPos = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(cursorPos, cursorPos);
        });
    }
});

// Validar CURP en tiempo real con mensaje visual mejorado
document.getElementById('curp').addEventListener('input', (e) => {
    const input = e.target;
    input.value = input.value.toUpperCase();
    
    // Remover mensaje de error previo si existe
    const errorPrevio = input.parentElement.querySelector('.curp-error-message');
    if (errorPrevio) {
        errorPrevio.remove();
    }
    
    // Si tiene 18 caracteres, validar
    if (input.value.length === 18) {
        const validacion = validarCURPCompleto(input.value);
        
        if (!validacion.valido) {
            // Mostrar mensaje de error detallado
            const errorDiv = document.createElement('div');
            errorDiv.className = 'curp-error-message';
            errorDiv.innerHTML = `
                <strong>⚠️ Tu CURP no es válida</strong><br>
                ${validacion.error}
            `;
            input.parentElement.appendChild(errorDiv);
            input.style.borderColor = '#e74c3c';
        } else {
            // CURP válida
            input.style.borderColor = '#27ae60';
        }
    } else if (input.value.length > 0) {
        // Mostrar progreso
        input.style.borderColor = '#ffa500';
    } else {
        input.style.borderColor = '';
    }
});

// Envío del formulario
document.getElementById('formAfiliacion').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validaciones adicionales
    const curp = document.getElementById('curp').value.toUpperCase();
    const validacionCURP = validarCURPCompleto(curp);
    
    if (!validacionCURP.valido) {
        showErrorModal(`Tu CURP no es válida:<br><br><strong>Problema detectado:</strong><br>${validacionCURP.error}<br><br>Por favor verifica y corrige tu CURP.`);
        return;
    }

    const foto = document.getElementById('foto').files[0];
    if (!foto) {
        showErrorModal('Por favor, selecciona una fotografía para continuar con tu solicitud.');
        return;
    }

    if (!document.getElementById('aceptoTerminos').checked) {
        showErrorModal('Debes leer y aceptar los términos y condiciones para poder continuar.');
        return;
    }

    try {
        showLoading();

        // Verificar si ya existe un registro con este CURP
        const ingresosRef = collection(window.db, 'ingresos');
        const q = query(ingresosRef, where('curp', '==', curp));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            hideLoading();
            const doc = querySnapshot.docs[0].data();
            
            // Verificar el estado del registro
            if (doc.status === 'A') {
                showErrorModal('Ya existe una solicitud activa con este CURP.');
                return;
            } else if (doc.status === 'R') {
                showErrorModal('Ya tienes un reingreso activo. Contacta al administrador.');
                return;
            } else if (doc.status === 'D') {
                showErrorModal('Tu cuenta ha sido dada de baja permanentemente. Solo el administrador puede reactivarla.');
                return;
            } else if (doc.status === 'B') {
                // Verificar si han pasado 6 meses desde la baja
                const fechaBaja = doc.fechaBaja.toDate();
                const mesesDesdeInhabilitación = (new Date() - fechaBaja) / (1000 * 60 * 60 * 24 * 30);
                
                if (mesesDesdeInhabilitación < 6) {
                    const mesesFaltantes = Math.ceil(6 - mesesDesdeInhabilitación);
                    showErrorModal(`Debes esperar ${mesesFaltantes} mes(es) más antes de poder reingresar. Tu baja fue el ${fechaBaja.toLocaleDateString()}.`);
                    return;
                } else {
                    showErrorModal('Ya tienes un registro previo. Contacta al administrador para procesar tu reingreso.');
                    return;
                }
            }
        }

        // Redimensionar y convertir la foto a base64
        const resizedPhoto = await resizeImage(foto);
        const photoBase64 = await convertToBase64(resizedPhoto);

        // Concatenar nombre completo desde los 3 campos separados
        const nombres = document.getElementById('nombres').value.trim().toUpperCase();
        const apellidoPaterno = document.getElementById('apellidoPaterno').value.trim().toUpperCase();
        const apellidoMaterno = document.getElementById('apellidoMaterno').value.trim().toUpperCase();
        const nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`;

        // Obtener valor del select de puesto (ya viene en el formato correcto del HTML)
        const puestoSeleccionado = document.getElementById('puesto').value;

        // Preparar datos para guardar
        const datosAfiliacion = {
            // Datos personales (TODO EN MAYÚSCULAS)
            nombreCompleto: nombreCompleto,
            curp: curp.toUpperCase(),
            lugarNacimiento: document.getElementById('lugarNacimiento').value.trim().toUpperCase(),
            fechaNacimiento: document.getElementById('fechaNacimiento').value,
            domicilio: document.getElementById('domicilio').value.trim().toUpperCase(),
            estadoCivil: document.getElementById('estadoCivil').value,
            sexo: document.getElementById('sexo').value,
            telefono: document.getElementById('telefono').value,
            escolaridad: document.getElementById('escolaridad').value,
            fotoBase64: photoBase64,

            // Datos laborales
            empresa: 'COSBEL S.A. de C.V.',
            giroEmpresa: 'Cosméticos y Productos de Belleza',
            puesto: puestoSeleccionado,
            salarioDiario: parseFloat(document.getElementById('salarioDiario').value),
            fechaIngresoEmpresa: document.getElementById('fechaIngresoEmpresa').value,

            // Datos de control
            fechaAlta: Timestamp.now(),
            status: 'A', // A = Alta
            fechaSolicitud: Timestamp.now(),
            aprobado: null, // null = pendiente aprobación, true = aprobado, false = rechazado
            
            // Inicializar campos vacíos para futuras actualizaciones
            fechaBaja: null,
            motivoBaja: null,
            fechaReingreso: null,
            fechaDespido: null,
            motivoDespido: null,
            
            // Contador de tiempo activo (en meses)
            mesesActivos: 0,
            totalReingresos: 0
        };

        // Guardar en Firestore
        await addDoc(collection(window.db, 'ingresos'), datosAfiliacion);

        hideLoading();
        showSuccessModal('Tu solicitud de afiliación ha sido recibida exitosamente. El sindicato la revisará y te contactará a la brevedad posible.');

    } catch (error) {
        hideLoading();
        console.error('Error al enviar la solicitud:', error);
        showErrorModal('Ocurrió un error al enviar tu solicitud. Por favor, intenta nuevamente. Error: ' + error.message);
    }
});

// ===== FIN DEL DOMContentLoaded =====
});