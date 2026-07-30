// Echte Daten der Praxis an der Wertachbrücke (Stand Juli 2026, von der bestehenden Webseite)
// Übersetzbare Felder sind {de,en,ar}-Objekte -> Anzeige über tr() aus ./i18n.js

export const PRAXIS = {
  name: 'Praxis an der Wertachbrücke',
  untertitel: 'Ingeborg Steidle & Kollegen',
  strasse: 'Schöpplerstraße 4',
  plzOrt: '86154 Augsburg',
  telefon: '0821 / 42 22 05',
  telefonLink: 'tel:+498214222 05'.replace(/\s/g, ''),
  email: 'info@praxis-an-der-wertachbruecke.de',
  hinweisNachfolge: {
    de: 'Nachfolge der Praxis Dr. Ivaylo Trifonov',
    en: 'Successor practice of Dr. Ivaylo Trifonov',
    ar: 'العيادة الخلف لعيادة د. إيفايلو تريفونوف',
  },
  sprachen: {
    de: 'Deutsch, Englisch, Arabisch, Türkisch, Urdu',
    en: 'German, English, Arabic, Turkish, Urdu',
    ar: 'الألمانية، الإنجليزية، العربية، التركية، الأردية',
  },
  stornoHinweis: {
    de: 'Professionelle Zahnreinigung: Bei Absage weniger als 24 Stunden vor dem Termin fällt eine Gebühr von 50 € an.',
    en: 'Professional dental cleaning: cancellations less than 24 hours before the appointment incur a fee of €50.',
    ar: 'التنظيف الاحترافي للأسنان: عند الإلغاء قبل أقل من 24 ساعة من الموعد تُفرض رسوم قدرها 50 يورو.',
  },
}

export const TEAM = [
  {
    name: 'Jonas Strötz',
    rolle: { de: 'Zahnarzt · Praxisinhaber', en: 'Dentist · Practice owner', ar: 'طبيب أسنان · صاحب العيادة' },
    info: {
      de: 'Studium an der Universität Mainz und der LMU München.',
      en: 'Studied at the University of Mainz and LMU Munich.',
      ar: 'درس في جامعة ماينتس وجامعة ميونخ (LMU).',
    },
    kuerzel: 'JS',
    foto: '/bilder/jonas.webp',
  },
  {
    name: 'Ingeborg Steidle',
    rolle: { de: 'Zahnärztin', en: 'Dentist', ar: 'طبيبة أسنان' },
    info: {
      de: 'Seit 1984 zahnärztlich tätig, Studium an der LMU München.',
      en: 'Practising dentistry since 1984, studied at LMU Munich.',
      ar: 'تمارس طب الأسنان منذ عام 1984، درست في جامعة ميونخ (LMU).',
    },
    kuerzel: 'IS',
  },
  {
    name: 'Elias Erben',
    rolle: { de: 'Zahnarzt', en: 'Dentist', ar: 'طبيب أسنان' },
    info: {
      de: 'Studium an der Universität Regensburg.',
      en: 'Studied at the University of Regensburg.',
      ar: 'درس في جامعة ريغنسبورغ.',
    },
    kuerzel: 'EE',
  },
  {
    name: 'Martha',
    rolle: { de: 'Therapiehündin', en: 'Therapy dog', ar: 'كلبة العلاج' },
    info: {
      de: 'Nimmt kleinen und großen Patienten die Angst.',
      en: 'Takes the fear away from patients young and old.',
      ar: 'تزيل الخوف عن المرضى الصغار والكبار.',
    },
    kuerzel: '🐕',
  },
]

