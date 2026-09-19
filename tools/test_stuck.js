/* ⑤「行きづまったら」タブの動作確認 */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const HTML = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log("  NG  " + name + (extra ? "  → " + extra : "")); }
}

const errs = [];
const dom = new JSDOM(HTML, {
  url: "http://localhost/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
dom.window.addEventListener("error", e => errs.push(String(e.error || e.message)));
dom.window.onerror = (m) => errs.push(String(m));
const w = dom.window, d = w.document;
const $ = id => d.getElementById(id);
w.HTMLElement.prototype.scrollIntoView = function () {};
w.scrollTo = function () {};

console.log("=== 読み込み ===");
ok("スクリプトがエラーなく走る", errs.length === 0, errs.join(" / "));
ok("⑤タブのボタンがある", !!$("t-stuck"));
ok("⑤タブの中身がある", !!$("p-stuck"));
ok("①〜④はそのまま", ["t-find", "t-ex", "t-step", "t-memo"].every(i => !!$(i)));

console.log("=== タブ切りかえ ===");
$("t-stuck").click();
ok("⑤を押すと⑤が出る", $("p-stuck").hidden === false);
ok("⑤を押すと①が隠れる", $("p-find").hidden === true);
ok("aria-selectedが⑤に移る", $("t-stuck").getAttribute("aria-selected") === "as".slice(0,0) + "true");
$("t-find").click();
ok("①に戻れる", $("p-find").hidden === false && $("p-stuck").hidden === true);

console.log("=== ①タブの回帰（セレクタを絞った影響） ===");
/* 押すと chips は描き直されるので、そのつど引き直す */
const chipSel = "#chips-s .chip";
const cat = d.querySelector(chipSel).dataset.cat;
d.querySelector(chipSel).click();
ok("カテゴリのボタンがまだ効く",
   d.querySelector('#chips-s .chip[data-cat="' + cat + '"]').getAttribute("aria-pressed") === "true");
d.querySelector('#chips-s .chip[data-cat="' + cat + '"]').click();
ok("もう一度押すと解除される",
   d.querySelector('#chips-s .chip[data-cat="' + cat + '"]').getAttribute("aria-pressed") === "false");
$("q").value = "土がかわいたら";
$("q").dispatchEvent(new w.Event("input"));
const firstCard = d.querySelector("#list .card h3");
ok("①の検索がまだ効く（土がかわいたら→土壌水分センサ）",
   firstCard && firstCard.textContent.indexOf("土壌水分") >= 0,
   firstCard && firstCard.textContent);
ok("①の「これを使う」がまだ効く", !!d.querySelector("#list .pick"));
$("clr").click();

console.log("=== 書かないと押せない ===");
$("t-stuck").click();
ok("最初はボタンが押せない", $("g-go").disabled === true);
ok("あと4つと出る", /あと4つ/.test($("g-gate").textContent), $("g-gate").textContent);

function type(id, v) { $(id).value = v; $(id).dispatchEvent(new w.Event("input")); }
type("g-theme", "祖父が夜トイレに行くとき、暗くてあぶない");
ok("1つ書いてもまだ押せない", $("g-go").disabled === true);
ok("あと3つ", /あと3つ/.test($("g-gate").textContent), $("g-gate").textContent);
type("g-mine", "人が通ったら電気をつける案を考えた");
type("g-stuck", "夜だけ動かしたいのに、昼も反応してしまう。どう区別すればいいか分からない");
ok("3つ書いてもまだ押せない（困っていること未選択）", $("g-go").disabled === true);
ok("あと1つ", /あと1つ/.test($("g-gate").textContent), $("g-gate").textContent);

const kinds = d.querySelectorAll("#g-kinds .chip");
ok("困っていることの選択肢が5つ", kinds.length === 5, kinds.length);
kinds[2].click(); /* 条件（しきい値） */
ok("4つそろうと押せる", $("g-go").disabled === false);
ok("押せる旨が出る", /押せます/.test($("g-gate").textContent), $("g-gate").textContent);
kinds[2].click();
ok("選び直しで外すと、また押せなくなる", $("g-go").disabled === true);
kinds[2].click();

console.log("=== ヒントの中身 ===");
$("g-go").click();
const out = $("g-out");
const txt = out.textContent;
ok("ヒントが出る", out.innerHTML.length > 200);
ok("装置の見出しが出る", /書いた言葉から見つかった装置/.test(txt));
ok("確かめたいことが出る", /いま、確かめたいこと/.test(txt));
ok("困っていることへのヒントが出る", /困っていることへのヒント/.test(txt));
ok("選んだ種類に合ったヒントが出る", /しきい値.*分からないとき|条件（しきい値）の決め方/.test(txt), txt.slice(0,0));
ok("条件・きまりが空だと指摘される", /「条件・きまり」が空のまま/.test(txt));
ok("④が空だと指摘される", /設計メモが、まだ空いている/.test(txt));
ok("最後のひと押しが出る", /印刷して先生に見せる/.test(txt));
ok("エラーは出ていない", errs.length === 0, errs.join(" / "));

const devNames = [...out.querySelectorAll(".gdev b")].map(e => e.textContent);
console.log("  候補（暗い・人が通る）:", devNames.join(" / "));
ok("暗さに関わるセンサが候補に出る", devNames.some(n => /光センサ/.test(n)), devNames.join("/"));
ok("『夜だけ動かしたい』から時刻も候補に出る", devNames.some(n => /時刻/.test(n)), devNames.join("/"));
ok("『電気をつける』からスマートプラグが出る", devNames.some(n => /スマートプラグ/.test(n)), devNames.join("/"));
const exNames = [...out.querySelectorAll(".ex h3")].map(e => e.textContent);
console.log("  近い授業例:", exNames.join(" / "));

console.log("=== ヒントから④へ ===");
const pickBtn = out.querySelector(".gdev .pick");
const pickedName = pickBtn.closest(".gdev").querySelector("b").textContent;
pickBtn.click();
ok("「これを使う」で④に移る", $("p-memo").hidden === false);
ok("④のスロットに入る", $("slot-s").textContent.indexOf(pickedName) >= 0 || $("slot-a").textContent.indexOf(pickedName) >= 0,
   $("slot-s").textContent + " | " + $("slot-a").textContent);

console.log("=== 書いたものが残る ===");
const saved = JSON.parse(w.localStorage.getItem("keisoku-gyakubiki-stuck"));
ok("localStorageに保存される", saved && saved["g-theme"].indexOf("祖父") >= 0);
ok("困っていることも保存される", saved && saved.k === "cond", saved && saved.k);

const dom2 = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true });
const w2 = dom2.window;
w2.HTMLElement.prototype.scrollIntoView = function () {};
/* 同一オリジンなので localStorage は引き継がれない。手で入れて読み戻しを見る */
w2.localStorage.setItem("keisoku-gyakubiki-stuck", JSON.stringify({
  k: "ng", "g-theme": "ためしのテーマ", "g-joken": "", "g-mine": "ためしの案", "g-stuck": "ためしの行きづまり"
}));
const dom3 = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(win) {
    win.HTMLElement.prototype.scrollIntoView = function () {};
    win.localStorage.setItem("keisoku-gyakubiki-stuck", JSON.stringify({
      k: "ng", "g-theme": "ためしのテーマ", "g-joken": "", "g-mine": "ためしの案", "g-stuck": "ためしの行きづまり"
    }));
  }});
