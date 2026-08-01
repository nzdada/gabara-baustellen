import { useMemo, useState } from 'react'
import { useCollection, withStore, speichereSetting, useEinstellungen } from '../hooks.js'
import { storeModus } from '@shared/store.js'
import { Icon } from '@shared/ui.jsx'
import { FeldLabel } from '../components/InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { TEAM_FARBEN, teamsAus } from '@shared/teams.js'
import { pruefeVerbindung, ladeArtikelVonFastbill, syncArtikel } from '@shared/fastbill.js'

// Einstellungen = EIN Bereich für Einstellungen UND Stammdaten (User-Wunsch):
// Firmendaten · Mitarbeiter · Artikel · Textbausteine · Sätze · Arbeitszeiten ·
// FastBill (mit Verbindungstest + API-Protokoll) · Daten.

const REITER = [
  { id: 'firma', label: 'Firmendaten' },
  { id: 'mitarbeiter', label: 'Mitarbeiter' },
  { id: 'artikel', label: 'Artikel' },
  { id: 'bausteine', label: 'Textbausteine' },
  { id: 'saetze', label: 'Sätze' },
  { id: 'zeiten', label: 'Arbeitszeiten' },
  { id: 'fastbill', label: 'FastBill' },
  { id: 'daten', label: 'Daten' },
]

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const feld = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
const label = 'block text-xs font-semibold text-slate-500 mb-1'
const karte = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5'

function SpeichernKnopf({ onClick, gespeichert }) {
  return (
    <button onClick={onClick} className="px-4 py-2.5 rounded-xl bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700">
      {gespeichert ? 'Gespeichert' : 'Speichern'}
    </button>
  )
}

// ---------- Reiter: Firmendaten ----------
function Firmendaten() {
  const settings = useCollection('settings')
  const global = settings.find((s) => s.id === 'global')
  const einst = useEinstellungen()
  const [d, setD] = useState(null)
  const [ok, setOk] = useState(false)
  const werte = d || einst
  const set = (f) => (e) => { setOk(false); setD({ ...werte, [f]: e.target.value }) }

  async function speichern() {
    // Zahlenfelder als Number ablegen – sonst rechnen Rechnung/Druck mit Strings
    await speichereSetting('global', {
      ...einst, ...werte,
      zahlungszielTage: Number(werte.zahlungszielTage) || 16,
      sicherheitseinbehaltProzent: Number(werte.sicherheitseinbehaltProzent) || 0,
    }, Boolean(global))
    setOk(true)
  }

  return (
    <div className={karte}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className={label}>Firmenname</label><input className={feld} value={werte.praxisName || ''} onChange={set('praxisName')} /></div>
        <div><label className={label}><FeldLabel info={HINWEIS.einstAnschrift}>Anschrift</FeldLabel></label><input className={feld} value={werte.praxisAnschrift || ''} onChange={set('praxisAnschrift')} /></div>
        <div><label className={label}>Telefon</label><input className={feld} value={werte.praxisTelefon || ''} onChange={set('praxisTelefon')} /></div>
        <div><label className={label}>E-Mail</label><input className={feld} value={werte.praxisEmail || ''} onChange={set('praxisEmail')} /></div>
        {/* Bankdaten werden hier nicht mehr gepflegt: Rechnungen entstehen
            ausschließlich in FastBill, dort stehen auch die Zahlungsangaben. */}
        <div>
          <label className={label}><FeldLabel info={HINWEIS.einstUstStandard}>USt-Standard für neue Kunden</FeldLabel></label>
          <select className={feld} value={werte.ustModusStandard || '13b'} onChange={set('ustModusStandard')}>
            <option value="13b">§13b netto (Nachunternehmer)</option>
            <option value="ust19">19 % USt (Privatkunden)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}><FeldLabel info={HINWEIS.einstZahlungsziel}>Zahlungsziel (Tage)</FeldLabel></label><input type="number" className={feld} value={werte.zahlungszielTage ?? 16} onChange={set('zahlungszielTage')} /></div>
          <div><label className={label}>Sicherheitseinbehalt %</label><input type="number" className={feld} value={werte.sicherheitseinbehaltProzent ?? 10} onChange={set('sicherheitseinbehaltProzent')} /></div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Rechnungen (inkl. E-Rechnung, Nummernvergabe, Versand und Zahlungsangaben) erstellt
        ausschließlich FastBill. Die Daten hier gelten für Berichte, Protokolle und Arbeitsaufträge.
      </p>
      <div className="mt-4"><SpeichernKnopf onClick={speichern} gespeichert={ok} /></div>
    </div>
  )
}

