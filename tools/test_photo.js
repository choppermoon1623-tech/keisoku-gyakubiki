/* ①「写真でえらぶ」の確認。
     node tools/test_photo.js
   写真は tools/build_photos.py が index.html の PHOTO に埋めこむ。 */
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log("  ○ " + name); }
  else { fail++; console.log("  × " + name + (info !== undefined ? "  … " + info : "")); }
}
function mk(before) {
  const dom = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.HTMLElement.prototype.scrollIntoView = function () {}; if (before) before(w); } });
  return { w: dom.window, d: dom.window.document, $: id => dom.window.document.getElementById(id) };
}
function names(d) {
  const cols = []; let cur = null;
  d.querySelectorAll("#list > *").forEach(el => {
    if (el.classList.contains("ghead")) { cur = []; cols.push(cur); }
    else if (cur) [...el.querySelectorAll("h3")].forEach(e => cur.push(e.textContent));
  });
  return cols;
}

console.log("=== 写真のデータ ===");
{
  const { w } = mk();
  const P = w.eval("PHOTO"), DEV = w.eval("DEV"), AL = w.eval("PHOTO_ALIAS");
  const ids = DEV.map(v => v.id);
  ok("写真が21枚ある", Object.keys(P).length === 21, Object.keys(P).length);
  ok("写真のキーはすべて DEV の id", Object.keys(P).every(k => ids.includes(k)),
     Object.keys(P).filter(k => !ids.includes(k)).join(","));
  ok("写真はすべて data:image/webp", Object.values(P).every(s => /^data:image\/webp;base64,/.test(s)));
  ok("借りる先の写真が実在する", Object.values(AL).every(a => P[a.id]));
  ok("借りるのはCO2・煙・降雨だけ", Object.keys(AL).sort().join() === "s-co2,s-kemuri,s-kouu");
}

console.log("=== はじめは「写真でえらぶ」 ===");
{
  const { w, d, $ } = mk();
  ok("写真のタイルが51枚", d.querySelectorAll("#list .ptile").length === 51, d.querySelectorAll("#list .ptile").length);
  ok("くわしいカードは出ていない", d.querySelectorAll("#list .card").length === 0);
  ok("切りかえボタンは「写真」が押されている",
     d.querySelector('.vbtn[data-view="photo"]').getAttribute("aria-pressed") === "true");
  const soil = [...d.querySelectorAll("#list .ptile")].find(t => /土壌水分/.test(t.textContent));
  ok("写真のある装置は img を出す", !!soil.querySelector("img.pimg"));
  ok("写真には装置名の alt", /土壌水分センサ/.test(soil.querySelector("img.pimg").alt));
  const mb = [...d.querySelectorAll("#list .ptile")].find(t => /A・Bボタン/.test(t.textContent));
  ok("内蔵機能は「micro:bit本体の機能」と文字で出す", /micro:bit本体の機能/.test(mb.querySelector(".nophoto").textContent));
  const pump = [...d.querySelectorAll("#list .ptile")].find(t => /水中ポンプ/.test(t.textContent));
  ok("写真がないアクション装置は空の枠にしない", !!pump.querySelector(".nophoto") && pump.querySelector(".nophoto").textContent.trim() !== "");
  const co2 = [...d.querySelectorAll("#list .ptile")].find(t => /CO2/.test(t.textContent));
  ok("CO2は借りた写真だと書く", /代わりに使うアルコールセンサ/.test(co2.textContent));
  ok("CO2のタイルにも模擬実験のバッジ", !!co2.querySelector(".badge.sim"));
  ok("受付コードがないときは「未確認」を並べない", !d.querySelector("#list .ptile .eq-badge"));
}

console.log("=== 検索の順位は表示のしかたで変わらない ===");
{
  const { w, d, $ } = mk();
  const qs = ["土がかわいたら", "くらい", "まわしたい", "人が近づいたか", "換気", "知らせたい"];
  qs.forEach(q => {
    $("q").value = q; $("q").dispatchEvent(new w.Event("input"));
    w.setView("photo"); const a = JSON.stringify(names(d));
    w.setView("list"); const b = JSON.stringify(names(d));
    ok("『" + q + "』写真とくわしくで同じ並び", a === b, a + " / " + b);
  });
}

console.log("=== 写真を押すと、くわしい説明が開く ===");
{
  const { w, d, $ } = mk();
  $("t-find").click();
  const tile = [...d.querySelectorAll("#list .ptile")].find(t => /土壌水分/.test(t.textContent));
  tile.querySelector(".pshow").click();
  const dlg = $("devdlg");
  ok("ダイアログが開く", dlg.open || dlg.hasAttribute("open"));
  ok("中身はくわしいカード", !!$("devdlg-body").querySelector(".card.dev h3"));
  ok("資料リンクがある", !!$("devdlg-body").querySelector(".ref"));
  ok("大きい写真がある", !!$("devdlg-body").querySelector("img.cimg"));
  $("devdlg-body").querySelector(".pick").click();
  ok("「設計に入れる」で閉じる", !(dlg.open || dlg.hasAttribute("open")));
  ok("トレイに入る", /土壌水分センサ/.test($("tray-s").textContent));
  ok("トレイに写真が出る", !!$("tray-s").querySelector("img.timg") && !$("tray-s").querySelector(".tph").hidden);
  ok("④のスロットに写真が出る", !!$("slot-s").querySelector("img.simg"));
  const t2 = [...d.querySelectorAll("#list .ptile")].find(t => /土壌水分/.test(t.textContent));
  ok("タイルがえらんだ状態になる", t2.classList.contains("picked") && /えらんだ/.test(t2.querySelector(".pick").textContent));

  const btn = [...d.querySelectorAll("#list .ptile")].find(t => /水中ポンプ/.test(t.textContent)).querySelector(".pick");
  btn.click();
  ok("タイルの「設計に入れる」でも入る", /水中ポンプ/.test($("tray-a").textContent));
  ok("写真がない装置はトレイの写真枠を隠す", $("tray-a").querySelector(".tph").hidden);

  [...d.querySelectorAll("#list .ptile")].find(t => /炎センサ/.test(t.textContent)).querySelector(".pshow").click();
  $("devdlg-x").click();
  ok("「とじる」で閉じる", !(dlg.open || dlg.hasAttribute("open")));
  ok("閉じても選んだものは変わらない", /土壌水分センサ/.test($("tray-s").textContent));
}

console.log("=== 表示のしかたを覚えておく ===");
{
  const { w, d, $ } = mk();
  d.querySelector('.vbtn[data-view="list"]').click();
  ok("「くわしく見る」でカードになる", d.querySelectorAll("#list .card.dev").length === 51);
  ok("くわしいカードにも写真", !!d.querySelector("#list .card.dev img.cimg"));
  ok("ボタンの押された状態が変わる", d.querySelector('.vbtn[data-view="list"]').getAttribute("aria-pressed") === "true");
  ok("localStorage に残る", w.localStorage.getItem("keisoku-gyakubiki-view") === "list");
  const again = mk(win => win.localStorage.setItem("keisoku-gyakubiki-view", "list"));
  ok("次に開いたときも「くわしく見る」", again.d.querySelectorAll("#list .card.dev").length === 51);
  const broken = mk(win => { Object.defineProperty(win, "localStorage", { get() { throw new Error("blocked"); } }); });
  ok("localStorage が使えなくても写真で出る", broken.d.querySelectorAll("#list .ptile").length === 51);
}

console.log("\n結果: " + pass + " 件 合格 / " + fail + " 件 不合格");
process.exit(fail ? 1 : 0);
