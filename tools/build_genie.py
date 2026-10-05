"""⓪「ジーニーに当ててもらう」を index.html に組みこむ。

  python tools/build_genie.py

- 画像: tools/genie/genie.png → 400x600 の WebP → GENIE:BEGIN〜GENIE:END の間
  （1ファイルで動く・オフラインで動く、を崩さないため data: URI で埋めこむ）
- 2回目以降は画像だけを差しかえる。JS・CSS は index.html を直接直すこと。
"""
import base64, io, pathlib, re

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
G = ROOT / "tools" / "genie"


def img_uri():
    im = Image.open(G / "genie.png").convert("RGB").resize((400, 600), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=78, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def sub1(s, old, new):
    assert s.count(old) == 1, ("見つからない／2つ以上ある", old[:60])
    return s.replace(old, new)


s = HTML.read_text(encoding="utf-8")
uri = img_uri()
line = '/* GENIE:BEGIN */\nvar GENIE_IMG = "%s";\n/* GENIE:END */' % uri

if "GENIE:BEGIN" in s:
    s = re.sub(r"/\* GENIE:BEGIN \*/.*?/\* GENIE:END \*/", lambda m: line, s, flags=re.S)
else:
    # 画像
    s = sub1(s, "/* PHOTO:END */\n</script>\n", "/* PHOTO:END */\n</script>\n<script>\n" + line + "\n</script>\n")
    # CSS（デザイン刷新のうしろ＝いちばん最後に置いて上書きを効かせる）
    css = (G / "genie.css").read_text(encoding="utf-8")
    i = s.index("</style>")
    s = s[:i] + css + s[i:]
    # JS 本体
    js = (G / "genie_block.js").read_text(encoding="utf-8")
    s = sub1(s, "/* この端末で、もう何か書き始めているか。", js + "\n/* この端末で、もう何か書き始めているか。")
    # 入口に足す（いちばん前）
    s = sub1(s, "var M0MODES=[\n",
             "var M0MODES=[\n {k:'genie',  nm:'ジーニーに当ててもらう', d:'質問に「はい／いいえ」で答えるだけ。あなたの困りごとを当てにくる。'},\n")
    # 状態
    old = "gwhat:'', gdare:'', gima:''};"
    assert s.count(old) == 2, "m0 の初期値が2か所にない"
    s = s.replace(old, "gwhat:'', gdare:'', gima:'', gn:gnNew()};")
    s = sub1(s, "  if(!m0.ans || typeof m0.ans!=='object') m0.ans={};\n",
             "  if(!m0.ans || typeof m0.ans!=='object') m0.ans={};\n"
             "  if(!m0.gn || typeof m0.gn!=='object' || !Array.isArray(m0.gn.h)) m0.gn=gnNew();\n")
    # 入口ボタンにジーニーの顔
    s = sub1(s, "    return '<button type=\"button\" class=\"m-mode'+(m0.mode===x.k?' on':'')+'\" data-m=\"'+x.k+'\" aria-pressed=\"'+(m0.mode===x.k)+'\">'\n"
                "         + '<b>'+esc(x.nm)+'</b><span>'+esc(x.d)+'</span></button>';",
             "    var gn = x.k==='genie';\n"
             "    return '<button type=\"button\" class=\"m-mode'+(gn?' gn':'')+(m0.mode===x.k?' on':'')+'\" data-m=\"'+x.k+'\" aria-pressed=\"'+(m0.mode===x.k)+'\">'\n"
             "         + (gn ? '<img class=\"gn-av\" src=\"'+GENIE_IMG+'\" alt=\"\">' : '')\n"
             "         + '<b>'+esc(x.nm)+'</b><span>'+esc(x.d)+'</span></button>';")
    # 描きわけ
    s = sub1(s, "    if($('m-sheet-go')) $('m-sheet-go').onclick=m0PrintSheet;\n  }else{\n",
             "    if($('m-sheet-go')) $('m-sheet-go').onclick=m0PrintSheet;\n"
             "  }else if(m0.mode==='genie'){\n    w.innerHTML=gnHtml(); gnBind(w);\n  }else{\n")

HTML.write_text(s, encoding="utf-8")
print("ok", len(uri) // 1024, "KB")
