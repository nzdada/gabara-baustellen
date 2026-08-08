import { useMemo, useState } from 'react'
import { useCollection, withStore, speichereSetting, useEinstellungen } from '../hooks.js'
import { storeModus } from '@shared/store.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { FeldLabel } from '../components/InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { TEAM_FARBEN, teamsAus } from '@shared/teams.js'
import { pruefeVerbindung, ladeArtikelVonFastbill, syncArtikel } from '@shared/fastbill.js'

// Einstellungen = EIN Bereich für Einstellungen UND Stammdaten (User-Wunsch):
// Firmendaten · Mitarbeiter · Artikel · Textbausteine · Sätze · Arbeitszeiten ·
// FastBill (mit Verbindungstest + API-Protokoll) · Daten.

const REITER = [
  { id: 'firma', schluessel: 'einst.firmendaten', icon: 'firma' },
  { id: 'mitarbeiter', schluessel: 'einst.mitarbeiter', icon: 'team' },
  { id: 'artikel', schluessel: 'einst.artikel', icon: 'material' },
  { id: 'bausteine', schluessel: 'einst.bausteine', icon: 'doc' },
  { id: 'saetze', schluessel: 'einst.saetze', icon: 'euro' },
  { id: 'zeiten', schluessel: 'einst.zeiten', icon: 'clock' },
  { id: 'fastbill', schluessel: 'FastBill', icon: 'rechnung' },
  { id: 'daten', schluessel: 'einst.daten', icon: 'speichern' },
]

// Kurzform der Wochentage – im Arabischen eigene Reihe (Woche beginnt sonntags)
const WOCHENTAG_SCHLUESSEL = ['wt.so', 'wt.mo', 'wt.di', 'wt.mi', 'wt.do', 'wt.fr', 'wt.sa']
const wochentag = (i) => t(WOCHENTAG_SCHLUESSEL[i])

const feld = 'w-full rounded-feld border border-rahmen px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
const label = 'block text-xs font-semibold text-schrift-leise mb-1'
const karte = 'bg-karte rounded-karte border border-rahmen shadow-karte p-5'

function SpeichernKnopf({ onClick, gespeichert }) {
  return (
    <button onClick={onClick} className={S.BTN_PRIMAER}>
      <Icon name={gespeichert ? 'erfolg' : 'speichern'} groesse="s" />
      {t(gespeichert ? 'allg.gespeichert' : 'allg.speichern')}
    </button>
  )
}

// ---------- Reiter: Firmendaten ----------
function Firmendaten() {
  useLang()
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
        <div><label className={label}>{t('einst.firmenname')}</label><input className={feld} value={werte.praxisName || ''} onChange={set('praxisName')} /></div>
        <div><label className={label}><FeldLabel info={HINWEIS.einstAnschrift}>{t('allg.anschrift')}</FeldLabel></label><input className={feld} value={werte.praxisAnschrift || ''} onChange={set('praxisAnschrift')} /></div>
        <div><label className={label}>{t('allg.telefon')}</label><input className={feld} value={werte.praxisTelefon || ''} onChange={set('praxisTelefon')} /></div>
        <div><label className={label}>{t('allg.email')}</label><input className={feld} value={werte.praxisEmail || ''} onChange={set('praxisEmail')} /></div>
        {/* Bankdaten werden hier nicht mehr gepflegt: Rechnungen entstehen
            ausschließlich in FastBill, dort stehen auch die Zahlungsangaben. */}
        <div>
          <label className={label}><FeldLabel info={HINWEIS.einstUstStandard}>{t('einst.ustStandard')}</FeldLabel></label>
          <select className={feld} value={werte.ustModusStandard || '13b'} onChange={set('ustModusStandard')}>
            <option value="13b">{t('einst.ust13b')}</option>
            <option value="ust19">{t('einst.ust19')}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}><FeldLabel info={HINWEIS.einstZahlungsziel}>{t('kunden.zahlungsziel')}</FeldLabel></label><input type="number" className={feld} value={werte.zahlungszielTage ?? 16} onChange={set('zahlungszielTage')} /></div>
          <div><label className={label}>{t('einst.einbehalt')}</label><input type="number" className={feld} value={werte.sicherheitseinbehaltProzent ?? 10} onChange={set('sicherheitseinbehaltProzent')} /></div>
        </div>
      </div>
      <p className="text-xs text-schrift-zart mt-3">
        {t('einst.rechnungHinweis')}
      </p>
      <div className="mt-4"><SpeichernKnopf onClick={speichern} gespeichert={ok} /></div>
    </div>
  )
}

