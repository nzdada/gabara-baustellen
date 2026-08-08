// Wissensdatenbank der Gabara-Verwaltung – zweisprachig (deutsch / arabisch).
//
// Bewusst NICHT in shared/texte.js: dort liegen kurze Oberflächen-Bausteine mit
// festen Schlüsseln. Hier stehen ganze Artikel – Struktur, Reihenfolge und
// Zusammenhang gehören zum Inhalt und würden in einer flachen Schlüsselliste
// verloren gehen.
//
// Aufbau:
//   bereich = { id, icon, titel{de,ar}, sub{de,ar}, artikel: [...] }
//   artikel = { id, frage{de,ar}, antwort: [Absatz|Schritte|Merke|Tabelle], zu? }
//     zu = Route in der Verwaltung, auf die der Artikel verlinkt
//
// Absatzformen:
//   { p: {de,ar} }                     Fließtext
//   { schritte: [{de,ar}, ...] }       nummerierte Anleitung
//   { merke: {de,ar} }                 hervorgehobener Hinweis
//   { achtung: {de,ar} }               Warnung (rot)
//
// Beim Ergänzen: IMMER beide Sprachen füllen. Ein fehlendes ar fällt auf de
// zurück (tr()), das fällt aber im Betrieb niemandem auf – und dann steht
// dauerhaft Deutsch in der arabischen Ansicht.

