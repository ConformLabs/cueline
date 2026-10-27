/* Cueline host script: runs inside Premiere Pro, called by the panel through evalScript.
 * Every function returns a JSON string: {ok:true,...} or {ok:false,error:"what happened and the fix"}.
 * ExtendScript is ES3: no let/const, no arrow functions, no native JSON in every version. */

var CL_TICKS = 254016000000;

/* ---------- JSON (small, for our own data) ---------- */
function cl_q(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
}
function cl_str(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return cl_q(v);
  if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(cl_str(v[i])); return "[" + a.join(",") + "]"; }
  var o = []; for (var k in v) if (v.hasOwnProperty(k)) o.push(cl_q(k) + ":" + cl_str(v[k])); return "{" + o.join(",") + "}";
}
function cl_parse(s) { return eval("(" + s + ")"); } // input is JSON the panel wrote with JSON.stringify
function cl_ok(o) { o = o || {}; o.ok = true; return cl_str(o); }
function cl_err(msg) { return cl_str({ ok: false, error: String(msg) }); }

function cl_seq() { return app.project ? app.project.activeSequence : null; }
function cl_time(sec) { var t = new Time(); t.seconds = sec; return t; }
function cl_ticks(sec) { return String(Math.round(sec * CL_TICKS)); }

function cl_ping() { return cl_ok({ app: app.version, build: app.build }); }

/* ---------- sequence ---------- */
function cl_inout(seq) {
  var endSec = parseInt(seq.end, 10) / CL_TICKS;
  var rawIn = -1, rawOut = -1;
  try { rawIn = seq.getInPointAsTime().seconds; } catch (e) {}
  try { rawOut = seq.getOutPointAsTime().seconds; } catch (e) {}
  var hasIn = rawIn > 0, hasOut = rawOut > 0 && rawOut < endSec - 0.001;
  var a = hasIn ? rawIn : 0, b = hasOut ? rawOut : endSec;
  if (b <= a) b = endSec;
  return { inSec: a, outSec: b, endSec: endSec, hasInOut: hasIn || hasOut };
}

function cl_info() {
  try {
    if (!app.project) return cl_err("No project is open. Open one in Premiere Pro, then refresh.");
    var seq = cl_seq();
    if (!seq) return cl_err("No sequence is open. Open one in Premiere Pro, then refresh.");
    var io = cl_inout(seq);
    var fps = CL_TICKS / parseInt(seq.timebase, 10);
    var audio = [];
    for (var i = 0; i < seq.audioTracks.numTracks; i++) {
      var t = seq.audioTracks[i], muted = false;
      try { muted = t.isMuted(); } catch (e) {}
      audio.push({ index: i, name: t.name, muted: muted, clips: t.clips.numItems });
    }
    var playhead = 0;
    try { playhead = parseInt(seq.getPlayerPosition().ticks, 10) / CL_TICKS; } catch (e) {}
    return cl_ok({ name: seq.name, id: seq.sequenceID, fps: Math.round(fps * 1000) / 1000,
      inSec: io.inSec, outSec: io.outSec, endSec: io.endSec, hasInOut: io.hasInOut,
      audio: audio, videoTracks: seq.videoTracks.numTracks, playhead: playhead });
  } catch (e) { return cl_err("Could not read the sequence: " + e); }
}

/* ---------- batch: every sequence in the project ---------- */
function cl_listSequences() {
  try {
    if (!app.project) return cl_err("No project is open. Open one in Premiere Pro, then refresh.");
    var out = [], active = cl_seq(), activeId = active ? active.sequenceID : "";
    for (var i = 0; i < app.project.sequences.numSequences; i++) {
      var s = app.project.sequences[i], io = cl_inout(s), audio = 0;
      for (var k = 0; k < s.audioTracks.numTracks; k++) if (s.audioTracks[k].clips.numItems > 0) audio++;
      out.push({ id: s.sequenceID, name: s.name, inSec: io.inSec, outSec: io.outSec, endSec: io.endSec, hasInOut: io.hasInOut, audioTracks: audio, active: s.sequenceID === activeId });
    }
    return cl_ok({ sequences: out });
  } catch (e) { return cl_err("Could not list the sequences: " + e); }
}

// Make a sequence the active one (opens it in the Timeline), so export and captions go to it.
function cl_openSequence(id) {
  try {
    var ok = app.project.openSequence(id);
    var seq = cl_seq();
    if (!seq || seq.sequenceID !== id) return cl_err("Premiere Pro did not open that sequence.");
    return cl_ok({ name: seq.name });
  } catch (e) { return cl_err("Could not open the sequence: " + e); }
}

// A small snapshot the panel polls about once a second: what changed since last time, and the playhead.
function cl_state() {
  try {
    if (!app.project) return cl_ok({ seq: null });
    var seq = cl_seq();
    if (!seq) return cl_ok({ seq: null });
    var io = cl_inout(seq), sig = [];
    for (var i = 0; i < seq.audioTracks.numTracks; i++) {
      var t = seq.audioTracks[i], m = 0;
      try { m = t.isMuted() ? 1 : 0; } catch (e) {}
      sig.push(t.name + ":" + m + ":" + t.clips.numItems);
    }
    var playhead = 0;
    try { playhead = parseInt(seq.getPlayerPosition().ticks, 10) / CL_TICKS; } catch (e) {}
    return cl_ok({ seq: seq.sequenceID, key: [seq.sequenceID, io.inSec, io.outSec, io.endSec, sig.join("|")].join("/"), playhead: playhead });
  } catch (e) { return cl_err(e); }
}

