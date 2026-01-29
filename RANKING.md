# Aktuelles Ranking- und Auswahlsystem für Predicted Metas

Dieses Dokument beschreibt die interne Logik, wie Metas aktuell als "PREDICTED" ausgewählt und sortiert werden. Basierend auf dem Code in `evaluateProximityMetas` und `refreshDisplay`.

## 1. Auswahlkriterien (Selection)
Das System erstellt eine Liste von Kandidaten basierend auf zwei Prioritätsebenen.

### Priorität 1: Historische Übereinstimmungen (Impliziter Kontext)
Das System prüft **alle Orte, an denen ein Meta zuvor verlinkt wurde** (`locationMap`) und vergleicht diese historischen Orte mit deiner *aktuellen* Position. Ein Meta landet in dieser Gruppe, wenn einer der folgenden Fälle eintritt:

-   **Gleiche Straße (Road Match):** Du befindest dich auf demselben Straßennamen wie eine frühere Verlinkung dieses Metas.
-   **Gleiche Region (Region Match):** Du befindest dich in derselben Region (und demselben Land) wie eine frühere Verlinkung.
-   **Räumliche Nähe (Proximity Match):** Du befindest dich innerhalb des definierten Radius (Scopes) einer früheren Verlinkung.
    -   *Beispiel:* Ein Meta hat den Scope "10km". Wenn du weniger als 10km von einem Ort entfernt bist, an dem dieses Meta schon einmal gesetzt wurde, wird es ausgewählt.

### Priorität 2: Definitions-Übereinstimmungen (Expliziter Scope)
Das System prüft die **Definition des Metas selbst** und vergleicht sie mit deiner aktuellen Position. Dies betrifft Metas, die allgemein für ein Gebiet gelten, unabhängig davon, ob sie dort schon einmal spezifisch platziert wurden:

-   **Landesweit (Countrywide):** Dein aktuelles Land entspricht dem Land des Metas.
-   **Region:** Deine aktuelle Region entspricht der Region des Metas.
-   **Straße (Road):** Deine aktuelle Straße entspricht dem im Meta hinterlegten Straßennamen (falls vorhanden).

---

## 2. Sortierung (Ranking)
Die Reihenfolge der Anzeige wird derzeit strikt durch die Gruppenzugehörigkeit bestimmt, nicht durch einen Score.

1.  **Oben: Prioritäts-Matches**
    -   Metas, die durch **Priorität 1** (Historische Datenbank) gefunden wurden, stehen immer ganz oben.
    -   *Wichtig:* Innerhalb dieser Gruppe gibt es aktuell **keine** weitere Sortierung (z.B. nach genauem Abstand). Sie erscheinen grob in der Reihenfolge, in der sie in der Datenbank gefunden werden.

2.  **Unten: Scope-Matches**
    -   Metas, die durch **Priorität 2** (Allgemeine Definition) gefunden wurden, werden darunter angefügt.
    -   *Wichtig:* Auch hier erfolgt keine intelligente Sortierung; sie erscheinen in der Reihenfolge der `plonkit_data.json` bzw. `metas.json` (oft alphabetisch oder nach Erstellungsdatum).

---

## 3. Filterung
Nachdem die Liste erstellt und sortiert wurde, werden folgende Filter angewendet:

-   **Duplikate entfernen:** Metas, die bereits fest mit dem aktuellen Ort verlinkt sind ("Exact Matches"), werden aus der Predicted-Liste entfernt.
-   **User-Einstellungen:** Der aktive Scope-Filter des Nutzers wird angewendet (z.B. wenn "Countrywide" in den Einstellungen deaktiviert ist, werden diese ausgeblendet).

## Zusammenfassung der aktuellen Limitationen
*   Es gibt keine Gewichtung innerhalb der Gruppen (z.B. ist ein 100m entfernter Treffer gleichwertig mit einem 9km entfernten Treffer innerhalb des 10km Radius).
*   Road-Matches werden nicht visuell hervorgehoben oder gesondert an die Spitze sortiert, es sei denn, sie fallen zufällig durch die Datenbank-Reihenfolge nach oben.
