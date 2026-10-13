"""
Собирает интерактив из папки src/ в ОДИН самодостаточный файл index.html
(картинки, звук, стили и скрипты встраиваются внутрь — работает без интернета).

Запуск:  python build.py
"""
import base64
import mimetypes
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"

MIME = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".mp3": "audio/mpeg", ".svg": "image/svg+xml"}


def data_uri(rel):
    p = SRC / rel
    mime = MIME.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode("ascii")


html = (SRC / "index.html").read_text(encoding="utf-8")

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
              lambda m: "<style>\n" + (SRC / m.group(1)).read_text(encoding="utf-8") + "</style>", html)
html = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: "<script>\n" + (SRC / m.group(1)).read_text(encoding="utf-8") + "</script>", html)
html = re.sub(r'src="((?:img|audio)/[^"]+)"', lambda m: f'src="{data_uri(m.group(1))}"', html)
html = html.replace("Собрать один офлайн-файл: python build.py  →  ../index.html",
                    "Этот файл собран автоматически (python build.py) — исходники в папке src.")

OUT.write_text(html, encoding="utf-8")
print(f"Готово: {OUT}  ({OUT.stat().st_size / 1024:.0f} КБ)")