// Bilder: eigene Praxisfotos + frei lizenzierte Fotos (Wikimedia Commons, CC –
// Quellenangabe im Leistungs-Dialog). vorherNachher markiert Vergleichsbilder.
export const LEISTUNGEN = [
  {
    id: 'prophylaxe', icon: 'sparkle',
    titel: { de: 'Prophylaxe & Professionelle Zahnreinigung (PZR)', en: 'Prophylaxis & professional dental cleaning (PZR)', ar: 'الوقاية وتنظيف الأسنان الاحترافي (PZR)' },
    text: {
      de: 'Professionelle Zahnreinigung und Vorsorge für gesunde Zähne ein Leben lang.',
      en: 'Professional cleaning and preventive care for healthy teeth – for life.',
      ar: 'تنظيف احترافي ورعاية وقائية لأسنان صحية مدى الحياة.',
    },
    details: {
      de: 'Bei der Professionellen Zahnreinigung entfernt unser Prophylaxe-Team hartnäckige Beläge, Zahnstein und Verfärbungen – auch dort, wo die Zahnbürste nicht hinkommt. Anschließend werden die Zähne poliert und fluoridiert, das erschwert neuen Belägen das Anhaften. Empfohlen 1–2× pro Jahr; die Sitzung dauert etwa 60 Minuten und beugt Karies und Parodontitis nachweislich vor.',
      en: 'During a professional cleaning our prophylaxis team removes stubborn plaque, tartar and stains – including areas a toothbrush cannot reach. The teeth are then polished and fluoridated, which makes it harder for new plaque to stick. Recommended 1–2× per year; the session takes about 60 minutes and demonstrably prevents caries and periodontitis.',
      ar: 'خلال التنظيف الاحترافي يزيل فريق الوقاية لدينا الترسبات العنيدة والجير والتصبغات – حتى في الأماكن التي لا تصلها الفرشاة. ثم تُلمَّع الأسنان وتُفلوَر لتقليل التصاق الترسبات الجديدة. يُنصح به مرة إلى مرتين سنويًا؛ تستغرق الجلسة حوالي 60 دقيقة وتقي فعليًا من التسوس والتهاب اللثة.',
    },
    bilder: ['/bilder/leistungen/pzr-behandlung.webp', '/bilder/zahnhygieneraum.webp'],
  },
  {
    id: 'parodontologie', icon: 'shield',
    titel: { de: 'Parodontologie', en: 'Periodontology', ar: 'علاج اللثة' },
    text: {
      de: 'Behandlung von Zahnfleischerkrankungen – schonend und nachhaltig.',
      en: 'Treatment of gum disease – gentle and lasting.',
      ar: 'علاج أمراض اللثة بلطف وبنتائج دائمة.',
    },
    details: {
      de: 'Zahnfleischbluten, Rückgang des Zahnfleischs oder lockere Zähne sind Warnzeichen einer Parodontitis. Wir behandeln systematisch: gründliche Reinigung der Zahnfleischtaschen, Keimreduktion und ein individuelles Nachsorge-Programm. So bleiben Ihre Zähne fest – und Ihr Zahnfleisch gesund.',
      en: 'Bleeding or receding gums and loose teeth are warning signs of periodontitis. We treat systematically: thorough cleaning of the gum pockets, germ reduction and an individual aftercare programme. This keeps your teeth firm – and your gums healthy.',
      ar: 'نزيف اللثة أو انحسارها أو تخلخل الأسنان علامات تحذير من التهاب دواعم السن. نعالج بمنهجية: تنظيف عميق لجيوب اللثة، تقليل الجراثيم وبرنامج متابعة فردي. هكذا تبقى أسنانك ثابتة ولثتك سليمة.',
    },
    bilder: ['/bilder/behandlungsraum-1.webp'],
  },
  {
    id: 'prothetik', icon: 'tooth',
    titel: { de: 'Prothetik & Zahnersatz', en: 'Prosthetics & dentures', ar: 'التركيبات وتعويضات الأسنان' },
    text: {
      de: 'Kronen, Brücken und Prothesen – passgenau dank digitaler Abdrücke (3Shape Trios).',
      en: 'Crowns, bridges and dentures – precision-fit thanks to digital impressions (3Shape Trios).',
      ar: 'تيجان وجسور وأطقم أسنان بدقة عالية بفضل الطبعات الرقمية (3Shape Trios).',
    },
    details: {
      de: 'Ob Einzelkrone, Brücke oder Vollprothese: Mit dem digitalen 3Shape-Trios-Scanner nehmen wir den Abdruck ganz ohne Würge-Löffel – präziser und angenehmer. Die Zahnfarbe bestimmen wir exakt mit dem Farbring, damit sich der neue Zahn unsichtbar einfügt. Vor Beginn erhalten Sie einen transparenten Heil- und Kostenplan für Ihre Kasse bzw. Zusatzversicherung.',
      en: 'Whether a single crown, bridge or full denture: with the digital 3Shape Trios scanner we take impressions without the uncomfortable tray – more precise and more pleasant. We match the exact tooth shade with a shade guide so the new tooth blends in invisibly. Before we start you receive a transparent treatment and cost plan for your insurer.',
      ar: 'سواء تاج مفرد أو جسر أو طقم كامل: بماسح 3Shape Trios الرقمي نأخذ الطبعة دون ملعقة الطبع المزعجة – أدق وأكثر راحة. نحدد لون السن بدقة بواسطة دليل الألوان ليندمج السن الجديد بشكل غير مرئي. قبل البدء تحصل على خطة علاج وتكلفة شفافة لتأمينك.',
    },
    bilder: ['/bilder/leistungen/prothetik-modell.webp', '/bilder/leistungen/farbbestimmung.webp'],
  },
  {
    id: 'wurzel', icon: 'root',
    titel: { de: 'Wurzelkanalbehandlung', en: 'Root canal treatment', ar: 'علاج قناة الجذر' },
    text: {
      de: 'Zahnerhalt mit moderner Endodontie, damit der eigene Zahn bleibt.',
      en: 'Saving your natural tooth with modern endodontics.',
      ar: 'الحفاظ على السن الطبيعي بأحدث طرق علاج الجذور.',
    },
    details: {
      de: 'Ist der Zahnnerv entzündet, kann eine Wurzelkanalbehandlung den eigenen Zahn oft noch retten. Auf Basis digitaler Röntgenaufnahmen reinigen wir die feinen Kanäle, desinfizieren sie und verschließen sie dicht – unter lokaler Betäubung und in der Regel weitgehend schmerzfrei. Der Erhalt des eigenen Zahns ist fast immer die beste und günstigste Lösung.',
      en: 'If the dental nerve is inflamed, a root canal treatment can often still save your natural tooth. Guided by digital X-rays we clean the fine canals, disinfect them and seal them tightly – under local anaesthesia and usually largely pain-free. Keeping your own tooth is almost always the best and most economical solution.',
      ar: 'إذا التهب عصب السن، فغالبًا ما يمكن لعلاج قناة الجذر إنقاذ سنك الطبيعي. بالاستناد إلى صور الأشعة الرقمية ننظف القنوات الدقيقة ونعقمها ونغلقها بإحكام – تحت تخدير موضعي وغالبًا دون ألم يُذكر. الحفاظ على سنك الطبيعي هو دائمًا الحل الأفضل والأوفر.',
    },
    bilder: ['/bilder/leistungen/roentgen-panorama.webp'],
  },
  {
    id: 'implantate', icon: 'implant',
    titel: { de: 'Implantologie', en: 'Implantology', ar: 'زراعة الأسنان' },
    text: {
      de: 'Feste dritte Zähne mit Champions-Implantaten.',
      en: 'Fixed new teeth with Champions implants.',
      ar: 'أسنان ثابتة بديلة مع زرعات Champions.',
    },
    details: {
      de: 'Ein Implantat ersetzt die Zahnwurzel durch eine kleine Titanschraube, auf der eine Krone, Brücke oder Prothese fest verankert wird – es fühlt sich an wie ein eigener Zahn. Wir arbeiten mit dem bewährten Champions-System, oft minimalinvasiv ohne großen Schnitt. Nach Beratung, Röntgen und Heil- und Kostenplan erfolgt die Implantation ambulant; die Einheilzeit beträgt je nach Situation 6–12 Wochen.',
      en: 'An implant replaces the tooth root with a small titanium screw onto which a crown, bridge or denture is firmly anchored – it feels like your own tooth. We work with the proven Champions system, often minimally invasive without a large incision. After consultation, X-ray and cost plan, the implant is placed on an outpatient basis; healing takes 6–12 weeks depending on the situation.',
      ar: 'تستبدل الزرعة جذر السن ببرغي صغير من التيتانيوم يُثبَّت عليه تاج أو جسر أو طقم – وتشعر كأنها سنك الطبيعي. نعمل بنظام Champions الموثوق، وغالبًا بتدخل محدود دون شق كبير. بعد الاستشارة والأشعة وخطة التكلفة تُجرى الزراعة دون مبيت؛ ويستغرق الالتئام 6–12 أسبوعًا حسب الحالة.',
    },
    bilder: ['/bilder/leistungen/implantat-modell.webp'],
  },
  {
    id: 'aesthetik', icon: 'smile', vorherNachher: true,
    titel: { de: 'Ästhetische Zahnheilkunde', en: 'Aesthetic dentistry', ar: 'طب الأسنان التجميلي' },
    text: {
      de: 'Bleaching, Veneers und mehr für Ihr schönstes Lächeln.',
      en: 'Whitening, veneers and more for your best smile.',
      ar: 'تبييض وقشور تجميلية والمزيد من أجل أجمل ابتسامة.',
    },
    details: {
      de: 'Vom professionellen Bleaching bis zu hauchdünnen Keramik-Veneers: Wir verschönern Ihr Lächeln schonend und natürlich. Das Bild zeigt ein echtes Vorher/Nachher-Ergebnis mit Veneers – Verfärbungen, kleine Lücken und unregelmäßige Kanten verschwinden in wenigen Sitzungen. In der Beratung zeigen wir Ihnen, welches Ergebnis bei Ihnen realistisch ist.',
      en: 'From professional whitening to wafer-thin ceramic veneers: we enhance your smile gently and naturally. The picture shows a real before/after result with veneers – discolouration, small gaps and irregular edges disappear within a few sessions. During the consultation we show you which result is realistic for you.',
      ar: 'من التبييض الاحترافي إلى قشور السيراميك الرقيقة: نجمّل ابتسامتك بلطف وبمظهر طبيعي. تُظهر الصورة نتيجة حقيقية قبل/بعد بالقشور – تختفي التصبغات والفراغات الصغيرة والحواف غير المنتظمة خلال جلسات قليلة. في الاستشارة نوضح لك النتيجة الواقعية لحالتك.',
    },
    bilder: ['/bilder/leistungen/aesthetik-vorher-nachher.webp', '/bilder/leistungen/farbbestimmung.webp'],
  },
  {
    id: 'kinder', icon: 'child',
    titel: { de: 'Kinderbehandlung', en: 'Children’s dentistry', ar: 'علاج أسنان الأطفال' },
    text: {
      de: 'Einfühlsame Behandlung für unsere kleinen Patienten – mit Therapiehündin Martha.',
      en: 'Gentle care for our little patients – with therapy dog Martha.',
      ar: 'علاج لطيف لمرضانا الصغار – برفقة كلبة العلاج مارتا.',
    },
    details: {
      de: 'Beim ersten Besuch darf Ihr Kind alles in Ruhe kennenlernen: den Stuhl, die Instrumente – und natürlich Martha, unsere Therapiehündin, die kleinen Patienten die Aufregung nimmt. Wir arbeiten spielerisch, erklären kindgerecht und loben viel. Fissurenversiegelung und Fluoridierung schützen die neuen Zähne von Anfang an.',
      en: 'On the first visit your child can explore everything calmly: the chair, the instruments – and of course Martha, our therapy dog, who takes the nervousness away from little patients. We work playfully, explain in a child-friendly way and praise a lot. Fissure sealing and fluoridation protect the new teeth right from the start.',
      ar: 'في الزيارة الأولى يستكشف طفلك كل شيء بهدوء: الكرسي والأدوات – وطبعًا مارتا، كلبة العلاج التي تزيل التوتر عن الصغار. نعمل بأسلوب لعِب ونشرح بلغة الأطفال ونمدح كثيرًا. يحمي سد الشقوق والفلورة الأسنانَ الجديدة منذ البداية.',
    },
    bilder: ['/bilder/martha.webp', '/bilder/wartezimmer.webp'],
  },
  {
    id: 'schlaf', icon: 'moon',
    titel: { de: 'Zahnärztliche Schlafmedizin', en: 'Dental sleep medicine', ar: 'طب النوم السني' },
    text: {
      de: 'Schnarch- und Schlafapnoe-Schienen (Mitglied der DGZS).',
      en: 'Snoring and sleep apnoea splints (member of the DGZS).',
      ar: 'أجهزة ضد الشخير وانقطاع النفس أثناء النوم (عضو DGZS).',
    },
    details: {
      de: 'Lautes Schnarchen und Atemaussetzer rauben Ihnen und Ihrem Partner den Schlaf? Eine individuell angepasste Unterkiefer-Protrusionsschiene hält die Atemwege nachts offen – leise, ohne Maske und Strom. Als Mitglied der Deutschen Gesellschaft für zahnärztliche Schlafmedizin (DGZS) fertigen wir die Schiene nach digitalem Abdruck und stimmen die Behandlung bei Bedarf mit Ihrem Schlafmediziner ab.',
      en: 'Loud snoring and breathing pauses robbing you and your partner of sleep? A custom-fitted mandibular advancement splint keeps the airway open at night – quietly, without a mask or power supply. As a member of the German Society of Dental Sleep Medicine (DGZS) we produce the splint from a digital impression and coordinate with your sleep physician if needed.',
      ar: 'هل يحرمك الشخير المرتفع وانقطاعات التنفس أنت وشريكك من النوم؟ جهاز تقديم الفك السفلي المصمم خصيصًا يبقي مجرى التنفس مفتوحًا ليلًا – بهدوء، دون قناع أو كهرباء. بصفتنا عضوًا في الجمعية الألمانية لطب النوم السني (DGZS) نصنع الجهاز من طبعة رقمية وننسق العلاج مع طبيب النوم عند الحاجة.',
    },
    bilder: ['/bilder/behandlungsraum-2.webp'],
  },
  {
    id: 'hausbesuche', icon: 'home',
    titel: { de: 'Hausbesuche', en: 'Home visits', ar: 'زيارات منزلية' },
    text: {
      de: 'Wir kommen zu Ihnen, wenn Sie nicht zu uns kommen können.',
      en: 'We come to you if you cannot come to us.',
      ar: 'نأتي إليك إذا لم تستطع الحضور إلينا.',
    },
    details: {
      de: 'Für Patientinnen und Patienten, die durch Alter, Krankheit oder Pflegebedürftigkeit nicht in die Praxis kommen können, bieten wir Hausbesuche an – zu Hause oder im Pflegeheim. Kontrollen, Prothesen-Anpassungen und viele Behandlungen sind mit unserer mobilen Ausstattung direkt vor Ort möglich. Rufen Sie uns an, wir planen den Besuch gemeinsam mit Ihnen und Ihren Angehörigen.',
      en: 'For patients who cannot come to the practice due to age, illness or care needs, we offer home visits – at home or in a care facility. Check-ups, denture adjustments and many treatments are possible on site with our mobile equipment. Give us a call and we will plan the visit together with you and your family.',
      ar: 'للمرضى الذين لا يستطيعون الحضور إلى العيادة بسبب العمر أو المرض أو الحاجة للرعاية، نقدم زيارات منزلية – في المنزل أو في دار الرعاية. الفحوصات وتعديل الأطقم وكثير من العلاجات ممكنة في الموقع بمعداتنا المتنقلة. اتصل بنا وسنخطط للزيارة معك ومع ذويك.',
    },
    bilder: ['/bilder/aussenansicht.webp'],
  },
]

