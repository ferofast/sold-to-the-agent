#!/usr/bin/env python3
"""Logo generator for $SOLD — 'SOLD! To the Agent in the Back'.

Flat-vector auction-house poster, 1024x1024, drawn with PIL only.
Scene: a robot auctioneer has just sold Lot #001 (make.fun) for $1,000 USDC.
Two outbid robots slump on the left; one excited human waves a paddle
that says ME on the right. Big readable text throughout: the judge reads
the poster at a glance.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W = H = 1024
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logo.png")

TEAL = (14, 58, 59)
TEAL_LIGHT = (23, 85, 86)
NAVY = (30, 42, 68)
NAVY_DARK = (18, 32, 46)
CREAM = (245, 238, 220)
PAPER = (250, 244, 230)
RED = (212, 61, 42)
GOLD = (232, 185, 60)
WOOD = (139, 90, 43)
WOOD_DARK = (107, 66, 38)
ROBOT_BLUE = (143, 190, 221)
ROBOT_BLUE_DARK = (111, 168, 201)
SKIN = (232, 184, 138)
SHIRT_GREEN = (62, 124, 79)
HAIR = (43, 43, 43)


def font(size, bold=True):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" if bold else
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def text_c(draw, cx, y, s, f, fill):
    w = draw.textlength(s, font=f)
    draw.text((cx - w / 2, y), s, font=f, fill=fill)


def rrect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


img = Image.new("RGB", (W, H), TEAL)
draw = ImageDraw.Draw(img)

# ---- spotlight cone (soft, behind the characters) ----
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
od.polygon([(400, 90), (624, 90), (800, 940), (224, 940)], fill=(255, 255, 255, 18))
img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
draw = ImageDraw.Draw(img)

# ---- confetti dots in the background ----
for (x, y, c) in [(120, 180, GOLD), (900, 160, GOLD), (80, 420, CREAM),
                  (950, 430, CREAM), (180, 700, GOLD), (870, 700, GOLD),
                  (320, 130, CREAM), (700, 120, CREAM)]:
    draw.ellipse([x - 6, y - 6, x + 6, y + 6], fill=c)

# ---- top band ----
draw.rectangle([0, 0, W, 90], fill=NAVY_DARK)
text_c(draw, 512, 24, "THE MAKE.FUN AUCTION HOUSE", font(40), CREAM)

# ---- headline ----
text_c(draw, 512, 108, "SOLD!", font(170), CREAM)
# two short red bars flanking the auctioneer's antenna (one long bar
# would cross the antenna ball)
draw.rectangle([362, 292, 478, 306], fill=RED)
draw.rectangle([546, 292, 662, 306], fill=RED)

# ---- floor ----
draw.rectangle([0, 830, W, 940], fill=WOOD_DARK)
draw.rectangle([0, 830, W, 842], fill=WOOD)

# ================= left: two outbid robots =================
def small_robot(cx, base_y, body, head, slumped):
    # body
    rrect(draw, [cx - 55, base_y - 110, cx + 55, base_y], 22, fill=body, outline=NAVY, width=4)
    # head
    rrect(draw, [cx - 60, base_y - 200, cx + 60, base_y - 115], 26, fill=head, outline=NAVY, width=4)
    # antenna
    draw.line([cx, base_y - 200, cx + (14 if slumped else 0), base_y - 232],
              fill=NAVY, width=6)
    draw.ellipse([cx + (14 if slumped else 0) - 8, base_y - 244,
                  cx + (14 if slumped else 0) + 8, base_y - 228], fill=GOLD, outline=NAVY, width=3)
    # eyes
    if slumped:
        draw.line([cx - 38, base_y - 170, cx - 14, base_y - 158], fill=NAVY, width=6)
        draw.line([cx - 14, base_y - 170, cx - 38, base_y - 158], fill=NAVY, width=6)
        draw.line([cx + 14, base_y - 170, cx + 38, base_y - 158], fill=NAVY, width=6)
        draw.line([cx + 38, base_y - 170, cx + 14, base_y - 158], fill=NAVY, width=6)
        draw.arc([cx - 22, base_y - 140, cx + 22, base_y - 118], 200, 340, fill=NAVY, width=5)
    else:
        draw.ellipse([cx - 36, base_y - 172, cx - 16, base_y - 152], fill=NAVY)
        draw.ellipse([cx + 16, base_y - 172, cx + 36, base_y - 152], fill=NAVY)
        draw.arc([cx - 22, base_y - 148, cx + 22, base_y - 122], 20, 160, fill=NAVY, width=5)


small_robot(185, 830, ROBOT_BLUE_DARK, ROBOT_BLUE, slumped=True)
small_robot(315, 830, ROBOT_BLUE_DARK, ROBOT_BLUE, slumped=False)
# lowered paddles in front of the outbid robots
for px in (150, 300):
    draw.line([px, 740, px, 800], fill=WOOD, width=8)
    rrect(draw, [px - 34, 690, px + 34, 748], 10, fill=CREAM, outline=NAVY, width=4)
    text_c(draw, px, 702, "12", font(34), NAVY)

# ================= center: auctioneer robot =================
# raised arm + gavel (behind body, drawn first)
draw.line([585, 520, 668, 430], fill=NAVY, width=26)
draw.line([668, 430, 716, 390], fill=WOOD, width=14)
rrect(draw, [672, 372, 742, 404], 8, fill=WOOD_DARK, outline=NAVY, width=4)
# body (suit)
rrect(draw, [442, 480, 582, 660], 26, fill=NAVY, outline=NAVY_DARK, width=4)
# shirt + bow tie
draw.polygon([(492, 480), (532, 480), (512, 540)], fill=CREAM)
draw.polygon([(494, 552), (512, 542), (530, 552), (512, 566)], fill=RED)
# pointing arm
draw.line([442, 520, 380, 600], fill=NAVY, width=26)
draw.ellipse([366, 586, 394, 614], fill=ROBOT_BLUE, outline=NAVY, width=4)
# head
rrect(draw, [437, 330, 587, 470], 40, fill=ROBOT_BLUE, outline=NAVY, width=6)
# antenna
draw.line([512, 330, 512, 296], fill=NAVY, width=6)
draw.ellipse([500, 282, 524, 306], fill=GOLD, outline=NAVY, width=3)
# eyes + smile
draw.ellipse([462, 392, 494, 424], fill=NAVY)
draw.ellipse([530, 392, 562, 424], fill=NAVY)
draw.arc([478, 424, 546, 458], 15, 165, fill=NAVY, width=6)

# ---- podium ----
draw.rectangle([370, 640, 654, 672], fill=WOOD)
rrect(draw, [380, 660, 644, 840], 12, fill=WOOD, outline=WOOD_DARK, width=4)
# sign on the podium
rrect(draw, [392, 682, 632, 822], 10, fill=PAPER, outline=NAVY, width=4)
text_c(draw, 512, 694, "LOT #001", font(32), NAVY)
text_c(draw, 512, 730, "MAKE.FUN", font(32), NAVY)
text_c(draw, 512, 772, "$1,000 USDC", font(30), RED)

# ================= right: excited human bidder =================
# raised arm + ME paddle
draw.line([868, 640, 902, 500], fill=SHIRT_GREEN, width=24)
draw.line([902, 500, 902, 420], fill=WOOD, width=10)
rrect(draw, [848, 330, 956, 424], 12, fill=CREAM, outline=RED, width=6)
text_c(draw, 902, 352, "ME", font(64), RED)
# body
rrect(draw, [748, 620, 878, 830], 26, fill=SHIRT_GREEN, outline=NAVY, width=4)
# left arm bent
draw.line([748, 660, 700, 730], fill=SHIRT_GREEN, width=24)
draw.ellipse([686, 716, 714, 744], fill=SKIN, outline=NAVY, width=3)
# head
draw.ellipse([770, 500, 856, 586], fill=SKIN, outline=NAVY, width=4)
# hair
draw.pieslice([766, 496, 860, 556], 180, 360, fill=HAIR)
draw.rectangle([766, 520, 860, 540], fill=HAIR)
# eyes + open smile
draw.ellipse([786, 536, 802, 552], fill=NAVY)
draw.ellipse([824, 536, 840, 552], fill=NAVY)
draw.arc([792, 552, 834, 580], 15, 165, fill=NAVY, width=5)

# ---- bottom band ----
draw.rectangle([0, 940, W, H], fill=CREAM)
text_c(draw, 512, 952, "GOING ONCE  •  GOING TWICE  •  SOLD!", font(42), NAVY)
text_c(draw, 512, 998, "make.fun", font(26), (90, 90, 90))

img.save(OUT, "PNG")
print("saved", OUT, os.path.getsize(OUT), "bytes")
