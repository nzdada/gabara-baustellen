// Prüfung der Foto-Ablage (shared/fotoablage.js) – die reinen Rechenteile
// der Offline-Foto-Pipeline aus AP 6: EXIF-Zeit, Prüfsumme, Verfallsregel,
// Fototafel-Ampel und der Bau des fotos-Dokuments (nie ein dataUrl!).
//
// Ausführen:  node pruefung/fotoablage.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht – damit taugt es als Bau-Vorstufe.

import {
  exifAufnahmezeit, zeitAusExifText, sha256Hex, sollteJetztLaden,
  fotoStandFeld, fotoAmpel, fotosDokument, vorschauPhotoId, VERFALL,
} from '../shared/fotoablage.js'

const faelle = []
const p = (bereich, name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  faelle.push({ bereich, name, ist, soll, ok: gleich })
}

// ---------------------------------------------------------------- EXIF-Text
p('ExifText', 'gültige Aufnahmezeit', zeitAusExifText('2026:08:08 14:03:21'),
  new Date(2026, 7, 8, 14, 3, 21).getTime())
p('ExifText', 'Müll wird null', zeitAusExifText('kein datum'), null)
p('ExifText', 'leer wird null', zeitAusExifText(''), null)
p('ExifText', 'Nullmonat wird null', zeitAusExifText('2026:00:08 14:03:21'), null)

// ---------------------------------------------------------------- EXIF im JPEG
//
// Ein synthetisches Mini-JPEG mit APP1/Exif und DateTimeOriginal (0x9003),
// wahlweise little endian ('II') oder big endian ('MM') – genau die zwei
// Formen, die Handys schreiben.
function baueExifJpeg(text, klein) {
  const tiffLaenge = 64                        // 44 Kopf/IFDs + 20 Textbytes
  const app1Nutz = 6 + tiffLaenge              // 'Exif\0\0' + TIFF
  const gesamt = 2 + 2 + 2 + app1Nutz + 2      // SOI + Marker + Länge + Nutz + EOI
  const puffer = new ArrayBuffer(gesamt)
  const s = new DataView(puffer)
  let o = 0
  s.setUint16(o, 0xffd8); o += 2               // SOI
  s.setUint16(o, 0xffe1); o += 2               // APP1
  s.setUint16(o, app1Nutz + 2); o += 2         // Länge (inkl. Längenfeld)
  for (const z of 'Exif\0\0') s.setUint8(o++, z.charCodeAt(0))
  const tiff = o
  const u16 = (wo, wert) => s.setUint16(wo, wert, klein)
  const u32 = (wo, wert) => s.setUint32(wo, wert, klein)
  s.setUint16(tiff, klein ? 0x4949 : 0x4d4d)   // 'II' / 'MM'
  u16(tiff + 2, 0x002a)
  u32(tiff + 4, 8)                             // IFD0 bei tiff+8
  u16(tiff + 8, 1)                             // IFD0: 1 Eintrag
  u16(tiff + 10, 0x8769)                       //   Zeiger aufs Exif-Verzeichnis
  u16(tiff + 12, 4)
  u32(tiff + 14, 1)
  u32(tiff + 18, 26)                           //   Exif-IFD bei tiff+26
  u32(tiff + 22, 0)                            // kein weiteres IFD
  u16(tiff + 26, 1)                            // Exif-IFD: 1 Eintrag
  u16(tiff + 28, 0x9003)                       //   DateTimeOriginal
  u16(tiff + 30, 2)                            //   ASCII
  u32(tiff + 32, 20)                           //   20 Zeichen -> Wert ist Offset
  u32(tiff + 36, 44)                           //   Text bei tiff+44
  u32(tiff + 40, 0)
  for (let i = 0; i < 19; i++) s.setUint8(tiff + 44 + i, text.charCodeAt(i))
  s.setUint8(tiff + 63, 0)
  s.setUint16(gesamt - 2, 0xffd9)              // EOI
  return puffer
}

const SOLL_MS = new Date(2026, 7, 8, 14, 3, 21).getTime()
p('ExifJpeg', 'little endian (II) gelesen', exifAufnahmezeit(baueExifJpeg('2026:08:08 14:03:21', true)), SOLL_MS)
p('ExifJpeg', 'big endian (MM) gelesen', exifAufnahmezeit(baueExifJpeg('2026:08:08 14:03:21', false)), SOLL_MS)
p('ExifJpeg', 'JPEG ohne Exif -> null (Gerätezeit)', exifAufnahmezeit(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer), null)
p('ExifJpeg', 'kein JPEG -> null', exifAufnahmezeit(new Uint8Array([1, 2, 3, 4]).buffer), null)
p('ExifJpeg', 'leerer Puffer -> null', exifAufnahmezeit(new ArrayBuffer(0)), null)