export const WISSEN = [
  // =====================================================================
  {
    id: 'start',
    icon: 'home',
    titel: { de: 'Erste Schritte', ar: 'الخطوات الأولى' },
    sub: {
      de: 'Wie die Verwaltung aufgebaut ist und in welcher Reihenfolge gearbeitet wird',
      ar: 'كيف تُبنى الإدارة وبأي ترتيب يتم العمل',
    },
    artikel: [
      {
        id: 'ablauf',
        frage: { de: 'Wie läuft eine Baustelle von Anfang bis Ende durch das System?', ar: 'كيف تمرّ ورشة البناء عبر النظام من البداية إلى النهاية؟' },
        antwort: [
          { p: {
            de: 'Das System bildet den Weg ab, den eine Baustelle im Betrieb ohnehin nimmt. Jeder Schritt baut auf dem vorigen auf – wer einen überspringt, merkt es spätestens bei der Rechnung.',
            ar: 'يعكس النظام المسار الذي تسلكه ورشة البناء في الواقع. كل خطوة تبني على سابقتها – ومن يتخطى خطوة سيكتشف ذلك عند الفوترة على أبعد تقدير.',
          } },
          { bild: 'ablauf', unterschrift: {
            de: 'Der Weg einer Baustelle – jede Stufe baut auf der vorigen auf.',
            ar: 'مسار ورشة البناء – كل مرحلة تبني على سابقتها.',
          } },
          { schritte: [
            { de: 'Kunde anlegen (Auftraggeber oder Privatkunde).', ar: 'إنشاء العميل (مقاول عام أو عميل خاص).' },
            { de: 'Baustelle anlegen und dem Kunden zuordnen.', ar: 'إنشاء ورشة البناء وربطها بالعميل.' },
            { de: 'Leistungsverzeichnis importieren – das ist die Grundlage der späteren Abrechnung.', ar: 'استيراد جدول الكميات – وهو أساس الفوترة لاحقًا.' },
            { de: 'Termine planen und den Teams zuweisen; dabei die passenden LV-Positionen als Aufgabe anhängen.', ar: 'تخطيط المواعيد وإسنادها للفرق، مع إرفاق بنود جدول الكميات المناسبة كمهام.' },
            { de: 'Der Monteur arbeitet, meldet auf dem Handy die geleisteten Mengen und schreibt bei Zusatzarbeiten einen Regiebericht.', ar: 'ينفذ الفني العمل، ويبلّغ عن الكميات المنجزة من الهاتف، ويكتب تقرير عمل عند الأعمال الإضافية.' },
            { de: 'Das Büro prüft den Bericht und gibt ihn frei.', ar: 'يراجع المكتب التقرير ويعتمده.' },
            { de: 'Abrechnung: geleistete Mengen, freigegebene Regieberichte und Spesen zu einer Rechnung zusammenstellen und an FastBill übertragen.', ar: 'الفوترة: تجميع الكميات المنجزة وتقارير العمل المعتمدة والمصاريف في فاتورة وإرسالها إلى FastBill.' },
          ] },
          { merke: {
            de: 'Ohne Leistungsverzeichnis lässt sich zwar arbeiten, aber die Abrechnung wird zur Handarbeit. Der Import lohnt sich immer.',
            ar: 'يمكن العمل بدون جدول كميات، لكن الفوترة تصبح يدوية بالكامل. الاستيراد يستحق العناء دائمًا.',
          } },
        ],
      },
      {
        id: 'sprache',
        frage: { de: 'Wie stelle ich die Sprache um?', ar: 'كيف أغيّر اللغة؟' },
        antwort: [
          { p: {
            de: 'Oben in der Kopfzeile stehen zwei Schalter: DE und ع. Die Wahl gilt für dieses Gerät und bleibt beim nächsten Öffnen erhalten. Bei Arabisch dreht sich die gesamte Oberfläche auf rechts-nach-links.',
            ar: 'في الشريط العلوي زران: DE و ع. يسري الاختيار على هذا الجهاز ويبقى محفوظًا عند الفتح التالي. مع العربية تنقلب الواجهة كاملة من اليمين إلى اليسار.',
          } },
          { merke: {
            de: 'Die PDF-Ausdrucke bleiben immer deutsch – auch wenn die Oberfläche arabisch steht. Sie gehen an Auftraggeber, Lohnbüro, Finanzamt und im Streitfall ans Gericht.',
            ar: 'تبقى ملفات PDF بالألمانية دائمًا – حتى لو كانت الواجهة عربية. فهي موجّهة لصاحب العمل ومكتب الرواتب ودائرة الضرائب وربما المحكمة.',
          } },
        ],
      },
      {
        id: 'rollen',
        frage: { de: 'Was ist der Unterschied zwischen Büro und Monteur?', ar: 'ما الفرق بين المكتب والفني؟' },
        antwort: [
          { p: {
            de: 'Das Büro sieht die volle Verwaltung: Kalender, Baustellen, Preise, Abrechnung, Einstellungen. Der Monteur bekommt die Handy-Ansicht – nur seine Einsätze, die Aufgaben dazu, das Melden von Mengen und das Schreiben von Berichten.',
            ar: 'يرى المكتب الإدارة كاملة: التقويم وورش البناء والأسعار والفوترة والإعدادات. أما الفني فيحصل على واجهة الهاتف – مهامه فقط، والمهام المرتبطة بها، وتسجيل الكميات وكتابة التقارير.',
          } },
          { bild: 'rollen', unterschrift: {
            de: 'Zwei Ansichten auf dieselben Daten – jede zeigt nur, was gebraucht wird.',
            ar: 'واجهتان لنفس البيانات – كل منهما تعرض ما يلزم فقط.',
          } },
          { p: {
            de: 'Preise, Rechnungen und Stammdaten sieht der Monteur nicht. Wer das Handy verliert, verliert keine Kalkulation.',
            ar: 'لا يرى الفني الأسعار ولا الفواتير ولا البيانات الأساسية. من يفقد هاتفه لا يفقد حسابات التكلفة.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'kalender',
    icon: 'calendar',
    titel: { de: 'Kalender & Termine', ar: 'التقويم والمواعيد' },
    sub: { de: 'Einsätze planen, Teams zuweisen, Aufgaben anhängen', ar: 'تخطيط المهام وإسناد الفرق وإرفاق الأعمال' },
    zu: '/',
    artikel: [
      {
        id: 'termin-anlegen',
        frage: { de: 'Wie lege ich einen Einsatz an?', ar: 'كيف أنشئ مهمة؟' },
        zu: '/',
        antwort: [
          { schritte: [
            { de: 'Im Kalender auf „Termin" klicken – oder direkt in eine freie Fläche im Wochenraster.', ar: 'انقر „موعد" في التقويم – أو مباشرة على مساحة فارغة في الشبكة الأسبوعية.' },
            { de: 'Datum wählen (Kalender-Symbol öffnet den Monatsplaner) und Von/Bis eintragen. Die Dauer-Knöpfe setzen „Bis" automatisch.', ar: 'اختر التاريخ (رمز التقويم يفتح مخطط الشهر) وأدخل من/إلى. أزرار المدة تضبط „إلى" تلقائيًا.' },
            { de: 'Baustelle wählen. Ist noch keine angelegt, geht das direkt im Dialog über „+ Neues Projekt anlegen".', ar: 'اختر ورشة البناء. إن لم تكن موجودة، يمكن إنشاؤها من داخل النافذة عبر „+ إنشاء مشروع جديد".' },
            { de: 'Aufgaben ankreuzen: die LV-Positionen, die an diesem Tag drankommen. Sie erscheinen dem Monteur auf dem Handy.', ar: 'حدّد المهام: بنود جدول الكميات المقررة لهذا اليوم. ستظهر للفني على الهاتف.' },
            { de: 'Mitarbeiter antippen. Ohne Zuweisung sieht kein Monteur den Einsatz – das System fragt vorher nach.', ar: 'انقر على الموظفين. بدون إسناد لن يرى أي فني المهمة – والنظام يسأل قبل الحفظ.' },
          ] },
          { merke: {
            de: 'Überschneidungen sind ausdrücklich erlaubt. Mehrere Kolonnen arbeiten parallel, deshalb gibt es keine Prüfung auf „freie Zeit".',
            ar: 'التداخل مسموح صراحةً. عدة فرق تعمل بالتوازي، ولذلك لا يوجد فحص لـ „وقت متاح".',
          } },
        ],
      },
      {
        id: 'teams',
        frage: { de: 'Woher kommen die Farben im Kalender?', ar: 'من أين تأتي الألوان في التقويم؟' },
        zu: '/einstellungen',
        antwort: [
          { p: {
            de: 'Jeder Mitarbeiter hat unter Einstellungen → Mitarbeiter ein Team und eine Farbe. Der Kalender färbt jeden Einsatz nach dem Team des ersten zugewiesenen Monteurs. Die Legende über dem Kalender filtert auf ein Team.',
            ar: 'لكل موظف فريق ولون في الإعدادات ← الموظفون. يلوّن التقويم كل مهمة حسب فريق أول فني مُسند. ومفتاح الألوان أعلى التقويم يصفّي حسب الفريق.',
          } },
        ],
      },
      {
        id: 'intern',
        frage: { de: 'Wie blockiere ich Zeit ohne Baustelle (Urlaub, Besprechung)?', ar: 'كيف أحجز وقتًا بدون ورشة (إجازة، اجتماع)؟' },
        antwort: [
          { p: {
            de: 'Im Termin-Dialog oben auf „Intern blockieren" umschalten. Dann braucht es nur Bezeichnung, Datum und Zeit – kein Kunde, keine Baustelle. Solche Einträge erscheinen grau im Kalender.',
            ar: 'بدّل في أعلى نافذة الموعد إلى „حجز داخلي". عندها تكفي التسمية والتاريخ والوقت – بدون عميل وبدون ورشة. تظهر هذه الإدخالات بالرمادي في التقويم.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'baustellen',
    icon: 'folder',
    titel: { de: 'Baustellen & Leistungsverzeichnis', ar: 'ورش البناء وجدول الكميات' },
    sub: { de: 'Projekte führen, LV importieren, Mengen verfolgen', ar: 'إدارة المشاريع واستيراد جدول الكميات ومتابعة الكميات' },
    zu: '/projekte',
    artikel: [
      {
        id: 'projekt-aendern',
        zu: '/projekte',
        frage: { de: 'Wie ändere ich Name, Nummer, Gewerk oder Kunde einer Baustelle?', ar: 'كيف أغيّر اسم الورشة أو رقمها أو نوع العمل أو العميل؟' },
        antwort: [
          { p: {
            de: 'Baustelle öffnen. Der Name steht oben in der Kopfzeile und ist direkt anklickbar – hineinschreiben genügt, gespeichert wird von selbst. Die Projektnummer steht daneben, Gewerk und Kunde im Feld rechts unter den Projektdaten.',
            ar: 'افتح الورشة. يظهر الاسم في الأعلى ويمكن النقر عليه مباشرة – يكفي الكتابة فيه ويُحفظ تلقائيًا. ورقم المشروع بجانبه، ونوع العمل والعميل في اللوحة اليمنى ضمن بيانات المشروع.',
          } },
          { schritte: [
            { de: 'Baustelle in der Liste anklicken.', ar: 'انقر على الورشة في القائمة.' },
            { de: 'Auf den Namen in der Kopfzeile klicken und ihn überschreiben. Nach kurzer Pause wird gespeichert – kein Speichern-Knopf nötig.', ar: 'انقر على الاسم في الأعلى واكتب فوقه. يُحفظ بعد لحظة – دون زر حفظ.' },
            { de: 'Nummer, Gewerk, Kunde, Zeitraum und Anschrift stehen im Feld rechts und funktionieren genauso.', ar: 'الرقم ونوع العمل والعميل والفترة والعنوان في اللوحة اليمنى وتعمل بالطريقة نفسها.' },
          ] },
          { merke: {
            de: 'Ein leerer Name wird nicht übernommen – die Baustelle behält ihren bisherigen. So kann sie nicht versehentlich namenlos werden.',
            ar: 'لا يُقبل اسم فارغ – تحتفظ الورشة باسمها السابق. فلا يمكن أن تفقد اسمها بالخطأ.',
          } },
          { achtung: {
            de: 'Der Kunde bestimmt Anschrift, Umsatzsteuermodus (§ 13b) und den Empfänger in FastBill. Sind zu der Baustelle schon Rechnungen gestellt, erscheint ein Hinweis: Ein Kundenwechsel gilt nur für KÜNFTIGE Rechnungen – bereits übertragene bleiben unverändert beim alten Empfänger.',
            ar: 'يحدد العميل العنوان ونظام ضريبة القيمة المضافة (§ 13b) والمستلم في FastBill. وإذا صدرت فواتير للورشة يظهر تنبيه: تغيير العميل يسري على الفواتير المستقبلية فقط، وتبقى المُرسَلة لدى المستلم السابق.',
          } },
          { p: {
            de: 'Der Name steht auf jedem Regiebericht, jedem Abnahmeprotokoll und im Abschlussbericht. Ein Tippfehler wandert damit durch alle Unterlagen – lieber gleich korrigieren als später erklären.',
            ar: 'يظهر الاسم في كل تقرير عمل ومحضر استلام وفي التقرير النهائي. وأي خطأ مطبعي ينتقل إلى كل المستندات – فالتصحيح فورًا أفضل من التبرير لاحقًا.',
          } },
        ],
      },
      {
        id: 'status',
        frage: { de: 'Was bedeuten die fünf Projekt-Stufen?', ar: 'ماذا تعني مراحل المشروع الخمس؟' },
        zu: '/projekte',
        antwort: [
          { schritte: [
            { de: 'Offen – angefragt oder angeboten, noch kein Auftrag.', ar: 'مفتوح – تم الاستفسار أو تقديم عرض، بدون أمر عمل بعد.' },
            { de: 'Beauftragt – Auftrag liegt vor, Ausführung steht an.', ar: 'مُكلَّف – الأمر موجود، والتنفيذ قادم.' },
            { de: 'In Arbeit – die Kolonnen sind auf der Baustelle.', ar: 'قيد التنفيذ – الفرق في ورشة البناء.' },
            { de: 'Abrechnung – Arbeiten fertig, Rechnung offen.', ar: 'الفوترة – الأعمال منتهية، والفاتورة معلّقة.' },
            { de: 'Abgeschlossen – bezahlt und abgehakt.', ar: 'منتهٍ – مدفوع ومُغلق.' },
          ] },
          { p: {
            de: 'Die Stufe lässt sich direkt in der Projektliste umstellen. Alles außer „Abgeschlossen" zählt als laufend – im Dashboard, im Kalender und in der Auswahl beim Termin.',
            ar: 'يمكن تغيير المرحلة مباشرة من قائمة المشاريع. كل ما عدا „منتهٍ" يُحتسب جاريًا – في لوحة المعلومات والتقويم وقائمة اختيار المواعيد.',
          } },
        ],
      },
      {
        id: 'lv-import',
        frage: { de: 'Wie importiere ich ein Leistungsverzeichnis?', ar: 'كيف أستورد جدول الكميات؟' },
        zu: '/projekte',
        antwort: [
          { p: {
            de: 'Baustelle öffnen → Leistungsverzeichnis → „LV importieren". Es gibt zwei Wege:',
            ar: 'افتح ورشة البناء ← جدول الكميات ← „استيراد جدول الكميات". هناك طريقتان:',
          } },
          { schritte: [
            { de: 'CSV-Datei: Kopfzeile wird gelesen, die Spalten ordnet das System selbst zu. Kontrollieren und bei Bedarf korrigieren.', ar: 'ملف CSV: تُقرأ صفوف العناوين، ويربط النظام الأعمدة تلقائيًا. راجعها وصحّحها عند الحاجة.' },
            { de: 'Aus PDF einfügen: Text aus dem LV-PDF markieren, kopieren, einfügen. Positionsnummer, Text, Menge, Einheit und Preis werden erkannt; Bedarfs- und NEP-Positionen automatisch markiert.', ar: 'لصق من PDF: حدّد نص جدول الكميات من ملف PDF وانسخه والصقه. يتعرّف النظام على رقم البند والنص والكمية والوحدة والسعر، ويعلّم البنود الاحتياطية تلقائيًا.' },
          ] },
          { p: {
            de: 'Beide Wege enden in derselben Vorschau. Dort lässt sich jede Zeile noch ändern, bevor sie übernommen wird.',
            ar: 'تنتهي الطريقتان إلى المعاينة نفسها. هناك يمكن تعديل كل سطر قبل الاعتماد.',
          } },
          { achtung: {
            de: 'Werte, die nicht als Zahl lesbar sind („ca. 20", „n.a."), meldet das System vor der Übernahme mit Zeilennummer. Diese Meldung nicht übergehen – eine übersehene 0-Menge fehlt am Monatsende in der Rechnung.',
            ar: 'القيم غير القابلة للقراءة كأرقام („حوالي 20"، „غير متوفر") يبلّغ عنها النظام قبل الاعتماد مع رقم السطر. لا تتجاهل هذا التنبيه – كمية صفرية لم تُلاحظ تعني نقصًا في الفاتورة آخر الشهر.',
          } },
          { merke: {
            de: 'Der Haken „Vorhandene Positionen vorher löschen" wirft auch die gemeldeten Ist-Mengen und den abgerechneten Stand weg. Nur beim erstmaligen Import setzen.',
            ar: 'خيار „حذف البنود الحالية أولًا" يمسح أيضًا الكميات المُبلَّغة وحالة الفوترة. استخدمه فقط عند الاستيراد الأول.',
          } },
        ],
      },
      {
        id: 'soll-ist',
        frage: { de: 'Was ist der Unterschied zwischen Menge und Ist?', ar: 'ما الفرق بين الكمية والمنفَّذ؟' },
        antwort: [
          { p: {
            de: 'Menge ist die vertragliche Vorgabe aus dem Leistungsverzeichnis – die ändert nur das Büro. Ist ist das, was tatsächlich geleistet wurde; das meldet der Monteur auf dem Handy. Abgerechnet wird das Ist, begrenzt auf die vertragliche Menge.',
            ar: 'الكمية هي المقدار التعاقدي من جدول الكميات – ولا يغيّرها إلا المكتب. أما المنفَّذ فهو ما أُنجز فعلًا، ويبلّغ عنه الفني من الهاتف. وتتم الفوترة على أساس المنفَّذ، بحد أقصى الكمية التعاقدية.',
          } },
          { bild: 'sollIst', unterschrift: {
            de: 'Beispiel: 120 m² beauftragt, 80 m² gemeldet, davon 48 m² schon in Rechnung.',
            ar: 'مثال: 120 م² متعاقد عليها، 80 م² مُبلَّغ عنها، منها 48 م² مُفوترة بالفعل.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'berichte',
    icon: 'bericht',
    titel: { de: 'Berichte & Nachweise', ar: 'التقارير والإثباتات' },
    sub: { de: 'Regiebericht, Reklamation, Abnahme – und warum die Fotos Pflicht sind', ar: 'تقرير العمل والشكوى والاستلام – ولماذا الصور إلزامية' },
    zu: '/berichte',
    artikel: [
      {
        id: 'regie',
        frage: { de: 'Wann schreibe ich einen Regiebericht?', ar: 'متى أكتب تقرير عمل بالساعات؟' },
        zu: '/berichte',
        antwort: [
          { p: {
            de: 'Immer dann, wenn etwas gemacht wird, das NICHT im Leistungsverzeichnis steht. Der Regiebericht ist der Nachweis, dass die Arbeit angeordnet wurde und wie viele Stunden sie gekostet hat.',
            ar: 'دائمًا عندما يُنفَّذ عمل غير مذكور في جدول الكميات. تقرير العمل هو الإثبات بأن العمل كان بأمر، وكم استغرق من ساعات.',
          } },
          { achtung: {
            de: 'Stundenlohnarbeiten müssen dem Auftraggeber VOR Beginn angezeigt werden (§ 15 Abs. 3 VOB/B). Deshalb fragt das Formular nach „Angeordnet durch" und dem Datum der Anzeige. Ohne diese Angabe kann der Auftraggeber die Stunden später bestreiten.',
            ar: 'يجب إبلاغ صاحب العمل بأعمال الأجر بالساعة قبل البدء (§ 15 فقرة 3 VOB/B). لذلك يسأل النموذج عن „بأمر من" وتاريخ الإبلاغ. بدون هذه البيانات يمكن لصاحب العمل الاعتراض على الساعات لاحقًا.',
          } },
        ],
      },
      {
        id: 'fahrzeugeinsatz',
        zu: '/berichte',
        frage: { de: 'Wie werden Fahrten und Fahrzeuge im Regiebericht erfasst?', ar: 'كيف تُسجَّل الرحلات والمركبات في تقرير العمل؟' },
        antwort: [
          { p: {
            de: 'Im Regiebericht gibt es den Abschnitt „Fahrzeugeinsatz und Fahrtkosten“. Jede Fahrt trägt Fahrzeug, Fahrer, Datum, die Adresse von wo nach wo und die gefahrenen Kilometer. Ohne diese Angaben ist eine Fahrtkostenposition im Streitfall wertlos.',
            ar: 'في تقرير العمل قسم «استخدام المركبات وتكاليف التنقل». تحمل كل رحلة المركبة والسائق والتاريخ وعنوان الانطلاق والوصول والكيلومترات المقطوعة. وبدون ذلك يفقد بند تكاليف التنقل قيمته عند الخلاف.',
          } },
          { schritte: [
            { de: 'Fahrzeug aus der Liste wählen. Gepflegt wird sie unter Einstellungen › Sätze und Fuhrpark.', ar: 'اختر المركبة من القائمة. وتُدار القائمة في الإعدادات ‹ الأسعار وأسطول المركبات.' },
            { de: 'Von- und Nach-Adresse eintragen: Betrieb, Lager, Baustelle oder Lieferant.', ar: 'أدخل عنوان الانطلاق والوصول: الشركة أو المستودع أو الورشة أو المورّد.' },
            { de: 'Gefahrene Kilometer eintragen. Der Satz je Kilometer kommt aus den Einstellungen und lässt sich je Fahrt ändern.', ar: 'أدخل الكيلومترات المقطوعة. ويأتي سعر الكيلومتر من الإعدادات ويمكن تعديله لكل رحلة.' },
          ] },
          { merke: {
            de: 'Für die Rückfahrt gibt es den Knopf „Rückfahrt anlegen“. Die zweite Fahrt entsteht sofort mit getauschten Adressen – Fahrzeug, Fahrer, Datum und Strecke kommen aus der Hinfahrt. Adressen und Kennzeichen werden also nur EINMAL eingegeben. Korrigiert man später die Hinfahrt, zieht die Rückfahrt automatisch nach; sie kann gar nicht auseinanderlaufen.',
            ar: 'لرحلة العودة يوجد زر «إضافة رحلة العودة». تنشأ الرحلة الثانية فورًا بعناوين معكوسة – وتأتي المركبة والسائق والتاريخ والمسافة من رحلة الذهاب. فتُدخل العناوين ورقم اللوحة مرة واحدة فقط. وإذا صُحِّحت رحلة الذهاب لاحقًا تتبعها رحلة العودة تلقائيًا.',
          } },
          { merke: {
            de: 'Der Knopf „Freie Fahrt“ legt eine Fahrt an, die dokumentiert, aber NICHT berechnet wird – für Nachbesserungen und Materialabholungen auf eigene Kosten. Sie steht mit 0,00 € im Bericht und im Ausdruck, zählt aber bei den gefahrenen Kilometern mit.',
            ar: 'زر «رحلة مجانية» ينشئ رحلة تُوثَّق ولا تُحتسب – للإصلاحات وجلب المواد على حساب الشركة. تظهر بـ 0,00 € وتُحتسب ضمن الكيلومترات المقطوعة.',
          } },
          { achtung: {
            de: 'Fehlt das Fahrzeug, eine Adresse oder die Kilometerangabe, erscheint ein orangefarbener Hinweis – aber erst, wenn an der Fahrt schon etwas eingetragen ist. Eine gerade angelegte leere Zeile meckert nicht.',
            ar: 'إذا نقصت المركبة أو عنوان أو الكيلومترات يظهر تنبيه برتقالي – لكن فقط بعد إدخال شيء في الرحلة. أما السطر الفارغ الجديد فلا يعترض.',
          } },
          { p: {
            de: 'Auf dem Ausdruck erscheint eine eigene Tabelle mit allen Fahrten und der Summe; Rückfahrten sind dort als solche gekennzeichnet. Die berechenbaren Fahrten gehen als Position „Fahrtkosten“ (in km) in die Rechnung – Ausdruck und Rechnung kommen dadurch immer auf denselben Betrag.',
            ar: 'في الطباعة يظهر جدول خاص بكل الرحلات والمجموع، وتُوسم رحلات العودة كذلك. وتدخل الرحلات القابلة للاحتساب كبند «تكاليف التنقل» بالكيلومتر في الفاتورة – فيتطابق المبلغ دائمًا.',
          } },
        ],
      },
      {
        id: 'fuhrpark',
        zu: '/einstellungen',
        frage: { de: 'Wie lege ich die Fahrzeuge des Betriebs an?', ar: 'كيف أضيف مركبات الشركة؟' },
        antwort: [
          { schritte: [
            { de: 'Einstellungen öffnen › Reiter „Sätze“.', ar: 'افتح الإعدادات ‹ تبويب «الأسعار».' },
            { de: 'Unter „Fuhrpark“ auf „+ Fahrzeug“ klicken.', ar: 'تحت «أسطول المركبات» اضغط «+ مركبة».' },
            { de: 'Kennzeichen eintragen und optional eine Bezeichnung, z. B. „Transporter Sprinter“.', ar: 'أدخل رقم اللوحة واختياريًا وصفًا، مثل «شاحنة سبرينتر».' },
            { de: 'Speichern. Ab sofort steht das Fahrzeug im Regiebericht zur Auswahl.', ar: 'احفظ. تصبح المركبة متاحة للاختيار في تقرير العمل.' },
          ] },
          { merke: {
            de: 'Vorher wurde das Kennzeichen frei getippt und lief in drei Schreibweisen auseinander – „AIC GB 12“, „AIC-GB12“, „aic-gb 12“. Eine Auswertung je Fahrzeug war damit unmöglich. Solange kein Fahrzeug hinterlegt ist, lässt sich das Kennzeichen weiterhin von Hand eingeben; die Erfassung ist also nie blockiert.',
            ar: 'سابقًا كان رقم اللوحة يُكتب يدويًا بثلاث صيغ مختلفة، فتعذّر التحليل لكل مركبة. وما دامت لا توجد مركبات مسجلة يمكن كتابة الرقم يدويًا، فلا يتوقف التسجيل أبدًا.',
          } },
        ],
      },
      {
        id: 'fotos',
        frage: { de: 'Warum verlangt das Formular Vorher- und Nachher-Fotos?', ar: 'لماذا يطلب النموذج صورًا قبل وبعد؟' },
        antwort: [
          { p: {
            de: 'Weil ein Bericht ohne Bilder im Streitfall wenig wert ist. Je ein Foto vorher und nachher ist Pflicht, bevor der Bericht eingereicht werden kann. Die Bilder werden auf dem Gerät verkleinert, bevor sie gespeichert werden – das schont das Datenvolumen auf der Baustelle.',
            ar: 'لأن التقرير بلا صور قليل القيمة عند الخلاف. صورة قبل وصورة بعد على الأقل إلزاميتان قبل إرسال التقرير. تُصغَّر الصور على الجهاز قبل الحفظ – ما يوفّر بيانات الإنترنت في الورشة.',
          } },
          { bild: 'berichtGate', unterschrift: {
            de: 'Erst wenn alle sechs Punkte stehen, lässt sich der Bericht einreichen.',
            ar: 'لا يمكن إرسال التقرير إلا بعد استيفاء النقاط الست جميعها.',
          } },
          { p: {
            de: 'Unten im Formular steht immer, was zum Einreichen noch fehlt.',
            ar: 'يظهر أسفل النموذج دائمًا ما ينقص للإرسال.',
          } },
        ],
      },
      {
        id: 'freigabe',
        frage: { de: 'Was passiert bei der Freigabe?', ar: 'ماذا يحدث عند الاعتماد؟' },
        antwort: [
          { p: {
            de: 'Das Büro prüft den eingereichten Bericht und gibt ihn frei. Mit der Freigabe wird festgehalten, wer sie wann erteilt hat – und der Bericht ist gesperrt.',
            ar: 'يراجع المكتب التقرير المُرسل ويعتمده. ومع الاعتماد يُسجَّل من اعتمده ومتى – ويصبح التقرير مقفلًا.',
          } },
          { bild: 'freigabe', unterschrift: {
            de: 'Drei Zustände. Der dritte lässt sich nur über den Weg zurück wieder öffnen.',
            ar: 'ثلاث حالات. ولا تُفتح الثالثة إلا بالرجوع خطوة إلى الوراء.',
          } },
          { merke: {
            de: 'Gesperrt heißt gesperrt: auch das Büro kann einen freigegebenen Bericht nicht mehr ändern. Wer korrigieren muss, nimmt erst die Freigabe zurück. Das ist Absicht – ein nachträglich änderbarer Stundennachweis wäre vor Gericht wertlos.',
            ar: 'مقفل يعني مقفل: حتى المكتب لا يستطيع تعديل تقرير معتمد. من يريد التصحيح عليه سحب الاعتماد أولًا. وهذا مقصود – فإثبات ساعات قابل للتعديل لاحقًا لا قيمة له أمام المحكمة.',
          } },
        ],
      },
      {
        id: 'abnahme',
        frage: { de: 'Was gehört in ein Abnahmeprotokoll?', ar: 'ما الذي يجب أن يتضمنه محضر الاستلام؟' },
        antwort: [
          { p: {
            de: 'Gesamt- oder Teilabnahme, der abgenommene Leistungsumfang, festgestellte Mängel mit Frist – und die Vorbehalte des Auftraggebers. Ob eine Vertragsstrafe vorbehalten wird (§ 11 VOB/B), ist eine Pflichtangabe: Wird sie bei der Abnahme nicht vorbehalten, ist sie verfallen.',
            ar: 'استلام كلي أو جزئي، ونطاق الأعمال المستلمة، والعيوب المسجّلة مع مهلة – وتحفظات صاحب العمل. وتحديد ما إذا كانت الغرامة التعاقدية محفوظة (§ 11 VOB/B) إلزامي: فإن لم تُتحفَّظ عند الاستلام سقطت.',
          } },
          { p: {
            de: 'Beide Unterschriften sind Pflicht: Auftraggeber mit Name und Funktion, dazu der Monteur.',
            ar: 'التوقيعان إلزاميان: صاحب العمل بالاسم والوظيفة، ومعه الفني.',
          } },
        ],
      },
      {
        id: 'entwurf',
        frage: { de: 'Was passiert, wenn das Handy mitten im Bericht ausgeht?', ar: 'ماذا يحدث إذا انطفأ الهاتف أثناء كتابة التقرير؟' },
        antwort: [
          { p: {
            de: 'Nichts geht verloren. Die Eingaben werden im Hintergrund alle paar Sekunden auf dem Gerät gesichert. Beim nächsten Öffnen erscheint oben eine Leiste mit „Wiederherstellen" oder „Verwerfen".',
            ar: 'لا يضيع شيء. تُحفظ الإدخالات على الجهاز تلقائيًا كل بضع ثوانٍ. وعند الفتح التالي يظهر شريط في الأعلى بخيار „استعادة" أو „تجاهل".',
          } },
          { merke: {
            de: 'Der Entwurf wird nie automatisch eingespielt – sonst würde er frische Eingaben überschreiben. Die Entscheidung liegt beim Benutzer.',
            ar: 'لا تُستعاد المسودة تلقائيًا أبدًا – وإلا لمسحت إدخالات جديدة. القرار بيد المستخدم.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'stunden',
    icon: 'clock',
    titel: { de: 'Stundenlisten', ar: 'كشوف الساعات' },
    sub: { de: 'Monats-Stundenzettel je Mitarbeiter für Lohnbüro und Berufsgenossenschaft', ar: 'كشف ساعات شهري لكل موظف لمكتب الرواتب والتأمين المهني' },
    zu: '/stunden',
    artikel: [
      {
        id: 'woher',
        frage: { de: 'Woher kommen die Stunden auf der Liste?', ar: 'من أين تأتي الساعات في الكشف؟' },
        zu: '/stunden',
        antwort: [
          { p: {
            de: 'Aus den Stundenzeilen der Regieberichte. Die Seite rechnet nichts neu – sie fasst zusammen, was gemeldet und freigegeben wurde. Steht eine Stunde nicht in einem Bericht, steht sie auch nicht auf dem Zettel.',
            ar: 'من سطور الساعات في تقارير العمل. لا تحسب الصفحة شيئًا من جديد – بل تجمع ما تم الإبلاغ عنه واعتماده. وما لا يرد في تقرير لا يظهر في الكشف.',
          } },
          { bild: 'stundenzettel', unterschrift: {
            de: 'So sieht das Blatt aus: Kopfdaten, eine Zeile je Kalendertag, Summe, zwei Unterschriften.',
            ar: 'هكذا يبدو الكشف: بيانات الرأس، سطر لكل يوم، المجموع، وتوقيعان.',
          } },
          { p: {
            de: 'Voreingestellt zählen nur freigegebene Berichte. Für ein Blatt, das ans Lohnbüro oder an die BG geht, ist das richtig so – dort gehören nur geprüfte Stunden hinein. Der Haken lässt sich lösen, wenn man den Zwischenstand sehen will.',
            ar: 'افتراضيًا تُحتسب التقارير المعتمدة فقط. وهذا صحيح لكشف موجّه لمكتب الرواتب أو التأمين المهني – فلا مكان فيه إلا للساعات المُراجَعة. ويمكن إلغاء الخيار لعرض الحالة المؤقتة.',
          } },
        ],
      },
      {
        id: 'pause',
        frage: { de: 'Wie wird die Pause berechnet?', ar: 'كيف تُحسب الاستراحة؟' },
        antwort: [
          { p: {
            de: 'Aus der Differenz zwischen Anwesenheit (Beginn bis Ende) und den gemeldeten Arbeitsstunden. Wer von 07:00 bis 16:00 da war und 8 Stunden meldet, hatte 60 Minuten Pause.',
            ar: 'من الفرق بين الحضور (من البداية إلى النهاية) وساعات العمل المُبلَّغة. من كان حاضرًا من 07:00 إلى 16:00 وأبلغ عن 8 ساعات، فقد أخذ 60 دقيقة استراحة.',
          } },
          { achtung: {
            de: 'Meldet eine Zeile mehr Stunden als Anwesenheit, wird sie gelb markiert und oben als „prüfen" gezählt. Genau daran fällt ein Stundenzettel bei der Berufsgenossenschaft durch – vor dem Drucken korrigieren.',
            ar: 'إذا أبلغ سطر عن ساعات أكثر من مدة الحضور، يُعلَّم بالأصفر ويُحتسب أعلاه كـ „للمراجعة". وهذا تحديدًا ما يُسقط كشف الساعات لدى التأمين المهني – صحّحه قبل الطباعة.',
          } },
        ],
      },
      {
        id: 'zeitraum',
        frage: { de: 'Ganzer Monat oder bis heute?', ar: 'الشهر كاملًا أم حتى اليوم؟' },
        antwort: [
          { p: {
            de: 'Für die Lohnabrechnung nimmt man den ganzen Monat, sobald er vorbei ist. „Bis heute" ist für den Zwischenstand im laufenden Monat gedacht und deshalb auch nur dort wählbar.',
            ar: 'لحساب الرواتب يُؤخذ الشهر كاملًا بعد انتهائه. أما „حتى اليوم" فمخصص للحالة المؤقتة في الشهر الجاري، ولذلك يتاح فيه فقط.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'abrechnung',
    icon: 'euro',
    titel: { de: 'Abrechnung & FastBill', ar: 'الفوترة و FastBill' },
    sub: { de: 'Rechnung zusammenstellen, §13b, Sicherheitseinbehalt', ar: 'إعداد الفاتورة، §13b، الضمان المحتجز' },
    zu: '/abrechnung',
    artikel: [
      {
        id: 'wizard',
        frage: { de: 'Wie stelle ich eine Rechnung?', ar: 'كيف أصدر فاتورة؟' },
        zu: '/abrechnung',
        antwort: [
          { schritte: [
            { de: 'Baustelle wählen.', ar: 'اختر ورشة البناء.' },
            { de: 'Quellen ankreuzen: offene LV-Mengen, freigegebene Regieberichte, eingereichte Spesen.', ar: 'حدّد المصادر: كميات جدول الكميات المفتوحة، تقارير العمل المعتمدة، المصاريف المُرسلة.' },
            { de: 'Vorschau prüfen, bei Bedarf freie Positionen ergänzen, Sicherheitseinbehalt setzen.', ar: 'راجع المعاينة، وأضف بنودًا حرة عند الحاجة، واضبط الضمان المحتجز.' },
            { de: 'Speichern – wahlweise als Entwurf oder direkt an FastBill übertragen.', ar: 'احفظ – إما كمسودة أو أرسلها مباشرة إلى FastBill.' },
          ] },
          { bild: 'rechnungQuellen', unterschrift: {
            de: 'Drei Quellen, eine Rechnung. Das Dokument selbst erzeugt FastBill.',
            ar: 'ثلاثة مصادر، فاتورة واحدة. والمستند نفسه يُنشئه FastBill.',
          } },
          { p: {
            de: 'Vorbelegt ist die vom Monteur gemeldete Menge. Hat er nichts gemeldet, steht 0 – die Menge lässt sich trotzdem von Hand eintragen, bis zur vertraglichen Restmenge. Wer mehr einträgt, als gemeldet wurde, sieht die Zeile gelb markiert.',
            ar: 'القيمة الافتراضية هي الكمية التي أبلغ عنها الفني. إن لم يُبلغ، تكون 0 – ويمكن مع ذلك إدخال الكمية يدويًا حتى الكمية المتبقية التعاقدية. ومن يُدخل أكثر مما أُبلغ عنه يرى السطر معلَّمًا بالأصفر.',
          } },
        ],
      },
      {
        id: 'fastbill',
        frage: { de: 'Warum macht FastBill die Rechnung und nicht dieses System?', ar: 'لماذا يُصدر FastBill الفاتورة وليس هذا النظام؟' },
        antwort: [
          { p: {
            de: 'Weil dort Rechnungsnummern, E-Rechnung, Versand und Mahnwesen bereits sauber laufen. Diese Verwaltung stellt zusammen, WAS abgerechnet wird; FastBill macht daraus das Dokument und schickt es raus. Das PDF öffnet man in der Abrechnungsliste über „PDF (FastBill)".',
            ar: 'لأن أرقام الفواتير والفاتورة الإلكترونية والإرسال والتذكير تعمل هناك بشكل سليم. هذه الإدارة تحدد ما الذي يُفوتر؛ و FastBill يحوّله إلى مستند ويرسله. يُفتح ملف PDF من قائمة الفوترة عبر „PDF (FastBill)".',
          } },
          { merke: {
            de: 'Es gibt bewusst keinen eigenen Rechnungsdruck. Zwei Systeme, die beide Rechnungen erzeugen, führen früher oder später zu doppelten Nummern.',
            ar: 'لا توجد طباعة فواتير خاصة عمدًا. فوجود نظامين يُصدران فواتير يؤدي عاجلًا أو آجلًا إلى أرقام مكررة.',
          } },
        ],
      },
      {
        id: 'dreizehnb',
        frage: { de: 'Was bedeutet §13b netto?', ar: 'ماذا يعني §13b صافي؟' },
        antwort: [
          { p: {
            de: 'Bei Bauleistungen an einen anderen Bauunternehmer schuldet nicht Gabara die Umsatzsteuer, sondern der Auftraggeber (Steuerschuldnerschaft des Leistungsempfängers, § 13b UStG). Die Rechnung geht dann netto raus, mit einem entsprechenden Hinweis.',
            ar: 'في الأعمال الإنشائية لمقاول آخر، لا تكون غبارة مدينة بضريبة القيمة المضافة بل صاحب العمل (نقل التكليف الضريبي إلى المتلقي، § 13b UStG). عندها تصدر الفاتورة صافية مع تنويه بذلك.',
          } },
          { p: {
            de: 'Der Modus hängt am Kunden: Generalunternehmer stehen auf §13b, Privatkunden auf 19 % USt. Neue Kunden bekommen die Vorgabe aus den Einstellungen.',
            ar: 'يعتمد النمط على العميل: المقاولون العامون على §13b، والعملاء الخاصون على 19 ٪ ض.ق.م. ويأخذ العملاء الجدد الإعداد الافتراضي من الإعدادات.',
          } },
        ],
      },
      {
        id: 'einbehalt',
        frage: { de: 'Was ist der Sicherheitseinbehalt?', ar: 'ما هو الضمان المحتجز؟' },
        antwort: [
          { p: {
            de: 'Ein vertraglich vereinbarter Teil der Rechnung – meist 5 bis 10 Prozent – den der Auftraggeber als Sicherheit für Gewährleistung zunächst zurückbehält. Der Betrag steht in der Rechnungsvorschau und mindert den Zahlbetrag.',
            ar: 'جزء من الفاتورة متفق عليه تعاقديًا – غالبًا 5 إلى 10 بالمئة – يحتجزه صاحب العمل مؤقتًا كضمان للكفالة. يظهر المبلغ في معاينة الفاتورة ويقلّل المبلغ المستحق.',
          } },
          { achtung: {
            de: 'Der Einbehalt wird derzeit NICHT an FastBill übertragen. Er muss dort in der Rechnung von Hand nachgetragen werden, sonst mahnt FastBill den vollen Betrag an.',
            ar: 'لا يُرسَل الضمان المحتجز حاليًا إلى FastBill. يجب إضافته يدويًا هناك في الفاتورة، وإلا سيطالب FastBill بالمبلغ الكامل.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'monteur',
    icon: 'tablet',
    titel: { de: 'Handy-Ansicht für Monteure', ar: 'واجهة الهاتف للفنيين' },
    sub: { de: 'Was der Monteur auf der Baustelle sieht und tut', ar: 'ما يراه الفني ويفعله في ورشة البناء' },
    zu: '/monteur',
    artikel: [
      {
        id: 'was-sieht',
        frage: { de: 'Was sieht der Monteur?', ar: 'ماذا يرى الفني؟' },
        zu: '/monteur',
        antwort: [
          { p: {
            de: 'Seine Einsätze für heute und die nächsten Tage, die Anschrift der Baustelle, die angehängten Aufgaben aus dem Leistungsverzeichnis und die Hinweise des Büros. Keine Preise, keine Rechnungen, keine Stammdaten.',
            ar: 'مهامه لليوم وللأيام القادمة، وعنوان ورشة البناء، والمهام المرفقة من جدول الكميات، وملاحظات المكتب. بدون أسعار وبدون فواتير وبدون بيانات أساسية.',
          } },
        ],
      },
      {
        id: 'melden',
        frage: { de: 'Wie melde ich fertige Räume? (HEUTE-Bildschirm)', ar: 'كيف أبلّغ عن الغرف المنجزة؟ (شاشة اليوم)' },
        zu: '/monteur',
        antwort: [
          { p: {
            de: 'HEUTE zeigt den Einsatz des Tages: die Räume, gruppiert nach Arbeitsschritt (Grundieren, 1. Anstrich, …). Niemand tippt eine Zahl – die Mengen kommen aus dem Raum.',
            ar: 'تعرض شاشة اليوم مهمة اليوم: الغرف مجمّعة حسب خطوة العمل (التأسيس، الطلاء الأول، …). لا أحد يكتب رقمًا – فالكميات تأتي من الغرفة.',
          } },
          { schritte: [
            { de: 'Räume antippen, die fertig sind (Haken ☑). [alle] wählt die ganze Gruppe.', ar: 'اضغط على الغرف المنجزة (علامة ☑). زر [الكل] يختار المجموعة كاملة.' },
            { de: 'FERTIG antippen – die Kamera öffnet sich direkt.', ar: 'اضغط تم – تفتح الكاميرا مباشرة.' },
            { de: 'Ein Foto als Beleg auslösen. Fertig – keine weitere Rückfrage.', ar: 'التقط صورة واحدة كإثبات. انتهى – بلا أي سؤال إضافي.' },
            { de: 'Unten erscheint die Quittung mit RÜCKGÄNGIG – 10 Sekunden lang lässt sich alles zurücknehmen. Danach hilft nur noch das Büro (Storno mit Grund).', ar: 'يظهر في الأسفل إيصال مع زر تراجع – يمكن التراجع خلال 10 ثوانٍ. بعدها لا يساعد إلا المكتب (إلغاء مع ذكر السبب).' },
          ] },
          { merke: {
            de: 'Die Zeichen: ☐ offen · ☑ ausgewählt · ▸ läuft · 📷 letzter Schritt (öffnet direkt die Kamera, Raum wird abgeschlossen) · ✓ fertig · ⚠ Vorher-Bild fehlt · ⏸ wartet.',
            ar: 'الرموز: ☐ مفتوح · ☑ مختار · ▸ جارٍ · 📷 الخطوة الأخيرة (تفتح الكاميرا مباشرة وتُغلق الغرفة) · ✓ منجز · ⚠ صورة قبل مفقودة · ⏸ ينتظر.',
          } },
          { achtung: {
            de: 'Meldet ein Kollege denselben Raum aus dem Funkloch ein zweites Mal, lehnt das System die zweite Meldung komplett ab – es wird NIE doppelt gebucht.',
            ar: 'إذا أبلغ زميل عن نفس الغرفة مرة ثانية من منطقة بلا تغطية، يرفض النظام البلاغ الثاني كاملًا – لا يُسجَّل شيء مرتين أبدًا.',
          } },
        ],
      },
      {
        id: 'angefangen-wartet',
        frage: { de: 'Angefangen, Teilstand und „Raum wartet" – wie geht das?', ar: 'بدأ العمل، الإنجاز الجزئي و«الغرفة تنتظر» – كيف؟' },
        zu: '/monteur',
        antwort: [
          { p: {
            de: 'Rechts an jeder Zeile sitzt der kleine Knopf ▸ „angefangen": ein Tipp, kein Foto, keine Mengenbuchung. Das Büro sieht damit abends, wo gearbeitet wurde, auch wenn noch nichts fertig ist.',
            ar: 'على جانب كل سطر يوجد زر صغير ▸ «بدأ»: ضغطة واحدة، بلا صورة وبلا تسجيل كمية. هكذا يرى المكتب مساءً أين جرى العمل حتى لو لم يكتمل شيء.',
          } },
          { p: {
            de: 'Langes Drücken auf eine Zeile öffnet mehr: den Teilanteil in Zehnteln (10–90 %) und „Raum wartet" mit Grund (zugestellt, Vorgewerk fehlt, kein Zutritt, Estrich nass, Kunde sperrt) und Wiedervorlage-Datum.',
            ar: 'الضغط المطوّل على السطر يفتح المزيد: نسبة الإنجاز بالأعشار (10–90%) و«الغرفة تنتظر» مع السبب (مسدودة، العمل السابق ناقص، لا دخول، الأرضية رطبة، العميل يمنع) وتاريخ إعادة العرض.',
          } },
          { merke: {
            de: 'Ein wartender Raum bleibt in der Gesamtrechnung enthalten – der Fortschritt springt NICHT auf 100 %. Am Wiedervorlage-Tag taucht er von selbst wieder auf.',
            ar: 'الغرفة المنتظرة تبقى ضمن الحساب الكلي – فلا يقفز التقدم إلى 100%. وفي يوم إعادة العرض تظهر من جديد تلقائيًا.',
          } },
        ],
      },
      {
        id: 'stunden-kachel',
        frage: { de: 'Wie erfasse ich die Tagesstunden der Kolonne?', ar: 'كيف أسجّل ساعات الفرقة اليومية؟' },
        zu: '/monteur/stunden',
        antwort: [
          { p: {
            de: 'Der Reiter STUNDEN ist eine Kolonnenzeile: Datum, Baustelle, Mannschaft, Von/Bis und Art kommen aus dem Einsatz. Die Tätigkeit wird aus den heute gemeldeten Schritten erzeugt – das ist der Pflichttext nach § 15 Abs. 3 VOB/B. Zwei Tipps für drei Mann.',
            ar: 'تبويب الساعات هو سطر فرقة: التاريخ وورشة البناء والطاقم ومن/إلى والنوع تأتي من المهمة. ويُنشأ وصف العمل من الخطوات المبلَّغ عنها اليوم – وهو النص الإلزامي حسب § 15 فقرة 3 VOB/B. ضغطتان لثلاثة رجال.',
          } },
          { p: {
            de: 'Nur der Vorarbeiter (oder das Büro) sendet die ganze Kolonne. Jeder andere sieht seine eigene Zeile vorbelegt und sendet nur sie. Unten steht immer sichtbar, wer zuletzt geändert hat.',
            ar: 'رئيس الفرقة وحده (أو المكتب) يرسل الفرقة كاملة. وكل شخص آخر يرى سطره الخاص معبّأ ويرسله فقط. وفي الأسفل يظهر دائمًا من عدّل آخر مرة.',
          } },
          { merke: {
            de: 'Zeiten und Pause laufen über ±15-Minuten-Knöpfe – im Tagesablauf gibt es keine tippbare Zahl.',
            ar: 'الأوقات والاستراحة تُضبط بأزرار ±15 دقيقة – لا يوجد رقم يُكتب في سير اليوم.',
          } },
        ],
      },
      {
        id: 'regie-anordnung',
        frage: { de: 'Wie melde ich Regie (Zusatzarbeit) richtig?', ar: 'كيف أبلّغ عن عمل إضافي بشكل صحيح؟' },
        zu: '/monteur',
        antwort: [
          { p: {
            de: 'Über „Regie melden" im Kopf von HEUTE. Die erste Frage ist immer: WER hat das angeordnet? Name, Datum und die Art als drei Symbolknöpfe (💬 mündlich · 📄 schriftlich · ✉ Mail). Ohne Anordnung besteht nach § 2 Abs. 8 VOB/B grundsätzlich kein Vergütungsanspruch – deshalb steht die Frage zuerst.',
            ar: 'عبر «الإبلاغ عن عمل إضافي» في أعلى شاشة اليوم. السؤال الأول دائمًا: من أمر بذلك؟ الاسم والتاريخ والنوع بثلاثة أزرار رمزية (💬 شفهيًا · 📄 خطيًا · ✉ بريد). بدون أمر لا يوجد مبدئيًا حق بالأجر حسب § 2 فقرة 8 VOB/B – لذلك يأتي هذا السؤال أولًا.',
          } },
          { schritte: [
            { de: 'Anordnung: Wer, wann, wie (💬/📄/✉).', ar: 'الأمر: من، متى، كيف (💬/📄/✉).' },
            { de: 'Was: Baustein antippen (zweisprachig), Freitext nur bei Bedarf.', ar: 'ماذا: اختر عبارة جاهزة (بلغتين)، ونص حر عند الحاجة فقط.' },
            { de: 'Vorher-Foto (Pflicht).', ar: 'صورة قبل (إلزامية).' },
            { de: 'Stunden – vorbelegt aus dem Einsatz.', ar: 'الساعات – معبّأة مسبقًا من المهمة.' },
            { de: 'Nachher-Foto (Pflicht), dann EINREICHEN.', ar: 'صورة بعد (إلزامية)، ثم تقديم.' },
          ] },
          { merke: {
            de: 'EINREICHEN bleibt gesperrt, bis alle fünf Punkte stehen – darüber steht immer, was noch fehlt.',
            ar: 'يبقى زر التقديم مقفلًا حتى تكتمل النقاط الخمس – وفوقه يظهر دائمًا ما الذي ينقص.',
          } },
        ],
      },
      {
        id: 'kein-netz',
        frage: { de: 'Was, wenn auf der Baustelle kein Netz ist?', ar: 'ماذا لو لم تتوفر شبكة في ورشة البناء؟' },
        antwort: [
          { p: {
            de: 'Weiterarbeiten wie immer. Meldungen und Fotos werden zuerst auf dem Gerät gesichert und gehen beim nächsten Empfang von selbst raus. Oben erscheint ein dunkler Balken „Kein Netz“ und daneben „n Bilder warten“ – beides verschwindet, sobald alles übertragen ist.',
            ar: 'تابع العمل كالمعتاد. تُحفظ البلاغات والصور أولًا على الجهاز وتُرسل تلقائيًا عند عودة التغطية. يظهر في الأعلى شريط داكن «لا توجد شبكة» وبجانبه «n صورة بانتظار الرفع» – ويختفي الاثنان بمجرد اكتمال الإرسال.',
          } },
          { merke: {
            de: 'Nichts geht verloren, solange die App vom Startbildschirm-Symbol geöffnet wird (siehe „Warum ist die Kamera gesperrt?“).',
            ar: 'لا يضيع شيء ما دام التطبيق يُفتح من رمز الشاشة الرئيسية (انظر «لماذا الكاميرا مقفلة؟»).',
          } },
        ],
      },
      {
        id: 'fototafel',
        frage: { de: 'Wie funktioniert die Fototafel mit den vier Plätzen?', ar: 'كيف تعمل لوحة الصور ذات الأماكن الأربعة؟' },
        zu: '/monteur/raeume',
        antwort: [
          { p: {
            de: 'Jeder Raum hat vier feste Foto-Plätze: Vorher und Nachher, jeweils für Auftrag und Regie. Ein Tipp auf eine leere Kachel (📷) öffnet die Kamera – WAS das Bild ist (vorher/nachher, Auftrag/Regie), steht durch die Kachel schon fest und wird nie nachträglich zugeordnet. Volle Kacheln zeigen ✓ mit der Anzahl.',
            ar: 'لكل غرفة أربعة أماكن ثابتة للصور: قبل وبعد، لكل من العقد والعمل الإضافي. الضغط على مربع فارغ (📷) يفتح الكاميرا – وما تمثله الصورة (قبل/بعد، عقد/عمل إضافي) محدد مسبقًا بالمربع نفسه ولا يُسنَد لاحقًا أبدًا. المربعات الممتلئة تعرض ✓ مع العدد.',
          } },
          { schritte: [
            { de: 'Beim ersten Betreten des Raums: Vorher-Foto (Auftrag) – das einzige Bild, das sich nie nachholen lässt.', ar: 'عند دخول الغرفة أول مرة: صورة قبل (العقد) – الصورة الوحيدة التي لا يمكن تعويضها لاحقًا.' },
            { de: 'Beim Raumabschluss: Nachher-Foto – das verlangt die 📷-Zeile in HEUTE von selbst.', ar: 'عند إنهاء الغرفة: صورة بعد – وسطر 📷 في شاشة اليوم يطلبها تلقائيًا.' },
            { de: 'Die Regie-Zeile erscheint nur, wenn für den Raum eine Anordnung existiert.', ar: 'يظهر سطر العمل الإضافي فقط إذا وُجد أمر لهذه الغرفة.' },
          ] },
          { merke: {
            de: 'Unter jedem Raum steht die Fehlliste (⚠), oben die Ampel der Baustelle. Aus genau diesen Bildpaaren baut sich später das Abnahmeprotokoll von selbst.',
            ar: 'تحت كل غرفة قائمة النواقص (⚠) وفي الأعلى إشارة الورشة. من أزواج الصور هذه بالذات يتكوّن محضر الاستلام لاحقًا تلقائيًا.',
          } },
        ],
      },
      {
        id: 'foto-warteschlange',
        frage: { de: 'Wohin gehen meine Fotos – und was heißt „n Bilder warten“?', ar: 'إلى أين تذهب صوري – وماذا يعني «n صورة بانتظار الرفع»؟' },
        antwort: [
          { p: {
            de: 'Jedes Foto wird SOFORT auf dem Gerät gesichert (in drei Größen, mit Aufnahmezeit und Prüfsumme) – erst danach passiert alles andere. Der Balken „⬆ n Bilder warten“ zeigt, wie viele Bilder noch nicht auf dem Server sind; „jetzt versuchen“ stößt das Hochladen sofort an. Vorher-Bilder gehen immer zuerst raus, auch über Mobilfunk – sie sind die einzigen Aufnahmen, die sich nicht wiederholen lassen.',
            ar: 'تُحفظ كل صورة فورًا على الجهاز (بثلاثة أحجام مع وقت الالتقاط وبصمة تحقق) – وبعد ذلك فقط يحدث الباقي. شريط «⬆ n صورة بانتظار الرفع» يبيّن عدد الصور التي لم تصل بعد إلى الخادم؛ وزر «حاول الآن» يبدأ الرفع فورًا. صور «قبل» تُرسل دائمًا أولًا حتى عبر شبكة الجوال – فهي الوحيدة التي لا يمكن إعادة التقاطها.',
          } },
          { achtung: {
            de: 'Scheitert schon das Sichern auf dem Gerät (Speicher voll), wird die Aufnahme LAUT abgebrochen statt still verloren – dann zuerst Speicherplatz freimachen.',
            ar: 'إذا فشل الحفظ على الجهاز نفسه (الذاكرة ممتلئة) يُلغى الالتقاط بتنبيه صريح بدل الضياع الصامت – حينها أخلِ مساحة تخزين أولًا.',
          } },
        ],
      },
      {
        id: 'kamera-installieren',
        frage: { de: 'Warum ist die Kamera gesperrt – und wie installiere ich die App?', ar: 'لماذا الكاميرا مقفلة – وكيف أثبّت التطبيق؟' },
        antwort: [
          { p: {
            de: 'Wer den Link aus WhatsApp antippt, arbeitet in einem flüchtigen Fenster: Beim Schließen kann der Browser alle dort gespeicherten Fotos wegwerfen – grün gemeldet und trotzdem weg. Deshalb sperrt die App die Kamera, solange sie nicht installiert ist oder der Browser keinen dauerhaften Speicher gewährt.',
            ar: 'من يفتح الرابط من داخل واتساب يعمل في نافذة مؤقتة: عند الإغلاق قد يتخلص المتصفح من كل الصور المحفوظة هناك – تظهر أنها أُرسلت ثم تضيع. لذلك يقفل التطبيق الكاميرا ما لم يكن مثبّتًا أو ما لم يمنح المتصفح تخزينًا دائمًا.',
          } },
          { schritte: [
            { de: 'Link im richtigen Browser öffnen (Chrome auf Android, Safari auf dem iPhone) – nicht in WhatsApp bleiben.', ar: 'افتح الرابط في المتصفح الصحيح (كروم على أندرويد، سفاري على آيفون) – ولا تبقَ داخل واتساب.' },
            { de: 'Browser-Menü → „Zum Startbildschirm hinzufügen“ / „App installieren“.', ar: 'قائمة المتصفح ← «إضافة إلى الشاشة الرئيسية» / «تثبيت التطبيق».' },
            { de: 'Ab jetzt immer über das Gabara-Symbol öffnen – die Sperre verschwindet von selbst.', ar: 'من الآن افتح دائمًا عبر رمز Gabara – ويزول القفل تلقائيًا.' },
          ] },
          { merke: {
            de: 'Die Sperre ist kein Fehler, sondern der Schutz der Beweisfotos. Melden, Stunden und Ansehen funktionieren auch gesperrt weiter.',
            ar: 'القفل ليس عطلًا بل حماية لصور الإثبات. الإبلاغ والساعات والعرض تعمل كلها حتى أثناء القفل.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'stammdaten',
    icon: 'zahnrad',
    titel: { de: 'Stammdaten & Einstellungen', ar: 'البيانات الأساسية والإعدادات' },
    sub: { de: 'Mitarbeiter, Sätze, Artikel, FastBill-Zugang', ar: 'الموظفون والأسعار والأصناف وحساب FastBill' },
    zu: '/einstellungen',
    artikel: [
      {
        id: 'mitarbeiter',
        frage: { de: 'Was steuern Team und Qualifikation?', ar: 'ماذا يتحكم به الفريق والمؤهل؟' },
        zu: '/einstellungen',
        antwort: [
          { p: {
            de: 'Team und Farbe bestimmen, wie der Einsatz im Kalender aussieht. Die Qualifikation – Facharbeiter oder Helfer – bestimmt den Stundensatz, der im Regiebericht vorbelegt wird. Die Sätze selbst stehen im Reiter „Sätze".',
            ar: 'يحدد الفريق واللون شكل المهمة في التقويم. أما المؤهل – عامل ماهر أو مساعد – فيحدد سعر الساعة المعبّأ مسبقًا في تقرير العمل. والأسعار نفسها في تبويب „الأسعار".',
          } },
          { merke: {
            de: 'Bereits geschriebene Regieberichte behalten den Satz, der bei der Erfassung galt. Eine Preisänderung wirkt nur nach vorne.',
            ar: 'تحتفظ تقارير العمل المكتوبة مسبقًا بالسعر الساري وقت التسجيل. وأي تغيير في الأسعار يسري على المستقبل فقط.',
          } },
        ],
      },
      {
        id: 'satz-intern',
        frage: { de: 'Wofür ist der interne Stundensatz?', ar: 'ما فائدة سعر الساعة الداخلي؟' },
        antwort: [
          { p: {
            de: 'Er sind die eigenen Lohnkosten und dient nur der Auswertung im Dashboard: Was bleibt nach Material, Lohn und Spesen übrig? Auf keiner Rechnung taucht dieser Wert auf.',
            ar: 'هو تكلفة الأجور الفعلية، ويُستخدم فقط للتحليل في لوحة المعلومات: ماذا يتبقى بعد المواد والأجور والمصاريف؟ ولا تظهر هذه القيمة في أي فاتورة.',
          } },
        ],
      },
      {
        id: 'proxy',
        frage: { de: 'Was gehört in das Feld „Proxy-URL"?', ar: 'ماذا يوضع في حقل „عنوان الوسيط"؟' },
        antwort: [
          { p: {
            de: 'Im Testbetrieb: nichts. Das Feld bleibt leer. Erst beim Online-Go-Live kommt dort die Adresse des Weiterleitungs-Dienstes hinein, weil der Browser FastBill sonst nicht direkt erreichen darf.',
            ar: 'في وضع الاختبار: لا شيء. يبقى الحقل فارغًا. وعند التشغيل عبر الإنترنت فقط يوضع فيه عنوان خدمة التمرير، لأن المتصفح لا يستطيع الوصول إلى FastBill مباشرة.',
          } },
          { merke: {
            de: 'Steht dort etwas, das nicht mit https:// beginnt, wird es ignoriert und rot angemahnt. Dann das Feld leeren und speichern.',
            ar: 'إذا وُضع فيه شيء لا يبدأ بـ https:// فسيُتجاهل مع تنبيه أحمر. عندها أفرغ الحقل واحفظ.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'daten',
    icon: 'shield',
    titel: { de: 'Daten & Sicherheit', ar: 'البيانات والأمان' },
    sub: { de: 'Wo die Daten liegen und wer was darf', ar: 'أين تُخزَّن البيانات ومن له صلاحية ماذا' },
    artikel: [
      {
        id: 'wo',
        frage: { de: 'Wo liegen die Daten?', ar: 'أين تُخزَّن البيانات؟' },
        zu: '/einstellungen',
        antwort: [
          { p: {
            de: 'Derzeit im lokalen Demo-Modus: alles bleibt in diesem einen Browser. Zwei Geräte sehen also unterschiedliche Stände. Mit dem Online-Go-Live wandert alles in eine gemeinsame Datenbank – Büro und Monteure arbeiten dann auf demselben Stand, die Oberfläche bleibt exakt gleich.',
            ar: 'حاليًا في الوضع التجريبي المحلي: يبقى كل شيء في هذا المتصفح وحده. أي أن جهازين يريان حالتين مختلفتين. ومع التشغيل عبر الإنترنت تنتقل البيانات إلى قاعدة مشتركة – فيعمل المكتب والفنيون على الحالة نفسها، وتبقى الواجهة كما هي تمامًا.',
          } },
          { p: {
            de: 'Den aktuellen Modus zeigt Einstellungen → Daten.',
            ar: 'يظهر الوضع الحالي في الإعدادات ← البيانات.',
          } },
        ],
      },
      {
        id: 'rechte',
        frage: { de: 'Wer darf was ändern?', ar: 'من له صلاحية تغيير ماذا؟' },
        antwort: [
          { p: {
            de: 'Kunden, Baustellen, Preise, Artikel und Rechnungen ändert nur das Büro. Der Monteur darf an seinen Einsätzen das Häkchen „erledigt" setzen, im Leistungsverzeichnis die geleistete Menge melden und eigene Berichte und Spesen schreiben – solange sie nicht freigegeben sind.',
            ar: 'العملاء وورش البناء والأسعار والأصناف والفواتير لا يغيّرها إلا المكتب. أما الفني فيمكنه تحديد „منجز" في مهامه، والإبلاغ عن الكمية المنجزة في جدول الكميات، وكتابة تقاريره ومصاريفه – ما دامت غير معتمدة.',
          } },
        ],
      },
      {
        id: 'demo-reset',
        frage: { de: 'Was macht „Demo-Daten zurücksetzen"?', ar: 'ماذا يفعل „إعادة ضبط البيانات التجريبية"؟' },
        antwort: [
          { achtung: {
            de: 'Es löscht ALLES, was in diesem Browser erfasst wurde, und spielt die Beispieldaten neu ein. Auch angefangene Formular-Entwürfe. Es gibt keinen Weg zurück – nur benutzen, wenn man wirklich bei null anfangen will.',
            ar: 'يحذف كل ما سُجِّل في هذا المتصفح ويعيد تحميل البيانات النموذجية. بما في ذلك مسودات النماذج غير المكتملة. ولا رجعة عن ذلك – استخدمه فقط إن أردت البدء من الصفر فعلًا.',
          } },
        ],
      },
    ],
  },

  // =====================================================================
  {
    id: 'raeume',
    icon: 'raum',
    titel: { de: 'Räume und Bauplan', ar: 'الغرف والمخطط' },
    sub: {
      de: 'Räume aus dem PDF-Bauplan übernehmen, Fortschritt je Raum sehen, Mengen daraus abrechnen',
      ar: 'استيراد الغرف من مخطط PDF، ومتابعة التقدّم لكل غرفة، والفوترة من كمياتها',
    },
    artikel: [
      {
        id: 'plan-import',
        zu: '/projekte',
        frage: { de: 'Wie kommen die Räume aus dem Bauplan in das Programm?', ar: 'كيف تنتقل الغرف من المخطط إلى البرنامج؟' },
        antwort: [
          { p: {
            de: 'Der Import liest den Bauplan zweimal: einmal den Text und einmal die Zeichnung. Aus dem Text kommen Raumnummer, Name und Fläche, aus der Zeichnung kommen Lage, Breite, Länge und die Türen. Deshalb steht am Ende ein Grundriss, der dem Plan gleicht – und nicht eine Reihe gleich großer Kästchen.',
            ar: 'يقرأ الاستيراد المخطط مرتين: النص مرة والرسم مرة. من النص يأتي رقم الغرفة واسمها ومساحتها، ومن الرسم يأتي الموقع والعرض والطول والأبواب. لذلك ينتج في النهاية مخطط يشبه الأصل – لا صفٌّ من مربعات متساوية.',
          } },
          { schritte: [
            { de: 'Baustelle öffnen → Bereich „Räume" → „Aus Bauplan".', ar: 'افتح الورشة ← قسم „الغرف" ← „من المخطط".' },
            { de: 'PDF auswählen. Das Auswerten dauert bei großen Plänen einige Sekunden.', ar: 'اختر ملف PDF. قد يستغرق التحليل ثوانٍ في المخططات الكبيرة.' },
            { de: 'Die Kontrolltabelle prüfen: Nummer, Name, Fläche. Was unvollständig gelesen wurde, steht rot – dort steht der Name im Plan zu weit weg oder ist umbrochen.', ar: 'راجع جدول المراجعة: الرقم والاسم والمساحة. ما لم يُقرأ كاملًا يظهر بالأحمر – فهناك يكون الاسم بعيدًا في المخطط أو مقسومًا على سطرين.' },
            { de: 'Haken setzen bei allem, was übernommen werden soll, und „Übernehmen".', ar: 'ضع علامة على ما تريد استيراده ثم „اعتماد".' },
          ] },
          { merke: {
            de: 'Der Import ist ein Vorschlag, kein Automatismus. Geprüft wird im Büro – ein falsch gelesener Raumname landet sonst später auf dem Abschlussbericht.',
            ar: 'الاستيراد اقتراح لا عملية آلية. المراجعة تتم في المكتب – وإلا فإن اسم غرفة خاطئ سينتهي لاحقًا في التقرير النهائي.',
          } },
          { achtung: {
            de: 'Der Plan gibt die BODENFLÄCHE her, nicht den Umfang. Wandflächen werden deshalb überschlagen (Umfang ≈ 4 × √Fläche) und als „geschätzt" gekennzeichnet. Vor einer Rechnung über Wandflächen den Umfang je Raum einmal eintragen.',
            ar: 'يوفّر المخطط مساحة الأرضية لا المحيط. لذلك تُقدَّر مساحات الجدران (المحيط ≈ 4 × جذر المساحة) وتُوسم بأنها „تقديرية". قبل إصدار فاتورة على مساحات الجدران، أدخل المحيط لكل غرفة مرة واحدة.',
          } },
        ],
      },
      {
        id: 'plan-massstab',
        frage: { de: 'Woher weiß das Programm, wie groß ein Raum in Wirklichkeit ist?', ar: 'كيف يعرف البرنامج الحجم الحقيقي للغرفة؟' },
        antwort: [
          { p: {
            de: 'Der Maßstab steht in keinem Bauplan maschinenlesbar. Das Programm probiert deshalb die genormten Maßstäbe durch (1:10 bis 1:200) und nimmt den, bei dem die meisten Räume ihre GEDRUCKTE Fläche treffen. Das ist eine Probe mit bekanntem Ergebnis – die Flächen stehen ja im Plan.',
            ar: 'لا يحتوي أي مخطط على المقياس بصيغة يقرأها الحاسوب. لذلك يجرّب البرنامج المقاييس المعيارية (1:10 حتى 1:200) ويختار المقياس الذي تتطابق معه مساحات معظم الغرف المطبوعة. إنه اختبار بنتيجة معروفة مسبقًا – فالمساحات مذكورة في المخطط.',
          } },
          { p: {
            de: 'Dazu kommt eine harte Gegenprobe: Der Grundriss muss mindestens so groß sein wie die Summe aller Raumflächen. Ohne diese Prüfung gewann beim Testplan ein Maßstab, bei dem 442 m² Räume in einen Grundriss von 248 m² gepasst hätten.',
            ar: 'يضاف إلى ذلك اختبار صارم: يجب أن يكون المخطط الأرضي بحجم مجموع مساحات الغرف على الأقل. وبدون هذا الاختبار كان مقياس خاطئ سيفوز في المخطط التجريبي، بحيث تتسع 248 م² لغرف مساحتها 442 م².',
          } },
          { merke: {
            de: 'Nach dem Import steht über der Tabelle, welcher Maßstab erkannt wurde und wie viele Räume ihn bestätigen. Bestätigen ihn nur wenige, ist die Zeichnung nicht auswertbar – die Räume werden dann nebeneinander abgelegt und im Grundriss von Hand zurechtgeschoben.',
            ar: 'بعد الاستيراد يظهر فوق الجدول أي مقياس تم التعرف عليه وكم غرفة تؤكده. إذا أكّده عدد قليل فقط، فالرسم غير قابل للتحليل – وتُوضع الغرف حينها جنبًا إلى جنب وتُرتَّب يدويًا.',
          } },
        ],
      },
      {
        id: 'raum-3d',
        frage: { de: 'Was zeigt die 3D-Ansicht und wie bewegt man sich darin?', ar: 'ماذا تعرض العرض ثلاثي الأبعاد وكيف نتحرك فيه؟' },
        antwort: [
          { p: {
            de: 'Von oben sieht man, WO gearbeitet wird. Aufgestellt sieht man, WIE WEIT: eine gestrichene Nordwand ist in der Draufsicht unsichtbar, in der Raumansicht sofort erkennbar. Über jedem Raum steht ein Schild mit Nummer, Name, Fläche und Fortschrittsbalken.',
            ar: 'من الأعلى ترى أين يجري العمل. وبالعرض المجسّم ترى إلى أي مدى: الجدار الشمالي المطلي غير مرئي من الأعلى، لكنه واضح فورًا في العرض المجسّم. وفوق كل غرفة لوحة بالرقم والاسم والمساحة وشريط التقدّم.',
          } },
          { schritte: [
            { de: 'Drehen: mit der linken Maustaste ziehen (am Tablet: ein Finger).', ar: 'التدوير: اسحب بالزر الأيسر (على اللوح: إصبع واحد).' },
            { de: 'Verschieben: mit der rechten Maustaste ziehen oder die Pfeiltasten (am Tablet: zwei Finger).', ar: 'التحريك: اسحب بالزر الأيمن أو استخدم أسهم لوحة المفاتيح (على اللوح: إصبعان).' },
            { de: 'Zoomen: Mausrad oder die Knöpfe + und −.', ar: 'التكبير: عجلة الفأرة أو الزرّان + و −.' },
            { de: 'Verlaufen? „Alles zeigen" setzt die Ansicht zurück. „Von oben" und „Flach" sind feste Blickwinkel.', ar: 'تُهت؟ „إظهار الكل" يعيد ضبط العرض. و„من الأعلى" و„منظور منخفض" زاويتان ثابتتان.' },
          ] },
          { merke: {
            de: 'Zwei Betriebsarten: Voreingestellt ist SCHAUEN – drehen, zoomen, schieben, ohne dass sich etwas an den Daten ändert. Erst der Knopf „Bearbeiten“ macht aus einem Klick eine Änderung: auf eine Wand schaltet ihren Zustand weiter (offen → in Arbeit → fertig), auf den Boden öffnet den Raum mit seinen Aufgaben.',
            ar: 'وضعان: الوضع الافتراضي هو المشاهدة – تدوير وتكبير وتحريك دون تغيير أي بيانات. وزر «تحرير» وحده يحوّل النقرة إلى تعديل: النقر على جدار ينقل حالته، والنقر على الأرضية يفتح الغرفة مع مهامها.',
          } },
          { achtung: {
            de: 'Grün heißt: alle Arbeitsschritte des Raums sind abgehakt. Solange „Bearbeiten“ aus ist, kann beim Herumdrehen nichts versehentlich fertig gemeldet werden – genau dafür ist die Trennung da.',
            ar: 'الأخضر يعني اكتمال جميع خطوات العمل في الغرفة. وما دام «تحرير» مطفأً، لا يمكن الإبلاغ عن إنجاز بالخطأ أثناء التدوير – ولهذا وُجد هذا الفصل.',
          } },
        ],
      },
      {
        id: 'tueren',
        frage: { de: 'Woher kommen die Türen und wie ändert man sie?', ar: 'من أين تأتي الأبواب وكيف تُعدّل؟' },
        antwort: [
          { p: {
            de: 'Türen erscheinen an zwei Stellen: im Grundriss als Wandöffnung mit Türblatt und Aufschlagbogen – so wie ein Architekt sie zeichnet – und im 3D-Modell als echte Öffnung mit Sturz darüber und Schwelle darunter.',
            ar: 'تظهر الأبواب في موضعين: في المخطط كفتحة في الجدار مع الدرفة وقوس الفتح، وفي النموذج ثلاثي الأبعاد كفتحة حقيقية.',
          } },
          { schritte: [
            { de: 'Aus dem Bauplan kommen sie automatisch mit: Der Import erkennt die Türsymbole und ordnet jede Tür der richtigen Wand zu. Solche Türen sind mit „aus dem Plan“ gekennzeichnet.', ar: 'تأتي تلقائيًا من المخطط: يتعرّف الاستيراد على رموز الأبواب ويسند كل باب إلى جداره الصحيح.' },
            { de: 'Fehlt eine Tür oder stammt der Raum aus der Zeit vor dem Plan-Import: Raum im Grundriss doppelt anklicken → Abschnitt „Türen“ → Wand wählen.', ar: 'إذا نقص باب أو كانت الغرفة أقدم من الاستيراد: انقر الغرفة مرتين ← قسم «الأبواب» ← اختر الجدار.' },
            { de: 'Mit dem Schieberegler die Stelle auf der Wand einstellen. Die Änderung ist sofort im Grundriss und im Modell zu sehen.', ar: 'اضبط الموضع على الجدار بشريط التمرير. ويظهر التغيير فورًا.' },
          ] },
          { merke: {
            de: 'Türen mindern die Wandfläche: Jede Tür wird von IHRER Wand abgezogen, nicht pauschal verteilt. Das wirkt sich direkt auf die Sollmenge einer Wandposition aus.',
            ar: 'تقلّل الأبواب مساحة الجدار: يُخصم كل باب من جداره تحديدًا لا بالتوزيع العام.',
          } },
          { achtung: {
            de: 'Nicht jede Tür wird im Plan gefunden – manche sind anders gezeichnet. Was fehlt, wird bewusst NICHT erfunden: eine ausgedachte Tür an der falschen Wand verfälscht die Wandfläche und damit die Rechnung. Lieber von Hand nachtragen.',
            ar: 'لا يُعثر على كل باب في المخطط. وما ينقص لا يُختلق عمدًا: باب متخيّل على جدار خاطئ يشوّه مساحة الجدار وبالتالي الفاتورة.',
          } },
        ],
      },
      {
        id: 'raum-mengen',
        zu: '/projekte',
        frage: { de: 'Wie werden aus Räumen abrechenbare Quadratmeter?', ar: 'كيف تتحول الغرف إلى أمتار مربعة قابلة للفوترة؟' },
        antwort: [
          { p: {
            de: 'Die Quadratmeter ergeben sich aus den Räumen, der Preis aus dem Leistungsverzeichnis. Im Bereich „Räume" → „Mengen je Raum" wird für jede LV-Position gewählt, worauf sie sich bezieht: Decke, Boden, Wand, Wand + Decke oder Stück. Daraus entsteht je Raum eine Sollmenge.',
            ar: 'تأتي الأمتار المربعة من الغرف، والسعر من جدول الكميات. في قسم „الغرف" ← „الكميات لكل غرفة" يُختار لكل بند ما يستند إليه: السقف أو الأرضية أو الجدار أو الجدار+السقف أو القطعة. وينتج عن ذلك كمية مستهدفة لكل غرفة.',
          } },
          { schritte: [
            { de: 'Bezug je Position wählen und „Verteilen" drücken.', ar: 'اختر الأساس لكل بند واضغط „توزيع".' },
            { de: 'Die Summe wird gegen die LV-Menge gehalten. Eine Abweichung ist ein Hinweis, kein Fehler – ein Plan zeigt ein Geschoss, das LV umfasst oft mehrere.', ar: 'تُقارن النتيجة بكمية جدول الكميات. والفارق تنبيه لا خطأ – فالمخطط يعرض طابقًا واحدًا بينما يشمل الجدول عدة طوابق غالبًا.' },
            { de: 'Meldet der Monteur einen Raum als fertig, erscheint er unten grün. Mit „Übernehmen" wird die noch OFFENE Sollmenge als geleistete Menge gebucht.', ar: 'عندما يبلّغ الفني عن اكتمال غرفة تظهر بالأخضر في الأسفل. وبـ „اعتماد" تُسجَّل الكمية المتبقية ككمية منجزة.' },
          ] },
          { merke: {
            de: 'Doppelt gezählt werden kann nichts: Übernommen wird immer nur die Differenz aus Sollmenge und bereits gemeldeter Menge. Hat der Monteur schon von Hand gemeldet, bleibt nichts übrig.',
            ar: 'لا يمكن الاحتساب مرتين: يُعتمد دائمًا الفرق بين الكمية المستهدفة والكمية المُبلّغ عنها. وإذا كان الفني قد أبلغ يدويًا فلن يتبقى شيء.',
          } },
          { achtung: {
            de: 'Eine Zulage (z. B. „farbige Wandbeschichtung nach Vorgabe") gilt meist nur für einzelne Räume. Wird sie auf alle verteilt, steht dort ein Vielfaches der LV-Menge – die Warnung in Orange weist genau darauf hin. Solche Positionen von Hand melden.',
            ar: 'البند الإضافي (مثل „طلاء جدران ملوّن حسب المواصفة") يخص غرفًا محددة عادة. وإذا وُزّع على الجميع ظهر أضعاف كمية الجدول – والتحذير البرتقالي يشير إلى ذلك تحديدًا. بلّغ عن هذه البنود يدويًا.',
          } },
        ],
      },
      {
        id: 'wandflaeche',
        frage: { de: 'Wie wird die Wandfläche eines Raums berechnet?', ar: 'كيف تُحسب مساحة جدران الغرفة؟' },
        antwort: [
          { p: {
            de: 'Umfang × Raumhöhe, abzüglich der Öffnungen. Ist ein Umfang eingetragen, gilt dieser – er wurde gemessen. Fehlt er, wird er aus Breite und Länge gerechnet. Fehlen auch die, wird er aus der Fläche überschlagen (Umfang ≈ 4 × √Fläche) und als „geschätzt“ gekennzeichnet.',
            ar: 'المحيط × ارتفاع الغرفة، ناقص الفتحات. وإذا أُدخل محيط فهو المعتمد – لأنه مقاس.',
          } },
          { merke: {
            de: 'Es gibt genau EINE Wandrechnung. Die Summe der vier Einzelwände und die ausgewiesene Gesamtwandfläche sind immer dieselbe Zahl – im Raumfenster, auf dem Handy und in der Mengenverteilung.',
            ar: 'هناك حساب واحد فقط للجدران. مجموع الجدران الأربعة والمساحة الإجمالية هما دائمًا الرقم نفسه.',
          } },
          { achtung: {
            de: 'Eine geschätzte Wandfläche gehört nicht ungeprüft in eine Rechnung. Vor der Abrechnung von Wandpositionen den Umfang je Raum einmal messen und eintragen – dann verschwindet das Kennzeichen.',
            ar: 'لا تدخل مساحة جدار تقديرية في فاتورة دون مراجعة. قِس المحيط لكل غرفة وأدخله مرة واحدة.',
          } },
        ],
      },
      {
        id: 'abschlussbericht',
        zu: '/projekte',
        frage: { de: 'Wie entsteht am Ende der Bericht über die geleisteten Arbeiten?', ar: 'كيف ينشأ التقرير النهائي عن الأعمال المنجزة؟' },
        antwort: [
          { p: {
            de: 'Im Bereich „Räume" auf „Abschlussbericht drucken". Der Bericht sammelt, was auf der Baustelle tatsächlich abgehakt wurde: je Raum die ausgeführten Arbeitsschritte mit Datum und Name, dazu den Mengennachweis gegen das LV und die erfassten Regieberichte.',
            ar: 'في قسم „الغرف" اضغط „طباعة التقرير النهائي". يجمع التقرير ما تم إنجازه فعليًا في الورشة: خطوات العمل المنفذة لكل غرفة مع التاريخ والاسم، إضافة إلى إثبات الكميات مقابل جدول الكميات وتقارير العمل المسجلة.',
          } },
          { merke: {
            de: 'Sind ALLE Arbeitsschritte erledigt, ist das Papier eine Fertigstellungsanzeige nach § 12 Abs. 1 VOB/B und verlangt die Abnahme binnen 12 Werktagen. Fehlt noch etwas, druckt es als „Zwischenbericht" und löst keine Frist aus – das steht dann auch ausdrücklich darauf.',
            ar: 'إذا اكتملت كل خطوات العمل، فالورقة إشعار إنجاز وفق المادة 12 فقرة 1 من VOB/B وتطالب بالاستلام خلال 12 يوم عمل. وإن بقي شيء ناقص، تُطبع كـ„تقرير مرحلي" ولا تُطلق أي مهلة – ويُذكر ذلك صراحة عليها.',
          } },
          { p: {
            de: 'Preise stehen bewusst nicht darauf. Der Abschlussbericht weist die LEISTUNG nach, die Rechnung stellt das Geld. Wer beides mischt, diskutiert bei der Abnahme über Beträge statt über Mängel.',
            ar: 'الأسعار غير مذكورة عمدًا. التقرير النهائي يثبت الأداء، والفاتورة تطالب بالمال. ومن يخلط بينهما سيناقش المبالغ عند الاستلام بدل مناقشة العيوب.',
          } },
        ],
      },
    ],
  },
]

// =====================================================================
// Anwendungsfälle: Alltagssituationen mit dem Weg, den man dafür geht.
//
// Unterschied zu den Artikeln oben: Ein Artikel beantwortet „wie funktioniert
// X?". Ein Anwendungsfall beantwortet „bei mir ist gerade Y passiert – was
// jetzt?". Wer die Hilfe öffnet, steckt meistens im zweiten Fall.
//
// Die Schritte sind gegen den Quelltext geprüft: die genannten Beschriftungen
// stehen so wirklich in der Oberfläche. Wer die Oberfläche ändert, ändert hier
// mit – sonst schickt die Hilfe den Benutzer auf einen Knopf, den es nicht gibt.
//
// fall = { id, zu?, titel{de,ar}, ausloeser{de,ar}, antwort:[Absatz…] }
//   ausloeser = die Situation in einem Satz, wie sie im Betrieb vorkommt
// =====================================================================

export const FAELLE = [
  // -------------------------------------------------------------------
  {
    id: 'neue-baustelle',
    zu: '/projekte',
    titel: { de: 'Neuer Auftrag ist da', ar: 'وصل أمر عمل جديد' },
    ausloeser: {
      de: 'Ein Generalunternehmer erteilt den Auftrag und schickt das Leistungsverzeichnis als CSV oder als PDF.',
      ar: 'يُرسي مقاول عام الأمر ويرسل جدول الكميات كملف CSV أو PDF.',
    },
    antwort: [
      { schritte: [
        { de: 'Unter „Kunden" nachsehen, ob der Auftraggeber schon steht. Wenn nicht: „Neuer Kunde" – bei Typ „Generalunternehmer (GU)" und USt-Modus „§13b netto (Reverse-Charge)", dazu Zahlungsziel und Sicherheitseinbehalt aus dem Vertrag.', ar: 'تحقق في „العملاء" مما إذا كان صاحب العمل مسجلًا. إن لم يكن: „عميل جديد" – النوع „مقاول عام" ونمط الضريبة „§13b صافي (عكس التكليف)"، مع مهلة السداد والضمان المحتجز من العقد.' },
        { de: 'In „Projekte" oben rechts auf „Neues Projekt". Projektname und Kunde sind Pflicht; die Nummer ist mit der nächsten freien im Muster P-Jahr-001 vorbelegt.', ar: 'في „المشاريع" أعلى اليمين „مشروع جديد". اسم المشروع والعميل إلزاميان؛ والرقم مُعبأ مسبقًا بالتالي المتاح بصيغة P-السنة-001.' },
        { de: 'In der neuen Baustelle links „Leistungsverzeichnis" wählen und auf „LV importieren" klicken.', ar: 'في ورشة البناء الجديدة اختر „جدول الكميات" على اليسار وانقر „استيراد جدول الكميات".' },
        { de: 'CSV-Datei laden oder den kopierten Text aus dem LV-PDF einfügen. Die Spalten ordnet das System selbst zu – kontrollieren und dann auf „Zeilen prüfen".', ar: 'حمّل ملف CSV أو ألصق النص المنسوخ من ملف PDF. يربط النظام الأعمدة تلقائيًا – راجعها ثم انقر „فحص الأسطر".' },
        { de: 'Die Vorschau Zeile für Zeile durchgehen. Unten steht die LV-Summe – die gegen die Endsumme auf dem Papier-LV halten. Stimmt sie, mit „Zeilen übernehmen" speichern.', ar: 'راجع المعاينة سطرًا بسطر. في الأسفل مجموع جدول الكميات – قارنه بالمجموع النهائي في الجدول الورقي. إذا تطابق، احفظ عبر „اعتماد الأسطر".' },
      ] },
      { achtung: {
        de: 'Rote und gelbe Hinweise über der Vorschau nicht wegklicken. Sie nennen die Positionsnummern, bei denen Menge oder Preis fehlt oder unlesbar war. Ein übersehener Nullwert fehlt am Monatsende in der Rechnung – und dann sucht ihn niemand mehr.',
        ar: 'لا تتجاهل التنبيهات الحمراء والصفراء فوق المعاينة. فهي تذكر أرقام البنود التي تنقصها الكمية أو السعر أو كانت غير مقروءة. القيمة الصفرية التي تفوتك ستنقص من الفاتورة آخر الشهر – ولن يبحث عنها أحد بعدها.',
      } },
      { merke: {
        de: 'Das Feld „Projektvolumen" darf leer bleiben – in der Baustelle selbst rechnet dann die LV-Summe. In der Projektliste steht in der Spalte „Volumen" allerdings ein Strich, solange nichts eingetragen ist.',
        ar: 'يمكن ترك حقل „قيمة المشروع" فارغًا – فداخل ورشة البناء يُحسب مجموع جدول الكميات. لكن في قائمة المشاريع يبقى في عمود „القيمة" شَرطة ما دام الحقل فارغًا.',
      } },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'woche-planen',
    zu: '/',
    titel: { de: 'Woche planen', ar: 'تخطيط الأسبوع' },
    ausloeser: {
      de: 'Freitagnachmittag: es steht fest, welche Baustellen nächste Woche laufen – jetzt muss festgelegt werden, welche Kolonne wohin fährt.',
      ar: 'بعد ظهر الجمعة: تحدّدت الورش التي ستعمل الأسبوع القادم – والآن يجب تحديد أي فريق يذهب إلى أين.',
    },
    antwort: [
      { schritte: [
        { de: 'Im Kalender mit den Pfeilen neben „Heute" auf die kommende Woche blättern.', ar: 'في التقويم انتقل بالأسهم بجانب „اليوم" إلى الأسبوع القادم.' },
        { de: 'In die freie Fläche im gewünschten Tag und zur gewünschten Uhrzeit klicken – Tag und Startzeit stehen dann schon im Fenster.', ar: 'انقر على المساحة الفارغة في اليوم والوقت المطلوبين – فيظهر التاريخ ووقت البدء في النافذة تلقائيًا.' },
        { de: 'Baustelle wählen. Kunde und ein Titelvorschlag kommen automatisch mit. Fehlt die Baustelle, geht „+ Neues Projekt anlegen" direkt aus dem Fenster.', ar: 'اختر ورشة البناء. يأتي العميل واقتراح العنوان تلقائيًا. وإن كانت الورشة غير موجودة، فزر „+ إنشاء مشروع جديد" يعمل من داخل النافذة.' },
        { de: 'Unter „Aufgaben für diesen Einsatz" die LV-Positionen ankreuzen, die an diesem Tag drankommen – der Monteur sieht sie auf dem Handy.', ar: 'تحت „مهام هذه الزيارة" حدّد بنود جدول الكميات المقررة لهذا اليوم – سيراها الفني على الهاتف.' },
        { de: 'Monteure antippen. Wer zuerst angetippt wird, bestimmt Farbe und Team-Beschriftung im Kalender.', ar: 'انقر على الفنيين. أول من يُنقر عليه يحدد اللون واسم الفريق في التقويم.' },
        { de: 'Für Folgetage auf derselben Baustelle den Einsatz anklicken und „Kopieren (+1 Tag)" nehmen – das legt genau einen Tag an, für eine ganze Woche also mehrfach.', ar: 'للأيام التالية في الورشة نفسها انقر على المهمة واختر „نسخ (+ يوم)" – وهذا ينشئ يومًا واحدًا فقط، فللأسبوع كامل كرّر العملية.' },
      ] },
      { merke: {
        de: 'Überschneidungen sind gewollt und werden nicht verhindert – mehrere Kolonnen arbeiten parallel. Zwei Einsätze zur selben Zeit stehen im Kalender nebeneinander.',
        ar: 'التداخل مقصود ولا يُمنع – فعدة فرق تعمل بالتوازي. تظهر المهمتان في الوقت نفسه جنبًا إلى جنب في التقويم.',
      } },
      { achtung: {
        de: 'Ohne zugewiesenen Monteur kommt zwar eine Rückfrage, der Einsatz lässt sich aber trotzdem anlegen. Er steht dann im Kalender, erscheint aber auf keinem Handy – und niemand fährt hin.',
        ar: 'بدون إسناد فني يظهر سؤال تأكيد، لكن يمكن إنشاء المهمة رغم ذلك. عندها تظهر في التقويم لكنها لا تصل إلى أي هاتف – ولا يذهب أحد.',
      } },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'regiebericht',
    zu: '/berichte',
    titel: { de: 'Zusatzarbeiten belegen', ar: 'إثبات الأعمال الإضافية' },
    ausloeser: {
      de: 'Die Bauleitung ordnet auf der Baustelle Arbeiten an, die nicht im Leistungsverzeichnis stehen.',
      ar: 'تأمر إدارة الموقع بأعمال غير واردة في جدول الكميات.',
    },
    antwort: [
      { p: {
        de: 'Wichtig ist die Reihenfolge: erst anzeigen, dann arbeiten, dann belegen. Stundenlohnarbeiten müssen dem Auftraggeber VOR Beginn angezeigt werden (§ 15 Abs. 3 VOB/B) – deshalb fragt das Formular als Erstes danach.',
        ar: 'الترتيب هو الأهم: أبلِغ أولًا، ثم اعمل، ثم وثّق. يجب إبلاغ صاحب العمل بأعمال الأجر بالساعة قبل البدء (§ 15 فقرة 3 VOB/B) – ولذلك يسأل النموذج عن ذلك أولًا.',
      } },
      { schritte: [
        { de: 'Der Monteur öffnet am Handy seinen Einsatz und tippt auf „Zur Baustelle", dort auf „Regiebericht".', ar: 'يفتح الفني مهمته على الهاتف وينقر „إلى ورشة البناء"، ثم „تقرير عمل بالساعات".' },
        { de: 'Im gelben Feld eintragen: wer die Arbeiten angeordnet hat, wann, und ob mündlich, schriftlich oder per E-Mail.', ar: 'في الحقل الأصفر أدخل: من أمر بالأعمال، ومتى، وهل كان شفهيًا أو كتابيًا أو بالبريد.' },
        { de: 'Mindestens ein Vorher-Foto aufnehmen, dann beschreiben, was zusätzlich gemacht wurde.', ar: 'التقط صورة „قبل" واحدة على الأقل، ثم صف ما أُنجز إضافيًا.' },
        { de: 'Je Person eine Zeile mit Name, Datum, Von und Bis. Die Stunden rechnen sich selbst – wer stattdessen die Stundenzahl eintippt, verschiebt damit die Bis-Uhrzeit. Material über „+ Artikel hinzufügen …".', ar: 'سطر لكل شخص مع الاسم والتاريخ ومن وإلى. تُحسب الساعات تلقائيًا – ومن يُدخل عدد الساعات بدلًا من ذلك يُزيح وقت النهاية. والمواد عبر „+ إضافة صنف …".' },
        { de: 'Mindestens ein Nachher-Foto, dann „Einreichen". Wer noch nicht fertig ist, nimmt „Als Entwurf speichern" – das geht immer.', ar: 'صورة „بعد" واحدة على الأقل، ثم „إرسال". ومن لم ينتهِ بعد يختار „حفظ كمسودة" – وهذا متاح دائمًا.' },
        { de: 'Im Büro unter „Berichte" die Ansicht „Eingereicht", den Bericht prüfen und auf „Freigeben". Erst danach taucht er in der Rechnungsstellung auf.', ar: 'في المكتب ضمن „التقارير" اختر „مُرسل"، راجع التقرير وانقر „اعتماد". وعندها فقط يظهر في إعداد الفواتير.' },
      ] },
      { bild: 'berichtGate', unterschrift: {
        de: '„Einreichen" bleibt gesperrt, bis alle sechs Punkte stehen. Darüber steht immer, was noch fehlt.',
        ar: 'يبقى „الإرسال" مقفلًا حتى تكتمل النقاط الست. وفوقه يُذكر دائمًا ما ينقص.',
      } },
      { achtung: {
        de: 'Fotos lassen sich erst aufnehmen, wenn oben eine Baustelle gewählt ist. Sonst kommt „Bitte ein Projekt wählen (Abschnitt 1)." Das trifft vor allem die Erfassung im Büro, wo nichts vorbelegt ist.',
        ar: 'لا يمكن التقاط الصور قبل اختيار ورشة بناء في الأعلى. وإلا ظهرت رسالة „يرجى اختيار مشروع (القسم 1)." وهذا يخص بالأخص التسجيل من المكتب حيث لا شيء مُعبأ مسبقًا.',
      } },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'stundenliste',
    zu: '/stunden',
    titel: { de: 'Monatsende: Stunden ans Lohnbüro', ar: 'نهاية الشهر: الساعات إلى مكتب الرواتب' },
    ausloeser: {
      de: 'Der Monat ist zu Ende und das Lohnbüro braucht für jeden Monteur einen unterschriebenen Stundenzettel.',
      ar: 'انتهى الشهر ويحتاج مكتب الرواتب إلى كشف ساعات موقّع لكل فني.',
    },
    antwort: [
      { schritte: [
        { de: '„Stundenlisten" öffnen und oben den abgerechneten Monat wählen. „Ganzer Monat" stehen lassen – „Bis heute" ist nur für den Zwischenstand im laufenden Monat.', ar: 'افتح „كشوف الساعات" واختر الشهر المطلوب في الأعلى. اترك „الشهر كاملًا" – فـ„حتى اليوم" مخصص للحالة المؤقتة في الشهر الجاري فقط.' },
        { de: 'Den Haken „Nur freigegebene Berichte" gesetzt lassen. Fehlt ein Monteur oder hat er zu wenige Stunden, liegen seine Berichte noch auf „Eingereicht" – die zuerst unter „Berichte" freigeben.', ar: 'اترك خيار „التقارير المعتمدة فقط" مفعّلًا. إن نقص فني أو كانت ساعاته قليلة، فتقاريره ما زالت „مُرسلة" – اعتمدها أولًا في „التقارير".' },
        { de: 'Bei jeder Person mit dem orangen Hinweis „× prüfen" die gelb hinterlegten Tage öffnen und im Regiebericht korrigieren. Erst dann drucken.', ar: 'عند كل شخص عليه تنبيه „× للمراجعة" افتح الأيام المظللة بالأصفر وصحّحها في تقرير العمل. ولا تطبع إلا بعد ذلك.' },
        { de: '„Stundenzettel (PDF)" je Person – oder „Alle drucken" für ein Dokument mit einer Seite je Mitarbeiter.', ar: '„كشف الساعات (PDF)" لكل شخص – أو „طباعة الكل" للحصول على مستند بصفحة لكل موظف.' },
        { de: 'Ausdruck von Mitarbeiter und Bauleitung unterschreiben lassen. Das Feld „Summe & Bemerkungen" bleibt bewusst leer für handschriftliche Ergänzungen.', ar: 'وقّع الكشف من الموظف وإدارة الموقع. ويبقى حقل „المجموع والملاحظات" فارغًا عمدًا للإضافات بخط اليد.' },
      ] },
      { bild: 'stundenzettel', unterschrift: {
        de: 'Jeder Kalendertag steht auf dem Blatt – auch die ohne Einsatz, wie auf dem Papierzettel.',
        ar: 'يظهر كل يوم من الشهر في الكشف – حتى الأيام بلا عمل، تمامًا كما في الكشف الورقي.',
      } },
      { merke: {
        de: 'Die Pause ist nirgends erfasst, sie wird gerechnet: frühester Beginn bis spätestes Ende minus gemeldete Arbeitsstunden. War jemand an einem Tag auf zwei Baustellen, zählt die Fahrt dazwischen als Pause.',
        ar: 'الاستراحة غير مسجّلة في أي مكان، بل تُحسب: من أبكر بداية إلى أحدث نهاية ناقص ساعات العمل المُبلَّغة. ومن كان في ورشتين في يوم واحد، تُحتسب فترة التنقل بينهما استراحةً.',
      } },
      { achtung: {
        de: 'Ein Mitarbeiter wird über sein Benutzerkonto oder den exakt geschriebenen Namen zugeordnet. Ist im Bericht kein Konto gewählt und der Name einmal anders geschrieben, entstehen zwei Karten für denselben Menschen – und seine Stunden verteilen sich auf zwei Zettel.',
        ar: 'يُربط الموظف عبر حسابه أو عبر اسمه المكتوب بدقة. فإن لم يُختر حساب في التقرير وكُتب الاسم مرة بشكل مختلف، نشأت بطاقتان للشخص نفسه – وتوزّعت ساعاته على كشفين.',
      } },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'abschlag',
    zu: '/abrechnung',
    titel: { de: 'Abschlagsrechnung stellen', ar: 'إصدار فاتورة دفعة' },
    ausloeser: {
      de: 'Auf einer laufenden Baustelle ist ein Bauabschnitt geschafft – der geleistete Teil soll abgerechnet werden.',
      ar: 'أُنجزت مرحلة في ورشة بناء جارية – ويُراد فوترة الجزء المنفَّذ.',
    },
    antwort: [
      { bild: 'rechnungQuellen', unterschrift: {
        de: 'Drei Quellen laufen zusammen. Nur freigegebene Regieberichte und eingereichte Spesen erscheinen zur Auswahl.',
        ar: 'تلتقي ثلاثة مصادر. ولا تظهر للاختيار إلا تقارير العمل المعتمدة والمصاريف المُرسلة.',
      } },
      { schritte: [
        { de: '„Abrechnung" öffnen, „Rechnung erstellen", Baustelle anklicken. Rechts in der Zeile steht schon, ob der Kunde §13b netto oder 19 % USt bekommt.', ar: 'افتح „الفوترة"، ثم „إنشاء فاتورة"، وانقر على ورشة البناء. يظهر في السطر ما إذا كان العميل على §13b صافي أو 19 ٪ ض.ق.م.' },
        { de: 'Die LV-Zeilen durchgehen: „Monteur" zeigt die gemeldete Menge, „Rest lt. LV" den vertraglichen Rest, in „Abrechnen" steht, was auf die Rechnung geht.', ar: 'راجع سطور جدول الكميات: „الفني" يعرض الكمية المُبلَّغة، و„المتبقي حسب الجدول" المتبقي التعاقدي، وفي „للفوترة" ما سيُدرج في الفاتورة.' },
        { de: 'Weiter unten die gewünschten Regieberichte und Spesen ankreuzen, dann „Weiter zur Vorschau".', ar: 'حدّد أدناه تقارير العمل والمصاريف المطلوبة، ثم „التالي إلى المعاينة".' },
        { de: 'Titel und Leistungszeitraum prüfen. In der Tabelle lassen sich Text, Menge und Preis noch ändern; „+ Freie Position" ergänzt eine Nachtragszeile.', ar: 'راجع العنوان وفترة الأداء. يمكن تعديل النص والكمية والسعر في الجدول؛ و„+ بند حر" يضيف سطرًا إضافيًا.' },
        { de: 'Sicherheitseinbehalt prüfen, dann „Speichern + an FastBill übertragen". Dort liegt sie als Entwurf.', ar: 'راجع الضمان المحتجز، ثم „حفظ وإرسال إلى FastBill". وتبقى هناك كمسودة.' },
        { de: 'Zurück in der Liste „Abschließen + Nummer" – erst damit vergibt FastBill die Rechnungsnummer, und erst dann lässt sich die Rechnung per Mail senden.', ar: 'ارجع إلى القائمة واختر „إنهاء + رقم" – وعندها فقط يمنح FastBill رقم الفاتورة، ولا يمكن إرسالها بالبريد قبل ذلك.' },
      ] },
      { merke: {
        de: 'Hat der Monteur nichts gemeldet, steht in „Abrechnen" eine 0 – die Zeile verschwindet aber nicht. Das Büro kann die Menge selbst eintragen, höchstens bis zum vertraglichen Rest. Wer mehr einträgt als gemeldet, sieht die Zeile gelb.',
        ar: 'إن لم يُبلغ الفني بشيء، تكون القيمة في „للفوترة" صفرًا – لكن السطر لا يختفي. يمكن للمكتب إدخال الكمية بنفسه، بحد أقصى المتبقي التعاقدي. ومن يُدخل أكثر مما أُبلغ عنه يرى السطر بالأصفر.',
      } },
      { achtung: {
        de: 'Der Sicherheitseinbehalt geht NICHT an FastBill mit. Dort steht der volle Betrag – der Abzug muss in FastBill von Hand nachgetragen oder beim Zahlungseingang selbst überwacht werden.',
        ar: 'لا يُرسَل الضمان المحتجز إلى FastBill. فهناك يظهر المبلغ الكامل – ويجب إضافة الخصم يدويًا في FastBill أو مراقبته عند استلام الدفعة.',
      } },
      { achtung: {
        de: 'Ob §13b greift, hängt am Kunden, nicht an der Baustelle. Ist der Kunde falsch eingestellt, ist die ganze Rechnung steuerlich falsch. Vor der ersten Rechnung eines neuen Auftraggebers den USt-Modus prüfen.',
        ar: 'سريان §13b يعتمد على العميل لا على ورشة البناء. فإن كان إعداد العميل خاطئًا كانت الفاتورة كلها خاطئة ضريبيًا. راجع نمط الضريبة قبل أول فاتورة لأي صاحب عمل جديد.',
      } },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'abnahme',
    zu: '/berichte',
    titel: { de: 'Reklamation und Abnahme', ar: 'شكوى واستلام' },
    ausloeser: {
      de: 'Der Bauleiter rügt eine mangelhafte Fläche – wenige Tage später soll dieselbe Leistung förmlich abgenommen werden.',
      ar: 'يعترض مدير الموقع على سطح معيب – وبعد أيام قليلة يُراد استلام العمل نفسه رسميًا.',
    },
    antwort: [
      { schritte: [
        { de: 'Für die Rüge: „Berichte" → „Reklamation". Im roten Feld eintragen, wer gerügt hat, wann die Rüge zuging und bis wann der Mangel beseitigt sein muss.', ar: 'للشكوى: „التقارير" ← „شكوى". في الحقل الأحمر أدخل من قدّم الشكوى ومتى وردت وحتى متى يجب إصلاح العيب.' },
        { de: 'Vorher-Foto, Beschreibung des Mangels, dazu Ursache und Maßnahme zur Nachbesserung.', ar: 'صورة „قبل"، ووصف العيب، مع السبب وإجراء الإصلاح.' },
        { de: 'Nach der Nachbesserung das Nachher-Foto ergänzen und einreichen. Vorher bleibt der Bericht als Entwurf liegen – das ist der normale Weg.', ar: 'بعد الإصلاح أضف صورة „بعد" وأرسل. وقبل ذلك يبقى التقرير مسودة – وهذا هو المسار الطبيعي.' },
        { de: 'Für die Abnahme: „Berichte" → „Abnahme". Art der Abnahme (Gesamt oder Teil), Ort und den abgenommenen Leistungsumfang eintragen.', ar: 'للاستلام: „التقارير" ← „استلام". أدخل نوع الاستلام (كلي أو جزئي) والمكان ونطاق الأعمال المستلمة.' },
        { de: 'Entweder „Abnahme ohne Mängel" aktiv lassen – oder ausschalten und je Mangel eine Zeile mit Frist eintragen.', ar: 'إما أن تُبقي „استلام بدون عيوب" مفعّلًا – أو تعطّله وتُدخل سطرًا لكل عيب مع مهلة.' },
        { de: 'Vertragsstrafe vorbehalten: „ja" oder „nein" anklicken. Beide Unterschriften einholen, einreichen, im Büro freigeben und als PDF drucken.', ar: 'التحفظ على الغرامة التعاقدية: انقر „نعم" أو „لا". احصل على التوقيعين، أرسل، اعتمد في المكتب، واطبع كملف PDF.' },
      ] },
      { achtung: {
        de: 'Die Frage nach der Vertragsstrafe ist absichtlich nicht vorbelegt – weder ja noch nein. Ohne Klick bleibt „Einreichen" gesperrt. Wird die Vertragsstrafe bei der Abnahme nicht vorbehalten (§ 11 VOB/B), ist sie verfallen.',
        ar: 'سؤال الغرامة التعاقدية غير مُعبأ مسبقًا عمدًا – لا بنعم ولا بلا. وبدون النقر يبقى „الإرسال" مقفلًا. وإن لم تُتحفَّظ الغرامة عند الاستلام (§ 11 VOB/B) سقطت.',
      } },
      { achtung: {
        de: 'Wer erst Mängel einträgt und danach „Abnahme ohne Mängel" wieder anschaltet, verliert die Liste – sie wird beim Speichern leer abgelegt. Mangelzeilen ohne Text fallen ebenfalls weg.',
        ar: 'من يُدخل عيوبًا ثم يعيد تفعيل „استلام بدون عيوب" يفقد القائمة – إذ تُحفظ فارغة. وتسقط أيضًا سطور العيوب بلا نص.',
      } },
      { bild: 'freigabe', unterschrift: {
        de: 'Nach der Freigabe ist das Protokoll gesperrt – Korrekturen nur, indem das Büro die Freigabe zurückzieht.',
        ar: 'بعد الاعتماد يصبح المحضر مقفلًا – ولا تصحيح إلا بسحب المكتب للاعتماد.',
      } },
    ],
  },
]

// Freitextsuche über Titel, Fragen und Antworten – beide Sprachen gleichzeitig,
// damit auch ein deutscher Suchbegriff in der arabischen Ansicht trifft.
export function sucheWissen(begriff) {
  const q = (begriff || '').trim().toLowerCase()
  if (!q) return WISSEN
  const passt = (obj) => obj && Object.values(obj).some((v) => String(v).toLowerCase().includes(q))
  const absatzText = (a) => {
    if (a.p) return passt(a.p)
    if (a.merke) return passt(a.merke)
    if (a.achtung) return passt(a.achtung)
    if (a.schritte) return a.schritte.some(passt)
    if (a.bild) return passt(a.unterschrift)
    return false
  }
  return WISSEN
    .map((b) => ({
      ...b,
      artikel: b.artikel.filter((a) => passt(a.frage) || a.antwort.some(absatzText)),
    }))
    .filter((b) => b.artikel.length > 0 || passt(b.titel) || passt(b.sub))
}

// Suche über die Anwendungsfälle – gleiche Regeln wie sucheWissen.
export function sucheFaelle(begriff) {
  const q = (begriff || '').trim().toLowerCase()
  if (!q) return FAELLE
  const passt = (obj) => obj && Object.values(obj).some((v) => String(v).toLowerCase().includes(q))
  const absatzText = (a) => {
    if (a.p) return passt(a.p)
    if (a.merke) return passt(a.merke)
    if (a.achtung) return passt(a.achtung)
    if (a.schritte) return a.schritte.some(passt)
    if (a.bild) return passt(a.unterschrift)
    return false
  }
  return FAELLE.filter((f) =>
    passt(f.titel) || passt(f.ausloeser) || f.antwort.some(absatzText))
}
