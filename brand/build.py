"""Builds every Cueline logo file from the Line C geometry (200 grid) and Space Grotesk.

    python3 build.py        # needs cairosvg, fonttools, brotli, pillow; macOS iconutil for the .icns

The mark: the C drawn as four caption lines (two full, two short on the left), opened on the right
like the Conform Labs C, with the anchor square in the opening where the next word lands.
"""
import os, shutil, subprocess, tempfile
import cairosvg
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.join(D, "png"); os.makedirs(PNG, exist_ok=True)
FONT = os.path.join(D, "fonts", "SpaceGrotesk-Variable-latin.woff2")

INK, IVORY = "#14161A", "#F2EFE8"
BLUE_LIGHT, BLUE_DARK = "#1F5BBF", "#6EA8FF"          # product-cueline on ivory / on ink
MUTED_LIGHT, MUTED_DARK = "#5C5E62", "#A6A49D"
SUB_LIGHT, SUB_DARK = "#4A4944", "#C9C6BD"
SECOND_LIGHT, SECOND_DARK = "#5B5A55", "#A9A79F"   # "Captions" in the lockup (as "MCP" in Surehand's)   # the lockup's "for Adobe® ..." line (as in Surehand's lockup)

# ---------- the mark ----------
LINES = "M58 48H160M40 82H90M40 118H90M58 152H160"      # stroke 18
ANCHOR = "M112 88h24v24h-24Z"                            # stroke 6, hollow
SMALL_LINES = "M58 44H164M36 82H92M36 118H92M58 156H164" # 32-64 px: stroke 24, solid anchor
SMALL_ANCHOR = "M112 86h28v28h-28Z"
TINY_LINES = "M58 40H166M34 82H94M34 118H94M58 160H166"  # 16 px: stroke 30
TINY_ANCHOR = "M112 84h32v32h-32Z"


def mark(fg, accent):
    return (f'<path d="{LINES}" fill="none" stroke="{fg}" stroke-width="18"/>'
            f'<path d="{ANCHOR}" fill="none" stroke="{accent}" stroke-width="6"/>')


def small(fg, accent):
    return f'<path d="{SMALL_LINES}" fill="none" stroke="{fg}" stroke-width="24"/><path d="{SMALL_ANCHOR}" fill="{accent}"/>'


def tiny(fg, accent):
    return f'<path d="{TINY_LINES}" fill="none" stroke="{fg}" stroke-width="30"/><path d="{TINY_ANCHOR}" fill="{accent}"/>'


def svg(w, h, body, label="Cueline", size=None):
    dims = f' width="{size[0]}" height="{size[1]}"' if size else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}"{dims} role="img" aria-label="{label}">'
            f'<title>{label}</title>{body}</svg>')


def tile(bg, inner, sc, off, rx=44):
    return f'<rect width="200" height="200" rx="{rx}" fill="{bg}"/><g transform="translate({off} {off}) scale({sc})">{inner}</g>'


# ---------- outlined type ----------
_inst = {}


def font(w):
    if w not in _inst:
        _inst[w] = instancer.instantiateVariableFont(TTFont(FONT), {"wght": w})
    return _inst[w]


def text_path(s, w, size, x0, base, track=0.0):
    f = font(w); gs = f.getGlyphSet(); cmap = f.getBestCmap(); sc = size / f["head"].unitsPerEm
    d, x = "", x0
    for ch in s:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, base)))
        d += pen.getCommands()
        x += f["hmtx"][g][0] * sc + track * size
    return d, x


def cap_height(w):
    f = font(w); return f["OS/2"].sCapHeight / f["head"].unitsPerEm


from fontTools.pens.boundsPen import BoundsPen


def ink(s, w, size, track=0.0):
    """The ink box of a line of type: (left of the first glyph, right of the last, top above the baseline)."""
    f = font(w); gs = f.getGlyphSet(); cmap = f.getBestCmap(); sc = size / f["head"].unitsPerEm
    left, right, top, x = None, 0, 0, 0
    for ch in s:
        g = cmap[ord(ch)]; bp = BoundsPen(gs); gs[g].draw(bp)
        if bp.bounds:
            if left is None: left = x + bp.bounds[0] * sc
            right = x + bp.bounds[2] * sc; top = max(top, bp.bounds[3] * sc)
        x += f["hmtx"][g][0] * sc + track * size
    return left, right, top