// Quellen der Fremdbilder (Wikimedia Commons, freie Lizenzen) – Anzeige im Dialog
export const BILD_QUELLE = {
  de: 'Beispielfotos: Praxis + Wikimedia Commons (freie Lizenzen, CC BY/CC BY-SA)',
  en: 'Sample photos: practice + Wikimedia Commons (free licences, CC BY/CC BY-SA)',
  ar: 'صور توضيحية: العيادة + ويكيميديا كومنز (تراخيص حرة)',
}

// Öffnungszeiten: je Wochentag (0=So … 6=Sa) Liste von [von, bis] in Stunden
export const OEFFNUNGSZEITEN = {
  1: [['08:00', '12:00'], ['13:00', '18:00']], // Mo
  2: [['08:00', '12:00'], ['13:00', '18:00']], // Di
  3: [['08:00', '17:00']],                     // Mi durchgehend
  4: [['08:00', '12:00'], ['14:00', '19:00']], // Do
  // Fr: nur telefonisch erreichbar, Sa/So geschlossen
}

export const OEFFNUNGSZEITEN_TEXT = [
  { tag: { de: 'Montag', en: 'Monday', ar: 'الاثنين' }, zeit: { de: '08:00 – 12:00 und 13:00 – 18:00', en: '08:00 – 12:00 and 13:00 – 18:00', ar: '08:00 – 12:00 و 13:00 – 18:00' } },
  { tag: { de: 'Dienstag', en: 'Tuesday', ar: 'الثلاثاء' }, zeit: { de: '08:00 – 12:00 und 13:00 – 18:00', en: '08:00 – 12:00 and 13:00 – 18:00', ar: '08:00 – 12:00 و 13:00 – 18:00' } },
  { tag: { de: 'Mittwoch', en: 'Wednesday', ar: 'الأربعاء' }, zeit: { de: '08:00 – 17:00 (durchgehend)', en: '08:00 – 17:00 (all day)', ar: '08:00 – 17:00 (متواصل)' } },
  { tag: { de: 'Donnerstag', en: 'Thursday', ar: 'الخميس' }, zeit: { de: '08:00 – 12:00 und 14:00 – 19:00', en: '08:00 – 12:00 and 14:00 – 19:00', ar: '08:00 – 12:00 و 14:00 – 19:00' } },
  { tag: { de: 'Freitag', en: 'Friday', ar: 'الجمعة' }, zeit: { de: 'nur telefonisch erreichbar', en: 'reachable by phone only', ar: 'متاحون هاتفيًا فقط' } },
  { tag: { de: 'Samstag / Sonntag', en: 'Saturday / Sunday', ar: 'السبت / الأحد' }, zeit: { de: 'geschlossen', en: 'closed', ar: 'مغلق' } },
]

