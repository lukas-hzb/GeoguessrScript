#!/bin/bash

# Define paths
LOCATIONS_FILE="data/locations.json"
METAS_FILE="data/metas.json"

echo "Re-initializing database files..."

# Sync first to avoid conflicts
echo "Pulling latest changes..."
git pull

# Reset local files
echo "{}" > "$LOCATIONS_FILE"
echo "[]" > "$METAS_FILE"

echo "Local files cleared."

# Sync with GitHub (Global)
echo "git adding files..."
git add "$LOCATIONS_FILE" "$METAS_FILE"

echo "git committing..."
git commit -m "CLEAR DB: Reset locations and metas via script"

echo "git pushing..."
git push

echo "Database cleared successfully (Local & Global)!"