# The lockup, measured from Surehand's (brand/png/lockup-*.png in the Surehand repository, 1040x208 at 2x) so the two
# products' headers match: a 520x104 canvas; the mark's ink in x 29..~86, y 23..80.5; the name's ink from x 115.5,
# 34 tall on a baseline at 55.5 (Space Grotesk 600, tracking -0.044); "for Adobe® ..." from x 114, 12 tall on a
# baseline at 83.5 (Space Grotesk 600, tracking -0.033).
LOCK_W, LOCK_H = 520, 104
# The weights that look like Surehand's lockup image, measured by its ink (its brand notes say 600 and 500; the image
# came out heavier): the name 640, the second word 520, the "for Adobe®…" line 650.
NAME_W, SECOND_W, SUB_W = 640, 520, 650
WORD_GAP = 16.5   # between the two words' ink, as between "Surehand" and "MCP"


def name(fg, second, x, base):
    """'Cueline' (600) and 'Captions' (500, muted) with their ink starting at x: (svg, ink right, ink top)."""
    size = 34 / ink("Cueline", 600, 1, NAME_TRACK)[2]
    l, r, t = ink("Cueline", NAME_W, size, NAME_TRACK)
    d1, _ = text_path("Cueline", NAME_W, size, x - l, base, NAME_TRACK)
    x2 = x + (r - l) + WORD_GAP
    l2, r2, _ = ink("Captions", SECOND_W, size, NAME_TRACK)
    d2, _ = text_path("Captions", SECOND_W, size, x2 - l2, base, NAME_TRACK)
    return f'<path d="{d1}" fill="{fg}"/><path d="{d2}" fill="{second}"/>', x2 + (r2 - l2), t
NAME_TRACK, SUB_TRACK = -0.044, -0.033


def lockup(fg, accent, muted, with_mark=True, sub=True, endorse=False, second=None):
    second = second or muted
    if not with_mark and not sub:   # the wordmark alone, on its own tight canvas
        size = 34 / ink("Cueline", 600, 1, NAME_TRACK)[2]
        t = ink("Cueline", 600, size, NAME_TRACK)[2]
        body, right, _ = name(fg, second, 0, t)
        return svg(round(right + 1), round(t + 1), body, label="Cueline Captions")
    # the mark: its ink (x 40..160, y 39..161 in the 200 grid) scaled to Surehand's mark height
    sc = 57.5 / 122
    body = f'<g transform="translate({29 - 40 * sc:.3f} {23 - 39 * sc:.3f}) scale({sc:.5f})">{mark(fg, accent)}</g>'
    body += name(fg, second, 115.5, 55.5)[0]
    height = LOCK_H
    if sub:
        line = "for Adobe® Premiere Pro®"
        ssize = 12 / ink("for Adobe® After Effects®", 600, 1, SUB_TRACK)[2]   # the same type size as Surehand's line
        l, _, _ = ink(line, SUB_W, ssize, SUB_TRACK)
        d, _ = text_path(line, SUB_W, ssize, 114 - l, 83.5, SUB_TRACK)
        body += f'<path d="{d}" fill="{muted}"/>'
    if endorse:   # Surehand has none: the endorsement line under it, the canvas taller by one line
        esize = 9
        l, _, _ = ink("A CONFORM LABS PRODUCT", 500, esize, 0.08)
        d, _ = text_path("A CONFORM LABS PRODUCT", 500, esize, 114 - l, 104, 0.08)
        body += f'<path d="{d}" fill="{muted}"/>'
        height = 116
    return svg(LOCK_W, height, body, label="Cueline Captions for Adobe® Premiere Pro®")


# ---------- write ----------
def save(name, content, pngs=()):
    with open(os.path.join(D, name), "w") as fh:
        fh.write(content)
    for out, width in pngs:
        cairosvg.svg2png(bytestring=content.encode(), write_to=os.path.join(PNG, out), output_width=width)


icon_full = svg(200, 200, tile(INK, mark(IVORY, BLUE_DARK), 0.72, 28), size=(200, 200))
icon_small = svg(200, 200, tile(INK, small(IVORY, BLUE_DARK), 0.76, 24), size=(200, 200))
icon_16 = svg(200, 200, tile(INK, tiny(IVORY, BLUE_DARK), 0.84, 16), size=(200, 200))

