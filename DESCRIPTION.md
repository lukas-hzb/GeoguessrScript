# Geoguessr Community Meta Script - Project Plan

## 1. Beschreibung
Dieses Projekt ist ein UserScript für Geoguessr, das eine lokale Wissensdatenbank für Geoguessr-Locations bereitstellt. Es fungiert als Erweiterung des Spiels, um Spielern zu helfen, "Metas" (wiederkehrende Erkennungsmerkmale) zu lernen und zu dokumentieren.

Das Besondere an diesem Script ist die **Crowdsourcing-Architektur**:
- Die Datenbank liegt öffentlich auf **GitHub**.
- Das Script lädt die Daten live von dort.
- Nutzer können über eine im Spiel integrierte UI neue Metas hinzufügen, die dann via Pull Request oder Commit in die Datenbank eingepflegt werden.

## 2. Features

### Core Features
- **GitHub als Backend**: Kostenlose, transparente und versionierte Datenbank (`locations.json`).
- **Live-Hints**: Anzeige von Hinweisen *während* der Runde (z.B. "Suche nach: Schwarzem Auto, Gen 3 Kamera").
- **Meta-Verwaltung**:
    - **Anzeigen**: Zeigt gespeicherte Tags, Texte und Bilder zur aktuellen Location an.
    - **Hinzufügen**: UI zum Erstellen neuer Einträge für die aktuelle Position.

### Detaillierte Funktionalitäten
1.  **In-Game HUD (Heads-Up Display)**:
    - Dezentrale Anzeige am Bildschirmrand.
    - Zeigt "Active Hints" basierend auf der Location ID.
    - Einklappbar, um das Spiel nicht zu stören.
2.  **Meta-Editor**:
    - Formular zum Eingeben von:
        - Tags (z.B. "Bollard", "Sign", "Car")
        - Titel/Name der Meta
        - Beschreibungstext
        - Bild-URL (optional)
    - **Export-Funktion**: Generiert einen JSON-Schnipsel, den der Nutzer einfach kopieren und auf GitHub einreichen kann.
3.  **Such-Funktion**:
    - Datenbank nach Tags oder Orten durchsuchen (z.B. "Alle Locations mit 'Bollard' anzeigen").

## 3. Design
Das Design soll sich nahtlos in die moderne Geoguessr-Oberfläche einfügen ("Premium & Native Look").

- **Farbschema**: Dunkle Transparenzen, Geoguessr-Purpur (#7950E5) als Akzentfarbe.
- **Typografie**: Nutzung der Geoguessr-Fonts (Neo Sans oder ähnlich).
- **Elemente**:
    - **Glassmorphism**: Hintergründe mit Blur-Effekt.
    - **Cards**: Infos werden als kompakte Karten dargestellt.
    - **Icons**: Klare, moderne Icons für Tags (z.B. Auto-Icon für Car-Metas).

## 4. Abläufe (Workflows)

### Daten-Abruf (Read)
1.  Script startet auf Geoguessr.com.
2.  `GM_xmlhttpRequest` lädt `https://raw.githubusercontent.com/.../locations.json`.
3.  Script cached die Daten im Speicher.
4.  Bei Rundenstart: Script holt die aktuelle `LocationID` (Panoid) aus dem Spiel-Code.
5.  Abgleich mit Datenbank -> Treffer -> Anzeige im HUD.

### Daten-Beitrag (Write)
1.  Spieler entdeckt eine neue Meta.
2.  Klick auf "Add Meta" im Script-Menü.
3.  Eingabe der Daten (Titel, Tags, Beschreibung).
4.  Klick auf "Generate JSON".
5.  Script validiert und formatiert den Eintrag.
6.  Spieler kopiert JSON -> Geht zu GitHub -> Editiert `locations.json` -> Commit (oder Pull Request).

## 5. Datenbank
Die Datenstruktur ist einfach, flach und effizient gehalten.

**Datei**: `data/locations.json`

```json
[
  {
    "id": "PANOID_string_unique",
    "lat": 12.34567, // Optional zur Verifizierung
    "lng": -98.76543, // Optional
    "metas": [
      {
        "type": "hint", // oder "answer" für Auflösung
        "tags": ["car", "antenna"],
        "title": "Kenya Snorkel",
        "description": "Look for the snorkel on the front right of the car.",
        "imageUrl": "images/kenya_snorkel.jpg"
      }
    ]
  }
]
```

## 6. Entwicklungs-Reihenfolge
1.  **Datenbank-Mock**: Erstellen einer validen JSON-Struktur auf GitHub.
2.  **Basic Script**: Laden der JSON-Daten im Hintergrund.
3.  **Location Detection**: Zuverlässiges Auslesen der aktuellen ID im Spiel.
4.  **HUD UI**: Anzeige der Daten, wenn eine ID passt.
5.  **Editor UI**: Formular zum Erstellen neuer Daten.