// ---------- Reiter: Mitarbeiter ----------
// team          -> Farbcodierung/Legende im Kalender (shared/teams.js)
// qualifikation -> bestimmt den Regie-Stundensatz im Bericht (Reiter „Sätze")
function Mitarbeiter() {
  useLang()
  const users = useCollection('users')
  const einst = useEinstellungen()
  const [neu, setNeu] = useState(false)
  const [fehler, setFehler] = useState('')
  const istOnline = storeModus() === 'firebase'
  const leer = { uid: '', name: '', email: '', rolle: 'mitarbeiter', team: '', farbe: TEAM_FARBEN[1].wert, qualifikation: 'facharbeiter', stundensatzIntern: 25, aktiv: true }
  const [d, setD] = useState(leer)

  const teams = useMemo(() => teamsAus(users), [users])
  // Firebase-UIDs sind 28 Zeichen lang und alphanumerisch. Alles andere ist eine
  // von Firestore vergebene Zufalls-ID -> fuer diesen Nutzer greift die
  // Rollenpruefung der Regeln nicht.
  const ohneUid = useMemo(
    () => users.filter((u) => !/^[A-Za-z0-9]{20,}$/.test(u.id || '')),
    [users],
  )

  // Die Firebase-UID wird zur DOKUMENT-ID. Nur so kann Firestore beim Schreiben
  // die Rolle pruefen (firestore.rules: users/$(request.auth.uid)). Ohne UID
  // vergibt Firestore eine Zufalls-ID, die Rollenpruefung laeuft ins Leere und
  // JEDER Angemeldete bekommt Schreibrechte auf alles - auch auf users selbst.
  async function anlegen() {
    if (!d.name.trim()) return
    const uid = (d.uid || '').trim()
    if (istOnline && !uid) { setFehler(t('einst.uidFehlt')); return }
    if (uid && users.some((u) => u.id === uid)) { setFehler(t('einst.uidDoppelt')); return }
    setFehler('')
    const { uid: _weg, ...felder } = d
    await withStore((s) => s.add('users', {
      ...felder,
      ...(uid ? { id: uid } : {}),
      stundensatzIntern: Number(d.stundensatzIntern) || 0,
    }))
    setD(leer)
    setNeu(false)
  }

  const satzVon = (u) => (u.qualifikation === 'helfer' ? (einst.regieHelfer ?? 31) : (einst.regieFacharbeiter ?? 35))

  return (
    <div className={karte}>
      {istOnline && ohneUid.length > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-feld px-4 py-3 text-sm">
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">{t('einst.ohneUidTitel', { n: ohneUid.length })}</p>
            <p className="mt-0.5">{t('einst.ohneUidText')}</p>
            <p className="mt-1 font-mono text-xs">{ohneUid.map((u) => u.name || u.email).join(' · ')}</p>
          </div>
        </div>
      )}
      {teams.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-schrift-zart">{t('einst.teamsImKalender')}</span>
          {teams.map((t) => (
            <span key={t.name} className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border border-rahmen">
              <span className="w-3 h-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: t.farbe }} />
              {t.name} <span className="text-schrift-zart">({t.mitglieder.length})</span>
            </span>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-left text-xs uppercase text-schrift-zart border-b border-rahmen">
            <th className="py-2 pr-3">{t('allg.name')}</th><th className="py-2 pr-3">{t('einst.emailLogin')}</th><th className="py-2 pr-3">{t('einst.rolle')}</th>
            <th className="py-2 pr-3"><FeldLabel info={HINWEIS.einstTeam}>{t('einst.team')}</FeldLabel></th><th className="py-2 pr-3">{t('einst.farbe')}</th>
            <th className="py-2 pr-3"><FeldLabel info={HINWEIS.einstQualifikation}>{t('einst.qualifikation')}</FeldLabel></th><th className="py-2 pr-3">{t('einst.regieSatz')}</th>
            <th className="py-2 pr-3"><FeldLabel info={HINWEIS.einstStundensatzIntern}>{t('einst.satzIntern')}</FeldLabel></th><th className="py-2 pr-3">{t('einst.aktiv')}</th><th></th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-rahmen">
                <td className="py-2 pr-3">
                  <input className={feld} defaultValue={u.name} onBlur={(e) => withStore((s) => s.update('users', u.id, { name: e.target.value }))} />
                </td>
                <td className="py-2 pr-3">
                  <input className={feld} defaultValue={u.email} onBlur={(e) => withStore((s) => s.update('users', u.id, { email: e.target.value }))} />
                </td>
                <td className="py-2 pr-3">
                  <select className={feld} defaultValue={u.rolle} onChange={(e) => withStore((s) => s.update('users', u.id, { rolle: e.target.value }))}>
                    <option value="admin">{t('einst.buero')}</option>
                    <option value="vorarbeiter">{t('einst.vorarbeiter')}</option>
                    <option value="mitarbeiter">{t('einst.monteur')}</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input className={`${feld} !w-32`} placeholder={t('einst.teamPlatz')} defaultValue={u.team || ''}
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
                    <option value="facharbeiter">{t('einst.facharbeiter')}</option>
                    <option value="helfer">{t('einst.helfer')}</option>
                  </select>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap font-semibold text-schrift">{satzVon(u)} €</td>
                <td className="py-2 pr-3">
                  <input type="number" className={`${feld} !w-24`} defaultValue={u.stundensatzIntern ?? 0}
                    onBlur={(e) => withStore((s) => s.update('users', u.id, { stundensatzIntern: Number(e.target.value) || 0 }))} />
                </td>
                <td className="py-2 pr-3">
                  <button onClick={() => withStore((s) => s.update('users', u.id, { aktiv: u.aktiv === false }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.aktiv !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gedeckt-tief text-schrift-zart'}`}>
                    {t(u.aktiv !== false ? 'einst.aktivKlein' : 'einst.inaktiv')}
                  </button>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => confirm(t('einst.loeschenFrage', { name: u.name })) && withStore((s) => s.remove('users', u.id))}
                    className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {neu ? (
        <div className="mt-4 bg-gedeckt rounded-karte p-4 grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {istOnline && (
            <label className="block sm:col-span-3 lg:col-span-6">
              <span className="block text-xs font-semibold text-schrift-leise mb-1">
                <FeldLabel info={HINWEIS.einstUid}>{t('einst.uid')}</FeldLabel>
              </span>
              <input className={`${feld} font-mono`} placeholder={t('einst.uidPlatz')}
                value={d.uid} onChange={(e) => setD({ ...d, uid: e.target.value })} />
            </label>
          )}
          <input className={feld} placeholder={t('allg.name')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <input className={feld} placeholder={t('allg.email')} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
          <select className={feld} value={d.rolle} onChange={(e) => setD({ ...d, rolle: e.target.value })}>
            <option value="mitarbeiter">{t('einst.monteur')}</option><option value="vorarbeiter">{t('einst.vorarbeiter')}</option><option value="admin">{t('einst.buero')}</option>
          </select>
          <input className={feld} placeholder={t('einst.teamPlatzLang')} value={d.team} onChange={(e) => setD({ ...d, team: e.target.value })} />
          <select className={feld} value={d.qualifikation} onChange={(e) => setD({ ...d, qualifikation: e.target.value })}>
            <option value="facharbeiter">{t('einst.facharbeiter')}</option><option value="helfer">{t('einst.helfer')}</option>
          </select>
          <div className="flex gap-2">
            <button onClick={anlegen} className="flex-1 px-3 py-2 rounded-feld bg-praxis-600 text-white text-sm font-bold">{t('einst.anlegen')}</button>
            <button onClick={() => setNeu(false)} className="px-3 py-2 rounded-feld bg-karte border border-rahmen text-sm">×</button>
          </div>
          {fehler && (
            <p className="sm:col-span-3 lg:col-span-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-feld px-3 py-2">
              {fehler}
            </p>
          )}
          <div className="sm:col-span-3 lg:col-span-6">
            <span className="text-xs font-semibold text-schrift-leise">{t('einst.teamFarbe')}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TEAM_FARBEN.map((f) => (
                <button key={f.id} type="button" title={f.label} onClick={() => setD({ ...d, farbe: f.wert })}
                  className={`w-8 h-8 rounded-full ${d.farbe === f.wert ? 'ring-2 ring-offset-2 ring-schrift-stark' : 'ring-1 ring-black/10'}`}
                  style={{ backgroundColor: f.wert }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setNeu(true)} className="mt-4 text-sm text-praxis-600 font-medium">{t('einst.mitarbeiterNeu')}</button>
      )}
      <p className="text-xs text-schrift-zart mt-3">
        {t('einst.mitarbeiterHinweis')}
      </p>
    </div>
  )
}

// ---------- Reiter: Artikel ----------
function Artikel() {
  useLang()
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
        <button onClick={vonFastbill} disabled={laeuft} className="px-3 py-2 rounded-feld bg-karte border border-rahmen text-sm font-medium disabled:opacity-50">{t('einst.ausFastbill')}</button>
        <button onClick={zuFastbill} disabled={laeuft} className="px-3 py-2 rounded-feld bg-karte border border-rahmen text-sm font-medium disabled:opacity-50">{t('einst.zuFastbill')}</button>
        <button onClick={() => setNeu(true)} className="px-3 py-2 rounded-feld bg-praxis-600 text-white text-sm font-bold">{t('einst.artikelNeu')}</button>
      </div>
      {meldung && (
        <p className={`mb-3 text-sm rounded-feld px-3 py-2 border ${meldung.art === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : meldung.art === 'fehler' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{meldung.text}</p>
      )}
      {neu && (
        <div className="mb-4 bg-gedeckt rounded-karte p-4 grid sm:grid-cols-6 gap-2">
          <input className={feld} placeholder={t('einst.code')} value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />
          <input className={`${feld} sm:col-span-2`} placeholder={t('allg.name')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <input className={feld} placeholder={t('allg.einheit')} value={d.einheit} onChange={(e) => setD({ ...d, einheit: e.target.value })} />
          <input type="number" step="0.1" className={feld} placeholder={t('einst.preisEuro')} value={d.preis} onChange={(e) => setD({ ...d, preis: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={anlegen} className="flex-1 px-3 py-2 rounded-feld bg-praxis-600 text-white text-sm font-bold">OK</button>
            <button onClick={() => setNeu(false)} className="px-3 py-2 rounded-feld bg-karte border border-rahmen text-sm">×</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-xs uppercase text-schrift-zart border-b border-rahmen">
            <th className="py-2 pr-3">{t('einst.code')}</th><th className="py-2 pr-3">{t('allg.name')}</th><th className="py-2 pr-3">{t('allg.einheit')}</th>
            <th className="py-2 pr-3 text-right">{t('einst.preis')}</th><th className="py-2 pr-3 text-right"><FeldLabel info={HINWEIS.einstEkPreis}>{t('einst.ek')}</FeldLabel></th><th className="py-2 pr-3">{t('einst.kategorie')}</th><th className="py-2 pr-3">FastBill</th><th></th>
          </tr></thead>
          <tbody>
            {katalog.map((a) => (
              <tr key={a.id} className="border-b border-rahmen">
                <td className="py-1.5 pr-3 text-schrift-zart">{a.code}</td>
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
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${a.fastbillArticleId ? 'bg-emerald-100 text-emerald-700' : 'bg-gedeckt-tief text-schrift-zart'}`}>
                    {a.fastbillArticleId ? t('einst.verknuepft') : '—'}
                  </span>
                </td>
                <td className="py-1.5 text-right">
                  <button onClick={() => confirm(t('einst.loeschenFrage', { name: a.name })) && withStore((s) => s.remove('katalog', a.id))}
                    className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-schrift-zart mt-3">{t('einst.artikelHinweis')}</p>
    </div>
  )
}

// ---------- Reiter: Textbausteine ----------
function Bausteine() {
  useLang()
  const bausteine = useCollection('bausteine')
  const [neu, setNeu] = useState(false)
  const [d, setD] = useState({ titel: '', text: '' })

  return (
    <div className={karte}>
      {bausteine.map((b) => (
        <div key={b.id} className="mb-3 bg-gedeckt rounded-karte p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <input className={`${feld} font-semibold`} defaultValue={b.titel} onBlur={(e) => withStore((s) => s.update('bausteine', b.id, { titel: e.target.value }))} />
            <button onClick={() => confirm(t('einst.bausteinLoeschen')) && withStore((s) => s.remove('bausteine', b.id))}
              className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
          <textarea rows={2} className={feld} defaultValue={b.text} onBlur={(e) => withStore((s) => s.update('bausteine', b.id, { text: e.target.value }))} />
        </div>
      ))}
      {neu ? (
        <div className="bg-gedeckt rounded-karte p-3 space-y-2">
          <input className={feld} placeholder={t('termine.titelSpalte')} value={d.titel} onChange={(e) => setD({ ...d, titel: e.target.value })} />
          <textarea rows={2} className={feld} placeholder={t('einst.text')} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={async () => { if (d.titel.trim()) { await withStore((s) => s.add('bausteine', d)); setD({ titel: '', text: '' }); setNeu(false) } }}
              className="px-3 py-2 rounded-feld bg-praxis-600 text-white text-sm font-bold">{t('einst.anlegen')}</button>
            <button onClick={() => setNeu(false)} className="px-3 py-2 rounded-feld bg-karte border border-rahmen text-sm">{t('allg.abbrechen')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setNeu(true)} className="text-sm text-praxis-600 font-medium">{t('einst.bausteinNeu')}</button>
      )}
    </div>
  )
}

// ---------- Reiter: Sätze ----------
function Saetze() {
  useLang()
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
        <div><label className={label}><FeldLabel info={HINWEIS.einstRegieSaetze}>{t('einst.satzFacharbeiter')}</FeldLabel></label><input type="number" step="0.5" className={feld} value={werte.regieFacharbeiter ?? 35} onChange={set('regieFacharbeiter')} /></div>
        <div><label className={label}>{t('einst.satzHelfer')}</label><input type="number" step="0.5" className={feld} value={werte.regieHelfer ?? 31} onChange={set('regieHelfer')} /></div>
        <div><label className={label}><FeldLabel info={HINWEIS.einstKmSatz}>{t('einst.satzKm')}</FeldLabel></label><input type="number" step="0.05" className={feld} value={werte.kmSatz ?? 0.5} onChange={set('kmSatz')} /></div>
      </div>
      <p className="text-xs text-schrift-zart mt-3">{t('einst.saetzeHinweis')}</p>

      {/* Fuhrpark.
          Vorher wurde das Kennzeichen im Regiebericht frei getippt – und lief in
          drei Schreibweisen auseinander ("AIC GB 12", "AIC-GB12", "aic-gb 12").
          Eine Auswertung je Fahrzeug war damit unmöglich. Jetzt wird hier
          gepflegt und dort ausgewählt. */}
      <div className="border-t border-rahmen mt-6 pt-5">
        <p className="text-sm font-bold text-schrift-stark mb-1">{t('einst.fuhrpark')}</p>
        <p className="text-xs text-schrift-zart mb-3">{t('einst.fuhrparkHinweis')}</p>
        <div className="space-y-2 max-w-xl">
          {(werte.fahrzeuge || []).map((fz, i) => (
            <div key={fz.id || i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${feld} !w-40 uppercase`}
                value={fz.kennzeichen || ''}
                placeholder="AIC-GB 123"
                onChange={(e) => {
                  setOk(false)
                  setD({
                    ...werte,
                    fahrzeuge: (werte.fahrzeuge || []).map((x, j) => (j === i ? { ...x, kennzeichen: e.target.value.toUpperCase() } : x)),
                  })
                }}
              />
              <input
                className={`${feld} flex-1 min-w-40`}
                value={fz.bezeichnung || ''}
                placeholder={t('einst.fahrzeugBezeichnungPlatz')}
                onChange={(e) => {
                  setOk(false)
                  setD({
                    ...werte,
                    fahrzeuge: (werte.fahrzeuge || []).map((x, j) => (j === i ? { ...x, bezeichnung: e.target.value } : x)),
                  })
                }}
              />
              <button
                onClick={() => { setOk(false); setD({ ...werte, fahrzeuge: (werte.fahrzeuge || []).filter((_, j) => j !== i) }) }}
                className="px-3 min-h-11 rounded-feld text-sm font-bold text-rot hover:bg-gedeckt"
              >
                {t('allg.entfernen')}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            setOk(false)
            setD({
              ...werte,
              fahrzeuge: [...(werte.fahrzeuge || []), { id: `fz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kennzeichen: '', bezeichnung: '' }],
            })
          }}
          className="mt-3 px-4 min-h-11 rounded-feld border border-rahmen bg-karte text-sm font-semibold text-schrift hover:bg-gedeckt"
        >
          + {t('einst.fahrzeugHinzu')}
        </button>
      </div>

      <div className="mt-4">
        <SpeichernKnopf gespeichert={ok} onClick={async () => {
          await speichereSetting('global', {
            ...einst, regieFacharbeiter: Number(werte.regieFacharbeiter) || 35,
            regieHelfer: Number(werte.regieHelfer) || 31, kmSatz: Number(werte.kmSatz) || 0.5,
            // Leere Zeilen fallen beim Speichern weg – sonst steht im Bericht
            // ein namenloses Fahrzeug zur Auswahl.
            fahrzeuge: (werte.fahrzeuge || [])
              .filter((fz) => String(fz.kennzeichen || '').trim())
              .map((fz) => ({
                id: fz.id,
                kennzeichen: String(fz.kennzeichen).trim().toUpperCase(),
                bezeichnung: String(fz.bezeichnung || '').trim(),
              })),
          }, Boolean(global))
          setOk(true)
        }} />
      </div>
    </div>
  )
}

// ---------- Reiter: Arbeitszeiten ----------
function Arbeitszeiten() {
  useLang()
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
        <p className="text-sm font-bold text-schrift mb-3">{t('einst.zeitenTitel')}</p>
        {[1, 2, 3, 4, 5, 6].map((tag) => {
          const f = fenster[tag]?.[0]
          return (
            <div key={tag} className="flex items-center gap-3 mb-2">
              <label className="w-10 text-sm font-semibold">{wochentag(tag)}</label>
              <input type="checkbox" checked={Boolean(f)} onChange={(e) => setzeFenster(tag, f?.von, f?.bis, e.target.checked)} />
              {f && (
                <>
                  <input type="time" className={`${feld} !w-32`} defaultValue={f.von}
                    onBlur={(e) => setzeFenster(tag, e.target.value, f.bis, true)} />
                  <span className="text-schrift-zart">–</span>
                  <input type="time" className={`${feld} !w-32`} defaultValue={f.bis}
                    onBlur={(e) => setzeFenster(tag, f.von, e.target.value, true)} />
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className={karte}>
        <p className="text-sm font-bold text-schrift mb-3">{t('einst.urlaub')}</p>
        {urlaub.map((u, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input type="date" className={`${feld} !w-40`} defaultValue={u.von}
              onBlur={(e) => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: urlaub.map((x, j) => j === i ? { ...x, von: e.target.value } : x) }, Boolean(oeff))} />
            <span className="text-schrift-zart">–</span>
            <input type="date" className={`${feld} !w-40`} defaultValue={u.bis}
              onBlur={(e) => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: urlaub.map((x, j) => j === i ? { ...x, bis: e.target.value } : x) }, Boolean(oeff))} />
            <button onClick={() => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: urlaub.filter((_, j) => j !== i) }, Boolean(oeff))}
              className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
        ))}
        <button onClick={() => speichereSetting('oeffnungszeiten', { fenster, telefon: oeff?.telefon || [], urlaub: [...urlaub, { von: '', bis: '' }] }, Boolean(oeff))}
          className="text-sm text-praxis-600 font-medium">{t('einst.zeitraumNeu')}</button>
      </div>

      <div className={karte}>
        <p className="text-sm font-bold text-schrift mb-3">{t('einst.pausen')}</p>
        {pausen.map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select className={`${feld} !w-24`} defaultValue={p.tag}
              onChange={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, tag: Number(e.target.value) } : x) }, Boolean(pausenDoc))}>
              {[1, 2, 3, 4, 5, 6].map((tg) => <option key={tg} value={tg}>{wochentag(tg)}</option>)}
            </select>
            <input type="time" className={`${feld} !w-28`} defaultValue={p.von}
              onBlur={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, von: e.target.value } : x) }, Boolean(pausenDoc))} />
            <span className="text-schrift-zart">–</span>
            <input type="time" className={`${feld} !w-28`} defaultValue={p.bis}
              onBlur={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, bis: e.target.value } : x) }, Boolean(pausenDoc))} />
            <input className={feld} placeholder={t('einst.grund')} defaultValue={p.grund}
              onBlur={(e) => speichereSetting('pausen', { eintraege: pausen.map((x, j) => j === i ? { ...x, grund: e.target.value } : x) }, Boolean(pausenDoc))} />
            <button onClick={() => speichereSetting('pausen', { eintraege: pausen.filter((_, j) => j !== i) }, Boolean(pausenDoc))}
              className="text-schrift-zart hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
        ))}
        <button onClick={() => speichereSetting('pausen', { eintraege: [...pausen, { tag: 1, von: '12:00', bis: '12:30', grund: 'Pause' }] }, Boolean(pausenDoc))}
          className="text-sm text-praxis-600 font-medium">{t('einst.pauseNeu')}</button>
      </div>
      {ok && <p className="text-xs text-emerald-600">{t('allg.gespeichert')}</p>}
    </div>
  )
}

