import html
import re

_TAG = re.compile(r"<[^>]*>")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_JS = re.compile(r"javascript:", re.IGNORECASE)


def strip_html(value: str) -> str:
    """Strip tags, entities, control chars, and javascript: URLs from untrusted text."""
    text = html.unescape(value)
    text = _TAG.sub("", text)
    text = html.unescape(text)
    text = _JS.sub("", text)
    text = _CTRL.sub("", text)
    return " ".join(text.split()).strip()
