/* Cueline waveform strip: the audio's loudness around one caption, drawn on a canvas.
 * env is {hop: seconds per frame, db: loudness per frame}, the same data captions are timed from. */
(function (root) {
  "use strict";

  // The time window shown for a caption: the caption plus room on both sides to see the pauses.
  function windowFor(c, audioEnd) {
    const len = c.end - c.start, pad = Math.max(0.8, len * 0.4);
    return { t0: Math.max(0, c.start - pad), t1: Math.min(audioEnd || Infinity, c.end + pad) };
  }

  // Vertical bars, one per pixel column: the loudest frame in that column, from -60 dB to 0 dB.
  // Inside [a, b] (the caption) the bars use `inside`, elsewhere `outside`.
  function draw(canvas, env, view, colors, a, b) {
    const dpr = root.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, w, h);
    if (!env || !env.db || !env.db.length) return;
    const span = view.t1 - view.t0, mid = h / 2;
    for (let x = 0; x < w; x++) {
      const ta = view.t0 + (x / w) * span, tb = view.t0 + ((x + 1) / w) * span;
      const fa = Math.max(0, Math.floor(ta / env.hop)), fb = Math.min(env.db.length - 1, Math.ceil(tb / env.hop));
      let peak = -100;
      for (let f = fa; f <= fb; f++) if (env.db[f] > peak) peak = env.db[f];
      const amp = Math.max(0, Math.min(1, (peak + 60) / 60));
      const bar = Math.max(1, amp * (h - 2 * dpr));
      const t = (ta + tb) / 2;
      g.fillStyle = t >= a && t <= b ? colors.inside : colors.outside;
      g.fillRect(x, mid - bar / 2, 1, bar);
    }
  }

  root.Wave = { windowFor, draw };
})(typeof window !== "undefined" ? window : globalThis);