// Anliegen für die Online-Buchung (Dauer in Minuten).
// WICHTIG: Gespeichert wird immer titel.de (kanonisch) – das Team arbeitet auf Deutsch.
export const ANLIEGEN = [
  { id: 'kontrolle', dauer: 30, icon: 'check',
    titel: { de: 'Kontrolluntersuchung', en: 'Check-up', ar: 'فحص دوري' },
    text: { de: 'Regelmäßige Vorsorge & Check-up', en: 'Regular preventive check-up', ar: 'فحص وقائي منتظم' } },
  { id: 'pzr', dauer: 60, icon: 'sparkle',
    titel: { de: 'Professionelle Zahnreinigung (PZR)', en: 'Professional dental cleaning (PZR)', ar: 'تنظيف احترافي للأسنان (PZR)' },
    text: { de: 'Gründliche Reinigung durch unser Prophylaxe-Team', en: 'Thorough cleaning by our prophylaxis team', ar: 'تنظيف شامل من فريق الوقاية لدينا' } },
  { id: 'kind', dauer: 30, icon: 'child',
    titel: { de: 'Termin für mein Kind', en: 'Appointment for my child', ar: 'موعد لطفلي' },
    text: { de: 'Kindgerechte Behandlung – gerne mit Martha', en: 'Child-friendly treatment – with Martha if you like', ar: 'علاج مناسب للأطفال – برفقة مارتا إن رغبتم' } },
  { id: 'beratung-implantat', dauer: 30, icon: 'implant',
    titel: { de: 'Implantat-Beratung', en: 'Implant consultation', ar: 'استشارة زراعة الأسنان' },
    text: { de: 'Feste dritte Zähne – Champions-Implantate', en: 'Fixed new teeth – Champions implants', ar: 'أسنان ثابتة بديلة – زرعات Champions' } },
  { id: 'beratung-zahnersatz', dauer: 30, icon: 'tooth',
    titel: { de: 'Zahnersatz & Prothetik', en: 'Dentures & prosthetics', ar: 'تعويضات وتركيبات الأسنان' },
    text: { de: 'Kronen, Brücken, Prothesen – Beratung & Planung', en: 'Crowns, bridges, dentures – consultation & planning', ar: 'تيجان وجسور وأطقم – استشارة وتخطيط' } },
  { id: 'wurzel', dauer: 60, icon: 'root',
    titel: { de: 'Wurzelbehandlung', en: 'Root canal treatment', ar: 'علاج قناة الجذر' },
    text: { de: 'Zahnerhalt mit moderner Endodontie', en: 'Saving your tooth with modern endodontics', ar: 'الحفاظ على السن بأحدث طرق علاج الجذور' } },
  { id: 'aesthetik', dauer: 30, icon: 'smile',
    titel: { de: 'Bleaching & Ästhetik', en: 'Whitening & aesthetics', ar: 'تبييض وتجميل الأسنان' },
    text: { de: 'Aufhellung, Veneers, Verschönerung', en: 'Whitening, veneers, smile makeover', ar: 'تبييض وقشور وتحسين الابتسامة' } },
  { id: 'schlaf', dauer: 30, icon: 'moon',
    titel: { de: 'Schnarch- / Schlafschiene', en: 'Snoring / sleep splint', ar: 'جهاز ضد الشخير' },
    text: { de: 'Zahnärztliche Schlafmedizin (DGZS)', en: 'Dental sleep medicine (DGZS)', ar: 'طب النوم السني (DGZS)' } },
  { id: 'schmerzen', dauer: 0, icon: 'alert', nurTelefon: true,
    titel: { de: 'Ich habe Schmerzen', en: 'I am in pain', ar: 'أشعر بألم' },
    text: { de: 'Bitte rufen Sie uns direkt an – wir helfen schnell', en: 'Please call us directly – we will help you quickly', ar: 'يرجى الاتصال بنا مباشرة – سنساعدك بسرعة' } },
  { id: 'eigen', dauer: 30, icon: 'chat', freitext: true,
    titel: { de: 'Anderes Anliegen', en: 'Something else', ar: 'طلب آخر' },
    text: { de: 'Beschreiben Sie Ihr Anliegen einfach selbst', en: 'Simply describe your concern yourself', ar: 'صف طلبك بنفسك ببساطة' } },
]

