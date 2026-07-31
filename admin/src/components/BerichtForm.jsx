import { useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { UnterschriftFeld, unterschriftAlsDataUrl } from '@shared/unterschrift.jsx'
import { euro } from '@shared/format.js'
import { useCollection, useWhere, useEinstellungen, withStore } from '../hooks.js'

// Manuelle Erfassung von Regiebericht / Reklamation / Abnahme im Büro
// (Übergang, bis die Flutter-Mitarbeiter-App live ist – und für Papier-Berichte).
// Pflichtfoto-Gate: Einreichen erst mit >= 1 Vorher- UND >= 1 Nachher-Foto;
// Abnahme zusätzlich nur mit Kundenunterschrift + Name.

const TITEL = { regie: 'Regiebericht', reklamation: 'Reklamation / Schadensprotokoll', abnahme: 'Abnahmeprotokoll' }
const PHASEN = [
  { id: 'vorher', label: 'Vorher' },
  { id: 'nachher', label: 'Nachher' },
  { id: 'beleg', label: 'Beleg' },
]

function heuteIso() {
  return new Date().toISOString().slice(0, 10)
}

async function komprimiere(file, maxKante = 1200, qualitaet = 0.72) {
  const bitmap = await createImageBitmap(file)
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * faktor)
  canvas.height = Math.round(bitmap.height * faktor)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', qualitaet)
}

