// Fotos für die Baustelle vorbereiten.
//
// Stand bisher dreimal wortgleich in BerichtForm.jsx, SpesenForm.jsx und
// TerminBilder.jsx. Beim vierten Bedarf (Wandfotos) hier zusammengezogen –
// eine Änderung an der Kompression soll nicht an drei Stellen nachgezogen
// werden müssen.
//
// WARUM VERKLEINERT WIRD: Ein Handyfoto wiegt 3–8 MB. Ein Firestore-Dokument
// darf 1 MB haben, und hochgeladen wird über das Baustellennetz. 1200 px
// Kantenlänge bei 72 % Qualität liegt bei ~100 KB und reicht für einen
// Nachweis gegenüber dem Generalunternehmer allemal.

export const MAX_KANTE = 1200
export const QUALITAET = 0.72
export const GRENZE_BYTES = 950000     // unter dem Firestore-Limit von 1 MB

// V2-Fotoweg (Plan Kapitel 5.3): DREI Größen je Aufnahme.
//   1600 px  Beweis    – das Bild, dessen SHA-256 im fotos-Dokument steht
//    900 px  Druck     – ohne diese Größe hängt jedes Abnahmeprotokoll
//    400 px  Vorschau  – Kacheln, Ampel, schneller erster Upload
export const FOTO_GROESSEN = { beweis: 1600, druck: 900, vorschau: 400 }

function aufCanvas(bitmap, maxKante) {
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * faktor)
  canvas.height = Math.round(bitmap.height * faktor)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

function alsBlob(canvas, qualitaet) {
  return new Promise((auf, ab) => {
    canvas.toBlob((blob) => (blob ? auf(blob) : ab(new Error('Bild konnte nicht erzeugt werden.'))), 'image/jpeg', qualitaet)
  })
}

export async function komprimiere(datei, maxKante = MAX_KANTE, qualitaet = QUALITAET) {
  const bitmap = await createImageBitmap(datei)
  const canvas = aufCanvas(bitmap, maxKante)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', qualitaet)
}

// Alle drei Größen aus EINEM Dekodiervorgang – das Original wird nur einmal
// entpackt (ein 8-MB-Handyfoto dreimal zu dekodieren ruckelt spürbar).
// WICHTIG: Die EXIF-Aufnahmezeit muss der Aufrufer VOR diesem Schritt aus den
// Rohbytes lesen (shared/fotoablage.js) – der Canvas verwirft sie.
export async function dreiGroessen(datei, qualitaet = QUALITAET) {
  const bitmap = await createImageBitmap(datei)
  const ergebnis = {}
  for (const [name, kante] of Object.entries(FOTO_GROESSEN)) {
    ergebnis[name] = await alsBlob(aufCanvas(bitmap, kante), qualitaet)
  }
  bitmap.close?.()
  return ergebnis   // { beweis, druck, vorschau } als JPEG-Blobs
}

// Bequemer Weg für einen einzelnen Anhang: prüft Typ und Größe mit.
export async function fotoAus(datei) {
  if (!datei?.type?.startsWith('image/')) {
    return { ok: false, grund: 'kein-bild' }
  }
  const dataUrl = await komprimiere(datei)
  if (dataUrl.length > GRENZE_BYTES) {
    return { ok: false, grund: 'zu-gross' }
  }
  return { ok: true, dataUrl, name: datei.name }
}
