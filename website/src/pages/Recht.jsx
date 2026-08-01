import { Link } from 'react-router-dom'
import { PRAXIS } from '@shared/praxis.js'
import { Icon } from '@shared/ui.jsx'

// Impressum + Datenschutzerklärung (Pflichtseiten).
// Angaben übernommen von https://gabara-service.de/impressum (Stand 01.08.2026).

// Vertretung, Steuer- und Registerangaben zentral – nur hier pflegen.
const FIRMA = {
  geschaeftsfuehrer: 'Salman Haj Hussein',
  ustIdNr: 'DE351189636',
  steuernummer: '10312700595',
  mailZweit: 'gabara.service@gmail.com',
}

// ACHTUNG – NOCH OFFEN: Handelsregister und Registernummer.
// Für eine GmbH sind "Registergericht + Registernummer" nach § 5 Abs. 1 Nr. 4 DDG
// (früher TMG) PFLICHTANGABEN. Sie stehen weder im Impressum noch in der
// Datenschutzerklärung von gabara-service.de. Sobald bekannt hier eintragen,
// z. B. { gericht: 'Amtsgericht Augsburg', nummer: 'HRB 12345' } – der Block
// erscheint dann automatisch auf der Seite.
const REGISTER = { gericht: '', nummer: '' }

function Rahmen({ titel, children }) {
  return (
    <div className="min-h-screen bg-praxis-50/40">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/bilder/logo-gabara.png" alt="Gabara Service GmbH" className="h-9 w-auto" />
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-praxis-700 flex items-center gap-1.5">
            <Icon name="arrowLeft" className="w-4 h-4" /> Zurück
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <article className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-10 text-slate-700 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-praxis-800 [&_h2]:mt-7 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3">
          <h1>{titel}</h1>
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
        {PRAXIS.name}<br />
        {PRAXIS.strasse}<br />
        {PRAXIS.plzOrt}
      </p>
      <h2>Kontakt</h2>
      <p>
        Telefon: {PRAXIS.telefon}<br />
        E-Mail: {PRAXIS.email}<br />
        E-Mail: {FIRMA.mailZweit}
      </p>
      <h2>Vertreten durch</h2>
      <p>Geschäftsführer: {FIRMA.geschaeftsfuehrer}</p>
      {REGISTER.gericht && REGISTER.nummer && (
        <>
          <h2>Registereintrag</h2>
          <p>
            Eintragung im Handelsregister<br />
            Registergericht: {REGISTER.gericht}<br />
            Registernummer: {REGISTER.nummer}
          </p>
        </>
      )}
      <h2>Umsatzsteuer</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {FIRMA.ustIdNr}<br />
        Steuernummer: {FIRMA.steuernummer}
      </p>
      <p>
        Bei Bauleistungen an Unternehmer gilt die Steuerschuldnerschaft des Leistungsempfängers
        gemäß § 13b UStG.
      </p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        {FIRMA.geschaeftsfuehrer}<br />
        {PRAXIS.name}, {PRAXIS.strasse}, {PRAXIS.plzOrt}
      </p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </Rahmen>
  )
}

export function Datenschutz() {
  return (
    <Rahmen titel="Datenschutzerklärung">
      <h2>Verantwortlicher</h2>
      <p>
        {PRAXIS.name}, vertreten durch {FIRMA.geschaeftsfuehrer}<br />
        {PRAXIS.strasse}, {PRAXIS.plzOrt} · Telefon {PRAXIS.telefon} · {PRAXIS.email}
      </p>
      <h2>Anfrageformular</h2>
      <p>
        Wenn Sie unser Anfrageformular nutzen, verarbeiten wir die von Ihnen angegebenen Daten
        (Name, Telefonnummer, E-Mail-Adresse, Nachricht) ausschließlich zur Bearbeitung Ihrer Anfrage
        (Art. 6 Abs. 1 lit. b DSGVO – Vertragsanbahnung). Die Daten werden gelöscht, sobald sie für
        die Bearbeitung nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.
      </p>
      <h2>Hosting und Datenspeicherung</h2>
      <p>
        Diese Webseite und die Anfrage-Datenbank werden bei Google (Firebase, Google Ireland Limited)
        betrieben; Daten werden auf Servern in der EU (Region Frankfurt) gespeichert. Mit Google besteht
        ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.
      </p>
      <h2>Ihre Rechte</h2>
      <ul>
        <li>Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung und Einschränkung der Verarbeitung (Art. 17, 18 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>Beschwerde bei einer Datenschutz-Aufsichtsbehörde (für Bayern: BayLDA, Ansbach)</li>
      </ul>
      <p>Zur Ausübung Ihrer Rechte genügt eine formlose Nachricht an {PRAXIS.email}.</p>
      <h2>Keine Weitergabe, kein Tracking</h2>
      <p>
        Ihre Daten werden nicht zu Werbezwecken weitergegeben. Diese Webseite verwendet keine
        Tracking-Cookies und keine Analyse-Dienste.
      </p>
    </Rahmen>
  )
}
