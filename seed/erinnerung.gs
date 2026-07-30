/**
 * Praxis-Mail-Dienst 2.0 – Praxis an der Wertachbrücke
 * =====================================================
 * - Hübsche HTML-Mails im Praxis-Design (grün/weiß), in DE / EN / AR
 * - Bestätigungs-Mail mit ABSAGE-LINK: ein Klick sagt den Termin wirklich ab
 *   (direkt in der Firestore-Datenbank), Slot wird wieder frei
 * - Absage unter 24 Stunden vor dem Termin: Patient bekommt automatisch
 *   die Ausfallgebühr-Mail (50 €)
 * - Tägliche Erinnerungen 1 Tag vorher – direkt aus der Datenbank,
 *   ebenfalls mit Absage-Link
 *
 * ===== EINRICHTUNG / UPDATE (Konto: nasirdada.98@gmail.com) =====
 * 1. https://script.google.com -> dein Projekt öffnen
 * 2. Links Zahnrad "Projekteinstellungen" -> Haken bei
 *    'Manifestdatei "appsscript.json" im Editor anzeigen'
 * 3. Im Editor die Datei appsscript.json öffnen und KOMPLETT durch den Inhalt
 *    von seed/appsscript.json ersetzen (Berechtigungen für Datenbank-Zugriff)
 * 4. Diese Datei (Code.gs) komplett durch diesen Code ersetzen -> Speichern
 * 5. Einmal die Funktion "testMail" ausführen -> neue Berechtigungen bestätigen
 * 6. WICHTIG: "Bereitstellen" -> "Bereitstellungen verwalten" -> Stift ✎ ->
 *    Version: "Neue Version" -> Bereitstellen
 *    (so bleibt die /exec-URL gleich – nichts in der App zu ändern!)
 * 7. Trigger (Wecker links) einrichten:
 *    - sendeErinnerungen      · Zeitgesteuert · Täglich · 17–18 Uhr
 *    - sendeFeedbackAnfragen  · Zeitgesteuert · Stündlich
 */

var SECRET = 'wertach-mail-2026';
var PROJECT_ID = 'praxis-an-der-wertachbru-1d36d';
var PRAXIS_NAME = 'Praxis an der Wertachbrücke';
var PRAXIS_TELEFON = '0821 / 42 22 05';
var PRAXIS_ADRESSE = 'Schöpplerstraße 4, 86154 Augsburg';
var WEBSEITE = 'https://praxis-an-der-wertachbru-1d36d.web.app';
var GEBUEHR = '50 €';

// ================= Übersetzungen =================

