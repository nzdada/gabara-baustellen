import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { UnterschriftFeld, unterschriftAlsDataUrl } from '@shared/unterschrift.jsx'
import { euro } from '@shared/format.js'
import { useCollection, useWhere, useEinstellungen, withStore } from '../hooks.js'

// Berichts-Erfassung nach dem Aufbau der bewährten mam_solar-Feldprotokolle:
// nummerierte Abschnitts-Karten, GETRENNTE Vorher-/Nachher-Foto-Sektionen
// (je eigener Kamera-Button, Pflicht), am Ende Unterschriften-Sektion
// (Kunde + Monteur). Pflichtfoto-Gate: Einreichen erst mit >= 1 Vorher-
// UND >= 1 Nachher-Foto; Abnahme zusätzlich nur mit Kundenunterschrift + Name.

const TITEL = { regie: 'Regie-/Arbeitsbericht', reklamation: 'Reklamation / Schadensprotokoll', abnahme: 'Abnahmeprotokoll' }

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

// Abschnitts-Karte im mam_solar-Stil: Nummer + Titel, darunter der Inhalt
function Sektion({ nr, titel, pflicht = false, erfuellt = true, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${pflicht && !erfuellt ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
          pflicht && !erfuellt ? 'bg-amber-400 text-white' : 'bg-praxis-600 text-white'
        }`}>{nr}</span>
        <p className="text-sm font-bold text-slate-800">{titel}</p>
        {pflicht && (
          <span className={`ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 ${erfuellt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {erfuellt ? 'OK' : 'Pflicht'}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
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
  const [kundeCanvas, setKundeCanvas] = useState(null)
  const [monteurCanvas, setMonteurCanvas] = useState(null)
  const [alteKunde, setAlteKunde] = useState(bericht?.unterschriftKunde || '')
  const [alteMonteur, setAlteMonteur] = useState(bericht?.unterschriftMonteur || '')
  const [fehler, setFehler] = useState('')
  const [ladeFoto, setLadeFoto] = useState('')   // gerade ladende Phase
  const kameraRefs = { vorher: useRef(null), nachher: useRef(null) }
  const dateiRefs = { vorher: useRef(null), nachher: useRef(null) }

  const projekt = projekte.find((p) => p.id === daten.projektId)
  const mitarbeiter = users.find((u) => u.id === daten.mitarbeiterId)
  const set = (feld) => (e) => setDaten((d) => ({ ...d, [feld]: e.target.value }))

  const stundenSumme = daten.stunden.reduce((s, z) => s + (Number(z.anzahl) || 0) * (Number(z.satz) || 0), 0)
  const materialSumme = daten.material.reduce((s, z) => s + (Number(z.menge) || 0) * (Number(z.preis) || 0), 0)

  const fotosVorher = fotos.filter((f) => f.phase === 'vorher')
  const fotosNachher = fotos.filter((f) => f.phase === 'nachher')
  const kundeDa = Boolean(kundeCanvas || alteKunde)
  const abnahmeOk = typ !== 'abnahme' || (kundeDa && daten.unterschriftName.trim())
  const einreichenOk = daten.projektId && daten.beschreibung.trim() && fotosVorher.length >= 1 && fotosNachher.length >= 1 && abnahmeOk

  function gateHinweis() {
    const teile = []
    if (!daten.projektId) teile.push('Projekt wählen (Abschnitt 1)')
    if (fotosVorher.length < 1) teile.push('mind. 1 Vorher-Foto (Abschnitt 2)')
    if (!daten.beschreibung.trim()) teile.push('Beschreibung (Abschnitt 3)')
    if (fotosNachher.length < 1) teile.push(`mind. 1 Nachher-Foto (Abschnitt ${typ === 'regie' ? 5 : 4})`)
    if (typ === 'abnahme' && !kundeDa) teile.push('Kundenunterschrift')
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

  async function fotoHinzu(phase, e) {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    if (!daten.projektId) { setFehler('Bitte zuerst ein Projekt wählen (Abschnitt 1) – dann Fotos aufnehmen.'); return }
    setFehler('')
    setLadeFoto(phase)
    try {
      for (const datei of dateien) {
        if (!datei.type.startsWith('image/')) { setFehler(`${datei.name} ist kein Bild.`); continue }
        const dataUrl = await komprimiere(datei)
        if (dataUrl.length > 950000) { setFehler('Bild ist auch komprimiert zu groß – bitte kleineres Bild wählen.'); continue }
        await stelleDocSicher()
        await withStore((s) => s.add('photos', {
          projektId: daten.projektId, berichtId: draftId.current, terminId: bericht?.terminId || '',
          phase, dataUrl, name: datei.name, von: user?.name || '', createdAt: Date.now(),
        }))
      }
    } catch (err) {
      setFehler(err.message || 'Bild konnte nicht verarbeitet werden.')
    } finally {
      setLadeFoto('')
    }
  }

  async function fotoLoeschen(foto) {
    if (!confirm('Dieses Foto löschen?')) return
    await withStore((s) => s.remove('photos', foto.id))
  }

  async function speichern(status) {
    if (!daten.projektId) { setFehler('Bitte ein Projekt wählen (Abschnitt 1).'); return }
    if (status === 'eingereicht' && !einreichenOk) { setFehler(`Zum Einreichen fehlt: ${gateHinweis()}`); return }
    const unterschriftKunde = kundeCanvas ? unterschriftAlsDataUrl(kundeCanvas) : alteKunde
    const unterschriftMonteur = monteurCanvas ? unterschriftAlsDataUrl(monteurCanvas) : alteMonteur
    const doc = {
      id: draftId.current, typ,
      projektId: daten.projektId, terminId: bericht?.terminId || '',
      mitarbeiterId: daten.mitarbeiterId, mitarbeiterName: mitarbeiter?.name || user?.name || '',
      datum: daten.datum, status,
      beschreibung: daten.beschreibung,
      unterschriftKunde, unterschriftName: daten.unterschriftName, unterschriftMonteur,
      createdAt: bericht?.createdAt || Date.now(),
      eingereichtAm: status === 'eingereicht' ? Date.now() : (bericht?.eingereichtAm || 0),
      ...(typ === 'regie' ? {
        stunden: daten.stunden.map((z) => ({ art: z.art, anzahl: Number(z.anzahl) || 0, satz: Number(z.satz) || 0 })),
        material: daten.material.map((z) => ({ artikelId: z.artikelId || '', name: z.name, menge: Number(z.menge) || 0, einheit: z.einheit || '', preis: Number(z.preis) || 0 })),
      } : {}),
      ...(typ === 'reklamation' ? { ursache: daten.ursache, massnahme: daten.massnahme } : {}),
      ...(typ === 'abnahme' ? {
        ohneMaengel: daten.ohneMaengel,
        maengel: daten.ohneMaengel ? [] : daten.maengel.filter((m) => m.text?.trim()),
        ort: daten.ort || projekt?.anschrift?.plzOrt || '',
      } : {}),
    }
    try {
      docAngelegt.current = true
      await withStore((s) => s.add('berichte', doc))
      onClose()
    } catch (e) {
      setFehler(e.message)
    }
  }

  const feld = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
  const label = 'block text-xs font-semibold text-slate-500 mb-1'

  // Getrennte Foto-Sektion (Vorher ODER Nachher) im mam_solar-Stil.
  // Bewusst als einfache Render-FUNKTION aufgerufen (kein <JSX-Element>),
  // damit React die Sektion nicht bei jedem Tastendruck neu mountet.
  function fotoSektion({ phase }) {
    const liste = phase === 'vorher' ? fotosVorher : fotosNachher
    const farbe = phase === 'vorher' ? 'bg-slate-600' : 'bg-emerald-600'
    return (
      <div>
        <div className="flex gap-2">
          <button onClick={() => kameraRefs[phase].current?.click()} disabled={Boolean(ladeFoto)}
            className={`flex-1 px-3 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 ${farbe}`}>
            <Icon name="foto" className="w-4 h-4" />
            {ladeFoto === phase ? 'Verarbeite …' : `${phase === 'vorher' ? 'Vorher' : 'Nachher'}-Foto aufnehmen`}
          </button>
          <button onClick={() => dateiRefs[phase].current?.click()} disabled={Boolean(ladeFoto)}
            className="px-3 py-3 rounded-xl bg-white border border-slate-200 text-sm font-medium">Hochladen</button>
        </div>
        <input ref={kameraRefs[phase]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fotoHinzu(phase, e)} />
        <input ref={dateiRefs[phase]} type="file" accept="image/*" multiple className="hidden" onChange={(e) => fotoHinzu(phase, e)} />
        {liste.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
            {liste.map((f) => (
              <div key={f.id} className="relative group">
                <img src={f.dataUrl} alt={f.name} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => fotoLoeschen(f)}
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Noch kein {phase === 'vorher' ? 'Vorher' : 'Nachher'}-Foto – mindestens 1 ist Pflicht.</p>
        )}
      </div>
    )
  }

  // Abschnitts-Nummern je Berichtstyp (Regie hat den Arbeitszeit/Material-Block)
  let nr = 0
  const naechste = () => ++nr

  return (
    <Modal titel={`${TITEL[typ]} ${bericht ? 'bearbeiten' : 'erfassen'}`} onClose={onClose} breite="max-w-3xl">
      <div className="space-y-3">

        <Sektion nr={naechste()} titel="Basisdaten" pflicht erfuellt={Boolean(daten.projektId)}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Projekt / Baustelle *</label>
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
              <label className={label}>Monteur</label>
              <select className={feld} value={daten.mitarbeiterId} onChange={set('mitarbeiterId')}>
                <option value="">– wählen –</option>
                {users.filter((u) => u.aktiv !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {projekt && (
            <p className="mt-2 text-xs text-slate-400">
              {projekt.anschrift?.strasse}, {projekt.anschrift?.plzOrt}
            </p>
          )}
        </Sektion>

        <Sektion nr={naechste()} titel="VORHER – Zustand vor der Arbeit" pflicht erfuellt={fotosVorher.length >= 1}>
          {fotoSektion({ phase: 'vorher' })}
        </Sektion>

        <Sektion nr={naechste()} titel={typ === 'reklamation' ? 'Beschreibung des Mangels/Schadens' : typ === 'abnahme' ? 'Abnahme & Bemerkungen' : 'Ausgeführte Arbeiten (Beschreibung)'} pflicht erfuellt={Boolean(daten.beschreibung.trim())}>
          <textarea rows={3} className={feld} value={daten.beschreibung} onChange={set('beschreibung')}
            placeholder={typ === 'regie' ? 'Was wurde zusätzlich gemacht? (Regie ist getrennt vom LV abrechenbar)' : ''} />
          {typ === 'reklamation' && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
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
          {typ === 'abnahme' && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setDaten((d) => ({ ...d, ohneMaengel: !d.ohneMaengel }))}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium border ${daten.ohneMaengel ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <Icon name="check" className="w-4 h-4 inline mr-1.5" />Abnahme ohne Mängel
                </button>
                <input type="text" className={`${feld} !w-auto flex-1`} placeholder="Ort der Abnahme" value={daten.ort} onChange={set('ort')} />
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
        </Sektion>

        {typ === 'regie' && (
          <Sektion nr={naechste()} titel="Arbeitszeit & Material">
            <p className="text-xs font-semibold text-slate-500 mb-2">Arbeitszeit (Regie)</p>
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
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setDaten((d) => ({ ...d, stunden: [...d.stunden, { art: 'facharbeiter', anzahl: 1, satz: einst.regieFacharbeiter || 35 }] }))}
                className="text-sm text-praxis-600 font-medium">+ Stunden-Zeile</button>
              <span className="text-sm font-bold">{euro(stundenSumme)}</span>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-2">Materialverbrauch (aus Artikelstamm)</p>
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
          </Sektion>
        )}

        <Sektion nr={naechste()} titel="NACHHER – Ergebnis der Arbeit" pflicht erfuellt={fotosNachher.length >= 1}>
          {fotoSektion({ phase: 'nachher' })}
        </Sektion>

        <Sektion nr={naechste()} titel="Unterschriften" pflicht={typ === 'abnahme'} erfuellt={abnahmeOk}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                Kunde / Bauleitung {typ === 'abnahme' ? '(Pflicht)' : '(optional)'}
              </p>
              {alteKunde && !kundeCanvas ? (
                <div>
                  <img src={alteKunde} alt="Unterschrift Kunde" className="h-20 border border-slate-200 rounded-xl bg-white" />
                  <button onClick={() => setAlteKunde('')} className="mt-1 text-xs text-slate-500 hover:text-praxis-600">Neu unterschreiben</button>
                </div>
              ) : (
                <UnterschriftFeld onAenderung={setKundeCanvas} />
              )}
              <input type="text" className={`${feld} mt-2`} placeholder="Vor- und Nachname (Kunde/Bauleitung)"
                value={daten.unterschriftName} onChange={set('unterschriftName')} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Monteur – Gabara Service GmbH (optional)</p>
              {alteMonteur && !monteurCanvas ? (
                <div>
                  <img src={alteMonteur} alt="Unterschrift Monteur" className="h-20 border border-slate-200 rounded-xl bg-white" />
                  <button onClick={() => setAlteMonteur('')} className="mt-1 text-xs text-slate-500 hover:text-praxis-600">Neu unterschreiben</button>
                </div>
              ) : (
                <UnterschriftFeld onAenderung={setMonteurCanvas} hinweis="Unterschrift Monteur" />
              )}
              <p className="mt-2 text-xs text-slate-400">{mitarbeiter?.name || user?.name || ''}</p>
            </div>
          </div>
        </Sektion>

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