/* ---------- audio export: only the tracks the person picked ---------- */
function cl_exportAudio(presetPath, tracksJson) {
  var seq = cl_seq();
  if (!seq) return cl_err("No sequence is open. Open one in Premiere Pro, then refresh.");
  var preset = new File(presetPath);
  if (!preset.exists) return cl_err("The audio export preset is missing at " + presetPath + ". Reinstall Cueline.");
  var keep = cl_parse(tracksJson || "null"), saved = [], i;
  try {
    if (keep && keep.length) {
      for (i = 0; i < seq.audioTracks.numTracks; i++) {
        var t = seq.audioTracks[i], was = false;
        try { was = t.isMuted(); } catch (e) {}
        saved.push(was);
        var want = true;
        for (var k = 0; k < keep.length; k++) if (keep[k] === i) want = false;
        t.setMute(want ? 1 : 0);
      }
    }
    var io = cl_inout(seq);
    var sep = $.os.toLowerCase().indexOf("windows") >= 0 ? "\\" : "/";
    var out = Folder.temp.fsName + sep + "cueline_" + new Date().getTime() + ".wav";
    seq.exportAsMediaDirect(out, preset.fsName, io.hasInOut ? 1 : 0); // 0 entire sequence, 1 in to out
    if (!new File(out).exists) throw new Error("Premiere Pro wrote no file.");
    return cl_ok({ path: out, inSec: io.inSec, duration: io.outSec - io.inSec });
  } catch (e) {
    return cl_err("Audio export failed: " + e.message);
  } finally {
    for (i = 0; i < saved.length; i++) { try { seq.audioTracks[i].setMute(saved[i] ? 1 : 0); } catch (e2) {} }
  }
}

/* ---------- the caption track ---------- */
function cl_findImported(bin, fileName) {
  for (var i = bin.children.numItems - 1; i >= 0; i--) {
    var c = bin.children[i];
    try { if (c.getMediaPath && new File(c.getMediaPath()).name === fileName) return c; } catch (e) {}
    if (c.name === fileName || c.name === fileName.replace(/\.srt$/i, "")) return c;
  }
  return null;
}

// The caption track keeps its own copy of the captions, so the imported SRT is not needed afterwards.
// Scripting cannot delete one project item, so the SRT goes into a temporary bin that is then deleted.
function cl_placeCaptions(srtPath, startSec) {
  var bin = null;
  try {
    var seq = cl_seq();
    if (!seq) return cl_err("No sequence is open. Open one in Premiere Pro, then refresh.");
    var f = new File(srtPath);
    if (!f.exists) return cl_err("The caption file is missing: " + srtPath);
    bin = app.project.rootItem.createBin("Cueline import " + new Date().getTime());
    app.project.importFiles([f.fsName], true, bin, false);
    var item = cl_findImported(bin, f.name);
    if (!item) return cl_err("Premiere Pro did not import the captions from " + f.fsName + ".");
    seq.createCaptionTrack(item, startSec || 0, Sequence.CAPTION_FORMAT_SUBTITLE);
    return cl_ok({ file: f.fsName });
  } catch (e) {
    return cl_err("Could not create the caption track: " + e);
  } finally {
    if (bin) { try { bin.deleteBin(); } catch (e2) {} }
  }
}

// Remove the "Cueline" bin older versions of Cueline filled with imported SRT files.
function cl_removeOldBin() {
  var root = app.project.rootItem, n = 0;
  for (var i = root.children.numItems - 1; i >= 0; i--) {
    var c = root.children[i];
    if (c.type === ProjectItemType.BIN && (c.name === "Cueline" || /^Cueline import \d+$/.test(c.name))) {
      n += c.children.numItems;
      c.deleteBin();
    }
  }
  return cl_ok({ removed: n });
}

// One sequence marker per caption: [{start, end, text}] in sequence seconds.
function cl_addMarkers(listJson) {
  var seq = cl_seq(); if (!seq) return cl_err("No sequence is open.");
  var list = cl_parse(listJson), n = 0;
  for (var i = 0; i < list.length; i++) {
    try {
      var m = seq.markers.createMarker(list[i].start);
      m.end = cl_time(list[i].end);
      m.name = String(list[i].text).replace(/\n/g, " ").substr(0, 60);
      m.comments = String(list[i].text);
      n++;
    } catch (e) {}
  }
  return cl_ok({ added: n });
}

// Play the sequence in Premiere Pro from a time (QE playback; Premiere has to be the active app).
function cl_play(sec) {
  var seq = cl_seq(); if (!seq) return cl_err("No sequence is open.");
  try { seq.setPlayerPosition(cl_ticks(sec)); app.enableQE(); qe.startPlayback(); return cl_ok({}); }
  catch (e) { return cl_err("Premiere Pro did not start playback: " + e); }
}
function cl_stop() {
  try { app.enableQE(); qe.stopPlayback(); return cl_ok({}); } catch (e) { return cl_err(e); }
}

function cl_setPlayhead(sec) {
  var seq = cl_seq(); if (!seq) return cl_err("No sequence is open.");
  try { seq.setPlayerPosition(cl_ticks(sec)); return cl_ok({}); } catch (e) { return cl_err(e); }
}
