import { useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { flaechenVon, einzelflaechen } from '@shared/raumflaeche.js'
import { tuerenVon, neueTuer, WAENDE, TUER_BREITE } from '@shared/tueren.js'
import { aufgabenVon, fortschrittAufgaben, ausVorlage, neueAufgabe, VORLAGEN } from '@shared/raumaufgaben.js'
import { fotoAus } from '@shared/bild.js'
import { istMonteurRolle } from '@shared/auth.js'
import { useWhere, withStore } from '../hooks.js'

// Ein Raum in voller Breite: Daten, Aufgaben, Flächen, Fotos.
//
// BEWUSST EINE Komponente für Büro UND Handy. Beide sollen denselben Stand
// sehen; zwei getrennte Ansichten laufen erfahrungsgemäß auseinander, und dann
// streitet man darüber, welche recht hat. Unterschiedlich ist nur, was erlaubt
// ist: das Büro darf Aufgaben anlegen und löschen, der Monteur hakt ab.

export default function RaumDialog({ raum, projektId, user, nurLesen = false, onClose }) {
  useLang()
  const fotos = useWhere('photos', 'projektId', projektId)
  const [laeuft, setLaeuft] = useState('')
  const [fehler, setFehler] = useState('')
  const [neuText, setNeuText] = useState('')
  const kamera = useRef(null)
  const wartet = useRef(null)

  // NICHT über einen Direktvergleich mit 'mitarbeiter' – dabei fiele der
  // Vorarbeiter auf die Büro-Seite und könnte abgehakte, fotodokumentierte
  // Arbeitsschritte löschen (Fund der Gegenprüfung vom 08.08.2026).
  const istBuero = !istMonteurRolle(user?.rolle) && !nurLesen
  const aufgaben = useMemo(() => aufgabenVon(raum), [raum])
  const fort = fortschrittAufgaben(raum)
  const f = flaechenVon(raum)
  const flaechen = einzelflaechen(raum)

  const raumFotos = useMemo(
    () => fotos.filter((x) => x.raumId === raum?.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [fotos, raum]
  )

  if (!raum) return null

  async function speichern(felder) {
    await withStore((s) => s.update('raeume', raum.id, felder))
  }

  // --- Türen ---
  //
  // Warum das hier und nicht im Grundriss: Eine Tür gehoert zum RAUM, nicht zur
  // Zeichnung. Der Plan-Import liefert sie mit; Raeume aus der Zeit davor haben
  // nur eine Anzahl ohne Wandbezug. Ohne diese Verwaltung waeren sie fuer immer
  // ohne Tuer – in der Zeichnung wie im Modell.
  async function tuerHinzu(wand) {
    const bestand = tuerenVon(raum)
    // Neue Tuer mittig, sofern dort noch keine sitzt – sonst daneben.
    const belegt = bestand.filter((t) => t.wand === wand).map((t) => t.position)
    let pos = 0.5
    for (const kandidat of [0.5, 0.25, 0.75, 0.15, 0.85]) {
      if (!belegt.some((b) => Math.abs(b - kandidat) < 0.12)) { pos = kandidat; break }
    }
    await speichern({ tueren: [...bestand, neueTuer({ wand, position: pos, breite: TUER_BREITE })] })
  }

  async function tuerWeg(id) {
    await speichern({ tueren: tuerenVon(raum).filter((t) => t.id !== id) })
  }

  async function tuerSchieben(id, position) {
    await speichern({
      tueren: tuerenVon(raum).map((t) => (t.id === id ? { ...t, position: Number(position) } : t)),
    })
  }

  async function vorlageSetzen(vorlageId) {
    if (aufgaben.length && !confirm(t('aufg.vorlageFrage'))) return
    await speichern({ aufgaben: ausVorlage(vorlageId) })
  }

  async function hinzufuegen() {
    const text = neuText.trim()
    if (!text) return
    const sort = aufgaben.length ? Math.max(...aufgaben.map((a) => a.sort || 0)) + 1 : 0
    await speichern({ aufgaben: [...aufgaben, neueAufgabe(text, sort)] })
    setNeuText('')
  }

  // Abhaken. "Fertig" verlangt ein Foto – ohne Bild ist es eine Behauptung.
  function abhaken(aufgabe) {
    setFehler('')
    if (aufgabe.fertig) {
      return speichern({
        aufgaben: aufgaben.map((a) => (a.id === aufgabe.id
          ? { ...a, fertig: false, fertigAm: 0, fertigVon: '' } : a)),
      })
    }
    wartet.current = aufgabe
    kamera.current?.click()
  }

  async function fotoGewaehlt(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    const aufgabe = wartet.current
    wartet.current = null
    if (!aufgabe) return
    // Ohne Bild: die Aufgabe bleibt OFFEN. Wer die Kamera wegtippt, hat nichts
    // gemeldet – das ist die richtige Richtung.
    if (!datei) return
    setLaeuft(aufgabe.id)
    try {
      const bild = await fotoAus(datei)
      if (!bild.ok) {
        setFehler(t(bild.grund === 'zu-gross' ? 'raum.fotoZuGross' : 'raum.fotoKeinBild'))
        return
      }
      await withStore(async (s) => {
        await s.add('photos', {
          projektId,
          raumId: raum.id,
          flaecheId: aufgabe.flaecheId || '',
          aufgabeId: aufgabe.id,
          phase: 'nachher',
          berichtId: '', terminId: '',
          dataUrl: bild.dataUrl,
          name: `${raum.nummer || raum.name || 'Raum'} - ${aufgabe.text}.jpg`,
          von: user?.name || '', vonId: user?.userId || '',
          createdAt: Date.now(),
        })
        // Erst nach dem Bild abhaken
        await s.update('raeume', raum.id, {
          aufgaben: aufgaben.map((a) => (a.id === aufgabe.id
            ? { ...a, fertig: true, fertigAm: Date.now(), fertigVon: user?.name || '' } : a)),
        })
      })
    } catch (err) {
      setFehler(err?.message || String(err))
    } finally {
      setLaeuft('')
    }
  }

  return (
    <Modal titel={`${raum.nummer ? raum.nummer + ' · ' : ''}${raum.name || t('raum.ohneName')}`} onClose={onClose}>
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={fotoGewaehlt} />

      {/* Raumdaten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          [t('raum.flaeche'), `${f.boden} m²`],
          [t('raum.wand'), `${f.wand} m²${f.geschaetzt ? ' *' : ''}`],
          [t('raum.hoehe'), `${f.hoehe} m`],
          [t('raum.umfang'), `${f.umfang} m`],
        ].map(([k, v]) => (
          <div key={k} className="bg-gedeckt rounded-feld px-3 py-2">
            <p className="text-[11px] text-schrift-zart">{k}</p>
            <p className="text-sm font-bold text-schrift-stark">{v}</p>
          </div>
        ))}
      </div>
      {f.geschaetzt && <p className="-mt-2 mb-3 text-[12px] text-amber-700">* {t('raum.geschaetztHilfe')}</p>}

      {/* Fortschritt */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-bold text-schrift-stark">{t('aufg.titel')}</span>
          <span className="text-schrift-leise">
            {fort.hatAufgaben ? `${fort.fertig} ${t('raum.von')} ${fort.gesamt} · ${fort.prozent} %` : t('aufg.keine')}
          </span>
        </div>
        <div className="h-2 bg-gedeckt-tief rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fort.alleFertig ? 'bg-emerald-500' : 'bg-praxis-500'}`}
            style={{ width: `${fort.prozent}%` }}
          />
        </div>
      </div>

      {fehler && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-feld px-3 py-2">{fehler}</p>}

      {/* Aufgabenliste */}
      {!aufgaben.length && istBuero && (
        <div className="mb-4 border border-rahmen rounded-feld p-3">
          <p className="text-sm text-schrift-leise mb-2">{t('aufg.vorlageHinweis')}</p>
          <div className="flex flex-wrap gap-2">
            {VORLAGEN.map((v) => (
              <button key={v.id} onClick={() => vorlageSetzen(v.id)}
                className="px-3 min-h-11 rounded-feld border border-rahmen text-sm font-semibold hover:bg-gedeckt">
                {t(v.schluessel)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {aufgaben.map((a) => {
          const beschaeftigt = laeuft === a.id
          const bilder = raumFotos.filter((x) => x.aufgabeId === a.id).length
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 border rounded-feld px-3 min-h-14 ${
                a.fertig ? 'border-emerald-300 bg-emerald-50' : 'border-rahmen bg-karte'
              }`}
            >
              <button
                onClick={() => !beschaeftigt && abhaken(a)}
                disabled={beschaeftigt}
                aria-label={a.text}
                className={`w-7 h-7 shrink-0 rounded-md border-2 flex items-center justify-center ${
                  a.fertig ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-rahmen-stark'
                }`}
              >
                {beschaeftigt ? '…' : a.fertig ? <Icon name="check" className="w-4 h-4" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${a.fertig ? 'text-emerald-900 line-through' : 'text-schrift-stark'}`}>
                  {a.text}
                </p>
                <p className="text-[12px] text-schrift-zart">
                  {a.fertig
                    ? `${t('aufg.fertigVon', { name: a.fertigVon || '–' })}${a.fertigAm ? ` · ${datumLok(new Date(a.fertigAm).toISOString().slice(0, 10))}` : ''}`
                    : t('aufg.offen')}
                  {bilder > 0 ? ` · ${bilder} ${t('raum.fotos')}` : ''}
                </p>
              </div>
              {istBuero && (
                <button
                  onClick={() => speichern({ aufgaben: aufgaben.filter((x) => x.id !== a.id) })}
                  className="text-schrift-zart hover:text-red-600 px-2 min-h-11 shrink-0"
                  aria-label={t('aufg.entfernen')}
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {istBuero && (
        <div className="flex gap-2 mb-4">
          <input
            value={neuText} onChange={(e) => setNeuText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') hinzufuegen() }}
            placeholder={t('aufg.neuPlatz')}
            className="flex-1 rounded-feld border border-rahmen px-3 py-2.5 text-sm"
          />
          <button onClick={hinzufuegen} disabled={!neuText.trim()}
            className="px-4 min-h-11 rounded-feld bg-praxis-600 text-white text-sm font-bold disabled:opacity-40">
            {t('allg.hinzufuegen')}
          </button>
        </div>
      )}

      {/* Flächen mit Fotostand – der Nachweis je Wand */}
      <p className="text-sm font-bold text-schrift-stark mb-2">{t('aufg.flaechen')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {flaechen.map((fl) => {
          const bilder = raumFotos.filter((x) => x.flaecheId === fl.id).length
          return (
            <div key={fl.id} className="border border-rahmen rounded-feld px-3 py-2">
              <p className="text-[12px] font-semibold text-schrift">{t(fl.schluessel)}</p>
              <p className="text-[12px] text-schrift-zart">
                {fl.groesse} m²{bilder > 0 ? ` · ${bilder} ${t('raum.fotos')}` : ''}
              </p>
            </div>
          )
        })}
      </div>

      {/* Türen: Wandöffnungen im Grundriss und im Modell */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <p className="text-sm font-bold text-schrift-stark">{t('tuer.titel')}</p>
        <span className="text-[12px] text-schrift-zart">{t('tuer.hinweis')}</span>
      </div>
      <div className="mb-4">
        {tuerenVon(raum).length === 0 && (
          <p className="text-[12px] text-schrift-zart mb-2">{t('tuer.keine')}</p>
        )}
        <div className="space-y-2 mb-2">
          {tuerenVon(raum).map((tu) => (
            <div key={tu.id} className="flex items-center gap-3 border border-rahmen rounded-feld px-3 py-2">
              <span className="text-[12px] font-semibold text-schrift w-24 shrink-0">
                {t(`raum.flaeche.${tu.wand}`)}
              </span>
              <input
                type="range" min="0.08" max="0.92" step="0.01"
                value={tu.position}
                onChange={(e) => tuerSchieben(tu.id, e.target.value)}
                className="flex-1 min-w-24"
                aria-label={t('tuer.stelle')}
              />
              <span className="text-[12px] text-schrift-zart w-20 shrink-0 text-right">
                {Math.round(tu.position * 100)} % · {(Number(tu.breite) || 0).toLocaleString('de-DE')} m
              </span>
              {tu.herkunft === 'plan' && (
                <span className="text-[11px] font-bold text-emerald-700 shrink-0">{t('tuer.ausPlan')}</span>
              )}
              <button
                onClick={() => tuerWeg(tu.id)}
                className="px-2 min-h-9 rounded-feld text-[12px] font-bold text-rot hover:bg-gedeckt shrink-0"
              >
                {t('allg.entfernen')}
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-schrift-zart me-1">{t('tuer.hinzu')}</span>
          {WAENDE.map((w) => (
            <button
              key={w}
              onClick={() => tuerHinzu(w)}
              className="px-3 min-h-9 rounded-feld border border-rahmen bg-karte text-[12px] font-semibold text-schrift hover:bg-gedeckt"
            >
              {t(`raum.flaeche.${w}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Fotos */}
      {raumFotos.length > 0 && (
        <>
          <p className="text-sm font-bold text-schrift-stark mb-2">
            {t('raum.fotos')} ({raumFotos.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {raumFotos.slice(0, 12).map((x) => (
              <img key={x.id} src={x.dataUrl} alt={x.name}
                title={`${x.name} · ${x.von}`}
                className="w-full h-20 object-cover rounded-feld border border-rahmen" />
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
