// ============ CACHE DISPONIBILITÀ ============
// Logica disponibilità rimossa: ora solo banner locale
// Logica disponibilità rimossa
/* ============================================
   ISOLA LIDO - BOOKING SYSTEM
   Sistema di Prenotazione Tavoli e Sdraio
   Author: Web Developer Professionista
   ============================================ */

// ============ CONFIGURAZIONE ============
// ============ CONFIGURAZIONE EMAILJS ============

const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_mylrmf4',
    TEMPLATE_ID: 'template_r63dlwf',
    PUBLIC_KEY: 'ZV2oWjSAL_5W1omKq',
    OWNER_EMAIL: 'isolalido@outlook.com'
};

const BOOKING_CONFIG = {
    TABLES: {
        total: 110,
        price: 8.00,
        capacity: 8
    },
    CHAIRS: {
        total: 65,
        price: 5.00
    },
    STORAGE_KEY: 'isolaLido_bookings'
};

// Endpoint API
// - default: produzione su backend Vercel
// - override dominio con ?apiHost=tuo-backend.vercel.app
const DEFAULT_PROD_API = 'https://backend-atrfva4ai-dwebcodings-projects-ab095673.vercel.app';
const LOCAL_API = 'http://localhost:3000';
const params = new URLSearchParams(window.location.search);
const apiHostOverride = params.get('apiHost');
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
const prodApi = apiHostOverride
  ? (apiHostOverride.startsWith('http') ? apiHostOverride : `https://${apiHostOverride}`)
  : DEFAULT_PROD_API;
const API_BASE = isLocalHost ? LOCAL_API : prodApi;


// ============ VARIABILI GLOBALI ============

let currentBooking = {
    date: '',
    tables: 0,
    chairs: 0,
    umbrellas: 0
};

// Variabili globali per i valori reali disponibili

let tavoliDisponibiliIniziali = 110;
let sdraioDisponibiliIniziali = 65;
let ombrelloniDisponibiliIniziali = 65;

function aggiornaContatoreTavoliLocale() {
    const availElem = document.getElementById('tableAvailability');
    if (availElem) {
        const disponibili = tavoliDisponibiliIniziali - currentBooking.tables;
        availElem.textContent = `Disponibili: ${disponibili} tavoli`;
    }
}

function aggiornaContatoreSdraioLocale() {
    const availElem = document.getElementById('chairAvailability');
    if (availElem) {
        const disponibili = sdraioDisponibiliIniziali - currentBooking.chairs;
        availElem.textContent = `Disponibili: ${disponibili} sdraio`;
    }
}

function aggiornaContatoreOmbrelloniLocale() {
    const availElem = document.getElementById('umbrellaAvailability');
    if (availElem) {
        const disponibili = ombrelloniDisponibiliIniziali - (currentBooking.umbrellas || 0);
        availElem.textContent = `Disponibili: ${disponibili} ombrelloni`;
    }
}

// ============ INIZIALIZZAZIONE ============
/**
 * Imposta la data minima del campo data a domani
 */
function setMinDate() {
    const dateInput = document.getElementById('bookingDate');
    if (!dateInput) return;
    const today = new Date();
    today.setDate(today.getDate() + 1); // domani
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
}

// Controllo lato client per date consentite (corrisponde alla logica server)
function isDateAllowed(dateObj) {
    // Use local date components to avoid UTC shift from toISOString()
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const d = new Date(yyyy, dateObj.getMonth(), dateObj.getDate());
    if (Number.isNaN(d.getTime())) return false;
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const weekday = d.getDay(); // 0 = Sunday

    const startYear = 2026;
    const endYear = 2036;

    const explicitOpenPatterns = ['04-05', '04-06', '04-25', '05-01'];
    const explicitBlockedPatterns = ['04-07'];

    const explicitOpen = new Set();
    const explicitBlocked = new Set();
    for (let y = startYear; y <= endYear; y++) {
        explicitOpenPatterns.forEach(p => explicitOpen.add(`${y}-${p}`));
        explicitBlockedPatterns.forEach(p => explicitBlocked.add(`${y}-${p}`));
    }

    if (explicitBlocked.has(dateStr)) return false;
    if (explicitOpen.has(dateStr)) return true;

    const ddInt = parseInt(dd, 10);
    if (year >= startYear && year <= endYear) {
        // Sundays in April and May
        if ((month === 4 || month === 5) && weekday === 0) return true;
        if (month >= 6 && month <= 8) return true;
        if (month === 9 && ddInt >= 1 && ddInt <= 13) return true;
    }

    return false;
}

