# Cueline

Captions from speech for Adobe® Premiere Pro®, made on your computer. A Conform Labs product.

Cueline exports the sequence's audio, transcribes it with [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
(ivrit.ai's model for Hebrew), times every caption against the audio, checks it against the caption style, tells
speakers apart, and places the result on a caption track. Nothing is uploaded.

**Install:** download the installer for your computer from [Releases](https://github.com/ConformLabs/cueline/releases)
(macOS 12+ on Apple Silicon or Intel, Windows 10/11), run it, restart Premiere Pro, then Window › Extensions › Cueline.

## Repository

| Folder | What |
|---|---|
| `extension/` | the Premiere Pro panel (CEP): `js/panel.js` (screens), `js/cues.js` (caption engine, no DOM), `js/engine.js` (whisper.cpp and speaker tools, Node), `js/host.js` (Premiere bridge, or a simulated one in a browser), `jsx/host.jsx` (ExtendScript) |
| `native/` | `voiceprint.c`, the voice-print helper built on sherpa-onnx's C API |
| `scripts/` | builds, signing, installers, release |
| `installer/` | the Conform Labs installer frame (`common/`) and Cueline's pages |
| `brand/` | logo, icons, colours |
| `notes/` | release notes, one file per version (the release body, shown in the panel's Updates screen) |
| `test/` | `node test/cues.test.js` |

## Develop

```sh
npm run build:mac            # whisper-cli (universal) and the speaker tools into extension/engine/mac
ln -s "$PWD/extension" ~/Library/Application\ Support/Adobe/CEP/extensions/com.conformlabs.cueline
defaults write com.adobe.CSXS.11 PlayerDebugMode 1   # unsigned development copy
npm test
```

Open `extension/index.html` through any static server to preview the panel with a simulated Premiere Pro.

## Release

`npm run release -- 1.0.1 --notes notes/release-1.0.1.md` stamps the version, checks, builds the signed and notarized
Mac installer and the Windows Setup, and publishes the GitHub release. See `scripts/release.mjs`.

Built on whisper.cpp (MIT), ivrit.ai models (Apache-2.0), sherpa-onnx (Apache-2.0), pyannote segmentation (MIT),
3D-Speaker CAM++ (Apache-2.0), Silero VAD (MIT) and IBM Plex (OFL). See `PRIVACY.md` for every network request.