// Echte Fotos der Praxis (von der bisherigen Webseite übernommen, web-optimiert in /bilder/)
export const BILDER = {
  aussen: '/bilder/aussenansicht.webp',
  eingang: '/bilder/eingang.webp',
  empfang: '/bilder/empfang.webp',
  wartezimmer: '/bilder/wartezimmer.webp',
  martha: '/bilder/martha.webp',
}

export const RUNDGANG = [
  '/bilder/empfang.webp',
  '/bilder/wartezimmer.webp',
  '/bilder/behandlungsraum-1.webp',
  '/bilder/behandlungsraum-2.webp',
  '/bilder/behandlungsraum-3.webp',
  '/bilder/zahnhygieneraum.webp',
  '/bilder/roentgen-1.webp',
  '/bilder/eingang.webp',
]

export const FAQ = [
  {
    frage: { de: 'Wie bekomme ich am schnellsten einen Termin?', en: 'What is the fastest way to get an appointment?', ar: 'ما أسرع طريقة للحصول على موعد؟' },
    antwort: {
      de: 'Am einfachsten über die Online-Buchung – Anliegen wählen, freie Zeit antippen, fertig. Bei akuten Schmerzen rufen Sie uns bitte direkt an, dann finden wir noch am selben Tag eine Lösung.',
      en: 'The easiest way is online booking – choose your concern, tap a free slot, done. For acute pain please call us directly and we will find a solution the same day.',
      ar: 'أسهل طريقة هي الحجز عبر الإنترنت – اختر طلبك واضغط على موعد متاح وانتهيت. عند الألم الحاد يرجى الاتصال بنا مباشرة وسنجد حلًا في اليوم نفسه.',
    },
  },
  {
    frage: { de: 'Was muss ich zum ersten Termin mitbringen?', en: 'What should I bring to my first appointment?', ar: 'ماذا أحضر معي إلى الموعد الأول؟' },
    antwort: {
      de: 'Ihre elektronische Gesundheitskarte, falls vorhanden Ihr Bonusheft, eine Liste Ihrer Medikamente und – wenn vorhanden – aktuelle Röntgenbilder vom Vorbehandler.',
      en: 'Your electronic health card, your dental bonus booklet if you have one, a list of your medications and – if available – recent X-rays from your previous dentist.',
      ar: 'بطاقة التأمين الصحي الإلكترونية، ودفتر المكافآت إن وجد، وقائمة بأدويتك، وصور الأشعة الحديثة من طبيبك السابق إن توفرت.',
    },
  },
  {
    frage: { de: 'Sprechen Sie meine Sprache?', en: 'Do you speak my language?', ar: 'هل تتحدثون لغتي؟' },
    antwort: {
      de: 'Sehr wahrscheinlich ja: Wir beraten Sie auf Deutsch, Englisch, Arabisch, Türkisch und Urdu.',
      en: 'Very likely yes: we can advise you in German, English, Arabic, Turkish and Urdu.',
      ar: 'على الأرجح نعم: نقدم الاستشارة بالألمانية والإنجليزية والعربية والتركية والأردية.',
    },
  },
  {
    frage: { de: 'Wer ist Martha?', en: 'Who is Martha?', ar: 'من هي مارتا؟' },
    antwort: {
      de: 'Martha ist unsere Therapiehündin. Sie nimmt vor allem ängstlichen und kleinen Patienten die Aufregung – auf Wunsch begleitet sie Ihren Termin, auf Wunsch bleibt sie natürlich auch draußen.',
      en: 'Martha is our therapy dog. She calms anxious and young patients – on request she accompanies your appointment, and of course she can also stay outside.',
      ar: 'مارتا هي كلبة العلاج لدينا. تهدّئ المرضى القلقين والصغار – ترافق موعدك إن رغبت، وتبقى خارجًا إن فضّلت ذلك.',
    },
  },
  {
    frage: { de: 'Was passiert, wenn ich einen Termin absagen muss?', en: 'What if I need to cancel an appointment?', ar: 'ماذا لو اضطررت لإلغاء موعد؟' },
    antwort: {
      de: 'Bitte sagen Sie so früh wie möglich telefonisch ab, damit wir den Platz weitergeben können. Bei professionellen Zahnreinigungen fällt bei Absagen unter 24 Stunden eine Gebühr von 50 € an.',
      en: 'Please cancel by phone as early as possible so we can pass the slot on. For professional cleanings, cancellations under 24 hours incur a €50 fee.',
      ar: 'يرجى الإلغاء هاتفيًا في أقرب وقت ممكن حتى نتمكن من إعطاء الموعد لغيرك. في جلسات التنظيف الاحترافي تُفرض رسوم 50 يورو عند الإلغاء قبل أقل من 24 ساعة.',
    },
  },
  {
    frage: { de: 'Gibt es Parkplätze?', en: 'Is there parking?', ar: 'هل تتوفر مواقف سيارات؟' },
    antwort: {
      de: 'Direkt an der Praxis gibt es keine reservierten Parkplätze, aber in der Schöpplerstraße und den Nebenstraßen finden Sie Straßenparkplätze.',
      en: 'There is no reserved parking at the practice, but you will find street parking on Schöpplerstraße and the side streets.',
      ar: 'لا توجد مواقف محجوزة عند العيادة، لكن تتوفر مواقف على شارع Schöpplerstraße والشوارع الجانبية.',
    },
  },
  {
    frage: { de: 'Machen Sie auch Hausbesuche?', en: 'Do you make home visits?', ar: 'هل تقومون بزيارات منزلية؟' },
    antwort: {
      de: 'Ja. Wenn Sie nicht zu uns kommen können, kommen wir zu Ihnen – sprechen Sie uns einfach telefonisch an.',
      en: 'Yes. If you cannot come to us, we come to you – just give us a call.',
      ar: 'نعم. إذا لم تستطع الحضور إلينا نأتي نحن إليك – فقط اتصل بنا هاتفيًا.',
    },
  },
]

