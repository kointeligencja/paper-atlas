# The paper atlas

A geography game for children, made of cut paper. Build the world country by country, piece
flags together, collect passport stickers, and fly paper-plane Air Mail across real wind belts,
following famous journeys from history.

Plays in a web browser with a mouse or a touch screen. No install, no build step, no accounts;
progress is saved in the browser.

## Play locally

Open `index.html` in a modern browser (Chrome, Safari, Firefox, Edge with WebGL2).
To play on a tablet on the same network, serve the folder:

```
python3 -m http.server 8751
```

and open `http://<your-computer's-address>:8751` on the tablet.
On a phone: turn it sideways; Add to Home Screen gives the largest picture.

Handy URL options: `?view=mail` opens Air Mail, `?view=mail&letter=J1` starts one letter,
`?reset` clears all players and progress.

## Saving and privacy

- **Progress and players:** Saved only in your browser (`localStorage`) on that device. There
  are no accounts, no server sync, and we do not collect any data.
- **When progress is lost:** Clearing the browser's site data or playing in a private window
  will lose your saved players and progress. Opening the game with `?reset` clears them on purpose.
- **Voice:** Spoken words use your browser's built-in speech synthesis. Depending on the browser
  and chosen voice (for example, Chrome with Google voices), the browser itself may send text to
  an online speech service from the browser maker.
- **Fonts:** The display font (`Baloo 2`) loads from Google Fonts.
- **Hosting:** The public site runs on Vercel, which keeps standard web server logs. The game adds
  no analytics, cookies or trackers.

## Status

Early version, played at home. The history texts on the Air Mail story cards are drafts and
are still being fact-checked.

## Data and credits

- Country borders and capitals: [Natural Earth](https://www.naturalearthdata.com/) (public domain),
  processed by `atlas/tools/build.mjs`; a few capitals corrected in `atlas/tools/capital-overrides.json`.
- Flag reference artwork: [hampusborgos/country-flags](https://github.com/hampusborgos/country-flags),
  SVGs from Wikimedia Commons (public domain); see `atlas/flags-ref/SOURCE.txt`.
- Polygon clipping: Clipper by Angus Johnson (Boost Software License), `atlas/tools/clipper.cjs`.
- Font: Baloo 2 (SIL Open Font License), loaded from Google Fonts.
- Voice: the browser's built-in speech synthesis.

## License

Code: MIT, see `LICENSE`. Data and artwork keep their own licenses listed above.
