# Vool ära!

A game about a 62-hour power cut, for parents. Served at https://lemonadestand.ee/vool-ara/.

- `index.html` is the built game. It is a single self-contained file, and the site serves it as-is.
- `src/` holds the source: `app.js` (engine, story, views), `house.js` (the home cross-section), `style.css` + `extra.css`, `template.html`.
- `build.py` assembles `src/` into `index.html`: `python3 build.py`.
- `tests/` has the jsdom checks. Install jsdom with `npm i jsdom@24`, then run:
  - `node tests/sim.js index.html` for balance across random families and homes.
  - `node tests/ui.js index.html` for 200 UI-driven playthroughs.

Every piece of advice in the game cites its source (mostly olevalmis.ee). Check the sources again whenever the official guidance changes.
