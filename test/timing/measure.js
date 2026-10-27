const C = require("../../extension/js/cues.js"), E = require("../../extension/js/engine.js");
const words = require("./" + (process.argv[2] || "a_vad_dtw.json")).transcription.filter(s => s.text.trim() && !s.text.trim().startsWith("["))
  .map(s => ({ text: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000, p: 1 }));
const env16 = E.speechEnvelope(__dirname + "/clip48.wav"), env24 = E.speechEnvelope(__dirname + "/clip24st.wav");
const maxDiff = Math.max(...env16.db.map((v, i) => Math.abs(v - env24.db[i])));
console.log(`envelope frames ${env16.db.length}; 16-bit mono vs 24-bit stereo max diff ${maxDiff.toFixed(3)} dB`);
const spec = { ...C.PRESETS.broadcast, fps: 25 };
// independent reference: stricter threshold, no smoothing
const sorted = [...env16.db].sort((a, b) => a - b), ref = env16.db.map(d => d > sorted[Math.floor(sorted.length * 0.1)] + 14);
const F = t => Math.max(0, Math.min(ref.length - 1, Math.round(t / 0.01)));
const any = (a, b) => { for (let i = F(a); i <= F(b); i++) if (ref[i]) return true; return false; };
const frac = (a, b) => { let s = 0, n = 0; for (let i = F(a); i <= F(b); i++) { n++; s += ref[i]; } return n ? s / n : 0; };
function score(cues) {
  let early = 0, late = 0, cut = 0, linger = 0;
  cues.forEach((c, i) => {
    if (!any(c.start, c.start + 0.15)) early++;                                  // shows up before anyone speaks
    const prevEnd = i ? cues[i - 1].end : -1;
    if (c.start - 0.25 > prevEnd && frac(c.start - 0.25, c.start - 0.01) > 0.7) late++; // speech started well before it
    const nextStart = cues[i + 1] ? cues[i + 1].start : 1e9;
    if (nextStart - c.end > 0.3 && frac(c.end + 0.01, c.end + 0.2) > 0.7) cut++;   // speaker still talking when it goes
    if (!any(c.end - 0.7, c.end)) linger++;                                       // stays up long after speech
  });
  return { captions: cues.length, early, late, cutOff: cut, lingers: linger };
}
const before = C.buildCues(words, spec), after = C.snapToSpeech(before, env24, spec);
console.log("Whisper words only:", score(before));
console.log("Snapped to audio:  ", score(after));
const moves = after.map((c, i) => [Math.round((c.start - before[i].start) * 1000), Math.round((c.end - before[i].end) * 1000)]);
console.log("in-point moved (ms):", moves.map(m => m[0]).join(" "));
console.log("out-point moved (ms):", moves.map(m => m[1]).join(" "));
