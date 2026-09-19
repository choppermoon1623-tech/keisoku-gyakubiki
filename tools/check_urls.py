# -*- coding: utf-8 -*-
"""index.html の var REF に書いたページが、まだ生きているか確かめる。

  python tools/check_urls.py

Google Sites は存在しないページでも HTTP 200 を返すことがあるので、
本文に「ページが見つかりません」が入っていないかも見る。
ファイル名が REF に書いたものと変わっていたら、それも知らせる。
"""
import io, os, re, sys, urllib.parse, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "..", "index.html")
LAB = "https://sites.google.com/s.hokkyodai.ac.jp/tech/"


def load_ref():
    """index.html から var REF { ... } を読み、{ページ: set(ファイル名)} を作る"""
    src = io.open(HTML, encoding="utf-8").read()
    block = re.search(r"var REF = \{(.*?)\n\};", src, re.S)
    if not block:
        sys.exit("index.html に var REF が見つかりません")
    body = block.group(1)
    # MB という別名でまとめている分も拾う
    mb = re.search(r"var MB = \{p:'([^']*)', f:'([^']*)'", src)
    pages = {}
    if mb:
        pages.setdefault(mb.group(1), set()).add(mb.group(2))
    for pg, fl in re.findall(r"\{p:'([^']*)',f:'([^']*)'", body):
        pages.setdefault(pg, set()).add(fl)
    # 「資料ページなし」のときに送る先
    idx = re.search(r"var LAB_IDX = '([^']*)'", src)
    if idx:
        pages.setdefault(idx.group(1), set())
    nones = len(re.findall(r":null", body))
    return pages, nones


def check(page):
    url = LAB + urllib.parse.quote(page, safe="")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
            code = r.status
    except Exception as e:
        return getattr(e, "code", -1), set()
    if u"ページが見つかりません" in body or u"Page not found" in body:
        return 404, set()
    files = set(f for f in re.findall(r"[^\"'>＜<\s]{2,80}\.(?:pptx|pdf|mp4|docx|xlsx)", body)
                if not f.startswith("http"))
    return code, files


def main():
    pages, nones = load_ref()
    print(u"REF に書かれているページ %d件（資料ページなし %d件）を確かめます\n" % (len(pages), nones))
    ng = 0
    for page in sorted(pages):
        code, found = check(page)
        want = pages[page]
        if code != 200:
            print(u"NG  %4s  %s" % (code, page))
            ng += 1
            continue
        missing = [f for f in want if f not in found]
        if missing:
            print(u"?   200   %s" % page)
            print(u"          REF のファイル名が見あたりません: %s" % u" / ".join(missing))
            print(u"          いま置かれているもの: %s" % (u" / ".join(sorted(found)[:5]) or u"（見つからず）"))
            ng += 1
        else:
            print(u"OK  200   %s" % page)
    print(u"\n%d件中 %d件が要確認" % (len(pages), ng))
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