var TEXTE = {
  de: {
    anrede: function (n) { return 'Guten Tag ' + n + ','; },
    bestBetreff: function (d) { return 'Terminbestätigung: ' + d.datum + ' um ' + d.start + ' Uhr'; },
    bestTitel: 'Ihr Termin ist bestätigt ✓',
    bestText: 'wir freuen uns auf Ihren Besuch. Hier sind Ihre Termindaten:',
    lBehandlung: 'Behandlung', lDatum: 'Datum', lZeit: 'Uhrzeit', lPraxis: 'Praxis',
    uhr: 'Uhr',
    erinnerungInfo: 'Einen Tag vor dem Termin erhalten Sie automatisch eine Erinnerung per E-Mail.',
    absagenKnopf: 'Termin absagen',
    stornoRegel: 'Absagen sind bis 24 Stunden vor dem Termin kostenfrei. Bei kurzfristigeren Absagen fällt eine Ausfallgebühr von ' + GEBUEHR + ' an.',
    absBetreff: 'Ihre Terminanfrage',
    absTitel: 'Ihr Wunschtermin ist leider nicht möglich',
    absText: function (d) { return 'leider können wir Ihren Wunschtermin am ' + d.datum + ' um ' + d.start + ' Uhr nicht anbieten. Bitte buchen Sie online einen anderen Termin oder rufen Sie uns an – wir finden gemeinsam eine gute Alternative.'; },
    absGruende: {
      telefon: 'Ihre Telefonnummer scheint nicht korrekt zu sein. Bitte rufen Sie uns kurz an, damit wir den Termin gemeinsam bestätigen können: ' + PRAXIS_TELEFON,
      ausgebucht: 'Der gewünschte Zeitpunkt ist leider bereits ausgebucht.',
      urlaub: 'Unsere Praxis ist zu diesem Zeitpunkt im Urlaub.',
    },
    neuBuchenKnopf: 'Neuen Termin buchen',
    erinBetreff: function (d) { return 'Terminerinnerung: morgen um ' + d.start + ' Uhr'; },
    erinTitel: 'Ihr Termin ist morgen 🦷',
    erinText: 'wir erinnern Sie freundlich an Ihren Termin morgen:',
    gebBetreff: 'Kurzfristige Absage – Ausfallgebühr ' + GEBUEHR,
    gebTitel: 'Ausfallgebühr für kurzfristige Absage',
    gebText: function (d) { return 'Sie haben Ihren Termin am ' + d.datum + ' um ' + d.start + ' Uhr weniger als 24 Stunden vorher abgesagt. Gemäß unserer Praxisregelung fällt dafür eine Ausfallgebühr von ' + GEBUEHR + ' an. Sie erhalten dazu in den nächsten Tagen eine Rechnung. Vielen Dank für Ihr Verständnis.'; },
    fbBetreff: 'Wie war Ihr Besuch bei uns?',
    fbTitel: 'Ihre Meinung ist uns wichtig 💚',
    fbText: 'vielen Dank für Ihren Besuch! Wie zufrieden waren Sie? Ihre Rückmeldung geht vertraulich direkt an unser Team und dauert weniger als eine Minute.',
    fbKnopf: 'Jetzt bewerten',
    fuss: 'Herzliche Grüße<br>Ihr Team der ' + PRAXIS_NAME,
    fragen: 'Fragen? Rufen Sie uns an:',
    seiteOkTitel: 'Termin abgesagt',
    seiteOkText: 'Ihr Termin wurde abgesagt. Der Platz ist wieder frei – danke für die rechtzeitige Nachricht!',
    seiteGebText: 'Ihr Termin wurde abgesagt. Da die Absage weniger als 24 Stunden vor dem Termin erfolgt, fällt eine Ausfallgebühr von ' + GEBUEHR + ' an – Sie erhalten dazu eine E-Mail.',
    seiteSchonTitel: 'Bereits abgesagt',
    seiteSchonText: 'Dieser Termin wurde bereits abgesagt.',
    seiteFehlerTitel: 'Link ungültig',
    seiteFehlerText: 'Dieser Absage-Link ist ungültig oder abgelaufen. Bitte rufen Sie uns an: ' + PRAXIS_TELEFON,
    seiteNeuBuchen: 'Neuen Termin buchen',
  },
  en: {
    anrede: function (n) { return 'Dear ' + n + ','; },
    bestBetreff: function (d) { return 'Appointment confirmed: ' + d.datum + ' at ' + d.start; },
    bestTitel: 'Your appointment is confirmed ✓',
    bestText: 'we look forward to your visit. Here are your appointment details:',
    lBehandlung: 'Treatment', lDatum: 'Date', lZeit: 'Time', lPraxis: 'Practice',
    uhr: '',
    erinnerungInfo: 'You will automatically receive a reminder e-mail one day before your appointment.',
    absagenKnopf: 'Cancel appointment',
    stornoRegel: 'Cancellation is free of charge up to 24 hours before the appointment. For later cancellations a fee of ' + GEBUEHR + ' applies.',
    absBetreff: 'Your appointment request',
    absTitel: 'Your requested time is unfortunately not available',
    absText: function (d) { return 'unfortunately we cannot offer your requested appointment on ' + d.datum + ' at ' + d.start + '. Please book another time online or give us a call – we will find a good alternative together.'; },
    absGruende: {
      telefon: 'Your phone number appears to be incorrect. Please give us a quick call so we can confirm the appointment together: ' + PRAXIS_TELEFON,
      ausgebucht: 'The requested time is unfortunately already fully booked.',
      urlaub: 'Our practice is on holiday at that time.',
    },
    neuBuchenKnopf: 'Book a new appointment',
    erinBetreff: function (d) { return 'Reminder: your appointment tomorrow at ' + d.start; },
    erinTitel: 'Your appointment is tomorrow 🦷',
    erinText: 'this is a friendly reminder of your appointment tomorrow:',
    gebBetreff: 'Late cancellation – ' + GEBUEHR + ' fee',
    gebTitel: 'Fee for late cancellation',
    gebText: function (d) { return 'You cancelled your appointment on ' + d.datum + ' at ' + d.start + ' less than 24 hours in advance. According to our practice policy a fee of ' + GEBUEHR + ' applies. You will receive an invoice within the next days. Thank you for your understanding.'; },
    fbBetreff: 'How was your visit?',
    fbTitel: 'Your opinion matters to us 💚',
    fbText: 'thank you for your visit! How satisfied were you? Your feedback goes confidentially to our team and takes less than a minute.',
    fbKnopf: 'Rate now',
    fuss: 'Kind regards<br>Your team at ' + PRAXIS_NAME,
    fragen: 'Questions? Call us:',
    seiteOkTitel: 'Appointment cancelled',
    seiteOkText: 'Your appointment has been cancelled. The slot is free again – thank you for letting us know in time!',
    seiteGebText: 'Your appointment has been cancelled. As the cancellation was made less than 24 hours in advance, a fee of ' + GEBUEHR + ' applies – you will receive an e-mail about this.',
    seiteSchonTitel: 'Already cancelled',
    seiteSchonText: 'This appointment has already been cancelled.',
    seiteFehlerTitel: 'Invalid link',
    seiteFehlerText: 'This cancellation link is invalid or expired. Please call us: ' + PRAXIS_TELEFON,
    seiteNeuBuchen: 'Book a new appointment',
  },
  ar: {
    anrede: function (n) { return 'مرحبًا ' + n + '،'; },
    bestBetreff: function (d) { return 'تأكيد الموعد: ' + d.datum + ' الساعة ' + d.start; },
    bestTitel: 'تم تأكيد موعدك ✓',
    bestText: 'نتطلع إلى زيارتك. إليك تفاصيل موعدك:',
    lBehandlung: 'العلاج', lDatum: 'التاريخ', lZeit: 'الوقت', lPraxis: 'العيادة',
    uhr: '',
    erinnerungInfo: 'ستصلك رسالة تذكير تلقائيًا قبل الموعد بيوم واحد.',
    absagenKnopf: 'إلغاء الموعد',
    stornoRegel: 'الإلغاء مجاني حتى 24 ساعة قبل الموعد. عند الإلغاء المتأخر تُفرض رسوم قدرها ' + GEBUEHR + '.',
    absBetreff: 'طلب موعدك',
    absTitel: 'للأسف الموعد المطلوب غير متاح',
    absText: function (d) { return 'للأسف لا يمكننا تقديم موعدك المطلوب في ' + d.datum + ' الساعة ' + d.start + '. يرجى حجز موعد آخر عبر الإنترنت أو الاتصال بنا – سنجد بديلًا مناسبًا معًا.'; },
    absGruende: {
      telefon: 'يبدو أن رقم هاتفك غير صحيح. يرجى الاتصال بنا سريعًا حتى نؤكد الموعد معًا: ' + PRAXIS_TELEFON,
      ausgebucht: 'الوقت المطلوب محجوز بالكامل للأسف.',
      urlaub: 'عيادتنا في إجازة في ذلك الوقت.',
    },
    neuBuchenKnopf: 'احجز موعدًا جديدًا',
    erinBetreff: function (d) { return 'تذكير: موعدك غدًا الساعة ' + d.start; },
    erinTitel: 'موعدك غدًا 🦷',
    erinText: 'نذكرك بلطف بموعدك غدًا:',
    gebBetreff: 'إلغاء متأخر – رسوم ' + GEBUEHR,
    gebTitel: 'رسوم الإلغاء المتأخر',
    gebText: function (d) { return 'لقد ألغيت موعدك في ' + d.datum + ' الساعة ' + d.start + ' قبل أقل من 24 ساعة. وفقًا لقواعد عيادتنا تُفرض رسوم قدرها ' + GEBUEHR + '. ستصلك فاتورة خلال الأيام القادمة. شكرًا لتفهمك.'; },
    fbBetreff: 'كيف كانت زيارتك لدينا؟',
    fbTitel: 'رأيك يهمنا 💚',
    fbText: 'شكرًا لزيارتك! ما مدى رضاك؟ ملاحظاتك تصل بسرية إلى فريقنا وتستغرق أقل من دقيقة.',
    fbKnopf: 'قيّم الآن',
    fuss: 'مع أطيب التحيات<br>فريق ' + PRAXIS_NAME,
    fragen: 'أسئلة؟ اتصل بنا:',
    seiteOkTitel: 'تم إلغاء الموعد',
    seiteOkText: 'تم إلغاء موعدك والوقت أصبح متاحًا من جديد – شكرًا لإخبارنا في الوقت المناسب!',
    seiteGebText: 'تم إلغاء موعدك. بما أن الإلغاء تم قبل أقل من 24 ساعة، تُفرض رسوم قدرها ' + GEBUEHR + ' – ستصلك رسالة بذلك.',
    seiteSchonTitel: 'أُلغي مسبقًا',
    seiteSchonText: 'هذا الموعد أُلغي من قبل.',
    seiteFehlerTitel: 'رابط غير صالح',
    seiteFehlerText: 'رابط الإلغاء غير صالح أو منتهي. يرجى الاتصال بنا: ' + PRAXIS_TELEFON,
    seiteNeuBuchen: 'احجز موعدًا جديدًا',
  },
};

