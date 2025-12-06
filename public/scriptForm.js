// Firebase configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCcBqpSXsz_wqm3xyg0NSJYnvQTK0NhkXg",
    authDomain: "formatovacaciones.firebaseapp.com",
    projectId: "formatovacaciones",
    storageBucket: "formatovacaciones.firebasestorage.app",
    messagingSenderId: "753669687689",
    appId: "1:753669687689:web:b37af5de6ba6b1391ef958",
    measurementId: "G-LMKRM8VKM7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let selectedDays = {
    febrero: [],
    marzo: [],
    abril: [],
    mayo: []
};

let currentFolio = 1;
let currentCarpeta = '';

// Holidays configuration
const holidays = {
    2026: {
        2: [2],    // 2 de febrero
        3: [16],   // 16 de marzo
        4: [2, 3], // 2 y 3 de abril (Semana Santa)
        5: [1, 10] // 1 y 10 de mayo
    }
};

// Department configuration
const departmentConfig = {
    'FLUJOS': ['GESTION DE FLUJOS'],
    'FABRICACION': ['FABRICACION UP1', 'FABRICACION UP2'],
    'SERVICIOS': ['ETN FACILITIES'],
    'MECANICO ACONDICIONAMIENTO': ['MANTENIMIENTO UP1', 'MANTENIMIENTO UP2'],
    'ACONDICIONAMIENTO A': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'ACONDICIONAMIENTO B': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'ACONDICIONAMIENTO C': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'ACONDICIONAMIENTO D': ['ACONDICIONAMIENTO UP1', 'ACONDICIONAMIENTO UP2'],
    'MECANICO FABRICACION': ['MANTENIMIENTO']
};

const supervisorConfig = {
    'FLUJOS': ['CITLALI REYES', 'IVAN','DAVID'],
    'FABRICACION': ['DAVID BUCIO', 'AIDA NAVARRO','PATRICIA','BRENDA'],
    'SERVICIOS': ['MIGUEL GONZALEZ'],
    'MECANICO ACONDICIONAMIENTO': ['ANTONIO HERNANDEZ', 'CARLOS AUGUSTO', 'ROGELIO GONZALEZ', 'CARLOS SANCHEZ'],
    'ACONDICIONAMIENTO A': ['GILBERTO CRUZ', 'ALEJANDRO'],
    'ACONDICIONAMIENTO B': ['ANAITH POBLANO', 'CARINA ROJAS'],
    'ACONDICIONAMIENTO C': ['PERLA','MARCO'],
    'ACONDICIONAMIENTO D': ['LUIS SOTO', 'ANGEL MONROY'],
    'MECANICO FABRICACION': ['FERNANADO HERNANDEZ']
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupEventListeners();
    setupNotificationClose();
});

// Función para mostrar notificaciones
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notification-message');
    
    notification.className = `notification ${type}`;
    messageElement.textContent = message;
    notification.classList.add('show');
    
    // Ocultar automáticamente después de 5 segundos
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Configurar cierre de notificaciones
function setupNotificationClose() {
    document.querySelector('.notification-close').addEventListener('click', function() {
        document.getElementById('notification').classList.remove('show');
    });
}

async function initializePage() {
    // Set current date
    document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
    
    // Generate calendars for 2026
    generateCalendar('febrero', 2026, 1);  // February (month 1 in JS)
    generateCalendar('marzo', 2026, 2);    // March (month 2 in JS)
    generateCalendar('abril', 2026, 3);    // April (month 3 in JS)
    generateCalendar('mayo', 2026, 4);     // May (month 4 in JS)

    // Check URL for admin access
    if (window.location.pathname.includes('/log')) {
        showLoginPage();
    }
}

function setupEventListeners() {
    // Area selection (previously service)
    document.getElementById('carpeta').addEventListener('change', function() {
        currentCarpeta = this.value;
        updateDepartmentOptions(this.value);
        updateSupervisorOptions(this.value);
        loadNextFolioForCarpeta(this.value);
    });

    // Form submission
    document.getElementById('vacations-form').addEventListener('submit', function(e) {
        e.preventDefault();
        showConfirmationModal();
    });

    // Login form
    if (document.getElementById('login-form')) {
        document.getElementById('login-form').addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }

    // Employee number validation
    document.getElementById('empleado-num').addEventListener('input', function() {
        if (this.value.length > 8) {
            this.value = this.value.slice(0, 8);
        }
    });
}

