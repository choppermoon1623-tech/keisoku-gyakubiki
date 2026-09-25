"""装置の写真を index.html に埋めこむ。

index.html は「1ファイルをコピーすれば動く・オフラインでも動く」が約束なので、
写真は別ファイルにせず、小さく縮めた WebP を data: URI にして `var PHOTO` に入れる。

  1) 元写真 → tools/photos/<装置id>.webp（長辺 360px）
       python tools/build_photos.py --src "C:/Users/USER/Pictures/センサ"
     元写真のファイル名と装置 id の対応は下の NAMES。
  2) tools/photos/*.webp → index.html の PHOTO:BEGIN〜PHOTO:END の間
       python tools/build_photos.py
     （1 のあとは自動で 2 も行う）

写真を足すとき：tools/photos/<装置id>.webp を置いて 2 を実行するだけでよい。
装置 id は index.html の `var DEV` の id。
例外は microbit.webp で、micro:bit 内蔵の機能すべてに使う。
"""
import argparse, base64, io, pathlib, re, sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "tools" / "photos"
HTML = ROOT / "index.html"
LONG = 360
QUALITY = 72

# 元写真のファイル名（拡張子なし） → 装置 id
NAMES = {
    "アルコールセンサ": "s-alcohol",
    "カラーセンサ": "s-color",
    "サーミスタ": "s-ondo-se",
    "レバースイッチ": "s-kaihei",
    "人感センサ": "s-jinkan",
    "光センサ": "s-hikari",
    "光距離センサ": "s-kyori",
    "土壌水分センサ": "s-dojou",
    "年月日時刻": "s-jikoku",
    "押しボタンセンサ": "s-button",
    "推移センサ": "s-suii",
    "水位センサ": "s-suii",
    "気圧センサ": "s-kiatsu",
    "湿度センサ": "s-shitsudo",
    "炎センサ": "s-honoo",
    "照度センサ": "s-shoudo",
    "異物検知センサ": "s-ibutsu",
    "磁気スイッチ": "s-jiki",
    "重さセンサ": "s-omosa",
    "障害物センサ": "s-dansa",
    "静電タッチセンサ": "s-touch",
    "非接触型温度センサ": "s-ondo-hi",
    # アクション装置
    "ギアドモータ": "a-geared",
    "サーボモータ": "a-servo",
    "OLEDディスプレイ": "a-oled",
    "フィルムヒータ": "a-heater",
    "ペルチェ素子": "a-peltier",
    "振動モータ": "a-shindou",
    # micro:bit 本体。内蔵機能（DEV で b:1 のもの）すべてにこの写真を出す
    "マイクロビット": "microbit",
}


def shrink(src: pathlib.Path) -> bytes:
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((LONG, LONG), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue()


def from_src(src_dir: pathlib.Path):
    OUT.mkdir(parents=True, exist_ok=True)
    unknown = []
    for f in sorted(src_dir.iterdir()):
        if f.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        dev = NAMES.get(f.stem)
        if not dev:
            unknown.append(f.name)
            continue
        data = shrink(f)
        (OUT / (dev + ".webp")).write_bytes(data)
        print(f"{f.name} -> {dev}.webp ({len(data)//1024} KB)")
    if unknown:
        print("対応する装置 id が NAMES に無いので飛ばした:", ", ".join(unknown), file=sys.stderr)


def embed():
    lines = []
    for f in sorted(OUT.glob("*.webp")):
        b64 = base64.b64encode(f.read_bytes()).decode("ascii")
        lines.append(f"'{f.stem}':'data:image/webp;base64,{b64}'")
    block = "/* PHOTO:BEGIN */\nvar PHOTO = {\n" + ",\n".join(lines) + "\n};\n/* PHOTO:END */"
    html = HTML.read_text(encoding="utf-8")
    new, n = re.subn(r"/\* PHOTO:BEGIN \*/.*?/\* PHOTO:END \*/", lambda m: block, html, flags=re.S)
    if n != 1:
        sys.exit("index.html に PHOTO:BEGIN〜PHOTO:END の目印が見つからない")
    HTML.write_text(new, encoding="utf-8", newline="\n")
    print(f"index.html に {len(lines)} 枚を埋めこんだ（{len(block)//1024} KB）")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="元写真のフォルダ（ファイル名は NAMES のとおり）")
    a = ap.parse_args()
    if a.src:
        from_src(pathlib.Path(a.src))
    embed()