function texte(sprache) {
  return TEXTE[sprache] || TEXTE.de;
}

// ================= HTML-Vorlage im Praxis-Design =================

function htmlMail(sprache, titel, inhalt) {
  var t = texte(sprache);
  var rtl = sprache === 'ar';
  return (
    '<div dir="' + (rtl ? 'rtl' : 'ltr') + '" style="margin:0;padding:24px 12px;background:#ecfdf5;font-family:Segoe UI,Arial,sans-serif;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #d1fae5;">' +
    // Kopf im Webseiten-Stil
    '<div style="background:linear-gradient(135deg,#059669,#047857);padding:26px 30px;color:#ffffff;">' +
    '<div style="font-size:26px;line-height:1;">🦷</div>' +
    '<div style="font-size:19px;font-weight:700;margin-top:8px;">' + PRAXIS_NAME + '</div>' +
    '<div style="font-size:12px;opacity:.85;">Ingeborg Steidle &amp; Kollegen · Augsburg</div>' +
    '</div>' +
    // Inhalt
    '<div style="padding:28px 30px;color:#0f172a;font-size:15px;line-height:1.6;">' +
    '<h1 style="margin:0 0 14px;font-size:20px;color:#065f46;">' + titel + '</h1>' +
    inhalt +
    '<p style="margin-top:26px;">' + t.fuss + '</p>' +
    '</div>' +
    // Fuß
    '<div style="background:#f0fdf4;border-top:1px solid #d1fae5;padding:16px 30px;font-size:12px;color:#64748b;">' +
    PRAXIS_NAME + ' · ' + PRAXIS_ADRESSE + '<br>' +
    t.fragen + ' <strong style="color:#065f46;">' + PRAXIS_TELEFON + '</strong> · <a href="' + WEBSEITE + '" style="color:#059669;">' + WEBSEITE.replace('https://', '') + '</a>' +
    '</div></div></div>'
  );
}

