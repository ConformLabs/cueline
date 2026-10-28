# Reviewing captions

When Cueline finishes, the review screen lists every caption with its timecode, length and reading speed.

- **To review:** captions that break the style or need a look (amber). **J** and **K** step through them; the
  **Review** filter shows only them.
- **Fixed automatically:** with **Fix automatically** on, Cueline splits, merges and extends captions that break the
  style when it finishes, and says how many it changed. **Undo** takes it back.
- **Low confidence:** words Whisper was unsure of are underlined. **Add to glossary** teaches Cueline the right
  spelling next time.
- **Speaker unsure:** see [Speakers](Speakers#unsure-speakers).

## Editing

Click a caption's text to edit it. Enter saves and moves to the next one. Splits: **⌥Enter** at the cursor, or
**S** at the playhead. Find and replace is in the toolbar.

## Timing

The selected caption shows a waveform with the audio around it. Drag its in or out edge; the neighbours' captions are
shaded so you don't overlap them. Click the waveform to move Premiere's playhead there. The ‹ › buttons nudge by one
frame; ⇤ ⇥ set in or out to the playhead.

### Snap to cuts

A caption that starts or ends a few frames off a shot change flashes across it. With **Snap to cuts** on (More options,
before you transcribe), captions within 12 frames of a cut move onto it when Cueline finishes: the in-point onto the
cut, the out-point to the cut less the style's gap. It never hides a word, overlaps two captions or makes one shorter
than half a second, and it is one undo step. The strip of all captions shows the cuts as thin lines.

Cuts are the edit points of the footage on your video tracks; titles, graphics and adjustment layers don't count. After
you change the edit, **More (…) › Snap to cuts now** reads them again.

### Playback

**P** plays the caption in Premiere Pro and stops at its end. **Follow** keeps the caption under the playhead selected
and in the middle of the list while you play or scrub.

## Fillers

With fillers set to **Mark**, אה, אמ, um and uh are highlighted. Keep or remove them per caption, or all at once from
the banner.

## Exporting

**Export** saves SRT, WebVTT, a plain transcript, a transcript with timecodes, or a **Transcript for producers**: a
Word document with a paragraph per speaker turn, its timecode and the speaker's name, right to left for Hebrew and
Arabic. It opens in Word, Pages and Google Docs, for paper edits and approvals.

For animated captions on a video track, see [Animated captions](Animated-captions).

## Updating the timeline

Premiere Pro's scripting can add caption tracks but cannot change or delete them. So **Update timeline** places your
edited captions on a new caption track. Delete the old one in Premiere Pro (right-click the track › Delete Track) when
you no longer need it.
