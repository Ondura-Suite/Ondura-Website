#!/usr/bin/env python3
"""Render the bilingual Ondura website from src/ into site/.

Templates in src/pages/ hold both languages side by side:

    {{de}}Deutscher Text{{en}}English text{{/}}

Other placeholders:
    {{> name}}        include src/partials/name.html
    {{lang}}          "de" or "en"
    {{base}}          relative path to the site root ("" or "../")
    {{href:page}}     link to another page in the current language
    {{alt_href}}      the current page in the other language
    {{url:lang}}      absolute URL of the current page in a language
    {{lang_switch}}   the DE/EN switcher

English is the default and lives at the root, German under /de/.
Only the standard library is used, so the build runs anywhere.
"""

from __future__ import annotations

import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "site")
SITE_URL = "https://ondura.mirranet.de/"
LANGS = ("en", "de")

# Template name -> output path per language.
PAGES = {
    "index": {"en": "index.html", "de": "de/index.html"},
    "legal": {"en": "legal-notice.html", "de": "de/impressum.html"},
    "privacy": {"en": "privacy.html", "de": "de/datenschutz.html"},
}

LANG_BLOCK = re.compile(r"\{\{de\}\}(.*?)\{\{en\}\}(.*?)\{\{/\}\}", re.S)
INCLUDE = re.compile(r"\{\{>\s*([\w-]+)\s*\}\}")
HREF = re.compile(r"\{\{href:([\w-]+)\}\}")
URL = re.compile(r"\{\{url:(de|en)\}\}")


def rel_link(from_path: str, to_path: str) -> str:
    """Relative link between two output files; index.html becomes its folder."""
    from_dir = os.path.dirname(from_path) or "."
    to_dir, to_file = os.path.split(to_path)
    rel_dir = os.path.relpath(to_dir or ".", from_dir).replace(os.sep, "/")
    if to_file == "index.html":
        return "./" if rel_dir == "." else rel_dir + "/"
    return to_file if rel_dir == "." else f"{rel_dir}/{to_file}"


def absolute_url(path: str) -> str:
    return SITE_URL + (path[: -len("index.html")] if path.endswith("index.html") else path)


def lang_switch(page: str, lang: str) -> str:
    here = PAGES[page][lang]
    items = []
    for code, label, name in (("de", "DE", "Deutsch"), ("en", "EN", "English")):
        current = ' aria-current="true"' if code == lang else ""
        items.append(
            f'<a href="{rel_link(here, PAGES[page][code])}" hreflang="{code}" lang="{code}" '
            f'data-set-lang="{code}" title="{name}"{current}>{label}</a>'
        )
    aria = "Sprache" if lang == "de" else "Language"
    return f'<div class="lang" role="group" aria-label="{aria}">' + "".join(items) + "</div>"


def render(page: str, lang: str) -> str:
    text = (SRC / "pages" / f"{page}.html").read_text(encoding="utf-8")

    # Partials may include further partials; expand until stable.
    for _ in range(5):
        expanded = INCLUDE.sub(
            lambda m: (SRC / "partials" / f"{m.group(1)}.html").read_text(encoding="utf-8").rstrip("\n"),
            text,
        )
        if expanded == text:
            break
        text = expanded

    text = LANG_BLOCK.sub(lambda m: m.group(1) if lang == "de" else m.group(2), text)

    here = PAGES[page][lang]
    other = "de" if lang == "en" else "en"
    depth = here.count("/")
    text = text.replace("{{lang}}", lang)
    text = text.replace("{{base}}", "../" * depth)
    text = text.replace("{{alt_href}}", rel_link(here, PAGES[page][other]))
    text = text.replace("{{lang_switch}}", lang_switch(page, lang))
    text = HREF.sub(lambda m: rel_link(here, PAGES[m.group(1)][lang]), text)
    text = URL.sub(lambda m: absolute_url(PAGES[page][m.group(1)]), text)

    leftover = re.findall(r"\{\{[^}]*\}\}", text)
    if leftover:
        raise SystemExit(f"{page} ({lang}): unresolved placeholders {sorted(set(leftover))}")
    return text


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC / "static", OUT)
    for page, targets in PAGES.items():
        for lang in LANGS:
            dest = OUT / targets[lang]
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(render(page, lang), encoding="utf-8")
    print(f"Built {len(PAGES) * len(LANGS)} pages into {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
