# For developers

The repository's [README](https://github.com/ConformLabs/cueline#readme) describes the layout and the release.

- `extension/js/cues.js`: the caption engine (no DOM, tested with `npm test`).
- `extension/js/engine.js`: whisper.cpp and the speaker tools (Node, in CEP).
- `extension/js/panel.js`: the screens. `extension/js/host.js`: the Premiere Pro bridge, or a simulated one when
  `extension/index.html` is opened in a browser.
- `native/voiceprint.c`: the voice-print helper on sherpa-onnx's C API.
- `extension/js/looks.js`: the animated caption looks. `extension/js/docx.js`: the Word transcript.
- `templates/build-animated-captions.jsx`: builds the animated caption templates in `extension/mogrt`. Run it in After
  Effects 2025 (the oldest version a template opens in), tick Edit Properties › Font, Font Size and Faux Styles on
  "Caption" in both comps (scripts can't), and export again. `templates/animated-captions-ae2025.aep` is the result.
- `scripts/`: `build-engine-mac.sh`, `build-speakers-mac.sh`, `build-windows.mjs` (over SSH), `package-mac-pkg.mjs`,
  `package-win-installer.mjs`, `release.mjs`.

The wiki's source is `docs/wiki/` in the repository.