// ---------- Reiter: Mitarbeiter ----------
// team          -> Farbcodierung/Legende im Kalender (shared/teams.js)
// qualifikation -> bestimmt den Regie-Stundensatz im Bericht (Reiter „Sätze")
function Mitarbeiter() {
  const users = useCollection('users')
  const einst = useEinstellungen()
  const [neu, setNeu] = useState(false)
  const leer = { name: '', email: '', rolle: 'mitarbeiter', team: '', farbe: TEAM_FARBEN[1].wert, qualifikation: 'facharbeiter', stundensatzIntern: 25, aktiv: true }
  const [d, setD] = useState(leer)

  const teams = useMemo(() => teamsAus(users), [users])

  async function anlegen() {
    if (!d.name.trim()) return
    await withStore((s) => s.add('users', { ...d, stundensatzIntern: Number(d.stundensatzIntern) || 0 }))
    setD(leer)
    setNeu(false)
  }

  const satzVon = (u) => (u.qualifikation === 'helfer' ? (einst.regieHelfer ?? 31) : (einst.regieFacharbeiter ?? 35))

  return (
    <div className={karte}>
      {teams.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Teams im Kalender</span>
          {teams.map((t) => (
            <span key={t.name} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border border-slate-200">
              <span className="w-3 h-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: t.farbe }} />
              {t.name} <span className="text-slate-400">({t.mitglieder.length})</span>
            </span>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
            <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">E-Mail (Login)</th><th className="py-2 pr-3">Rolle</th>
            <th className="py-2 pr-3"><FeldLabel info={HINWEIS.einstTeam}>Team</FeldLabel></th><th className="py-2 pr-3">Farbe</th>
            <th className="py-2 pr-3"><FeldLabel info={HINWEIS.einstQualifikation}>Qualifikation</FeldLabel></th><th className="py-2 pr-3">Regie €/Std</th>
            <th className="py-2 pr-3"><FeldLabel info={HINWEIS.einstStundensatzIntern}>Std.-Satz intern</FeldLabel></th><th className="py-2 pr-3">Aktiv</th><th></th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="py-2 pr-3">
                  <input className={feld} defaultValue={u.name} onBlur={(e) => withStore((s) => s.update('users', u.id, { name: e.target.value }))} />
                </td>
                <td className="py-2 pr-3">
                  <input className={feld} defaultValue={u.email} onBlur={(e) => withStore((s) => s.update('users', u.id, { email: e.target.value }))} />
                </td>
                <td className="py-2 pr-3">
                  <select className={feld} defaultValue={u.rolle} onChange={(e) => withStore((s) => s.update('users', u.id, { rolle: e.target.value }))}>
                    <option value="admin">Büro/Admin</option>
                    <option value="mitarbeiter">Monteur</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input className={`${feld} !w-32`} placeholder="z. B. Team 1" defaultValue={u.team || ''}
                    onBlur={(e) => withStore((s) => s.update('users', u.id, { team: e.target.value }))} />
                </td>
                <td className="py-2 pr-3">
                  <select className={`${feld} !w-32`} defaultValue={u.farbe || TEAM_FARBEN[1].wert}
                    style={{ color: u.farbe || TEAM_FARBEN[1].wert, fontWeight: 700 }}
                    onChange={(e) => withStore((s) => s.update('users', u.id, { farbe: e.target.value }))}>
                    {TEAM_FARBEN.map((f) => <option key={f.id} value={f.wert}>{f.label}</option>)}
                    {!TEAM_FARBEN.some((f) => f.wert === u.farbe) && u.farbe && <option value={u.farbe}>{u.farbe}</option>}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select className={`${feld} !w-36`} defaultValue={u.qualifikation || 'facharbeiter'}
                    onChange={(e) => withStore((s) => s.update('users', u.id, { qualifikation: e.target.value }))}>
                    <option value="facharbeiter">Facharbeiter</option>
                    <option value="helfer">Helfer/Azubi</option>
                  </select>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap font-semibold text-slate-600">{satzVon(u)} €</td>
                <td className="py-2 pr-3">
                  <input type="number" className={`${feld} !w-24`} defaultValue={u.stundensatzIntern ?? 0}
                    onBlur={(e) => withStore((s) => s.update('users', u.id, { stundensatzIntern: Number(e.target.value) || 0 }))} />
                </td>
                <td className="py-2 pr-3">
                  <button onClick={() => withStore((s) => s.update('users', u.id, { aktiv: u.aktiv === false }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.aktiv !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.aktiv !== false ? 'aktiv' : 'inaktiv'}
                  </button>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => confirm(`${u.name} löschen?`) && withStore((s) => s.remove('users', u.id))}
                    className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {neu ? (
        <div className="mt-4 bg-slate-50 rounded-2xl p-4 grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <input className={feld} placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <input className={feld} placeholder="E-Mail" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
          <select className={feld} value={d.rolle} onChange={(e) => setD({ ...d, rolle: e.target.value })}>
            <option value="mitarbeiter">Monteur</option><option value="admin">Büro/Admin</option>
          </select>
          <input className={feld} placeholder="Team (z. B. Team 1)" value={d.team} onChange={(e) => setD({ ...d, team: e.target.value })} />
          <select className={feld} value={d.qualifikation} onChange={(e) => setD({ ...d, qualifikation: e.target.value })}>
            <option value="facharbeiter">Facharbeiter</option><option value="helfer">Helfer/Azubi</option>
          </select>
          <div className="flex gap-2">
            <button onClick={anlegen} className="flex-1 px-3 py-2 rounded-xl bg-praxis-600 text-white text-sm font-bold">Anlegen</button>
            <button onClick={() => setNeu(false)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm">×</button>
          </div>
          <div className="sm:col-span-3 lg:col-span-6">
            <span className="text-xs font-semibold text-slate-500">Team-Farbe im Kalender</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TEAM_FARBEN.map((f) => (
                <button key={f.id} type="button" title={f.label} onClick={() => setD({ ...d, farbe: f.wert })}
                  className={`w-8 h-8 rounded-full ${d.farbe === f.wert ? 'ring-2 ring-offset-2 ring-slate-900' : 'ring-1 ring-black/10'}`}
                  style={{ backgroundColor: f.wert }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setNeu(true)} className="mt-4 text-sm text-praxis-600 font-medium">+ Mitarbeiter</button>
      )}
      <p className="text-xs text-slate-400 mt-3">
        <strong>Team</strong> steuert Farbe und Legende im Kalender · <strong>Qualifikation</strong> bestimmt den Stundensatz
        im Regiebericht (Sätze im Reiter „Sätze"). Im Lokal-Modus melden sich alle mit den Demo-Zugängen an –
        echte Logins je Mitarbeiter kommen mit dem Firebase-Go-Live.
      </p>
    </div>
  )
}

// ---------- Reiter: Artikel ----------
function Artikel() {
  const katalog = useCollection('katalog')
  const [neu, setNeu] = useState(false)
  const leer = { code: '', name: '', einheit: 'Stück', preis: 0, ekPreis: 0, kategorie: '' }
  const [d, setD] = useState(leer)
  const [meldung, setMeldung] = useState(null)
  const [laeuft, setLaeuft] = useState(false)

  async function anlegen() {
    if (!d.name.trim()) return
    await withStore((s) => s.add('katalog', { ...d, preis: Number(d.preis) || 0, ekPreis: Number(d.ekPreis) || 0, lieferant: '', fastbillArticleId: null }))
    setD(leer)
    setNeu(false)
  }

  async function vonFastbill() {
    setLaeuft(true); setMeldung(null)
    try {
      const erg = await ladeArtikelVonFastbill()
      setMeldung(erg.simuliert
        ? { art: 'info', text: 'Simuliert – FastBill-Zugang fehlt (Reiter FastBill).' }
        : { art: 'ok', text: `FastBill-Artikel geladen: ${erg.neu} neu, ${erg.aktualisiert} aktualisiert.` })
    } catch (e) { setMeldung({ art: 'fehler', text: e.message }) }
    setLaeuft(false)
  }

  async function zuFastbill() {
    const offen = katalog.filter((a) => !a.fastbillArticleId)
    if (!offen.length) { setMeldung({ art: 'info', text: 'Alle Artikel sind bereits verknüpft.' }); return }
    if (!confirm(`${offen.length} Artikel zu FastBill übertragen? (Rate-Limit: max. ~50 Aufrufe/Stunde)`)) return
    setLaeuft(true); setMeldung(null)
    let n = 0
    try {
      for (const a of offen) {
        const erg = await syncArtikel(a)
        if (erg.simuliert) { setMeldung({ art: 'info', text: 'Simuliert – FastBill-Zugang fehlt.' }); setLaeuft(false); return }
        n++
        setMeldung({ art: 'ok', text: `Übertrage … ${n}/${offen.length}` })
      }
      setMeldung({ art: 'ok', text: `${n} Artikel zu FastBill übertragen.` })
    } catch (e) { setMeldung({ art: 'fehler', text: `Nach ${n} Artikeln: ${e.message}` }) }
    setLaeuft(false)
  }

  return (
    <div className={karte}>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={vonFastbill} disabled={laeuft} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium disabled:opacity-50">Aus FastBill laden</button>
        <button onClick={zuFastbill} disabled={laeuft} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium disabled:opacity-50">Alle zu FastBill übertragen</button>
        <button onClick={() => setNeu(true)} className="px-3 py-2 rounded-xl bg-praxis-600 text-white text-sm font-bold">+ Artikel</button>
      </div>
      {meldung && (
        <p className={`mb-3 text-sm rounded-xl px-3 py-2 border ${meldung.art === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : meldung.art === 'fehler' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{meldung.text}</p>
      )}
      {neu && (
        <div className="mb-4 bg-slate-50 rounded-2xl p-4 grid sm:grid-cols-6 gap-2">
          <input className={feld} placeholder="Code" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />
          <input className={`${feld} sm:col-span-2`} placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <input className={feld} placeholder="Einheit" value={d.einheit} onChange={(e) => setD({ ...d, einheit: e.target.value })} />
          <input type="number" step="0.1" className={feld} placeholder="Preis €" value={d.preis} onChange={(e) => setD({ ...d, preis: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={anlegen} className="flex-1 px-3 py-2 rounded-xl bg-praxis-600 text-white text-sm font-bold">OK</button>
            <button onClick={() => setNeu(false)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm">×</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
            <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Einheit</th>
            <th className="py-2 pr-3 text-right">Preis</th><th className="py-2 pr-3 text-right"><FeldLabel info={HINWEIS.einstEkPreis} ausrichtung="rechts">EK</FeldLabel></th><th className="py-2 pr-3">Kategorie</th><th className="py-2 pr-3">FastBill</th><th></th>
          </tr></thead>
          <tbody>
            {katalog.map((a) => (
              <tr key={a.id} className="border-b border-slate-50">
                <td className="py-1.5 pr-3 text-slate-400">{a.code}</td>
                <td className="py-1.5 pr-3">
                  <input className={feld} defaultValue={a.name} onBlur={(e) => withStore((s) => s.update('katalog', a.id, { name: e.target.value }))} />
                </td>
                <td className="py-1.5 pr-3">
                  <input className={`${feld} !w-24`} defaultValue={a.einheit} onBlur={(e) => withStore((s) => s.update('katalog', a.id, { einheit: e.target.value }))} />
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <input type="number" step="0.1" className={`${feld} !w-24 text-right`} defaultValue={a.preis}
                    onBlur={(e) => withStore((s) => s.update('katalog', a.id, { preis: Number(e.target.value) || 0 }))} />
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <input type="number" step="0.1" className={`${feld} !w-24 text-right`} defaultValue={a.ekPreis}
                    onBlur={(e) => withStore((s) => s.update('katalog', a.id, { ekPreis: Number(e.target.value) || 0 }))} />
                </td>
                <td className="py-1.5 pr-3">{a.kategorie || '–'}</td>
                <td className="py-1.5 pr-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.fastbillArticleId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {a.fastbillArticleId ? 'verknüpft' : '—'}
                  </span>
                </td>
                <td className="py-1.5 text-right">
                  <button onClick={() => confirm(`${a.name} löschen?`) && withStore((s) => s.remove('katalog', a.id))}
                    className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">FastBill ist für Artikel und Dienstleistungen führend – hier liegt der Arbeits-Spiegel. CSV-Massenimport: Seite „Import".</p>
    </div>
  )
}

// ---------- Reiter: Textbausteine ----------
function Bausteine() {
  const bausteine = useCollection('bausteine')
  const [neu, setNeu] = useState(false)
  const [d, setD] = useState({ titel: '', text: '' })

  return (
    <div className={karte}>
      {bausteine.map((b) => (
        <div key={b.id} className="mb-3 bg-slate-50 rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <input className={`${feld} font-semibold`} defaultValue={b.titel} onBlur={(e) => withStore((s) => s.update('bausteine', b.id, { titel: e.target.value }))} />
            <button onClick={() => confirm('Baustein löschen?') && withStore((s) => s.remove('bausteine', b.id))}
              className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
          <textarea rows={2} className={feld} defaultValue={b.text} onBlur={(e) => withStore((s) => s.update('bausteine', b.id, { text: e.target.value }))} />
        </div>
      ))}
      {neu ? (
        <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
          <input className={feld} placeholder="Titel" value={d.titel} onChange={(e) => setD({ ...d, titel: e.target.value })} />
          <textarea rows={2} className={feld} placeholder="Text" value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={async () => { if (d.titel.trim()) { await withStore((s) => s.add('bausteine', d)); setD({ titel: '', text: '' }); setNeu(false) } }}
              className="px-3 py-2 rounded-xl bg-praxis-600 text-white text-sm font-bold">Anlegen</button>
            <button onClick={() => setNeu(false)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm">Abbrechen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setNeu(true)} className="text-sm text-praxis-600 font-medium">+ Textbaustein</button>
      )}
    </div>
  )
}

// ---------- Reiter: Sätze ----------
function Saetze() {
  const settings = useCollection('settings')
  const global = settings.find((s) => s.id === 'global')
  const einst = useEinstellungen()
  const [d, setD] = useState(null)
  const [ok, setOk] = useState(false)
  const werte = d || einst
  const set = (f) => (e) => { setOk(false); setD({ ...werte, [f]: e.target.value }) }

  return (
    <div className={karte}>
      <div className="grid sm:grid-cols-3 gap-3 max-w-xl">
        <div><label className={label}><FeldLabel info={HINWEIS.einstRegieSaetze}>Facharbeiter €/Std</FeldLabel></label><input type="number" step="0.5" className={feld} value={werte.regieFacharbeiter ?? 35} onChange={set('regieFacharbeiter')} /></div>
        <div><label className={label}>Helfer €/Std</label><input type="number" step="0.5" className={feld} value={werte.regieHelfer ?? 31} onChange={set('regieHelfer')} /></div>
        <div><label className={label}><FeldLabel info={HINWEIS.einstKmSatz}>Fahrtkosten €/km</FeldLabel></label><input type="number" step="0.05" className={feld} value={werte.kmSatz ?? 0.5} onChange={set('kmSatz')} /></div>
      </div>
      <p className="text-xs text-slate-400 mt-3">Diese Sätze werden in Regieberichten und Spesen vorbelegt (vgl. Nachunternehmervertrag: Facharbeiter 35 €, Helfer 31 €).</p>
      <div className="mt-4">
        <SpeichernKnopf gespeichert={ok} onClick={async () => {
          await speichereSetting('global', {
            ...einst, regieFacharbeiter: Number(werte.regieFacharbeiter) || 35,
            regieHelfer: Number(werte.regieHelfer) || 31, kmSatz: Number(werte.kmSatz) || 0.5,
          }, Boolean(global))
          setOk(true)
        }} />
      </div>
    </div>
  )
}

// ---------- Reiter: Arbeitszeiten ----------
function Arbeitszeiten() {
  const settings = useCollection('settings')
  const oeff = settings.find((s) => s.id === 'oeffnungszeiten')
  const pausenDoc = settings.find((s) => s.id === 'pausen')
  const [ok, setOk] = useState(false)

  const fenster = oeff?.fenster || {}
  const urlaub = oeff?.urlaub || []
  const pausen = pausenDoc?.eintraege || []

  async function setzeFenster(tag, von, bis, aktivieren) {
    const neu = { ...fenster }
    if (aktivieren) neu[tag] = [{ von: von || '07:00', bis: bis || '17:00' }]
    else delete neu[tag]
    await speichereSetting('oeffnungszeiten', { fenster: neu, telefon: oeff?.telefon || [], urlaub }, Boolean(oeff))
    setOk(true)
  }

  return (
    <div className="space-y-4">
      <div className={karte}>
        <p className="text-sm font-bold text-slate-700 mb-3">Arbeitszeiten je Wochentag (Raster für den Kalender)</p>
        {[1, 2, 3, 4, 5, 6].map((tag) => {
          const f = fenster[tag]?.[0]
          return (
            <div key={tag} className="flex items-center gap-3 mb-2">
              <label className="w-10 text-sm font-semibold">{WOCHENTAGE[tag]}</label>
              <input type="checkbox" checked={Boolean(f)} onChange={(e) => setzeFenster(tag, f?.von, f?.bis, e.target.checked)} />
              {f && (
                <>
                  <input type="time" className={`${feld} !w-32`} defaultValue={f.von}
                    onBlur={(e) => setzeFenster(tag, e.target.value, f.bis, true)} />
                  <span className="text-slate-400">–</span>
                  <input type="time" className={`${feld} !w-32`} defaultValue={f.bis}
                    onBlur={(e) => setzeFenster(tag, f.von, e.target.value, true)} />
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className={karte}>
        <p className="text-sm font-bold text-slate-700 mb-3">Betriebsferien / Urlaub</p>
        {urlaub.map((u, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input type="date" className={`${feld} !w-40`} defaultValue={u.von}
              onBlur={(e) => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: urlaub.map((x, j) => j === i ? { ...x, von: e.target.value } : x) }, Boolean(oeff))} />
            <span className="text-slate-400">–</span>
            <input type="date" className={`${feld} !w-40`} defaultValue={u.bis}
              onBlur={(e) => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: urlaub.map((x, j) => j === i ? { ...x, bis: e.target.value } : x) }, Boolean(oeff))} />
            <button onClick={() => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: urlaub.filter((_, j) => j !== i) }, Boolean(oeff))}
              className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
        ))}
        <button onClick={() => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: [...urlaub, { von: '', bis: '' }] }, Boolean(oeff))}
          className="text-sm text-praxis-600 font-medium">+ Zeitraum</button>
      </div>

      <div className={karte}>
        <p className="text-sm font-bold text-slate-700 mb-3">Wiederkehrende Pausen (schraffiert im Kalender)</p>
        {pausen.map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select className={`${feld} !w-24`} defaultValue={p.tag}
              onChange={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, tag: Number(e.target.value) } : x) }, Boolean(pausenDoc))}>
              {[1, 2, 3, 4, 5, 6].map((t) => <option key={t} value={t}>{WOCHENTAGE[t]}</option>)}
            </select>
            <input type="time" className={`${feld} !w-28`} defaultValue={p.von}
              onBlur={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, von: e.target.value } : x) }, Boolean(pausenDoc))} />
            <span className="text-slate-400">–</span>
            <input type="time" className={`${feld} !w-28`} defaultValue={p.bis}
              onBlur={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, bis: e.target.value } : x) }, Boolean(pausenDoc))} />
            <input className={feld} placeholder="Grund" defaultValue={p.grund}
              onBlur={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, grund: e.target.value } : x) }, Boolean(pausenDoc))} />
            <button onClick={() => speichereSetting('pausen', { eintraege: pausen.filter((_, j) => j !== i) }, Boolean(pausenDoc))}
              className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
        ))}
        <button onClick={() => speichereSetting('pausen', { eintraege: [...pausen, { tag: 1, von: '12:00', bis: '12:30', grund: 'Pause' }] }, Boolean(pausenDoc))}
          className="text-sm text-praxis-600 font-medium">+ Pause</button>
      </div>
      {ok && <p className="text-xs text-emerald-600">Gespeichert.</p>}
    </div>
  )
}

// ---------- Reiter: FastBill ----------
function FastBill() {
  const settings = useCollection('settings')
  const apilog = useCollection('apilog')
  const integ = settings.find((s) => s.id === 'integrationen')
  const [d, setD] = useState(null)
  const [zeigeKey, setZeigeKey] = useState(false)
  const [test, setTest] = useState(null)
  const [testet, setTestet] = useState(false)
  const werte = d || { fastbillEmail: integ?.fastbillEmail || '', fastbillApiKey: integ?.fastbillApiKey || '', proxyUrl: integ?.proxyUrl || '' }

  async function speichern() {
    await speichereSetting('integrationen', werte, Boolean(integ))
    setD(null)
  }

  async function testen() {
    setTestet(true)
    setTest(null)
    const erg = await pruefeVerbindung()
    setTest(erg)
    setTestet(false)
  }

  const logSortiert = [...apilog].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20)

  return (
    <div className="space-y-4">
      <div className={karte}>
        <p className="text-sm font-bold text-slate-700 mb-3">FastBill-Zugang</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={label}>Konto-E-Mail</label>
            <input className={feld} value={werte.fastbillEmail} onChange={(e) => setD({ ...werte, fastbillEmail: e.target.value })} placeholder="Login-E-Mail des FastBill-Kontos" /></div>
          <div><label className={label}>API-Key</label>
            <div className="flex gap-2">
              <input type={zeigeKey ? 'text' : 'password'} className={feld} value={werte.fastbillApiKey}
                onChange={(e) => setD({ ...werte, fastbillApiKey: e.target.value })} placeholder="aus FastBill → Einstellungen → API" />
              <button onClick={() => setZeigeKey(!zeigeKey)} className="px-3 rounded-xl bg-slate-100 text-xs">{zeigeKey ? 'verbergen' : 'zeigen'}</button>
            </div></div>
          <div className="sm:col-span-2"><label className={label}>Proxy-URL – NUR für Produktion (sonst LEER lassen!)</label>
            <input className={feld} value={werte.proxyUrl} onChange={(e) => setD({ ...werte, proxyUrl: e.target.value })}
              placeholder="leer lassen! Erst beim Go-Live kommt hier die https://script.google.com/…-Adresse rein" />
            {werte.proxyUrl && !/^(https?:\/\/|\/)/i.test(werte.proxyUrl.trim()) && (
              <p className="mt-1 text-xs text-red-600">
                Das ist keine gültige Adresse (muss mit https:// beginnen) – der Wert wird ignoriert. Feld am besten leeren und speichern.
              </p>
            )}</div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Zugang kann auch über <code>admin/.env.local</code> kommen (VITE_FASTBILL_EMAIL / VITE_FASTBILL_API_KEY) – Werte hier überschreiben das.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={speichern} className="px-4 py-2.5 rounded-xl bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700">Speichern</button>
          <button onClick={testen} disabled={testet} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium disabled:opacity-50">
            {testet ? 'Teste Verbindung …' : 'Verbindung testen'}
          </button>
          {test && (
            <span className={`text-sm px-3 py-1.5 rounded-xl border ${
              test.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : test.simuliert ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {test.ok ? `Verbunden – ${test.anzahl} Kunde(n) gefunden` : test.simuliert ? 'Simuliert – kein Zugang hinterlegt' : `Fehler: ${test.fehler}`}
            </span>
          )}
        </div>
      </div>

      <div className={karte}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-700">API-Protokoll (letzte 20)</p>
          <button onClick={async () => { if (confirm('Protokoll leeren?')) await withStore(async (s) => { for (const e of apilog) await s.remove('apilog', e.id) }) }}
            className="text-xs text-slate-400 hover:text-red-500">Protokoll leeren</button>
        </div>
        {logSortiert.length === 0 ? <p className="text-sm text-slate-400">Noch keine API-Aufrufe.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
              <th className="py-1.5 pr-3">Zeit</th><th className="py-1.5 pr-3">Service</th><th className="py-1.5 pr-3">Status</th><th className="py-1.5">Fehler</th>
            </tr></thead>
            <tbody>
              {logSortiert.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="py-1.5 pr-3 text-slate-400">{new Date(e.createdAt).toLocaleString('de-DE')}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{e.service}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      e.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : e.status === 'fehler' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{e.status}</span>
                  </td>
                  <td className="py-1.5 text-xs text-red-600">{e.fehlerText || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------- Reiter: Daten ----------
function Daten() {
  const modus = storeModus()
  return (
    <div className={karte}>
      <p className="text-sm mb-2">
        Datenhaltung:{' '}
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${modus === 'firebase' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {modus === 'firebase' ? 'Firebase Firestore (online, alle Geräte)' : 'Lokaler Demo-Modus (nur dieser Browser)'}
        </span>
      </p>
      <p className="text-xs text-slate-400 mb-4">
        Für den Betrieb auf allen Geräten (Büro + Monteure gleichzeitig) wird später Firebase aktiviert (Konto nasirdada.98@gmail.com) – die Oberfläche bleibt exakt gleich.
      </p>
      <button
        onClick={async () => {
          if (!confirm('Wirklich ALLE Daten löschen und die Demo-Daten neu einspielen?')) return
          await withStore((s) => s.resetDemo())
          location.reload()
        }}
        className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold hover:bg-red-100"
      >
        Demo-Daten zurücksetzen
      </button>
    </div>
  )
}

export default function Einstellungen() {
  const [reiter, setReiter] = useState('firma')
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Einstellungen & Stammdaten</h1>
        <p className="text-sm text-slate-500">Firmendaten, Mitarbeiter, Artikel, Sätze und Integrationen an einem Ort</p>
      </div>
      <div className="flex gap-1.5 flex-wrap mb-5">
        {REITER.map((r) => (
          <button key={r.id} onClick={() => setReiter(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${reiter === r.id ? 'bg-praxis-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>
      {reiter === 'firma' && <Firmendaten />}
      {reiter === 'mitarbeiter' && <Mitarbeiter />}
      {reiter === 'artikel' && <Artikel />}
      {reiter === 'bausteine' && <Bausteine />}
      {reiter === 'saetze' && <Saetze />}
      {reiter === 'zeiten' && <Arbeitszeiten />}
      {reiter === 'fastbill' && <FastBill />}
      {reiter === 'daten' && <Daten />}
    </div>
  )
}
