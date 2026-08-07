"""
Test-Paket für die Gabara-Baustellenverwaltung erzeugen.

Legt unter seed/gabara_test_assets/ echte Beispieldaten an und packt sie in
gabara_test_suite.zip im Projekt-Stammverzeichnis:

  lv_test_wandarbeiten.csv        gültiges LV (Semikolon, Umlaute, m²)  -> TS-01
  lv_test_defekt.csv              fehlerhaftes LV für die Parser-Prüfung -> TS-01
  foto_1..3.jpg                   hochauflösende Fotos für den Upload    -> TS-02
  test_daten_monteur_bericht.json Ist-Mengen und Spesen eines Tages      -> TS-03/04
  test_daten_fastbill_payload.json Proxy-Payload inkl. Secret            -> TS-04
  README_TESTSUITE.txt            Kurzübersicht

Aufruf:  python seed/generate_test_zip.py
"""

import json
import os
import urllib.request
import zipfile

# Immer relativ zum Projekt-Stammverzeichnis arbeiten, egal von wo aufgerufen
BASIS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_ZIP = os.path.join(BASIS, "gabara_test_suite.zip")
TEMP_DIR = os.path.join(BASIS, "seed", "gabara_test_assets")

# Achtung: Die CSV nutzt PUNKT als Dezimaltrenner ("120.50"). Der Parser der
# Verwaltung erwartet primär deutsches Format ("120,50") und muss beides können –
# genau das prüft TS-01.
CSV_VALID = """Position;Bezeichnung;Menge;Einheit;Einzelpreis;Gesamtpreis
01.01;Untergrundvorbereitung Wandflächen (Abschlagen von Altputz);120.50;m2;18.50;2229.25
01.02;Grundierung tiefenwirksam auftragen;120.50;m2;4.20;506.10
01.03;Kalk-Zement-Putz Leicht GP12 feuchtigkeitsregulierend 15mm;120.50;m2;28.00;3374.00
02.01;Trockenbau-Vorsatzschale CW 75/100 einfach beplankt;45.00;m2;42.50;1912.50
02.02;Spachteln Q3 mit Armierungsstreifen & Schleifen;45.00;m2;14.80;666.00
03.01;Silikat-Innenfarbe weiß zweifach deckend streichen;165.50;m2;9.50;1572.25
04.01;Regie-Stunde Meister / Fachmonteur Wandsanierung;10.00;Std;68.00;680.00
"""

# Defekt: andere Spaltennamen, Menge als Wort, Preisspalte fehlt komplett
CSV_INVALID = """Pos;Titel;Anzahl
1.1;Putz;Zwei
1.2;Malerarbeiten;ERR_PRICE
"""

JSON_BERICHT = {
    "berichtId": "TB-2026-0801-01",
    "projektId": "PRJ-GABARA-001",
    "monteurId": "usr_monteur_mario_123",
    "datum": "2026-08-01",
    "arbeitsstunden": 8.5,
    "arbeiten": "Wandflächen im EG vorbereitet, Altputz im Flur abgeschlagen, Schutt entsorgt.",
    "erfassteMengen": [
        {"position": "01.01", "istMenge": 80.0, "einheit": "m2"},
        {"position": "01.02", "istMenge": 80.0, "einheit": "m2"},
    ],
    "spesen": [
        {"kategorie": "Parkgebühr", "betrag": 12.50, "belegVorhanden": True},
    ],
    "status": "abgeschlossen",
    "syncedAt": "2026-08-01T16:30:00Z",
}

JSON_FASTBILL = {
    "authToken": "GABARA_SECURE_AUTH_TOKEN_2026_XYZ",
    "action": "invoice.create",
    "data": {
        "customer_id": "cust_99812",
        "items": [
            {
                "description": "01.01 Untergrundvorbereitung Wandflächen",
                "quantity": 80.0,
                "unit_price": 18.50,
                "vat_percent": 19,
            },
            {
                "description": "01.02 Grundierung tiefenwirksam auftragen",
                "quantity": 80.0,
                "unit_price": 4.20,
                "vat_percent": 19,
            },
        ],
    },
}

