import { useMemo, useRef, useState } from 'react'
import { komprimiere } from '@shared/bild.js'
import { Icon } from '@shared/ui.jsx'
import { useWhere, withStore } from '../hooks.js'
import { useLang, tr } from '@shared/i18n.js'

const T = {
  titel: { de: 'Bilder & Scans', en: 'Images & scans', ar: 'الصور والمسوحات' },
  foto: { de: 'Foto aufnehmen', en: 'Take photo', ar: 'التقاط صورة' },
  hochladen: { de: 'Hochladen', en: 'Upload', ar: 'رفع ملف' },
  keinBild: { de: 'ist kein Bild – bitte Scans als Bild (JPG/PNG) exportieren.', en: 'is not an image – please export scans as image (JPG/PNG).', ar: 'ليس صورة – يرجى تصدير المسوحات كصورة (JPG/PNG).' },
  zuGross: { de: 'Bild ist auch komprimiert zu groß – bitte kleineres Bild wählen.', en: 'Image is too large even after compression – please choose a smaller one.', ar: 'الصورة كبيرة جدًا حتى بعد الضغط – يرجى اختيار صورة أصغر.' },
  fehler: { de: 'Bild konnte nicht verarbeitet werden.', en: 'Image could not be processed.', ar: 'تعذرت معالجة الصورة.' },
  verarbeitet: { de: 'Bild wird verarbeitet …', en: 'Processing image …', ar: 'جارٍ معالجة الصورة …' },
  leer: { de: 'Noch keine Bilder zu diesem Termin – Foto direkt aufnehmen oder Scan hochladen.', en: 'No images for this appointment yet – take a photo or upload a scan.', ar: 'لا صور لهذا الموعد بعد – التقط صورة أو ارفع مسحًا.' },
  loeschenFrage: { de: 'Dieses Bild löschen?', en: 'Delete this image?', ar: 'حذف هذه الصورة؟' },
  schliessen: { de: 'Schließen', en: 'Close', ar: 'إغلاق' },
}

// Behandlungsfotos & Scans zu einem Termin.
// - "Foto aufnehmen" öffnet auf Tablet/Handy direkt die Kamera (capture)
// - "Hochladen" für vorhandene Dateien (z. B. Intraoral-Scan als Bild/Export)
// Bilder werden clientseitig auf max. 1200 px / JPEG komprimiert und als
// Daten-URL gespeichert -> funktioniert im Lokal-Modus UND in Firestore
// (je Foto ein Dokument, deutlich unter dem 1-MB-Limit), Live auf allen Geräten.


export default function TerminBilder({ termin, user, dunkel = false }) {
  useLang()
  // Gefiltertes Abo: lädt nur die Fotos DIESES Termins (statt aller Fotos)
  const photos = useWhere('photos', 'terminId', termin.id)
  const kameraRef = useRef(null)
  const uploadRef = useRef(null)
  const [gross, setGross] = useState(null)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')

  const meine = useMemo(
    () => [...photos].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [photos]
  )

  async function dateienVerarbeiten(files) {
    setFehler('')
    setLaedt(true)
    try {
      for (const file of [...files]) {
        if (!file.type.startsWith('image/')) {
          setFehler(`"${file.name}" ${tr(T.keinBild)}`)
          continue
        }
        const dataUrl = await komprimiere(file)
        if (dataUrl.length > 950000) {
          setFehler(tr(T.zuGross))
          continue
        }
        await withStore((s) =>
          s.add('photos', {
            terminId: termin.id,
            // projektId MUSS mit: der Bilder-Bereich der Baustelle filtert genau
            // danach (ProjektDetail.jsx). Ohne das Feld war ein hier
            // hochgeladenes Foto zwar gespeichert, aber nirgends auffindbar.
            projektId: termin.projektId || '',
            phase: 'sonstig',
            patientId: termin.patientId || '',
            dataUrl,
            name: file.name,
            von: user?.name || 'Team',
            vonId: user?.userId || '',
            createdAt: Date.now(),
          })
        )
      }
    } catch (e) {
      setFehler(tr(T.fehler))
    } finally {
      setLaedt(false)
      if (kameraRef.current) kameraRef.current.value = ''
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  async function loeschen(photo) {
    if (!confirm(tr(T.loeschenFrage))) return
    await withStore((s) => s.remove('photos', photo.id))
  }

  const knopf = dunkel
    ? 'bg-karte/10 hover:bg-karte/20 text-white border border-white/15'
    : 'bg-karte border border-rahmen text-schrift hover:border-praxis-400'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className={`font-bold flex items-center gap-2 mr-auto rtl:mr-0 rtl:ml-auto ${dunkel ? 'text-lg' : 'text-schrift-stark'}`}>
          {tr(T.titel)}
          {meine.length > 0 && (
            <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${dunkel ? 'bg-karte/15' : 'bg-praxis-100 text-praxis-800'}`}>
              {meine.length}
            </span>
          )}
        </p>
        <button onClick={() => kameraRef.current?.click()} disabled={laedt}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-2 disabled:opacity-50 ${knopf}`}>
          {tr(T.foto)}
        </button>
        <button onClick={() => uploadRef.current?.click()} disabled={laedt}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-2 disabled:opacity-50 ${knopf}`}>
          <Icon name="upload" className="w-4 h-4" /> {tr(T.hochladen)}
        </button>
      </div>

      {/* Kamera (öffnet auf Tablet/Handy die Rückkamera) */}
      <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.length && dateienVerarbeiten(e.target.files)} />
      {/* Datei-Upload, mehrere möglich (z. B. exportierte Scans) */}
      <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => e.target.files?.length && dateienVerarbeiten(e.target.files)} />

      {fehler && (
        <p className={`mt-3 text-sm rounded-feld px-4 py-2.5 ${dunkel ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-600'}`}>{fehler}</p>
      )}
      {laedt && <p className={`mt-3 text-sm ${dunkel ? 'text-schrift-zart' : 'text-schrift-leise'}`}>{tr(T.verarbeitet)}</p>}

      {meine.length === 0 && !laedt ? (
        <p className={`mt-3 text-sm ${dunkel ? 'text-schrift-leise' : 'text-schrift-zart'}`}>{tr(T.leer)}</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {meine.map((p) => (
            <figure key={p.id} className="relative group rounded-feld overflow-hidden border border-black/10">
              <button onClick={() => setGross(p)} className="block w-full">
                <img src={p.dataUrl} alt={p.name} className="w-full h-24 sm:h-28 object-cover" />
              </button>
              <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[11px] px-2 py-1 truncate">
                {new Date(p.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {p.von}
              </figcaption>
              <button onClick={() => loeschen(p)}
                className="absolute top-1.5 right-1.5 bg-black/55 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                title="Löschen">
                <Icon name="x" className="w-3.5 h-3.5" />
              </button>
            </figure>
          ))}
        </div>
      )}

      {/* Vollbild-Ansicht */}
      {gross && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setGross(null)}>
          <img src={gross.dataUrl} alt={gross.name} className="max-h-[82vh] max-w-full rounded-feld shadow-hoch" />
          <p className="mt-3 text-white/80 text-sm">
            {gross.name} · {new Date(gross.createdAt).toLocaleString('de-DE')} · {gross.von}
          </p>
          <button className="mt-3 bg-karte/15 hover:bg-karte/25 text-white text-sm font-semibold rounded-full px-5 py-2">
            {tr(T.schliessen)}
          </button>
        </div>
      )}
    </div>
  )
}
