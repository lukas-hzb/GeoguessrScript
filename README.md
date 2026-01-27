# BetterMetas - Geoguessr Script

A Geoguessr UserScript that displays crowdsourced metas and hints directly in the game HUD. This project helps players learn and document "metas" (recognizable features) for various locations.

## Features

- **In-Game HUD**: Displays active hints, tags, and images for the current location.
- **Meta Editor**: Allows users to add new metas with tags, descriptions, and images.
- **Plonkit Scraper**: A Node.js scraper to fetch guide data from [Plonk It](https://www.plonkit.net) and convert it into a compatible JSON format.
- **GitHub Powered**: Uses GitHub as a database for versioned and crowdsourced data.

## Installation

1. Install a userscript manager like **Tampermonkey**.
2. Install the script from the `geoguessr-meta.user.js` file or via the raw GitHub link.

## Usage

### In-Game
- The HUD appears automatically when playing.
- Click "Add" to contribute new metas.
- Use the settings to configure options or sync data.

### Scraper
The `scraper.js` script fetches country guides from Plonk It.

```bash
# Install dependencies
npm install

# Run the scraper
npm start
# or
node scraper.js
```

The scraper saves data to `data/plonkit_data.json`.

## Project Structure

- `geoguessr-meta.user.js`: The main UserScript source code.
- `scraper.js`: Node.js script for scraping Plonkit guides.
- `data/`: Directory containing data files (`plonkit_data.json`, `locations.json`, etc.).