export default function BerichtForm({ typ, projektId = '', bericht = null, user, onClose }) {
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const katalog = useCollection('katalog')
  const einst = useEinstellungen()

  const draftId = useRef(bericht?.id || (crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`))
  const docAngelegt = useRef(Boolean(bericht))
  const fotos = useWhere('photos', 'berichtId', draftId.current)

  const [daten, setDaten] = useState(() => ({
    projektId: bericht?.projektId || projektId || '',
    datum: bericht?.datum || heuteIso(),
    mitarbeiterId: bericht?.mitarbeiterId || user?.userId || '',
    beschreibung: bericht?.beschreibung || '',
    ursache: bericht?.ursache || '',
    massnahme: bericht?.massnahme || '',
    ohneMaengel: bericht?.ohneMaengel ?? true,
    maengel: bericht?.maengel || [],
    ort: bericht?.ort || '',
    unterschriftName: bericht?.unterschriftName || '',
    stunden: bericht?.stunden || (typ === 'regie' ? [{ art: 'facharbeiter', anzahl: 1, satz: einst.regieFacharbeiter || 35 }] : []),
    material: bericht?.material || [],
  }))
  const [unterschriftCanvas, setUnterschriftCanvas] = useState(null)
  const [alteUnterschrift, setAlteUnterschrift] = useState(bericht?.unterschriftKunde || '')
  const [fehler, setFehler] = useState('')
  const [ladeFoto, setLadeFoto] = useState(false)
  const [fotoPhase, setFotoPhase] = useState('vorher')
  const kameraRef = useRef(null)
  const dateiRef = useRef(null)

  const projekt = projekte.find((p) => p.id === daten.projektId)
  const mitarbeiter = users.find((u) => u.id === daten.mitarbeiterId)
  const set = (feld) => (e) => setDaten((d) => ({ ...d, [feld]: e.target.value }))

  const stundenSumme = daten.stunden.reduce((s, z) => s + (Number(z.anzahl) || 0) * (Number(z.satz) || 0), 0)
  const materialSumme = daten.material.reduce((s, z) => s + (Number(z.menge) || 0) * (Number(z.preis) || 0), 0)

  const fotosVorher = fotos.filter((f) => f.phase === 'vorher').length
  const fotosNachher = fotos.filter((f) => f.phase === 'nachher').length
  const unterschriftDa = Boolean(unterschriftCanvas || alteUnterschrift)
  const fotoGateOk = fotosVorher >= 1 && fotosNachher >= 1
  const abnahmeOk = typ !== 'abnahme' || (unterschriftDa && daten.unterschriftName.trim())
  const einreichenOk = daten.projektId && daten.beschreibung.trim() && fotoGateOk && abnahmeOk

  function gateHinweis() {
    const teile = []
    if (!daten.projektId) teile.push('Projekt wählen')
    if (!daten.beschreibung.trim()) teile.push('Beschreibung ausfüllen')
    if (fotosVorher < 1) teile.push('mind. 1 Vorher-Foto')
    if (fotosNachher < 1) teile.push('mind. 1 Nachher-Foto')
    if (typ === 'abnahme' && !unterschriftDa) teile.push('Kundenunterschrift')
    if (typ === 'abnahme' && !daten.unterschriftName.trim()) teile.push('Name des Unterzeichners')
    return teile.join(' · ')
  }

  async function stelleDocSicher() {
    if (docAngelegt.current) return
    docAngelegt.current = true
    await withStore((s) => s.add('berichte', {
      id: draftId.current, typ,
      projektId: daten.projektId, terminId: bericht?.terminId || '',
      mitarbeiterId: daten.mitarbeiterId, mitarbeiterName: mitarbeiter?.name || user?.name || '',
      datum: daten.datum, status: 'entwurf', beschreibung: daten.beschreibung,
      createdAt: Date.now(), eingereichtAm: 0,
    }))
  }

  async function fotoHinzu(e) {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    if (!daten.projektId) { setFehler('Bitte zuerst ein Projekt wählen – dann Fotos aufnehmen.'); return }
    setFehler('')
    setLadeFoto(true)
    try {
      for (const datei of dateien) {
        if (!datei.type.startsWith('image/')) { setFehler(`${datei.name} ist kein Bild.`); continue }
        const dataUrl = await komprimiere(datei)
        if (dataUrl.length > 950000) { setFehler('Bild ist auch komprimiert zu groß – bitte kleineres Bild wählen.'); continue }
        await stelleDocSicher()
        await withStore((s) => s.add('photos', {
          projektId: daten.projektId, berichtId: draftId.current, terminId: bericht?.terminId || '',
          phase: fotoPhase, dataUrl, name: datei.name, von: user?.name || '', createdAt: Date.now(),
        }))
      }
    } catch (err) {
      setFehler('Bild konnte nicht verarbeitet werden.')
    } finally {
      setLadeFoto(false)
    }
  }

  async function fotoLoeschen(foto) {
    if (!confirm('Dieses Foto löschen?')) return
    await withStore((s) => s.remove('photos', foto.id))
  }

  async function speichern(status) {
    if (!daten.projektId) { setFehler('Bitte ein Projekt wählen.'); return }
    if (status === 'eingereicht' && !einreichenOk) { setFehler(`Zum Einreichen fehlt: ${gateHinweis()}`); return }
    const unterschriftKunde = unterschriftCanvas ? unterschriftAlsDataUrl(unterschriftCanvas) : alteUnterschrift
    const doc = {
      id: draftId.current, typ,
      projektId: daten.projektId, terminId: bericht?.terminId || '',
      mitarbeiterId: daten.mitarbeiterId, mitarbeiterName: mitarbeiter?.name || user?.name || '',
      datum: daten.datum, status,
      beschreibung: daten.beschreibung,
      createdAt: bericht?.createdAt || Date.now(),
      eingereichtAm: status === 'eingereicht' ? Date.now() : (bericht?.eingereichtAm || 0),
      ...(typ === 'regie' ? {
        stunden: daten.stunden.map((z) => ({ art: z.art, anzahl: Number(z.anzahl) || 0, satz: Number(z.satz) || 0 })),
        material: daten.material.map((z) => ({ artikelId: z.artikelId || '', name: z.name, menge: Number(z.menge) || 0, einheit: z.einheit || '', preis: Number(z.preis) || 0 })),
        unterschriftKunde, unterschriftName: daten.unterschriftName,
      } : {}),
      ...(typ === 'reklamation' ? { ursache: daten.ursache, massnahme: daten.massnahme } : {}),
      ...(typ === 'abnahme' ? {
        ohneMaengel: daten.ohneMaengel,
        maengel: daten.ohneMaengel ? [] : daten.maengel.filter((m) => m.text?.trim()),
        ort: daten.ort || projekt?.anschrift?.plzOrt || '',
        unterschriftKunde, unterschriftName: daten.unterschriftName,
      } : {}),
    }
    docAngelegt.current = true
    await withStore((s) => s.add('berichte', doc))
    onClose()
  }

  const feld = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
  const label = 'block text-xs font-semibold text-slate-500 mb-1'

  return (
    <Modal titel={`${TITEL[typ]} ${bericht ? 'bearbeiten' : 'erfassen'}`} onClose={onClose} breite="max-w-3xl">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className={label}>Projekt *</label>
            <select className={feld} value={daten.projektId} onChange={set('projektId')} disabled={Boolean(bericht)}>
              <option value="">– wählen –</option>
              {projekte.map((p) => <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>)}
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

        <div>
          <label className={label}>{typ === 'reklamation' ? 'Beschreibung des Mangels/Schadens *' : typ === 'abnahme' ? 'Bemerkungen zur Abnahme *' : 'Ausgeführte Arbeiten (Beschreibung) *'}</label>
          <textarea rows={3} className={feld} value={daten.beschreibung} onChange={set('beschreibung')} />
        </div>

        {typ === 'reklamation' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Ursache</label>
              <textarea rows={2} className={feld} value={daten.ursache} onChange={set('ursache')} />
            </div>
            <div>
              <label className={label}>Maßnahme zur Nachbesserung</label>
              <textarea rows={2} className={feld} value={daten.massnahme} onChange={set('massnahme')} />
            </div>
          </div>
        )}

        {typ === 'regie' && (
          <>
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">Arbeitszeit (Regie)</p>
              {daten.stunden.map((z, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                  <select className={`${feld} !w-56`} value={z.art} onChange={(e) => {
                    const art = e.target.value
                    setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, art, satz: art === 'helfer' ? (einst.regieHelfer || 31) : (einst.regieFacharbeiter || 35) } : s) }))
                  }}>
                    <option value="facharbeiter">Facharbeiter Malerhandwerk</option>
                    <option value="helfer">Helfer / Auszubildender</option>
                  </select>
                  <input type="number" step="0.25" min="0" className={`${feld} !w-24`} value={z.anzahl}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, anzahl: e.target.value } : s) }))} />
                  <span className="text-xs text-slate-400">Std. ×</span>
                  <input type="number" step="0.5" min="0" className={`${feld} !w-24`} value={z.satz}
                    onChange={(e) => setDaten((d) => ({ ...d, stunden: d.stunden.map((s, j) => j === i ? { ...s, satz: e.target.value } : s) }))} />
                  <span className="text-xs text-slate-400">€ = {euro((Number(z.anzahl) || 0) * (Number(z.satz) || 0))}</span>
                  <button onClick={() => setDaten((d) => ({ ...d, stunden: d.stunden.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button onClick={() => setDaten((d) => ({ ...d, stunden: [...d.stunden, { art: 'facharbeiter', anzahl: 1, satz: einst.regieFacharbeiter || 35 }] }))}
                  className="text-sm text-praxis-600 font-medium">+ Stunden-Zeile</button>
                <span className="text-sm font-bold">{euro(stundenSumme)}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">Material (aus Artikelstamm)</p>
              {daten.material.map((z, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm flex-1 min-w-[180px]">{z.name} <span className="text-xs text-slate-400">({euro(z.preis)}/{z.einheit || 'Stk'})</span></span>
                  <input type="number" step="0.5" min="0" className={`${feld} !w-24`} value={z.menge}
                    onChange={(e) => setDaten((d) => ({ ...d, material: d.material.map((m, j) => j === i ? { ...m, menge: e.target.value } : m) }))} />
                  <span className="text-xs text-slate-400 w-20">= {euro((Number(z.menge) || 0) * (Number(z.preis) || 0))}</span>
                  <button onClick={() => setDaten((d) => ({ ...d, material: d.material.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                </div>
              ))}
              <select className={feld} value="" onChange={(e) => {
                const a = katalog.find((k) => k.id === e.target.value)
                if (a) setDaten((d) => ({ ...d, material: [...d.material, { artikelId: a.id, name: a.name, einheit: a.einheit, preis: a.preis, menge: 1 }] }))
              }}>
                <option value="">+ Artikel hinzufügen …</option>
                {katalog.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name} ({euro(a.preis)})</option>)}
              </select>
              {daten.material.length > 0 && <p className="text-right text-sm font-bold mt-1">{euro(materialSumme)}</p>}
            </div>
          </>
        )}

        {typ === 'abnahme' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setDaten((d) => ({ ...d, ohneMaengel: !d.ohneMaengel }))}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border ${daten.ohneMaengel ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                <Icon name="check" className="w-4 h-4 inline mr-1.5" />Abnahme ohne Mängel
              </button>
              <div className="flex-1">
                <input type="text" className={feld} placeholder="Ort der Abnahme" value={daten.ort} onChange={set('ort')} />
              </div>
            </div>
            {!daten.ohneMaengel && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Mängel / Restarbeiten (mit Frist)</p>
                {daten.maengel.map((m, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" className={feld} placeholder="Mangel beschreiben" value={m.text}
                      onChange={(e) => setDaten((d) => ({ ...d, maengel: d.maengel.map((x, j) => j === i ? { ...x, text: e.target.value } : x) }))} />
                    <input type="date" className={`${feld} !w-40`} value={m.frist || ''}
                      onChange={(e) => setDaten((d) => ({ ...d, maengel: d.maengel.map((x, j) => j === i ? { ...x, frist: e.target.value } : x) }))} />
                    <button onClick={() => setDaten((d) => ({ ...d, maengel: d.maengel.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setDaten((d) => ({ ...d, maengel: [...d.maengel, { text: '', frist: '' }] }))} className="text-sm text-praxis-600 font-medium">+ Mangel</button>
              </div>
            )}
          </div>
        )}

        {/* Fotos mit Phase-Auswahl + Pflicht-Gate */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Icon name="foto" className="w-4 h-4" /> Fotodokumentation (Pflicht: Vorher + Nachher)</p>
            <div className="flex gap-1.5">
              {PHASEN.map((p) => (
                <button key={p.id} onClick={() => setFotoPhase(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${fotoPhase === p.id ? 'bg-praxis-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => kameraRef.current?.click()} disabled={ladeFoto}
              className="flex-1 px-3 py-2.5 rounded-xl bg-praxis-600 text-white text-sm font-medium disabled:opacity-50">
              {ladeFoto ? 'Verarbeite …' : `Foto aufnehmen (${PHASEN.find((p) => p.id === fotoPhase)?.label})`}
            </button>
            <button onClick={() => dateiRef.current?.click()} disabled={ladeFoto}
              className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium">Hochladen</button>
          </div>
          <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={fotoHinzu} />
          <input ref={dateiRef} type="file" accept="image/*" multiple className="hidden" onChange={fotoHinzu} />
          {fotos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {fotos.map((f) => (
                <div key={f.id} className="relative group">
                  <img src={f.dataUrl} alt={f.name} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                  <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[9px] font-bold rounded px-1.5 py-0.5">
                    {PHASEN.find((p) => p.id === f.phase)?.label || f.phase}
                  </span>
                  <button onClick={() => fotoLoeschen(f)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Icon name="x" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">Vorher: {fotosVorher} · Nachher: {fotosNachher} · Belege: {fotos.filter((f) => f.phase === 'beleg').length}</p>
        </div>

        {/* Unterschrift (Regie optional, Abnahme Pflicht) */}
        {(typ === 'regie' || typ === 'abnahme') && (
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <Icon name="signatur" className="w-4 h-4" /> Kundenunterschrift {typ === 'abnahme' ? '(Pflicht)' : '(optional)'}
            </p>
            {alteUnterschrift && !unterschriftCanvas ? (
              <div>
                <img src={alteUnterschrift} alt="Unterschrift" className="h-20 border border-slate-200 rounded-xl bg-white" />
                <button onClick={() => setAlteUnterschrift('')} className="mt-1 text-xs text-slate-500 hover:text-praxis-600">Neu unterschreiben</button>
              </div>
            ) : (
              <UnterschriftFeld onAenderung={setUnterschriftCanvas} />
            )}
            <input type="text" className={`${feld} mt-2`} placeholder="Name des Unterzeichners (z. B. Bauleitung)"
              value={daten.unterschriftName} onChange={set('unterschriftName')} />
          </div>
        )}

        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>}
        {!einreichenOk && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Zum Einreichen fehlt noch: {gateHinweis() || '–'}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100">Abbrechen</button>
          <button onClick={() => speichern('entwurf')} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
            Als Entwurf speichern
          </button>
          <button onClick={() => speichern('eingereicht')} disabled={!einreichenOk}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-praxis-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-praxis-700">
            Einreichen
          </button>
        </div>
      </div>
    </Modal>
  )
}
