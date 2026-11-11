# SchichtKompass

Browser-local pilot for importing the user's own shifts from a hospital POLYPOINT PDF. No roster is uploaded to the app's server. The repository contains only the 76 cropped symbol variants from the provided sample, with no employee names, balances or duty sequences.

The main flow asks for a full name and a PDF. It locates the date grid and the person's row across pages, then reads the exact embedded image objects from the PDF. For screenshot/image input, row selection is manual. Unknown symbols require an explicit definition; no clinical institution's shift hours are guessed. A separate gallery allows preparing every symbol in advance and sharing a legend JSON file.

Definitions, tiny symbol templates and no full roster are optionally stored in localStorage. Profile import is schema-checked. Calendar export contains only reviewed personal entries. iCalendar export handles Europe/Zurich, overnight shifts, all-day dates and UTF-8 folding. It is a snapshot, not a subscription, and repeated imports may duplicate events depending on the calendar client. Google Calendar's regular ICS importer is desktop-based. The optional direct Google Calendar integration is prepared in version 0.8 and requires the operator’s own OAuth client configuration before use.

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

## Direkte Google-Übertragung (0.8, Freischaltung ausstehend)

Die vorbereitete Erweiterung schreibt geprüfte Dienste direkt in einen eigenen Google-Kalender, auch aus einem mobilen Browser. Ein erneuter Upload aktualisiert denselben Monat und entfernt inzwischen freie Tage. Die Konfiguration, Grenzen und erforderlichen echten Konto-Tests stehen in [GOOGLE_SETUP.md](GOOGLE_SETUP.md). Solange `dist/google-config.js` keine gültige eigene Client-ID enthält, bleibt die direkte Übertragung gesperrt; es gibt keine vorgetäuschte erfolgreiche Google-Verbindung.

Die Anmeldung nutzt Google Identity Services. Tokens bleiben im Arbeitsspeicher. Die App liest Kalender-Metadaten zur Wiedererkennung und bearbeitet nur von ihr erstellte Kalender. Keine Originalpläne werden an Google oder den SchichtKompass-Server gesendet. Die eigenständige Datenschutzseite liegt in `dist/privacy.html`.
