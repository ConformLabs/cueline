const E = require("../extension/js/engine.js"), C = require("../extension/js/cues.js");
const ext = require("path").join(__dirname, "../extension");
(async () => {
  console.log(E.engineStatus(ext));
  let n = 0; const t0 = Date.now();
  const job = E.transcribe({ extRoot: ext, audio: __dirname + "/he48.wav", model: "ivrit-turbo", language: "he", vad: true },
    { onWord: () => n++, onProgress: (p) => process.stdout.write(`p${Math.round(p*100)} `) });
  const r = await job.promise;
  console.log(`\nwords ${r.words.length} streamed ${n} lang ${r.language} in ${(Date.now()-t0)/1000}s`);
  const spec = { ...C.PRESETS.broadcast, fps: 25 };
  let w = C.applyGlossary(r.words, [{ from: "תל-אביב", to: "תל אביב" }]).words;
  let cues = C.buildCues(w, spec);
  for (const c of cues) console.log(C.timecode(c.start,25), "→", C.timecode(c.end,25), JSON.stringify(c.text), C.checkCue(c, spec).map(i=>i.label).join("; "));
  console.log(C.summary(cues, spec));
  const fixed = C.fixAll(cues, spec); console.log("after fixAll", C.summary(fixed, spec));
  console.log(C.toSRT(fixed.slice(0,2), { offset: 72.16, rtlFix: true }));
})().catch(e => { console.error("FAIL", e); process.exit(1); });
