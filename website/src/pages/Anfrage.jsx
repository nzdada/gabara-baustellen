import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PRAXIS, ANLIEGEN } from '@shared/praxis.js'
import { getStore } from '@shared/store.js'
import { Icon } from '@shared/ui.jsx'
import { tr } from '@shared/i18n.js'

// Anfrageformular der Gabara-Webseite: landet als 'request' direkt im
// Admin-Posteingang (Toast + Badge im Büro). Keine Termin-Slots nötig –
// das Büro meldet sich telefonisch/per Mail zurück.

export default function Anfrage() {
  const [anliegenId, setAnliegenId] = useState('')
  const [daten, setDaten] = useState({ name: '', telefon: '', email: '', nachricht: '' })
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const [gesendet, setGesendet] = useState(false)

  const anliegen = ANLIEGEN.find((a) => a.id === anliegenId)
  const set = (f) => (e) => setDaten((d) => ({ ...d, [f]: e.target.value }))

  async function absenden(e) {
    e.preventDefault()
    if (!anliegen) { setFehler('Bitte wählen Sie aus, worum es geht.'); return }
    if (daten.name.trim().length < 2) { setFehler('Bitte geben Sie Ihren Namen an.'); return }
    if (!daten.telefon.trim() && !daten.email.trim()) { setFehler('Bitte Telefonnummer oder E-Mail angeben, damit wir Sie erreichen.'); return }
    setFehler('')
    setSendet(true)
    try {
      const store = await getStore()
      await store.addPublicRequest({
        name: daten.name.trim(),
        telefon: daten.telefon.trim(),
        email: daten.email.trim(),
        anliegen: tr(anliegen.titel),
        anliegenId: anliegen.id,
        nachricht: daten.nachricht.trim(),
        sprache: 'de',
      })
      setGesendet(true)
    } catch (err) {
      setFehler('Senden fehlgeschlagen – bitte rufen Sie uns an.')
    } finally {
      setSendet(false)
    }
  }

  const feld = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <div className="min-h-screen bg-praxis-50/40">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/bilder/logo-gabara.png" alt="Gabara Service GmbH" className="h-9 w-auto" />
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-praxis-700 flex items-center gap-1.5">
            <Icon name="arrowLeft" className="w-4 h-4" /> Zurück
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {gesendet ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
            <span className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Icon name="check" className="w-7 h-7" />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Vielen Dank!</h1>
            <p className="mt-2 text-slate-600">
              Ihre Anfrage ist bei uns eingegangen. Wir melden uns schnellstmöglich –
              bei dringenden Fragen erreichen Sie uns unter{' '}
              <a href={PRAXIS.telefonLink} className="font-bold text-praxis-600">{PRAXIS.telefon}</a>.
            </p>
            <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-praxis-600 text-white font-bold text-sm">Zur Startseite</Link>
          </div>
        ) : (
          <form onSubmit={absenden} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
            <h1 className="text-2xl font-bold text-slate-900">Kostenlose Anfrage</h1>
            <p className="mt-1 text-sm text-slate-500">Unverbindlich anfragen – wir melden uns mit Termin oder Angebot.</p>

            <p className="mt-6 text-sm font-bold text-slate-700">Worum geht es?</p>
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {ANLIEGEN.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAnliegenId(a.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-left text-sm font-medium transition ${
                    anliegenId === a.id ? 'border-praxis-600 bg-praxis-50 text-praxis-800' : 'border-slate-200 hover:border-praxis-300'
                  }`}
                >
                  <Icon name={a.icon} className="w-5 h-5 text-praxis-600 shrink-0" />
                  <span>
                    {tr(a.titel)}
                    <span className="block text-xs font-normal text-slate-500">{tr(a.text)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ihr Name *</label>
                <input className={feld} value={daten.name} onChange={set('name')} autoComplete="name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Telefon</label>
                <input className={feld} value={daten.telefon} onChange={set('telefon')} autoComplete="tel" inputMode="tel" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">E-Mail</label>
                <input className={feld} type="email" value={daten.email} onChange={set('email')} autoComplete="email" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ihr Vorhaben (Ort, Größe, Zeitraum …)</label>
                <textarea rows={4} className={feld} value={daten.nachricht} onChange={set('nachricht')}
                  placeholder="z. B. 3-Zimmer-Wohnung in Augsburg streichen, ca. 85 m², gerne im September" />
              </div>
            </div>

            {fehler && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{fehler}</p>}

            <button type="submit" disabled={sendet}
              className="mt-5 w-full px-6 py-3.5 rounded-2xl bg-praxis-600 text-white font-bold hover:bg-praxis-700 disabled:opacity-50">
              {sendet ? 'Wird gesendet …' : 'Anfrage absenden'}
            </button>
            <p className="mt-3 text-xs text-slate-400 text-center">
              Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben zur Bearbeitung der Anfrage zu
              (<Link to="/datenschutz" className="underline">Datenschutz</Link>).
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