const d3 = dom3.window.document;
ok("開き直すと書いたものが戻る", d3.getElementById("g-theme").value === "ためしのテーマ",
   d3.getElementById("g-theme").value);
ok("困っていることの選択も戻る",
   d3.querySelector('#g-kinds .chip[data-k="ng"]').getAttribute("aria-pressed") === "true");
ok("戻したあとボタンが押せる", d3.getElementById("g-go").disabled === false);

console.log("=== 欠けの指摘（場合分け） ===");
function scenario(theme, joken, mine, stuck, kind) {
  const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document, g = id => dd.getElementById(id);
  const set = (id, v) => { g(id).value = v; g(id).dispatchEvent(new ww.Event("input")); };
  set("g-theme", theme); set("g-joken", joken); set("g-mine", mine); set("g-stuck", stuck);
  dd.querySelector('#g-kinds .chip[data-k="' + kind + '"]').click();
  g("g-go").click();
  const o = g("g-out");
  return {
    txt: o.textContent,
    sens: [...o.querySelectorAll(".gdev:not(.act) b")].map(e => e.textContent),
    acts: [...o.querySelectorAll(".gdev.act b")].map(e => e.textContent),
  };
}

const A = scenario("教室が暑いとき、だれも気づかない", "2週間でつくる",
  "温度をはかる案を考えた", "はかったあと、どうやって知らせればいいか分からない", "dev");