// ---------------------------------------------------------------- Prüfsumme
p('SHA-256', 'bekannter Prüfvektor "abc"',
  await sha256Hex(new TextEncoder().encode('abc')),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')

// ---------------------------------------------------------------- Verfallsregel
const JETZT = 1000000000000
const frisch = { phase: 'nachher', erstelltAm: JETZT - 60000 }
p('Verfall', 'offline lädt NIE', sollteJetztLaden({ phase: 'vorher', erstelltAm: 0 }, { online: false }), false)
p('Verfall', 'Rückfallweg (nicht sparsam): sofort', sollteJetztLaden(frisch, { online: true, jetzt: JETZT, sparsam: false }), true)
p('Verfall', 'Vorher IMMER sofort (unwiederholbar)',
  sollteJetztLaden({ phase: 'vorher', erstelltAm: JETZT }, { online: true, jetzt: JETZT, wartend: 1, sparsam: true }), true)
p('Verfall', 'Rest wartet, solange Schwellen nicht reißen',
  sollteJetztLaden(frisch, { online: true, jetzt: JETZT, wartend: 3, sparsam: true }), false)
p('Verfall', `ab ${VERFALL.bilder} Bildern zwingend`,
  sollteJetztLaden(frisch, { online: true, jetzt: JETZT, wartend: VERFALL.bilder, sparsam: true }), true)
p('Verfall', `älter als ${VERFALL.stunden} h zwingend`,
  sollteJetztLaden({ phase: 'nachher', erstelltAm: JETZT - (VERFALL.stunden * 3600000 + 1) },
    { online: true, jetzt: JETZT, wartend: 1, sparsam: true }), true)

// ---------------------------------------------------------------- Fototafel-Felder
p('Fototafel', 'auftrag+vorher', fotoStandFeld('auftrag', 'vorher'), 'auftragVorher')
p('Fototafel', 'auftrag+nachher', fotoStandFeld('auftrag', 'nachher'), 'auftragNachher')
p('Fototafel', 'regie+vorher', fotoStandFeld('regie', 'vorher'), 'regieVorher')
p('Fototafel', 'regie+nachher', fotoStandFeld('regie', 'nachher'), 'regieNachher')
p('Fototafel', 'unbekannter Kontext fällt auf Auftrag', fotoStandFeld('', 'vorher'), 'auftragVorher')

// ---------------------------------------------------------------- Ampel
const raum1 = { fotoStand: { auftragVorher: 1, auftragNachher: 0, regieVorher: 0, regieNachher: 0 } }
p('Ampel', 'ohne Anordnung nur ZWEI Plätze (keine leeren Pflichtfelder)',
  fotoAmpel(raum1).plaetze.map((x) => x.feld), ['auftragVorher', 'auftragNachher'])
p('Ampel', 'Fehlliste ohne Anordnung', fotoAmpel(raum1).fehlt, ['auftragNachher'])
p('Ampel', 'mit Anordnung VIER Plätze',
  fotoAmpel(raum1, { regieAngeordnet: true }).plaetze.map((x) => x.feld),
  ['auftragVorher', 'auftragNachher', 'regieVorher', 'regieNachher'])
p('Ampel', 'Fehlliste mit Anordnung',
  fotoAmpel(raum1, { regieAngeordnet: true }).fehlt, ['auftragNachher', 'regieVorher', 'regieNachher'])
p('Ampel', 'vollständig, wenn nichts fehlt',
  fotoAmpel({ fotoStand: { auftragVorher: 2, auftragNachher: 1 } }).vollstaendig, true)
p('Ampel', 'Raum ohne fotoStand: alles offen', fotoAmpel({}).fehlt, ['auftragVorher', 'auftragNachher'])
p('Ampel', 'kaputte Werte werden 0', fotoAmpel({ fotoStand: { auftragVorher: 'x' } }).plaetze[0].anzahl, 0)

// ---------------------------------------------------------------- fotos-Dokument
const eintrag = {
  id: 'f-1', projektId: 'p1', raumId: 'r1', anordnungId: '', aufgabeIds: ['auf-r1-s1'],
  phase: 'nachher', kontext: 'auftrag', rolle: 'raumabschluss',
  sha256: 'deadbeef', aufgenommenAm: 111, aufgenommenAmQuelle: 'exif',
  groessen: { beweis: 400000, druck: 150000, vorschau: 30000 },
  von: 'Ahmad', vonId: 'u-ahmad', datum: '2026-08-08', erstelltAm: 222,
}
const lokalDoc = fotosDokument(eintrag, 'lokal')
p('Dokument', 'NIE ein dataUrl im fotos-Dokument (Regel lehnt sonst ab)', 'dataUrl' in lokalDoc, false)
p('Dokument', 'status lokal ohne Vorschau-Verweis', [lokalDoc.status, lokalDoc.vorschauPhotoId], ['lokal', ''])
p('Dokument', 'Prüfsumme + Zeitquelle wandern mit',
  [lokalDoc.sha256, lokalDoc.aufgenommenAmQuelle], ['deadbeef', 'exif'])
const hochDoc = fotosDokument(eintrag, 'hochgeladen')
p('Dokument', 'hochgeladen verweist auf pv-Dokument', hochDoc.vorschauPhotoId, 'pv-f-1')
p('Dokument', 'hochgeladenAm wird gestempelt', typeof hochDoc.hochgeladenAm, 'number')
p('Dokument', 'deterministische Vorschau-Kennung', vorschauPhotoId('abc'), 'pv-abc')

// ---------------------------------------------------------------- Ausgabe
const kaputt = faelle.filter((f) => !f.ok)
for (const f of faelle) {
  if (!f.ok) {
    console.log(`FEHLT  [${f.bereich}] ${f.name}`)
    console.log(`       ist:  ${JSON.stringify(f.ist)}`)
    console.log(`       soll: ${JSON.stringify(f.soll)}`)
  }
}
console.log(`\n${faelle.length - kaputt.length} von ${faelle.length} Fällen bestanden.`)
if (kaputt.length) {
  console.log(`${kaputt.length} FEHLGESCHLAGEN – nicht ausliefern.`)
  process.exit(1)
}
