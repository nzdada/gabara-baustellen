import { Link } from 'react-router-dom'
import { PRAXIS, LEISTUNGEN, FAQ, KARRIERE, OEFFNUNGSZEITEN_TEXT } from '@shared/praxis.js'
import { Icon } from '@shared/ui.jsx'
import { tr } from '@shared/i18n.js'
import { useState } from 'react'

// Öffentliche Gabara-Webseite (Inhalte von gabara-service.de übernommen).
// One-Pager: Hero, Leistungen, Warum wir, FAQ, Karriere, Kontakt.
// Anfragen laufen über /#/anfrage direkt in den Admin-Posteingang.

function Kopfzeile() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <a href="#/" className="flex items-center gap-2.5 min-w-0">
          <img src="/bilder/logo-gabara.png" alt="Gabara Service GmbH" className="h-10 w-auto" />
        </a>
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
          <a href="#leistungen" className="hover:text-praxis-600">Leistungen</a>
          <a href="#warum" className="hover:text-praxis-600">Warum wir</a>
          <a href="#fragen" className="hover:text-praxis-600">Fragen</a>
          <a href="#kontakt" className="hover:text-praxis-600">Kontakt</a>
        </nav>
        <Link to="/anfrage" className="shrink-0 px-4 py-2 rounded-xl bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700">
          Kostenlose Anfrage
        </Link>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-praxis-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-14 md:py-20 text-center">
        <p className="text-sm font-bold text-praxis-600 uppercase tracking-wide">Maler & Lackierer · Aichach & Augsburg</p>
        <h1 className="mt-3 text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
          Saubere Arbeit zum fairen Preis
        </h1>
        <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
          Innenmalerei, Fassadenanstriche und Lackierarbeiten – für Privatkunden und Gewerbe.
          Abdecken, Abkleben und besenreine Übergabe sind bei uns selbstverständlich.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/anfrage" className="px-6 py-3 rounded-2xl bg-praxis-600 text-white font-bold hover:bg-praxis-700">
            Jetzt unverbindlich anfragen
          </Link>
          <a href={PRAXIS.telefonLink} className="px-6 py-3 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 hover:border-praxis-500 flex items-center gap-2">
            <Icon name="phone" className="w-5 h-5 text-praxis-600" /> {PRAXIS.telefon}
          </a>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg mx-auto text-center">
          {[['Termintreue', 'check'], ['Festpreis-Angebot', 'euro'], ['VOB-konform', 'shield']].map(([t, ic]) => (
            <div key={t} className="flex flex-col items-center gap-1.5">
              <span className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-praxis-600">
                <Icon name={ic} className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-slate-600">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Leistungen() {
  return (
    <section id="leistungen" className="max-w-5xl mx-auto px-4 py-14">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Unsere Leistungen</h2>
      <p className="mt-2 text-slate-500 text-center max-w-xl mx-auto">
        Vom Wohnzimmer bis zum Bürokomplex – flexibel für alle Projektgrößen.
      </p>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {LEISTUNGEN.map((l) => (
          <div key={l.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <span className="w-11 h-11 rounded-2xl bg-praxis-50 text-praxis-600 flex items-center justify-center">
              <Icon name={l.icon} className="w-6 h-6" />
            </span>
            <h3 className="mt-3 font-bold text-lg text-slate-900">{tr(l.titel)}</h3>
            <p className="mt-1 text-sm text-slate-600">{tr(l.text)}</p>
            <p className="mt-2 text-sm text-slate-500">{tr(l.details)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Warum() {
  const punkte = [
    ['Erfahrenes Team', 'Meister- und Montageteam mit Baustellen-Erfahrung – auch als Nachunternehmer nach Leistungsverzeichnis (VOB, §13b).'],
    ['Saubere Baustelle', 'Vollflächiges Abdecken und Abkleben, tägliche Reinigung, besenreine Übergabe.'],
    ['Verlässliche Termine', 'Feste Ansprechpartner, klare Zeitpläne, pünktlicher Beginn – dokumentiert mit Fotos.'],
    ['Faire Preise', 'Transparente Festpreis-Angebote nach Aufmaß – ohne versteckte Kosten.'],
  ]
  return (
    <section id="warum" className="bg-praxis-50/50">
      <div className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Warum Gabara?</h2>
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          {punkte.map(([t, txt]) => (
            <div key={t} className="flex gap-3">
              <span className="shrink-0 w-8 h-8 rounded-xl bg-praxis-600 text-white flex items-center justify-center">
                <Icon name="check" className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900">{t}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{txt}</p>
              </div>
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
    <section id="fragen" className="max-w-3xl mx-auto px-4 py-14">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Häufige Fragen</h2>
      <div className="mt-8 space-y-2.5">
        {FAQ.map((f, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200">
            <button onClick={() => setOffen(offen === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-slate-800">
              {tr(f.frage)}
              <Icon name={offen === i ? 'x' : 'plus'} className="w-4 h-4 text-praxis-600 shrink-0" />
            </button>
            {offen === i && <p className="px-5 pb-4 text-sm text-slate-600">{tr(f.antwort)}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Karriere() {
  return (
    <section className="bg-praxis-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold">{tr(KARRIERE.titel)}</h2>
        <p className="mt-3 text-praxis-100/90 text-sm">{tr(KARRIERE.text)}</p>
        <p className="mt-2 text-praxis-100/70 text-sm">{tr(KARRIERE.hinweis)}</p>
        <a href={`mailto:${PRAXIS.email}`} className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-white text-praxis-800 font-bold text-sm">
          {PRAXIS.email}
        </a>
      </div>
    </section>
  )
}

function Kontakt() {
  return (
    <section id="kontakt" className="max-w-5xl mx-auto px-4 py-14">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Kontakt</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p className="flex items-center gap-2.5"><Icon name="pin" className="w-4 h-4 text-praxis-600" /> {PRAXIS.name} · {PRAXIS.strasse}, {PRAXIS.plzOrt}</p>
            <p className="flex items-center gap-2.5"><Icon name="phone" className="w-4 h-4 text-praxis-600" /> <a href={PRAXIS.telefonLink} className="hover:text-praxis-600">{PRAXIS.telefon}</a></p>
            <p className="flex items-center gap-2.5"><Icon name="mail" className="w-4 h-4 text-praxis-600" /> <a href={`mailto:${PRAXIS.email}`} className="hover:text-praxis-600">{PRAXIS.email}</a></p>
            {OEFFNUNGSZEITEN_TEXT.map((z, i) => (
              <p key={i} className="flex items-center gap-2.5"><Icon name="clock" className="w-4 h-4 text-praxis-600" /> {tr(z.tag)}: {tr(z.zeit)}</p>
            ))}
          </div>
        </div>
        <div className="bg-praxis-50 rounded-3xl p-7 flex flex-col items-center justify-center text-center">
          <h3 className="font-bold text-lg text-slate-900">Projekt anfragen</h3>
          <p className="mt-1.5 text-sm text-slate-600">
            Beschreiben Sie kurz Ihr Vorhaben – wir melden uns schnellstmöglich mit einem Termin oder Angebot.
          </p>
          <Link to="/anfrage" className="mt-4 px-6 py-3 rounded-2xl bg-praxis-600 text-white font-bold hover:bg-praxis-700">
            Zum Anfrageformular
          </Link>
        </div>
      </div>
    </section>
  )
}

function Fusszeile() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
        <p>© {new Date().getFullYear()} {PRAXIS.name}</p>
        <div className="flex gap-4">
          <Link to="/impressum" className="hover:text-praxis-600">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-praxis-600">Datenschutz</Link>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Kopfzeile />
      <Hero />
      <Leistungen />
      <Warum />
      <Fragen />
      <Karriere />
      <Kontakt />
      <Fusszeile />
    </div>
  )
}
