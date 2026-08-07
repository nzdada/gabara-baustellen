import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { useCollection, useWhere, withStore } from '../../hooks.js'
import MengeMelden, { MeineMeldungen } from './MengeMelden.jsx'
import RaumFlaechen from './RaumFlaechen.jsx'
import { sortiereNeuesteZuerst } from '@shared/leistungen.js'
import BerichtForm from '../../components/BerichtForm.jsx'
import SpesenForm from '../../components/SpesenForm.jsx'

// Baustellen-Detail für Monteure: Arbeitsauftrag (LV mit Ist-Mengen-Eingabe),
// große Buttons für Regiebericht / Reklamation / Abnahme / Spesen,
// eigene Berichte mit Status. Große Touch-Ziele für die Baustelle.

const BERICHT_STATUS = {
  entwurf: ['status.entwurf', 'bg-slate-100 text-slate-600'],
  eingereicht: ['status.eingereicht', 'bg-sky-100 text-sky-700'],
  freigegeben: ['status.freigegeben', 'bg-emerald-100 text-emerald-700'],
  abgerechnet: ['status.abgerechnet', 'bg-violet-100 text-violet-700'],
}

// Die frühere Komponente IstFeld stand hier: ein Feld je Position mit der
// KUMULIERTEN Gesamtmenge, das bei jedem Tastendruck still speicherte. Ersetzt
// durch MengeMelden.jsx – Tagesmenge, ein bewusster Melden-Knopf, Rückgängig
// und ein Protokoll, aus dem hervorgeht, wer wann wie viel gemeldet hat.

