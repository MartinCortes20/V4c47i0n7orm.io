import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, Timestamp, query, where } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

let todosLosAfiliados = [];
let afiliadoSeleccionado = null;

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarAfiliados();
    configurarEventos();
});

// Configurar eventos
function configurarEventos() {
    document.getElementById('btnAplicarFiltros').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    document.getElementById('btnCerrarSesion').addEventListener('click', cerrarSesion);
}

// Función para cerrar sesión
function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        window.location.href = '../index.html';
    }
}

// Cargar todos los afiliados
async function cargarAfiliados() {
    try {
        const ingresosRef = collection(window.db, 'ingresos');
        const querySnapshot = await getDocs(ingresosRef);
        
        todosLosAfiliados = [];
        let pendientesCount = 0;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const afiliado = {
                id: doc.id,
                ...data
            };
            
            // Separar aprobados de pendientes
            if (data.aprobado === null) {
                pendientesCount++;
            } else if (data.aprobado === true || data.aprobado === undefined) {
                // Incluir aprobados y registros antiguos sin el campo aprobado
                todosLosAfiliados.push(afiliado);
            }
            // Los rechazados (aprobado === false) ya fueron eliminados
        });

        // Actualizar badge de pendientes
        document.getElementById('badgePendientes').textContent = pendientesCount;
        document.getElementById('totalPendientes').textContent = pendientesCount;

        actualizarEstadisticas();
        aplicarFiltros();
    } catch (error) {
        console.error('Error al cargar afiliados:', error);
        mostrarError('No se pudieron cargar los datos. Por favor, intenta nuevamente.');
    }
}

// Cargar solicitudes pendientes
async function cargarSolicitudesPendientes() {
    try {
        const ingresosRef = collection(window.db, 'ingresos');
        const querySnapshot = await getDocs(ingresosRef);
        
        const pendientes = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.aprobado === null) {
                pendientes.push({
                    id: doc.id,
                    ...data
                });
            }
        });

        mostrarSolicitudesPendientes(pendientes);
    } catch (error) {
        console.error('Error al cargar pendientes:', error);
        mostrarError('No se pudieron cargar las solicitudes pendientes.');
    }
}

// Actualizar estadísticas
function actualizarEstadisticas() {
    const activos = todosLosAfiliados.filter(a => a.status === 'A').length;
    const bajas = todosLosAfiliados.filter(a => a.status === 'B').length;
    const reingresos = todosLosAfiliados.filter(a => a.status === 'R').length;
    const despidos = todosLosAfiliados.filter(a => a.status === 'D').length;
    const planta = todosLosAfiliados.filter(a => a.status === 'AP').length;

    document.getElementById('totalActivos').textContent = activos;
    document.getElementById('totalBajas').textContent = bajas;
    document.getElementById('totalReingresos').textContent = reingresos;
    document.getElementById('totalDespidos').textContent = despidos;
    document.getElementById('totalPlanta').textContent = planta;
}

// Aplicar filtros
function aplicarFiltros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterMes = document.getElementById('filterMes').value;
    const filterAnio = document.getElementById('filterAnio').value;
    const filterTiempoBaja = document.getElementById('filterTiempoBaja').value;
    const sortBy = document.getElementById('sortBy').value;

    let filtrados = [...todosLosAfiliados];

    // Filtro de búsqueda
    if (searchTerm) {
        filtrados = filtrados.filter(a => 
            a.nombreCompleto.toLowerCase().includes(searchTerm) ||
            a.curp.toLowerCase().includes(searchTerm)
        );
    }

    // Filtro de estado
    if (filterStatus) {
        if (filterStatus === 'PUEDE_PLANTA') {
            // Filtro especial: mostrar solo los que pueden recibir planta
            filtrados = filtrados.filter(a => verificarPuedePlanta(a));
        } else {
            filtrados = filtrados.filter(a => a.status === filterStatus);
        }
    }

    // Filtro de mes
    if (filterMes !== '') {
        filtrados = filtrados.filter(a => {
            const fecha = a.fechaAlta.toDate();
            return fecha.getMonth() === parseInt(filterMes);
        });
    }

    // Filtro de año
    if (filterAnio) {
        filtrados = filtrados.filter(a => {
            const fecha = a.fechaAlta.toDate();
            return fecha.getFullYear() === parseInt(filterAnio);
        });
    }

    // Filtro de tiempo desde baja
    if (filterTiempoBaja) {
        filtrados = filtrados.filter(a => {
            if (a.status !== 'B' || !a.fechaBaja) return false;
            
            const mesesDesdeInhabilitación = calcularMesesDesde(a.fechaBaja.toDate());
            
            if (filterTiempoBaja === '6+') {
                return mesesDesdeInhabilitación >= 6;
            } else if (filterTiempoBaja === '3-6') {
                return mesesDesdeInhabilitación >= 3 && mesesDesdeInhabilitación < 6;
            } else if (filterTiempoBaja === '0-3') {
                return mesesDesdeInhabilitación < 3;
            }
            return true;
        });
    }

    // Ordenamiento
    filtrados.sort((a, b) => {
        switch(sortBy) {
            case 'fechaAlta-desc':
                return b.fechaAlta.toDate() - a.fechaAlta.toDate();
            case 'fechaAlta-asc':
                return a.fechaAlta.toDate() - b.fechaAlta.toDate();
            case 'nombre-asc':
                return a.nombreCompleto.localeCompare(b.nombreCompleto);
            case 'nombre-desc':
                return b.nombreCompleto.localeCompare(a.nombreCompleto);
            default:
                return 0;
        }
    });

    // Si el filtro de tiempo de baja está activo, priorizar los que pueden reingresar
    if (filterTiempoBaja === '6+') {
        filtrados.sort((a, b) => {
            const mesesA = calcularMesesDesde(a.fechaBaja.toDate());
            const mesesB = calcularMesesDesde(b.fechaBaja.toDate());
            return mesesB - mesesA; // Mayor tiempo primero
        });
    }

    mostrarAfiliados(filtrados);
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterMes').value = '';
    document.getElementById('filterAnio').value = '';
    document.getElementById('filterTiempoBaja').value = '';
    document.getElementById('sortBy').value = 'fechaAlta-desc';
    aplicarFiltros();
}

