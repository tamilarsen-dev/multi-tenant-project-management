"""Generate Detent brand assets (logo + Peg) as standalone SVGs.

Usage: python3 apps/web/scripts/brand/generate-svg.py <repo root> <output dir>

Geometry mirrors components/logo.tsx and the .peg-fig rules in globals.css,
so the files match what the app draws.
"""
import io, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

REPO, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

THEMES = {
    "light": dict(ink="#1f1e25", accent="#8b54d4", ridge="#723eb5", on="#ffffff", pupil="#141319",
                  surface="#ffffff", border="#e7e7f0", bg="#faf9ff"),
    "dark": dict(ink="#e7e7f0", accent="#a679ed", ridge="#c1a0fb", on="#0b0a10", pupil="#141319",
                 surface="#1f1e25", border="#333239", bg="#141319"),
}

def f(n): return f"{n:.2f}".rstrip("0").rstrip(".")

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{f(w)}" height="{f(h)}" '
            f'viewBox="0 0 {f(w)} {f(h)}" role="img" aria-label="{title}">\n'
            f'<title>{title}</title>\n{body}</svg>\n')

def rrect(x, y, w, h, tl, tr, br, bl, fill, extra=""):
    p = (f"M{f(x+tl)} {f(y)}H{f(x+w-tr)}A{f(tr)} {f(tr)} 0 0 1 {f(x+w)} {f(y+tr)}"
         f"V{f(y+h-br)}A{f(br)} {f(br)} 0 0 1 {f(x+w-br)} {f(y+h)}"
         f"H{f(x+bl)}A{f(bl)} {f(bl)} 0 0 1 {f(x)} {f(y+h-bl)}"
         f"V{f(y+tl)}A{f(tl)} {f(tl)} 0 0 1 {f(x+tl)} {f(y)}Z")
    return f'<path d="{p}" fill="{fill}"{extra}/>'

# ---- Logo mark (logo.tsx, viewBox 48) ------------------------------------
def mark(t, dx=0, dy=0, s=1.0):
    c = THEMES[t]
    g = f'<g transform="translate({f(dx)} {f(dy)}) scale({f(s)})">'
    # circle r14 at (20,28) with a 8x10 notch at x29..37, y23..33 removed
    g += (f'<path fill-rule="evenodd" fill="{c["ink"]}" d="M6 28a14 14 0 1 0 28 0a14 14 0 1 0 -28 0Z'
          f'M29 23h8v10h-8Z"/>')
    g += f'<rect x="34" y="6" width="6" height="36" rx="3" fill="{c["ink"]}"/>'
    g += f'<rect x="30" y="24" width="4" height="8" fill="{c["accent"]}"/>'
    return g + "</g>\n"

# ---- Wordmark: Bricolage Grotesque 700, -0.02em tracking -----------------
def wordmark_font():
    tt = TTFont(os.path.join(REPO, "apps/web/src/fonts/bricolage-grotesque-latin-wght-normal.woff2"))
    tt.flavor = None
    inst = instantiateVariableFont(tt, {a.axisTag: (700 if a.axisTag == "wght" else a.defaultValue)
                                        for a in tt["fvar"].axes})
    buf = io.BytesIO(); inst.save(buf)
    return inst, buf.getvalue()

FONT, FONT_BYTES = wordmark_font()

def text_path(text, size, x, y_top, fill):
    upm = FONT["head"].unitsPerEm
    face = hb.Face(FONT_BYTES); hfont = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hfont, buf, {"kern": True, "liga": True})
    k = size / upm
    asc, desc = FONT["hhea"].ascent, FONT["hhea"].descent  # desc negative
    # line-height 1: content area centred in a box of height `size`
    baseline = y_top + (size - (asc - desc) * k) / 2 + asc * k
    gs = FONT.getGlyphSet(); order = FONT.getGlyphOrder()
    pen_x, out = x, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        sp = SVGPathPen(gs)
        gs[name].draw(TransformPen(sp, (k, 0, 0, -k, pen_x + pos.x_offset * k, baseline - pos.y_offset * k)))
        out.append(sp.getCommands())
        pen_x += pos.x_advance * k - 0.02 * size
    return f'<path fill="{fill}" d="{" ".join(out)}"/>\n', pen_x + 0.02 * size

def logo(t):
    S = 48; size = 0.68 * S; gap = 15
    body, end = text_path("detent", size, S + gap, 0, THEMES[t]["ink"])
    return svg(end + 2, S, mark(t) + body, "Detent")

def app_icon():
    c = THEMES["dark"]
    body = rrect(0, 0, 512, 512, 112, 112, 112, 112, c["bg"])
    body += mark("dark", dx=256 - 23 * 10.5, dy=256 - 24 * 10.5, s=10.5)
    return svg(512, 512, body, "Detent")

