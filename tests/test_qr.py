from app.qr import qr_png, review_url


def test_png_poster_includes_png_header_and_is_larger_than_bare_qr() -> None:
    url = review_url("demo-cafe", "7")
    bare = qr_png(url)
    poster = qr_png(url, title="Demo Cafe", table="7")
    assert bare[:8] == b"\x89PNG\r\n\x1a\n"
    assert poster[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(poster) > len(bare)
