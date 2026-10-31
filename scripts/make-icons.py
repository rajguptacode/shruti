from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

OUT = Path(__file__).resolve().parent.parent / 'assets'
OUT.mkdir(exist_ok=True)
GREEN = (30, 90, 70, 255)
GREEN_DARK = (20, 66, 51, 255)
CREAM = (251, 248, 239, 255)
SUN = (217, 149, 46, 255)
INK = (31, 41, 37, 255)
MUTED = (104, 115, 107, 255)
PAPER = (243, 239, 228, 255)

def draw_mark(draw, size, pad=0.0, bg=GREEN, rounded=True):
    # background
    if rounded:
        draw.rounded_rectangle([0, 0, size, size], radius=int(size * 0.219), fill=bg)
    else:
        draw.rectangle([0, 0, size, size], fill=bg)
    # scale mark into the square, with optional padding
    s = size * (1 - pad * 2)
    ox = oy = size * pad
    cx, cy = ox + s * 0.46, oy + s * 0.5
    r = s * 0.212
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CREAM)
    # play triangle (slightly optical-centred)
    tri = [(cx - s*0.050, cy - s*0.098), (cx - s*0.050, cy + s*0.098), (cx + s*0.095, cy)]
    draw.polygon(tri, fill=bg)
    # sound arcs
    for i, rad in enumerate([0.29, 0.365, 0.44]):
        rr = s * rad
        bbox = [cx - rr, cy - rr, cx + rr, cy + rr]
        width = max(2, int(s * 0.035))
        # draw right-hand arc only
        start = -40
        end = 40
        draw.arc(bbox, start=start, end=end, fill=(251, 248, 239, 255 - i * 55), width=width)

for size, name, pad, rounded in [
    (192, 'icon-192.png', 0, True),
    (512, 'icon-512.png', 0, True),
    (512, 'icon-maskable-512.png', 0.12, False),
    (180, 'apple-touch-icon.png', 0, True),
    (32, 'favicon-32.png', 0, True),
]:
    scale = 4
    img = Image.new('RGBA', (size*scale, size*scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_mark(d, size*scale, pad=pad, rounded=rounded)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(OUT / name)

# Source SVG
svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1e5a46"/>
  <circle cx="232" cy="256" r="108" fill="#fbf8ef"/>
  <path d="M208 203.5 304 256l-96 52.5z" fill="#1e5a46"/>
  <g fill="none" stroke-linecap="round" stroke="#fbf8ef">
    <path d="M348 161a150 150 0 0 1 0 190" stroke-width="18" opacity=".95"/>
    <path d="M379 137a190 190 0 0 1 0 238" stroke-width="17" opacity=".66"/>
    <path d="M410 113a230 230 0 0 1 0 286" stroke-width="16" opacity=".38"/>
  </g>
</svg>'''
(OUT / 'icon.svg').write_text(svg)

# OG image
W, H = 1200, 630
img = Image.new('RGB', (W, H), PAPER)
d = ImageDraw.Draw(img)
# ambient circles
for r, alpha in [(480, 18), (360, 15), (260, 12)]:
    d.ellipse([W-540-r, -r+80, W-540+r, r+80], fill=(217, 149, 46, alpha))
# corner green shape
d.rounded_rectangle([W-430, H-430, W-50, H-50], radius=110, fill=GREEN)
# icon mark on right card
mark = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
md = ImageDraw.Draw(mark)
draw_mark(md, 1024, pad=0, bg=GREEN)
mark = mark.resize((300, 300), Image.LANCZOS)
img.paste(mark, (W-390, H-390), mark)

serif = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 92)
sans_bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
sans = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 27)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 21)
d.text((84, 86), 'SHRUTI  ·  AUDIO STUDY NOTES', font=sans_bold, fill=GREEN)
d.text((84, 150), 'Hear your notes.', font=serif, fill=INK)
d.text((84, 256), 'Remember more.', font=serif, fill=GREEN)
d.text((84, 390), 'Paste text. Listen sentence by sentence.', font=sans, fill=MUTED)
d.text((84, 430), 'English · Hindi · Hinglish', font=sans, fill=MUTED)
d.line([(84, 495), (520, 495)], fill=(221, 212, 194), width=2)
d.text((84, 518), 'Free  ·  no sign-up  ·  private on your device', font=small, fill=MUTED)
img.save(OUT / 'og.png', quality=92)
print('wrote', sorted(p.name for p in OUT.iterdir()))
