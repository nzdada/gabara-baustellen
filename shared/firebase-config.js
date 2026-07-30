// ============================================================
// Firebase-Konfiguration — Projekt "Gabara Baustellen"
// Konto (später): nasiradada.98@gmail.com
// enabled: true  -> Online-Modus (Firestore, Live-Sync über alle Geräte)
// enabled: false -> lokaler Demo-Modus (Daten nur im Browser)
//
// V1 läuft bewusst lokal. Beim Firebase-Go-Live (V2): Projekt anlegen
// (Spark, europe-west3), Werte unten eintragen, enabled auf true.
// ============================================================

export const FIREBASE_CONFIG = {
  enabled: false,
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

// Google-Kalender-Anbindung (optional, V2 – User-Wunsch "später"):
// OAuth-Client-ID aus der Google Cloud Console (Gabara-Google-Konto).
// Ohne Client-ID läuft der Kalender nur mit der eigenen Datenbank.
export const GOOGLE_KALENDER = {
  clientId: '',
  kalenderId: 'primary',
}

// Kostenloser Mail-Dienst (Google Apps Script Web-App, optional, V2):
// Rechnungen versendet FastBill selbst – dieser Dienst ist nur für
// sonstige Mails (z. B. Einsatz-Infos). Solange url leer ist: kein Versand.
export const MAIL_DIENST = {
  url: '',
  secret: '',
}