/**
 * Inizializza il sistema di prenotazione
 */
function initBookingSystem() {
    // Ombrelloni: listener per + e -
    const umbrellaPlus = document.getElementById('umbrellaPlus');
    const umbrellaMinus = document.getElementById('umbrellaMinus');
    if (umbrellaPlus && umbrellaMinus) {
        umbrellaPlus.addEventListener('click', () => {
            console.log('[Booking] Click umbrellaPlus');
            incrementUmbrella();
        });
        umbrellaMinus.addEventListener('click', () => {
            console.log('[Booking] Click umbrellaMinus');
            decrementUmbrella();
        });
    }
        // Impedisci modifica manuale degli input quantità
        document.getElementById('tableQty')?.addEventListener('keydown', e => e.preventDefault());
        document.getElementById('chairQty')?.addEventListener('keydown', e => e.preventDefault());
    console.log('[Booking System] Inizio inizializzazione...');
    
    // EmailJS rimosso: la logica email è ora gestita solo dal backend
    
    // Imposta la data minima (domani)
    setMinDate();
    
    // Verifica che i pulsanti esistano
    const tablePlus = document.getElementById('tablePlus');
    const tableMinus = document.getElementById('tableMinus');
    const chairPlus = document.getElementById('chairPlus');
    const chairMinus = document.getElementById('chairMinus');
    
    console.log('[Booking System] Pulsanti trovati:', {
        tablePlus: !!tablePlus,
        tableMinus: !!tableMinus,
        chairPlus: !!chairPlus,
        chairMinus: !!chairMinus
    });
    
    // Event listeners per quantità
    tablePlus?.addEventListener('click', () => {
        console.log('[Booking] Click tablePlus');
        incrementTable();
        aggiornaContatoreTavoliLocale();
    });
    tableMinus?.addEventListener('click', () => {
        console.log('[Booking] Click tableMinus');
        decrementTable();
        aggiornaContatoreTavoliLocale();
    });

// Aggiorna il contatore localmente in base ai tavoli selezionati
function aggiornaContatoreTavoliLocale() {
    const availElem = document.getElementById('tableAvailability');
    if (availElem) {
        const disponibili = tavoliDisponibiliIniziali - currentBooking.tables;
        availElem.textContent = `Disponibili: ${disponibili} tavoli`;
    }
}

function aggiornaContatoreSdraioLocale() {
    const availElem = document.getElementById('chairAvailability');
    if (availElem) {
        const disponibili = sdraioDisponibiliIniziali - currentBooking.chairs;
        availElem.textContent = `Disponibili: ${disponibili} sdraio`;
    }
}
    chairPlus?.addEventListener('click', () => {
        console.log('[Booking] Click chairPlus');
        incrementChair();
        aggiornaContatoreSdraioLocale();
    });
    chairMinus?.addEventListener('click', () => {
        console.log('[Booking] Click chairMinus');
        decrementChair();
        aggiornaContatoreSdraioLocale();
    });
    
    // Event listener per data
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        // Initialize flatpickr if available, disabling blocked dates
        if (typeof flatpickr !== 'undefined') {
            flatpickr(dateInput, {
                locale: 'it',
                dateFormat: 'Y-m-d',
                minDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
                disable: [function(date) { return !isDateAllowed(date); }],
                onChange: function(selectedDates, dateStr) {
                    currentBooking.date = dateStr;
                    updateAvailability();
                }
            });
        } else {
            dateInput.addEventListener('change', (e) => {
                currentBooking.date = e.target.value;
                updateAvailability();
            });
        }
    }
}

