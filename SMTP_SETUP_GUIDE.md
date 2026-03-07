# Guida per la Configurazione SMTP

## Cosa serve per SMTP_PASS

La password SMTP può essere:

### 1. **Password App di Gmail** (Consigliato per Gmail)
Se usi Gmail come server SMTP:

1. Vai su [Google Account](https://myaccount.google.com/)
2. Seleziona "Sicurezza"
3. Abilita l'**Autenticazione a Due Fattori**
4. Vai su "Password app"
5. Crea una nuova password app per "Mail"
6. Usa questa password come `SMTP_PASS`

### 2. **Password Account Email**
Se usi un provider email diverso (Outlook, Yahoo, ecc.):
- Usa la password normale del tuo account email
- Assicurati che l'accesso IMAP/SMTP sia abilitato

### 3. **API Key di Servizi Email**
Se usi servizi come SendGrid, Mailgun, ecc.:
- Genera una API key dal pannello di controllo
- Usa la API key come `SMTP_PASS`

## Configurazione Consigliata per Gmail

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tuoindirizzo@gmail.com
SMTP_PASS=la_tua_password_app_generata
FROM_EMAIL=tuoindirizzo@gmail.com
OWNER_EMAIL=isolalido@outlook.com
```

## Configurazione per Altri Provider

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=tuoindirizzo@outlook.com
SMTP_PASS=la_tua_password
```

### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=tuoindirizzo@yahoo.com
SMTP_PASS=la_tua_password_app
```

## Passaggi per Gmail (Passo-passo)

1. **Abilita 2FA:**
   - Vai su [Google Account](https://myaccount.google.com/)
   - Sezione "Sicurezza" → "Verifica in due passaggi"

2. **Crea Password App:**
   - Sezione "Sicurezza" → "Password app"
   - Seleziona "Mail" e "Altro (personalizzato)"
   - Dai un nome (es: "Lido Island Backend")
   - Clicca "Genera"

3. **Configura .env:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tuoindirizzo@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop  # La password app generata
   ```

## Verifica Configurazione

Dopo aver configurato, riavvia il backend e controlla i log:
- Se vedi `[MAILER] SMTP credentials not fully configured`, manca qualche variabile
- Se vedi `[MAILER] SMTP credentials configured`, la configurazione è corretta

## Alternative

Se non vuoi configurare SMTP:
- Le email non verranno inviate (solo log)
- Le prenotazioni funzioneranno ugualmente (salvataggio su database)
- Puoi usare servizi come SendGrid per email affidabili

## Sicurezza

⚠️ **Importante:**
- Non condividere mai la password SMTP
- Usa password app invece della password principale
- Non committare il file `.env` su GitHub
- Usa variabili d'ambiente su Vercel per la produzione