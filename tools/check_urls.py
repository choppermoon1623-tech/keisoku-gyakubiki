# -*- coding: utf-8 -*-
"""石川研究室サイトの、リンク先ページがまだ生きているか確かめる。

  python tools/check_urls.py

見るのは index.html の中の次の2か所。

  var REF      … 装置カードの資料リンク（ファイル名も合っているか照合する）
  var EXAMPLES … ②授業の例の配布資料リンク（ここが 404 になった前例あり）

Google Sites は存在しないページでも HTTP 200 を返すことがあるので、
本文に「ページが見つかりません」が入っていないかも見る。
"""
import io, os, re, sys, urllib.parse, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "..", "index.html")
LAB = "https://sites.google.com/s.hokkyodai.ac.jp/tech/"


def load_pages():
    """index.html から {ページ名: そこにあるはずのファイル名の集合} を作る"""
    src = io.open(HTML, encoding="utf-8").read()
    pages = {}

    ref = re.search(r"var REF = \{(.*?)\n\};", src, re.S)
    if not ref:
        sys.exit("index.html に var REF が見つかりません")
    body = ref.group(1)

    # MB という別名でまとめている分
    mb = re.search(r"var MB = \{p:'([^']*)', f:'([^']*)'", src)
    if mb:
        pages.setdefault(mb.group(1), set()).add(mb.group(2))
    for pg, fl in re.findall(r"\{p:'([^']*)',f:'([^']*)'", body):
        pages.setdefault(pg, set()).add(fl)

    # ②授業の例が指しているページ
    ex = re.search(r"var EXAMPLES = \[(.*?)\n\];", src, re.S)
    if ex:
        for pg in re.findall(r",p:'([^']*)',", ex.group(1)):
            pages.setdefault(pg, set())

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
    if "ページが見つかりません" in body or "Page not found" in body:
        return 404, set()
    files = set(f for f in re.findall(r"[^\"'>＜<\s]{2,80}\.(?:pptx|pdf|mp4|docx|xlsx)", body)
                if not f.startswith("http"))
    return code, files


def main():
    pages, nones = load_pages()
    print("REF と EXAMPLES が指しているページ %d件（資料ページなし %d件）を確かめます\n"
          % (len(pages), nones))
    ng = 0
    for page in sorted(pages):
        code, found = check(page)
        want = pages[page]
        if code != 200:
            print("NG  %4s  %s" % (code, page))
            ng += 1
            continue
        missing = [f for f in want if f not in found]
        if missing:
            print("?   200   %s" % page)
            print("          REF のファイル名が見あたりません: %s" % " / ".join(missing))
            print("          いま置かれているもの: %s"
                  % (" / ".join(sorted(found)[:5]) or "（見つからず）"))
            ng += 1
        else:
            note = "" if want else "（ページの実在だけ確認）"
            print("OK  200   %s%s" % (page, note))
    print("\n%d件中 %d件が要確認" % (len(pages), ng))
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
