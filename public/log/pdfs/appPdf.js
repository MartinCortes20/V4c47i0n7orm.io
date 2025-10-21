// Firebase configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy 
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función para ordenar registros por folioFormulario
function sortRecords(records) {
    return records.sort((a, b) => {
        const folioA = a.folioFormulario || 0;
        const folioB = b.folioFormulario || 0;
        return folioA - folioB;
    });
}

// Función para truncar texto si es muy largo
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Función para obtener días festivos como string
function getHolidaysString(month) {
    const holidays = {
        1: ['1° - Año Nuevo'],
        10: ['12 - Día de la Raza'],
        11: ['2 - Día de Muertos', '20 - Revolución Mexicana'],
        12: ['12 - Día de la Virgen', '25 - Navidad']
    };
    return holidays[month] ? holidays[month].join(', ') : '-';
}

// Cargar jsPDF dinámicamente
async function loadJsPDF() {
    try {
        await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
        return true;
    } catch (error) {
        console.error('Error cargando jsPDF:', error);
        alert('Error al cargar el generador de PDF. Por favor, recarga la página.');
        return false;
    }
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        // Si es un timestamp de Firebase
        if (dateString.toDate) {
            const date = dateString.toDate();
            return date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
        
        // Si es una cadena de texto
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

// Función para obtener datos de cena navideña
async function obtenerDatosCena(tipoCena) {
    try {
        let querySnapshot;
        
        if (tipoCena === 'TODOS') {
            querySnapshot = await getDocs(collection(db, 'cenaNavidenia'));
        } else {
            const q = query(
                collection(db, 'cenaNavidenia'), 
                where('tipoCena', '==', tipoCena)
            );
            querySnapshot = await getDocs(q);
        }
        
        const datos = [];
        querySnapshot.forEach((doc) => {
            datos.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar por número de empleado
        return datos.sort((a, b) => {
            if (a.numEmpleado && b.numEmpleado) {
                return a.numEmpleado.localeCompare(b.numEmpleado);
            }
            return 0;
        });
    } catch (error) {
        console.error('Error obteniendo datos de cena:', error);
        throw new Error('No se pudieron obtener los datos de la cena');
    }
}

// Generar PDF para cena navideña
async function generarPDFCena(tipoCena) {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = `Generando PDF para ${tipoCena}...`;
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.background = '#4CAF50';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '1000';
        document.body.appendChild(loadingMsg);
        
        // Obtener datos
        const datos = await obtenerDatosCena(tipoCena);
        
        if (datos.length === 0) {
            alert(`No se encontraron registros para ${tipoCena}`);
            document.body.removeChild(loadingMsg);
            return;
        }

        // Cargar jsPDF
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) {
            document.body.removeChild(loadingMsg);
            return;
        }

        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = 20;
        
        // Título
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(198, 40, 40); // Rojo navideño
        doc.text(`ELECCION DE OBSEQUIOS FIN DE AÑO - ${tipoCena}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Fecha de generación
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Preparar datos para la tabla
        const tableData = datos.map((item, index) => [
            index + 1,
            item.numEmpleado || 'N/A',
            item.nombre || 'N/A',
            item.tipoCena || 'N/A',
            '' // Espacio para firma
        ]);

        // Máximo ancho en vertical
        doc.autoTable({
            startY: yPosition,
            head: [['#', 'N° Empleado', 'Nombre', 'Cena', 'Firma']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [198, 40, 40],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak',
                minCellHeight: 8
            },
            margin: { left: 5, right: 5 },
            tableWidth: 190, // Casi el ancho total de la página
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 35 },
                2: { cellWidth: 65 },  // Nombre más ancho
                3: { cellWidth: 30 },
                4: { cellWidth: 45 }   // Firma más ancha
            }
        });
        
        // Guardar PDF
        const fileName = `cena_navidenia_${tipoCena.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        
        // Eliminar mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error generando PDF de cena:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
}





// Función para generar PDF de vacaciones
async function generatePDF(servicio) {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = `Generando PDF para ${servicio}...`;
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.background = '#4CAF50';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '1000';
        document.body.appendChild(loadingMsg);
        
        // Consultar datos de Firebase
        let data = [];
        try {
            const q = query(
                collection(db, 'vacaciones'), 
                where('carpeta', '==', servicio)
            );
            
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });
            
            // Ordenar localmente
            data = sortRecords(data);
            
        } catch (firestoreError) {
            console.error('Error en consulta Firestore:', firestoreError);
            try {
                const q = query(collection(db, 'vacaciones'));
                const querySnapshot = await getDocs(q);
                
                querySnapshot.forEach((doc) => {
                    const record = doc.data();
                    if (record.carpeta === servicio) {
                        data.push({ id: doc.id, ...record });
                    }
                });
                
                data = sortRecords(data);
                
            } catch (alternativeError) {
                console.error('Error en consulta alternativa:', alternativeError);
                throw new Error('No se pudieron obtener los datos');
            }
        }

        if (data.length === 0) {
            alert(`No se encontraron registros para ${servicio}`);
            document.body.removeChild(loadingMsg);
            return;
        }

        // Cargar jsPDF
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) {
            document.body.removeChild(loadingMsg);
            return;
        }

        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración inicial
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;
        let currentPage = 1;

        // Título principal (solo en primera página)
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text('SOLICITUD DE VACACIONES 3er CUATRIMESTRE', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Línea decorativa
        doc.setDrawColor(150, 150, 150);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 15;

        // Procesar cada registro
        for (let i = 0; i < data.length; i++) {
            const record = data[i];
            
            // Verificar si necesitamos nueva página
            if (yPosition > pageHeight - 100 && i > 0) {
                doc.addPage();
                currentPage++;
                yPosition = margin;
            }

            // Folio
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(`FOLIO: ${servicio} ${String(record.folioFormulario || (i + 1)).padStart(3, '0')}`, margin, yPosition);
            yPosition += 8;

            // Información del empleado - Formato vertical
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            // Número de empleado
            doc.text('Nº DE EMPLEADO:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.numEmpleado || 'N/A'}`, margin + 40, yPosition);
            yPosition += 6;

            // Supervisor
            doc.setFont(undefined, 'normal');
            doc.text('SUPERVISOR:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.supervisor || 'N/A'}`, margin + 32, yPosition);
            yPosition += 6;

            // Departamento
            doc.setFont(undefined, 'normal');
            doc.text('DEPARTAMENTO:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.depto || 'N/A'}`, margin + 37, yPosition);
            yPosition += 6;

            // Fecha
            doc.setFont(undefined, 'normal');
            doc.text('FECHA:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${formatDate(record.fechaEnvio) || 'N/A'}`, margin + 22, yPosition);
            yPosition += 6;

            // Nombre completo
            doc.setFont(undefined, 'normal');
            doc.text('NOMBRE COMPLETO:', margin, yPosition);
            doc.setFont(undefined, 'bold');
            doc.text(`${record.nombreCompleto || 'N/A'}`, margin + 45, yPosition);
            yPosition += 10;

            // Tabla de días - Encabezado
            const tableTop = yPosition;
            const tableWidth = pageWidth - margin * 2;
            const col1Width = 30; // MES
            const col2Width = 70; // DÍAS
            const col3Width = tableWidth - col1Width - col2Width; // FESTIVOS
            
            // Encabezados de tabla
            doc.setFont(undefined, 'bold');
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(60, 60, 60);
            doc.rect(margin, tableTop, tableWidth, 8, 'F');
            
            // Encabezados centrados
            doc.text('MES', margin + col1Width / 2, tableTop + 5, { align: 'center' });
            doc.text('DÍAS', margin + col1Width + col2Width / 2, tableTop + 5, { align: 'center' });
            doc.text('FESTIVOS', margin + col1Width + col2Width + col3Width / 2, tableTop + 5, { align: 'center' });
            
            yPosition += 10;

            // Datos de la tabla
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            
            // Función para agregar fila de tabla
            const addTableRow = (mes, diasSolicitados, diasFestivos) => {
                // Fondo gris claro para filas
                if ((yPosition - tableTop) % 2 === 0) {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(margin, yPosition - 2, tableWidth, 8, 'F');
                }
                
                // Mes (centrado)
                doc.text(mes, margin + col1Width / 2, yPosition + 4, { align: 'center' });
                
                // Días solicitados (centrado)
                const diasText = diasSolicitados || '-';
                doc.text(truncateText(diasText, 20), margin + col1Width + col2Width / 2, yPosition + 4, { align: 'center' });
                
                // Días festivos (centrado)
                const festivosText = diasFestivos || '-';
                doc.text(truncateText(festivosText, 25), margin + col1Width + col2Width + col3Width / 2, yPosition + 4, { align: 'center' });
                
                yPosition += 8;
            };

            // Filas de la tabla
            addTableRow('OCTUBRE', record.diasMes1?.join(', ') || '-', getHolidaysString(10));
            addTableRow('NOVIEMBRE', record.diasMes2?.join(', ') || '-', getHolidaysString(11));
            addTableRow('DICIEMBRE', record.diasMes3?.join(', ') || '-', getHolidaysString(12));
            addTableRow('ENERO', record.diasMes4?.join(', ') || '-', getHolidaysString(1));

            // Borde de la tabla
            doc.setDrawColor(0, 0, 0);
            doc.rect(margin, tableTop, tableWidth, yPosition - tableTop);

            // Espacio entre registros
            yPosition += 15;

            // Línea separadora entre registros (excepto el último)
            if (i < data.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(margin, yPosition, pageWidth - margin, yPosition);
                yPosition += 10;
            }

            // Número de página
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Página ${currentPage}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        // Guardar PDF
        const fileName = `vacaciones_${servicio}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        
        // Eliminar mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
}

// Función para obtener datos de fiesta fin de año
async function obtenerDatosFiestaFinAnio() {
    try {
        const querySnapshot = await getDocs(collection(db, 'fiestaFinAnio'));
        
        const datos = [];
        querySnapshot.forEach((doc) => {
            datos.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar por número de empleado
        return datos.sort((a, b) => {
            if (a.numEmpleado && b.numEmpleado) {
                return a.numEmpleado.localeCompare(b.numEmpleado);
            }
            return 0;
        });
    } catch (error) {
        console.error('Error obteniendo datos de fiesta fin de año:', error);
        throw new Error('No se pudieron obtener los datos de la fiesta');
    }
}

// Generar PDF para fiesta fin de año
async function generarPDFFiestaFinAnio() {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = 'Generando lista de asistentes a Fiesta Fin de Año...';
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.background = '#3498db';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '1000';
        document.body.appendChild(loadingMsg);
        
        // Obtener datos
        const datos = await obtenerDatosFiestaFinAnio();
        
        if (datos.length === 0) {
            alert('No se encontraron registros para la Fiesta de Fin de Año');
            document.body.removeChild(loadingMsg);
            return;
        }

        // Cargar jsPDF
        const jsPDFLoaded = await loadJsPDF();
        if (!jsPDFLoaded) {
            document.body.removeChild(loadingMsg);
            return;
        }

        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = 20;
        
        // Título principal
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(41, 128, 185); // Azul corporativo
        doc.text('LISTA DE ASISTENTES - FIESTA FIN DE AÑO', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Subtítulo
        doc.setFontSize(14);
        doc.setTextColor(52, 73, 94);
        doc.text('Confirmación de Asistencia', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Fecha de generación
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Estadísticas
        doc.setFontSize(10);
        doc.setTextColor(52, 73, 94);
        doc.text(`Total de asistentes confirmados: ${datos.length}`, margin, yPosition);
        yPosition += 8;
        
        // Preparar datos para la tabla
        const tableData = datos.map((item, index) => [
                index + 1,
                item.numEmpleado || 'N/A',
                item.nombre || `${item.apellidoPaterno || ''} ${item.apellidoMaterno || ''}`.trim(),
                item.misaVirgen || 'NO',
                item.fiestaFin || 'NO',
                '' // Espacio para firma
            ]);

        // Crear tabla
        doc.autoTable({
            startY: yPosition,
           head: [['#', 'N° Empleado', 'Nombre Completo', 'Misa Virgen', 'Fiesta Fin Año', 'Firma']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 4,
                overflow: 'linebreak',
                minCellHeight: 10
            },
            margin: { left: 10, right: 10 },
            tableWidth: 190,
            columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    1: { cellWidth: 30, halign: 'center' },
                    2: { cellWidth: 70 },  // Nombre completo
                    3: { cellWidth: 25, halign: 'center' }, // Misa Virgen
                    4: { cellWidth: 25, halign: 'center' }, // Fiesta Fin Año
                    5: { cellWidth: 25 }   // Firma
                },
            didDrawPage: function(data) {
                // Agregar número de página
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(
                    `Página ${data.pageNumber}`, 
                    data.settings.margin.left, 
                    doc.internal.pageSize.height - 10
                );
            }
        });
        
        // Guardar PDF
        const fileName = `lista_asistentes_fiesta_fin_anio_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        
        // Eliminar mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error generando PDF de fiesta fin de año:', error);
        alert('Error al generar el PDF: ' + error.message);
    }
}



// Verificar autenticación
function verificarAutenticacion() {
    const estaAutenticado = sessionStorage.getItem('pdfAuth') === 'true';
    const usuario = sessionStorage.getItem('user');
    
    if (!estaAutenticado || !usuario) {
        // Redirigir a la página de login
        window.location.href = '../index.html';
        return false;
    }
    
    return true;
}

// Función para cerrar sesión
function logout() {
    if (confirm('¿Estás seguro de que quieres salir?')) {
        // Limpiar sessionStorage
        sessionStorage.removeItem('pdfAuth');
        sessionStorage.removeItem('user');
        
        // Redirigir a la página principal de login
        window.location.href = '../index.html';
    }
}

// Inicializar la aplicación
function initApp() {
    // Verificar autenticación primero
    if (!verificarAutenticacion()) {
        return;
    }
    
    // Mostrar información del usuario logeado
    const usuario = sessionStorage.getItem('user');
    console.log(`Usuario autenticado: ${usuario}`);
    
    // Agregar event listeners a los botones de áreas
    document.querySelectorAll('.service-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const service = e.currentTarget.getAttribute('data-service');
            if (service === 'PAVO' || service === 'PIERNA') {
                generarPDFCena(service);
            } else if (service === 'FIESTA_FIN_ANIO') {
                generarPDFFiestaFinAnio();
            } else {
                generatePDF(service);
            }
        });
    });
    
    // Agregar event listener al botón de cerrar sesión
    document.getElementById('logout-btn').addEventListener('click', logout);
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);