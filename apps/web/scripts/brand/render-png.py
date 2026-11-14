"""Render every SVG in a folder to a transparent PNG beside it.

Usage: python3 apps/web/scripts/brand/render-png.py apps/web/public/brand
Needs Python Playwright. Heights: the mark and app icon 512 px, the full
logo 256 px, Peg 1024 px; widths follow each file's viewBox.
"""
import base64, os, re, sys
from playwright.sync_api import sync_playwright

folder = sys.argv[1]

def height_for(name):
    if name.startswith("logo-mark") or name == "app-icon.svg":
        return 512
    return 256 if name.startswith("logo") else 1024

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    for name in sorted(n for n in os.listdir(folder) if n.endswith(".svg")):
        svg = open(os.path.join(folder, name)).read()
        w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).groups())
        H = height_for(name)
        W = round(w * H / h)
        page.set_viewport_size({"width": W, "height": H})
        page.set_content(f'<body style="margin:0"><img style="display:block;width:{W}px;height:{H}px" '
                         f'src="data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}">')
        page.screenshot(path=os.path.join(folder, name[:-4] + ".png"), omit_background=True)
    browser.close()
