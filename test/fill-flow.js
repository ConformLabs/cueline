const E = require("../extension/js/engine.js"), C = require("../extension/js/cues.js");
(async () => {
  const spec = { ...C.PRESETS.broadcast, fps: 25 };
  const st = new C.Stream(spec, (ws) => C.markFillers(ws, "en"));
  const r = await E.transcribe({ extRoot: __dirname + "/../extension", audio: __dirname + "/fill48.wav", model: "turbo", language: "en", vad: true }, { onWord: (w) => st.push(w) }).promise;
  let cues = C.snapToSpeech(st.finish(), E.speechEnvelope(__dirname + "/fill48.wav"), spec);
  console.log("marked:", C.fillerCount(cues), "|", cues.map((c) => c.text.replace(/\n/g, " / ")).join(" || "));
  const kept = C.keepFillers(cues, [cues[0].id]);
  console.log("keep first caption's:", C.fillerCount(kept), "left marked");
  const gone = C.dropFillers(cues, spec);
  console.log("removed all:", C.fillerCount(gone), "|", gone.map((c) => c.text.replace(/\n/g, " / ")).join(" || "));
})().catch((e) => { console.error(e); process.exit(1); });