// ============ GESTIONE QUANTITÀ SDRAIO ============
// ============ GESTIONE QUANTITÀ OMBRELLONI ============
function incrementUmbrella() {
    if (!currentBooking.umbrellas) currentBooking.umbrellas = 0;
    currentBooking.umbrellas++;
    aggiornaContatoreOmbrelloniLocale();
    updateDisplay();
}

function decrementUmbrella() {
    if (!currentBooking.umbrellas) currentBooking.umbrellas = 0;
    if (currentBooking.umbrellas > 0) {
        currentBooking.umbrellas--;
        aggiornaContatoreOmbrelloniLocale();
        updateDisplay();
    }
}

/**
 * Aumenta la quantità di sdraio
 */
/**
 * Aumenta la quantità di tavoli
 */
function incrementTable() {
    console.log('[Booking] incrementTable - Prima:', {
        currentTables: currentBooking.tables,
        availableTables: getAvailableTables()
    });
    const availableTables = getAvailableTables();
        currentBooking.tables++;
        updateDisplay();
}

/**
 * Diminuisce la quantità di tavoli
 */
function decrementTable() {
    console.log('[Booking] decrementTable - Prima:', currentBooking.tables);
    if (currentBooking.tables > 0) {
        currentBooking.tables--;
        updateDisplay();
        console.log('[Booking] decrementTable - Dopo:', currentBooking.tables);
    }
}
function incrementChair() {
    console.log('[Booking] incrementChair - Prima:', {
        currentChairs: currentBooking.chairs,
        availableChairs: getAvailableChairs()
    });
    
    const availableChairs = getAvailableChairs();
        currentBooking.chairs++;
        updateDisplay();
}

/**
 * Diminuisce la quantità di sdraio
 */
function decrementChair() {
    console.log('[Booking] decrementChair - Prima:', currentBooking.chairs);
    if (currentBooking.chairs > 0) {
        currentBooking.chairs--;
        updateDisplay();
        console.log('[Booking] decrementChair - Dopo:', currentBooking.chairs);
    }
}

// ============ CALCOLO DISPONIBILITÀ ============

/**
 * Ottiene i tavoli disponibili per la data selezionata
 * @returns {number} Numero di tavoli disponibili
 */
function getAvailableTables() {
    const booked = getBookedTablesByDate(currentBooking.date);
    return Math.max(0, BOOKING_CONFIG.TABLES.total - booked);
}

/**
 * Ottiene le sdraio disponibili per la data selezionata
 * @returns {number} Numero di sdraio disponibili
 */
function getAvailableChairs() {
    const booked = getBookedChairsByDate(currentBooking.date);
    return Math.max(0, BOOKING_CONFIG.CHAIRS.total - booked);
}

/**
 * Ottiene i tavoli prenotati per una data specifica
 * @param {string} date - Data in formato YYYY-MM-DD
 * @returns {number} Numero di tavoli prenotati
 */
function getBookedTablesByDate(date) {
    const bookings = getStoredBookings();
    return bookings
        .filter(b => b.date === date)
        .reduce((total, b) => total + b.tables, 0);
}

/**
 * Ottiene le sdraio prenotate per una data specifica
 * @param {string} date - Data in formato YYYY-MM-DD
 * @returns {number} Numero di sdraio prenotate
 */
function getBookedChairsByDate(date) {
    const bookings = getStoredBookings();
    return bookings
        .filter(b => b.date === date)
        .reduce((total, b) => total + b.chairs, 0);
}

// ============ AGGIORNAMENTO DISPLAY ============

/**
 * Aggiorna l'interfaccia con i valori correnti
 */