async function loadNextFolioForCarpeta(carpeta) {
    if (!carpeta) {
        document.getElementById('folio-number').textContent = '001';
        return;
    }
    
    try {
        const q = query(
            collection(db, 'vacaciones'), 
            where('carpeta', '==', carpeta),
            orderBy('folioFormulario', 'desc'), 
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const lastDoc = querySnapshot.docs[0].data();
            currentFolio = lastDoc.folioFormulario + 1;
        } else {
            currentFolio = 1;
        }
        
        document.getElementById('folio-number').textContent = String(currentFolio).padStart(3, '0');
    } catch (error) {
        console.error('Error loading folio for carpeta:', error);
        
        // En caso de error, intentamos una solución alternativa
        try {
            // Consulta general para obtener todos los registros de la carpeta
            const q = query(
                collection(db, 'vacaciones'), 
                where('carpeta', '==', carpeta)
            );
            
            const querySnapshot = await getDocs(q);
            let maxFolio = 0;
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.folioFormulario > maxFolio) {
                    maxFolio = data.folioFormulario;
                }
            });
            
            currentFolio = maxFolio + 1;
            document.getElementById('folio-number').textContent = String(currentFolio).padStart(3, '0');
        } catch (fallbackError) {
            console.error('Fallback method also failed:', fallbackError);
            showNotification('Error al cargar el número de folio', 'error');
            document.getElementById('folio-number').textContent = '001';
        }
    }
}

function updateDepartmentOptions(carpeta) {
    const departamentoSelect = document.getElementById('departamento');
    departamentoSelect.innerHTML = '<option value="">Seleccione un departamento</option>';
    
    if (carpeta && departmentConfig[carpeta]) {
        departmentConfig[carpeta].forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departamentoSelect.appendChild(option);
        });
    }
}

function updateSupervisorOptions(carpeta) {
    const supervisorSelect = document.getElementById('supervisor');
    supervisorSelect.innerHTML = '<option value="">Seleccione un supervisor</option>';
    
    if (carpeta && supervisorConfig[carpeta]) {
        supervisorConfig[carpeta].forEach(supervisor => {
            const option = document.createElement('option');
            option.value = supervisor;
            option.textContent = supervisor;
            supervisorSelect.appendChild(option);
        });
    }
}

function generateCalendar(monthId, year, month) {
    const calendar = document.getElementById(`calendar-${monthId}`);
    calendar.innerHTML = '';

    // Headers
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        calendar.appendChild(header);
    });

    // Days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day disabled';
        calendar.appendChild(emptyDay);
    }

    // Month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;

        // Check if it's a holiday
        const monthHolidays = holidays[year] && holidays[year][month + 1];
        if (monthHolidays && monthHolidays.includes(day)) {
            dayElement.className += ' holiday';
            dayElement.title = 'Día festivo';
        } else {
            dayElement.addEventListener('click', () => selectDay(monthId, day, dayElement));
        }

        calendar.appendChild(dayElement);
    }
}

async function selectDay(month, day, element) {
    if (element.classList.contains('holiday')) {
        showDayInfo('Este es un día festivo y no se puede seleccionar');
        return;
    }

    const carpeta = document.getElementById('carpeta').value;
    const departamento = document.getElementById('departamento').value;

    if (!carpeta || !departamento) {
        showNotification('Por favor seleccione primero el área y departamento', 'error');
        return;
    }

    // Check how many people have selected this date
    const count = await getSelectedDateCount(carpeta, departamento, month, day);
    
    if (count > 0) {
        showDayInfo(`${count} persona(s) de su área y departamento ya han registrado esta fecha`);
    }

    // Toggle selection
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedDays[month] = selectedDays[month].filter(d => d !== day);
    } else {
        element.classList.add('selected');
        selectedDays[month].push(day);
        selectedDays[month].sort((a, b) => a - b);
    }
}


async function getSelectedDateCount(carpeta, departamento, month, day) {
    try {
        const q = query(
            collection(db, 'vacaciones'),
            where('carpeta', '==', carpeta),
            where('depto', '==', departamento)
        );
        const querySnapshot = await getDocs(q);
        
        let count = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const monthField = `diasMes${getMonthNumber(month)}`;
            if (data[monthField] && data[monthField].includes(day)) {
                count++;
            }
        });
        
        return count;
    } catch (error) {
        console.error('Error checking selected dates:', error);
        return 0;
    }
}

function getMonthNumber(month) {
    const months = {
        'febrero': 1,
        'marzo': 2,
        'abril': 3,
        'mayo': 4
    };
    return months[month] || 1;
}

function showDayInfo(message) {
    document.getElementById('day-info-content').textContent = message;
    document.getElementById('day-info-modal').style.display = 'block';
}