export const KARRIERE = {
  titel: { de: 'Karriere bei uns', en: 'Careers with us', ar: 'الوظائف لدينا' },
  text: {
    de: 'Wir wachsen und suchen Verstärkung für unser Team – ZFA / Zahnmedizinische Fachangestellte (m/w/d) in Voll- oder Teilzeit sowie Auszubildende. Freuen Sie sich auf ein familiäres Team, moderne Ausstattung (3Shape Trios, digitales Röntgen) und geregelte Arbeitszeiten.',
    en: 'We are growing and looking for reinforcement – dental assistants (m/f/d) full- or part-time as well as trainees. Look forward to a family-like team, modern equipment (3Shape Trios, digital X-ray) and regular working hours.',
    ar: 'نحن ننمو ونبحث عن تعزيز لفريقنا – مساعدو/مساعدات طب أسنان بدوام كامل أو جزئي بالإضافة إلى متدربين. ينتظركم فريق عائلي وتجهيزات حديثة (3Shape Trios وأشعة رقمية) وساعات عمل منتظمة.',
  },
  hinweis: {
    de: 'Bewerbung ganz unkompliziert per E-Mail – ein kurzer Lebenslauf reicht für den Anfang.',
    en: 'Apply simply by e-mail – a short CV is enough to start with.',
    ar: 'قدّم طلبك ببساطة عبر البريد الإلكتروني – سيرة ذاتية قصيرة تكفي للبداية.',
  },
}

export const BEHANDLUNGS_CHECKS = [
  'Kontrolle / 01',
  'Professionelle Zahnreinigung',
  'Füllung',
  'Wurzelbehandlung',
  'Röntgen',
  'Anästhesie',
  'Beratung',
  'Abdruck / Scan',
  'Zahnstein entfernt',
  'PA-Behandlung',
]
