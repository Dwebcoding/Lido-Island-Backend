/* ============================================
   ISOLA LIDO - COMPONENTI CONDIVISI
   Header e Footer dinamici per tutte le pagine
   ============================================ */

/**
 * Renderizza l'header (navbar) in tutte le pagine
 * @param {string} activePage - Nome della pagina attiva (es: 'home', 'servizi', 'prenotazioni', 'contatti')
 */
function renderHeader(activePage = 'home') {
    const headerHTML = `
        <div class="header-container">
            <div class="logo-section">
                    <a class="brand-block" aria-label="Isola Lido" href="${getHomePath()}">
                        <span style="display:flex;align-items:center;gap:10px;">
                            <img src="${getLogoPath('png')}" alt="Logo Isola Lido" style="width:50px;height:50px;object-fit:contain;">
                            <span class="brand-text">
                                <h4 style="margin:0;display:inline;vertical-align:middle;">Isola Lido</h4>
                                <span class="brand-tagline" style="margin-top:4px;display:block;">Pool · Grill · Relax</span>
                            </span>
                            <span class="header-social" aria-label="Social Isola Lido">
                                <a class="header-social-icon" href="https://www.instagram.com/isola_lido/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                        <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6.1-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 4.7c2.4 0 2.7 0 3.6.1.9.1 1.4.2 1.8.4.5.2.9.5 1.3.9.4.4.7.8.9 1.3.2.4.3.9.4 1.8.1.9.1 1.2.1 3.6s0 2.7-.1 3.6c-.1.9-.2 1.4-.4 1.8-.2.5-.5.9-.9 1.3-.4.4-.8.7-1.3.9-.4.2-.9.3-1.8.4-.9.1-1.2.1-3.6.1s-2.7 0-3.6-.1c-.9-.1-1.4-.2-1.8-.4-.5-.2-.9-.5-1.3-.9-.4-.4-.7-.8-.9-1.3-.2-.4-.3-.9-.4-1.8-.1-.9-.1-1.2-.1-3.6s0-2.7.1-3.6c.1-.9.2-1.4.4-1.8.2-.5.5-.9.9-1.3.4-.4.8-.7 1.3-.9.4-.2.9-.3 1.8-.4.9-.1 1.2-.1 3.6-.1Zm0-1.7c-2.4 0-2.8 0-3.7.1-1 .1-1.7.3-2.3.6-.6.3-1.2.7-1.7 1.2-.5.5-.9 1.1-1.2 1.7-.3.6-.5 1.3-.6 2.3C2 9.2 2 9.6 2 12s0 2.8.1 3.7c.1 1 .3 1.7.6 2.3.3.6.7 1.2 1.2 1.7.5.5 1.1.9 1.7 1.2.6.3 1.3.5 2.3.6.9.1 1.3.1 3.7.1s2.8 0 3.7-.1c1-.1 1.7-.3 2.3-.6.6-.3 1.2-.7 1.7-1.2.5-.5.9-1.1 1.2-1.7.3-.6.5-1.3.6-2.3.1-.9.1-1.3.1-3.7s0-2.8-.1-3.7c-.1-1-.3-1.7-.6-2.3-.3-.6-.7-1.2-1.2-1.7-.5-.5-1.1-.9-1.7-1.2-.6-.3-1.3-.5-2.3-.6C14.8 3 14.4 3 12 3Z" />
                                    </svg>
                                </a>
                                <a class="header-social-icon" href="https://www.facebook.com/lidocassano/?locale=it_IT" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                        <path d="M13.4 21v-8.2h2.7l.4-3.1h-3.1V7.6c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H7.2v3.1h2.7V21h3.5Z" />
                                    </svg>
                                </a>
                                <a class="header-social-icon" href="https://wa.me/393334993469" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                        <path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3 21l4.7-1.2A8.8 8.8 0 1 0 12 3.2Zm0 15.9a7.2 7.2 0 0 1-3.6-1l-.3-.2-2.7.7.7-2.6-.2-.3a7.2 7.2 0 1 1 6.1 3.4Zm3.9-5.4c-.2-.1-1.3-.6-1.5-.6s-.3-.1-.5.1l-.7.9c-.1.2-.2.2-.4.1-.2-.1-.9-.3-1.7-1.1-.6-.5-1.1-1.2-1.2-1.4-.1-.2 0-.3.1-.4l.3-.4.2-.3c.1-.1.1-.2.2-.3.1-.1 0-.3 0-.4 0-.1-.5-1.2-.7-1.6-.2-.4-.4-.3-.5-.3h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 3.9 3.5.5.2.9.3 1.3.4.5.1.9.1 1.2.1.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1 0-.1-.2-.2-.4-.3Z" />
                                    </svg>
                                </a>
                            </span>
                        </span>
                </a>
            </div>
            
            <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">
                <span></span>
                <span></span>
                <span></span>
            </button>
            
            <nav class="nav" id="navMenu">
                <ul class="nav-list">
                    <li><a href="${getHomePath()}" class="nav-link ${activePage === 'home' ? 'active' : ''}">Home</a></li>
                    <li><a href="${getServicesPath()}" class="nav-link ${activePage === 'servizi' ? 'active' : ''}">Servizi</a></li>
                    <li><a href="${getBookingsPath()}" class="nav-link ${activePage === 'prenotazioni' ? 'active' : ''}">Prenotazioni</a></li>
                    <li><a href="${getContactsPath()}" class="nav-link ${activePage === 'contatti' ? 'active' : ''}">Contatti</a></li>
                </ul>
            </nav>
        </div>
    `;
    
    const header = document.querySelector('header.header');
    if (header) {
        header.innerHTML = headerHTML;
        initMenuToggle();
    }
}