function updateDisplay() {
    // Aggiorna quantità visualizzata
    document.getElementById('tableQty').textContent = currentBooking.tables;
    document.getElementById('chairQty').textContent = currentBooking.chairs;
    if (document.getElementById('umbrellaQty')) {
        document.getElementById('umbrellaQty').textContent = currentBooking.umbrellas || 0;
    }

    // Prezzo ombrellone dichiarato all'inizio
    const umbrellaPrice = 5.00; // Prezzo ombrellone (modifica se diverso)

    // Calcolo subtotali
    const tableSubtotal = currentBooking.tables * BOOKING_CONFIG.TABLES.price;
    const chairSubtotal = currentBooking.chairs * BOOKING_CONFIG.CHAIRS.price;
    const umbrellaSubtotal = (currentBooking.umbrellas || 0) * umbrellaPrice;
    const total = tableSubtotal + chairSubtotal + umbrellaSubtotal;

    // Aggiorna subtotali
    const tableSubtotalElem = document.getElementById('tableSubtotal');
    if (tableSubtotalElem) {
        tableSubtotalElem.textContent = `Subtotale: € ${tableSubtotal.toFixed(2)}`;
    }
    const chairSubtotalElem = document.getElementById('chairSubtotal');
    if (chairSubtotalElem) {
        chairSubtotalElem.textContent = `Subtotale: € ${chairSubtotal.toFixed(2)}`;
    }
    const umbrellaSubtotalElem = document.getElementById('umbrellaSubtotal');
    if (umbrellaSubtotalElem) {
        umbrellaSubtotalElem.textContent = `Subtotale: € ${umbrellaSubtotal.toFixed(2)}`;
    }

    // Aggiorna riepilogo
    document.getElementById('summaryTableQty').textContent = currentBooking.tables;
    document.getElementById('summaryChairQty').textContent = currentBooking.chairs;
    if (document.getElementById('summaryUmbrellaQty')) {
        document.getElementById('summaryUmbrellaQty').textContent = currentBooking.umbrellas || 0;
    }
    document.getElementById('summaryTablePrice').textContent = 
        `€ ${tableSubtotal.toFixed(2)}`;
    document.getElementById('summaryChairPrice').textContent = 
        `€ ${chairSubtotal.toFixed(2)}`;
    if (document.getElementById('summaryUmbrellaPrice')) {
        document.getElementById('summaryUmbrellaPrice').textContent = 
            `€ ${umbrellaSubtotal.toFixed(2)}`;
    }
    document.getElementById('summaryTotal').textContent = 
        `€ ${total.toFixed(2)}`;
}

/**
 * Aggiorna la visualizzazione della disponibilità
 */
function updateAvailability() {
    const date = currentBooking.date;
    if (!date) return;
    const endpoints = [
        fetch(`${API_BASE}/api/booking/tavoli-disponibili?date=${encodeURIComponent(date)}`).then(r => r.json()),
        fetch(`${API_BASE}/api/booking/sdraio-disponibili?date=${encodeURIComponent(date)}`).then(r => r.json()),
        fetch(`${API_BASE}/api/booking/ombrelloni-disponibili?date=${encodeURIComponent(date)}`).then(r => r.json())
    ];

    Promise.all(endpoints)
        .then(([tavoliData, sdraioData, ombrelloniData]) => {
            const banner = document.getElementById('bookingWarningBanner');
            const submitBtn = document.getElementById('submitBooking');

            // If any endpoint indicates closed (open: false) treat the date as closed
            const dateOpen = !(tavoliData.open === false || sdraioData.open === false || ombrelloniData.open === false);

            if (!dateOpen) {
                if (submitBtn) submitBtn.disabled = true;

                // Set availabilities to 0 (no banner shown)
                tavoliDisponibiliIniziali = 0;
                sdraioDisponibiliIniziali = 0;
                ombrelloniDisponibiliIniziali = 0;
            } else {
                if (submitBtn) submitBtn.disabled = false;

                tavoliDisponibiliIniziali = Number.isFinite(tavoliData.tavoliDisponibili) ? tavoliData.tavoliDisponibili : 0;
                sdraioDisponibiliIniziali = Number.isFinite(sdraioData.sdraioDisponibili) ? sdraioData.sdraioDisponibili : 0;
                ombrelloniDisponibiliIniziali = Number.isFinite(ombrelloniData.ombrelloniDisponibili) ? ombrelloniData.ombrelloniDisponibili : 0;
            }

            aggiornaContatoreTavoliLocale();
            aggiornaContatoreSdraioLocale();
            aggiornaContatoreOmbrelloniLocale();
        })
        .catch(() => {
            const table = document.getElementById('tableAvailability');
            const chair = document.getElementById('chairAvailability');
            const umbrella = document.getElementById('umbrellaAvailability');
            if (table) table.textContent = 'Disponibili: Errore tavoli';
            if (chair) chair.textContent = 'Disponibili: Errore sdraio';
            if (umbrella) umbrella.textContent = 'Disponibili: Errore ombrelloni';
        });
    // Banner avviso
    const banner = document.getElementById('bookingWarningBanner');
    if (banner) {
        banner.style.display = 'none';
        if (110 - currentBooking.tables <= 10) {
            banner.textContent = 'Attenzione: rimangono meno di 10 tavoli disponibili!';
            banner.style.display = 'block';
        } else if (65 - currentBooking.chairs <= 10) {
            banner.textContent = 'Attenzione: rimangono meno di 10 sdraio disponibili!';
            banner.style.display = 'block';
        }
    }
    updateDisplay();
}