function terminKarte(sprache, d) {
  var t = texte(sprache);
  function zeile(label, wert) {
    return '<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px;">' + label + '</td>' +
      '<td style="padding:6px 0;font-weight:700;color:#0f172a;">' + wert + '</td></tr>';
  }
  return '<table style="width:100%;background:#ecfdf5;border-radius:14px;padding:6px 18px;border-collapse:separate;margin:14px 0;">' +
    zeile(t.lBehandlung, d.behandlung || '–') +
    zeile(t.lDatum, d.datum) +
    zeile(t.lZeit, d.start + (t.uhr ? ' ' + t.uhr : '')) +
    zeile(t.lPraxis, PRAXIS_NAME + ', ' + PRAXIS_ADRESSE) +
    '</table>';
}

function knopf(url, beschriftung, farbe) {
  return '<div style="text-align:center;margin:20px 0 6px;">' +
    '<a href="' + url + '" style="display:inline-block;background:' + (farbe || '#059669') + ';color:#ffffff;text-decoration:none;font-weight:700;padding:13px 30px;border-radius:999px;font-size:15px;">' +
    beschriftung + '</a></div>';
}

// ================= Sofort-Mails (aus der Praxis-Verwaltung) =================

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return antwortJson({ ok: false, fehler: 'verboten' });
    var t = texte(d.sprache);
    var betreff, html;

    if (d.typ === 'bestaetigung') {
      betreff = t.bestBetreff(d);
      var inhalt = '<p>' + t.anrede(d.name || '') + '</p><p>' + t.bestText + '</p>' + terminKarte(d.sprache, d) +
        '<p style="font-size:13px;color:#64748b;">' + t.erinnerungInfo + '</p>';
      if (d.terminId && d.stornoToken) {
        var link = ScriptApp.getService().getUrl() +
          '?aktion=absage&termin=' + encodeURIComponent(d.terminId) +
          '&token=' + encodeURIComponent(d.stornoToken) +
          '&sprache=' + encodeURIComponent(d.sprache || 'de');
        inhalt += knopf(link, t.absagenKnopf, '#dc2626') +
          '<p style="font-size:12px;color:#94a3b8;text-align:center;">' + t.stornoRegel + '</p>';
      }
      html = htmlMail(d.sprache, t.bestTitel, inhalt);
    } else if (d.typ === 'absage') {
      betreff = t.absBetreff;
      var absInhalt = '<p>' + t.anrede(d.name || '') + '</p>';
      // Optionaler Ablehnungsgrund aus der Verwaltung (telefon | ausgebucht | urlaub)
      if (d.grund && t.absGruende && t.absGruende[d.grund]) {
        absInhalt += '<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-weight:bold;">' +
          t.absGruende[d.grund] + '</p>';
      }
      absInhalt += '<p>' + t.absText(d) + '</p>' + knopf(WEBSEITE + '/#/termin', t.neuBuchenKnopf);
      html = htmlMail(d.sprache, t.absTitel, absInhalt);
    } else if (d.typ === 'gebuehr') {
      // Ausfallhonorar bei kurzfristiger Absage über die Verwaltung
      betreff = t.gebBetreff;
      html = htmlMail(d.sprache, t.gebTitel,
        '<p>' + t.anrede(d.name || '') + '</p><p>' + t.gebText(d) + '</p>' + terminKarte(d.sprache, d));
    } else {
      return antwortJson({ ok: false, fehler: 'unbekannter typ' });
    }

    MailApp.sendEmail(d.email, betreff, ' ', { htmlBody: html, name: PRAXIS_NAME });
    return antwortJson({ ok: true });
  } catch (fehler) {
    return antwortJson({ ok: false, fehler: String(fehler) });
  }
}

function antwortJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj));
}

// ================= Absage-Link (doGet) =================

function doGet(e) {
  var p = e.parameter || {};
  if (p.aktion !== 'absage') {
    return HtmlService.createHtmlOutput('<p>Praxis-Mail-Dienst aktiv.</p>');
  }
  var sprache = p.sprache || 'de';
  var t = texte(sprache);

  var doc = firestoreGet('appointments/' + p.termin);
  if (!doc || feld(doc, 'stornoToken') !== p.token || !p.token) {
    return stornoSeite(sprache, t.seiteFehlerTitel, t.seiteFehlerText, false);
  }
  if (feld(doc, 'status') === 'abgesagt') {
    return stornoSeite(sprache, t.seiteSchonTitel, t.seiteSchonText, false);
  }

  // Termin absagen + Slot freigeben
  firestorePatch('appointments/' + p.termin, { status: 'abgesagt' });
  firestoreDelete('slots/' + p.termin);

  // Weniger als 24h vorher? -> Ausfallgebühr-Mail (50 €)
  var start = new Date(feld(doc, 'datum') + 'T' + feld(doc, 'start') + ':00');
  var stundenVorher = (start.getTime() - Date.now()) / 3600000;
  var kurzfristig = stundenVorher > 0 && stundenVorher < 24;

  if (kurzfristig) {
    var email = feld(doc, 'patientEmail');
    if (email) {
      var d = {
        name: feld(doc, 'patientName'),
        datum: deutschesDatum(feld(doc, 'datum')),
        start: feld(doc, 'start'),
        behandlung: feld(doc, 'behandlung'),
      };
      MailApp.sendEmail(email, t.gebBetreff, ' ', {
        htmlBody: htmlMail(sprache, t.gebTitel, '<p>' + t.anrede(d.name) + '</p><p>' + t.gebText(d) + '</p>' + terminKarte(sprache, d)),
        name: PRAXIS_NAME,
      });
    }
  }

  return stornoSeite(sprache, t.seiteOkTitel, kurzfristig ? t.seiteGebText : t.seiteOkText, !kurzfristig);
}

