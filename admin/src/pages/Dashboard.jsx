import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useCollection } from '../hooks.js'
import { istOffen, normalisiereStatus, statusInfo, istUeberfaellig } from '@shared/projektstatus.js'

// Finanz-Dashboard: Verdienst/Gewinn je Baustelle (Näherung), offene Rechnungen,
// überfällige Projekte. Alle Zahlen aus Ist-Mengen, Regieberichten und internen Sätzen.

function stundenAus(start, ende) {
  if (!start || !ende) return 0
  const [h1, m1] = start.split(':').map(Number)
  const [h2, m2] = ende.split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60)
}

function Kpi({ icon, label, wert, farbe = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <p className="text-xs text-slate-400 flex items-center gap-1.5"><Icon name={icon} className="w-3.5 h-3.5" /> {label}</p>
      <p className={`mt-1 text-xl font-bold ${farbe}`}>{wert}</p>
    </div>
  )
}

export default function Dashboard() {
  const projekte = useCollection('projekte')
  const lv = useCollection('lvpositionen')
  const berichte = useCollection('berichte')
  const spesen = useCollection('spesen')
  const rechnungen = useCollection('rechnungen')
  const appointments = useCollection('appointments')
  const users = useCollection('users')
  const katalog = useCollection('katalog')

  const heute = new Date().toISOString().slice(0, 10)

  const zeilen = useMemo(() => {
    const relevant = projekte.filter((p) => istOffen(p.status) || normalisiereStatus(p.status) === 'abgeschlossen')
    return relevant.map((p) => {
      const pos = lv.filter((x) => x.projektId === p.id && x.typ === 'position' && !x.flags?.bedarf && !x.flags?.nep)
      const auftragswert = pos.reduce((s, x) => s + (x.menge || 0) * (x.einheitspreis || 0), 0)
      const geleistet = pos.reduce((s, x) => s + (x.istMenge || 0) * (x.einheitspreis || 0), 0)
      const abgerechnet = pos.reduce((s, x) => s + (x.abgerechnetMenge || 0) * (x.einheitspreis || 0), 0)

      const regie = berichte.filter((b) => b.projektId === p.id && b.typ === 'regie' && ['freigegeben', 'abgerechnet'].includes(b.status))
      const regieErloes = regie.reduce((s, b) =>
        s + (b.stunden || []).reduce((x, z) => x + (z.anzahl || 0) * (z.satz || 0), 0)
          + (b.material || []).reduce((x, m) => x + (m.menge || 0) * (m.preis || 0), 0), 0)
      const materialKosten = regie.reduce((s, b) => s + (b.material || []).reduce((x, m) => {
        const art = katalog.find((a) => a.id === m.artikelId)
        const ek = art?.ekPreis || (m.preis || 0) * 0.7
        return x + (m.menge || 0) * ek
      }, 0), 0)

      const einsaetze = appointments.filter((t) => t.projektId === p.id && t.erledigt)
      const lohnKosten = einsaetze.reduce((s, t) => {
        const std = stundenAus(t.start, t.ende)
        const satzSumme = (t.mitarbeiterIds || []).reduce((x, id) => x + (users.find((u) => u.id === id)?.stundensatzIntern || 0), 0)
        return s + std * satzSumme
      }, 0)

      const spesenSumme = spesen.filter((s) => s.projektId === p.id).reduce((x, s) => x + (s.betrag || 0), 0)
      const ergebnis = geleistet + regieErloes - materialKosten - lohnKosten - spesenSumme

      return { p, auftragswert, geleistet, abgerechnet, regieErloes, materialKosten, lohnKosten, spesenSumme, ergebnis }
    })
  }, [projekte, lv, berichte, spesen, appointments, users, katalog])

  const laufende = projekte.filter((p) => istOffen(p.status)).length
  const offeneRechnungen = rechnungen.filter((r) => ['uebertragen', 'gestellt'].includes(r.status))
  const offeneSumme = offeneRechnungen.reduce((s, r) => s + (r.zahlbetrag ?? r.netto ?? 0), 0)
  const bezahltSumme = rechnungen.filter((r) => r.status === 'bezahlt').reduce((s, r) => s + (r.zahlbetrag ?? r.netto ?? 0), 0)
  const eingereicht = berichte.filter((b) => b.status === 'eingereicht').length
  const offeneSpesen = spesen.filter((s) => s.status === 'eingereicht').reduce((x, s) => x + (s.betrag || 0), 0)

  const ueberfaellig = projekte.filter((p) => istUeberfaellig(p, heute))
  const chartZeilen = zeilen.filter((z) => istOffen(z.p.status) && z.auftragswert > 0)
  const chartMax = Math.max(1, ...chartZeilen.map((z) => z.auftragswert))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Finanzielle Auswertung je Baustelle – Näherung auf Basis Ist-Mengen und internen Sätzen</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi icon="folder" label="Laufende Baustellen" wert={laufende} />
        <Kpi icon="euro" label="Offene Rechnungen" wert={euro(offeneSumme)} farbe="text-amber-600" />
        <Kpi icon="check" label="Bezahlt" wert={euro(bezahltSumme)} farbe="text-emerald-600" />
        <Kpi icon="bericht" label="Berichte eingereicht" wert={eingereicht} />
        <Kpi icon="truck" label="Offene Spesen" wert={euro(offeneSpesen)} />
      </div>

      {(ueberfaellig.length > 0) && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-700 mb-1.5 flex items-center gap-1.5"><Icon name="alert" className="w-4 h-4" /> Überfällige Projekte</p>
          {ueberfaellig.map((p) => (
            <Link key={p.id} to={`/projekte/${p.id}`} className="block text-sm text-red-700 hover:underline">
              {p.nummer} · {p.name} – geplantes Ende {new Date(p.endeDatum + 'T12:00:00').toLocaleDateString('de-DE')}
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3">Baustelle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">LV-Auftragswert</th>
              <th className="px-4 py-3 text-right">Geleistet (Ist)</th>
              <th className="px-4 py-3 text-right">Abgerechnet</th>
              <th className="px-4 py-3 text-right">Regie-Erlös</th>
              <th className="px-4 py-3 text-right">Material</th>
              <th className="px-4 py-3 text-right">Lohn intern</th>
              <th className="px-4 py-3 text-right">Spesen</th>
              <th className="px-4 py-3 text-right">Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map(({ p, auftragswert, geleistet, abgerechnet, regieErloes, materialKosten, lohnKosten, spesenSumme, ergebnis }) => {
              const st = statusInfo(p.status)
              return (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/projekte/${p.id}`} className="font-medium text-praxis-600 hover:underline">{p.nummer}</Link>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: st.farbe, backgroundColor: `${st.farbe}1f` }}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{auftragswert ? euro(auftragswert) : '–'}</td>
                  <td className="px-4 py-3 text-right">{euro(geleistet)}</td>
                  <td className="px-4 py-3 text-right">{euro(abgerechnet)}</td>
                  <td className="px-4 py-3 text-right">{euro(regieErloes)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">− {euro(materialKosten)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">− {euro(lohnKosten)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">− {euro(spesenSumme)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${ergebnis >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euro(ergebnis)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {chartZeilen.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-bold text-slate-700 mb-4">Auftragswert vs. geleistete Arbeit (offene Baustellen)</p>
          <svg viewBox={`0 0 600 ${chartZeilen.length * 56 + 10}`} className="w-full">
            {chartZeilen.map((z, i) => {
              const y = i * 56
              const w1 = (z.auftragswert / chartMax) * 420
              const w2 = (z.geleistet / chartMax) * 420
              return (
                <g key={z.p.id} transform={`translate(0, ${y})`}>
                  <text x="0" y="14" fontSize="11" fill="#475569">{z.p.nummer} {z.p.name.slice(0, 40)}</text>
                  <rect x="0" y="20" width={w1} height="10" rx="5" fill="#d9d9dc" />
                  <rect x="0" y="34" width={w2} height="10" rx="5" fill="#8b1a1a" />
                  <text x={w1 + 8} y="29" fontSize="10" fill="#94a3b8">{euro(z.auftragswert)}</text>
                  <text x={w2 + 8} y="43" fontSize="10" fill="#8b1a1a">{euro(z.geleistet)}</text>
                </g>
              )
            })}
          </svg>
          <p className="text-xs text-slate-400 mt-2">Grau = LV-Auftragswert · Rot = geleistete Arbeit (Ist-Mengen × EP)</p>
        </div>
      )}
    </div>
  )
}