save("cueline-mark.svg", svg(200, 200, mark(INK, BLUE_LIGHT), size=(220, 220)), [("mark-128.png", 128), ("mark-512.png", 512)])
save("cueline-mark-reversed.svg", svg(200, 200, mark(IVORY, BLUE_DARK), size=(220, 220)), [("mark-reversed-128.png", 128), ("mark-reversed-512.png", 512)])
save("cueline-mark-mono.svg", svg(200, 200, mark(INK, INK), size=(220, 220)))
save("cueline-icon.svg", icon_full, [(f"icon-{s}.png", s) for s in (128, 256, 400, 512, 1024)])
save("cueline-icon-small.svg", icon_small, [(f"icon-{s}.png", s) for s in (32, 48, 64)])
save("cueline-icon-16.svg", icon_16, [("icon-16.png", 16)])
save("cueline-tile.svg", svg(200, 200, tile(BLUE_DARK, small(INK, INK), 0.76, 24, rx=46), size=(200, 200)), [("tile-256.png", 256)])
save("cueline-lockup.svg", lockup(INK, BLUE_LIGHT, SUB_LIGHT, second=SECOND_LIGHT), [("lockup-light.png", 1040)])
save("cueline-lockup-reversed.svg", lockup(IVORY, BLUE_DARK, SUB_DARK, second=SECOND_DARK), [("lockup-dark.png", 1040)])
save("cueline-lockup-endorsed.svg", lockup(INK, BLUE_LIGHT, SUB_LIGHT, endorse=True, second=SECOND_LIGHT), [("lockup-endorsed-light.png", 1040)])
save("cueline-lockup-endorsed-reversed.svg", lockup(IVORY, BLUE_DARK, SUB_DARK, endorse=True, second=SECOND_DARK), [("lockup-endorsed-dark.png", 1040)])
save("cueline-wordmark.svg", lockup(INK, BLUE_LIGHT, MUTED_LIGHT, with_mark=False, sub=False, second=SECOND_LIGHT))
save("cueline-wordmark-reversed.svg", lockup(IVORY, BLUE_DARK, MUTED_DARK, with_mark=False, sub=False, second=SECOND_DARK))

# Panel icons for the Premiere Pro Window › Extensions menu: the 16 px form, no tile, muted lines.
panel = svg(200, 200, f'<g transform="translate(16 16) scale(0.84)">{tiny(MUTED_DARK, BLUE_DARK)}</g>')
ext_img = os.path.join(D, "..", "extension", "img")
os.makedirs(ext_img, exist_ok=True)
cairosvg.svg2png(bytestring=panel.encode(), write_to=os.path.join(ext_img, "panel-icon.png"), output_width=23, output_height=23)
cairosvg.svg2png(bytestring=panel.encode(), write_to=os.path.join(ext_img, "panel-icon@2x.png"), output_width=46, output_height=46)


# App icons: each size from the form drawn for it.
def icon_png(size):
    src = icon_16 if size <= 16 else icon_small if size <= 64 else icon_full
    return cairosvg.svg2png(bytestring=src.encode(), output_width=size, output_height=size)


tmp = tempfile.mkdtemp()
iconset = os.path.join(tmp, "Cueline.iconset"); os.makedirs(iconset)
for base in (16, 32, 128, 256, 512):
    for scale in (1, 2):
        name = f"icon_{base}x{base}{'@2x' if scale == 2 else ''}.png"
        with open(os.path.join(iconset, name), "wb") as fh:
            fh.write(icon_png(base * scale))
if shutil.which("iconutil"):
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(D, "Cueline.icns")], check=True)

ico_sizes = (16, 24, 32, 48, 64, 128, 256)
frames = []
for s in ico_sizes:
    p = os.path.join(tmp, f"{s}.png")
    with open(p, "wb") as fh:
        fh.write(icon_png(s))
    frames.append(Image.open(p).convert("RGBA"))
frames[-1].save(os.path.join(D, "Cueline.ico"), sizes=[(s, s) for s in ico_sizes], append_images=frames[:-1])
shutil.rmtree(tmp)

print("built:", sorted(f for f in os.listdir(D) if f.endswith((".svg", ".icns", ".ico"))))
print("png:", sorted(os.listdir(PNG)))
