"""A photograph-like picture drawn with Pillow alone (smooth colour, hard edges, grain), for tests with no network."""
import random
from PIL import Image, ImageChops, ImageDraw


def fake_photo(seed, w=1920, h=1280):
    r = random.Random(seed)
    # smooth colour: three gradients of different angles, blended
    chans = []
    for k in range(3):
        g = Image.linear_gradient("L").resize((w, h)).rotate(r.choice((0, 90, 45, 135)) + k * 20, expand=False)
        chans.append(ImageChops.offset(g, r.randint(0, w), r.randint(0, h)))
    im = Image.merge("RGB", chans)
    d = ImageDraw.Draw(im)
    for _ in range(25):   # edges: blocks and discs of other colours
        x0, y0 = r.randint(0, w - 60), r.randint(0, h - 60)
        box = (x0, y0, x0 + r.randint(30, w // 3), y0 + r.randint(30, h // 3))
        col = (r.randint(0, 255), r.randint(0, 255), r.randint(0, 255))
        (d.ellipse if r.random() < .4 else d.rectangle)(box, fill=col)
    grain = Image.effect_noise((w, h), 14).convert("RGB")
    return ImageChops.add(ImageChops.subtract(im, Image.new("RGB", (w, h), (7, 7, 7))), ImageChops.subtract(grain, Image.new("RGB", (w, h), (120, 120, 120))))