// ============ VALIDAZIONE FORM ============

/**
 * Valida i dati del form di prenotazione
 * @returns {boolean} True se valido
 */
function validateBookingForm() {
    console.log('[Booking] Inizio validazione form');
    // Blocca submit se data chiusa
    const submitBtn = document.getElementById('submitBooking');
    if (submitBtn && submitBtn.disabled) {
        showError('Prenotazioni chiuse', 'Le prenotazioni per la data selezionata sono chiuse. Scegli un altro giorno.');
        return false;
    }
    
    // Resetta gli errori
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
    });
    
    // Nascondi messaggio errore precedente
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
    
    let isValid = true;
    
    // Valida data
    if (!currentBooking.date) {
        showError('Data non selezionata', 'Seleziona una data valida');
        isValid = false;
    }
    
    // Valida che sia selezionato almeno qualcosa
    if (currentBooking.tables === 0 && currentBooking.chairs === 0) {
        showError('Nessun articolo selezionato', 'Seleziona almeno un tavolo o una sdraio');
        isValid = false;
    }
    
    // Valida Nome
    const nameInput = document.querySelector('input[name="name"]');
    if (!nameInput || nameInput.value.trim().length < 2) {
        if (nameInput) markFieldAsError(nameInput, 'Il nome deve contenere almeno 2 caratteri');
        isValid = false;
    }
    
    // Valida Email
    const emailInput = document.querySelector('input[name="email"]');
    if (!emailInput || !validateEmail(emailInput.value.trim())) {
        if (emailInput) markFieldAsError(emailInput, 'Inserisci un email valido');
        isValid = false;
    }
    
    // Valida Telefono
    const phoneInput = document.querySelector('input[name="phone"]');
    if (!phoneInput || phoneInput.value.trim().length < 10) {
        if (phoneInput) markFieldAsError(phoneInput, 'Inserisci un numero di telefono valido');
        isValid = false;
    }
    
    console.log('[Booking] Validazione risultato:', isValid);
    
    return isValid;
}

/**
 * Marca un campo come errore
 * @param {HTMLElement} field - Il campo
 * @param {string} message - Messaggio di errore
 */
function markFieldAsError(field, message) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
        formGroup.classList.add('error');
        let errorElement = formGroup.querySelector('.form-error');
        if (!errorElement) {
            errorElement = document.createElement('span');
            errorElement.className = 'form-error';
            formGroup.appendChild(errorElement);
        }
        errorElement.textContent = message;
    }
}

/**
 * Valida un indirizzo email
 * @param {string} email - L'email
 * @returns {boolean} True se valida
 */
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============ GESTIONE SUBMIT ============

/**
 * Gestisce l'invio del form di prenotazione
 * @param {Event} e - L'evento submit
 */
