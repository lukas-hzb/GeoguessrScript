#!/bin/bash

# Usage: ./sync.sh "Commit message"

if [ -z "$1" ]; then
    echo "Error: Commit message required."
    echo "Usage: ./sync.sh \"Your commit message\""
    exit 1
fi

echo "[Sync] Adding files..."
git add .

echo "[Sync] Committing..."
git commit -m "$1"

echo "[Sync] Pulling with rebase (to handle concurrent updates)..."
if git pull --rebase origin main; then
    echo "[Sync] Rebase successful. Pushing..."
    git push origin main
    echo "[Sync] Done!"
else
    echo "[Sync] Rebase failed due to conflicts. Please resolve manually."
    exit 1
fi