# Unsplash (CC0) – hochauflösend, damit die Client-Komprimierung etwas zu tun hat
IMAGE_URLS = {
    "foto_1_wand_riss_vorher.jpg":
        "https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=2000&auto=format&fit=crop",
    "foto_2_putz_q3_nachher.jpg":
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2000&auto=format&fit=crop",
    "foto_3_lieferschein_dokument.jpg":
        "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2000&auto=format&fit=crop",
}

README = """# Gabara Baustellen – Test-Assets

1. lv_test_wandarbeiten.csv          gültiges LV (Semikolon, Umlaute, m²)     TS-01
2. lv_test_defekt.csv                fehlerhaftes LV, prüft die Fehlermeldung TS-01
3. foto_1_wand_riss_vorher.jpg       Vorher-Foto, hochauflösend               TS-02
4. foto_2_putz_q3_nachher.jpg        Nachher-Foto, hochauflösend              TS-02
5. foto_3_lieferschein_dokument.jpg  Beleg-Foto                               TS-02
6. test_daten_monteur_bericht.json   Ist-Mengen und Spesen eines Tages        TS-03/04
7. test_daten_fastbill_payload.json  Proxy-Payload inkl. Secret               TS-04
"""


def create_test_package():
    print("Erstelle Test-Paket fuer Gabara Baustellen ...")
    os.makedirs(TEMP_DIR, exist_ok=True)

    print("  LV-Testdateien (CSV)")
    # utf-8-sig: Excel erkennt die Umlaute sonst nicht – und genau so kommen
    # die Dateien beim Auftraggeber aus dem Ausschreibungsprogramm
    with open(os.path.join(TEMP_DIR, "lv_test_wandarbeiten.csv"), "w", encoding="utf-8-sig") as f:
        f.write(CSV_VALID)
    with open(os.path.join(TEMP_DIR, "lv_test_defekt.csv"), "w", encoding="utf-8-sig") as f:
        f.write(CSV_INVALID)

    print("  JSON-Testdaten")
    with open(os.path.join(TEMP_DIR, "test_daten_monteur_bericht.json"), "w", encoding="utf-8") as f:
        json.dump(JSON_BERICHT, f, indent=2, ensure_ascii=False)
    with open(os.path.join(TEMP_DIR, "test_daten_fastbill_payload.json"), "w", encoding="utf-8") as f:
        json.dump(JSON_FASTBILL, f, indent=2, ensure_ascii=False)

    print("  Testfotos")
    for filename, url in IMAGE_URLS.items():
        filepath = os.path.join(TEMP_DIR, filename)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as antwort, open(filepath, "wb") as ziel:
                ziel.write(antwort.read())
            print(f"    OK  {filename} ({os.path.getsize(filepath) // 1024} KB)")
        except Exception as e:
            # Ohne Netz weiterarbeiten können: gültiges 1x1-JPEG als Platzhalter.
            # Ein Rumpf-Header wie im Ursprungsskript wäre KEIN lesbares Bild –
            # der Upload würde daran scheitern und der Test wäre wertlos.
            print(f"    WARNUNG  {filename} nicht ladbar ({e}) -> Platzhalter")
            with open(filepath, "wb") as f:
                f.write(_platzhalter_jpeg())

    with open(os.path.join(TEMP_DIR, "README_TESTSUITE.txt"), "w", encoding="utf-8") as f:
        f.write(README)

    print(f"  Packe {os.path.basename(OUTPUT_ZIP)}")
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
        for wurzel, _, dateien in os.walk(TEMP_DIR):
            for datei in dateien:
                voll = os.path.join(wurzel, datei)
                zipf.write(voll, os.path.relpath(voll, TEMP_DIR))

    print(f"\nFertig: {OUTPUT_ZIP}")


def _platzhalter_jpeg():
    """Kleinstmögliches, aber GÜLTIGES JPEG (1x1 grau) als Base64."""
    import base64
    return base64.b64decode(
        "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
        "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA"
        "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
    )


if __name__ == "__main__":
    create_test_package()