// Mostrar afiliados en la tabla
function mostrarAfiliados(afiliados) {
    const tbody = document.getElementById('tablaBody');
    document.getElementById('resultCount').textContent = `${afiliados.length} resultado${afiliados.length !== 1 ? 's' : ''}`;

    if (afiliados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No se encontraron resultados</td></tr>';
        return;
    }

    tbody.innerHTML = afiliados.map(afiliado => {
        const tiempoActivo = calcularTiempoActivo(afiliado);
        const statusTexto = getStatusTexto(afiliado.status);
        const fotoSrc = afiliado.fotoBase64 || afiliado.fotoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect fill="%23ddd" width="50" height="50"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
        
        // Verificar si puede reingresar (6 meses desde baja)
        let puedeReingresar = false;
        let mesesDesdeInhabilitacion = 0;
        if (afiliado.status === 'B' && afiliado.fechaBaja) {
            mesesDesdeInhabilitacion = calcularMesesDesde(afiliado.fechaBaja.toDate());
            puedeReingresar = mesesDesdeInhabilitacion >= 6 && (afiliado.totalReingresos || 0) < 2;
        }

        return `
            <tr>
                <td><img src="${fotoSrc}" alt="Foto" class="foto-mini"></td>
                <td>${afiliado.nombreCompleto}</td>
                <td>${afiliado.curp}</td>
                <td>${afiliado.puesto}</td>
                <td><span class="status-badge status-${afiliado.status}">${statusTexto}</span></td>
                <td>${afiliado.fechaIngresoEmpresa ? formatearFechaString(afiliado.fechaIngresoEmpresa) : 'No especificada'}</td>
                <td>${tiempoActivo}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-info" onclick="verDetalles('${afiliado.id}')">Ver</button>
                        <button class="btn-small btn-edit" onclick="editarAfiliado('${afiliado.id}')">Editar</button>
                        ${afiliado.status === 'A' || afiliado.status === 'R' ? 
                            `<button class="btn-small btn-baja" onclick="mostrarModalBaja('${afiliado.id}')">Dar de Baja</button>` 
                            : ''}
                        ${afiliado.status === 'B' ? 
                            puedeReingresar ? 
                                `<button class="btn-small btn-reingreso" onclick="mostrarModalReingreso('${afiliado.id}')">Reingresar</button>` 
                                : 
                                `<button class="btn-small btn-reingreso-disabled" onclick="mostrarMensajeNoReingresar('${afiliado.id}', ${mesesDesdeInhabilitacion.toFixed(1)})">Reingresar</button>`
                            : ''}
                        ${(afiliado.status === 'A' || afiliado.status === 'R') && afiliado.status !== 'AP' ? 
                            `<button class="btn-small btn-planta" onclick="mostrarModalPlanta('${afiliado.id}')">Otorgar Planta</button>` 
                            : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Calcular tiempo activo
function calcularTiempoActivo(afiliado) {
    let mesesTotales = afiliado.mesesActivos || 0;
    
    // Si está activo o en reingreso, calcular desde la última fecha activa
    if (afiliado.status === 'A' || afiliado.status === 'R') {
        const fechaInicio = afiliado.fechaReingreso ? afiliado.fechaReingreso.toDate() : afiliado.fechaAlta.toDate();
        const mesesActuales = calcularMesesDesde(fechaInicio);
        mesesTotales += mesesActuales;
    }
    
    const años = Math.floor(mesesTotales / 12);
    const meses = Math.round(mesesTotales % 12);
    
    if (años > 0) {
        return `${años} año${años > 1 ? 's' : ''} ${meses} mes${meses !== 1 ? 'es' : ''}`;
    }
    return `${meses} mes${meses !== 1 ? 'es' : ''}`;
}

// Calcular meses desde una fecha
function calcularMesesDesde(fecha) {
    const ahora = new Date();
    const diffTime = Math.abs(ahora - fecha);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays / 30; // Aproximación
}

// Verificar si puede reingresar
function verificarPuedeReingresar(afiliado) {
    if (afiliado.status !== 'B') return false;
    if (!afiliado.fechaBaja) return false;
    if (afiliado.totalReingresos >= 2) return false;
    
    const mesesDesdeInhabilitación = calcularMesesDesde(afiliado.fechaBaja.toDate());
    return mesesDesdeInhabilitación >= 6;
}

// Verificar si puede recibir planta
function verificarPuedePlanta(afiliado) {
    // Solo pueden recibir planta los que están activos (A) o en reingreso (R)
    if (afiliado.status !== 'A' && afiliado.status !== 'R') return false;
    
    // Calcular meses activos totales
    let mesesTotales = afiliado.mesesActivos || 0;
    
    // Agregar tiempo actual si está activo
    if (afiliado.status === 'A' || afiliado.status === 'R') {
        const fechaInicio = afiliado.fechaReingreso ? afiliado.fechaReingreso.toDate() : afiliado.fechaAlta.toDate();
        const mesesActuales = calcularMesesDesde(fechaInicio);
        mesesTotales += mesesActuales;
    }
    
    // Debe tener 24 meses o más
    return mesesTotales >= 24;
}

// Obtener texto de status
function getStatusTexto(status) {
    const statusMap = {
        'A': 'Activo',
        'B': 'Baja',
        'R': 'Reingreso',
        'D': 'Despido',
        'AP': 'Alta Planta'
    };
    return statusMap[status] || status;
}

// Formatear fecha
function formatearFecha(fecha) {
    return fecha.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Formatear fecha desde string (evita problemas de zona horaria)
function formatearFechaString(fechaString) {
    if (!fechaString) return 'No especificada';
    
    // Si ya es un objeto Date
    if (fechaString instanceof Date) {
        return formatearFecha(fechaString);
    }
    
    // Si es un string en formato YYYY-MM-DD
    const partes = fechaString.split('-');
    if (partes.length === 3) {
        const año = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1; // Meses en JavaScript van de 0-11
        const dia = parseInt(partes[2]);
        
        // Crear fecha en hora local (no UTC)
        const fecha = new Date(año, mes, dia);
        return formatearFecha(fecha);
    }
    
    // Fallback: intentar parsear normalmente
    return formatearFecha(new Date(fechaString));
}

// Editar afiliado
window.editarAfiliado = function(id) {
    afiliadoSeleccionado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliadoSeleccionado) return;

    // Rellenar el formulario con los datos actuales
    document.getElementById('editNombreCompleto').value = afiliadoSeleccionado.nombreCompleto;
    document.getElementById('editCurp').value = afiliadoSeleccionado.curp;
    document.getElementById('editLugarNacimiento').value = afiliadoSeleccionado.lugarNacimiento;
    document.getElementById('editFechaNacimiento').value = afiliadoSeleccionado.fechaNacimiento;
    document.getElementById('editDomicilio').value = afiliadoSeleccionado.domicilio;
    document.getElementById('editEstadoCivil').value = afiliadoSeleccionado.estadoCivil;
    document.getElementById('editSexo').value = afiliadoSeleccionado.sexo;
    document.getElementById('editTelefono').value = afiliadoSeleccionado.telefono;
    document.getElementById('editEscolaridad').value = afiliadoSeleccionado.escolaridad;
    document.getElementById('editPuesto').value = afiliadoSeleccionado.puesto;
    document.getElementById('editSalarioDiario').value = afiliadoSeleccionado.salarioDiario;
    document.getElementById('editFechaIngresoEmpresa').value = afiliadoSeleccionado.fechaIngresoEmpresa;

    // Mostrar foto actual si existe
    const fotoActualDiv = document.getElementById('fotoActualPreview');
    const fotoSrc = afiliadoSeleccionado.fotoBase64 || afiliadoSeleccionado.fotoURL;
    if (fotoSrc) {
        fotoActualDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>Foto actual:</strong><br>
                <img src="${fotoSrc}" alt="Foto actual" style="max-width: 150px; margin-top: 10px; border-radius: 8px; border: 2px solid #ddd;">
            </div>
        `;
    } else {
        fotoActualDiv.innerHTML = '<p style="color: #999;">Sin foto</p>';
    }

    // Limpiar el input de nueva foto
    document.getElementById('editFoto').value = '';
    document.getElementById('editFotoPreview').innerHTML = '';

    openModal('modalEditar');
};

// Guardar cambios del afiliado editado
window.guardarEdicion = async function() {
    if (!afiliadoSeleccionado) return;

    // Validar que los campos requeridos no estén vacíos
    const nombreCompleto = document.getElementById('editNombreCompleto').value.trim();
    const curp = document.getElementById('editCurp').value.trim().toUpperCase();
    const telefono = document.getElementById('editTelefono').value.trim();

    if (!nombreCompleto || !curp || !telefono) {
        mostrarError('Por favor, completa todos los campos obligatorios antes de continuar.');
        return;
    }

    // Validar CURP
    if (curp.length !== 18) {
        mostrarError('El CURP debe contener exactamente 18 caracteres.');
        return;
    }

    // Validar teléfono
    if (telefono.length !== 10 || !/^\d+$/.test(telefono)) {
        mostrarError('El número telefónico debe contener exactamente 10 dígitos.');
        return;
    }

    // Confirmar cambios
    document.getElementById('confirmMessage').textContent = '¿Confirmas guardar los cambios realizados?';
    openModal('modalConfirm');

    document.getElementById('btnConfirmYes').onclick = async () => {
        closeModal('modalConfirm');
        
        try {
            showLoading();

            // Preparar datos actualizados
            const datosActualizados = {
                nombreCompleto: nombreCompleto,
                curp: curp,
                lugarNacimiento: document.getElementById('editLugarNacimiento').value.trim(),
                fechaNacimiento: document.getElementById('editFechaNacimiento').value,
                domicilio: document.getElementById('editDomicilio').value.trim(),
                estadoCivil: document.getElementById('editEstadoCivil').value,
                sexo: document.getElementById('editSexo').value,
                telefono: telefono,
                escolaridad: document.getElementById('editEscolaridad').value,
                puesto: document.getElementById('editPuesto').value,
                salarioDiario: parseFloat(document.getElementById('editSalarioDiario').value),
                fechaIngresoEmpresa: document.getElementById('editFechaIngresoEmpresa').value
            };

            // Procesar nueva foto si se subió una
            const fotoInput = document.getElementById('editFoto');
            if (fotoInput.files.length > 0) {
                const fotoFile = fotoInput.files[0];
                
                // Validar tamaño
                if (fotoFile.size > 5 * 1024 * 1024) {
                    hideLoading();
                    mostrarError('La fotografía no puede superar los 5 MB. Por favor, selecciona una imagen más pequeña.');
                    return;
                }

                // Redimensionar y convertir a base64
                const resizedPhoto = await resizeImage(fotoFile);
                const photoBase64 = await convertToBase64(resizedPhoto);
                datosActualizados.fotoBase64 = photoBase64;
            }

            // Actualizar en Firestore
            const afiliadoRef = doc(window.db, 'ingresos', afiliadoSeleccionado.id);
            await updateDoc(afiliadoRef, datosActualizados);

            hideLoading();
            closeModal('modalEditar');
            mostrarExito('Los datos se han actualizado correctamente.');
            cargarAfiliados();

        } catch (error) {
            hideLoading();
            console.error('Error al actualizar:', error);
            mostrarError('No se pudieron actualizar los datos. Por favor, intenta nuevamente.');
        }
    };

    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
};

// Funciones auxiliares para edición de foto
async function resizeImage(file, maxWidth = 800, maxHeight = 1000, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

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

async function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Preview de nueva foto en el modal de edición
document.addEventListener('DOMContentLoaded', function() {
    const editFotoInput = document.getElementById('editFoto');
    if (editFotoInput) {
        editFotoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('editFotoPreview').innerHTML = `
                        <div style="margin-top: 10px;">
                            <strong>Nueva foto:</strong><br>
                            <img src="${e.target.result}" alt="Preview" style="max-width: 150px; margin-top: 10px; border-radius: 8px; border: 2px solid #3498db;">
                        </div>
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Ver detalles
window.verDetalles = function(id) {
    const afiliado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliado) return;

    const content = document.getElementById('detallesContent');
    const tiempoActivo = calcularTiempoActivo(afiliado);
    const fotoSrc = afiliado.fotoBase64 || afiliado.fotoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="40"%3ESin foto%3C/text%3E%3C/svg%3E';

    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="${fotoSrc}" alt="Foto" class="foto-detalle">
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Nombre Completo</div>
                <div class="detail-value">${afiliado.nombreCompleto}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">CURP</div>
                <div class="detail-value">${afiliado.curp}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Fecha de Nacimiento</div>
                <div class="detail-value">${afiliado.fechaNacimiento}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Lugar de Nacimiento</div>
                <div class="detail-value">${afiliado.lugarNacimiento}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Domicilio</div>
                <div class="detail-value">${afiliado.domicilio}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Teléfono</div>
                <div class="detail-value">${afiliado.telefono}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Estado Civil</div>
                <div class="detail-value">${afiliado.estadoCivil}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sexo</div>
                <div class="detail-value">${afiliado.sexo}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Escolaridad</div>
                <div class="detail-value">${afiliado.escolaridad}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Puesto</div>
                <div class="detail-value">${afiliado.puesto}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Salario Diario</div>
                <div class="detail-value">$${afiliado.salarioDiario.toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Estado</div>
                <div class="detail-value"><span class="status-badge status-${afiliado.status}">${getStatusTexto(afiliado.status)}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Fecha de Alta</div>
                <div class="detail-value">${formatearFecha(afiliado.fechaAlta.toDate())}</div>
            </div>
            ${afiliado.fechaIngresoEmpresa ? `
                <div class="detail-item" style="background: #ffe6e6; border-left-color: #e74c3c;">
                    <div class="detail-label" style="color: #c0392b; font-weight: 700;">Fecha de Ingreso a la Empresa</div>
                    <div class="detail-value" style="font-weight: 700; color: #e74c3c;">${formatearFechaString(afiliado.fechaIngresoEmpresa)}</div>
                </div>
            ` : ''}
            <div class="detail-item">
                <div class="detail-label">Tiempo Activo Total</div>
                <div class="detail-value">${tiempoActivo}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Número de Reingresos</div>
                <div class="detail-value">${afiliado.totalReingresos || 0}</div>
            </div>
            ${afiliado.fechaBaja ? `
                <div class="detail-item">
                    <div class="detail-label">Fecha de Baja</div>
                    <div class="detail-value">${formatearFecha(afiliado.fechaBaja.toDate())}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Motivo de Baja</div>
                    <div class="detail-value">${afiliado.motivoBaja}</div>
                </div>
            ` : ''}
            ${afiliado.fechaReingreso ? `
                <div class="detail-item">
                    <div class="detail-label">Fecha de Reingreso</div>
                    <div class="detail-value">${formatearFecha(afiliado.fechaReingreso.toDate())}</div>
                </div>
            ` : ''}
            ${afiliado.fechaDespido ? `
                <div class="detail-item">
                    <div class="detail-label">Fecha de Despido</div>
                    <div class="detail-value">${formatearFecha(afiliado.fechaDespido.toDate())}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Motivo de Despido</div>
                    <div class="detail-value">${afiliado.motivoDespido}</div>
                </div>
            ` : ''}
            ${afiliado.fechaPlanta ? `
                <div class="detail-item" style="background: #fff9c4; border-left-color: #f9a825;">
                    <div class="detail-label" style="color: #f57f17;">🌟 Fecha de Planta</div>
                    <div class="detail-value" style="font-weight: 700; color: #f57f17;">${formatearFecha(afiliado.fechaPlanta.toDate())}</div>
                </div>
            ` : ''}
        </div>
    `;

    openModal('modalDetalles');
};

// Mostrar modal de planta
window.mostrarModalPlanta = function(id) {
    afiliadoSeleccionado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliadoSeleccionado) return;

    // Calcular meses totales
    let mesesTotales = afiliadoSeleccionado.mesesActivos || 0;
    if (afiliadoSeleccionado.status === 'A' || afiliadoSeleccionado.status === 'R') {
        const fechaInicio = afiliadoSeleccionado.fechaReingreso ? 
            afiliadoSeleccionado.fechaReingreso.toDate() : 
            afiliadoSeleccionado.fechaAlta.toDate();
        const mesesActuales = calcularMesesDesde(fechaInicio);
        mesesTotales += mesesActuales;
    }

    const años = Math.floor(mesesTotales / 12);
    const meses = Math.round(mesesTotales % 12);
    const cumple24Meses = mesesTotales >= 24;

    const mensaje = `
        ${cumple24Meses ? `
            <div class="alert-box alert-success">
                <strong>✓ Este afiliado ya cumplió los 24 meses reglamentarios</strong>
            </div>
        ` : `
            <div class="alert-box alert-warning">
                <strong>⚠️ Este afiliado aún no cumple 24 meses</strong><br>
                Como administrador, puedes otorgar planta de manera anticipada si lo consideras necesario.
            </div>
        `}
        
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Nombre</div>
                <div class="detail-value">${afiliadoSeleccionado.nombreCompleto}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Tiempo Total Acumulado</div>
                <div class="detail-value">${años} año${años !== 1 ? 's' : ''} ${meses} mes${meses !== 1 ? 'es' : ''}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Estado Actual</div>
                <div class="detail-value"><span class="status-badge status-${afiliadoSeleccionado.status}">${getStatusTexto(afiliadoSeleccionado.status)}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Fecha de Alta Original</div>
                <div class="detail-value">${formatearFecha(afiliadoSeleccionado.fechaAlta.toDate())}</div>
            </div>
            ${afiliadoSeleccionado.fechaReingreso ? `
                <div class="detail-item">
                    <div class="detail-label">Fecha de Último Reingreso</div>
                    <div class="detail-value">${formatearFecha(afiliadoSeleccionado.fechaReingreso.toDate())}</div>
                </div>
            ` : ''}
        </div>
        
        <div class="alert-box alert-info">
            <strong>¿Qué significa "PLANTA"?</strong><br>
            Al otorgar planta, el empleado pasa a tener un estatus permanente (Alta Planta - AP). 
            Normalmente se otorga después de 24 meses de servicio activo, pero como administrador 
            puedes otorgarlo en cualquier momento por méritos especiales o decisión de la empresa.
        </div>
    `;

    document.getElementById('plantaInfo').innerHTML = mensaje;
    openModal('modalPlanta');
    
    document.getElementById('btnConfirmarPlanta').onclick = confirmarPlanta;
};

// Confirmar planta
async function confirmarPlanta() {
    document.getElementById('confirmMessage').textContent = '¿Confirmas otorgar PLANTA a este afiliado?';
    openModal('modalConfirm');
    
    document.getElementById('btnConfirmYes').onclick = async () => {
        closeModal('modalConfirm');
        closeModal('modalPlanta');
        
        try {
            showLoading();

            // Calcular meses activos totales al momento de otorgar planta
            const fechaInicio = afiliadoSeleccionado.fechaReingreso ? 
                afiliadoSeleccionado.fechaReingreso.toDate() : 
                afiliadoSeleccionado.fechaAlta.toDate();
            const mesesActualesActivos = calcularMesesDesde(fechaInicio);
            const nuevosTotalMeses = (afiliadoSeleccionado.mesesActivos || 0) + mesesActualesActivos;

            // Actualizar documento
            const afiliadoRef = doc(window.db, 'ingresos', afiliadoSeleccionado.id);
            await updateDoc(afiliadoRef, {
                status: 'AP',
                fechaPlanta: Timestamp.now(),
                mesesActivos: nuevosTotalMeses
            });

            hideLoading();
            mostrarExito('La planta se ha otorgado exitosamente al empleado.');
            cargarAfiliados();
        } catch (error) {
            hideLoading();
            console.error('Error al otorgar planta:', error);
            mostrarError('No se pudo procesar el otorgamiento de planta. Por favor, intenta nuevamente.');
        }
    };
    
    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
}

// Mostrar modal de baja
window.mostrarModalBaja = function(id) {
    afiliadoSeleccionado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliadoSeleccionado) return;

    document.getElementById('nombreBaja').textContent = afiliadoSeleccionado.nombreCompleto;
    document.getElementById('motivoBaja').value = '';
    
    openModal('modalBaja');
    
    // Configurar botón de confirmación
    document.getElementById('btnConfirmarBaja').onclick = confirmarBaja;
};

// Confirmar baja
async function confirmarBaja() {
    const motivo = document.getElementById('motivoBaja').value.trim();
    
    if (!motivo) {
        alert('Debes ingresar un motivo para la baja');
        return;
    }

    // Mostrar confirmación final
    document.getElementById('confirmMessage').textContent = '¿Estás seguro de dar de baja a este afiliado?';
    openModal('modalConfirm');
    
    document.getElementById('btnConfirmYes').onclick = async () => {
        closeModal('modalConfirm');
        closeModal('modalBaja');
        
        try {
            showLoading();

            // Calcular meses activos actuales
            const fechaInicio = afiliadoSeleccionado.fechaReingreso ? 
                afiliadoSeleccionado.fechaReingreso.toDate() : 
                afiliadoSeleccionado.fechaAlta.toDate();
            const mesesActualesActivos = calcularMesesDesde(fechaInicio);
            const nuevosTotalMeses = (afiliadoSeleccionado.mesesActivos || 0) + mesesActualesActivos;

            // Actualizar documento
            const afiliadoRef = doc(window.db, 'ingresos', afiliadoSeleccionado.id);
            await updateDoc(afiliadoRef, {
                status: 'B',
                fechaBaja: Timestamp.now(),
                motivoBaja: motivo,
                mesesActivos: nuevosTotalMeses
            });

            hideLoading();
            mostrarExito('El empleado ha sido dado de baja exitosamente.');
            cargarAfiliados();
        } catch (error) {
            hideLoading();
            console.error('Error al dar de baja:', error);
            mostrarError('No se pudo procesar la baja del empleado. Por favor, intenta nuevamente.');
        }
    };
    
    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
}

// Mostrar mensaje cuando no puede reingresar aún
window.mostrarMensajeNoReingresar = function(id, mesesDesdeInhabilitacion) {
    const afiliado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliado) return;
    
    const mesesFaltantes = Math.ceil(6 - mesesDesdeInhabilitacion);
    const fechaBaja = afiliado.fechaBaja.toDate();
    const fechaPuedeReingresar = new Date(fechaBaja);
    fechaPuedeReingresar.setMonth(fechaPuedeReingresar.getMonth() + 6);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>⏱️ No Puede Reingresar</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="alert-box alert-danger">
                    <strong>❌ No puedes reingresarlo aún</strong><br>
                    El empleado no ha cumplido los <strong>6 meses de descanso</strong> obligatorios.
                </div>
                
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Nombre</div>
                        <div class="detail-value">${afiliado.nombreCompleto}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha de Baja</div>
                        <div class="detail-value">${formatearFecha(fechaBaja)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Tiempo Transcurrido</div>
                        <div class="detail-value">${Math.floor(mesesDesdeInhabilitacion)} mes(es) y ${Math.floor((mesesDesdeInhabilitacion % 1) * 30)} día(s)</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Tiempo Faltante</div>
                        <div class="detail-value" style="color: #e74c3c; font-weight: 700;">${mesesFaltantes} mes(es)</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Podrá Reingresar Desde</div>
                        <div class="detail-value" style="color: #27ae60; font-weight: 700;">${formatearFecha(fechaPuedeReingresar)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Motivo de Baja</div>
                        <div class="detail-value">${afiliado.motivoBaja || 'No especificado'}</div>
                    </div>
                </div>
                
                <div class="alert-box alert-info">
                    <strong>ℹ️ Periodo de Descanso Obligatorio</strong><br>
                    El reglamento establece que después de una baja, el empleado debe cumplir un período de <strong>6 meses de descanso</strong> antes de poder ser reingresado. Esto garantiza que tanto el empleado como la empresa tengan tiempo adecuado para evaluar la situación.
                </div>
                
                <div class="modal-buttons">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">Entendido</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// Mostrar modal de reingreso
window.mostrarModalReingreso = function(id) {
    afiliadoSeleccionado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliadoSeleccionado) return;

    const mesesDesdeInhabilitación = calcularMesesDesde(afiliadoSeleccionado.fechaBaja.toDate());
    const mesesActivos = afiliadoSeleccionado.mesesActivos || 0;
    const mesesRestantes = Math.max(0, 24 - mesesActivos);
    const totalReingresos = afiliadoSeleccionado.totalReingresos || 0;

    const mensaje = `
        <div class="alert-box alert-success">
            <strong>✓ Este afiliado puede reingresar</strong><br>
            Ha cumplido el período de descanso de 6 meses.
        </div>
        
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Nombre</div>
                <div class="detail-value">${afiliadoSeleccionado.nombreCompleto}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Meses activos acumulados</div>
                <div class="detail-value">${Math.round(mesesActivos)} meses</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Meses restantes hasta 24</div>
                <div class="detail-value">${Math.round(mesesRestantes)} meses</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Reingresos previos</div>
                <div class="detail-value">${totalReingresos} de 2</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Fecha de baja</div>
                <div class="detail-value">${formatearFecha(afiliadoSeleccionado.fechaBaja.toDate())}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Tiempo desde baja</div>
                <div class="detail-value">${Math.round(mesesDesdeInhabilitación)} mes(es)</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Motivo de baja</div>
                <div class="detail-value">${afiliadoSeleccionado.motivoBaja || 'No especificado'}</div>
            </div>
        </div>
        
        <div class="alert-box alert-info">
            <strong>ℹ️ Sobre el Reingreso</strong><br>
            Al confirmar, el empleado pasará a estado de <strong>Reingreso (R)</strong> y podrá continuar acumulando tiempo hasta completar los 24 meses permitidos.
        </div>
    `;

    document.getElementById('reingresoInfo').innerHTML = mensaje;
    document.getElementById('btnConfirmarReingreso').style.display = 'inline-block';
    
    openModal('modalReingreso');
    document.getElementById('btnConfirmarReingreso').onclick = confirmarReingreso;
};

// Confirmar reingreso
async function confirmarReingreso() {
    document.getElementById('confirmMessage').textContent = '¿Confirmas el reingreso de este afiliado?';
    openModal('modalConfirm');
    
    document.getElementById('btnConfirmYes').onclick = async () => {
        closeModal('modalConfirm');
        closeModal('modalReingreso');
        
        try {
            showLoading();

            const afiliadoRef = doc(window.db, 'ingresos', afiliadoSeleccionado.id);
            await updateDoc(afiliadoRef, {
                status: 'R',
                fechaReingreso: Timestamp.now(),
                totalReingresos: (afiliadoSeleccionado.totalReingresos || 0) + 1
            });

            hideLoading();
            mostrarExito('El empleado ha sido reingresado exitosamente.');
            cargarAfiliados();
        } catch (error) {
            hideLoading();
            console.error('Error al reingresar:', error);
            mostrarError('No se pudo procesar el reingreso del empleado. Por favor, intenta nuevamente.');
        }
    };
    
    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
}

// Funciones de modal
window.openModal = function(modalId) {
    document.getElementById(modalId).style.display = 'block';
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// Funciones de UI
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'modal';
    loadingDiv.id = 'loadingModal';
    loadingDiv.style.display = 'block';
    loadingDiv.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
            <div class="spinner-small" style="width: 60px; height: 60px; border-width: 5px;"></div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loading = document.getElementById('loadingModal');
    if (loading) loading.remove();
}

// Sistema de notificaciones elegante
function mostrarExito(mensaje) {
    mostrarNotificacion(mensaje, 'success');
}

function mostrarError(mensaje) {
    mostrarNotificacion(mensaje, 'error');
}

function mostrarNotificacion(mensaje, tipo) {
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion notificacion-${tipo}`;
    
    // Agregar contenido
    notificacion.innerHTML = `
        <div class="notificacion-contenido">
            <div class="notificacion-icono">
                ${tipo === 'success' ? 
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : 
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                }
            </div>
            <div class="notificacion-mensaje">${mensaje}</div>
        </div>
        <div class="notificacion-progreso"></div>
    `;
    
    // Agregar al body
    document.body.appendChild(notificacion);
    
    // Animar entrada
    setTimeout(() => {
        notificacion.classList.add('notificacion-visible');
    }, 10);
    
    // Remover después de 4 segundos
    setTimeout(() => {
        notificacion.classList.remove('notificacion-visible');
        setTimeout(() => {
            notificacion.remove();
        }, 300);
    }, 4000);
}

// Mostrar solicitudes pendientes
function mostrarSolicitudesPendientes(pendientes) {
    const tbody = document.getElementById('tablaPendientesBody');
    document.getElementById('pendientesCount').textContent = `${pendientes.length} solicitud${pendientes.length !== 1 ? 'es' : ''}`;

    if (pendientes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
                    <div style="font-size: 18px; font-weight: 600;">No hay solicitudes pendientes</div>
                    <div style="font-size: 14px; margin-top: 10px;">Todas las solicitudes han sido revisadas.</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pendientes.map(solicitud => {
        const fotoSrc = solicitud.fotoBase64 || solicitud.fotoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect fill="%23ddd" width="50" height="50"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
        const fechaSolicitud = solicitud.fechaSolicitud ? formatearFecha(solicitud.fechaSolicitud.toDate()) : 'No especificada';

        return `
            <tr>
                <td><img src="${fotoSrc}" alt="Foto" class="foto-mini"></td>
                <td>${solicitud.nombreCompleto}</td>
                <td>${solicitud.curp}</td>
                <td>${solicitud.puesto}</td>
                <td>${solicitud.telefono}</td>
                <td>${fechaSolicitud}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-info" onclick="verDetallesSolicitud('${solicitud.id}')">Ver Detalles</button>
                        <button class="btn-small btn-aprobar" onclick="aprobarSolicitud('${solicitud.id}')">Aprobar</button>
                        <button class="btn-small btn-rechazar" onclick="rechazarSolicitud('${solicitud.id}')">Rechazar</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Ver detalles de solicitud
window.verDetallesSolicitud = async function(id) {
    try {
        // Buscar directamente en Firestore
        const docRef = doc(window.db, 'ingresos', id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            mostrarError('No se encontró la solicitud.');
            return;
        }
        
        const solicitud = { id: docSnap.id, ...docSnap.data() };
        
        // Verificar que sea una solicitud pendiente
        if (solicitud.aprobado !== null) {
            mostrarError('Esta solicitud ya fue procesada.');
            return;
        }
        
        // Mostrar detalles usando el mismo formato que verDetalles()
        const fotoSrc = solicitud.fotoBase64 || solicitud.fotoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="48"%3E?%3C/text%3E%3C/svg%3E';
        const tiempoActivo = '0 meses (pendiente de aprobación)';
        
        document.getElementById('detallesContent').innerHTML = `
            <div class="alert-box alert-warning" style="margin-bottom: 20px;">
                <strong>⚠️ Solicitud Pendiente de Aprobación</strong><br>
                Esta persona aún no ha sido aprobada como afiliado. Revisa cuidadosamente la información antes de aprobar o rechazar.
            </div>
            
            <div class="detail-photo">
                <img src="${fotoSrc}" alt="Foto del solicitante">
            </div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Nombre Completo</div>
                    <div class="detail-value">${solicitud.nombreCompleto}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">CURP</div>
                    <div class="detail-value">${solicitud.curp}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Lugar de Nacimiento</div>
                    <div class="detail-value">${solicitud.lugarNacimiento || 'No especificado'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Fecha de Nacimiento</div>
                    <div class="detail-value">${solicitud.fechaNacimiento || 'No especificada'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Domicilio</div>
                    <div class="detail-value">${solicitud.domicilio || 'No especificado'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Estado Civil</div>
                    <div class="detail-value">${solicitud.estadoCivil}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Sexo</div>
                    <div class="detail-value">${solicitud.sexo}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Teléfono</div>
                    <div class="detail-value">${solicitud.telefono}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Escolaridad</div>
                    <div class="detail-value">${solicitud.escolaridad}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Puesto</div>
                    <div class="detail-value">${solicitud.puesto}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Salario Diario</div>
                    <div class="detail-value">$${solicitud.salarioDiario ? solicitud.salarioDiario.toFixed(2) : '0.00'}</div>
                </div>
                ${solicitud.fechaIngresoEmpresa ? `
                    <div class="detail-item" style="background: #ffe6e6; border-left-color: #e74c3c;">
                        <div class="detail-label" style="color: #c0392b; font-weight: 700;">Fecha de Ingreso a la Empresa</div>
                        <div class="detail-value" style="font-weight: 700; color: #e74c3c;">${formatearFechaString(solicitud.fechaIngresoEmpresa)}</div>
                    </div>
                ` : ''}
                <div class="detail-item" style="background: #e3f2fd; border-left-color: #2196f3;">
                    <div class="detail-label" style="color: #1976d2; font-weight: 700;">Fecha de Solicitud</div>
                    <div class="detail-value" style="font-weight: 700; color: #2196f3;">${solicitud.fechaSolicitud ? formatearFecha(solicitud.fechaSolicitud.toDate()) : 'No disponible'}</div>
                </div>
            </div>
            
            <div class="modal-buttons" style="margin-top: 30px;">
                <button class="btn-success" onclick="closeModal('modalDetalles'); aprobarSolicitud('${id}')">Aprobar Solicitud</button>
                <button class="btn-danger" onclick="closeModal('modalDetalles'); rechazarSolicitud('${id}')">Rechazar Solicitud</button>
                <button class="btn-secondary" onclick="closeModal('modalDetalles')">Cerrar</button>
            </div>
        `;
        
        document.querySelector('#modalDetalles .modal-header h2').textContent = 'Detalles de la Solicitud Pendiente';
        openModal('modalDetalles');
        
    } catch (error) {
        console.error('Error al ver detalles:', error);
        mostrarError('No se pudieron cargar los detalles de la solicitud.');
    }
};

// Aprobar solicitud
window.aprobarSolicitud = async function(id) {
    document.getElementById('confirmMessage').textContent = '¿Confirmas que deseas APROBAR esta solicitud? El afiliado aparecerá en el panel principal.';
    openModal('modalConfirm');

    document.getElementById('btnConfirmYes').onclick = async () => {
        closeModal('modalConfirm');
        
        try {
            showLoading();
            const docRef = doc(window.db, 'ingresos', id);
            await updateDoc(docRef, {
                aprobado: true
            });
            
            hideLoading();
            mostrarExito('La solicitud ha sido aprobada exitosamente.');
            
            // Recargar ambas vistas
            await cargarAfiliados();
            await cargarSolicitudesPendientes();
            
        } catch (error) {
            hideLoading();
            console.error('Error al aprobar:', error);
            mostrarError('No se pudo aprobar la solicitud. Por favor, intenta nuevamente.');
        }
    };

    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
};

// Rechazar solicitud
window.rechazarSolicitud = async function(id) {
    document.getElementById('confirmMessage').textContent = '¿Confirmas que deseas RECHAZAR esta solicitud? El registro será eliminado permanentemente de la base de datos.';
    openModal('modalConfirm');

    document.getElementById('btnConfirmYes').onclick = async () => {
        closeModal('modalConfirm');
        
        try {
            showLoading();
            const docRef = doc(window.db, 'ingresos', id);
            await deleteDoc(docRef);
            
            hideLoading();
            mostrarExito('La solicitud ha sido rechazada y eliminada de la base de datos.');
            
            // Recargar ambas vistas
            await cargarAfiliados();
            await cargarSolicitudesPendientes();
            
        } catch (error) {
            hideLoading();
            console.error('Error al rechazar:', error);
            mostrarError('No se pudo rechazar la solicitud. Por favor, intenta nuevamente.');
        }
    };

    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
};

// Manejar cambio de pestañas
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            
            // Actualizar botones activos
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Mostrar/ocultar secciones
            if (tab === 'afiliados') {
                document.getElementById('filtrosAfiliados').classList.remove('hidden');
                document.getElementById('seccionAfiliados').classList.remove('hidden');
                document.getElementById('seccionPendientes').classList.add('hidden');
            } else if (tab === 'pendientes') {
                document.getElementById('filtrosAfiliados').classList.add('hidden');
                document.getElementById('seccionAfiliados').classList.add('hidden');
                document.getElementById('seccionPendientes').classList.remove('hidden');
                cargarSolicitudesPendientes();
            }
        });
    });
});