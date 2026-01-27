# AI-Assisted Data Generation Workflow

This folder contains Python scripts for batch processing GeoGuessr meta data using pattern-based generation.

## Scripts

| Script | Purpose |
|--------|---------|
| `generate_titles.py` | Generates titles for metas with empty title fields |
| `generate_scopes.py` | Assigns geographic scope values to all metas |
| `generate_tags.py` | Assigns category tags to all metas |

## Workflow

### 1. Run a Generation Script

```bash
python scripts/generate_titles.py
python scripts/generate_scopes.py
python scripts/generate_tags.py
```

Each script:
1. Loads `data/plonkit_data.json`
2. Iterates through all metas
3. Analyzes description/title content using regex patterns
4. Assigns appropriate values based on pattern matches
5. Saves updated JSON back to file

### 2. Review Results

Scripts output statistics showing what was assigned:
```
SCOPE DISTRIBUTION:
  Region      :  2007 metas
  Countrywide :  1543 metas
  10km        :  1212 metas
  ...
```

### 3. Iterate if Needed

If results aren't satisfactory:
1. Edit the pattern matching logic in the script
2. Re-run the script (it overwrites previous values)
3. Review new results

## Adding New Scripts

Follow the same pattern:

```python
import json
from pathlib import Path

JSON_FILE_PATH = Path(__file__).parent.parent / "data" / "plonkit_data.json"

def determine_value(title, desc, note):
    # Pattern matching logic here
    return "value"

def main():
    with open(JSON_FILE_PATH, 'r') as f:
        data = json.load(f)
    
    for country_data in data:
        for meta in country_data.get('metas', []):
            meta['field'] = determine_value(
                meta.get('title', ''),
                meta.get('description', ''),
                meta.get('note', '')
            )
    
    with open(JSON_FILE_PATH, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
```

## Notes

- Scripts use regex pattern matching, not AI inference
- All scripts are idempotent - can be re-run safely
- JSON is formatted with 2-space indentation
- Unicode characters are preserved (`ensure_ascii=False`)
