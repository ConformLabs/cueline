# Speakers

**More options › Speakers:** Off, **By voice** or **By track**.

- **By voice:** Cueline tells people apart by how they sound, on your computer (sherpa-onnx with pyannote and
  3D-Speaker models, 34 MB, downloaded the first time). Pick **Auto detect** or how many people speak.
- **By track:** with two or more audio tracks picked, each track is one person (one microphone each).

A new caption starts when someone else talks. Each caption shows a tag with its speaker; the caption strip is coloured
by speaker.

## Changing speakers

Click a speaker tag:
- **Rename…** names that person everywhere ("Noa" instead of "Speaker 1").
- **Said by …** moves the caption (or, in a two-person caption, that person's line) to someone else.

## Unsure speakers

After Whisper finishes, Cueline checks every sentence against each speaker's voice. A sentence that sounds almost as
much like someone else is marked **Speaker unsure**, with **Said by …** and **Looks right**. Short sentences ("כן.",
"OK.") and parts with music under the voices are the usual ones.

## On the timeline

- **Dialogue dashes:** a short back-and-forth shares one caption, one line per speaker ("- Where were you?" /
  "- At the office.").
- **A caption track per speaker:** each person gets their own caption track, Speaker 1 at the bottom, so each can have
  its own Track Style in Premiere Pro. Premiere's scripting can't name caption tracks; the message after placing says
  which is whose.
- **Transcript with timecodes** (Export) starts each line with the speaker's name.
