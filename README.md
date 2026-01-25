# Geoguessr Community Meta Script

A UserScript to crowdsource and display meta hints for Geoguessr locations.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Create a new script and paste the contents of `geoguessr-meta.user.js`.
   - *Note: Once the repo is public, you can install directly via raw link.*

## How to Contribute

We rely on community contributions to build the database!

### Adding a new Meta
1. In the game, use the "Add Meta" button (coming soon).
2. Generate the JSON snippet.
3. Edit `data/locations.json` in this repository.
4. Add your new entry to the array and submit a Pull Request.

## Structure
- `geoguessr-meta.user.js`: The script logic.
- `data/locations.json`: The database of locations and hints.