console.log("  A センサ:", A.sens.join("/"), "｜アクション:", A.acts.join("/"));
ok("A: 温度のセンサが出る（漢字の「暑い」でも引ける）", A.sens.some(n => /温度/.test(n)), A.sens.join("/"));
ok("A: 動作は無理に出さない", A.acts.length === 0, A.acts.join("/"));
ok("A: 動かす側がまだ、と指摘する", /「動かす・知らせる」側がまだ/.test(A.txt));

const B = scenario("ろうかを走る人にやめてほしい", "",
  "音声で注意する装置を作りたい", "何をきっかけに鳴らせばいいか決まらない", "idea");
console.log("  B センサ:", B.sens.join("/"), "｜アクション:", B.acts.join("/"));
ok("B: 音声の装置が出る", B.acts.some(n => /音声|スピーカ|ブザー/.test(n)), B.acts.join("/"));
ok("B: センサは無理に出さない", B.sens.length === 0, B.sens.join("/"));
ok("B: 気づく側がまだ、と指摘する", /何で「気づく」かがまだ/.test(B.txt));
ok("B: 音声案内の授業例が出る", /音声案内装置/.test(B.txt));

const C = scenario("あああ", "", "いいい", "ううう", "idea");
ok("C: 候補を出さない", C.sens.length === 0 && C.acts.length === 0, C.sens.join("/") + C.acts.join("/"));
console.log("  C（意味のない文字）:", C.sens.join("/"), C.acts.join("/"));
ok("C: 見当がつかないときはそう言う", /装置の見当がつきませんでした/.test(C.txt));
ok("C: 言いかえの例を出す", /暗くなったら/.test(C.txt));

const D = scenario("植物の水やりを忘れる", "学校にある装置だけ",
  "土がかわいたら水を出す装置。土壌水分センサと水中ポンプを使う",
  "何の値で水を出すか、境目が決められない", "cond");
console.log("  D センサ:", D.sens.join("/"), "｜アクション:", D.acts.join("/"));
ok("D: 土壌水分センサが出る", D.sens.some(n => /土壌/.test(n)), D.sens.join("/"));
ok("D: ポンプが出る", D.acts.some(n => /ポンプ/.test(n)), D.acts.join("/"));
ok("D: 両方そろった旨が出る", /両方に、あたりがついている/.test(D.txt));
ok("D: 条件・きまりを書いたので、その指摘は出ない", !/「条件・きまり」が空のまま/.test(D.txt));
ok("D: 自動水やりの授業例が出る", /自動水やり/.test(D.txt));
ok("D: 関係のない授業例は出さない", !/フードコート/.test(D.txt));

/* 装置の話がまったく無い相談でも、まちがった候補を出さない */
const E = scenario("グループで話し合いがうまくいかない", "", "みんなの意見をまとめたい",
  "どうやって決めればいいか分からない", "idea");
ok("E: 装置の話が無ければ候補を出さない", E.sens.length === 0 && E.acts.length === 0,
   E.sens.join("/") + E.acts.join("/"));
ok("E: 言いかえをうながす", /装置の見当がつきませんでした/.test(E.txt));

/* 文の途中に偶然あらわれる2文字（「開いたのどうして」→「のど」）で加湿器を出さない */
const F = scenario("教室のドアが開けっぱなしで寒い", "", "ドアが開いたら知らせたい",
  "どうやってドアが開いたと分かるのか", "dev");
ok("F: 開閉検知センサが出る", F.sens.some(n => /開閉/.test(n)), F.sens.join("/"));
ok("F: 「のど」の偶然の一致で加湿器を出さない", !F.acts.some(n => /加湿/.test(n)), F.acts.join("/"));