export default function MonteurBaustelle({ user }) {
  useLang()
  const { id } = useParams()
  const navigate = useNavigate()
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const positionen = useWhere('lvpositionen', 'projektId', id)
  const berichte = useWhere('berichte', 'projektId', id)
  // Tagesprotokoll dieser Baustelle. Bewusst projektbezogen abonniert – die
  // Sammlung waechst mit Position x Tag x Raum, ein Vollabo waere teuer.
  const meldungen = useWhere('leistungen', 'projektId', id)
  const [quittung, setQuittung] = useState(null)     // { anzahl, ids, bestaetigt }
  const [stornoLaeuft, setStornoLaeuft] = useState('')
  const inFlight = useRef(new Set())
  const [formTyp, setFormTyp] = useState(null)       // 'regie' | 'reklamation' | 'abnahme'
  const [bearbeite, setBearbeite] = useState(null)
  const [spesenForm, setSpesenForm] = useState(false)
  const [zeigeLangtext, setZeigeLangtext] = useState(null)

  const projekt = projekte.find((p) => p.id === id)
  const kunde = patients.find((k) => k.id === projekt?.kundeId)

  const arbeitsPositionen = useMemo(
    () => positionen.filter((p) => p.typ === 'position').sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [positionen]
  )
  // Bedarfs- und NEP-Positionen zaehlen in KEINER Summe mit. Sie standen bisher
  // gleichrangig in der Liste, mit eigenem Eingabefeld – wer dort meldet, meldet
  // in ein Feld, das nirgends auftaucht. Jetzt in einen eigenen, eingeklappten
  // Block: sichtbar bleiben sie, weil sie nach Anordnung doch anfallen koennen.
  // EIN Weg zum Stornieren, doppelt verriegelt.
  //
  // Es gibt zwei Knöpfe, die dasselbe wollen: den in der Quittung und den in
  // "Meine Meldungen". Beide sind gleichzeitig sichtbar, weil die neue Zeile
  // sofort im Live-Abo erscheint, die Quittung aber zehn Sekunden stehen bleibt.
  // Ohne Riegel bucht der zweite Tipper ein zweites Mal gegen – istMenge fiele
  // unter die Meldungssumme, und die Rechnung enthielte zu wenig.
  //
  // Riegel 1: der gelesene Stand (m.storniert) – schützt gegen Wiederholung.
  // Riegel 2: eine Menge laufender Vorgänge – schützt gegen den Doppelklick,
  //           bevor der erste Vorgang im Abo angekommen ist.
  async function stornoEinmal(m) {
    if (!m || m.storniert || inFlight.current.has(m.id)) return
    inFlight.current.add(m.id)
    setStornoLaeuft(m.id)
    try {
      await withStore((s) => s.storniereLeistung(m, { von: user?.name || '' }))
    } finally {
      inFlight.current.delete(m.id)
      setStornoLaeuft('')
    }
  }

  const wertbar = arbeitsPositionen.filter((p) => !p.flags?.bedarf && !p.flags?.nep)
  const nurAufAnordnung = arbeitsPositionen.filter((p) => p.flags?.bedarf || p.flags?.nep)
  const soll = wertbar.reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)
  const ist = wertbar.reduce((s, p) => s + (p.istMenge || 0) * (p.einheitspreis || 0), 0)
  const prozent = soll > 0 ? Math.min(100, Math.round((ist / soll) * 100)) : 0

  // Kopie sortieren – das Array aus useWhere ist React-State und darf nicht mutiert werden
  const meineBerichte = [...berichte].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  if (!projekt) {
    return <div className="p-6 text-center text-slate-400">{t('monteur.baustelleFehlt')}</div>
  }

  const grosserKnopf = 'flex flex-col items-center justify-center gap-1.5 rounded-3xl py-5 font-bold text-sm active:scale-[0.98] transition'

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Kopf */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 flex items-center gap-1 mb-1.5">
          <Icon name="arrowLeft" className="w-4 h-4" /> Zurück
        </button>
        <p className="font-bold text-lg text-slate-900 leading-snug">{projekt.name}</p>
        <p className="text-sm text-slate-500">{projekt.nummer}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent([projekt.anschrift?.strasse, projekt.anschrift?.plzOrt].filter(Boolean).join(', '))}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-praxis-600 bg-praxis-50 rounded-xl px-3 py-2"
          >
            <Icon name="pin" className="w-4 h-4" /> {t('monteur.navigation')}
          </a>
          {kunde?.telefon && (
            <a href={`tel:${kunde.telefon.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-praxis-600 bg-praxis-50 rounded-xl px-3 py-2">
              <Icon name="phone" className="w-4 h-4" /> {kunde.firma || kunde.ansprechpartner || t('monteur.kunde')}
            </a>
          )}
        </div>
        {soll > 0 && (
          <div className="mt-3">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-praxis-600 rounded-full transition-all" style={{ width: `${prozent}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-400">{t('monteur.geleistet', { prozent, ist: euro(ist), soll: euro(soll) })}</p>
          </div>
        )}
      </div>

      {/* Große Aktions-Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setFormTyp('regie')} className={`${grosserKnopf} bg-amber-500 text-white`}>
          <Icon name="regie" className="w-7 h-7" /> {t('bericht.regie')}
        </button>
        <button onClick={() => setFormTyp('reklamation')} className={`${grosserKnopf} bg-red-500 text-white`}>
          <Icon name="reklamation" className="w-7 h-7" /> {t('bericht.reklamation')}
        </button>
        <button onClick={() => setFormTyp('abnahme')} className={`${grosserKnopf} bg-emerald-600 text-white`}>
          <Icon name="abnahme" className="w-7 h-7" /> {t('bericht.abnahme')}
        </button>
        <button onClick={() => setSpesenForm(true)} className={`${grosserKnopf} bg-slate-700 text-white`}>
          <Icon name="spesen" className="w-7 h-7" /> {t('monteur.spesen')}
        </button>
      </div>

      <RaumFlaechen projektId={id} user={user} />

      {/* Arbeitsauftrag: melden, was HEUTE geschafft wurde.
          Vorher stand hier je Position ein Feld mit der kumulierten Gesamtmenge –
          der Monteur musste selbst addieren, und jede Eingabe ueberschrieb still
          den Stand des Kollegen. */}
      {wertbar.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <p className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Icon name="lv" className="w-5 h-5 text-praxis-600" /> {t('melden.titel')}
          </p>

          <MengeMelden
            projektId={id}
            positionen={wertbar}
            meldungen={meldungen}
            user={user}
            onFertig={(q) => {
              setQuittung(q)
              setTimeout(() => setQuittung((a) => (a === q ? null : a)), 10000)
            }}
          />

          {nurAufAnordnung.length > 0 && (
            <details className="mt-4 border-t border-slate-100 pt-3">
              <summary className="text-sm font-semibold text-slate-500 cursor-pointer">
                {t('monteur.nurAufAnordnung', { anzahl: nurAufAnordnung.length })}
              </summary>
              <p className="mt-1.5 text-[12px] text-slate-400">{t('monteur.anordnungHinweis')}</p>
              <div className="mt-2">
                <MengeMelden
                  projektId={id}
                  positionen={nurAufAnordnung}
                  meldungen={meldungen}
                  user={user}
                  onFertig={(q) => {
                    setQuittung(q)
                    setTimeout(() => setQuittung((a) => (a === q ? null : a)), 10000)
                  }}
                />
              </div>
            </details>
          )}
        </div>
      )}

      {/* Eigene Meldungen mit Zuruecknehmen. Zuruecknehmen heisst STORNIEREN:
          die Zeile bleibt als Nachweis stehen und wird gegengerechnet. */}
      {meldungen.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <p className="font-bold text-slate-800 mb-3">{t('melden.meineMeldungen')}</p>
          <MeineMeldungen
            meldungen={sortiereNeuesteZuerst(meldungen)}
            user={user}
            positionen={arbeitsPositionen}
            aufStorno={stornoEinmal}
            laeuftFuer={stornoLaeuft}
          />
        </div>
      )}

      {/* Berichte dieser Baustelle */}
      {meineBerichte.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <p className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Icon name="bericht" className="w-5 h-5 text-praxis-600" /> {t('bericht.berichte')}
          </p>
          <div className="space-y-2">
            {meineBerichte.map((b) => {
              const [schluessel, farbe] = BERICHT_STATUS[b.status] || BERICHT_STATUS.entwurf
              const typLabel = t(b.typ === 'regie' ? 'bericht.regie' : b.typ === 'reklamation' ? 'bericht.reklamation' : 'bericht.abnahme')
              return (
                <button key={b.id}
                  onClick={() => b.status === 'entwurf' && setBearbeite(b)}
                  className="w-full text-left flex items-center gap-2.5 border border-slate-100 rounded-2xl px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{typLabel}</span>
                    <span className="block text-xs text-slate-400 truncate">
                      {datumLok(b.datum || heuteISO())} · {b.mitarbeiterName}{b.beschreibung ? ` · ${b.beschreibung}` : ''}
                    </span>
                  </span>
                  <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0 ${farbe}`}>{t(schluessel)}</span>
                  {b.status === 'entwurf' && <Icon name="arrowRight" className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quittung mit Rueckgaengig – 10 Sekunden sichtbar. Ein Fehlgriff auf der
          Leiter soll sich ohne Umweg ueber die Meldungsliste beheben lassen. */}
      {quittung && (
        <div className="fixed bottom-20 left-3 right-3 z-50 bg-slate-800 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <Icon name="erfolg" className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm flex-1">
            {t('melden.gemeldet', { anzahl: quittung.anzahl })}
            {quittung.bestaetigt === false && (
              <span className="block text-[12px] text-amber-300">{t('melden.wirdUebertragen')}</span>
            )}
          </span>
          <button
            disabled={Boolean(stornoLaeuft)}
            onClick={async () => {
              for (const mid of quittung.ids || []) {
                await stornoEinmal(meldungen.find((m) => m.id === mid))
              }
              setQuittung(null)
            }}
            className="text-sm font-bold text-emerald-300 px-2 min-h-11 shrink-0 disabled:opacity-40"
          >
            {t('melden.rueckgaengig')}
          </button>
          {/* Wegtippen darf NICHT Stornieren bedeuten – dafür ein eigenes X. */}
          <button
            onClick={() => setQuittung(null)}
            aria-label={t('allg.schliessen')}
            className="text-white/60 px-2 min-h-11 shrink-0"
          >
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}

      {formTyp && <BerichtForm typ={formTyp} projektId={id} user={user} onClose={() => setFormTyp(null)} />}
      {bearbeite && <BerichtForm typ={bearbeite.typ} bericht={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
      {spesenForm && <SpesenForm projektId={id} user={user} onClose={() => setSpesenForm(false)} />}
    </div>
  )
}