function handleBookingSubmit(e) {
    console.log('[Booking] Submit form iniziato');
    e.preventDefault();
    
    try {
        // Valida il form
        if (!validateBookingForm()) {
            console.log('[Booking] ❌ Validazione fallita');
            alert('❌ Errore: Compila correttamente tutti i campi!');
            return;
        }
        // Prepara i dati della prenotazione
        const booking = {
            date: currentBooking.date,
            tables: currentBooking.tables,
            chairs: currentBooking.chairs,
            umbrellas: currentBooking.umbrellas,
            name: document.querySelector('input[name="name"]').value,
            email: document.querySelector('input[name="email"]').value,
            phone: document.querySelector('input[name="phone"]').value,
            notes: document.querySelector('textarea[name="notes"]').value,
            timestamp: new Date().toISOString()
        };
        // Calcola il totale in centesimi
        const tablesTotal = booking.tables * BOOKING_CONFIG.TABLES.price * 100;
        const chairsTotal = booking.chairs * BOOKING_CONFIG.CHAIRS.price * 100;
        const total = Math.round(tablesTotal + chairsTotal);
        if (total <= 0) {
            alert('Devi selezionare almeno un tavolo o una sdraio per prenotare.');
            return;
        }
        // Avvia la sessione di pagamento Stripe
        fetch(`${API_BASE}/api/payment/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: total,
                email: booking.email,
                description: `Prenotazione Lido Island per ${booking.name} (${booking.date})`,
                metadata: { booking: JSON.stringify(booking) }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Errore nella creazione della sessione di pagamento.');
            }
        })
        .catch(error => {
            console.error('[Booking] ❌ ERRORE Stripe:', error);
            alert('Errore durante il pagamento: ' + error.message);
        });
    } catch (error) {
        console.error('[Booking] ❌ ERRORE CRITICO:', error);
        alert(`❌ ERRORE: ${error.message}`);
        showError('Errore nella Prenotazione', 'Si è verificato un errore imprevisto. Controlla la console per i dettagli.');
    }
}

/**
 * Gestisce il submit del form di donazione
 * @param {Event} e - Evento submit
 */
function handleDonationSubmit(e) {
    console.log('[Donation] Submit form');
    e.preventDefault();

    const form = e.target;
    const amountInput = form.querySelector('#donationAmount');
    const emailInput = form.querySelector('#donationEmail');
    const nameInput = form.querySelector('#donationName');
    const messageInput = form.querySelector('#donationMessage');
    const submitBtn = form.querySelector('button[type="submit"]');
    const label = submitBtn?.querySelector('.donation-button__label');
    const labelFallback = 'Procedi con la donazione digitale';
    const originalLabel = label?.textContent || labelFallback;

    const rawAmount = (amountInput?.value || '').trim().replace(',', '.');
    const parsedAmount = Number(rawAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
        alert('Inserisci un importo valido (minimo 1 €).');
        amountInput?.focus();
        return;
    }

    const email = (emailInput?.value || '').trim();
    if (!email || !validateEmail(email)) {
        alert('Inserisci un indirizzo email valido.');
        emailInput?.focus();
        return;
    }

    const amount = Math.round(parsedAmount * 100);
    const donorName = (nameInput?.value || '').trim() || 'Sostenitore Isola Lido';
    const message = (messageInput?.value || '').trim();

    const disableButton = () => {
        if (submitBtn) {
            submitBtn.setAttribute('disabled', 'true');
        }
        if (label) {
            label.textContent = 'Reindirizzamento...';
        }
    };
    const restoreButton = () => {
        if (submitBtn) {
            submitBtn.removeAttribute('disabled');
        }
        if (label) {
            label.textContent = originalLabel;
        }
    };

    disableButton();

    const payload = {
        amount,
        email,
        description: `Donazione Isola Lido da ${donorName}`,
        metadata: {
            donation_name: donorName,
            donation_message: message || 'Nessun messaggio',
            donation_type: 'banner'
        }
    };

    fetch(`${API_BASE}/api/payment/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            if (data.url) {
                window.location.href = data.url;
            } else {
                restoreButton();
                throw new Error(data.error || 'Errore nella creazione della sessione di pagamento.');
            }
        })
        .catch(error => {
            console.error('[Donation] ❌ ERRORE Stripe:', error);
            restoreButton();
            alert('Errore durante il pagamento: ' + (error.message || 'Si è verificato un problema'));
        });
}

