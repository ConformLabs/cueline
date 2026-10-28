/* Cueline caption engine: words with timings in, captions out.
 * Pure functions, no Premiere and no DOM, so it runs the same in the panel and in Node tests.
 * Times are seconds from the start of the exported audio; `offset` moves them onto the sequence. */
(function (root) {
  "use strict";

  const PRESETS = {
    broadcast: { name: "Broadcast", maxChars: 42, maxLines: 2, maxCps: 17, minDur: 1.0, maxDur: 7.0, gapFrames: 2, oneWord: false },
    social:    { name: "Social",    maxChars: 24, maxLines: 1, maxCps: 20, minDur: 0.6, maxDur: 3.0, gapFrames: 0, oneWord: false },
    oneword:   { name: "One word",  maxChars: 32, maxLines: 1, maxCps: 99, minDur: 0.2, maxDur: 2.0, gapFrames: 0, oneWord: true },
  };

  const FILLERS = {
    he: ["אה", "אהה", "אממ", "אמ", "אמממ", "המ", "הממ"],
    en: ["um", "uh", "umm", "uhh", "er", "erm", "hmm", "mm"],
    any: [],
  };

  // Split before these when a caption must break (Hebrew single-letter prefixes are handled separately).
  const CLAUSE_STARTERS = new Set([
    "כי", "אם", "אבל", "אז", "כאשר", "בגלל", "למרות", "כמו", "אלא", "אשר", "עד", "כדי", "או",
    "and", "but", "because", "if", "when", "which", "who", "that", "although", "since", "while", "where", "or", "so",
  ]);
  // Words that bind to the word after them: a line or caption never ends on one (Netflix rule: no
  // line ending in an article, preposition or the like). Hebrew prefixes (ב ל מ ה ו ש) are attached
  // to their word already, so only free-standing words are listed.
  const BINDERS = new Set([
    "את", "של", "על", "עם", "אל", "מן", "בין", "כמו", "לפני", "אחרי", "אצל", "בלי", "בתוך", "ליד", "מול", "לגבי", "בשביל",
    "גם", "רק", "לא", "אין", "כל", "הכי", "יותר", "פחות", "עוד", "כבר", "פשוט", "ממש", "איזה", "אותו", "אותה", "זה", "זאת", "הזה", "הזאת",
    "אחד", "אחת", "שני", "שתי", "שלוש", "שלושה", "ארבע", "ארבעה", "חמש", "חמישה", "שש", "שישה", "שבע", "שבעה", "שמונה", "תשע", "תשעה", "עשר", "עשרה", "עשרים", "שלושים", "מאה", "אלף",
    "the", "a", "an", "of", "to", "in", "on", "at", "for", "with", "by", "from", "into", "onto", "about", "my", "your", "his", "her", "its", "our", "their",
    "this", "these", "those", "not", "no", "very", "so", "such", "some", "any", "every", "each", "i", "we", "you", "they", "he", "she", "it", "is", "are", "was", "were", "be",
  ]);
  const STRONG_END = /[.!?…؟]["'”’)]*$/;
  const WEAK_END = /[,;:—–-]["'”’)]*$/;
  const RTL_CHARS = /[֐-׿؀-ۿݐ-ݿיִ-﷿ﹰ-﻿]/;

  /* ---------- words ---------- */

  const PUNCT_ONLY = /^[\s.,!?;:…،؟"'“”‘’()\[\]–—-]+$/;

  function cleanWords(words) {
    const out = [];
    for (const raw of words) {
      const w = { ...raw, text: String(raw.text || "").trim(), start: +raw.start, end: +raw.end, p: raw.p == null ? 1 : +raw.p };
      if (!w.text || !isFinite(w.start) || !isFinite(w.end)) continue;
      // Whisper sometimes emits punctuation as its own word: attach it to the word before, or drop it.
      if (PUNCT_ONLY.test(w.text)) {
        if (out.length) { const prev = out[out.length - 1]; out[out.length - 1] = { ...prev, text: prev.text + w.text, end: Math.max(prev.end, w.end) }; }
        continue;
      }
      out.push(w.end <= w.start ? { ...w, end: w.start + 0.12 } : w);
    }
    return out;
  }

  function stripPunct(t) { return t.replace(/^[\s"'“”‘’(\[]+|[\s"'“”‘’)\].,!?;:…،؟-]+$/g, ""); }

  function removeFillers(words, lang) {
    const list = new Set([...(FILLERS[lang] || []), ...FILLERS.en, ...FILLERS.he]);
    const kept = [], removed = [];
    for (const w of words) (list.has(stripPunct(w.text).toLowerCase()) ? removed : kept).push(w);
    return { words: kept, removed };
  }

  // Mark fillers instead of deleting them, so the person decides (Premiere and Descript do the same).
  function markFillers(words, lang) {
    const list = new Set([...(FILLERS[lang] || []), ...FILLERS.en, ...FILLERS.he]);
    return words.map((w) => (list.has(stripPunct(w.text).toLowerCase()) ? { ...w, filler: true } : w));
  }

  function fillerCount(cues) {
    let n = 0; for (const c of cues) for (const w of c.words || []) if (w.filler) n++; return n;
  }

  // Remove marked fillers from the given captions (all when ids is null). A caption that held only
  // fillers goes; the others keep their timing and get their text rebuilt from the words left.
  function dropFillers(cues, spec, ids) {
    const only = ids ? new Set(ids) : null;
    const out = [];
    for (const c of cues) {
      if ((only && !only.has(c.id)) || !(c.words || []).some((w) => w.filler)) { out.push(c); continue; }
      const ws = c.words.filter((w) => !w.filler);
      if (!ws.length) continue;
      // Move a trailing sentence mark from a dropped last word onto the new last word.
      const last = c.words[c.words.length - 1];
      if (last.filler && /[.!?…]$/.test(last.text) && !/[.!?…,]$/.test(ws[ws.length - 1].text)) ws[ws.length - 1] = { ...ws[ws.length - 1], text: ws[ws.length - 1].text + last.text.slice(-1) };
      out.push({ ...c, words: ws, text: spec.oneWord ? joinText(ws) : breakLines(ws, spec) });
    }
    return out;
  }

  function keepFillers(cues, ids) {
    const only = ids ? new Set(ids) : null;
    return cues.map((c) => ((only && !only.has(c.id)) || !(c.words || []).some((w) => w.filler) ? c : { ...c, words: c.words.map((w) => (w.filler ? { ...w, filler: false } : w)) }));
  }

  // Glossary entries replace whole words or phrases, matched on the words without punctuation.
  function applyGlossary(words, glossary) {
    const terms = (glossary || []).filter((g) => g.from && g.to)
      .map((g) => ({ from: g.from.trim().split(/\s+/).map((s) => stripPunct(s).toLowerCase()), to: g.to.trim() }))
      .sort((a, b) => b.from.length - a.from.length);
    if (!terms.length) return { words, replaced: 0 };
    const out = []; let replaced = 0;
    for (let i = 0; i < words.length;) {
      let hit = null;
      for (const t of terms) {
        if (i + t.from.length > words.length) continue;
        if (t.from.every((f, k) => stripPunct(words[i + k].text).toLowerCase() === f)) { hit = t; break; }
      }
      if (!hit) { out.push(words[i]); i++; continue; }
      const span = words.slice(i, i + hit.from.length);
      const last = span[span.length - 1].text;
      const tail = (last.match(/[.,!?;:…،؟"'”’)]+$/) || [""])[0];
      out.push({ text: hit.to + tail, start: span[0].start, end: span[span.length - 1].end, p: 1, glossary: true });
      replaced++; i += hit.from.length;
    }
    return { words: out, replaced };
  }

  /* ---------- building captions ---------- */

  function joinText(ws) { return ws.map((w) => w.text).join(" "); }

  /* How good a break between ws[i-1] and ws[i] is, apart from length and balance. Shared by caption
   * splits and line breaks. Positive: punctuation, a new clause. Negative: a binding word left at the
   * end, or a number torn from its noun. */
  function breakQuality(ws, i) {
    const prev = ws[i - 1].text, next = ws[i].text;
    const pb = stripPunct(prev).toLowerCase(), nb = stripPunct(next).toLowerCase();
    let s = 0;
    if (STRONG_END.test(prev)) s += 60;
    else if (WEAK_END.test(prev)) s += 40;
    else {
      if (BINDERS.has(pb)) s -= 35;
      if (/^\d+([.,]\d+)?$/.test(pb)) s -= 35;
    }
    if (CLAUSE_STARTERS.has(nb)) s += 25;
    else if (RTL_CHARS.test(nb) && nb.length > 3) {
      if (/^(ש|כש|מש|וש|וכש)/.test(nb)) s += 12;   // relative and time clauses: ש..., כש...
      else if (/^ו/.test(nb)) s += 8;               // "and ...": ו + word
    }
    return s;
  }

  function splitScore(ws, i, spec) {
    const len = joinText(ws.slice(0, i)).length;
    const target = spec.maxChars * spec.maxLines * 0.8;
    let s = breakQuality(ws, i);
    const gap = ws[i].start - ws[i - 1].end;
    s += Math.min(gap, 1) * 40;
    s -= Math.abs(len - target) * 0.6;
    if (len > spec.maxChars * spec.maxLines) s -= 200;
    if (len < 8) s -= 30;
    return s;
  }

  // Split a run of words into captions that fit the spec's length and duration.
  function splitRun(ws, spec) {
    const out = [];
    let rest = ws;
    while (rest.length) {
      const text = joinText(rest);
      const dur = rest[rest.length - 1].end - rest[0].start;
      if (text.length <= spec.maxChars * spec.maxLines && dur <= spec.maxDur) { out.push(rest); break; }
      let best = 1, bestS = -Infinity;
      for (let i = 1; i < rest.length; i++) {
        const s = splitScore(rest, i, spec) - (rest[i - 1].end - rest[0].start > spec.maxDur ? 300 : 0);
        if (s > bestS) { bestS = s; best = i; }
      }
      out.push(rest.slice(0, best));
      rest = rest.slice(best);
    }
    return out;
  }

  // Break caption text into at most maxLines lines, balanced, preferring punctuation.
  function breakLines(ws, spec) {
    const text = joinText(ws);
    if (spec.maxLines < 2 || text.length <= spec.maxChars || ws.length < 2) return text;
    let best = 1, bestS = -Infinity;
    for (let i = 1; i < ws.length; i++) {
      const a = joinText(ws.slice(0, i)), b = joinText(ws.slice(i));
      let s = -Math.abs(a.length - b.length);
      if (a.length > spec.maxChars || b.length > spec.maxChars) s -= 100;
      s += breakQuality(ws, i) * 0.45; // a comma is worth about 18 characters of imbalance
      if (b.length > a.length) s += 1; // bottom-heavy reads better
      if (s > bestS) { bestS = s; best = i; }
    }
    return joinText(ws.slice(0, best)) + "\n" + joinText(ws.slice(best));
  }

  // Ids come from the first word's time, so rebuilding the same words gives the same ids and live
  // sync only sends what really changed.
  function wordId(w) { return "t" + Math.round(w.start * 1000); }

  function makeCue(ws, spec, id) {
    return {
      id: id || wordId(ws[0]),
      start: ws[0].start,
      end: ws[ws.length - 1].end,
      text: spec.oneWord ? ws.map((w) => w.text).join(" ") : dialogueText(ws, spec) || breakLines(ws, spec),
      words: ws,
    };
  }

  // Words from two speakers in one caption (a merge, or a dialogue pair): one line each, with dashes.
  function dialogueText(ws, spec) {
    if (spec.maxLines < 2) return null;
    const turns = [];
    for (let i = 1; i < ws.length; i++) if (speakerChange(ws[i - 1], ws[i])) turns.push(i);
    if (turns.length !== 1) return null;
    return "- " + joinText(ws.slice(0, turns[0])) + "\n- " + joinText(ws.slice(turns[0]));
  }

  /* ---------- speakers from separate audio tracks ----------
   * Each person on their own mic means the loudest track is who is talking. envs is one loudness
   * envelope per track ({hop, db}); a word goes to the track loudest over its span. The speaker only
   * switches when the new track wins clearly, so mic bleed and short overlaps don't flicker. */
  function trackLevel(env, a, b) {
    const fa = Math.max(0, Math.floor(a / env.hop)), fb = Math.min(env.db.length - 1, Math.max(fa, Math.ceil(b / env.hop)));
    let sum = 0, n = 0;
    for (let f = fa; f <= fb; f++) { sum += Math.pow(10, env.db[f] / 10); n++; }
    return n ? 10 * Math.log10(sum / n + 1e-12) : -120;
  }
  function speakerOf(w, envs, prev) {
    if (!envs || envs.length < 2) return null;
    const lv = envs.map((e) => trackLevel(e, w.start, w.end));
    let best = 0;
    for (let i = 1; i < lv.length; i++) if (lv[i] > lv[best]) best = i;
    if (lv[best] < -55) return prev ?? null;                        // too quiet everywhere to tell
    if (prev != null && prev !== best && lv[best] - lv[prev] < 6) return prev;
    return best;
  }
  function assignSpeakers(words, envs) {
    let prev = null;
    return words.map((w) => { const spk = speakerOf(w, envs, prev); prev = spk; return spk == null ? w : { ...w, spk }; });
  }
  /* Speakers by voice: the diarizer's turns [{start, end, spk}]. A voice heard for under minSecs in
   * all is a blip (a cough, a word of overlap), not a person: its turns go to the speaker next to them.
   * With want > 0 only the want most-heard voices stay. Speakers are renumbered in order of first
   * appearance, so "Speaker 1" is whoever talks first. */
  function tidyTurns(turns, want, minSecs) {
    minSecs = minSecs == null ? 1.5 : minSecs;
    let ts = turns.filter((t) => t.end > t.start).sort((a, b) => a.start - b.start).map((t) => ({ ...t }));
    const total = new Map();
    for (const t of ts) total.set(t.spk, (total.get(t.spk) || 0) + t.end - t.start);
    const ranked = [...total.keys()].sort((a, b) => total.get(b) - total.get(a));
    const keep = new Set(ranked.filter((k, i) => total.get(k) >= minSecs && (!want || i < want)));
    if (!keep.size && ranked.length) keep.add(ranked[0]);
    for (let i = 0; i < ts.length; i++) {
      if (keep.has(ts[i].spk)) continue;
      // the nearer kept neighbour in time
      let p = i - 1; while (p >= 0 && !keep.has(ts[p].spk)) p--;
      let n = i + 1; while (n < ts.length && !keep.has(ts[n].spk)) n++;
      const dp = p >= 0 ? ts[i].start - ts[p].end : Infinity, dn = n < ts.length ? ts[n].start - ts[i].end : Infinity;
      ts[i].spk = dp <= dn ? ts[p].spk : ts[n].spk;
    }
    const order = new Map();
    for (const t of ts) if (!order.has(t.spk)) order.set(t.spk, order.size);
    ts = ts.map((t) => ({ ...t, spk: order.get(t.spk) }));
    const out = [];
    for (const t of ts) { const l = out[out.length - 1]; if (l && l.spk === t.spk && t.start - l.end < 0.3) l.end = Math.max(l.end, t.end); else out.push(t); }
    return out;
  }
  // The speaker of one word: the turn it overlaps most, else the nearest turn within a second.
  function speakerAtTurns(w, turns, prev) {
    let best = null, bestOv = 0, near = null, nearD = 1;
    for (const t of turns) {
      if (t.start > w.end + 1) break;
      const ov = Math.min(w.end, t.end) - Math.max(w.start, t.start);
      if (ov > bestOv) { bestOv = ov; best = t.spk; }
      const d = Math.max(t.start - w.end, w.start - t.end);
      if (ov <= 0 && d < nearD) { nearD = d; near = t.spk; }
    }
    return best ?? near ?? prev ?? null;
  }
  function speakersFromTurns(words, turns) {
    let prev = null;
    const ws = words.map((w) => { const spk = speakerAtTurns(w, turns, prev); prev = spk; return spk == null ? w : { ...w, spk }; });
    return snapSpeakerChanges(ws);
  }
  /* The diarizer's change points can be a word or two off. People change at a sentence end or a
   * pause, so a change in mid-sentence moves to the nearest such boundary within 1.5 s. */
  function snapSpeakerChanges(ws, reach) {
    reach = reach || 1.5;
    const natural = (i) => STRONG_END.test(ws[i - 1].text) || ws[i].start - ws[i - 1].end > 0.4;
    for (let i = 1; i < ws.length; i++) {
      if (!(ws[i - 1].spk != null && ws[i].spk != null && ws[i - 1].spk !== ws[i].spk) || natural(i)) continue;
      let best = -1, bestD = Infinity;
      for (let j = Math.max(1, i - 12); j < Math.min(ws.length, i + 13); j++) {
        if (j === i || !natural(j)) continue;
        const d = Math.abs(ws[j].start - ws[i].start);
        if (d <= reach && d < bestD) { bestD = d; best = j; }
      }
      if (best < 0) continue;
      const a = ws[i - 1].spk, b = ws[i].spk;
      if (best > i) for (let k = i; k < best; k++) ws[k] = { ...ws[k], spk: a };
      else for (let k = best; k < i; k++) ws[k] = { ...ws[k], spk: b };
      i = Math.max(i, best);
    }
    return ws;
  }

  /* Second pass, sentence by sentence: the diarizer judges short slices of audio, so its changes can
   * land a sentence early or late. Each sentence gets a voice print (prints[i] for spans[i]), each
   * speaker a centre (the mean print of their sentences), and every sentence long enough to judge goes
   * to the nearest centre. Twice, so the centres settle. */
  function sentenceSpans(words) {
    const spans = [];
    let i0 = 0;
    for (let i = 1; i <= words.length; i++) {
      if (i === words.length || STRONG_END.test(words[i - 1].text) || words[i].start - words[i - 1].end > 0.4) {
        spans.push({ i0, i1: i, start: words[i0].start, end: words[i - 1].end });
        i0 = i;
      }
    }
    return spans;
  }
  const unitVec = (v) => { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return Array.from(v, (x) => x / n); };
  const dotVec = (a, b) => { let s2 = 0; for (let d = 0; d < a.length; d++) s2 += a[d] * b[d]; return s2; };
  // Each speaker's centre: the mean voice print of their sentences of a second or more.
  function speakerCentres(words, spans, prints) {
    const sum = new Map();
    spans.forEach((sp, i) => {
      const k = words[sp.i0].spk, v = prints[i];
      if (k == null || !v || sp.end - sp.start < 1) return;
      const u = unitVec(v), c = sum.get(k) || new Array(u.length).fill(0);
      u.forEach((x, d) => (c[d] += x)); sum.set(k, c);
    });
    const out = new Map(); for (const [k, c] of sum) out.set(k, unitVec(c));
    return out;
  }

  /* Where one speaker hands over to the next, Whisper's word times can be half a second off (music
   * under the voices hides the pause). cutCandidates gives, per change, times to try in 0.1 s steps
   * and the windows to print on each side; bestCuts scores them against the two speakers' centres
   * and keeps a new cut only when it is clearly better than Whisper's (gain >= minGain). */
  function cutCandidates(words, reach, win) {
    reach = reach || 1; win = win || 1.2;
    const out = [];
    for (let i = 1; i < words.length; i++) {
      const a = words[i - 1], b = words[i];
      if (a.spk == null || b.spk == null || a.spk === b.spk) continue;
      const mid = (a.end + b.start) / 2, ts = [];
      for (let k = -Math.round(reach * 10); k <= Math.round(reach * 10); k++) ts.push(+(mid + k / 10).toFixed(2));
      out.push({ i, a: a.spk, b: b.spk, mid, ts, spans: ts.flatMap((t) => [{ start: Math.max(0, t - win), end: t }, { start: t, end: t + win }]) });
    }
    return out;
  }
  function bestCuts(cands, prints, centres, minGain) {
    minGain = minGain == null ? 0.12 : minGain;
    let at = 0;
    return cands.map((c) => {
      const p = prints.slice(at, at + c.spans.length); at += c.spans.length;
      const ca = centres.get(c.a), cb = centres.get(c.b);
      if (!ca || !cb) return null;
      const score = c.ts.map((t, k) => (p[2 * k] ? dotVec(unitVec(p[2 * k]), ca) : 0) + (p[2 * k + 1] ? dotVec(unitVec(p[2 * k + 1]), cb) : 0));
      let best = 0; score.forEach((v, k) => { if (v > score[best]) best = k; });
      const here = score[c.ts.findIndex((t) => Math.abs(t - c.mid) < 0.051)] ?? -Infinity;
      return score[best] - here >= minGain ? { i: c.i, t: c.ts[best] } : null;
    }).filter(Boolean);
  }
  // Move the hand-over between words[i-1] and words[i] to time t: words on the wrong side of it
  // are pulled to it, each keeping at least 0.1 s.
  function moveCuts(words, cuts) {
    const ws = words.slice();
    for (const { i, t } of cuts) {
      for (let k = i - 1; k >= 0 && ws[k].spk === ws[i - 1].spk; k--) {
        if (ws[k].end <= t && k < i - 1) break;
        const end = k === i - 1 ? t : Math.min(ws[k].end, t);
        ws[k] = { ...ws[k], end: Math.max(end, ws[k].start + 0.1), start: Math.min(ws[k].start, Math.max(end, ws[k].start + 0.1) - 0.1) };
      }
      for (let k = i; k < ws.length && ws[k].spk === ws[i].spk; k++) {
        if (ws[k].start >= t && k > i) break;
        const start = k === i ? t : Math.max(ws[k].start, t);
        ws[k] = { ...ws[k], start, end: Math.max(ws[k].end, start + 0.1) };
      }
    }
    return ws;
  }

  function refineSpeakers(words, spans, prints, minSecs) {
    minSecs = minSecs || 0.8;
    const unit = (v) => { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return Array.from(v, (x) => x / n); };
    const P = prints.map((v) => (v ? unit(v) : null));
    const label = spans.map((sp) => {
      const n = new Map(); for (let i = sp.i0; i < sp.i1; i++) if (words[i].spk != null) n.set(words[i].spk, (n.get(words[i].spk) || 0) + 1);
      let k = null, most = 0; for (const [s2, v] of n) if (v > most) { most = v; k = s2; }
      return k;
    });
    const judge = spans.map((sp, i) => P[i] && sp.end - sp.start >= minSecs && label[i] != null);
    for (let round = 0; round < 2; round++) {
      const sum = new Map();
      spans.forEach((sp, i) => {
        if (!judge[i]) return;
        const c = sum.get(label[i]) || { v: new Array(P[i].length).fill(0) };
        P[i].forEach((x, d) => (c.v[d] += x)); sum.set(label[i], c);
      });
      const centres = [...sum].map(([k, c]) => ({ k, v: unit(c.v) }));
      if (centres.length < 2) break;
      spans.forEach((sp, i) => {
        if (!judge[i]) return;
        let best = label[i], bestS = -2;
        for (const c of centres) { let s3 = 0; for (let d = 0; d < c.v.length; d++) s3 += c.v[d] * P[i][d]; if (s3 > bestS) { bestS = s3; best = c.k; } }
        label[i] = best;
      });
    }
    const out = words.slice();
    spans.forEach((sp, i) => { if (judge[i]) for (let w = sp.i0; w < sp.i1; w++) out[w] = { ...out[w], spk: label[i] }; });
    // Flag sentences whose voice is nearly as close to someone else: margin under `unsure` between
    // their own speaker's centre and the next nearest. w.spkAlt names that other speaker.
    const centres = speakerCentres(out, spans, prints), unsure = 0.3;
    if (centres.size > 1) spans.forEach((sp, i) => {
      const k = out[sp.i0].spk; if (!P[i] || k == null || !centres.has(k)) return;
      const own = dotVec(P[i], centres.get(k));
      let alt = null, altS = -2; for (const [j, c] of centres) if (j !== k) { const v = dotVec(P[i], c); if (v > altS) { altS = v; alt = j; } }
      if (own - altS < unsure) for (let w = sp.i0; w < sp.i1; w++) out[w] = { ...out[w], spkAlt: alt };
    });
    return out;
  }

  const speakerChange = (a, b) => a.spk != null && b.spk != null && a.spk !== b.spk;
  // Where a new run starts: a sentence end, a pause, or a new speaker.
  const runBreak = (prev, w) => STRONG_END.test(prev.text) || w.start - prev.end > 0.7 || speakerChange(prev, w);

  /* Two short lines from different speakers, back to back, read best as one dialogue caption:
   * "- line one\n- line two" (Netflix style), instead of two flashes. */
  function joinDialogue(cues, spec) {
    if (!spec.dashes || spec.maxLines < 2 || spec.oneWord) return cues;
    const out = [];
    for (let i = 0; i < cues.length; i++) {
      const a = cues[i], b = cues[i + 1];
      const wa = a.words || [], wb = (b && b.words) || [];
      if (b && !a.edited && !b.edited && !a.dialogue && !b.dialogue && wa.length && wb.length && speakerChange(wa[wa.length - 1], wb[0]) &&
          joinText(wa).length + 2 <= spec.maxChars && joinText(wb).length + 2 <= spec.maxChars &&
          b.start - a.end < 0.5 && b.end - a.start <= spec.maxDur) {
        out.push({ ...makeCue(wa.concat(wb), spec, a.id), start: a.start, end: b.end, dialogue: true });
        i++;
      } else out.push(a);
    }
    return out;
  }

  function buildCues(words, spec) {
    const ws = cleanWords(words);
    if (!ws.length) return [];
    if (spec.oneWord) return timeCues(ws.map((w) => makeCue([w], spec)), spec);
    // 1. runs: break on sentence ends and on pauses
    const runs = []; let cur = [];
    for (const w of ws) {
      if (cur.length) {
        const prev = cur[cur.length - 1];
        if (runBreak(prev, w)) { runs.push(cur); cur = []; }
      }
      cur.push(w);
    }
    if (cur.length) runs.push(cur);
    // 2. each run into captions
    const cues = [];
    for (const r of runs) for (const part of splitRun(r, spec)) cues.push(makeCue(part, spec));
    return timeCues(joinDialogue(cues, spec), spec);
  }

  /* While words stream in, captions whose sentence has ended are frozen: they no longer change when
   * more words arrive, so the person can edit them during transcription. Only the tail (the run still
   * being spoken) is rebuilt on each word. prep(words) applies fillers and glossary to the tail. */
  function Stream(spec, prep) {
    this.spec = spec;
    this.prep = prep || ((ws) => ws);
    this.final = [];
    this.tailWords = [];
    this.tail = [];
  }
  Stream.prototype.push = function (w) {
    this.tailWords.push(w);
    const ws = this.tailWords;
    // Freeze everything before the last run break (sentence end or pause).
    let cut = -1;
    for (let i = ws.length - 1; i > 0; i--) {
      if (runBreak(ws[i - 1], ws[i])) { cut = i; break; }
    }
    if (cut > 0) {
      const done = buildCues(this.prep(ws.slice(0, cut)), this.spec);
      this.final = timeCues(this.final.concat(done), this.spec);
      this.tailWords = ws.slice(cut);
    }
    this.tail = buildCues(this.prep(this.tailWords), this.spec);
    return this.all();
  };
  Stream.prototype.finish = function () {
    // Speaker changes freeze captions one at a time, so dialogue pairs are joined at the end.
    this.final = timeCues(joinDialogue(this.final.concat(this.tail), this.spec), this.spec);
    this.tail = []; this.tailWords = [];
    return this.final;
  };
  Stream.prototype.all = function () { return this.final.concat(this.tail); };
  Stream.prototype.isTail = function (id) { return this.tail.some((c) => c.id === id); };

  /* ---------- timing ---------- */

  function snap(t, fps) { return Math.round(t * fps) / fps; }

  // Snap to frames, keep the gap, and stretch short captions into the silence after them.
  function timeCues(cues, spec) {
    const fps = spec.fps || 25;
    const gap = (spec.gapFrames || 0) / fps;
    const out = cues.map((c) => ({ ...c, start: snap(c.start, fps), end: snap(c.end, fps) }));
    for (let i = 0; i < out.length; i++) {
      const c = out[i], next = out[i + 1];
      const limit = next ? next.start - gap : Infinity;
      if (c.end - c.start < spec.minDur) c.end = Math.min(c.start + spec.minDur, limit);
      if (c.end > limit) c.end = limit;
      if (c.end <= c.start) c.end = c.start + 1 / fps;
      c.end = snap(c.end, fps);
    }
    return out;
  }

  /* ---------- timing from the audio ----------
   * Whisper says which words a caption holds; the audio says when they are spoken. env is
   * {hop: seconds per frame, db: loudness per frame}. Each caption's in-point moves to the speech
   * onset nearest its first word, its out-point to where the speech after its last word stops. */

  function speechFrames(env, o) {
    const db = env.db, n = db.length;
    const sorted = Array.from(db).sort((a, b) => a - b);
    const floor = sorted[Math.floor(n * 0.1)] || -90;
    const thr = Math.max(floor + (o.aboveFloor || 10), o.minDb || -55);
    const sp = new Uint8Array(n);
    for (let i = 0; i < n; i++) sp[i] = db[i] > thr ? 1 : 0;
    // Close gaps shorter than a stop consonant, drop blips shorter than a syllable.
    const fill = Math.round((o.fillGap || 0.08) / env.hop), blip = Math.round((o.minBlip || 0.05) / env.hop);
    for (let i = 0; i < n;) {
      if (sp[i]) { i++; continue; }
      let j = i; while (j < n && !sp[j]) j++;
      if (i > 0 && j < n && j - i <= fill) sp.fill(1, i, j);
      i = j;
    }
    for (let i = 0; i < n;) {
      if (!sp[i]) { i++; continue; }
      let j = i; while (j < n && sp[j]) j++;
      if (j - i < blip) sp.fill(0, i, j);
      i = j;
    }
    return { sp, thr, floor };
  }

  function snapToSpeech(cues, env, spec, opts) {
    if (!env || !env.db || !env.db.length || !cues.length) return cues;
    const o = { back: 0.4, ahead: 0.25, hold: 0.5, endBack: 0.3, lead: 0.04, tail: 0.12, ...(opts || {}) };
    const { sp } = speechFrames(env, o);
    const h = env.hop, n = sp.length;
    const f = (t) => Math.max(0, Math.min(n - 1, Math.round(t / h)));
    const wordsOf = (c) => (c && c.words && c.words.length ? c.words : c ? [{ start: c.start, end: c.end }] : null);
    const out = cues.map((c, i) => {
      if (c.snapped) return c; // already timed from the audio; snapping again would nudge it
      const ws = wordsOf(c);
      const firstEnd = ws[0].end, lastStart = ws[ws.length - 1].start;
      // Only the silence between captions is used: never reach back past the previous caption's last
      // word, or forward past the next caption's first word (continuous speech has no edge to find).
      const pw = wordsOf(cues[i - 1]), nw = wordsOf(cues[i + 1]);
      const floorStart = pw ? pw[pw.length - 1].end : 0, capEnd = nw ? nw[0].start : Infinity;
      // in-point
      let s = f(c.start), start = c.start;
      if (sp[s]) {
        let k = s; while (k > 0 && sp[k - 1] && (s - k) * h < o.back) k--;
        if ((s - k) * h < o.back) start = k * h;             // found the onset inside the window
      } else {
        let k = s; while (k < n - 1 && !sp[k] && (k - s) * h < o.ahead) k++;
        if (sp[k]) start = k * h;                            // the word starts a little later than Whisper said
      }
      start = Math.min(Math.max(floorStart, start - o.lead), firstEnd - 0.05);
      // out-point
      let e = f(c.end), end = c.end;
      if (sp[e]) {
        let k = e; while (k < n - 1 && sp[k + 1] && (k - e) * h < o.hold) k++;
        end = (k + 1) * h;                                   // speech runs on past Whisper's end
      } else {
        let k = e; while (k > 0 && !sp[k] && (e - k) * h < o.endBack) k--;
        if (sp[k]) end = (k + 1) * h;                        // Whisper's end sat in the silence after the word
      }
      end = Math.min(Math.max(end + o.tail, lastStart + 0.1), Math.max(capEnd, c.end));
      return { ...c, start, end, snapped: true };
    });
    // Neighbours must not overlap before frame snapping and gaps.
    for (let i = 0; i < out.length - 1; i++) if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
    return timeCues(out, spec);
  }

  /* ---------- shot changes ----------
   * A caption that starts or ends a few frames off a cut flashes across it. Within `frames` (12, the
   * Netflix window) of a cut, the in-point moves onto the cut and the out-point to the cut less the
   * style's gap. `cuts` are seconds on the same clock as the captions. Captions never move so far
   * that their first or last word is hidden, never overlap, and never drop under half a second. */
  function snapToCuts(cues, cuts, spec, opts) {
    if (!cuts || !cuts.length || !cues.length) return cues;
    const fps = spec.fps || 25, o = { frames: 12, ...(opts || {}) };
    const win = o.frames / fps + 1e-6, gap = (spec.gapFrames || 0) / fps;
    const near = (t) => { let best = null; for (const k of cuts) if (Math.abs(k - t) <= win && (best == null || Math.abs(k - t) < Math.abs(best - t))) best = k; return best; };
    const out = cues.map((c) => ({ ...c }));
    for (let i = 0; i < out.length; i++) {
      const c = out[i], prev = out[i - 1], next = cues[i + 1];
      const ws = c.words && c.words.length ? c.words : [{ start: c.start, end: c.end }];
      const k = near(c.start);
      if (k != null && Math.abs(k - c.start) > 1e-6) {
        const later = k > c.start;
        if (later ? k <= ws[0].end - 0.1 && c.end - k >= 0.5 : !prev || k >= prev.end + gap) { c.start = snap(k, fps); c.cutIn = true; }
      } else if (k != null) c.cutIn = true;
      const e = near(c.end);
      if (e != null) {
        const target = snap(e - gap, fps);
        const earlier = target < c.end;
        const fits = earlier ? target >= ws[ws.length - 1].start + 0.15 && target - c.start >= 0.5 : !next || target <= Math.max(next.start, e) - gap;
        if (fits && Math.abs(target - c.end) > 1e-6) { c.end = target; c.cutOut = true; } else if (Math.abs(target - c.end) <= 1e-6) c.cutOut = true;
      }
    }
    for (let i = 0; i < out.length - 1; i++) if (out[i].end > out[i + 1].start - gap) out[i].end = Math.max(out[i].start + 1 / fps, snap(out[i + 1].start - gap, fps));
    // Marked only where the caption really sits on a cut after all of that.
    const on = (t) => cuts.some((k) => Math.abs(k - t) < 0.5 / fps);
    for (const c of out) { c.cutIn = on(c.start); c.cutOut = on(c.end + gap); }
    return out;
  }
  // How many captions sit on a cut (for the review summary).
  function cutCount(cues) { return cues.reduce((n, c) => n + (c.cutIn || c.cutOut ? 1 : 0), 0); }

  /* ---------- animated captions ----------
   * When each word of a caption is spoken, as the template counts words (split on spaces, the
   * dialogue dash dropped). Captions whose text was edited keep their word timings when the word
   * count still matches; otherwise the caption's time is shared out by word length. */
  function wordBeats(c) {
    const text = c.text.replace(/^- /gm, "").replace(/\s+/g, " ").trim();
    const words = text ? text.split(" ") : [];
    const ws = (c.words || []).filter((w) => w.text && w.text.trim());
    if (ws.length === words.length) return { text, beats: ws.map((w, i) => ({ t: Math.max(0, Math.min(w.start, c.end) - c.start), spk: w.spk == null ? null : w.spk, word: words[i] })) };
    const total = words.reduce((n, w) => n + w.length + 1, 0) || 1;
    let acc = 0;
    return { text, beats: words.map((w) => { const t = ((c.end - c.start) * acc) / total; acc += w.length + 1; return { t, spk: ws.length ? ws[0].spk : null, word: w }; }) };
  }

  /* ---------- a transcript for producers ----------
   * Paragraphs by speaker: a new one when the speaker changes, after a pause, or every `maxDur`
   * seconds so the timecodes stay useful for a paper edit. Dialogue captions are split by voice. */
  function transcriptTurns(cues, opts) {
    const o = { pause: 4, maxDur: 40, ...(opts || {}) }, out = [];
    const push = (start, end, spk, text) => {
      const last = out[out.length - 1];
      if (last && last.spk === spk && start - last.end < o.pause && end - last.start <= o.maxDur) { last.text += " " + text; last.end = end; }
      else out.push({ start, end, spk, text });
    };
    for (const c of cues) {
      const ws = c.words || [], runs = [];
      for (const w of ws) { const r = runs[runs.length - 1]; if (r && r.spk === w.spk) r.ws.push(w); else runs.push({ spk: w.spk, ws: [w] }); }
      if (runs.length > 1 && !c.edited) for (const r of runs) push(r.ws[0].start, r.ws[r.ws.length - 1].end, r.spk ?? null, joinText(r.ws));
      else push(c.start, c.end, runs.length ? runs[0].spk ?? null : null, c.text.replace(/^- /gm, "").replace(/\n/g, " "));
    }
    return out;
  }

  /* ---------- checks and fixes ---------- */

  function cps(c) { return c.text.replace(/\s+/g, "").length / Math.max(c.end - c.start, 0.001); }

  function checkCue(c, spec) {
    const issues = [];
    const d = c.end - c.start;
    const lines = c.text.split("\n");
    const rate = cps(c);
    if (!spec.oneWord && rate > spec.maxCps + 0.05) {
      const chars = c.text.replace(/\s+/g, "").length;
      const moreTime = chars / spec.maxCps - d, fewer = Math.ceil(chars - spec.maxCps * d);
      issues.push({ kind: "cps", label: `${Math.round(rate)} cps · max ${spec.maxCps}`, hint: `needs +${moreTime.toFixed(1)} s or −${fewer} chars`, fixes: ["split", "extend"] });
    }
    if (d < spec.minDur - 0.01) issues.push({ kind: "short", label: `${d.toFixed(1)} s · min ${spec.minDur.toFixed(1)}`, fixes: ["merge", "extend"] });
    if (d > spec.maxDur + 0.01) issues.push({ kind: "long", label: `${d.toFixed(1)} s · max ${spec.maxDur.toFixed(1)}`, fixes: ["split"] });
    if (lines.length > spec.maxLines) issues.push({ kind: "lines", label: `${lines.length} lines · max ${spec.maxLines}`, fixes: ["split"] });
    const longest = Math.max(...lines.map((l) => l.length));
    if (longest > spec.maxChars) issues.push({ kind: "chars", label: `${longest} chars · max ${spec.maxChars}`, fixes: ["split"] });
    const unsure = (c.words || []).find((w) => w.spkAlt != null && w.spkAlt !== w.spk);
    if (unsure) issues.push({ kind: "speaker", label: "Speaker unsure", fixes: ["spkalt", "spkok"], from: unsure.spk, alt: unsure.spkAlt });
    const low = (c.words || []).filter((w) => w.p < 0.5 && !w.glossary);
    if (low.length) issues.push({ kind: "conf", label: `Low confidence · ${low.length} word${low.length > 1 ? "s" : ""}`, fixes: ["glossary"], words: low.map((w) => stripPunct(w.text)), ps: low.map((w) => w.p) });
    return issues;
  }

  function checkAll(cues, spec) {
    return cues.map((c) => ({ id: c.id, issues: checkCue(c, spec) }));
  }

  // The latest end a caption can stretch to without crowding the next one.
  function extendLimit(cues, i, spec) {
    const fps = spec.fps || 25, next = cues[i + 1];
    const need = cues[i].start + Math.max(spec.minDur, cues[i].text.replace(/\s+/g, "").length / spec.maxCps);
    const cap = next ? next.start - (spec.gapFrames || 0) / fps : need;
    return snap(Math.min(need, cap, cues[i].start + spec.maxDur), fps);
  }

  function fixExtend(cues, id, spec) {
    const i = cues.findIndex((c) => c.id === id); if (i < 0) return cues;
    const out = cues.slice(); out[i] = { ...out[i], end: Math.max(out[i].end, extendLimit(cues, i, spec)) };
    return out;
  }

  function fixSplit(cues, id, spec) {
    const i = cues.findIndex((c) => c.id === id); if (i < 0) return cues;
    const c = cues[i];
    if (!c.words || c.words.length < 2) return cues;
    let best = 1, bestS = -Infinity;
    for (let k = 1; k < c.words.length; k++) {
      const s = splitScore(c.words, k, { ...spec, maxLines: 1, maxChars: joinText(c.words).length / 2 / 0.8 });
      if (s > bestS) { bestS = s; best = k; }
    }
    const a = makeCue(c.words.slice(0, best), spec, c.id), b = makeCue(c.words.slice(best), spec);
    const out = cues.slice(0, i).concat([a, b], cues.slice(i + 1));
    return timeCues(out, spec);
  }

  function fixMerge(cues, id, spec) {
    const i = cues.findIndex((c) => c.id === id); if (i < 0) return cues;
    const j = i + 1 < cues.length ? i + 1 : i - 1; if (j < 0) return cues;
    const [a, b] = i < j ? [cues[i], cues[j]] : [cues[j], cues[i]];
    const merged = makeCue([...(a.words || []), ...(b.words || [])], spec, a.id);
    merged.start = a.start; merged.end = b.end;
    const lo = Math.min(i, j);
    return timeCues(cues.slice(0, lo).concat([merged], cues.slice(lo + 2)), spec);
  }

  // Split before word k (1..n-1): the first part keeps the id, both get their times from their words.
  function splitAtWord(cues, id, k, spec) {
    const i = cues.findIndex((c) => c.id === id); if (i < 0) return cues;
    const c = cues[i], ws = c.words || [];
    if (ws.length < 2) return cues;
    k = Math.max(1, Math.min(ws.length - 1, k));
    const a = makeCue(ws.slice(0, k), spec, c.id), b = makeCue(ws.slice(k), spec);
    if (b.id === a.id) b.id = c.id + "s";
    a.start = Math.min(a.start, c.start);
    return timeCues(cues.slice(0, i).concat([a, b], cues.slice(i + 1)), spec);
  }

  // Split at a time inside the caption: the words that start at or after t go to the second part.
  function splitAtTime(cues, id, t, spec) {
    const c = cues.find((x) => x.id === id); if (!c || !c.words || c.words.length < 2) return cues;
    let k = c.words.findIndex((w) => w.start >= t);
    if (k < 0) k = c.words.length - 1;
    return splitAtWord(cues, id, k, spec);
  }

  // Move one edge of a caption (person-set times are kept: `snapped` stops audio snapping moving them).
  function setTime(cues, id, edge, t, spec) {
    const i = cues.findIndex((c) => c.id === id); if (i < 0) return cues;
    const fps = spec.fps || 25, gap = (spec.gapFrames || 0) / fps, minLen = 1 / fps;
    const c = cues[i], prev = cues[i - 1], next = cues[i + 1];
    t = snap(t, fps);
    let start = c.start, end = c.end;
    if (edge === "in") start = Math.max(prev ? prev.end + gap : 0, Math.min(t, end - minLen));
    else end = Math.min(next ? next.start - gap : Infinity, Math.max(t, start + minLen));
    const out = cues.slice(); out[i] = { ...c, start: snap(start, fps), end: snap(end, fps), snapped: true, timed: true };
    return out;
  }

  // Problems an automatic fix can solve (low confidence needs a person, so it does not count).
  const FIXABLE = new Set(["cps", "short", "long", "lines", "chars"]);
  function fixScore(cues, spec) {
    let n = 0;
    for (const c of cues) for (const x of checkCue(c, spec)) if (FIXABLE.has(x.kind)) n++;
    return n;
  }

  /* Greedy: for each caption that breaks the spec, try extend, merge and split, keep the candidate that
   * lowers the total number of problems, repeat until nothing helps. post(cues) runs on every candidate
   * before it is scored (the panel snaps new captions to the audio there). */
  function fixAll(cues, spec, post) {
    const tidy = post || ((x) => x);
    let cur = cues, score = fixScore(cur, spec);
    const tried = new Set();
    for (let guard = 0; guard < cues.length * 4 + 10 && score > 0; guard++) {
      const target = cur.find((c) => !tried.has(c.id) && checkCue(c, spec).some((x) => FIXABLE.has(x.kind)));
      if (!target) break;
      const kinds = checkCue(target, spec).map((x) => x.kind);
      const tries = [];
      if (kinds.includes("cps") || kinds.includes("short")) tries.push(() => fixExtend(cur, target.id, spec));
      if (kinds.includes("short") || kinds.includes("cps")) tries.push(() => fixMerge(cur, target.id, spec));
      if (kinds.some((k) => k === "cps" || k === "long" || k === "lines" || k === "chars")) tries.push(() => fixSplit(cur, target.id, spec));
      let best = null, bestScore = score;
      for (const make of tries) {
        const cand = tidy(make());
        if (cand === cur) continue;
        const sc = fixScore(cand, spec);
        if (sc < bestScore) { best = cand; bestScore = sc; }
      }
      if (best) { cur = best; score = bestScore; tried.clear(); }
      else tried.add(target.id);
    }
    return cur;
  }

  // What Fix all would do, without doing it: how many problems it solves and how many stay.
  function fixPreview(cues, spec, post) {
    const before = fixScore(cues, spec), fixed = fixAll(cues, spec, post), after = fixScore(fixed, spec);
    return { cues: fixed, solved: before - after, left: after };
  }

  // An edit in the panel: new text keeps the timing; words are re-derived so later fixes still work.
  function editText(cues, id, text) {
    return cues.map((c) => {
      if (c.id !== id) return c;
      const tokens = text.split(/\s+/).filter(Boolean);
      const span = c.end - c.start, n = tokens.length || 1;
      const words = tokens.map((t, k) => ({ text: t, start: c.start + (span * k) / n, end: c.start + (span * (k + 1)) / n, p: 1 }));
      return { ...c, text, words, edited: true };
    });
  }

  function replaceAll(cues, find, repl) {
    if (!find) return { cues, count: 0 };
    let count = 0;
    const out = cues.map((c) => {
      const parts = c.text.split(find);
      if (parts.length < 2) return c;
      count += parts.length - 1;
      return editText([c], c.id, parts.join(repl).replace(/[ \t]+/g, " "))[0];
    });
    return { cues: out, count };
  }

  /* ---------- output ---------- */

  function isRtl(text) { return RTL_CHARS.test(text); }

  // Premiere lays out SRT lines left to right, so trailing punctuation jumps to the start of a
  // Hebrew or Arabic line. A right-to-left mark at both ends keeps it where it belongs.
  /* One caption list per speaker, for one caption track each. A dialogue caption splits back into its
   * speakers' lines, each timed by its own words; any other caption goes to whoever says most of it.
   * Captions with no speaker go with speaker 0. */
  function splitBySpeaker(cues, spec, count) {
    const out = Array.from({ length: Math.max(1, count || 0) }, () => []);
    const put = (k, c) => { while (out.length <= k) out.push([]); out[k].push(c); };
    for (const c of cues) {
      const ws = c.words || [], runs = [];
      for (const w of ws) { const r = runs[runs.length - 1]; if (r && r.spk === w.spk) r.ws.push(w); else runs.push({ spk: w.spk, ws: [w] }); }
      const lines = c.text.split("\n");
      if (runs.length > 1 && runs.length === lines.length && /^- /.test(c.text)) {
        runs.forEach((r, k) => put(r.spk ?? 0, { id: c.id + "_" + k, start: k ? r.ws[0].start : c.start, end: k === runs.length - 1 ? c.end : r.ws[r.ws.length - 1].end, text: lines[k].replace(/^- /, ""), words: r.ws }));
        continue;
      }
      const n = new Map(); for (const w of ws) n.set(w.spk ?? 0, (n.get(w.spk ?? 0) || 0) + 1);
      let k = 0, most = -1; for (const [s2, v] of n) if (v > most) { most = v; k = s2; }
      put(k, c);
    }
    return out.map((list) => (spec ? timeCues(list, spec) : list));
  }

  // Who says each line of a caption: a dialogue caption has one speaker per line, others one for all.
  function lineSpeakers(c, n) {
    const runs = [];
    for (const w of c.words || []) if (w.spk != null && runs[runs.length - 1] !== w.spk) runs.push(w.spk);
    if (runs.length === n && n > 1 && /^- /.test(c.text)) return runs;
    return Array(n).fill(runs.length ? runs[0] : null);
  }
  function rtlLine(line) { return isRtl(line) ? "‏" + line + "‏" : line; }

  function srtTime(t) {
    t = Math.max(0, t);
    const ms = Math.round(t * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(r).padStart(3, "0")}`;
  }
  function vttTime(t) { return srtTime(t).replace(",", "."); }
  function pad(n) { return String(n).padStart(2, "0"); }

  function timecode(t, fps) {
    fps = fps || 25;
    const nominal = Math.round(fps);
    const f = Math.round(Math.max(0, t) * fps);
    const ff = f % nominal, s = Math.floor(f / nominal);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
  }

  function toSRT(cues, opts) {
    const o = opts || {}, off = o.offset || 0;
    return cues.map((c, i) => {
      const lines = c.text.split("\n"), spk = lineSpeakers(c, lines.length);
      const text = lines.map((l, k) => {
        const t = o.rtlFix ? rtlLine(l) : l, col = o.colors && spk[k] != null ? o.colors[spk[k]] : null;
        return col ? `<font color="${col}">${t}</font>` : t;
      }).join("\n");
      return `${i + 1}\n${srtTime(c.start + off)} --> ${srtTime(c.end + off)}\n${text}\n`;
    }).join("\n");
  }

  function toVTT(cues, opts) {
    const off = (opts && opts.offset) || 0;
    return "WEBVTT\n\n" + cues.map((c) => `${vttTime(c.start + off)} --> ${vttTime(c.end + off)}\n${c.text}\n`).join("\n");
  }

  /* A transcript, one line per caption. With speaker names (opts.speakers), each line says who talks,
   * and a dialogue caption becomes one line per person. */
  function toTranscript(cues, opts) {
    const o = opts || {}, names = o.speakers;
    const line = (t, text, spk) => `${timecode(t + (o.offset || 0), o.fps)}  ${names && spk != null ? (names[spk] || `Speaker ${spk + 1}`) + ": " : ""}${text}`;
    const out = [];
    for (const c of cues) {
      const ws = c.words || [];
      const runs = [];
      for (const w of ws) { const r = runs[runs.length - 1]; if (r && r.spk === w.spk) r.ws.push(w); else runs.push({ spk: w.spk, ws: [w] }); }
      if (names && runs.length > 1 && !c.edited) for (const r of runs) out.push(line(r.ws[0].start, joinText(r.ws), r.spk));
      else out.push(line(c.start, c.text.replace(/^- /gm, "").replace(/\n/g, " "), runs.length ? runs[0].spk : null));
    }
    return out.join("\n") + "\n";
  }

  /* Hand-correct who says a caption: the words of speaker `from` (all words when from is null) go to
   * speaker `to`. The caption keeps its timing; its text is rebuilt (dialogue dashes appear or go)
   * unless the person edited the text. */
  // "Looks right": keep the speakers, drop the flags.
  function confirmSpeaker(cues, id) {
    return cues.map((c) => (c.id !== id ? c : { ...c, words: (c.words || []).map((w) => { const { spkAlt, ...rest } = w; return rest; }) }));
  }
  function setSpeaker(cues, id, from, to, spec) {
    return cues.map((c) => {
      if (c.id !== id) return c;
      const words = (c.words || []).map((w) => { const { spkAlt, ...rest } = w; return from == null || w.spk === from ? { ...rest, spk: to } : rest; });
      const text = c.edited ? c.text : makeCue(words, spec, c.id).text;
      return { ...c, words, text, dialogue: undefined };
    });
  }

  function toPlain(cues) {
    return cues.map((c) => c.text.replace(/\n/g, " ")).join(" ").replace(/\s+([.,!?;:])/g, "$1") + "\n";
  }

  function summary(cues, spec) {
    const report = checkAll(cues, spec);
    const rates = cues.map(cps);
    return {
      count: cues.length,
      toReview: report.filter((r) => r.issues.length).length,
      longest: cues.reduce((m, c) => Math.max(m, c.end - c.start), 0),
      fastest: rates.length ? Math.max(...rates) : 0,
    };
  }

  const api = {
    PRESETS, FILLERS, cleanWords, removeFillers, markFillers, fillerCount, dropFillers, keepFillers, applyGlossary, assignSpeakers, speakerOf, tidyTurns, speakerAtTurns, speakersFromTurns, setSpeaker, confirmSpeaker, splitBySpeaker, sentenceSpans, refineSpeakers, speakerCentres, cutCandidates, bestCuts, moveCuts, buildCues, timeCues, Stream, snapToSpeech, speechFrames, snapToCuts, cutCount, wordBeats, transcriptTurns, checkCue, checkAll,
    fixExtend, fixSplit, fixMerge, fixAll, fixPreview, fixScore, setTime, splitAtWord, splitAtTime, editText, replaceAll, cps, isRtl, rtlLine,
    toSRT, toVTT, toTranscript, toPlain, timecode, srtTime, summary,
  };
  // In a CEP panel with Node, `module` exists too, so always attach to the window as well.
  if (typeof window !== "undefined") window.Cues = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
