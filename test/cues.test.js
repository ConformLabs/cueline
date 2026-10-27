const assert = require("assert"), C = require("../extension/js/cues.js");
const spec = { ...C.PRESETS.broadcast, fps: 25 };
const W = (s, t0, per) => s.split(" ").map((x, i) => ({ text: x, start: t0 + i * per, end: t0 + (i + 1) * per, p: 1 }));
let ok = 0; const t = (name, fn) => { fn(); ok++; console.log("ok", name); };

t("line break prefers the comma", () => {
  const c = C.buildCues(W("לפני שלוש שנים ישבנו במשרד קטן בתל אביב, עם מחשב אחד ורעיון אחד.", 0, 0.4), spec);
  assert.strictEqual(c.length, 1); assert.ok(c[0].text.split("\n")[0].endsWith("אביב,"), c[0].text);
});
t("fast caption is flagged and fixAll clears it", () => {
  const ws = W("one two three four five six seven eight nine ten eleven twelve", 0, 0.08).concat(W("Next.", 5, 0.4));
  let c = C.buildCues(ws, spec);
  assert.ok(C.checkCue(c[0], spec).some((i) => i.kind === "cps"));
  c = C.fixAll(c, spec);
  assert.strictEqual(C.summary(c, spec).toReview, 0, JSON.stringify(c.map(x=>[x.text,x.start,x.end])));
});
t("short caption merges with the next", () => {
  let c = C.buildCues(W("Hi.", 0, 0.3).concat(W("This is the rest of it.", 0.4, 0.3)), { ...spec, minDur: 1.0 });
  // Hi. ends a sentence, so it is its own cue, and stretched toward the next
  const before = c.length; c = C.fixMerge(c, c[0].id, spec);
  assert.strictEqual(c.length, before - 1); assert.ok(c[0].text.startsWith("Hi."));
});
t("gap between captions is kept in frames", () => {
  const c = C.buildCues(W("First one.", 0, 0.5).concat(W("Second one.", 1.0, 0.5)), spec);
  assert.ok(c[1].start - c[0].end >= 2 / 25 - 1e-9, `${c[0].end} ${c[1].start}`);
});
t("glossary replaces phrases and keeps punctuation", () => {
  const r = C.applyGlossary(W("we met in tel aviv, again", 0, 0.3), [{ from: "tel aviv", to: "Tel Aviv" }]);
  assert.strictEqual(r.words.map((w) => w.text).join(" "), "we met in Tel Aviv, again");
});
t("fillers are removed", () => {
  const r = C.removeFillers(W("so um I think אה yes", 0, 0.3), "he");
  assert.strictEqual(r.words.map((w) => w.text).join(" "), "so I think yes"); assert.strictEqual(r.removed.length, 2);
});
t("one word preset", () => {
  const c = C.buildCues(W("a b c", 0, 0.3), { ...C.PRESETS.oneword, fps: 25 }); assert.strictEqual(c.length, 3);
});
t("edit keeps id and timing, replaceAll counts", () => {
  let c = C.buildCues(W("hello world.", 0, 0.6), spec); const id = c[0].id, s = c[0].start;
  c = C.editText(c, id, "hello there."); assert.strictEqual(c[0].id, id); assert.strictEqual(c[0].start, s);
  const r = C.replaceAll(c, "there", "world"); assert.strictEqual(r.count, 1); assert.strictEqual(r.cues[0].text, "hello world.");
});
t("timecode at 25 and 29.97", () => {
  assert.strictEqual(C.timecode(72.16, 25), "00:01:12:04");
  assert.strictEqual(C.timecode(1, 29.97), "00:00:01:00");
});
t("punctuation-only words join the word before, or are dropped", () => {
  const ws = [{ text: ",", start: 0, end: 0.1 }, { text: "hello", start: 0.2, end: 0.5 }, { text: ",", start: 0.5, end: 0.6 }, { text: "world.", start: 0.7, end: 1 }];
  const c = C.buildCues(ws, spec); assert.strictEqual(c[0].text, "hello, world.");
});
t("snap: in-point moves to the speech onset, out-point to where speech stops", () => {
  // 10 ms frames: silence -70 dB, speech -20 dB from 1.00 s to 2.40 s
  const db = []; for (let i = 0; i < 400; i++) db.push(i >= 100 && i < 240 ? -20 : -70);
  const env = { hop: 0.01, db };
  // Whisper said 1.25 to 2.10: late start, early end
  const c = C.buildCues([{ text: "hello", start: 1.25, end: 1.6 }, { text: "there.", start: 1.6, end: 2.1 }], spec);
  const s = C.snapToSpeech(c, env, spec);
  assert.ok(Math.abs(s[0].start - 0.96) < 0.05, "start " + s[0].start);
  assert.ok(s[0].end >= 2.4 && s[0].end <= 2.6, "end " + s[0].end);
});
t("snap: start in silence moves forward to the word, never past it", () => {
  const db = []; for (let i = 0; i < 400; i++) db.push(i >= 150 && i < 250 ? -20 : -70);
  const c = C.buildCues([{ text: "late.", start: 1.35, end: 2.0 }], spec);
  const s = C.snapToSpeech(c, { hop: 0.01, db }, spec);
  assert.ok(s[0].start > 1.4 && s[0].start < 1.5, "start " + s[0].start);
});
t("snap: neighbours keep the frame gap", () => {
  const db = []; for (let i = 0; i < 500; i++) db.push(-20);  // continuous speech
  const c = C.buildCues([{ text: "One.", start: 0.5, end: 1.4 }, { text: "Two.", start: 1.5, end: 2.5 }], spec);
  const s = C.snapToSpeech(c, { hop: 0.01, db }, spec);
  assert.ok(s[1].start - s[0].end >= 2 / 25 - 1e-9, `${s[0].end} ${s[1].start}`);
});
t("snap: continuous speech, one word per caption, never piles captions up", () => {
  const db = []; for (let i = 0; i < 400; i++) db.push(i >= 50 ? -20 : -70);  // speech from 0.5 s, no pauses
  const words = "a b c d e f".split(" ").map((x, k) => ({ text: x, start: 0.6 + k * 0.3, end: 0.85 + k * 0.3 }));
  const ow = { ...C.PRESETS.oneword, fps: 25 };
  const s = C.snapToSpeech(C.buildCues(words, ow), { hop: 0.01, db }, ow);
  for (let k = 1; k < s.length; k++) assert.ok(s[k].start > s[k - 1].start, `caption ${k} starts at ${s[k].start}, before or with ${s[k - 1].start}`);
  assert.ok(s[0].start < 0.6, "first word can still reach back to the onset");
});
t("split at word and at time", () => {
  let c = C.buildCues(W("one two three four five six.", 0, 0.5), spec);
  const id = c[0].id;
  const a = C.splitAtWord(c, id, 2, spec);
  assert.deepStrictEqual(a.map((x) => x.text.replace(/\n/g, " ")), ["one two", "three four five six."]);
  assert.strictEqual(a[0].id, id); assert.ok(a[1].start >= a[0].end + 2 / 25 - 1e-9);
  const b = C.splitAtTime(c, id, 2.1, spec);
  assert.deepStrictEqual(b.map((x) => x.text.replace(/\n/g, " ")), ["one two three four five", "six."]);
});
t("fillers: marked, counted, dropped per caption or all, kept", () => {
  const ws = C.markFillers(W("so um I think. אה", 0, 0.4).concat(W("um yes, uh right.", 3, 0.4)), "he");
  let c = C.buildCues(ws, spec);
  assert.strictEqual(C.fillerCount(c), 4);
  assert.ok(c[0].text.includes("um"), "marked fillers stay in the text until removed");
  const one = C.dropFillers(c, spec, [c[c.length - 1].id]);
  assert.strictEqual(C.fillerCount(one), C.fillerCount(c) - 2);
  const all = C.dropFillers(c, spec);
  assert.strictEqual(C.fillerCount(all), 0);
  assert.ok(!all.some((x) => /\bum\b|אה/.test(x.text)), JSON.stringify(all.map((x) => x.text)));
  assert.ok(all.every((x) => x.text.trim()), "no empty captions");
  assert.strictEqual(C.fillerCount(C.keepFillers(c)), 0);
  assert.ok(C.keepFillers(c)[0].text.includes("um"), "kept fillers stay in the text");
});
t("line breaks: no line ends on a binding word (Hebrew and English)", () => {
  const cases = [
    "אני רוצה לספר לכם את הסיפור של החברה שלנו מההתחלה ועד הסוף",
    "היה לי מאוד קשה להגיע למצב שאני רוצה להתגייס לצבא",
    "לפני שלוש שנים ישבנו במשרד קטן עם מחשב אחד ורעיון אחד",
    "we went to the store with all of the people from the office",
    "I think the most important part of the story is the end",
  ];
  const bind = /(^|\s)(את|של|על|עם|שלוש|אחד|the|of|to|with|from|a|is)$/;
  for (const text of cases) {
    const c = C.buildCues(W(text, 0, 0.25), spec);
    for (const cue of c) for (const line of cue.text.split("\n").slice(0, -1)) assert.ok(!bind.test(line.trim()), `"${line}" ends on a binding word in: ${cue.text}`);
  }
});
t("line breaks: a number stays with its noun", () => {
  const c = C.buildCues(W("the team grew to 20 people in eight countries across the whole world", 0, 0.25), spec);
  for (const cue of c) assert.ok(!/(^|\s)20$/.test(cue.text.split("\n")[0].trim()), cue.text);
});
t("speakers: loudest track wins, new caption on a change, dialogue dashes", () => {
  // Two mics: track 0 loud for the first three words, track 1 loud after; each bleeds into the other at -40 dB.
  const env = (loudFrom, loudTo) => ({ hop: 0.01, db: Array.from({ length: 400 }, (_, f) => (f / 100 >= loudFrom && f / 100 < loudTo ? -15 : -40)) });
  const envs = [env(0, 1.5), env(1.5, 4)];
  const ws = W("Where were you? At the office.", 0, 0.5);
  const sp = C.assignSpeakers(ws, envs);
  assert.deepStrictEqual(sp.map((w) => w.spk), [0, 0, 0, 1, 1, 1]);
  const plain = C.buildCues(sp, spec);
  assert.strictEqual(plain.length, 2);
  const dash = C.buildCues(sp, { ...spec, dashes: true });
  assert.strictEqual(dash.length, 1); assert.strictEqual(dash[0].text, "- Where were you?\n- At the office.");
  // Bleed slightly louder than the speaker for one word does not flip it.
  const bleed = [env(0, 4), { hop: 0.01, db: Array.from({ length: 400 }, (_, f) => (f >= 100 && f < 150 ? -13 : -40)) }];
  assert.deepStrictEqual(C.assignSpeakers(ws, bleed).map((w) => w.spk), [0, 0, 0, 0, 0, 0]);
  // Streaming joins the pair at the end too.
  const st = new C.Stream({ ...spec, dashes: true });
  for (const w of sp) st.push(w);
  assert.strictEqual(st.finish().length, 1);
});
t("speakers by voice: blips fold into a neighbour, words follow the turns", () => {
  // Ron's clip, diarized with room for a blip: three people plus a 0.4 s blip at 20 s.
  const raw = [[0.031, 7.135, 0], [11.033, 62.975, 0], [20.264, 20.635, 1], [62.975, 80.761, 3], [80.761, 87.19, 2], [87.19, 89.08, 3], [93.569, 95.122, 2], [100.353, 109.87, 2], [109.87, 140.33, 0]]
    .map(([start, end, spk]) => ({ start, end, spk }));
  const t3 = C.tidyTurns(raw);
  assert.deepStrictEqual([...new Set(t3.map((t) => t.spk))], [0, 1, 2]);
  assert.ok(!t3.some((t) => t.start === 20.264), "blip folded");
  assert.deepStrictEqual(C.tidyTurns(raw, 2).map((t) => t.spk).filter((v, i, a) => a.indexOf(v) === i).length, 2);
  const ws = C.speakersFromTurns(W("a b c d", 79.9, 0.5), t3);
  assert.deepStrictEqual(ws.map((w) => w.spk), [1, 1, 2, 2]);
});
t("speakers by hand: change who says a caption, transcript names", () => {
  const ws = W("Where were you? At the office.", 0, 0.5).map((w, i) => ({ ...w, spk: i < 3 ? 0 : 1 }));
  let c = C.buildCues(ws, { ...spec, dashes: true });
  assert.strictEqual(c.length, 1); assert.ok(c[0].text.startsWith("- "));
  // The second line was really speaker 0 too: dashes go away.
  c = C.setSpeaker(c, c[0].id, 1, 0, spec);
  assert.ok(!c[0].text.includes("- "), c[0].text); assert.ok(c[0].words.every((w) => w.spk === 0));
  // And back, to a new speaker 2.
  c = C.setSpeaker(c, c[0].id, null, 2, spec);
  assert.strictEqual(C.toTranscript(c, { fps: 25, speakers: ["Noa", "Yair", "Dana"] }).trim(), "00:00:00:00  Dana: Where were you? At the office.");
  const d = C.buildCues(ws, { ...spec, dashes: true });
  assert.deepStrictEqual(C.toTranscript(d, { fps: 25, speakers: ["Noa", "Yair"] }).trim().split("\n").map((l) => l.split("  ")[1]), ["Noa: Where were you?", "Yair: At the office."]);
});
t("speaker colours in the SRT, one per line in a dialogue caption", () => {
  const ws = W("Where were you? At the office.", 0, 0.5).map((w, i) => ({ ...w, spk: i < 3 ? 0 : 1 }));
  const d = C.buildCues(ws, { ...spec, dashes: true });
  const srt = C.toSRT(d, { colors: ["#FFFFFF", "#FFE45C"] });
  assert.ok(srt.includes('<font color="#FFFFFF">- Where were you?</font>\n<font color="#FFE45C">- At the office.</font>'), srt);
  assert.ok(!C.toSRT(d, {}).includes("<font"));
});
t("one caption list per speaker; dialogue captions split back into lines", () => {
  const ws = W("Where were you? At the office. I see.", 0, 0.5).map((w, i) => ({ ...w, spk: i < 3 ? 0 : i < 6 ? 1 : 0 }));
  const cues = C.buildCues(ws, { ...spec, dashes: true });
  const [a, b] = C.splitBySpeaker(cues, spec, 2);
  assert.deepStrictEqual(a.map((c) => c.text), ["Where were you?", "I see."]);
  assert.deepStrictEqual(b.map((c) => c.text), ["At the office."]);
  assert.ok(b[0].start >= 1.5 - 1e-9, "second speaker's line starts with their words");
});
t("speakers: a sentence goes to the nearest voice print", () => {
  const ws = W("One two three. Four five six. Seven eight nine. Ten eleven twelve.", 0, 0.4).map((w, i) => ({ ...w, spk: i < 6 ? 0 : 1 }));
  const spans = C.sentenceSpans(ws);
  assert.strictEqual(spans.length, 4);
  // Sentence 2 sounds like speaker 1, though the diarizer said 0.
  const A = [1, 0, 0], B = [0, 1, 0];
  const out = C.refineSpeakers(ws, spans, [A, [0.1, 0.9, 0], B, B]);
  assert.deepStrictEqual(spans.map((sp) => out[sp.i0].spk), [0, 1, 1, 1]);
});
t("speakers: a hand-over moves to where the voices change, only when clearly better", () => {
  const ws = W("a b c d e f", 0, 0.5).map((w, i) => ({ ...w, spk: i < 3 ? 0 : 1 }));   // Whisper: change at 1.5 s
  const cands = C.cutCandidates(ws, 1, 1.2);
  assert.strictEqual(cands.length, 1);
  const A = [1, 0], B = [0, 1], centres = new Map([[0, A], [1, B]]);
  // Voices say the change is at 2.0 s: windows ending by 2.0 sound like A, starting at 2.0 or later like B.
  const prints = cands[0].ts.flatMap((t) => [t <= 2.0 + 1e-9 ? A : [0.7, 0.7], t >= 2.0 - 1e-9 ? B : [0.7, 0.7]]);
  const cuts = C.bestCuts(cands, prints, centres, 0.12);
  assert.deepStrictEqual(cuts, [{ i: 3, t: 2 }]);
  const moved = C.moveCuts(ws, cuts);
  assert.strictEqual(moved[2].end, 2); assert.strictEqual(moved[3].start, 2);
  assert.ok(moved[3].end >= moved[3].start + 0.1);
  // A close call stays put.
  assert.deepStrictEqual(C.bestCuts(cands, cands[0].ts.flatMap(() => [A, B]), centres, 0.12), []);
});
t("speakers: unsure sentences are flagged; fixing or confirming clears the flag", () => {
  const ws = W("One two three. Four five six. Seven eight nine.", 0, 0.4).map((w, i) => ({ ...w, spk: i < 3 ? 0 : 1 }));
  const spans = C.sentenceSpans(ws);
  const A = [1, 0], B = [0, 1];
  const out = C.refineSpeakers(ws, spans, [A, B, [0.68, 0.73]]);   // sentence 3: nearly as close to A
  assert.ok(out.slice(6).every((w) => w.spkAlt === 0), "flagged");
  assert.ok(out.slice(0, 6).every((w) => w.spkAlt == null));
  const cues = C.buildCues(out, spec);
  const issue = C.checkAll(cues, spec).flatMap((r) => r.issues).find((x) => x.kind === "speaker");
  assert.ok(issue && issue.alt === 0 && issue.from === 1);
  const id = cues.find((c) => c.words.some((w) => w.spkAlt != null)).id;
  assert.ok(!C.checkCue(C.confirmSpeaker(cues, id).find((c) => c.id === id), spec).some((x) => x.kind === "speaker"));
  const fixed = C.setSpeaker(cues, id, 1, 0, spec).find((c) => c.id === id);
  assert.ok(!C.checkCue(fixed, spec).some((x) => x.kind === "speaker"));
});
console.log(ok, "passed");
