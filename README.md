# SchichtKompass

Browser-local pilot for importing the user's own shifts from a hospital POLYPOINT PDF. No roster is uploaded to the app's server. The repository contains only the 76 cropped symbol variants from the provided sample, with no employee names, balances or duty sequences.

The main flow asks for a full name and a PDF. It locates the date grid and the person's row across pages, then reads the exact embedded image objects from the PDF. For screenshot/image input, row selection is manual. Unknown symbols require an explicit definition; no clinical institution's shift hours are guessed. A separate gallery allows preparing every symbol in advance and sharing a legend JSON file.

Definitions, tiny symbol templates and no full roster are optionally stored in localStorage. Profile import is schema-checked. Calendar export contains only reviewed personal entries. iCalendar export handles Europe/Zurich, overnight shifts, all-day dates and UTF-8 folding. It is a snapshot, not a subscription, and repeated imports may duplicate events depending on the calendar client. Google Calendar's regular ICS importer is desktop-based. Native mobile/calendar API integration is outside this pilot.

Run `npm test` for calendar and recognition logic checks. The static files in `dist` are deployed directly. Browser QA used the fictional demo and the supplied PDF locally. The original PDF is deliberately outside the repository. Shift definitions must be confirmed by the user before real use. The app is not an official hospital service.

Blank fields are automatically skipped. Confirmed C image variants share one service definition (Spätdienst 14:00–23:00, supplied in the user screenshot). Existing local registrations are reused across those variants. The legend starts with only undefined duties visible. Other pictograms keep separate identities until their equivalence is confirmed.

Version 0.3 reads printed duty-code contours locally, normalizes code spelling and groups by that code. The regression fixtures contain only cropped numeric character features from the reported phone screenshot. `npm run build` embeds the reference registry in a single content-hashed browser bundle and updates the HTML entry point; rebuild after source changes to avoid stale/mixed JavaScript and JSON assets. PDF.js remains a separate same-origin dependency.

Version 0.4 distinguishes a red fill from a red border. Registrations are scoped by printed code plus department/context. Red-filled external shifts require a separate initial registration; old code-only profiles cannot silently authorize one. Supplementary text is assigned from the line below each selected icon row, using character centres to handle the PDF baseline overlap. StU expands to Stroke Unit; unconfirmed abbreviations such as ZusA remain verbatim. Calendar titles, locations and descriptions include the assigned unit and the matching daily notes. Profile format 2 retains context and imports legacy format 1 for own-unit duties.


## GitHub Pages

Enable **Settings → Pages → Source: GitHub Actions**. The workflow runs the checks and build before publishing `dist/`. All application assets use relative URLs so deployment works under `/schichtkompass/` as well as a root domain. No private roster, employee names, hosting credentials or original PDF are included. The deployed GitHub Pages website is public; imported rosters continue to be processed locally in the browser.

Version 0.5 protects blank cells from previously mislabelled legends and reads ZusA/DIV/MN supplement contours locally. Supplementary duties use separate registrations. TimeTree export provides device-calendar import instructions because the official TimeTree third-party API has been discontinued. There is no direct TimeTree account integration or hosted calendar subscription.

## Veröffentlichung Schritt für Schritt

1. Ein öffentliches GitHub-Repository `schichtkompass` erstellen und mit einer README-Datei initialisieren.
2. Die entpackten Dateien dieses Pakets inklusive `.github/workflows/pages.yml` in das Repository übernehmen. Den Ordner `node_modules` nicht hochladen.
3. In GitHub unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** wählen.
4. Unter **Actions → Publish SchichtKompass → Run workflow** die Veröffentlichung starten.
5. Nach erfolgreichem Lauf steht die bestätigte Website-Adresse unter **Settings → Pages**.

Die PDF-Bibliothek wird beim Build aus der festgelegten npm-Version nach `dist/vendor` kopiert. Die kleinen Symbolbilder sind in der Referenzdatei eingebettet. Es sind keine vollständigen Dienstpläne enthalten. GitHub Pages veröffentlicht eine statische Website ohne ChatGPT-Anmeldung; die bestehende private Sites-Version bleibt davon unabhängig.


## Kalender-Abo (0.6)

Die GitHub-Seite verwendet optional den separaten Kalenderdienst unter https://schichtkompass-calendar.andi201andi201.chatgpt.site. Erst nach Zustimmung werden bestätigte ICS-Monatsdaten übertragen. Die Originaldatei und der eingegebene Name bleiben lokal. Zufällige 256-Bit-Schlüssel trennen Abruf und Verwaltung; serverseitig werden Schlüssel nur gehasht gespeichert. Der Browser speichert die Schlüssel vor dem ersten Schreibversuch. Ein Monat ersetzt denselben Monat. Widerruf löscht Kalender und Monatsdaten; lokal bereits importierte Kopien werden nicht entfernt. Ohne gesicherte Schlüssel ist nach Browserdatenlöschung keine Verwaltung möglich.

