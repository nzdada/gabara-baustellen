import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useCollection, withStore } from '../hooks.js'
import { summe, euro } from '@shared/format.js'
import { useLang, tr } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'

// Abrechnungs-Warenkorb eines Termins: Leistungen aus dem Katalog antippen,
// Anzahl anpassen -> Grundlage für Rechnung & Arzt-Dashboard. Live auf allen Geräten.
// Das System schlägt passende GOZ-Ziffern automatisch vor (aus Behandlungs-Checks
// und eingefügten Textbausteinen) und warnt bei teuren Leistungen ohne genehmigten HKP.

const T = {
  titel: { de: 'Leistungen & Abrechnung', en: 'Services & billing', ar: 'الخدمات والفوترة' },
  warenkorb: { de: 'Abrechnungs-Warenkorb', en: 'Billing basket', ar: 'سلة الفوترة' },
  hinzufuegen: { de: '+ Leistung aus Katalog wählen …', en: '+ choose service from catalogue …', ar: '+ اختر خدمة من الكتالوج …' },
  keine: { de: 'Noch keine Leistungen erfasst – Vorschlag antippen oder aus dem Katalog wählen.', en: 'No services recorded yet – tap a suggestion or choose from the catalogue.', ar: 'لا خدمات مسجلة بعد – اضغط على اقتراح أو اختر من الكتالوج.' },
  gesamt: { de: 'Gesamt', en: 'Total', ar: 'المجموع' },
  vorschlag: { de: 'Vorschläge aus der Dokumentation:', en: 'Suggestions from documentation:', ar: 'اقتراحات من التوثيق:' },
  hkpWarnung: {
    de: '⚠ Achtung: Behandlungsplan noch nicht von der Versicherung freigegeben! Für diese Leistung liegt kein genehmigter Heil- und Kostenplan vor.',
    en: '⚠ Warning: treatment plan not yet approved by the insurer! There is no approved cost plan covering this service.',
    ar: '⚠ تنبيه: خطة العلاج لم تُعتمد بعد من التأمين! لا توجد خطة معتمدة تغطي هذه الخدمة.',
  },
}

// Behandlungs-Check (Zusammenfassung) -> passende Katalog-Position
const CHECK_ZU_KATALOG = {
  'Kontrolle / 01': 'kat-0010',
  'Professionelle Zahnreinigung': 'kat-1040',
  'Füllung': 'kat-2080',
  'Wurzelbehandlung': 'kat-2440',
  'Röntgen': 'kat-0030',
  'Anästhesie': 'kat-0080',
  'PA-Behandlung': 'kat-4005',
  'Beratung': 'kat-0010',
}

const TEUER_AB = 500 // € – ab hier wird ein genehmigter HKP erwartet

