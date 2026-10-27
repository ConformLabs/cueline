# The Cueline panel

**Window › Extensions › Cueline Captions.** The panel works narrow (docked in a column) and wide: at 760 px and wider, review
shows the list and the selected caption side by side, with a strip of all captions underneath.

## Main screen

- **Source:** the open sequence, its In/Out (or the whole sequence) and the audio tracks to listen to. Cueline follows
  In/Out and track changes by itself.
- **Language:** type to search all 100 of Whisper's languages, or **Auto detect**.
- **Model** and **Style** (see [Models and languages](Models-and-languages) and
  [Caption style and glossary](Caption-style-and-glossary)).
- **More options:** fix automatically, skip silence, [speakers](Speakers), dialogue dashes, a caption track per
  speaker, fillers (mark, remove, keep), translate to English.
- **Transcribe**, and **Transcribe several sequences** ([Batch](Batch)).

## While it works

The steps (export audio, find speech, transcribe, tell speakers apart, build captions, check the style), elapsed time,
time left, speed, and the transcript as it is written. **Stop** keeps what is done so far.

## Review

See [Reviewing captions](Reviewing-captions).

## The menu (☰)

| Group | Item |
|---|---|
| This transcription (review only) | Undo, Redo, Keyboard shortcuts |
| Work | Transcribe several sequences, History |
| Settings | Caption style and glossary, Models |
| Help | Check Cueline, Copy diagnostics, Updates, About and help, Log |

The same items are in Premiere Pro's own panel menu (the ≡ next to the panel's name).

- **History:** earlier transcriptions; open one to fix it and place it again.
- **Check Cueline:** tests the engine, models, Premiere Pro, the sequence, the export preset and the temporary
  folder. What fails comes first, with what to do and a button where Cueline can fix it.
- **Copy diagnostics:** versions, folders, settings and the recent log, for a bug report.
- **Log:** everything Cueline did, step by step.

## Keyboard shortcuts (review)

| Keys | What |
|---|---|
| ↑ ↓ | Previous or next caption |
| ⌥↑ ⌥↓ | Select and go to it in the timeline |
| G | Go to the selected caption in the timeline |
| F | Select the caption at the playhead |
| J K | Next or previous caption to review |
| P | Play the selected caption in Premiere Pro, stop at its end |
| Enter | Edit the selected caption (Enter again: save and edit the next; ⇧Enter: line break; Esc: stop) |
| ⌥Enter (editing) | Split at the cursor |
| S | Split the selected caption at the playhead |
| ⌥[ ⌥] | Set in or out to the playhead |
| U ⇧U | Undo, redo |
| ? | The list in the panel |

Premiere Pro keeps ⌘Z and similar menu keys for itself, so Cueline uses U and ⇧U for undo. On Windows, Alt
stands for ⌥.
