import { collection, getDocs, doc, updateDoc, Timestamp, query, where } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

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
        querySnapshot.forEach((doc) => {
            todosLosAfiliados.push({
                id: doc.id,
                ...doc.data()
            });
        });

        actualizarEstadisticas();
        aplicarFiltros();
    } catch (error) {
        console.error('Error al cargar afiliados:', error);
        mostrarError('Error al cargar los datos');
    }
}

// Actualizar estadísticas
function actualizarEstadisticas() {
    const activos = todosLosAfiliados.filter(a => a.status === 'A').length;
    const bajas = todosLosAfiliados.filter(a => a.status === 'B').length;
    const reingresos = todosLosAfiliados.filter(a => a.status === 'R').length;
    const despidos = todosLosAfiliados.filter(a => a.status === 'D').length;

    document.getElementById('totalActivos').textContent = activos;
    document.getElementById('totalBajas').textContent = bajas;
    document.getElementById('totalReingresos').textContent = reingresos;
    document.getElementById('totalDespidos').textContent = despidos;
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
        filtrados = filtrados.filter(a => a.status === filterStatus);
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
        const puedeReingresar = verificarPuedeReingresar(afiliado);
        const fotoSrc = afiliado.fotoBase64 || afiliado.fotoURL || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect fill="%23ddd" width="50" height="50"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';

        return `
            <tr>
                <td><img src="${fotoSrc}" alt="Foto" class="foto-mini"></td>
                <td>${afiliado.nombreCompleto}</td>
                <td>${afiliado.curp}</td>
                <td>${afiliado.puesto}</td>
                <td><span class="status-badge status-${afiliado.status}">${statusTexto}</span></td>
                <td>${formatearFecha(afiliado.fechaAlta.toDate())}</td>
                <td>${tiempoActivo}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-info" onclick="verDetalles('${afiliado.id}')">Ver</button>
                        ${afiliado.status === 'A' || afiliado.status === 'R' ? 
                            `<button class="btn-small btn-baja" onclick="mostrarModalBaja('${afiliado.id}')">Dar de Baja</button>` 
                            : ''}
                        ${afiliado.status === 'B' && puedeReingresar ? 
                            `<button class="btn-small btn-reingreso" onclick="mostrarModalReingreso('${afiliado.id}')">Reingresar</button>` 
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

// Obtener texto de status
function getStatusTexto(status) {
    const statusMap = {
        'A': 'Activo',
        'B': 'Baja',
        'R': 'Reingreso',
        'D': 'Despido'
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
                <div class="detail-label">Fecha Ingreso Empresa</div>
                <div class="detail-value">${afiliado.fechaIngresoEmpresa}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Estado</div>
                <div class="detail-value"><span class="status-badge status-${afiliado.status}">${getStatusTexto(afiliado.status)}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Fecha de Alta</div>
                <div class="detail-value">${formatearFecha(afiliado.fechaAlta.toDate())}</div>
            </div>
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
        </div>
    `;

    openModal('modalDetalles');
};

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
            mostrarExito('Afiliado dado de baja exitosamente');
            cargarAfiliados();
        } catch (error) {
            hideLoading();
            console.error('Error al dar de baja:', error);
            mostrarError('Error al procesar la baja');
        }
    };
    
    document.getElementById('btnConfirmNo').onclick = () => {
        closeModal('modalConfirm');
    };
}

// Mostrar modal de reingreso
window.mostrarModalReingreso = function(id) {
    afiliadoSeleccionado = todosLosAfiliados.find(a => a.id === id);
    if (!afiliadoSeleccionado) return;

    const mesesDesdeInhabilitación = calcularMesesDesde(afiliadoSeleccionado.fechaBaja.toDate());
    const mesesActivos = afiliadoSeleccionado.mesesActivos || 0;
    const mesesRestantes = Math.max(0, 24 - mesesActivos);
    const totalReingresos = afiliadoSeleccionado.totalReingresos || 0;

    let mensaje = '';
    let puedeReingresar = true;

    if (totalReingresos >= 2) {
        mensaje = `<div class="alert-box alert-danger">
            Este afiliado ya ha alcanzado el límite de 2 reingresos. No puede volver a ingresar.
        </div>`;
        puedeReingresar = false;
    } else if (mesesDesdeInhabilitación < 6) {
        mensaje = `<div class="alert-box alert-warning">
            Este afiliado no puede reingresar aún. Debe esperar ${Math.ceil(6 - mesesDesdeInhabilitación)} mes(es) más.
        </div>`;
        puedeReingresar = false;
    } else if (mesesActivos >= 24) {
        mensaje = `<div class="alert-box alert-danger">
            Este afiliado ya cumplió los 24 meses permitidos. No puede reingresar.
        </div>`;
        puedeReingresar = false;
    } else {
        mensaje = `
            <div class="alert-box alert-success">
                <strong>✓ Este afiliado puede reingresar</strong>
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
                    <div class="detail-label">Motivo de baja</div>
                    <div class="detail-value">${afiliadoSeleccionado.motivoBaja}</div>
                </div>
            </div>
        `;
    }

    document.getElementById('reingresoInfo').innerHTML = mensaje;
    document.getElementById('btnConfirmarReingreso').style.display = puedeReingresar ? 'inline-block' : 'none';
    
    openModal('modalReingreso');
    
    if (puedeReingresar) {
        document.getElementById('btnConfirmarReingreso').onclick = confirmarReingreso;
    }
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
            mostrarExito('Afiliado reingresado exitosamente');
            cargarAfiliados();
        } catch (error) {
            hideLoading();
            console.error('Error al reingresar:', error);
            mostrarError('Error al procesar el reingreso');
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

function mostrarExito(mensaje) {
    alert('✓ ' + mensaje);
}

function mostrarError(mensaje) {
    alert('✕ ' + mensaje);
}