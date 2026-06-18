#!/bin/bash
# Double-click launcher for macOS / Linux.
cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo "   Belgian House Search"
echo "============================================================"
echo

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 is not installed yet."
    echo "Opening the download page - install it, then run this again."
    (open "https://www.python.org/downloads/" 2>/dev/null \
        || xdg-open "https://www.python.org/downloads/" 2>/dev/null)
    read -r -p "Press Enter to close..."
    exit 1
fi

echo "Using Python: $(python3 --version)"
echo "Checking required components (first time only)..."
python3 -m pip install --quiet requests >/dev/null 2>&1

echo
echo "Starting the app - your browser will open shortly."
echo "Keep this window open while you use it. Close it to stop."
echo
python3 app.py