Der Dienst ist separat über Sites bereitgestellt und wird nicht durch den Pages-Workflow aktualisiert. Die Service-Quellen liegen in `calendar-service/` (ohne Deployment-Identität).

## Kalenderwahl und Google-Abo (0.7)

Am Anfang wählt die Person Apple oder Google; iPhone/iPad und Android liefern nur eine änderbare Vorauswahl. Auf unbekannten Geräten wird gefragt. Die Auswahl wird lokal gemerkt. TimeTree und weitere Optionen bleiben erreichbar, sind aber eingeklappt.

Google verwendet denselben widerrufbaren ICS-Feed wie Apple. Der Google-Link öffnet den Hinzufügen-Dialog im Desktop-Browser; ein bebilderungsfreier Kurzablauf mit «Per URL»-Fallback ist eingebaut. Google unterstützt das erstmalige Hinzufügen eines externen Abos nicht in seinen Handy-Apps. «Einrichtungslink teilen» übergibt ausschliesslich den Lese-Link im Fragment einer eigenen Einrichtungsseite; kein Verwaltungsschlüssel wird weitergegeben. Google bestimmt das Abrufintervall. Es gibt keine OAuth-Schreibintegration und keine sofortige Synchronisationszusage.

Verifiziert: Browserablauf für Kalenderwahl/Wechsel und Einrichtungsseite sowie automatisierte Tests. Eine tatsächliche Anmeldung und Abo-Bestätigung in einem Google-Konto erfolgt durch die jeweilige Person.

## ZGKS-Legende (0.9)

«Ich arbeite im Zuger Kantonsspital» ist beim ersten Öffnen vorausgewählt. Die Spitalauswahl wird lokal gemerkt. Die offiziellen PEP-Zeiten werden ohne zusätzliche Bestätigung angewendet. Die App enthält 54 zugeschnittene Symbolvorlagen aus den bereitgestellten Dokumenten, ohne die vollständigen PDFs oder ihre Autorenmetadaten zu veröffentlichen. Die vollständige Legende ist in der App lesbar.

Die Präsenz-Definitionen sind im Quelldokument mit **Chirurgie Nord ab 1. Januar 2027** beschriftet. Der Betreiber hat bestätigt, dass es sich um die neuen offiziellen PEP-Zeiten des ZGKS handelt. Seit 0.9.1 werden diese Uhrzeiten ab diesem Plandatum ohne zusätzliche Abteilungsbestätigung angewendet. Für ältere Pläne und eigene Anpassungen bleibt eine eigene Zuordnung möglich. Die Absenz-Definitionen des Pflege Pools gelten laut Dokument bereits **ab 1. Oktober 2026**, auch wenn der Dateiname 2027 nennt. Absenzen ohne Beginn/Ende werden ganztägig exportiert. Frei, Wunschfrei, Kompensation und leere Platzhalter erzeugen keine Termine. Soll-/Gutschriftstunden werden nicht als Uhrzeiten ausgelegt.

Gleiche Buchstaben in verschiedenen Farben, Unterstreichungen und Dienstvarianten werden über die individuelle PEP-Kennung getrennt. Abteilungs-/Zusatzkombinationen benötigen weiterhin eine eigene erste Zuordnung. Eigene Anpassungen sind an Symbol, Kontext und Gültigkeitszeitraum gebunden; eine alte codebasierte E-Zuordnung kann die drei neuen E-Dienste nicht überschreiben. Bestätigte Standarddienste überspringen die Legendeneingabe und führen zur Monatskontrolle.

Die Quelldaten können mit `python scripts/build-zgks-legend.py <presence.pdf> <absence.pdf>` neu erzeugt werden (PyMuPDF/Pillow erforderlich). Der normale npm-Build benötigt die PDFs nicht. Automatisierte Tests prüfen alle 54 Symbole, Zeiträume, Farben und Exportregeln. Browser-QA nutzt einen fiktiven Januarplan 2027 mit den zugeschnittenen Symbolen; es werden keine echten Personaldaten verwendet.

## Datenfluss

PDFs und Bilder werden über File/ArrayBuffer, PDF.js und Canvas lokal verarbeitet. Es gibt keinen KI-/OCR-Serveraufruf. Der PDF-Code und die Symbolvorlagen werden von derselben Website geladen. Nur nach aktiver Zustimmung zum Kalender-Abo wird die erzeugte ICS-Datei der ausgewählten persönlichen Dienste an den separaten Kalenderdienst gesendet. Ein normaler Datei-Download bleibt lokal; die anschliessende Übernahme in einen Cloud-Kalender erfolgt beim gewählten Anbieter. Hosting-Verbindungsdaten sowie lokale Speicherungen und Abo-Schlüssel sind in den Datenschutzhinweisen beschrieben. Dies ersetzt keine betriebliche Freigabe.

