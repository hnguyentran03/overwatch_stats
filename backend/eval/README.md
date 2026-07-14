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

## Results

- 2026-07-14 baseline (pre-crop, pre-notes): 36/50 (72%)
  - image.png: 7/10 — row 3 predicted Cassidy expected Soldier: 76; row 4 predicted Baptiste expected Ana; row 10 predicted Baptiste expected Ana
  - image2.png: 7/10 — row 3 predicted Ashe expected Soldier: 76; row 6 predicted Ramattra expected Winston; row 7 predicted Illari expected Sojourn
  - image3.png: 7/10 — row 3 predicted Cassidy expected Torbjörn; row 6 predicted Ramattra expected Junker Queen; row 10 predicted Juno expected Ana
  - image4.png: 8/10 — row 3 predicted Ashe expected Torbjörn; row 9 predicted Illari expected Brigitte
  - image5.png: 7/10 — row 1 predicted Ramattra expected Winston; row 4 predicted Baptiste expected Ana; row 7 predicted Hanzo expected Emre (Emre is a custom hero with no reference portrait; this miss is expected)
- 2026-07-14 crop + portrait_notes: 45/50 (90%)
  - image.png: 10/10
  - image2.png: 9/10 — row 7 predicted Illari expected Sojourn
  - image3.png: 10/10
  - image4.png: 10/10
  - image5.png: 6/10 — row 1 predicted Ramattra expected Winston; row 4 predicted Baptiste expected Ana; row 6 predicted Widowmaker expected Ramattra; row 7 predicted Cassidy expected Emre (Emre is a custom hero with no reference portrait; this miss is expected)
