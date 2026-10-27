# Cueline Captions for Adobe® Premiere Pro®

Cueline Captions turns the speech in a Premiere Pro sequence into captions on a caption track, on your computer. Nothing is
uploaded. It is made for Hebrew first (with ivrit.ai's model) and works in 99 other languages.

```
sequence audio ──> whisper.cpp (words) ──> timing from the audio ──> caption style check ──> caption track
                   speaker detection ──────┘
```

## Getting started

1. [Install Cueline](Installing) and restart Premiere Pro.
2. Open the panel: **Window › Extensions › Cueline Captions**.
3. The first time, download a speech model (about 1.6 GB). For Hebrew, **ivrit.ai large-v3-turbo**. After that,
   Cueline works offline.
4. Open a sequence. Set In/Out to caption part of it, or leave them off for the whole sequence.
5. Pick the audio tracks with speech, the language and a caption style, then click **Transcribe**.
6. Cueline shows its progress and the transcript as it is written. When it finishes, it fixes what breaks the
   style, places the captions on a new caption track and opens the review: see [Reviewing captions](Reviewing-captions).

## What it does

- **Captions timed from the audio.** Whisper gives the words; Cueline moves each caption's in and out to where the
  speech really starts and ends.
- **A style it checks.** Reading speed, line length, number of lines, shortest and longest caption. Broadcast,
  Social and One word, or your own. See [Caption style and glossary](Caption-style-and-glossary).
- **Fixes it can make by itself**: splits, merges and extends captions that break the style. It says what it
  changed, and you can undo it.
- **Review with the audio.** A waveform under the selected caption with draggable in and out points, playback in
  Premiere Pro, follow the playhead, jump to any caption, find and replace, undo.
- **Speakers**, by voice or by audio track: a new caption when someone else talks, dialogue dashes, a caption track
  per speaker, names you give them. See [Speakers](Speakers).
- **Fillers** (אה, אמ, um, uh) marked for you to keep or remove.
- **Batch**: several sequences, one after another. See [Batch](Batch).
- **Exports**: SRT, WebVTT, a transcript with timecodes, plain text, and markers.

## Requirements

- Premiere Pro 2022 (22.0) or later.
- macOS 12 or later (Apple silicon or Intel), or Windows 10/11 64-bit.
- About 2 GB of disk for a model. Transcription runs on the graphics card: Metal on a Mac, Vulkan on Windows (NVIDIA, AMD or Intel graphics; a PC without a Vulkan driver uses the CPU).

## Help

- [Troubleshooting](Troubleshooting), or **☰ › Check Cueline** in the panel.
- [Report a problem](https://github.com/ConformLabs/cueline/issues). **☰ › Copy diagnostics** copies what helps us
  help you.
