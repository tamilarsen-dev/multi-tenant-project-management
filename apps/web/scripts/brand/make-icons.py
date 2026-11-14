"""Build the app's icons from public/brand/app-icon.svg (Next.js file conventions).

Usage: python3 apps/web/scripts/brand/make-icons.py <repo root>
Needs Python Playwright and Pillow. Writes, under apps/web/src/app/:
- icon.svg        the scalable icon modern browsers use
- favicon.ico     16, 32 and 48 px for everything else
- apple-icon.png  180 px, full-bleed (iOS rounds the corners itself)
"""
import base64, io, os, re, shutil, sys
from PIL import Image
from playwright.sync_api import sync_playwright

root = sys.argv[1]
src = os.path.join(root, "apps/web/public/brand/app-icon.svg")
app = os.path.join(root, "apps/web/src/app")
svg = open(src).read()
# iOS masks the icon itself, so its version has square corners.
square = re.sub(r'<path d="[^"]*" fill="(#[0-9a-f]+)"/>', r'<rect width="512" height="512" fill="\1"/>', svg, count=1)

def render(markup, size):
    page.set_viewport_size({"width": size, "height": size})
    page.set_content(f'<body style="margin:0"><img style="display:block;width:{size}px;height:{size}px" '
                     f'src="data:image/svg+xml;base64,{base64.b64encode(markup.encode()).decode()}">')
    return Image.open(io.BytesIO(page.screenshot(omit_background=True))).convert("RGBA")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    big = render(svg, 256)
    render(square, 180).save(os.path.join(app, "apple-icon.png"))
    browser.close()

big.save(os.path.join(app, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
shutil.copyfile(src, os.path.join(app, "icon.svg"))
print("icon.svg, favicon.ico, apple-icon.png")