# ---- Peg (.peg-fig in globals.css) ---------------------------------------
def mouth(cx, y, w, h, s, color):
    r = min(h, w / 2)
    ir = max(r - s, 0)
    x0, x1 = cx - w / 2, cx + w / 2
    outer = (f"M{f(x0)} {f(y)}H{f(x1)}V{f(y+h-r)}A{f(r)} {f(r)} 0 0 1 {f(x1-r)} {f(y+h)}"
             f"H{f(x0+r)}A{f(r)} {f(r)} 0 0 1 {f(x0)} {f(y+h-r)}Z")
    ix0, ix1, ih = x0 + s, x1 - s, h - s
    inner = (f"M{f(ix0)} {f(y)}H{f(ix1)}V{f(y+ih-ir)}A{f(ir)} {f(ir)} 0 0 1 {f(ix1-ir)} {f(y+ih)}"
             f"H{f(ix0+ir)}A{f(ir)} {f(ir)} 0 0 1 {f(ix0)} {f(y+ih-ir)}Z")
    return f'<path fill-rule="evenodd" fill="{color}" d="{outer}{inner}"/>'

def face(c, W, left, right, top, mood):
    ew, eh, er, gap, col = 0.17 * W, 0.25 * W, 0.07 * W, 0.09 * W, 0.07 * W
    cx = (left + right) / 2
    out = ""
    for i, ex in enumerate((cx - gap / 2 - ew, cx + gap / 2)):
        ecx, ecy = ex + ew / 2, top + eh / 2
        tf = ""
        if mood == "happy":
            tf = f' transform="translate(0 {f(ecy)}) scale(1 0.45) translate(0 {f(-ecy - 0.12 * eh)})"'
        if mood == "wink" and i == 1:
            tf = f' transform="translate(0 {f(ecy)}) scale(1 0.12) translate(0 {f(-ecy)})"'
        pw, ph = 0.52 * ew, 0.46 * eh
        out += (f'<g{tf}><rect x="{f(ex)}" y="{f(top)}" width="{f(ew)}" height="{f(eh)}" rx="{f(er)}" fill="#fff"/>'
                f'<rect x="{f(ecx-pw/2)}" y="{f(ecy-ph/2)}" width="{f(pw)}" height="{f(ph)}" '
                f'rx="{f(0.3*pw)}" ry="{f(0.3*ph)}" fill="{c["pupil"]}"/></g>\n')
    mw, mh = (0.24 * W, 0.12 * W) if mood == "happy" else (0.17 * W, 0.08 * W)
    out += mouth(cx, top + eh + col, mw, mh, max(2.5, 0.034 * W), c["on"]) + "\n"
    return out

def ridges(c, x, y, W):
    rw, rh = 0.22 * W, 0.035 * W
    return "".join(f'<rect x="{f(x)}" y="{f(y + d)}" width="{f(rw)}" height="{f(rh)}" rx="2" '
                   f'fill="{c["ridge"]}" opacity="0.6"/>' for d in (0, 0.07 * W)) + "\n"

def peg(t, mood="idle"):
    """The full-body Peg (shape "climb"), 120 x 144 like the sign-in climber."""
    c, W, H = THEMES[t], 120, 144
    b = rrect(0, 0, W, H, .32 * W, .38 * W, .38 * W, .32 * W, c["accent"]) + "\n"
    b += ridges(c, W - 0.12 * W - 0.22 * W, 0.13 * W, W)
    b += face(c, W, 0.40 * W, W - 0.07 * W, 0.29 * H, mood)
    return svg(W, H, b, "Peg")

def peg_hanging(t):
    """Peg hanging from its socket, as in the app header."""
    c, W, H, pad = THEMES[t], 100, 120, 7
    bw = 56
    b = f'<g transform="translate({pad} 0)">'
    b += rrect(0, 0, bw, H, 0, 0, min(.4 * W, bw / 2), min(.4 * W, bw / 2), c["accent"])
    # face/ridges use --w = 100 like the header Peg, centred on the 56px body
    rx = bw / 2 - 0.11 * W
    b += ridges(c, rx, H - 1.1 * W - 0.035 * W, W)
    eh, mh = 0.25 * W, 0.08 * W
    top = H - 0.16 * W - mh - 0.07 * W - eh
    b += face(c, W, 0, bw, top, "idle") + "</g>"
    b += rrect(0.5, -1, 70 - 1, 7, 0, 0, 6, 6, c["surface"], f' stroke="{c["border"]}" stroke-width="1"')
    return svg(70, H, b, "Peg")

files = {}
for t in THEMES:
    sfx = "" if t == "light" else "-dark"
    files[f"logo-mark{sfx}.svg"] = svg(48, 48, mark(t), "Detent")
    files[f"logo{sfx}.svg"] = logo(t)
    files[f"peg{sfx}.svg"] = peg(t)
    files[f"peg-happy{sfx}.svg"] = peg(t, "happy")
    files[f"peg-wink{sfx}.svg"] = peg(t, "wink")
    files[f"peg-hanging{sfx}.svg"] = peg_hanging(t)
files["app-icon.svg"] = app_icon()
for name, s in files.items():
    open(os.path.join(OUT, name), "w").write(s)
print("\n".join(sorted(files)))
