import { Link } from 'react-router-dom'
import { PRAXIS, LEISTUNGEN, FAQ, KARRIERE } from '@shared/praxis.js'
import { Icon } from '@shared/ui.jsx'
import { tr } from '@shared/i18n.js'
import { versionsKennung } from '@shared/version.js'
import { useState } from 'react'

// Öffentliche Gabara-Webseite.
//
// Aufbau, Texte, Bilder und Farben folgen der bestehenden Seite
// gabara-service.de – für Kunden soll sich nichts ändern, nur der Unterbau.
// Reihenfolge dort: Kopf · Titelbild · Wer wir sind · Aufruf · Leistungen ·
// Warum wir · Aufruf · Kontakt · Referenzen · Fuß.
//
// Der einzige Unterschied: „Kostenlose Anfrage" führt in das eigene
// Anfrageformular (/#/anfrage), das direkt im Büro-Posteingang landet.

const BILD = {
  held: '/bilder/held-malerarbeiten.jpg',
  team: '/bilder/team-arbeit.jpg',
  referenz: '/bilder/referenz-fassade.jpg',
}

function Kopfzeile() {
  const [offen, setOffen] = useState(false)
  const punkte = [
    ['#leistungen', 'Leistungen'],
    ['#referenzen', 'Referenzen'],
    ['#ueberuns', 'Über uns'],
    ['#kontakt', 'Kontakt'],
  ]
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between gap-3">
        <a href="#/" className="flex items-center min-w-0">
          <img src="/bilder/logo-gabara.png" alt={PRAXIS.name} className="h-12 w-auto" />
        </a>
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium text-praxis-700">
          {punkte.map(([ziel, text]) => (
            <a key={ziel} href={ziel} className="hover:text-praxis-500 transition">{text}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/anfrage"
            className="shrink-0 px-5 py-2.5 bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-500 transition"
          >
            Kostenlose Anfrage
          </Link>
          <button
            onClick={() => setOffen(!offen)}
            className="md:hidden p-2 text-praxis-700"
            aria-label="Menü"
          >
            <Icon name={offen ? 'x' : 'list'} className="w-6 h-6" />
          </button>
        </div>
      </div>
      {offen && (
        <nav className="md:hidden border-t border-slate-100 bg-white px-4 py-2">
          {punkte.map(([ziel, text]) => (
            <a
              key={ziel}
              href={ziel}
              onClick={() => setOffen(false)}
              className="block py-3 text-praxis-700 font-medium border-b border-slate-50 last:border-0"
            >
              {text}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

function Titelbild() {
  return (
    <section
      className="bild-flaeche text-white"
      style={{ backgroundImage: `url('${BILD.held}')` }}
    >
      <div className="max-w-6xl mx-auto px-4 py-24 md:py-36">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-praxis-200">
          Maler &amp; Lackierer · Aichach und Augsburg
        </p>
        {/* Nur EINE h1 je Seite, und sie muss sich von der Überschrift im
            Abschnitt „Wer wir sind" unterscheiden – doppelte Überschriften
            wertet Google ab. */}
        <h1 className="mt-4 text-4xl md:text-6xl font-medium leading-tight max-w-3xl">
          Maler- &amp; Lackierarbeiten für Innen und Außen
        </h1>
        <p className="mt-5 text-lg text-white/85 max-w-2xl">
          Qualität, Präzision und saubere Arbeit. Zuverlässig, termintreu und mit
          höchsten Qualitätsstandards – für Privatkunden und Gewerbe.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link to="/anfrage" className="px-7 py-3.5 bg-praxis-600 font-bold hover:bg-praxis-500 transition">
            Kostenlose Anfrage
          </Link>
          <a
            href={PRAXIS.telefonLink}
            className="px-7 py-3.5 border border-white/40 font-bold hover:bg-white/10 transition flex items-center gap-2"
          >
            <Icon name="phone" className="w-5 h-5" /> {PRAXIS.telefon}
          </a>
        </div>
      </div>
    </section>
  )
}

function WerWirSind() {
  const punkte = [
    ['Qualität & Präzision', 'Saubere Ausführung, hochwertige Materialien und professionelle Ergebnisse.'],
    ['Flexibilität & Termintreue', 'Kurzfristige Termine möglich – wir sind da, wenn Sie uns brauchen.'],
  ]
  return (
    <section id="ueberuns" className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <img
          src={BILD.team}
          alt="Malerarbeiten von Gabara Service"
          className="w-full h-72 md:h-[26rem] object-cover"
          loading="lazy"
        />
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-praxis-500">Wer wir sind</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-medium text-praxis-700 leading-snug">
            Ein starkes Team für professionelle Malerarbeiten
          </h2>
          <p className="mt-5 text-slate-600 leading-relaxed">
            Als erfahrener Maler- und Lackierbetrieb stehen wir für Qualität, Präzision
            und saubere Arbeit. Ob Innen- oder Außenarbeiten – wir arbeiten zuverlässig,
            termintreu und mit höchsten Qualitätsstandards.
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Dank unserer flexiblen Einsatzplanung sind auch kurzfristige Termine möglich.
            Unser Ziel ist es, jedes Projekt effizient, sauber und zur vollsten
            Zufriedenheit unserer Kunden umzusetzen.
          </p>
          <div className="mt-8 space-y-5">
            {punkte.map(([titel, text]) => (
              <div key={titel} className="flex gap-4">
                <span className="shrink-0 w-11 h-11 bg-praxis-50 text-praxis-600 flex items-center justify-center">
                  <Icon name="check" className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-praxis-700">{titel}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Farbiges Band mit Handlungsaufruf – auf der Vorlage zweimal, mit
// unterschiedlichem Text.
function Aufruf({ titel, text, knopf, ziel = '/anfrage' }) {
  return (
    <section className="bg-praxis-700 text-white">
      <div className="max-w-4xl mx-auto px-4 py-14 text-center">
        <h2 className="text-2xl md:text-3xl font-medium">{titel}</h2>
        <p className="mt-3 text-white/80 max-w-2xl mx-auto">{text}</p>
        <Link to={ziel} className="inline-block mt-7 px-8 py-3.5 bg-white text-praxis-700 font-bold hover:bg-praxis-50 transition">
          {knopf}
        </Link>
      </div>
    </section>
  )
}

function Leistungen() {
  return (
    <section id="leistungen" className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-praxis-500">Unsere Leistungen</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-medium text-praxis-700">
          Maler- &amp; Lackierarbeiten für Innen &amp; Außen
        </h2>
      </div>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {LEISTUNGEN.map((l) => (
          <article key={l.id} className="group bg-white border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-hidden">
              <img
                src={l.bild}
                alt={tr(l.titel)}
                className="w-full h-52 object-cover group-hover:scale-105 transition duration-500"
                loading="lazy"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-lg text-praxis-700">{tr(l.titel)}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{tr(l.details)}</p>
              <Link
                to="/anfrage"
                className="mt-5 text-sm font-bold text-praxis-600 hover:text-praxis-500 uppercase tracking-wide inline-flex items-center gap-1.5"
              >
                Mehr erfahren <Icon name="arrowRight" className="w-4 h-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function WarumWir() {
  const punkte = [
    ['Erfahrung & Kompetenz', 'Langjährige Erfahrung im Bereich Maler- und Lackierarbeiten garantiert professionelle Ergebnisse.', 'shield'],
    ['Präzises Arbeiten', 'Saubere, exakte Ausführung bis ins kleinste Detail.', 'brush'],
    ['Hochwertige Materialien', 'Wir verwenden nur geprüfte und langlebige Produkte.', 'material'],
    ['Termintreue', 'Verlässliche Planung und pünktliche Umsetzung.', 'clock'],
    ['Faire Preise', 'Transparente Angebote ohne versteckte Kosten.', 'euro'],
    ['Kundenzufriedenheit', 'Ihre Zufriedenheit ist unser größter Anspruch.', 'erfolg'],
  ]
  return (
    <section className="bg-praxis-50">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-praxis-500">Warum wir?</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-medium text-praxis-700">
            Ihr zuverlässiger Partner für Maler- &amp; Lackierarbeiten
          </h2>
          <p className="mt-4 text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Mit Erfahrung, Präzision und hochwertigen Materialien sorgen wir für perfekte
            Ergebnisse im Innen- und Außenbereich. Sauberkeit, Termintreue und
            Kundenzufriedenheit stehen bei uns an erster Stelle.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-9">
          {punkte.map(([titel, text, ikon]) => (
            <div key={titel} className="flex gap-4">
              <span className="shrink-0 w-12 h-12 bg-praxis-600 text-white flex items-center justify-center">
                <Icon name={ikon} className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-bold text-praxis-700">{titel}</h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Referenzen() {
  const stuecke = [
    { titel: 'Fassadenanstrich Einfamilienhaus', text: 'Saubere und langlebige Beschichtung für optimalen Schutz.', bild: '/bilder/aussenarbeiten.jpg' },
    { titel: 'Außenarbeiten Mehrfamilienhaus', text: 'Professionelle Arbeiten für eine moderne und gepflegte Optik.', bild: BILD.referenz },
    { titel: 'Innenanstrich Treppenhaus', text: 'Präzise Kanten, gleichmäßiger Auftrag, besenreine Übergabe.', bild: '/bilder/innenmalerei.jpg' },
  ]
  return (
    <section id="referenzen" className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-praxis-500">Unsere Referenzen</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-medium text-praxis-700">
          Einblicke in unsere bisherigen Arbeiten
        </h2>
      </div>
      <div className="mt-12 grid sm:grid-cols-3 gap-6">
        {stuecke.map((s) => (
          <figure key={s.titel} className="group overflow-hidden">
            <img
              src={s.bild}
              alt={s.titel}
              className="w-full h-64 object-cover group-hover:scale-105 transition duration-500"
              loading="lazy"
            />
            <figcaption className="mt-4">
              <h3 className="font-bold text-praxis-700">{s.titel}</h3>
              <p className="text-sm text-slate-600 mt-1">{s.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function Kontakt() {
  const felder = [
    ['pin', 'Adresse', `${PRAXIS.strasse}, ${PRAXIS.plzOrt}`, null],
    ['mail', 'E-Mail', PRAXIS.email, `mailto:${PRAXIS.email}`],
    ['phone', 'Telefon', PRAXIS.telefon, PRAXIS.telefonLink],
  ]
  return (
    <section id="kontakt" className="bg-praxis-50">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="grid sm:grid-cols-3 gap-8 text-center">
          {felder.map(([ikon, titel, wert, link]) => (
            <div key={titel} className="flex flex-col items-center">
              <span className="w-14 h-14 bg-praxis-600 text-white flex items-center justify-center">
                <Icon name={ikon} className="w-7 h-7" />
              </span>
              <h3 className="mt-4 font-bold text-praxis-700">{titel}</h3>
              {link
                ? <a href={link} className="mt-1 text-slate-600 hover:text-praxis-600 break-all">{wert}</a>
                : <p className="mt-1 text-slate-600">{wert}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Fragen() {
  const [offen, setOffen] = useState(null)
  return (
    <section id="fragen" className="max-w-3xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-medium text-praxis-700 text-center">Häufige Fragen</h2>
      <div className="mt-9 space-y-2.5">
        {FAQ.map((f, i) => (
          <div key={i} className="bg-white border border-slate-200">
            <button
              onClick={() => setOffen(offen === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-praxis-700"
            >
              {tr(f.frage)}
              <Icon name={offen === i ? 'x' : 'plus'} className="w-4 h-4 text-praxis-600 shrink-0" />
            </button>
            {offen === i && <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{tr(f.antwort)}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Fusszeile() {
  return (
    <footer className="bg-praxis-700 text-white/70">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p>© {new Date().getFullYear()} {PRAXIS.name}</p>
          <div className="flex gap-6">
            <Link to="/impressum" className="hover:text-white">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-white">Datenschutz</Link>
          </div>
        </div>
        <p className="mt-4 text-xs text-white/45">
          {KARRIERE.titel ? tr(KARRIERE.titel) : ''} – Bewerbungen an{' '}
          <a href={`mailto:${PRAXIS.email}`} className="hover:text-white underline">{PRAXIS.email}</a>
        </p>
        {/* AP 3: Versionskennung – bewusst ohne Wort davor (sprachneutral),
            gleiche Kennung steht an jedem Fehlerprotokoll-Eintrag. */}
        <p className="mt-2 text-[10px] text-white/30" dir="ltr">{versionsKennung()}</p>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Kopfzeile />
      <Titelbild />
      <WerWirSind />
      <Aufruf
        titel="Planen Sie Maler- oder Lackierarbeiten?"
        text="Kontaktieren Sie uns für ein unverbindliches Angebot. Wir beraten Sie gerne persönlich und erstellen Ihnen ein individuelles Angebot."
        knopf="Kontaktieren Sie uns"
      />
      <Leistungen />
      <WarumWir />
      <Aufruf
        titel="Verleihen Sie Ihren Räumen neuen Glanz"
        text="Ob Renovierung, Neuanstrich oder Fassadenarbeiten – wir beraten Sie persönlich und professionell."
        knopf="Kostenlos beraten lassen"
      />
      <Referenzen />
      <Kontakt />
      <Fragen />
      <Fusszeile />
    </div>
  )
}