// ---------- Reiter: FastBill ----------
function FastBill() {
  useLang()
  // Zugangsdaten liegen in einer EIGENEN Sammlung, nicht in settings – settings
  // wird von der ganzen Verwaltung als Liste gelesen und darf deshalb nichts
  // Geheimes enthalten (siehe firestore.rules).
  const integrationen = useCollection('integrationen')
  const apilog = useCollection('apilog')
  const integ = integrationen.find((i) => i.id === 'fastbill')
  const [d, setD] = useState(null)
  const [zeigeKey, setZeigeKey] = useState(false)
  const [zeigeProxy, setZeigeProxy] = useState(false)
  const [test, setTest] = useState(null)
  const [testet, setTestet] = useState(false)
  const [ok, setOk] = useState(false)
  const [fehler, setFehler] = useState('')
  const werte = d || { fastbillEmail: integ?.fastbillEmail || '', fastbillApiKey: integ?.fastbillApiKey || '', proxyUrl: integ?.proxyUrl || '' }

  async function speichern() {
    setFehler('')
    try {
      // add() mit mitgegebener id ist ein Upsert (setDoc, shared/store.js:313-315)
      // und legt das Dokument an, falls es fehlt. update() waere hier FALSCH:
      // updateDoc scheitert bei nicht vorhandenem Dokument, und genau das ist
      // der Normalfall bei der Ersteinrichtung und nach "Alle Daten loeschen".
      // Ein Ueberbuegeln droht nicht: werte traegt immer alle drei Felder,
      // weil es aus dem Live-Stand zusammengesetzt wird.
      await withStore((s) => s.add('integrationen', { id: 'fastbill', ...werte }))
      setD(null)
      setOk(true)
      return true
    } catch (e) {
      // Früher lief dieser Fehler still in die Konsole: die Felder zeigten
      // weiter die eingetippten Werte, gespeichert war aber nichts.
      setFehler(e?.message || String(e))
      setOk(false)
      return false
    }
  }

  async function testen() {
    setTestet(true)
    setTest(null)
    // Der Test liest den Zugang aus der Datenbank, nicht aus dem Formular.
    // Ohne vorheriges Speichern prüfte er also den ALTEN Stand – bei der
    // Ersteinrichtung einen leeren – und meldete "kein Zugang hinterlegt",
    // obwohl alles sichtbar in den Feldern stand. Deshalb: erst sichern.
    if (d && !(await speichern())) { setTestet(false); return }
    const erg = await pruefeVerbindung()
    setTest(erg)
    setTestet(false)
  }

  const logSortiert = [...apilog].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20)

  return (
    <div className="space-y-4">
      <div className={karte}>
        <p className="text-sm font-bold text-schrift mb-3">{t('einst.fbZugang')}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={label}>{t('einst.fbEmail')}</label>
            <input className={feld} value={werte.fastbillEmail} onChange={(e) => { setOk(false); setFehler(''); setD({ ...werte, fastbillEmail: e.target.value }) }} placeholder={t('einst.fbEmailPlatz')} /></div>
          <div><label className={label}>{t('einst.fbKey')}</label>
            <div className="flex gap-2">
              <input type={zeigeKey ? 'text' : 'password'} className={feld} value={werte.fastbillApiKey}
                onChange={(e) => { setOk(false); setFehler(''); setD({ ...werte, fastbillApiKey: e.target.value }) }} placeholder={t('einst.fbKeyPlatz')} />
              <button onClick={() => setZeigeKey(!zeigeKey)} className="px-3 rounded-feld bg-gedeckt-tief text-xs">{t(zeigeKey ? 'einst.verbergen' : 'einst.zeigen')}</button>
            </div></div>
          <div className="sm:col-span-2"><label className={label}>{t('einst.fbProxy')}</label>
            {/* Die Adresse traegt das Proxy-Secret. Deshalb genauso verdeckt wie
                der API-Key – sonst steht es bei jedem Blick auf den Bildschirm
                und auf jedem Bildschirmfoto offen da. */}
            <div className="flex gap-2">
              <input type={zeigeProxy ? 'text' : 'password'} className={feld} value={werte.proxyUrl}
                onChange={(e) => { setOk(false); setFehler(''); setD({ ...werte, proxyUrl: e.target.value }) }}
                placeholder={t('einst.fbProxyPlatz')} />
              <button onClick={() => setZeigeProxy(!zeigeProxy)} className="px-3 rounded-feld bg-gedeckt-tief text-xs shrink-0">
                {t(zeigeProxy ? 'einst.verbergen' : 'einst.zeigen')}
              </button>
            </div>
            {werte.proxyUrl && !/^(https?:\/\/|\/)/i.test(werte.proxyUrl.trim()) && (
              <p className="mt-1 text-xs text-red-600">
                {t('einst.fbProxyFehler')}
              </p>
            )}
            {/* Im Dev übernimmt der eingebaute Vite-Proxy. In der ausgelieferten
                App gibt es ihn nicht – dort ist die Adresse Pflicht. */}
            {!import.meta.env.DEV && !werte.proxyUrl.trim() && (
              <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-feld p-2">
                {t('einst.fbProxyNoetig')}
              </p>
            )}</div>
        </div>
        <p className="text-xs text-schrift-zart mt-2">
          {t('einst.fbEnvHinweis')} <code>admin/.env.local</code> (VITE_FASTBILL_EMAIL / VITE_FASTBILL_API_KEY)
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={speichern} className="px-4 py-2.5 rounded-feld bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700">
            {t(ok && !d ? 'allg.gespeichert' : 'allg.speichern')}
          </button>
          <button onClick={testen} disabled={testet} className="px-4 py-2.5 rounded-feld bg-karte border border-rahmen text-sm font-medium disabled:opacity-50">
            {t(testet ? 'einst.fbTestet' : 'einst.fbTesten')}
          </button>
          {/* Ein abgelehnter Schreibvorgang (fehlende Rechte, kein Netz) lief
              frueher unsichtbar ins Leere - beim Einrichten fatal. */}
          {fehler && (
            <span className="text-sm px-3 py-1.5 rounded-feld border bg-red-50 border-red-200 text-red-700">
              {t('einst.fbSpeichernFehler')} {fehler}
            </span>
          )}
          {test && (
            <span className={`text-sm px-3 py-1.5 rounded-feld border ${
              test.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : test.simuliert ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {test.ok ? t('einst.fbVerbunden', { n: test.anzahl }) : test.simuliert ? t('einst.fbSimuliert') : t('einst.fbFehler', { text: test.fehler })}
            </span>
          )}
        </div>
      </div>

      <div className={karte}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-schrift">{t('einst.protokoll')}</p>
          <button onClick={async () => { if (confirm(t('einst.protokollFrage'))) await withStore(async (s) => { for (const e of apilog) await s.remove('apilog', e.id) }) }}
            className="text-xs text-schrift-zart hover:text-red-500">{t('einst.protokollLeeren')}</button>
        </div>
        {logSortiert.length === 0 ? <p className="text-sm text-schrift-zart">{t('einst.keineAufrufe')}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-schrift-zart border-b border-rahmen">
              <th className="py-1.5 pr-3">{t('einst.zeit')}</th><th className="py-1.5 pr-3">{t('einst.service')}</th><th className="py-1.5 pr-3">{t('allg.status')}</th><th className="py-1.5">{t('einst.fehler')}</th>
            </tr></thead>
            <tbody>
              {logSortiert.map((e) => (
                <tr key={e.id} className="border-b border-rahmen">
                  <td className="py-1.5 pr-3 text-schrift-zart">{new Date(e.createdAt).toLocaleString('de-DE')}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{e.service}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
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
function Daten({ user }) {
  useLang()
  const modus = storeModus()
  const online = modus === 'firebase'
  const [laeuft, setLaeuft] = useState('')
  const [meldung, setMeldung] = useState('')

  // Im Online-Modus trifft dieser Knopf ECHTE Daten. Deshalb eine eigene,
  // deutlichere Rückfrage und ein sichtbarer Fortschritt – der Vorgang läuft
  // in Blöcken und kann bei vollem Bestand einige Sekunden dauern.
  // Beide Vorgaenge laufen ueber denselben Weg – der Unterschied ist nur, ob
  // danach Beispieldaten geschrieben werden. Getrennte Knoepfe, weil es zwei
  // grundverschiedene Absichten sind: vorfuehren gegenueber scharf schalten.
  async function ausfuehren(mitDemodaten) {
    if (mitDemodaten) {
      if (!confirm(t(online ? 'einst.demoResetFrageOnline' : 'einst.demoResetFrage'))) return
    } else {
      // Loeschen ohne Neuanlage ist unwiderruflich -> hoehere Huerde:
      // erst eine deutliche Rueckfrage, dann ein getipptes Wort. Ein
      // versehentlicher Doppelklick darf den Betrieb nicht ausloeschen.
      if (!confirm(t('einst.datenLeerenFrage'))) return
      const wort = t('einst.datenLeerenWort')
      const eingabe = prompt(t('einst.datenLeerenFrage2'), '')
      if ((eingabe || '').trim().toUpperCase() !== wort) {
        setMeldung(t('einst.datenLeerAbbruch'))
        return
      }
    }
    setMeldung('')
    setLaeuft(t('allg.laedt'))
    try {
      const erg = await withStore((s) => s.resetDemo({
        mitDemodaten,
        melde: ({ schritt, fertig, gesamt }) =>
          setLaeuft(t('einst.demoLaeuft', { schritt, fertig, gesamt })),
        // Das eigene Konto überlebt beide Vorgänge – sonst sperrt man sich aus
        behalteNutzer: online && user?.userId
          ? { uid: user.userId, name: user.name, email: user.email }
          : null,
      }))
      setMeldung(mitDemodaten
        ? t('einst.demoFertig', { geloescht: erg?.geloescht ?? 0, geschrieben: erg?.geschrieben ?? 0 })
        : t('einst.datenLeerFertig', { geloescht: erg?.geloescht ?? 0 }))
      setLaeuft('')
      setTimeout(() => location.reload(), 1200)
    } catch (e) {
      setLaeuft('')
      setMeldung(e.message)
    }
  }
  return (
    <div className="space-y-4">
      <div className={karte}>
        <p className="text-sm mb-2">
          {t('einst.datenhaltung')}{' '}
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${modus === 'firebase' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {t(modus === 'firebase' ? 'einst.online' : 'einst.lokal')}
          </span>
        </p>
        <p className="text-xs text-schrift-zart">{t('einst.datenHinweis')}</p>
      </div>

      <div className={karte}>
        <p className="text-sm font-bold text-schrift-stark mb-1">{t('einst.datenDemoTitel')}</p>
        <p className="text-xs text-schrift-leise mb-3">{t('einst.datenDemoText')}</p>
        <button
          onClick={() => ausfuehren(true)}
          disabled={Boolean(laeuft)}
          className="px-4 py-2.5 rounded-feld bg-karte border border-rahmen text-schrift text-sm font-bold hover:bg-gedeckt disabled:opacity-50"
        >
          {t(online ? 'einst.demoResetOnline' : 'einst.demoReset')}
        </button>
      </div>

      <div className={`${karte} border-red-200`}>
        <p className="text-sm font-bold text-red-700 mb-1">{t('einst.datenLeerenTitel')}</p>
        <p className="text-xs text-schrift-leise mb-3">{t('einst.datenLeerenText')}</p>
        <button
          onClick={() => ausfuehren(false)}
          disabled={Boolean(laeuft)}
          className="px-4 py-2.5 rounded-feld bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
        >
          {t('einst.datenLeeren')}
        </button>
      </div>

      <p className="text-xs text-schrift-zart">{t('einst.datenBleibt')}</p>
      {laeuft && <p className="text-sm text-schrift">{laeuft}</p>}
      {meldung && <p className="text-sm text-schrift">{meldung}</p>}
    </div>
  )
}

export default function Einstellungen({ user }) {
  useLang()
  const [reiter, setReiter] = useState('firma')
  return (
    <div className={S.SEITE_SCHMAL}>
      <Seitenkopf icon="zahnrad" titel={t('einst.titel')} sub={t('einst.sub')} />
      <ChipReihe
        aktiv={reiter}
        onWahl={setReiter}
        chips={REITER.map((r) => ({ id: r.id, label: r.id === 'fastbill' ? 'FastBill' : t(r.schluessel), icon: r.icon }))}
      />
      {reiter === 'firma' && <Firmendaten />}
      {reiter === 'mitarbeiter' && <Mitarbeiter />}
      {reiter === 'artikel' && <Artikel />}
      {reiter === 'bausteine' && <Bausteine />}
      {reiter === 'saetze' && <Saetze />}
      {reiter === 'zeiten' && <Arbeitszeiten />}
      {reiter === 'fastbill' && <FastBill />}
      {reiter === 'daten' && <Daten user={user} />}
    </div>
  )
}
