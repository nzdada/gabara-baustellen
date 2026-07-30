import { Link, useLocation } from 'react-router-dom'
import { PRAXIS } from '@shared/praxis.js'
import { ZahnLogo, Icon } from '@shared/ui.jsx'

// Impressum + Datenschutzerklärung (rechtliche Pflichtseiten, bewusst nur Deutsch).
// Inhalte auf die Firebase-Infrastruktur zugeschnitten: Google Ireland Limited,
// Server-Standort Frankfurt (EU), Apps-Script-Mail-Dienst.

function Rahmen({ titel, children }) {
  return (
    <div className="min-h-screen bg-praxis-50/50" dir="ltr">
      <header className="bg-white border-b border-praxis-100">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-praxis-700">
            <ZahnLogo className="w-7 h-7" />
            <span className="font-bold text-sm">{PRAXIS.name}</span>
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-praxis-700 flex items-center gap-1.5">
            <Icon name="arrowLeft" className="w-4 h-4" /> Zurück
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <article className="bg-white rounded-3xl border border-praxis-100 shadow-sm p-8 md:p-10 text-slate-700 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-praxis-800 [&_h2]:mt-7 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3">
          <h1>{titel}</h1>
          <p className="text-xs text-slate-400 !mb-6">Demo-System · Stand Juli 2026</p>
          {children}
        </article>
      </main>
    </div>
  )
}

export function Impressum() {
  return (
    <Rahmen titel="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {PRAXIS.name} – {PRAXIS.untertitel}<br />
        {PRAXIS.strasse}<br />
        {PRAXIS.plzOrt}
      </p>
      <h2>Kontakt</h2>
      <p>
        Telefon: {PRAXIS.telefon}<br />
        E-Mail: {PRAXIS.email}
      </p>
      <h2>Praxisinhaber</h2>
      <p>Jonas Strötz, Zahnarzt (Approbation in Deutschland)</p>
      <h2>Zuständige Kammer & Aufsicht</h2>
      <p>
        Bayerische Landeszahnärztekammer (BLZK), Fallstraße 34, 81369 München ·
        Kassenzahnärztliche Vereinigung Bayerns (KZVB) ·
        Berufsbezeichnung: Zahnarzt (verliehen in Deutschland) ·
        Berufsordnung: Berufsordnung für die Zahnärzte Bayerns (einsehbar über blzk.de)
      </p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>Jonas Strötz (Anschrift wie oben)</p>
      <p className="text-xs text-slate-400">
        Hinweis: Dies ist ein Demo-System zur Vorstellung. Vor dem Echtbetrieb sind die Angaben
        durch die Praxis zu prüfen und ggf. zu vervollständigen.
      </p>
    </Rahmen>
  )
}