// Bestätigungsseite nach Klick auf den Absage-Link – im Webseiten-Stil
function stornoSeite(sprache, titel, text, gruen) {
  var t = texte(sprache);
  var rtl = sprache === 'ar';
  var farbe = gruen ? '#059669' : '#d97706';
  var symbol = gruen ? '✓' : '!';
  var html =
    '<!doctype html><html lang="' + sprache + '" dir="' + (rtl ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + titel + '</title></head>' +
    '<body style="margin:0;background:#ecfdf5;font-family:Segoe UI,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;">' +
    '<div style="max-width:430px;background:#fff;border-radius:24px;border:1px solid #d1fae5;padding:38px 34px;text-align:center;">' +
    '<div style="width:64px;height:64px;border-radius:999px;background:' + farbe + ';color:#fff;font-size:32px;font-weight:700;line-height:64px;margin:0 auto 18px;">' + symbol + '</div>' +
    '<h1 style="margin:0 0 10px;font-size:22px;color:#065f46;">' + titel + '</h1>' +
    '<p style="color:#475569;font-size:15px;line-height:1.6;">' + text + '</p>' +
    '<a href="' + WEBSEITE + '/#/termin" style="display:inline-block;margin-top:18px;background:#059669;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:999px;">' + t.seiteNeuBuchen + '</a>' +
    '<p style="margin-top:18px;font-size:12px;color:#94a3b8;">' + PRAXIS_NAME + ' · ' + PRAXIS_TELEFON + '</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html);
}

// ================= Tägliche Erinnerungen (Trigger 17–18 Uhr) =================
// Liest die Termine direkt aus der Firestore-Datenbank – kein Google Kalender nötig.

function sendeErinnerungen() {
  var morgen = new Date(Date.now() + 24 * 3600000);
  var iso = Utilities.formatDate(morgen, 'Europe/Berlin', 'yyyy-MM-dd');
  var termine = firestoreQuery('appointments', [
    { feldname: 'datum', wert: iso },
    { feldname: 'status', wert: 'bestaetigt' },
  ]);
  var gesendet = 0;
  var ohneMail = [];

  for (var i = 0; i < termine.length; i++) {
    var doc = termine[i];
    var id = doc.name.split('/').pop();
    var email = feld(doc, 'patientEmail');
    var d = {
      name: feld(doc, 'patientName'),
      datum: deutschesDatum(feld(doc, 'datum')),
      start: feld(doc, 'start'),
      behandlung: feld(doc, 'behandlung'),
    };
    if (!email) {
      ohneMail.push(d.start + ' – ' + d.name + ' (' + d.behandlung + ')');
      continue;
    }
    var sprache = feld(doc, 'sprache') || 'de';
    var t = texte(sprache);
    var inhalt = '<p>' + t.anrede(d.name) + '</p><p>' + t.erinText + '</p>' + terminKarte(sprache, d);
    var token = feld(doc, 'stornoToken');
    if (token) {
      var link = ScriptApp.getService().getUrl() + '?aktion=absage&termin=' + id + '&token=' + encodeURIComponent(token) + '&sprache=' + sprache;
      inhalt += knopf(link, t.absagenKnopf, '#dc2626') +
        '<p style="font-size:12px;color:#94a3b8;text-align:center;">' + t.stornoRegel + '</p>';
    }
    MailApp.sendEmail(email, t.erinBetreff(d), ' ', { htmlBody: htmlMail(sprache, t.erinTitel, inhalt), name: PRAXIS_NAME });
    firestorePatch('appointments/' + id, { erinnerung: 'gesendet' });
    gesendet++;
  }

  if (ohneMail.length > 0) {
    MailApp.sendEmail(Session.getActiveUser().getEmail(),
      'Bitte anrufen: ' + ohneMail.length + ' Erinnerungen für morgen ohne E-Mail',
      'Diese Patienten bitte telefonisch an morgen erinnern:\n\n' + ohneMail.join('\n'),
      { name: PRAXIS_NAME });
  }
  Logger.log('Erinnerungen gesendet: ' + gesendet + ', ohne E-Mail: ' + ohneMail.length);
}

// ================= Feedback-Anfragen (Trigger: stündlich) =================
// Einige Stunden nach "Behandlung abschließen" bekommt der Patient automatisch
// die Feedback-Mail mit persönlichem Link (Qualitätsmanagement, rein intern).

var FEEDBACK_VERZOEGERUNG_STUNDEN = 3;

function sendeFeedbackAnfragen() {
  var termine = firestoreQuery('appointments', [{ feldname: 'status', wert: 'abgeschlossen' }]);
  var gesendet = 0;

  for (var i = 0; i < termine.length; i++) {
    var doc = termine[i];
    var id = doc.name.split('/').pop();
    var email = feld(doc, 'patientEmail');
    var token = feld(doc, 'feedbackToken');
    var fertigAm = feld(doc, 'abgeschlossenAm');
    if (!email || !token || !fertigAm) continue;
    if (feld(doc, 'feedbackAngefragt') === 'ja') continue;
    var stunden = (Date.now() - new Date(fertigAm).getTime()) / 3600000;
    if (stunden < FEEDBACK_VERZOEGERUNG_STUNDEN) continue;

    var sprache = feld(doc, 'sprache') || 'de';
    var t = texte(sprache);
    var link = WEBSEITE + '/#/feedback?id=' + id + '&token=' + encodeURIComponent(token) + '&sprache=' + sprache;
    var inhalt =
      '<p>' + t.anrede(feld(doc, 'patientName')) + '</p><p>' + t.fbText + '</p>' +
      '<div style="text-align:center;font-size:30px;letter-spacing:6px;margin:14px 0;">★★★★★</div>' +
      knopf(link, t.fbKnopf);
    MailApp.sendEmail(email, t.fbBetreff, ' ', { htmlBody: htmlMail(sprache, t.fbTitel, inhalt), name: PRAXIS_NAME });
    firestorePatch('appointments/' + id, { feedbackAngefragt: 'ja' });
    gesendet++;
  }
  Logger.log('Feedback-Anfragen gesendet: ' + gesendet);
}

// ================= Firestore-Helfer (REST, als Skript-Besitzer) =================

var FS_BASIS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/';

function fsAnfrage(pfad, methode, body) {
  var optionen = {
    method: methode,
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
  };
  if (body) {
    optionen.contentType = 'application/json';
    optionen.payload = JSON.stringify(body);
  }
  var antwort = UrlFetchApp.fetch(FS_BASIS.replace(/documents\/$/, pfad.indexOf(':') === 0 ? 'documents' + pfad : 'documents/' + pfad), optionen);
  if (antwort.getResponseCode() >= 300) return null;
  return JSON.parse(antwort.getContentText() || 'null');
}

function firestoreGet(pfad) { return fsAnfrage(pfad, 'get'); }
function firestoreDelete(pfad) { return fsAnfrage(pfad, 'delete'); }

function firestorePatch(pfad, felder) {
  var fields = {};
  var masken = [];
  for (var k in felder) {
    fields[k] = { stringValue: String(felder[k]) };
    masken.push('updateMask.fieldPaths=' + k);
  }
  var url = FS_BASIS + pfad + '?' + masken.join('&');
  UrlFetchApp.fetch(url, {
    method: 'patch',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ fields: fields }),
  });
}

