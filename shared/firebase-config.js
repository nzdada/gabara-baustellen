// ============================================================
// Firebase-Konfiguration — Projekt "Praxis an der Wertachbruecke"
// Konto: nasiradada.98@gmail.com
// enabled: true  -> Online-Modus (Firestore, Live-Sync über alle Geräte)
// enabled: false -> lokaler Demo-Modus (Daten nur im Browser)
// ============================================================

export const FIREBASE_CONFIG = {
  enabled: true,
  apiKey: 'AIzaSyDFxMMObsiSZ1TIpBOsQ7Jg9SOVAW50MNc',
  authDomain: 'praxis-an-der-wertachbru-1d36d.firebaseapp.com',
  projectId: 'praxis-an-der-wertachbru-1d36d',
  storageBucket: 'praxis-an-der-wertachbru-1d36d.firebasestorage.app',
  messagingSenderId: '561239623396',
  appId: '1:561239623396:web:9e486732540c771141cef1',
}

// Google-Kalender-Anbindung (optional, für den echten Praxis-Kalender):
// OAuth-Client-ID aus der Google Cloud Console (gleiches Konto).
// Ohne Client-ID läuft der Kalender im Demo-Modus (nur eigene Datenbank).
export const GOOGLE_KALENDER = {
  clientId: '',
  kalenderId: 'primary',
}

// Kostenloser Mail-Dienst (Google Apps Script Web-App, siehe seed/erinnerung.gs):
// sendet Bestätigungs-/Absage-Mails an Patienten. URL aus "Bereitstellen -> Web-App".
// Solange url leer ist, zeigt die Verwaltung einen Hinweis statt zu senden.
export const MAIL_DIENST = {
  url: 'https://script.google.com/macros/s/AKfycbwQSoL4ChMURB4SJGzq0_nR8V-tHf-3BGMCwMbglUGnJzXWoUes3NbiaqoWipW3dhoUsw/exec',
  secret: 'wertach-mail-2026',
}
