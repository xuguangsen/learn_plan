#!/usr/bin/env python3
"""
Download images from public Nankai University graduate admission-list pages.

The script crawls official Nankai pages, finds pages whose text looks related to
graduate admission lists, and saves images found on those pages. Many admission
lists are published as PDF/Office attachments instead of images, so attachment
downloading can be enabled with --include-files.

Examples:
  python scripts/scrape_nankai_admission_images.py
  python scripts/scrape_nankai_admission_images.py --year 2025 --include-files
  python scripts/scrape_nankai_admission_images.py --start https://xxgk.nankai.edu.cn/7wnlqyjsmd/list.htm --max-pages 80
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import mimetypes
import re
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.request import Request, urlopen


DEFAULT_START_URLS = [
    "https://xxgk.nankai.edu.cn/7wnlqyjsmd/list.htm",
    "https://yzb.nankai.edu.cn/",
    "https://graduate.nankai.edu.cn/",
]

DEFAULT_KEYWORDS = ["研究生", "录取名单", "拟录取", "硕士", "博士", "港澳台"]

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff"}
FILE_EXTS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar"}
PAGE_EXTS = {"", ".htm", ".html", ".shtml", ".php", ".asp", ".aspx", ".jsp", ".psp"}

USER_AGENT = (
    "Mozilla/5.0 (compatible; NankaiAdmissionAssetCrawler/1.0; "
    "+https://nankai.edu.cn/)"
)


@dataclass
class Link:
    url: str
    text: str = ""


@dataclass
class ParsedPage:
    title: str = ""
    text: str = ""
    links: list[Link] = field(default_factory=list)
    images: list[str] = field(default_factory=list)


class SimplePageParser(HTMLParser):
    """Small dependency-free parser for links, visible text, and image sources."""

    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.result = ParsedPage()
        self._tag_stack: list[str] = []
        self._current_link: dict[str, str] | None = None
        self._title_parts: list[str] = []
        self._text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_map = {name.lower(): value or "" for name, value in attrs}
        self._tag_stack.append(tag)

        if tag == "a":
            href = attrs_map.get("href", "").strip()
            if href:
                self._current_link = {"url": absolute_url(self.base_url, href), "text": ""}

        if tag == "img":
            for attr in ("src", "data-src", "data-original", "data-url", "originalsrc"):
                value = attrs_map.get(attr, "").strip()
                if value:
                    self.result.images.append(absolute_url(self.base_url, value))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "a" and self._current_link:
            self.result.links.append(
                Link(self._current_link["url"], compact_text(self._current_link["text"]))
            )
            self._current_link = None

        for index in range(len(self._tag_stack) - 1, -1, -1):
            if self._tag_stack[index] == tag:
                del self._tag_stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if not data or any(tag in {"script", "style", "noscript"} for tag in self._tag_stack):
            return

        if self._tag_stack and self._tag_stack[-1] == "title":
            self._title_parts.append(data)

        if self._current_link is not None:
            self._current_link["text"] += data

        self._text_parts.append(data)

    def close(self) -> None:
        super().close()
        self.result.title = compact_text(" ".join(self._title_parts))
        self.result.text = compact_text(" ".join(self._text_parts))


def compact_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def absolute_url(base_url: str, maybe_url: str) -> str:
    maybe_url = maybe_url.strip()
    if not maybe_url or maybe_url.startswith(("javascript:", "mailto:", "tel:")):
        return ""
    joined = urljoin(base_url, maybe_url)
    clean, _fragment = urldefrag(joined)
    return clean


def is_allowed_domain(url: str, domains: Iterable[str]) -> bool:
    host = urlparse(url).hostname or ""
    host = host.lower()
    return any(host == domain or host.endswith("." + domain) for domain in domains)


def extension_from_url(url: str) -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    return suffix


def looks_like_page(url: str) -> bool:
    return extension_from_url(url) in PAGE_EXTS


def looks_like_asset(url: str, include_files: bool) -> bool:
    suffix = extension_from_url(url)
    if suffix in IMAGE_EXTS:
        return True
    return include_files and suffix in FILE_EXTS


def text_matches(text: str, keywords: Iterable[str], year: str | None) -> bool:
    haystack = text.lower()
    if year and year not in haystack:
        return False
    return all(keyword.lower() in haystack for keyword in keywords)


def link_is_interesting(link: Link, keywords: Iterable[str], year: str | None) -> bool:
    combined = f"{link.text} {link.url}"
    if year and year in combined:
        return True
    return any(keyword in combined for keyword in keywords)


def fetch(url: str, timeout: int, retries: int, delay: float) -> tuple[bytes, str]:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        if attempt:
            time.sleep(delay * attempt)
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=timeout) as response:
                content_type = response.headers.get("Content-Type", "")
                return response.read(), content_type
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
    raise RuntimeError(f"fetch failed: {last_error}")


def decode_html(data: bytes, content_type: str) -> str:
    candidates: list[str] = []
    header_match = re.search(r"charset=([\w.-]+)", content_type, flags=re.I)
    if header_match:
        candidates.append(header_match.group(1))

    head = data[:4096].decode("ascii", errors="ignore")
    meta_match = re.search(r"charset=['\"]?([\w.-]+)", head, flags=re.I)
    if meta_match:
        candidates.append(meta_match.group(1))

    candidates.extend(["utf-8", "gb18030"])
    for encoding in dict.fromkeys(candidates):
        try:
            return data.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return data.decode("utf-8", errors="replace")


def parse_page(url: str, html: str) -> ParsedPage:
    parser = SimplePageParser(url)
    parser.feed(html)
    parser.close()
    return parser.result


def safe_filename(value: str, max_length: int = 90) -> str:
    value = re.sub(r"[\\/:*?\"<>|\s]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("._")
    if not value:
        value = "asset"
    return value[:max_length]


def filename_for_asset(url: str, data: bytes, content_type: str, index: int) -> str:
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    if not suffix:
        suffix = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ".bin"
    stem = safe_filename(Path(parsed.path).stem or f"asset_{index:04d}")
    digest = hashlib.sha1(data).hexdigest()[:10]
    return f"{stem}_{digest}{suffix}"


def write_manifest_row(manifest_path: Path, row: dict[str, str], header: list[str]) -> None:
    exists = manifest_path.exists()
    with manifest_path.open("a", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=header)
        if not exists:
            writer.writeheader()
        writer.writerow(row)


def download_asset(
    asset_url: str,
    page_url: str,
    out_dir: Path,
    manifest_path: Path,
    seen_assets: set[str],
    args: argparse.Namespace,
    count: int,
) -> bool:
    if asset_url in seen_assets or not asset_url:
        return False
    if not is_allowed_domain(asset_url, args.allow_domain):
        return False
    if not looks_like_asset(asset_url, args.include_files):
        return False

    try:
        data, content_type = fetch(asset_url, args.timeout, args.retries, args.delay)
    except RuntimeError as exc:
        print(f"[skip] {asset_url} ({exc})", file=sys.stderr)
        return False

    if len(data) < args.min_bytes:
        print(f"[skip] {asset_url} ({len(data)} bytes < --min-bytes)", file=sys.stderr)
        return False

    filename = filename_for_asset(asset_url, data, content_type, count)
    target = out_dir / filename
    target.write_bytes(data)
    seen_assets.add(asset_url)

    write_manifest_row(
        manifest_path,
        {
            "local_path": str(target),
            "asset_url": asset_url,
            "source_page": page_url,
            "content_type": content_type,
            "bytes": str(len(data)),
        },
        ["local_path", "asset_url", "source_page", "content_type", "bytes"],
    )
    print(f"[saved] {target}")
    return True


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Crawl official Nankai pages and download images from graduate admission-list pages."
    )
    parser.add_argument("--start", action="append", default=[], help="Start URL. Can be used multiple times.")
    parser.add_argument("--out", default="downloads/nankai_admission", help="Output directory.")
    parser.add_argument("--year", help="Only keep pages/links containing this year, for example 2025.")
    parser.add_argument(
        "--keyword",
        action="append",
        default=[],
        help="Required keyword for matching pages. Defaults to: 研究生, 录取名单, 拟录取.",
    )
    parser.add_argument(
        "--allow-domain",
        action="append",
        default=["nankai.edu.cn"],
        help="Allowed domain suffix. Defaults to nankai.edu.cn.",
    )
    parser.add_argument("--max-pages", type=int, default=120, help="Maximum pages to fetch.")
    parser.add_argument("--max-assets", type=int, default=300, help="Maximum assets to save.")
    parser.add_argument("--delay", type=float, default=0.8, help="Delay seconds between retries/downloads.")
    parser.add_argument("--timeout", type=int, default=20, help="Request timeout seconds.")
    parser.add_argument("--retries", type=int, default=1, help="Retries per URL.")
    parser.add_argument("--min-bytes", type=int, default=1024, help="Skip tiny assets.")
    parser.add_argument(
        "--include-files",
        action="store_true",
        help="Also download PDF/Word/Excel/ZIP/RAR attachments on matched pages.",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    start_urls = args.start or DEFAULT_START_URLS
    keywords = args.keyword or ["研究生", "录取名单"]

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.csv"

    queue: deque[str] = deque()
    for url in start_urls:
        clean = absolute_url(url, url)
        if clean and is_allowed_domain(clean, args.allow_domain):
            queue.append(clean)

    seen_pages: set[str] = set()
    seen_assets: set[str] = set()
    saved_count = 0

    while queue and len(seen_pages) < args.max_pages and saved_count < args.max_assets:
        page_url = queue.popleft()
        if page_url in seen_pages or not looks_like_page(page_url):
            continue
        seen_pages.add(page_url)

        try:
            data, content_type = fetch(page_url, args.timeout, args.retries, args.delay)
        except RuntimeError as exc:
            print(f"[skip] {page_url} ({exc})", file=sys.stderr)
            continue

        if "html" not in content_type.lower() and extension_from_url(page_url) not in PAGE_EXTS:
            continue

        parsed = parse_page(page_url, decode_html(data, content_type))
        page_hint = f"{parsed.title} {parsed.text[:2000]}"
        matched_page = text_matches(page_hint, keywords, args.year)
        print(f"[page] {'MATCH' if matched_page else 'scan '} {page_url}")

        if matched_page:
            candidates = list(parsed.images)
            candidates.extend(link.url for link in parsed.links if looks_like_asset(link.url, args.include_files))
            for asset_url in dict.fromkeys(candidates):
                if saved_count >= args.max_assets:
                    break
                if download_asset(asset_url, page_url, out_dir, manifest_path, seen_assets, args, saved_count + 1):
                    saved_count += 1
                    time.sleep(args.delay)

        for link in parsed.links:
            if not link.url or link.url in seen_pages:
                continue
            if not is_allowed_domain(link.url, args.allow_domain) or not looks_like_page(link.url):
                continue
            if matched_page or link_is_interesting(link, DEFAULT_KEYWORDS, args.year):
                queue.append(link.url)

        time.sleep(args.delay)

    print(f"\nDone. Pages scanned: {len(seen_pages)}. Assets saved: {saved_count}.")
    print(f"Output: {out_dir.resolve()}")
    if manifest_path.exists():
        print(f"Manifest: {manifest_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
