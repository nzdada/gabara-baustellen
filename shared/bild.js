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

export async function komprimiere(datei, maxKante = MAX_KANTE, qualitaet = QUALITAET) {
  const bitmap = await createImageBitmap(datei)
  const faktor = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * faktor)
  canvas.height = Math.round(bitmap.height * faktor)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', qualitaet)
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