console.log("\n=== ①の検索の回帰（元の45パターンから抜粋） ===");
const cases = [
  ["くらい", "光センサ"], ["ひとがくる", null], ["あつい", null], ["みず", null],
  ["ドアがあいた", null], ["火事", null], ["土がかわいたら", "土壌水分センサ"],
  ["音を出さずに知らせたい", null], ["回したい", null], ["暗くなったら", "光センサ"],
];
const dom4 = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
const d4 = dom4.window.document, w4 = dom4.window;
cases.forEach(([q, expect]) => {
  d4.getElementById("q").value = q;
  d4.getElementById("q").dispatchEvent(new w4.Event("input"));
  const top = d4.querySelector("#list .card h3");
  const n = top ? top.textContent : "(なし)";
  console.log("  " + q.padEnd(14) + " → " + n);
  if (expect) ok("検索『" + q + "』→ " + expect, n === expect, n);
  else ok("検索『" + q + "』が何か返す", !!top);
});

const SEL_COND = '#g-kinds .chip[data-k="cond"]';
const SEL_IDEA = '#g-kinds .chip[data-k="idea"]';
const SEL_OTAZUNE = '#g-out a[href*="ai-otazune"]';

console.log("=== 資料リンク（石川研究室） ===");
{
  const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document;
  ok("REFが51件そろっている", ww.DEV.every(v => v.id in ww.REF), "もれあり");
  const cards = [...dd.querySelectorAll("#list .card")];
  ok("全51枚のカードに資料リンクがある",
     cards.length === 51 && cards.every(c => c.querySelector(".ref")), cards.length);
  const hrefs = [...dd.querySelectorAll("#list .ref")].map(a => a.href);
  ok("リンク先はすべて石川研究室サイト",
     hrefs.every(h => h.indexOf("https://sites.google.com/s.hokkyodai.ac.jp/tech/") === 0));
  ok("別名のときは注記を出す",
     dd.body.textContent.indexOf("サイトでは「レバースイッチセンサ」という名前です") >= 0);
  ok("資料ページが無いものはそう言う",
     dd.body.textContent.indexOf("この装置だけの資料ページはありません") >= 0);
  ok("②授業の例の配布資料もリンクになっている", !!dd.querySelector("#exlist .files a"));
}

console.log("=== 先生にわたす文（AIおたずね箱ほうしき） ===");
{
  const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document, g = id => dd.getElementById(id);
  const set = (id, v) => { g(id).value = v; g(id).dispatchEvent(new ww.Event("input")); };
  set("g-theme", "植物の水やりを忘れる");
  set("g-joken", "学校にある装置だけ");
  set("g-mine", "土がかわいたら水を出す装置。土壌水分センサと水中ポンプを使う");
  set("g-stuck", "何の値で水を出すか、境目が決められない");
  dd.querySelector(SEL_COND).click();
  g("g-go").click();

  const t = g("g-prompt").value;
  ok("先生にわたす文が組み上がる", t.length > 800, t.length);
  ok("生徒が書いた内容が入る", t.indexOf("植物の水やりを忘れる") >= 0);
  ok("困っていることも入る", t.indexOf("条件（しきい値）の決め方が分からない") >= 0);
  ok("候補と資料のファイル名が入る", t.indexOf("土壌水分センサの使い方.pptx") >= 0);
  ok("51種の装置一覧が入る", ww.DEV.every(v => t.indexOf(v.n) >= 0), "もれあり");
  ok("学校に無い部品を出さない指示がある", t.indexOf("すすめないでください") >= 0);
  ok("コネクタ番号・しきい値を書かせない指示がある",
     t.indexOf("しきい値の具体的な数値は書かないでください") >= 0);
  ok("完成品を書かせない指示がある", t.indexOf("そのまま提出できる完成品") >= 0);
  ok("石川研究室のURLが入る", t.indexOf("sites.google.com/s.hokkyodai.ac.jp/tech/") >= 0);
  ok("おたずね箱へのリンクがある", !!dd.querySelector(SEL_OTAZUNE));

  /* jsdom には navigator.clipboard が無い。学校のパソコンで使えないときと同じ経路 */
  g("g-copy").click();
  ok("clipboardが使えなくても、選択して知らせる",
     g("g-copied").textContent.indexOf("コピーしてください") >= 0, g("g-copied").textContent);
  ok("readonlyに戻している", g("g-prompt").hasAttribute("readonly"));

  /* 候補が出なかったときも、文は作れる */
  const dm2 = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const w2 = dm2.window, d2 = w2.document, g2 = id => d2.getElementById(id);
  ["g-theme", "g-mine", "g-stuck"].forEach(id => {
    g2(id).value = "あああ"; g2(id).dispatchEvent(new w2.Event("input"));
  });
  d2.querySelector(SEL_IDEA).click();
  g2("g-go").click();
  ok("候補なしでも文は作れる", g2("g-prompt").value.indexOf("候補】なし") >= 0);
}

