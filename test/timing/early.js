const C = require("../../extension/js/cues.js"), E = require("../../extension/js/engine.js");
const words = require("./a_vad_dtw.json").transcription.filter(s => s.text.trim() && !s.text.trim().startsWith("[")).map(s => ({ text: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000, p: 1 }));
const env = E.speechEnvelope(__dirname + "/clip48.wav"), spec = { ...C.PRESETS.broadcast, fps: 25 };
const sorted = [...env.db].sort((a, b) => a - b), floor = sorted[Math.floor(sorted.length * 0.1)];
const after = C.snapToSpeech(C.buildCues(words, spec), env, spec);
const { thr } = C.speechFrames(env, {});
console.log(`floor ${floor.toFixed(1)} dB, snap threshold ${thr.toFixed(1)}, strict reference ${(floor + 14).toFixed(1)}`);
for (const c of after) {
  const i = Math.round(c.start / 0.01);
  const win = env.db.slice(i - 10, i + 30).map(d => Math.round(d));
  if (!win.slice(10, 25).some(d => d > floor + 14)) console.log(c.start.toFixed(2), JSON.stringify(c.text.slice(0, 30)), "dB from -100ms:", win.join(" "));
}