export default function LeistungenListe({ termin, dunkel = false }) {
  useLang()
  const katalog = useCollection('katalog')
  const bausteine = useCollection('bausteine')
  const plaene = useCollection('plaene')
  const [hkpWarnung, setHkpWarnung] = useState(null) // Name der Leistung ohne genehmigten Plan
  const leistungen = termin.leistungen || []

  const sortiert = useMemo(() => [...katalog].sort((a, b) => (a.code || '').localeCompare(b.code || '')), [katalog])

  // GOZ-Vorschläge: aus angehakten Behandlungs-Checks + im Text eingefügten Bausteinen
  const vorschlaege = useMemo(() => {
    const ids = new Set()
    for (const check of termin.summary?.checks || []) {
      if (CHECK_ZU_KATALOG[check]) ids.add(CHECK_ZU_KATALOG[check])
    }
    const text = termin.summary?.text || ''
    for (const b of bausteine) {
      const erkennung = (b.text || '').split('\n')[0].slice(0, 30)
      if (erkennung && text.includes(erkennung)) (b.katalogIds || []).forEach((id) => ids.add(id))
    }
    const schonDrin = new Set(leistungen.map((l) => l.katalogId))
    return [...ids].filter((id) => !schonDrin.has(id)).map((id) => katalog.find((k) => k.id === id)).filter(Boolean)
  }, [termin.summary, bausteine, katalog, leistungen])

  // Hat der Patient einen genehmigten, gültigen HKP, der diese Position enthält?
  function hkpGenehmigtFuer(katalogId) {
    return plaene.some(
      (pl) =>
        pl.patientId === termin.patientId &&
        pl.status === 'genehmigt' &&
        (!pl.gueltigBis || pl.gueltigBis >= heuteISO()) &&
        (pl.positionen || []).some((p) => p.katalogId === katalogId)
    )
  }

  async function speichern(neu) {
    await withStore((s) => s.update('appointments', termin.id, { leistungen: neu }))
  }

  function hinzufuegen(katalogId) {
    const k = katalog.find((k) => k.id === katalogId)
    if (!k) return
    // Sicherheits-Warnung: teure Leistung ohne genehmigten Heil- und Kostenplan
    if ((k.preis || 0) >= TEUER_AB && !hkpGenehmigtFuer(k.id)) {
      setHkpWarnung(`${k.code} · ${k.name}`)
    } else {
      setHkpWarnung(null)
    }
    const vorhanden = leistungen.find((l) => l.katalogId === k.id)
    if (vorhanden) {
      speichern(leistungen.map((l) => (l.katalogId === k.id ? { ...l, anzahl: (l.anzahl || 1) + 1 } : l)))
    } else {
      speichern([...leistungen, { katalogId: k.id, code: k.code, name: k.name, preis: k.preis, anzahl: 1 }])
    }
  }

  function anzahl(l, delta) {
    const neu = (l.anzahl || 1) + delta
    if (neu <= 0) return speichern(leistungen.filter((x) => x !== l))
    speichern(leistungen.map((x) => (x === l ? { ...x, anzahl: neu } : x)))
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <p className={`font-bold mr-auto rtl:mr-0 rtl:ml-auto ${dunkel ? 'text-lg' : 'text-slate-800'}`}>
          {dunkel ? tr(T.warenkorb) : tr(T.titel)}
          <span className={`inline-flex items-center gap-1 mx-2 text-[10px] font-bold rounded-full px-2 py-0.5 align-middle ${
            dunkel ? 'text-praxis-300 bg-praxis-500/15' : 'text-praxis-700 bg-praxis-100'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-praxis-500 animate-pulse" /> LIVE
          </span>
        </p>
        <select
          value=""
          onChange={(e) => e.target.value && hinzufuegen(e.target.value)}
          className={`text-sm rounded-xl px-3 py-2.5 max-w-full ${
            dunkel ? 'bg-slate-950/60 border border-white/15 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <option value="">{tr(T.hinzufuegen)}</option>
          {sortiert.map((k) => (
            <option key={k.id} value={k.id}>
              {k.code} · {k.name} — {euro(k.preis)}
            </option>
          ))}
        </select>
      </div>

      {/* HKP-Sicherheits-Warnung */}
      {hkpWarnung && (
        <div className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold border-2 ${
          dunkel ? 'bg-amber-500/15 border-amber-500/50 text-amber-300' : 'bg-amber-50 border-amber-400 text-amber-800'
        }`}>
          <span className="flex-1">{tr(T.hkpWarnung)}<br /><span className="font-normal opacity-80">{hkpWarnung}</span></span>
          <button onClick={() => setHkpWarnung(null)} className="shrink-0 opacity-60 hover:opacity-100"><Icon name="x" className="w-4 h-4" /></button>
        </div>
      )}

      {/* Automatische GOZ-Vorschläge aus Checks/Bausteinen */}
      {vorschlaege.length > 0 && (
        <div className="mt-3">
          <p className={`text-[11px] font-semibold mb-1.5 ${dunkel ? 'text-slate-400' : 'text-slate-400'}`}>{tr(T.vorschlag)}</p>
          <div className="flex flex-wrap gap-1.5">
            {vorschlaege.map((k) => (
              <button
                key={k.id}
                onClick={() => hinzufuegen(k.id)}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border-2 border-dashed transition ${
                  dunkel
                    ? 'border-praxis-500/50 text-praxis-300 hover:bg-praxis-500/15 hover:border-praxis-400'
                    : 'border-praxis-300 text-praxis-700 hover:bg-praxis-50'
                }`}
              >
                + {k.code} · {k.name} — {euro(k.preis)}
              </button>
            ))}
          </div>
        </div>
      )}

      {leistungen.length === 0 ? (
        <p className={`mt-3 text-sm ${dunkel ? 'text-slate-500' : 'text-slate-400'}`}>{tr(T.keine)}</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {leistungen.map((l, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm ${
                dunkel ? 'bg-slate-950/40 border border-white/10' : 'bg-slate-50 border border-slate-100'
              }`}
            >
              <span className={`text-xs font-mono shrink-0 ${dunkel ? 'text-praxis-300' : 'text-praxis-700'}`}>{l.code}</span>
              <span className="flex-1 min-w-0 truncate font-medium">{l.name}</span>
              <span className={`flex items-center gap-1.5 shrink-0 ${dunkel ? 'text-slate-300' : 'text-slate-600'}`}>
                <button onClick={() => anzahl(l, -1)} className={`w-7 h-7 rounded-full font-bold ${dunkel ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-slate-200 hover:border-praxis-400'}`}>–</button>
                <span className="w-8 text-center font-semibold">{l.anzahl || 1}×</span>
                <button onClick={() => anzahl(l, +1)} className={`w-7 h-7 rounded-full font-bold ${dunkel ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-slate-200 hover:border-praxis-400'}`}>+</button>
              </span>
              <span className="w-24 text-right rtl:text-left font-bold shrink-0" dir="ltr">{euro((l.preis || 0) * (l.anzahl || 1))}</span>
              <button onClick={() => speichern(leistungen.filter((x) => x !== l))} className={`shrink-0 ${dunkel ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}>
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className={`flex justify-between items-center rounded-xl px-4 py-3 font-bold ${dunkel ? 'bg-praxis-500/15 text-praxis-200' : 'bg-praxis-50 text-praxis-900'}`}>
            <span>{tr(T.gesamt)}</span>
            <span className="text-lg" dir="ltr">{euro(summe(leistungen))}</span>
          </div>
        </div>
      )}
    </div>
  )
}
