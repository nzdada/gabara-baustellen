// ============================================================
// Firebase-Konfiguration — Projekt "Gabara System" (gabara-system)
// Firestore-Standort: europe-west3 (Frankfurt), angelegt 01.08.2026.
//
// enabled: true  -> Online-Modus (Firestore, Live-Sync über alle Geräte)
// enabled: false -> lokaler Demo-Modus (Daten nur im Browser)
//
// Der apiKey ist KEIN Geheimnis: er identifiziert das Projekt und steht in
// jeder ausgelieferten Seite. Geschützt wird die Datenbank ausschließlich
// durch firestore.rules.
//
// REIHENFOLGE beim Umschalten auf true:
//   1. firestore.rules und firestore.indexes.json deployen
//   2. Authentication -> E-Mail/Passwort aktivieren, Benutzer anlegen
//   3. users-Dokumente mit der Auth-UID als Dokument-ID anlegen
//   4. erst dann enabled auf true
// Vorher meldet die App nur "Missing or insufficient permissions".
// ============================================================

export const FIREBASE_CONFIG = {
  enabled: true,
  apiKey: 'AIzaSyA5XwEf2L5amFhtJ_iPlwCPhpJJBzLOKQw',
  authDomain: 'gabara-system.firebaseapp.com',
  projectId: 'gabara-system',
  storageBucket: 'gabara-system.firebasestorage.app',
  messagingSenderId: '523217828008',
  appId: '1:523217828008:web:84fcd333abcbec6477aa9d',
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