function firestoreQuery(sammlung, filter) {
  var bedingungen = filter.map(function (f) {
    return { fieldFilter: { field: { fieldPath: f.feldname }, op: 'EQUAL', value: { stringValue: f.wert } } };
  });
  var body = {
    structuredQuery: {
      from: [{ collectionId: sammlung }],
      where: { compositeFilter: { op: 'AND', filters: bedingungen } },
    },
  };
  var antwort = fsAnfrage(':runQuery', 'post', body);
  if (!antwort) return [];
  return antwort.filter(function (z) { return z.document; }).map(function (z) { return z.document; });
}

function feld(doc, name) {
  try { return doc.fields[name].stringValue; } catch (e) { return ''; }
}

function deutschesDatum(iso) {
  var teile = iso.split('-');
  return teile[2] + '.' + teile[1] + '.' + teile[0];
}

// Zum Testen im Editor ausführen (bestätigt auch die neuen Berechtigungen)
function testMail() {
  var d = { name: 'Test Patient', datum: '09.07.2026', start: '10:00', behandlung: 'Kontrolluntersuchung', sprache: 'de', email: Session.getActiveUser().getEmail() };
  var t = texte('de');
  MailApp.sendEmail(d.email, '[TEST] ' + t.bestBetreff(d), ' ', {
    htmlBody: htmlMail('de', t.bestTitel, '<p>' + t.anrede(d.name) + '</p><p>' + t.bestText + '</p>' + terminKarte('de', d) + knopf('#', t.absagenKnopf, '#dc2626')),
    name: PRAXIS_NAME,
  });
  Logger.log('Testmail gesendet an ' + d.email + ' – Firestore-Zugriff: ' + (firestoreGet('katalog/kat-0010') ? 'OK' : 'FEHLER'));
}