/**
 * Renderizza il footer in tutte le pagine
 */
function renderFooter() {
    const footerHTML = `
        <div class="container">
            <div class="footer-container">
                <!-- Sezione Azienda -->
                <div class="footer-section">
                    <h4>Isola Lido</h4>

                    <div class="footer-contact-info">
                        <p>
                            <strong>Indirizzo:</strong><br>
                            Via Rivolta, 20062<br>
                            Cassano d'Adda (MI) - Italia
                        </p>
                        <p>
                            <strong>Telefono:</strong><br>
                            <a href="tel:333-499-3469">333-499-3469</a>
                        </p>
                        <p>
                            <strong>Email:</strong><br>
                            <a href="mailto:info@isolalido.it">info@isolalido.it</a>
                        </p>
                        <p>
                            <strong>P. IVA:</strong><br>
                            10729470152
                        </p>
                    </div>
                </div>

                <!-- Sezione Link Utili -->
                <div class="footer-section">
                    <h4>Link Utili</h4>
                    <ul class="footer-links">
                        <li><a href="${getHomePath()}">Home</a></li>
                        <li><a href="${getServicesPath()}">Servizi e Prezzi</a></li>
                        <li><a href="${getBookingsPath()}">Prenotazioni</a></li>
                        <li><a href="${getContactsPath()}">Contatti</a></li>
                    </ul>
                    <div class="footer-social" aria-label="Social Isola Lido">
                        <a class="social-icon" href="https://www.instagram.com/isola_lido/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6.1-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 4.7c2.4 0 2.7 0 3.6.1.9.1 1.4.2 1.8.4.5.2.9.5 1.3.9.4.4.7.8.9 1.3.2.4.3.9.4 1.8.1.9.1 1.2.1 3.6s0 2.7-.1 3.6c-.1.9-.2 1.4-.4 1.8-.2.5-.5.9-.9 1.3-.4.4-.8.7-1.3.9-.4.2-.9.3-1.8.4-.9.1-1.2.1-3.6.1s-2.7 0-3.6-.1c-.9-.1-1.4-.2-1.8-.4-.5-.2-.9-.5-1.3-.9-.4-.4-.7-.8-.9-1.3-.2-.4-.3-.9-.4-1.8-.1-.9-.1-1.2-.1-3.6s0-2.7.1-3.6c.1-.9.2-1.4.4-1.8.2-.5.5-.9.9-1.3.4-.4.8-.7 1.3-.9.4-.2.9-.3 1.8-.4.9-.1 1.2-.1 3.6-.1Zm0-1.7c-2.4 0-2.8 0-3.7.1-1 .1-1.7.3-2.3.6-.6.3-1.2.7-1.7 1.2-.5.5-.9 1.1-1.2 1.7-.3.6-.5 1.3-.6 2.3C2 9.2 2 9.6 2 12s0 2.8.1 3.7c.1 1 .3 1.7.6 2.3.3.6.7 1.2 1.2 1.7.5.5 1.1.9 1.7 1.2.6.3 1.3.5 2.3.6.9.1 1.3.1 3.7.1s2.8 0 3.7-.1c1-.1 1.7-.3 2.3-.6.6-.3 1.2-.7 1.7-1.2.5-.5.9-1.1 1.2-1.7.3-.6.5-1.3.6-2.3.1-.9.1-1.3.1-3.7s0-2.8-.1-3.7c-.1-1-.3-1.7-.6-2.3-.3-.6-.7-1.2-1.2-1.7-.5-.5-1.1-.9-1.7-1.2-.6-.3-1.3-.5-2.3-.6C14.8 3 14.4 3 12 3Z" />
                            </svg>
                        </a>
                        <a class="social-icon" href="https://www.facebook.com/lidocassano/?locale=it_IT" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M13.4 21v-8.2h2.7l.4-3.1h-3.1V7.6c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H7.2v3.1h2.7V21h3.5Z" />
                            </svg>
                        </a>
                        <a class="social-icon" href="https://wa.me/393334993469" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3 21l4.7-1.2A8.8 8.8 0 1 0 12 3.2Zm0 15.9a7.2 7.2 0 0 1-3.6-1l-.3-.2-2.7.7.7-2.6-.2-.3a7.2 7.2 0 1 1 6.1 3.4Zm3.9-5.4c-.2-.1-1.3-.6-1.5-.6s-.3-.1-.5.1l-.7.9c-.1.2-.2.2-.4.1-.2-.1-.9-.3-1.7-1.1-.6-.5-1.1-1.2-1.2-1.4-.1-.2 0-.3.1-.4l.3-.4.2-.3c.1-.1.1-.2.2-.3.1-.1 0-.3 0-.4 0-.1-.5-1.2-.7-1.6-.2-.4-.4-.3-.5-.3h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 3.9 3.5.5.2.9.3 1.3.4.5.1.9.1 1.2.1.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1 0-.1-.2-.2-.4-.3Z" />
                            </svg>
                        </a>
                    </div>
                </div>

                <!-- Sezione Legale -->
                <div class="footer-section">
                    <h4>Informazioni Legali</h4>
                    <ul class="footer-links">
                        <li><a href="${getPrivacyPath()}">Privacy Policy</a></li>
                        <li><a href="${getCookiePath()}">Cookie Policy</a></li>
                        <li><a href="${getTermsPath()}">Termini e Condizioni</a></li>
                        <li><button class="link-button" id="openConsent">Gestisci preferenze cookie</button></li>
                    </ul>
                </div>

                <!-- Sezione Orari -->
                <div class="footer-section">
                    <h4>Orari di Apertura</h4>
                    <ul class="footer-hours">
                        <li><strong>Lun-Dom:</strong> 9:30 - 19:00</li>
                    </ul>
                    <div style="margin-top:10px; text-align:center;">
                        <img src="${getLogoPath('png')}" alt="Logo Isola Lido" style="width:260px;height:260px;object-fit:contain;background:none;box-shadow:none;border:none;">
                    </div>
                </div>
            </div>

            <!-- Sezione Sviluppatore -->
            <div class="footer-developer">
                <div class="footer-divider"></div>
                <div class="footer-developer-content">
                    <p>
                        &copy; 2026 <strong>Isola Lido</strong> - Tutti i diritti riservati.
                    </p>
                    <p class="footer-credits">
                        Sito sviluppato da <strong>Dwebcoding</strong> 
                        <span class="footer-separator">|</span>
                        <a href="https://dwebcoding.github.io/Portfolio/" target="_blank" rel="noopener noreferrer">Portfolio</a>
                    </p>
                </div>
            </div>
        </div>
    `;
    
    const footer = document.querySelector('footer.footer');
    if (footer) {
        footer.innerHTML = footerHTML;
    }
}

