# Scoreboard eval set

Measures hero-detection accuracy of `utils/scoreboard.py` on real screenshots.

1. Put end-of-match scoreboard screenshots in `screenshots/` (gitignored —
   they stay on your machine).
2. Label each file in `labels.json`: filename → array of exactly 10 hero
   names in scoreboard row order — team1 (top/blue) rows 1-5, then team2
   (bottom/red) rows 1-5. Use the exact spellings from the app's hero list.

   ```json
   {
     "match1.png": ["Reinhardt", "Genji", "Tracer", "Ana", "Kiriko",
                    "Winston", "Ashe", "Sombra", "Lúcio", "Mercy"]
   }
   ```

3. Run from `backend/` with the venv active:

   ```bash
   python scripts/eval_scoreboard.py --save-crops   # free: check crop framing
   python scripts/eval_scoreboard.py                # paid: one API call per file
   ```

The `--save-crops` output in `crops/` (gitignored) should show exactly the 10
hero portraits; if not, adjust the `CROP_*` constants in `utils/scoreboard.py`.
