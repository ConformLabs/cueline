/* Cueline animated caption looks: preset values for the template's Essential Graphics controls
 * (templates/build-animated-captions.jsx). A look only sets what it names; everything else keeps the
 * template's default. Menus are 1-based, as After Effects numbers them. Colours are hex.
 * Sliders run 0–100 in Premiere Pro, so Size and Line spacing are 50 at normal and Grow is the % the
 * spoken word grows by.
 * After placing, every control can still be changed per caption in Premiere Pro. */
(function (root) {
  "use strict";

  // Every control a look can set, and how Premiere Pro takes its value.
  const CONTROLS = {
    "Text colour": "color", "Text case": "menu", "Letter spacing": "number", "Line spacing": "number",
    "Outline width": "number", "Outline colour": "color", "Size": "number", "Position": "point",
    "Spoken word · Speaker 1": "color", "Spoken word · Speaker 2": "color", "Spoken word · Speaker 3": "color",
    "Spoken word · Style": "menu", "Spoken word · Grow": "number", "Spoken word · Animation": "menu",
    "Spoken word · Box colour": "color", "Spoken word · Text on box": "color", "Spoken word · Box padding": "number", "Spoken word · Box roundness": "number",
    "Said words": "menu", "Said words · Colour": "color", "Upcoming words · Opacity": "number",
    "Background": "bool", "Background · Colour": "color", "Background · Opacity": "number", "Background · Padding": "number", "Background · Roundness": "number",
    "Shadow": "bool", "Shadow · Colour": "color", "Shadow · Opacity": "number", "Shadow · Distance": "number", "Shadow · Softness": "number",
    "Caption entrance": "menu", "Random tilt": "number",
  };

  const MENUS = {
    "Text case": ["Normal", "UPPERCASE"],
    "Spoken word · Style": ["Coloured word", "Coloured box", "Coloured word on a box"],
    "Spoken word · Animation": ["None", "Pop", "Bounce", "Fade in", "Rise"],
    "Said words": ["Text colour", "Keep the highlight", "Said-word colour"],
    "Caption entrance": ["None", "Pop", "Fade", "Slide up", "Bounce"],
  };

  // The template's own defaults, so a look can be shown (and reset) completely.
  const DEFAULTS = {
    "Text colour": "#FFFFFF", "Text case": 1, "Letter spacing": 0, "Line spacing": 50, "Outline width": 0, "Outline colour": "#000000", "Size": 50,
    "Spoken word · Speaker 1": "#FFD23F", "Spoken word · Speaker 2": "#7FDBFF", "Spoken word · Speaker 3": "#FF8FC7",
    "Spoken word · Style": 1, "Spoken word · Grow": 10, "Spoken word · Animation": 2,
    "Spoken word · Box colour": "#1A1A1A", "Spoken word · Text on box": "#000000", "Spoken word · Box padding": 14, "Spoken word · Box roundness": 16,
    "Said words": 1, "Said words · Colour": "#BFBFBF", "Upcoming words · Opacity": 100,
    "Background": false, "Background · Colour": "#000000", "Background · Opacity": 60, "Background · Padding": 34, "Background · Roundness": 14,
    "Shadow": true, "Shadow · Colour": "#000000", "Shadow · Opacity": 75, "Shadow · Distance": 10, "Shadow · Softness": 18,
    "Caption entrance": 2, "Random tilt": 0,
  };

  const LOOKS = [
    { id: "clean", name: "Clean", note: "White, the spoken word in colour, a soft shadow.", set: {} },
    { id: "bold", name: "Bold pop", note: "Capitals with a thick outline, the spoken word bounces.",
      set: { "Text case": 2, "Outline width": 9, "Shadow · Distance": 6, "Shadow · Softness": 6, "Spoken word · Grow": 25, "Spoken word · Animation": 3,
        "Spoken word · Speaker 1": "#FFE600", "Spoken word · Speaker 2": "#3DFF8B", "Spoken word · Speaker 3": "#FF5EC4", "Caption entrance": 5 } },
    { id: "box", name: "Box karaoke", note: "A coloured box moves from word to word.",
      set: { "Spoken word · Style": 2, "Spoken word · Text on box": "#000000", "Spoken word · Grow": 5, "Spoken word · Animation": 1, "Shadow · Opacity": 50 } },
    { id: "pill", name: "Dark pill", note: "A rounded dark box behind the caption.",
      set: { "Background": true, "Background · Opacity": 72, "Background · Roundness": 30, "Background · Padding": 30, "Shadow": false, "Caption entrance": 3, "Spoken word · Animation": 1, "Spoken word · Grow": 0 } },
    { id: "reveal", name: "Word by word", note: "Words appear as they are spoken.",
      set: { "Upcoming words · Opacity": 0, "Spoken word · Animation": 5, "Caption entrance": 1, "Spoken word · Grow": 0 } },
    { id: "karaoke", name: "Karaoke fill", note: "Words fill with colour and stay lit.",
      set: { "Said words": 2, "Upcoming words · Opacity": 55, "Spoken word · Animation": 1, "Spoken word · Grow": 0 } },
    { id: "neon", name: "Neon", note: "A glow in the speaker's colour.",
      set: { "Text colour": "#F2FBFF", "Shadow · Colour": "#00B7FF", "Shadow · Distance": 0, "Shadow · Softness": 40, "Shadow · Opacity": 100,
        "Spoken word · Speaker 1": "#FF4FD8", "Spoken word · Speaker 2": "#4FFFE0", "Spoken word · Speaker 3": "#FFE14F", "Caption entrance": 3 } },
    { id: "tilt", name: "Social tilt", note: "Capitals, a slight tilt per caption, a bouncy entrance.",
      set: { "Text case": 2, "Outline width": 7, "Random tilt": 4, "Caption entrance": 5, "Spoken word · Animation": 2, "Spoken word · Grow": 20,
        "Spoken word · Style": 3, "Spoken word · Box colour": "#000000" } },
    { id: "plain", name: "Plain subtitles", note: "Classic subtitles in a soft box, no highlight.",
      set: { "Spoken word · Speaker 1": "#FFFFFF", "Spoken word · Speaker 2": "#FFFFFF", "Spoken word · Speaker 3": "#FFFFFF", "Spoken word · Grow": 0,
        "Spoken word · Animation": 1, "Caption entrance": 1, "Background": true, "Background · Opacity": 55, "Shadow": false, "Size": 42 } },
  ];

  function lookValues(id) {
    const l = LOOKS.find((x) => x.id === id) || LOOKS[0];
    return { ...DEFAULTS, ...l.set };
  }
  const hexRgb = (h) => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];

  // For Premiere Pro: [{ name, type, value }], colours as [r, g, b] 0–255.
  function forHost(values) {
    return Object.keys(values).filter((n) => CONTROLS[n]).map((n) => ({ name: n, type: CONTROLS[n], value: CONTROLS[n] === "color" ? hexRgb(values[n]) : values[n] }));
  }

  const api = { CONTROLS, MENUS, DEFAULTS, LOOKS, lookValues, forHost };
  if (typeof window !== "undefined") window.Looks = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