/* 2026-09-19 に実在を確認した、研究室サイトのページ名 */
const OK_PAGES = ["光センサ", "照度センサ", "カラーセンサ", "人感センサ", "ボタンセンサ", "タッチセンサ", "非接触温度センサ", "接触型温度センサ", "湿度センサ", "土壌水分センサ", "降雨水位センサ", "気圧センサ", "炎センサ", "アルコールセンサ", "光距離センサ", "リミットセンサ", "段差障害物センサ", "重さセンサ", "磁気スイッチセンサ", "レバースイッチセンサ", "年月日時刻", "パソコンカメラをaiセンサに", "音声認識で判別", "qrコードで判別", "振動モータ", "サーボモータ角度指定モータ", "dcモータギアドモータ水中ポンプ", "暖房装置", "冷却装置", "oledディスプレイ", "音声発生装置", "マイクロビットを使う", "計測制御問題解決", "センサアクション装置の使い方", "はんだ付けで実習基板を作る", "スマート農業", "マイクロビットで無線ロボットカーを作る"];

console.log("=== リンクのhrefを実際に見る ===");
{
  /* 2026-09-19 の不具合：var LAB の代入が②を描くコードより後ろにあり、
     巻き上げで undefined のまま連結されて、②のリンクだけ 404 になっていた。
     「aタグがある」ではなく「hrefが正しい」を見ないと捕まらない。 */
  const dm = new JSDOM(HTML, { url: "http://localhost/keisoku-gyakubiki/", runScripts: "dangerously",
    pretendToBeVisual: true, beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document, g = id => dd.getElementById(id);

  /* ⑤も描かせて、全タブぶんのリンクをそろえる */
  const set = (id, v) => { g(id).value = v; g(id).dispatchEvent(new ww.Event("input")); };
  set("g-theme", "植物の水やりを忘れる");
  set("g-mine", "土がかわいたら水を出す装置。土壌水分センサと水中ポンプを使う");
  set("g-stuck", "境目が決められない");
  dd.querySelector(SEL_COND).click();
  g("g-go").click();

  const all = [...dd.querySelectorAll("a[href]")];
  const bad = all.filter(a => a.getAttribute("href").indexOf("undefined") >= 0);
  ok("hrefに undefined が混ざっていない", bad.length === 0,
     bad.map(a => a.getAttribute("href")).join(" / "));

  const rel = all.filter(a => {
    const h = a.getAttribute("href");
    return h.indexOf("http") !== 0 && h.indexOf("#") !== 0;
  });
  ok("リンクはすべて絶対URL", rel.length === 0, rel.map(a => a.getAttribute("href")).join(" / "));

  /* ②授業の例：7件すべてが研究室サイトの実在ページを指しているか */
  const ex = [...dd.querySelectorAll("#exlist .files a")];
  ok("②の配布資料リンクが7件ある", ex.length === 7, ex.length);
  ok("②のリンクはすべて研究室サイト",
     ex.every(a => a.href.indexOf("https://sites.google.com/s.hokkyodai.ac.jp/tech/") === 0),
     ex.map(a => a.getAttribute("href")).join(" / "));
  const exPages = ex.map(a => decodeURIComponent(a.href.split("/tech/")[1]));
  ok("②のリンク先は、確認済みのページ名だけ",
     exPages.every(x => OK_PAGES.indexOf(x) >= 0), exPages.join(" / "));

  /* ①のカードと⑤の候補も同じように見る */
  const refs = [...dd.querySelectorAll(".ref")];
  ok("資料リンクがすべて絶対URL",
     refs.every(a => a.getAttribute("href").indexOf("https://sites.google.com/") === 0));
  const refPages = [...new Set(refs.map(a => decodeURIComponent(a.href.split("/tech/")[1])))];
  ok("資料リンク先も、確認済みのページ名だけ",
     refPages.every(x => OK_PAGES.indexOf(x) >= 0),
     refPages.filter(x => OK_PAGES.indexOf(x) < 0).join(" / "));
}

console.log("=== 検索の索引と並べ方 ===");
{
  const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document;
  const find = q => {
    dd.getElementById("q").value = q;
    dd.getElementById("q").dispatchEvent(new ww.Event("input"));
    const cols = []; let cur = null;
    dd.querySelectorAll("#list > *").forEach(el => {
      if (el.classList.contains("ghead")) { cur = []; cols.push(cur); }
      else if (cur) [...el.querySelectorAll(".card h3")].forEach(e => cur.push(e.textContent));
    });
    return cols;
  };
  const colOf = (cols, name) => cols.find(c => c.some(x => x.indexOf(name) >= 0));

  /* 索引が強さの順に分かれているか */
  ok("装置名・言いかえ語・カテゴリが別の索引になっている",
     ww.DEV.every(v => v.nm && v.hi && v.ct && v.all));
  ok("カテゴリ名は hi に混ざっていない",
     ww.DEV.filter(v => v.c === "動き・かたむき・音")
       .every(v => v.n.indexOf("音") >= 0 || v.hi.indexOf("かたむき・音") < 0));

  /* 言いかえ語の重複（「スイッチ」と「すいっち」）で二重に加点されない */
  ok("言いかえ語に重複がない",
     ww.DEV.every(v => v.ph.length === new Set(v.ph).size),
     (ww.DEV.find(v => v.ph.length !== new Set(v.ph).size) || {}).n);

  /* 2026-09-19 の不具合：カテゴリ名を打つと、そのカテゴリ全員が同点になり
     本人がうもれていた（「音」→ 加速度センサが1位、マイクは3位） */
  ok("『音』でマイクが計測の列の上位に出る",
     (colOf(find("音"), "マイク") || []).indexOf("マイク（V2内蔵）") < 2,
     JSON.stringify(find("音")));
  ok("『天気』で気圧センサが上位に出る",
     (colOf(find("天気"), "気圧") || []).findIndex(x => x.indexOf("気圧") >= 0) < 2);
  ok("『色』でカラーセンサが1位", (find("色")[0] || [])[0].indexOf("カラー") >= 0, find("色")[0]);

  /* 計測と制御を混ぜて順位づけすると、片方が丸ごと消える */
  const oto = find("音");
  ok("『音』で計測と制御の両方が出る", oto.length === 2, oto.length);
  ok("見出しは2種類", [...dd.querySelectorAll("#list .ghead")].length === 2);
  const mawasu = find("まわす");
  ok("『まわす』は制御が先に出る",
     dd.querySelector("#list .ghead").classList.contains("a"),
     dd.querySelector("#list .ghead").textContent);

  /* 語彙が足りているか（漢字・ひらがな・ふだんの言い方） */
  [["湿気", "湿度センサ"], ["何時", "年月日・時刻"], ["転んだ", "加速度センサ"],
   ["しずかに知らせたい", "振動モータ"], ["水を出したい", "水中ポンプ"],
   ["しゃべらせたい", "音声発生装置"], ["むしあつい", "湿度センサ"],
   ["たおれたら", "加速度センサ"], ["かぜをおくる", "DCモータ"]].forEach(([q, want]) => {
    const c = colOf(find(q), want);
    ok("『" + q + "』→ " + want, !!c && c.findIndex(x => x.indexOf(want) >= 0) === 0,
       JSON.stringify(find(q)));
  });

  /* 絞り込みが効いているか */
  dd.getElementById("clr").click();
  ok("何も入れなければ51件",
     [...dd.querySelectorAll("#list .card")].length === 51,
     [...dd.querySelectorAll("#list .card")].length);
}

console.log("\n結果: " + pass + " 件 合格 / " + fail + " 件 不合格");
process.exit(fail ? 1 : 0);
