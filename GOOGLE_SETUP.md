# Direkte Google-Kalender-Übertragung freischalten

Die Implementierung ist vorbereitet. **Ohne eigene OAuth-Web-Client-ID ist sie nicht freigeschaltet.** Eine Anmeldung und echte Schreibvorgänge in Google wurden noch nicht getestet. Der bestehende Apple-/ICS-Weg bleibt verfügbar. Keine Google-Zugangsdaten von anderen Projekten übernehmen.

## Einmalige Einrichtung durch den Betreiber

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein eigenes Projekt **SchichtKompass** erstellen oder das ausdrücklich dafür vorgesehene Projekt wählen. Es ist keine Verknüpfung mit Firebase notwendig.
2. Unter **APIs und Dienste → Bibliothek** die **Google Calendar API** aktivieren.
3. Unter **Google Auth Platform → Branding** den App-Namen **SchichtKompass**, die eigene Support-E-Mail und die Kontakt-E-Mail hinterlegen. Die Homepage ist `https://andi201andi201.github.io/schichtkompass/`. Die vorbereitete Datenschutzseite lautet nach Veröffentlichung `https://andi201andi201.github.io/schichtkompass/privacy.html`. Für die öffentliche Freigabe müssen diese Seiten live sein und Googles Anforderungen an die autorisierten/verifizierten Domains erfüllt sein. Eine von Google geforderte Domain-Verifikation oder Prüfung nicht umgehen.
4. Als Zielgruppe **External/Extern** wählen. Zunächst im **Testmodus** das eigene Google-Konto als Testnutzer hinzufügen. Kollegen können später ausdrücklich als Testnutzer ergänzt werden. Ein Projekt im Testmodus ist keine allgemein freigegebene App.
5. Unter **Data Access/Datenzugriff** genau diese Berechtigungen eintragen:
   - `https://www.googleapis.com/auth/calendar.app.created` zum Erstellen und Bearbeiten der von SchichtKompass erstellten Kalender.
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly` zum Wiederfinden des eigenen Kalenders, auch auf einem anderen Gerät. Die Inhalte fremder Kalender werden nicht gelesen.
6. Unter **Clients → Create client → Web application** einen OAuth-Client erstellen. Unter **Authorized JavaScript origins** genau `https://andi201andi201.github.io` eintragen, ohne `/schichtkompass/`. Für den GIS-Popup-Tokenfluss wird keine Weiterleitungs-URI benötigt. Keine Wildcards verwenden.
7. Nur die **Client-ID** kopieren, die auf `.apps.googleusercontent.com` endet. Sie ist öffentlich und wird in `dist/google-config.js` als `GOOGLE_CLIENT_ID` eingetragen. **Kein Client Secret, Passwort, Zugriffstoken oder heruntergeladenes Zugangsdaten-JSON im Repository ablegen.**
8. `npm run check`, `npm test` und `npm run build` ausführen. Änderungen über den bestehenden Pages-Workflow veröffentlichen.
9. Auf einem echten Android-Handy in Chrome und einem iPhone in Safari mit einem Testkonto prüfen: anonymisierten Testplan öffnen, kontrollieren, beide Freigaben erteilen, übertragen, erneut übertragen, eine Zeit korrigieren und einen Tag auf frei setzen. Danach Kalenderzahl und Termine direkt in Google prüfen. Der eingebaute Demo-Modus darf keine echten Kalender anlegen.
10. Vor einer breiteren Freigabe die Zielgruppe und den Veröffentlichungsstatus in Google ändern und eine dort verlangte Prüfung abschliessen. Nicht voraussetzen, dass die Registrierung eines Clients schon eine Freigabe für alle Benutzer ist. Verwaltete Spitalkonten können zusätzliche Administratorregeln haben.

Offizielle Dokumentation: [Calendar JavaScript quickstart](https://developers.google.com/workspace/calendar/api/quickstart/js), [Google Identity Services Tokenmodell](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Kalender-Berechtigungen](https://developers.google.com/workspace/calendar/api/auth).

## Verhalten

- Erst vollständiger geprüfter Monat und ausdrückliche Übertragungszustimmung, dann Google-Konto auswählen.
- Google Identity Services öffnet das Anmeldefenster unmittelbar aus dem Tastendruck. Kein selbstgebauter OAuth-Redirect, keine Tokens in URL oder localStorage, keine Refresh-Tokens auf einem Server.
- Die Kalenderliste wird gelesen, um den Kalender mit der personenspezifischen Kennung zu finden. Der Name selbst wird nicht übertragen, sein SHA-256-Fingerabdruck dient der Wiedererkennung und ist keine Anonymisierung.
- Nur Termine mit passenden internen Kennungen für App, Person und Monat werden abgeglichen. Stabile IDs verhindern wiederholte Einfügungen nach verlorenen Antworten. Gelöschte Google-IDs werden durch deterministische Generationen ersetzt.
- Erst alle gewünschten Dienste speichern, dann überholte App-Termine dieses Monats entfernen. Bei einem Fehler davor werden keine Löschungen begonnen. Ein Teil der Änderungen kann bereits gespeichert sein; Wiederholen gleicht denselben Monat erneut ab.
- Ein gleichzeitiger Lauf in mehreren Tabs wird, wo unterstützt, mit Web Locks serialisiert. Auf zwei verschiedenen Geräten sind erstmalige Kalendererstellungen nicht atomar; gefundene doppelte Kalender führen deshalb zu einem Abbruch mit Hinweis, nicht zu einer willkürlichen Auswahl.
- Andere Monate, manuelle Termine, alte Abos und frühere Dateiimporte werden nicht gelöscht. Bestehende Importkalender gegebenenfalls ausblenden, um doppelte Anzeige zu vermeiden.
- Kein Hintergrunddienst: Änderungen an der Plan-Datei gelangen erst nach erneutem Hochladen, Prüfen und Übertragen zu Google. Die Handy-App kann für die Anzeige kurz zum Synchronisieren brauchen.
- Zugriff in den Google-Kontoeinstellungen widerrufen; bereits übertragene Termine bei Bedarf direkt in Google löschen.

## Verifikation

Automatisierte Tests verwenden eine simulierte Calendar API. Sie prüfen nicht die reale Google-Konfiguration oder Google-eigene Dialoge. Ein echter Test mit der eigenen Client-ID ist vor Freigabe erforderlich. Keine echten Dienstpläne, Tokens oder Screenshots mit privaten Terminen in Tests oder GitHub hochladen.