function closeDayInfoModal() {
    document.getElementById('day-info-modal').style.display = 'none';
}

async function showConfirmationModal() {
    const empleadoNum = document.getElementById('empleado-num').value;
    const carpeta = document.getElementById('carpeta').value;
    
    // Validar que se haya ingresado un número de empleado
    if (!empleadoNum) {
        showNotification('Por favor ingresa tu número de empleado', 'error');
        return;
    }
    
    // Validar que se haya seleccionado un área
    if (!carpeta) {
        showNotification('Por favor selecciona un área', 'error');
        return;
    }
    
    // Check if employee has already submitted
    const existingSubmission = await checkExistingSubmission(empleadoNum);
    if (existingSubmission) {
        showNotification('Ya has solicitado tus vacaciones para este cuatrimestre. Espera al siguiente período.', 'error');
        return;
    }

    // Validar que se hayan seleccionado días
    const totalDays = [...selectedDays.febrero, ...selectedDays.marzo, 
                      ...selectedDays.abril, ...selectedDays.mayo].length;
    
    if (totalDays === 0) {
        showNotification('Por favor selecciona al menos un día de vacaciones', 'error');
        return;
    }

    // Show selected days
    let selectedDaysText = '';
    Object.keys(selectedDays).forEach(month => {
        if (selectedDays[month].length > 0) {
            const monthName = month.charAt(0).toUpperCase() + month.slice(1);
            selectedDaysText += `${monthName}: ${selectedDays[month].join(', ')}\n`;
        }
    });

    document.getElementById('selected-days').innerHTML = `<pre>${selectedDaysText}</pre>`;
    document.getElementById('confirmation-modal').style.display = 'block';
}

async function checkExistingSubmission(empleadoNum) {
    try {
        const q = query(collection(db, 'vacaciones'), where('numEmpleado', '==', parseInt(empleadoNum)));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking existing submission:', error);
        return false;
    }
}

async function confirmSubmission() {
    try {
        const formData = {
            folioFormulario: currentFolio,
            numEmpleado: parseInt(document.getElementById('empleado-num').value),
            depto: document.getElementById('departamento').value,
            nombreCompleto: document.getElementById('nombre-completo').value.toUpperCase(),
            supervisor: document.getElementById('supervisor').value,
            fechaEnvio: new Date().toISOString(),
            diasMes1: selectedDays.febrero,
            diasMes2: selectedDays.marzo,
            diasMes3: selectedDays.abril,
            diasMes4: selectedDays.mayo,
            carpeta: document.getElementById('carpeta').value
        };

        await addDoc(collection(db, 'vacaciones'), formData);
        
        showNotification('Solicitud enviada correctamente. Tu folio es: ' + String(currentFolio).padStart(3, '0'));
        document.getElementById('confirmation-modal').style.display = 'none';
        
        // Reset form
        document.getElementById('vacations-form').reset();
        selectedDays = { febrero: [], marzo: [], abril: [], mayo: [] };
        
        // Reload calendars
        generateCalendar('febrero', 2026, 1);
        generateCalendar('marzo', 2026, 2);
        generateCalendar('abril', 2026, 3);
        generateCalendar('mayo', 2026, 4);
        
        // Recargar el siguiente folio para la misma carpeta
        loadNextFolioForCarpeta(currentCarpeta);
        
    } catch (error) {
        console.error('Error submitting form:', error);
        
        try {
            // Primero verificamos si el folio ya existe para esta carpeta
            const verificationQuery = query(
                collection(db, 'vacaciones'),
                where('carpeta', '==', document.getElementById('carpeta').value),
                where('folioFormulario', '==', currentFolio)
            );
            
            const verificationSnapshot = await getDocs(verificationQuery);
            
            if (!verificationSnapshot.empty) {
                // Si ya existe, incrementamos el folio y volvemos a intentar
                currentFolio++;
                await confirmSubmission();
                return;
            } else {
                showNotification('Error inesperado al enviar la solicitud. Por favor, intenta nuevamente.', 'error');
            }
        } catch (retryError) {
            console.error('Retry also failed:', retryError);
            showNotification('Error al enviar la solicitud', 'error');
        }
    }
}

function editSubmission() {
    document.getElementById('confirmation-modal').style.display = 'none';
}

// Make functions global for onclick handlers
window.confirmSubmission = confirmSubmission;
window.editSubmission = editSubmission;
window.closeDayInfoModal = closeDayInfoModal;
window.generatePDF = generatePDF;
window.logout = logout;
window.showNotification = showNotification;