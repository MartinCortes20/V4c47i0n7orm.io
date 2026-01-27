import { collection, addDoc, query, where, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

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

// Actualizar nombre de firma cuando se escribe el nombre
document.getElementById('nombreCompleto').addEventListener('input', (e) => {
    document.getElementById('nombreFirma').textContent = e.target.value.toUpperCase();
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

// Función para validar CURP
function validarCURP(curp) {
    // Validación básica: debe tener 18 caracteres
    if (!curp || curp.length !== 18) {
        return false;
    }
    
    // Convertir a mayúsculas
    curp = curp.toUpperCase();
    
    // Patrón más flexible del CURP
    // 4 letras + 6 números + H/M + 5 caracteres alfanuméricos + 2 números
    const regex = /^[A-Z]{4}[0-9]{6}[HM][A-Z0-9]{5}[0-9A-Z]{2}$/;
    
    return regex.test(curp);
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

// Validar CURP completo con mensajes específicos
function validarCURPCompleto(curp) {
    // Convertir a mayúsculas
    curp = curp.toUpperCase().trim();
    
    // 1. Verificar longitud
    if (curp.length !== 18) {
        return {
            valido: false,
            error: 'longitud incorrecta (debe tener exactamente 18 caracteres)'
        };
    }
    
    // 2. Verificar formato general con expresión regular
    const regexCURP = /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|1[0-9]|2[0-9]|3[0-1])[HM]{1}(AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]{1}[0-9]{1}$/;
    
    if (!regexCURP.test(curp)) {
        // Verificaciones específicas para dar mensaje claro
        
        // Verificar si tiene números donde deberían ser letras
        const primeraParte = curp.substring(0, 4);
        if (/[0-9]/.test(primeraParte)) {
            return {
                valido: false,
                error: 'las primeras 4 letras no deben contener números (verifica que no confundas O con 0)'
            };
        }
        
        // Verificar fecha (posiciones 4-9)
        const año = curp.substring(4, 6);
        const mes = curp.substring(6, 8);
        const dia = curp.substring(8, 10);
        
        if (!/^[0-9]{2}$/.test(año) || !/^[0-9]{2}$/.test(mes) || !/^[0-9]{2}$/.test(dia)) {
            return {
                valido: false,
                error: 'la fecha de nacimiento (posiciones 5-10) debe contener solo números'
            };
        }
        
        const mesNum = parseInt(mes);
        const diaNum = parseInt(dia);
        
        if (mesNum < 1 || mesNum > 12) {
            return {
                valido: false,
                error: `el mes "${mes}" no es válido (debe estar entre 01 y 12)`
            };
        }
        
        if (diaNum < 1 || diaNum > 31) {
            return {
                valido: false,
                error: `el día "${dia}" no es válido (debe estar entre 01 y 31)`
            };
        }
        
        // Verificar sexo (posición 10)
        const sexo = curp.charAt(10);
        if (sexo !== 'H' && sexo !== 'M') {
            return {
                valido: false,
                error: `el carácter de sexo "${sexo}" no es válido (debe ser H o M)`
            };
        }
        
        // Verificar estado (posiciones 11-12)
        const estado = curp.substring(11, 13);
        const estadosValidos = ['AS','BC','BS','CC','CS','CH','CL','CM','DF','DG','GT','GR','HG','JC','MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ','YN','ZS','NE'];
        
        if (!estadosValidos.includes(estado)) {
            return {
                valido: false,
                error: `el código de estado "${estado}" no es válido`
            };
        }
        
        // Verificar consonantes internas (posiciones 13-15)
        const consonantes = curp.substring(13, 16);
        if (!/^[B-DF-HJ-NP-TV-Z]{3}$/.test(consonantes)) {
            return {
                valido: false,
                error: 'las consonantes internas (posiciones 14-16) no son válidas (verifica que no confundas letras con números)'
            };
        }
        
        // Si llegamos aquí, es otro error de formato
        return {
            valido: false,
            error: 'formato general incorrecto (verifica cada sección de tu CURP)'
        };
    }
    
    return { valido: true };
}

// Convertir automáticamente a mayúsculas en tiempo real
const camposMayusculas = ['nombres', 'apellidoPaterno', 'apellidoMaterno', 'lugarNacimiento', 'domicilio', 'puesto'];

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

// Validar CURP en tiempo real con mensaje visual
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
            // Mostrar mensaje de error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'curp-error-message';
            errorDiv.innerHTML = `
                <strong>⚠️ Verifica tu CURP</strong><br>
                No cumple con: ${validacion.error}
            `;
            input.parentElement.appendChild(errorDiv);
            input.style.borderColor = '#e74c3c';
        } else {
            input.style.borderColor = '#27ae60';
        }
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
        showErrorModal(`Tu CURP no es válido:<br><br><strong>No cumple con:</strong> ${validacionCURP.error}<br><br>Por favor verifica y corrige tu CURP.`);
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

            // Datos laborales (TODO EN MAYÚSCULAS)
            empresa: 'COSBEL S.A. de C.V.',
            giroEmpresa: 'Cosméticos y Productos de Belleza',
            puesto: document.getElementById('puesto').value.toUpperCase(),
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