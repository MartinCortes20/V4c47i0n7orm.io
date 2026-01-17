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
            <div class="success-icon">✓</div>
            <h2>¡Solicitud Enviada!</h2>
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
            <div class="error-icon">✕</div>
            <h2>Error</h2>
            <p>${message}</p>
            <div class="modal-buttons">
                <button class="btn-primary" onclick="this.closest('.modal').remove()">Aceptar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Validar CURP en tiempo real
document.getElementById('curp').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

// Envío del formulario
document.getElementById('formAfiliacion').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validaciones adicionales
    const curp = document.getElementById('curp').value;
    if (!validarCURP(curp)) {
        showErrorModal('El CURP ingresado no tiene un formato válido. Debe tener 18 caracteres.');
        return;
    }

    const foto = document.getElementById('foto').files[0];
    if (!foto) {
        showErrorModal('Debes seleccionar una fotografía.');
        return;
    }

    if (!document.getElementById('aceptoTerminos').checked) {
        showErrorModal('Debes aceptar los términos para continuar.');
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

        // Preparar datos para guardar
        const datosAfiliacion = {
            // Datos personales
            nombreCompleto: document.getElementById('nombreCompleto').value.trim(),
            curp: curp,
            lugarNacimiento: document.getElementById('lugarNacimiento').value.trim(),
            fechaNacimiento: document.getElementById('fechaNacimiento').value,
            domicilio: document.getElementById('domicilio').value.trim(),
            estadoCivil: document.getElementById('estadoCivil').value,
            sexo: document.getElementById('sexo').value,
            telefono: document.getElementById('telefono').value,
            escolaridad: document.getElementById('escolaridad').value,
            fotoBase64: photoBase64,

            // Datos laborales
            empresa: 'COSBEL S.A. de C.V.',
            giroEmpresa: 'Cosméticos y Productos de Belleza',
            puesto: document.getElementById('puesto').value,
            salarioDiario: parseFloat(document.getElementById('salarioDiario').value),
            fechaIngresoEmpresa: document.getElementById('fechaIngresoEmpresa').value,

            // Datos de control
            fechaAlta: Timestamp.now(),
            status: 'A', // A = Alta
            fechaSolicitud: Timestamp.now(),
            
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
        showSuccessModal('Tu solicitud de afiliación ha sido enviada exitosamente. El sindicato revisará tu solicitud y te contactará pronto.');

    } catch (error) {
        hideLoading();
        console.error('Error al enviar la solicitud:', error);
        showErrorModal('Ocurrió un error al enviar tu solicitud. Por favor, intenta nuevamente. Error: ' + error.message);
    }
});