## Eigene Domain (12.11.2026)

Öffentliche Hauptadresse: **https://schichtkompass.bb-planer.ch/**.
Die Subdomain ist bei Infomaniak per CNAME und zwei TXT-Bestätigungen verbunden;
HTTPS ist aktiv. Die bisherigen Einträge der Hauptdomain wurden nicht geändert.

Das Frontend wird als eigener statischer Sites-Build bereitgestellt:
`appgprj_6af4fb741ed081918d5cc861ea675c95`.
Die GitHub-Pages-Adresse bleibt separat verfügbar. Bei App-Änderungen beide
Veröffentlichungen aktualisieren: GitHub Actions aktualisiert nur GitHub Pages.
Für die eigene Domain die aktuelle Site-Quelle über den Sites-Quellhelfer öffnen,
die App-Quellen dieses Repositorys übernehmen, die vorhandene Projekt-ID in
`.openai/hosting.json` erhalten, `npm run check`, `npm test` und `npm run build`
ausführen und das statische `dist/`-Artefakt speichern und veröffentlichen.
Keinen Worker-Proxy auf GitHub Pages verwenden; die Domain liefert eigene Assets.

Der Kalenderdienst bleibt ein separates Projekt:
`appgprj_6ae923b7cedc81918b864a5eca3b8548`.
Seine CORS-Liste erlaubt die GitHub-Origin, die neue Domain und die Sites-Adresse
exakt; unbekannte Origins erhalten keine Freigabe. Freigabelinks verwenden die
aktuell geöffnete App-Adresse. Die geheimen Abo-Links bleiben unverändert.

Browserdaten sind an die jeweilige Website-Adresse gebunden. Vor einem Wechsel
können Nutzer ihre eigene Legende und Abo-Verwaltungsschlüssel an der bisherigen
Adresse sichern und an der neuen Adresse wiederherstellen. Die Schlüsseldatei
ist vertraulich und gehört niemals ins Repository oder in öffentliche Links.

## Erkennung und vollständige Zuordnung (0.9.2)

Die offizielle Legende wird auch für erkennbare ältere Buchstabenvarianten
verwendet. Bereits als Spätdienst definiertes C, Büro-Kürzel Bü, PIL-Varianten
und die bekannten Halbmond-Symbole werden mit ihren passenden offiziellen
Definitionen verbunden. Mehrdeutige E-/S-/M-Varianten bleiben farbabhängig.
Die Bildprüfung toleriert weisse Zellränder und unterschiedliche PDF-Rasterung;
108 separat aus den Legenden-PDFs gerasterte Symbolausschnitte decken alle
54 offiziellen Symbole ab. Gemischte Farben/Unterstreichungen werden abgelehnt.

Erkannte Abteilungen (StU, MN, MS) und Zusätze (ZusA, DIV) verlangen keine erneute
Eingabe des Dienstnamens oder der Zeiten. Bei einer unbekannten roten Abteilung
fehlt nur die Abteilung. Für nicht eindeutig lesbare Symbole füllt die Auswahl
aus der offiziellen Legende Name, Kalenderart und Zeiten gemeinsam aus. Solche
Zuordnungen können wie eigene Legenden lokal gemerkt werden, auch für freie Tage.

Die Dokumentgültigkeit bleibt erhalten: Präsenzzeiten ab Januar 2027, Absenzen
ab Oktober 2026. Bei älteren Plänen bleiben bestehende eigene Zuordnungen
verwendbar. Eine explizite gemeinsame Übernahme der offiziellen Angaben für
diesen konkreten Monat ersetzt die frühere manuelle Eingabe pro Dienst.
Unbekannte Symbole werden dabei nicht geraten. Die ursprünglichen PDFs und
vollständige Dienstpläne bleiben ausserhalb des veröffentlichten Quellcodes.

## POLYPOINT variants, Stroke and multiple services (0.9.3)

Additional isolated 24px symbol variants support the newer PDF export font,
background colours and scaled images. Only deduplicated glyph data is included,
sorted independently of source order; no names, plan dates or duty sequence are
stored. Stroke codes FS, SS and NS are distinct from the ordinary codes, with
Stroke Unit assigned automatically. The operator confirmed the same times as
Frühdienst, Spätdienst and Nachtdienst respectively. StUn is an alias of StU.
Text notes and coloured DIV/ZusA stripes are combined rather than suppressing
one another.

Up to four side-by-side service images per day are retained, with separate
calendar identities and independent selection. Nonstandard multiple-service
entries require their own times; a full shift's template is not silently copied
to each part. Their saved definitions are scoped to the concrete date and part.
The subscription service accepts up to 124 monthly events within its existing
size and authentication limits. No database migration is required.
