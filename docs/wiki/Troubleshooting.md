# Troubleshooting

**First step for any problem:** **☰ › Check Cueline**. Every failed line says what's wrong and how to fix it.

| What you see | What to do |
|---|---|
| **Cueline** is not in **Window › Extensions** | Restart Premiere Pro after installing. Make sure it is Premiere Pro 2022 or later. Run the installer again. |
| "No sequence is open" | Open a sequence in the Timeline; Cueline follows it by itself. |
| "Pick at least one audio track" | Click the tracks with speech under Audio. |
| "The transcription engine is missing" | Run the installer again. |
| "No model is downloaded yet" | **☰ › Models**, download one. |
| A model download stops | Check the internet connection, then download it again in **☰ › Models**. |
| Transcription is slow on Windows | Windows transcription runs on the CPU. Use **ivrit.ai large-v3-turbo** or **Whisper large-v3-turbo**, and keep **Skip silence** on. |
| **P** doesn't play | Premiere Pro starts playback only while it is the active app: click its timeline once, then press P again. |
| Shortcuts don't work | Click in the Cueline panel first: Premiere Pro sends keys to the panel only while it has focus. |
| Captions are on the wrong speaker | Click the tag › **Said by …**. See [Speakers](Speakers). |
| Caption timing is off where music plays under speech | Drag the in or out on the waveform; the audio has no pauses there to time from. |
| Hebrew punctuation lands on the wrong side | Keep **RTL fixed** on (Caption style). |
| **Update timeline** left the old captions | Premiere's scripting can't change caption tracks. Delete the old track by hand. |

## Report a problem

**☰ › Copy diagnostics**, then [open an issue](https://github.com/ConformLabs/cueline/issues/new/choose) and paste it.