export function Datenschutz() {
  return (
    <Rahmen titel="Datenschutzerklärung">
      <h2>1. Verantwortlicher</h2>
      <p>
        {PRAXIS.name} – {PRAXIS.untertitel}, {PRAXIS.strasse}, {PRAXIS.plzOrt},
        Telefon {PRAXIS.telefon}, E-Mail {PRAXIS.email}
      </p>

      <h2>2. Hosting & Datenbank (Firebase)</h2>
      <p>
        Diese Webseite und die zugehörige Terminverwaltung werden über <strong>Google Firebase</strong> betrieben.
        Anbieter ist die <strong>Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland</strong>
        (Firebase Hosting und Cloud Firestore).
      </p>
      <p>
        <strong>Server-Standort der Datenbank: Frankfurt am Main, Deutschland (Region europe-west3).</strong>{' '}
        Die Datenhaltung erfolgt damit DSGVO-konform innerhalb der EU. Mit Google besteht ein
        Auftragsverarbeitungsvertrag (Cloud Data Processing Addendum). Die Übertragung erfolgt
        ausschließlich verschlüsselt (HTTPS/TLS).
      </p>

      <h2>3. Online-Terminbuchung</h2>
      <p>Bei einer Terminanfrage über diese Webseite verarbeiten wir folgende Daten:</p>
      <ul>
        <li>Name, Telefonnummer, E-Mail-Adresse</li>
        <li>gewünschte Behandlung, Wunschtermin, optionale Nachricht, gewählte Sprache</li>
      </ul>
      <p>
        Zweck: Vereinbarung und Verwaltung Ihres Behandlungstermins (Art. 6 Abs. 1 lit. b DSGVO).
        Die öffentliche Webseite hat technisch keinen Zugriff auf Patientendaten – sie kann
        ausschließlich belegte Zeitfenster (nur Datum/Uhrzeit) lesen und eine Anfrage übermitteln.
        Zugriff auf Anfragen und Patientendaten hat nur das Praxis-Team nach Anmeldung.
      </p>

      <h2>4. Automatisierte E-Mails (Apps-Script-Mail-Dienst)</h2>
      <p>
        Für Terminbestätigungen, Absagen, Terminerinnerungen und ggf. Gebühren-Hinweise nutzen wir
        einen eigenen Mail-Dienst auf Basis von <strong>Google Apps Script</strong> (Google Ireland Limited).
        Dabei werden Ihr Name, Ihre E-Mail-Adresse und die Termindaten (Behandlung, Datum, Uhrzeit)
        an den Mail-Dienst übermittelt und der Versand über das Praxis-Google-Konto ausgeführt.
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Behandlungsvertrags).
        Der Absage-Link in diesen E-Mails enthält einen zufälligen Sicherheitscode, der nur Ihren
        eigenen Termin betrifft.
      </p>

      <h2>5. Google Maps (Zwei-Klick-Lösung)</h2>
      <p>
        Auf der Startseite bieten wir eine Anfahrtskarte von <strong>Google Maps</strong> (Google Ireland
        Limited) an. Die Karte wird <strong>erst nach Ihrem Klick auf „Karte anzeigen"</strong> geladen –
        vorher werden keine Daten an Google übertragen. Mit dem Klick willigen Sie ein, dass Ihre
        IP-Adresse an Google übermittelt wird (Art. 6 Abs. 1 lit. a DSGVO). Alternativ erreichen Sie
        die Karte über den Link „Route planen".
      </p>

      <h2>6. Speicherdauer</h2>
      <p>
        Terminanfragen und Termindaten speichern wir so lange, wie es für die Terminverwaltung
        erforderlich ist bzw. gesetzliche Aufbewahrungspflichten (z. B. § 630f BGB, 10 Jahre für
        Behandlungsdokumentation) bestehen.
      </p>

      <h2>7. Ihre Rechte</h2>
      <ul>
        <li>Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17)</li>
        <li>Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20)</li>
        <li>Widerspruch (Art. 21) sowie Beschwerde bei einer Aufsichtsbehörde – zuständig: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Ansbach</li>
      </ul>
      <p>Zur Ausübung Ihrer Rechte genügt eine formlose Nachricht an {PRAXIS.email}.</p>

      <h2>8. Keine Cookies, kein Tracking</h2>
      <p>
        Diese Webseite setzt keine Tracking- oder Marketing-Cookies ein. Es werden keine
        Analyse-Dienste Dritter geladen. Ihre Spracheinstellung wird ausschließlich lokal in Ihrem
        Browser gespeichert.
      </p>

      <p className="text-xs text-slate-400">
        Hinweis: Dies ist ein Demo-System. Vor dem Echtbetrieb ist diese Erklärung durch die Praxis
        bzw. deren Datenschutzbeauftragten zu prüfen.
      </p>
    </Rahmen>
  )
}

// Standard-Export für bequemes Routing
export default function Recht() {
  const { pathname } = useLocation()
  return pathname.includes('datenschutz') ? <Datenschutz /> : <Impressum />
}