/**
 * Determina il percorso del logo in base alla pagina corrente
 */
function getLogoPath(type = 'svg') {
    const currentPath = window.location.pathname;
    if (type === 'png') {
        if (currentPath.includes('/html/')) {
            return '../images/logo/Logo Lido Island no background.png';
        }
        return 'images/logo/Logo Lido Island no background.png';
    } else {
        if (currentPath.includes('/html/')) {
            return '../images/logo/logo.svg';
        }
        return 'images/logo/logo.svg';
    }
}

/**
 * Determina il percorso della home in base alla pagina corrente
 */
function getHomePath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return '../index.html';
    }
    return 'index.html';
}

/**
 * Determina il percorso della pagina servizi
 */
function getServicesPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return 'servizi.html';
    }
    return 'html/servizi.html';
}

/**
 * Determina il percorso della pagina prenotazioni
 */
function getBookingsPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return 'prenotazioni.html';
    }
    return 'html/prenotazioni.html';
}

/**
 * Determina il percorso della pagina contatti
 */
function getContactsPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return 'contatti.html';
    }
    return 'html/contatti.html';
}

/**
 * Determina il percorso della pagina privacy
 */
function getPrivacyPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return 'privacy.html';
    }
    return 'html/privacy.html';
}

/**
 * Determina il percorso della pagina cookie
 */
function getCookiePath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return 'cookie.html';
    }
    return 'html/cookie.html';
}

/**
 * Determina il percorso della pagina termini
 */
function getTermsPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/html/')) {
        return 'termini.html';
    }
    return 'html/termini.html';
}

/**
 * Menu Toggle per mobile hamburger
 * Nota: Questa è una copia dalla funzione in main.js per completezza
 */
function initMenuToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (!menuToggle || !navMenu) return;

    menuToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        menuToggle.classList.toggle('active');
    });

    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    });

    document.addEventListener('click', function(event) {
        const isClickInsideMenu = navMenu.contains(event.target);
        const isClickOnToggle = menuToggle.contains(event.target);
        
        if (!isClickInsideMenu && !isClickOnToggle && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            menuToggle.classList.remove('active');
        }
    });
}

/**
 * Inizializza header e footer della pagina
 * @param {string} activePage - Pagina attiva da evidenziare nel menu
 */
function initializePageComponents(activePage = 'home') {
    // Renderizza header e footer
    renderHeader(activePage);
    renderFooter();
    
    // Log per debugging
    console.log(`[Isola Lido] Componenti pagina inizializzati - Pagina attiva: ${activePage}`);
}

/**
 * Event listener al caricamento del DOM
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // I componenti verranno inizializzati dalle singole pagine
        // Non inizializziamo qui per permettere a ogni pagina di specificare la pagina attiva
    });
}