/**
 * Genera un ID unico per la prenotazione
 * @returns {string} ID prenotazione
 */
function generateBookingId() {
    return `ISOLA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Mostra il messaggio di successo
 * @param {Object} booking - Dati della prenotazione
 */
function showBookingSuccess(booking) {
    console.log('[Booking] Mostrando messaggio di successo');
    
    // Nascondi messaggio errore se visibile
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
    
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        document.getElementById('bookingId').textContent = booking.id;
        successDiv.classList.remove('hidden');
        
        // Scroll to success message
        setTimeout(() => {
            successDiv.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        console.log('[Booking] Messaggio di successo mostrato');
    } else {
        console.error('[Booking] Elemento successMessage non trovato');
    }
}

/**
 * Mostra un messaggio di errore
 * @param {string} title - Titolo
 * @param {string} message - Messaggio
 */
function showError(title, message) {
    console.log('[Booking] Mostrando errore:', title, message);
    
    // Nascondi messaggio successo se visibile
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.classList.add('hidden');
    }
    
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        const errorTitle = errorDiv.querySelector('h3');
        const errorText = document.getElementById('errorText');
        
        if (errorTitle) errorTitle.textContent = title;
        if (errorText) errorText.textContent = message;
        
        errorDiv.classList.remove('hidden');
        
        setTimeout(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        console.log('[Booking] Messaggio di errore mostrato');
    } else {
        console.error('[Booking] Elemento errorMessage non trovato');
        alert(`${title}\n\n${message}`);
    }
}

/**
 * Resetta il form di prenotazione
 */
function resetBookingForm() {
    console.log('[Booking] Reset form');
    
    currentBooking = {
        date: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tables: 0,
        chairs: 0
    };
    
    // Resetta il form HTML
    const form = document.getElementById('bookingForm');
    if (form) {
        form.reset();
    }
    
    // Resetta gli errori
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    setMinDate();
    updateAvailability();
}

// ============ GESTIONE STORAGE ============

/**
 * Ottiene le prenotazioni memorizzate
 * @returns {Array} Array di prenotazioni
 */
function getStoredBookings() {
    const stored = localStorage.getItem(BOOKING_CONFIG.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * Salva una prenotazione
 * @param {Object} booking - Dati della prenotazione
 */
// La prenotazione viene salvata solo lato backend dopo il pagamento
function saveBooking(booking) {
    // Non più usato: la prenotazione viene gestita dal backend dopo il pagamento
}

/**
 * Invia email di prenotazione al proprietario (API REST diretta)
 * @param {Object} booking - Dati della prenotazione
 */
// L'invio email viene ora gestito dal backend dopo il pagamento
function sendBookingEmail(booking) {
    // Non più usato lato client
}

/**
 * Ottiene le prenotazioni di un utente per email
 * @param {string} email - Email dell'utente
 * @returns {Array} Array di prenotazioni
 */
function getUserBookings(email) {
    return getStoredBookings().filter(b => b.email === email);
}

// ============ UTILITY ============

/**
 * Formatta una data
 * @param {string} dateStr - Data in formato YYYY-MM-DD
 * @returns {string} Data formattata
 */
function formatDate(dateStr) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', options);
}

/**
 * Logger per debugging
 * @param {string} message - Messaggio
 * @param {*} data - Dati opzionali
 */
function logBooking(message, data = null) {
    if (data) {
        console.log(`[Isola Lido Booking] ${message}`, data);
    } else {
        console.log(`[Isola Lido Booking] ${message}`);
    }
}

// ============ INIZIALIZZAZIONE GLOBALE ============

/**
 * Inizializza quando il DOM è caricato
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingSystem);
} else {
    initBookingSystem();
}

// Log inizializzazione
logBooking('Sistema di prenotazione inizializzato');
logBooking('Tavoli disponibili: ' + BOOKING_CONFIG.TABLES.total);
logBooking('Sdraio disponibili: ' + BOOKING_CONFIG.CHAIRS.total);
