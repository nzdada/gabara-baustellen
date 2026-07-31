import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { berechneRoute } from '@shared/route.js'
import { euro } from '@shared/format.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'

// Spesen-Erfassung: Hotel/Übernachtung, Fahrtkosten (mit automatischem
// Km-Rechner via OpenStreetMap/OSRM – nur klick-getriggert, Fallback manuell).

async function komprimiere(file, maxKante = 1200, qualitaet = 0.72) {
  const bitmap = await createImageBitmap(file)
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * faktor)
  canvas.height = Math.round(bitmap.height * faktor)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', qualitaet)
}

export default function SpesenForm({ projektId = '', spesen = null, user, onClose }) {
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const einst = useEinstellungen()
  const belegRef = useRef(null)

  const [daten, setDaten] = useState(() => ({
    projektId: spesen?.projektId || projektId || '',
    typ: spesen?.typ || 'fahrt',
    datum: spesen?.datum || new Date().toISOString().slice(0, 10),
    mitarbeiterId: spesen?.mitarbeiterId || user?.userId || '',
    kommentar: spesen?.kommentar || '',
    betrag: spesen?.betrag ?? '',
    von: spesen?.fahrt?.von || einst.praxisAnschrift || '',
    bis: spesen?.fahrt?.bis || '',
    km: spesen?.fahrt?.km ?? '',
    kmSatz: spesen?.fahrt?.kmSatz ?? (einst.kmSatz || 0.5),
    automatisch: spesen?.fahrt?.automatisch || false,
    belegFotoId: spesen?.belegFotoId || '',
  }))
  const [rechnet, setRechnet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [belegVorschau, setBelegVorschau] = useState('')

  const projekt = projekte.find((p) => p.id === daten.projektId)
  const set = (feld) => (e) => setDaten((d) => ({ ...d, [feld]: e.target.value }))

  function projektGewaehlt(e) {
    const id = e.target.value
    const p = projekte.find((x) => x.id === id)
    setDaten((d) => ({
      ...d, projektId: id,
      bis: d.bis || (p ? `${p.anschrift?.strasse || ''}, ${p.anschrift?.plzOrt || ''}` : ''),
    }))
  }

  async function kmBerechnen() {
    setFehler('')
    setRechnet(true)
    try {
      const r = await berechneRoute(daten.von, daten.bis)
      setDaten((d) => ({
        ...d, km: r.km, automatisch: true,
        betrag: Math.round(r.km * (Number(d.kmSatz) || 0) * 100) / 100,
      }))
    } catch (e) {
      setFehler(`${e.message} – Kilometer bitte manuell eintragen.`)
    } finally {
      setRechnet(false)
    }
  }

  async function belegHinzu(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (!datei) return
    try {
      const dataUrl = await komprimiere(datei)
      if (dataUrl.length > 950000) { setFehler('Beleg-Foto zu groß.'); return }
      const id = crypto.randomUUID ? crypto.randomUUID() : `ph-${Date.now()}`
      await withStore((s) => s.add('photos', {
        id, projektId: daten.projektId, berichtId: '', terminId: '',
        phase: 'beleg', dataUrl, name: datei.name, von: user?.name || '', createdAt: Date.now(),
      }))
      setDaten((d) => ({ ...d, belegFotoId: id }))
      setBelegVorschau(dataUrl)
    } catch (err) {
      setFehler('Beleg konnte nicht verarbeitet werden.')
    }
  }

  async function speichern(status) {
    if (!daten.projektId) { setFehler('Bitte ein Projekt wählen.'); return }
    const betrag = daten.typ === 'fahrt'
      ? Math.round((Number(daten.km) || 0) * (Number(daten.kmSatz) || 0) * 100) / 100
      : Number(daten.betrag) || 0
    if (betrag <= 0) { setFehler('Betrag bzw. Kilometer fehlen.'); return }
    const mitarbeiter = users.find((u) => u.id === daten.mitarbeiterId)
    try {
    await withStore((s) => s.add('spesen', {
      id: spesen?.id || (crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`),
      projektId: daten.projektId, mitarbeiterId: daten.mitarbeiterId,
      mitarbeiterName: mitarbeiter?.name || user?.name || '',
      typ: daten.typ, datum: daten.datum, betrag,
      belegFotoId: daten.belegFotoId, kommentar: daten.kommentar,
      fahrt: daten.typ === 'fahrt'
        ? { von: daten.von, bis: daten.bis, km: Number(daten.km) || 0, kmSatz: Number(daten.kmSatz) || 0, automatisch: daten.automatisch }
        : null,
      status, createdAt: spesen?.createdAt || Date.now(),
    }))
    onClose()
    } catch (e) {
      setFehler(e.message)
    }
  }

  const feld = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
  const label = 'block text-xs font-semibold text-slate-500 mb-1'

  return (
    <Modal titel={spesen ? 'Spesen bearbeiten' : 'Spesen erfassen'} onClose={onClose} breite="max-w-xl">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Projekt *</label>
            <select className={feld} value={daten.projektId} onChange={projektGewaehlt}>
              <option value="">– wählen –</option>
              {projekte.map((p) => <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Typ</label>
            <select className={feld} value={daten.typ} onChange={set('typ')}>
              <option value="fahrt">Fahrt (Km-Abrechnung)</option>
              <option value="hotel">Hotel / Übernachtung</option>
              <option value="sonstig">Sonstige Spesen</option>
            </select>
          </div>
          <div>
            <label className={label}>Datum</label>
            <input type="date" className={feld} value={daten.datum} onChange={set('datum')} />
          </div>
          <div>
            <label className={label}>Mitarbeiter</label>
            <select className={feld} value={daten.mitarbeiterId} onChange={set('mitarbeiterId')}>
              <option value="">– wählen –</option>
              {users.filter((u) => u.aktiv !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        {daten.typ === 'fahrt' ? (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div>
              <label className={label}>Von (Start)</label>
              <input type="text" className={feld} value={daten.von} onChange={set('von')} placeholder="z. B. Münchener Str. 21, 86551 Aichach" />
            </div>
            <div>
              <label className={label}>Bis (Ziel)</label>
              <input type="text" className={feld} value={daten.bis} onChange={set('bis')} placeholder="Baustellen-Adresse" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button onClick={kmBerechnen} disabled={rechnet}
                className="px-4 py-2.5 rounded-xl bg-praxis-600 text-white text-sm font-medium disabled:opacity-50">
                {rechnet ? 'Berechne Route …' : 'Km automatisch berechnen'}
              </button>
              <div>
                <label className={label}>Kilometer</label>
                <input type="number" step="0.1" min="0" className={`${feld} !w-28`} value={daten.km}
                  onChange={(e) => setDaten((d) => ({ ...d, km: e.target.value, automatisch: false }))} />
              </div>
              <div>
                <label className={label}>€/km</label>
                <input type="number" step="0.05" min="0" className={`${feld} !w-24`} value={daten.kmSatz} onChange={set('kmSatz')} />
              </div>
              <p className="text-sm font-bold pb-2.5">= {euro((Number(daten.km) || 0) * (Number(daten.kmSatz) || 0))}</p>
            </div>
            {daten.automatisch && <p className="text-xs text-emerald-600">Kilometer automatisch über OpenStreetMap/OSRM berechnet.</p>}
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={label}>Betrag (€) *</label>
              <input type="number" step="0.01" min="0" className={feld} value={daten.betrag} onChange={set('betrag')} />
            </div>
            <div>
              <button onClick={() => belegRef.current?.click()} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium flex items-center gap-2">
                <Icon name="foto" className="w-4 h-4" /> Beleg-Foto
              </button>
              <input ref={belegRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={belegHinzu} />
            </div>
          </div>
        )}

        {(belegVorschau || daten.belegFotoId) && daten.typ !== 'fahrt' && (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5" /> Beleg-Foto gespeichert</p>
        )}

        <div>
          <label className={label}>Kommentar</label>
          <input type="text" className={feld} value={daten.kommentar} onChange={set('kommentar')} placeholder="z. B. Übernachtung Montagewoche" />
        </div>

        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100">Abbrechen</button>
          <button onClick={() => speichern('entwurf')} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">Entwurf</button>
          <button onClick={() => speichern('eingereicht')} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-praxis-600 text-white hover:bg-praxis-700">Einreichen</button>
        </div>
      </div>
    </Modal>
  )
}
