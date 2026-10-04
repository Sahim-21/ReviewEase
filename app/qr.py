from io import BytesIO
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont
from qrcode.image.svg import SvgPathImage

from app.config import settings

_FONT_CANDIDATES = (
    Path("C:/Windows/Fonts/arial.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
)


def review_url(slug: str, table: str | None = None) -> str:
    base = settings.app_public_url.rstrip("/")
    url = f"{base}/r/{slug}"
    if table:
        url = f"{url}?t={table}"
    return url


def _font(size: int):
    for path in _FONT_CANDIDATES:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def qr_png(url: str, *, title: str | None = None, table: str | None = None) -> bytes:
    qr = qrcode.make(url, box_size=10, border=2)
    qr_image = qr.convert("RGB")
    if not title:
        buffer = BytesIO()
        qr_image.save(buffer, format="PNG")
        return buffer.getvalue()

    pad = 28
    footer = 88 if table else 64
    width = qr_image.width + pad * 2
    height = qr_image.height + pad * 2 + footer
    canvas = Image.new("RGB", (width, height), "white")
    canvas.paste(qr_image, (pad, pad))
    draw = ImageDraw.Draw(canvas)
    name_font = _font(22)
    hint_font = _font(14)
    draw.text((pad, qr_image.height + pad + 12), title, fill=(23, 23, 23), font=name_font)
    subtitle = f"Table {table}" if table else "Scan to share how this visit went"
    draw.text((pad, qr_image.height + pad + 42), subtitle, fill=(82, 82, 82), font=hint_font)
    buffer = BytesIO()
    canvas.save(buffer, format="PNG")
    return buffer.getvalue()


def qr_svg(url: str) -> bytes:
    image = qrcode.make(url, image_factory=SvgPathImage, box_size=8, border=2)
    buffer = BytesIO()
    image.save(buffer)
    raw = buffer.getvalue()
    return raw if isinstance(raw, bytes) else bytes(raw)
