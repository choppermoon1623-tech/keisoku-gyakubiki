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
/* もとは「『夜だけ動かしたい』から時刻も出る」を確かめていたが、
   その年月日・時刻が人感センサを押しのけて1位に居座っていた（2026-09-19 修正）。
   生徒が書いたのは「人が通ったら」なので、そこを先に出すのが正しい。 */
ok("「人が通ったら」で人感センサが出る（活用形でも引ける）",
   devNames.some(n => /人感/.test(n)), devNames.join("/"));
ok("困りごとの言い回しに当たっただけの装置が1位にならない",
   devNames[0] !== "年月日・時刻", devNames.join("/"));
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
/* もとは「センサは出さない」を確かめていた。「走る」を人感センサの言いかえ語に
   足したので、ろうかを走る人に気づく側も出るようになった（2026-09-19 修正）。
   条件と止め方は生徒が決めるので、答えを渡してしまうことにはならない。 */
ok("B: 走る人に気づくセンサが出る", B.sens.some(n => /人感/.test(n)), B.sens.join("/"));
ok("B: 両方そろったので、条件と止め方へ進ませる", /条件（しきい値）/.test(B.txt));
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

/* 2026-09-19 に実在を確認した、研究室サイトのページ名 */
const OK_PAGES = ["光センサ", "照度センサ", "カラーセンサ", "人感センサ", "ボタンセンサ", "タッチセンサ", "非接触温度センサ", "接触型温度センサ", "湿度センサ", "土壌水分センサ", "降雨水位センサ", "気圧センサ", "炎センサ", "アルコールセンサ", "光距離センサ", "リミットセンサ", "段差障害物センサ", "重さセンサ", "磁気スイッチセンサ", "レバースイッチセンサ", "年月日時刻", "パソコンカメラをaiセンサに", "音声認識で判別", "qrコードで判別", "振動モータ", "サーボモータ角度指定モータ", "dcモータギアドモータ水中ポンプ", "暖房装置", "冷却装置", "oledディスプレイ", "音声発生装置", "マイクロビットを使う", "計測制御問題解決", "センサアクション装置の使い方", "はんだ付けで実習基板を作る", "スマート農業", "マイクロビットで無線ロボットカーを作る"];
const SEL_COND = '#g-kinds .chip[data-k="cond"]';
const SEL_IDEA = '#g-kinds .chip[data-k="idea"]';

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

console.log("=== 生徒が先生にわたす相談カード ===");
{
  const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document, g = id => dd.getElementById(id);
  const set = (id, v) => { g(id).value = v; g(id).dispatchEvent(new ww.Event("input")); };
  set("g-name", "1年A組 12番 山田");
  set("g-theme", "植物の水やりを忘れる");
  set("g-joken", "学校にある装置だけ");
  set("g-mine", "土がかわいたら水を出す装置。土壌水分センサと水中ポンプを使う");
  set("g-stuck", "何の値で水を出すか、境目が決められない");
  dd.querySelector(SEL_COND).click();
  g("g-go").click();

  const card = g("g-card").value;
  ok("相談カードが出る", card.indexOf(ww.CARD_HEAD) === 0, card.slice(0, 40));
  ok("なまえが入る", card.indexOf("1年A組 12番 山田") >= 0);
  ok("生徒が書いた内容が入る", card.indexOf("植物の水やりを忘れる") >= 0);
  ok("困っていることが入る", card.indexOf("条件（しきい値）の決め方が分からない") >= 0);
  ok("候補の装置が入る", card.indexOf("土壌水分センサ") >= 0 && card.indexOf("水中ポンプ") >= 0);

  /* ここが今回の作り直しの肝。生徒にAIへの指示文を見せない */
  ok("AIへの指示文は生徒に見せない",
     card.indexOf("あなたは中学校の技術科の教師から") < 0 &&
     card.indexOf("この学校で使える装置") < 0, card);
  ok("プロンプトの欄そのものが無い", !g("g-prompt"));
  ok("おたずね箱への導線は無い", !dd.querySelector('#g-out a[href*="ai-otazune"]'));
  ok("印刷してわたせる", !!g("g-print2"));

  /* クリップボードが使えない環境でも知らせる */
  g("g-copy").click();
  ok("コピーできない環境では選択して知らせる",
     g("g-copied").textContent.indexOf("コピーしてください") >= 0, g("g-copied").textContent);

  /* 書いたカードを読み戻せる（⑥が受け取る形と往復できるか） */
  const back = ww.parseCards(card);
  ok("カードを読み戻せる", back.length === 1, back.length);
  ok("読み戻した中身が合う",
     back[0].name === "1年A組 12番 山田" && back[0].theme === "植物の水やりを忘れる" &&
     back[0].sens.indexOf("土壌水分センサ") >= 0, JSON.stringify(back[0]));
  ok("何枚でもまとめて読める", ww.parseCards(card + "\n" + card).length === 2);
  ok("カードでない文は読まない", ww.parseCards("ただのメモです").length === 0);
}


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

const SEL_STORE_SESSION = '#t-store .chip[data-s="session"]';
const SEL_POL_TEACH = '#t-pol .chip[data-p="teach"]';

console.log("=== ⑥ 先生用タブ ===");
{
  /* jsdom には TextDecoder / fetch が無いので入れてやる。
     fetch は偽物にして、送っている中身まで検査する。 */
  function mkWin(reply) {
    const sent = {};
    const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(win) {
        win.HTMLElement.prototype.scrollIntoView = function () {};
        win.TextDecoder = TextDecoder;
        win.fetch = function (url, opt) {
          sent.url = url; sent.headers = opt.headers; sent.body = JSON.parse(opt.body);
          return Promise.resolve(reply(sent));
        };
      } });
    return { win: dm.window, doc: dm.window.document, sent };
  }
  function sse(lines2, status) {
    const chunks = lines2.map(x => new TextEncoder().encode(x));
    let i = 0;
    return {
      ok: (status || 200) < 400, status: status || 200,
      json: () => Promise.resolve({ error: { message: "だめでした" } }),
      text: () => Promise.resolve("だめでした"),
      body: { getReader: () => ({ read: () => Promise.resolve(
        i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) },
    };
  }
  const OK_SSE = [
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"かわいた土と"}}\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ぬれた土を比べよう"}}\n',
    'data: [DONE]\n',
  ];
  const CARD2 = [
    "━━ 計測・制御 相談カード ━━",
    "【なまえ】1年A組 12番 山田",
    "【テーマ】教室が暑いとき、だれも気づかない",
    "【考えた案】温度をはかる案を考えた",
    "【行きづまり】どうやって知らせればいいか分からない",
    "【困っていること】どの装置を使えばいいか分からない",
    "【候補（計測）】接触型温度センサ",
    "",
    "━━ 計測・制御 相談カード ━━",
    "【なまえ】1年B組 3番 佐藤",
    "【テーマ】植物の水やりを忘れる",
    "【考えた案】土がかわいたら水を出す装置",
    "【行きづまり】境目が決められない",
    "【困っていること】条件（しきい値）の決め方が分からない",
    "【候補（計測）】土壌水分センサ",
    "【候補（制御）】水中ポンプ",
  ].join("\n");

  const A = mkWin(() => sse(OK_SSE));
  const g = id => A.doc.getElementById(id);

  ok("⑥タブがある", !!g("t-teach") && !!g("p-teach"));
  g("t-teach").click();
  ok("⑥を押すと⑥が出る", g("p-teach").hidden === false);
  ok("はじめは編集フォームが隠れている", g("k-edit").hidden === true);
  ok("キーが無いうちは「AIに聞く」が出ない", g("t-ask").hidden === true);

  /* 1. 受け取る */
  g("k-in").value = CARD2;
  g("k-read").click();
  ok("2件まとめて読みこめる", /2件/.test(g("k-readmsg").textContent), g("k-readmsg").textContent);
  ok("一覧に2件出る", A.doc.querySelectorAll("#k-list .saved").length === 2);
  ok("貼った順のまま並ぶ",
     A.doc.querySelector("#k-list .saved .th").textContent.indexOf("山田") >= 0,
     A.doc.querySelector("#k-list .saved .th").textContent);
  ok("読みこんだら貼り付け欄は空になる", g("k-in").value === "");
  g("k-in").value = "ただのメモ";
  g("k-read").click();
  ok("カードでない文は読まない", /見つかりませんでした/.test(g("k-readmsg").textContent));

  /* 2. ひらく */
  A.doc.querySelectorAll("#k-list .kpick")[1].click();
  ok("ひらくとフォームが出る", g("k-edit").hidden === false);
  ok("なまえが入る", g("k-name").value === "1年B組 3番 佐藤", g("k-name").value);
  ok("テーマが入る", g("k-theme").value === "植物の水やりを忘れる");
  ok("候補（制御）も入る", g("k-acts").value === "水中ポンプ");
  ok("困っていることが選ばれている",
     A.doc.querySelector('#k-kind .chip[aria-pressed="true"]').textContent
       .indexOf("しきい値") >= 0);
  ok("困っていることに合った方針が既定になる（しきい値→ヒント中心）",
     A.doc.querySelector('#t-pol .chip[aria-pressed="true"]').textContent.indexOf("ヒント中心") >= 0,
     A.doc.querySelector('#t-pol .chip[aria-pressed="true"]').textContent);

  /* 送る文はフォームから自動で組み上がる */
  ok("送る文が組み上がる", g("t-src").value.indexOf("植物の水やりを忘れる") >= 0);
  ok("資料のファイル名が入る", g("t-src").value.indexOf("土壌水分センサの使い方.pptx") >= 0);
  ok("51種の装置一覧が入る", A.win.DEV.every(v => g("t-src").value.indexOf(v.n) >= 0));
  ok("送る文は畳まれている", !A.doc.getElementById("k-srcbox").open);

  /* フォームを直すと送る文も直る */
  g("k-stuck").value = "かわいた土の値がわからない";
  g("k-stuck").dispatchEvent(new A.win.Event("input"));
  ok("フォームを直すと送る文も変わる",
     g("t-src").value.indexOf("かわいた土の値がわからない") >= 0);
  A.doc.querySelector(SEL_POL_TEACH).click();
  ok("方針を変えると送る文も変わる",
     g("t-src").value.indexOf("【今回の方針】しっかり説明する") >= 0);

  /* 直したものは残る */
  const saved = JSON.parse(A.win.localStorage.getItem("keisoku-gyakubiki-soudan"));
  ok("直した内容が保存される", saved[1].stuck === "かわいた土の値がわからない", JSON.stringify(saved[1]));
  ok("方針も保存される", saved[1].pol === "teach");

  /* 白紙から先生が直接書ける */
  g("k-blank").click();
  ok("白紙で1件つくれる", g("k-theme").value === "" && g("k-edit").hidden === false);
  ok("一覧が1件増える", A.doc.querySelectorAll("#k-list .saved").length === 3);

  /* 返した／消す */
  A.doc.querySelectorAll("#k-list .kpick")[0].click();
  g("k-done").click();
  ok("「返した」にできる",
     A.doc.querySelector("#k-list .saved .tag").textContent === "返した",
     A.doc.querySelector("#k-list .saved .tag").textContent);
  g("k-done").click();
  ok("もどせる", A.doc.querySelector("#k-list .saved .tag").textContent === "未");

  /* キーを入れるとボタンが出る */
  g("t-key").value = "sk-ant-test";
  g("t-save").click();
  ok("キーを入れると「AIに聞く」が出る", g("t-ask").hidden === false);
  ok("キーはこのタブだけに置かれる",
     !!A.win.sessionStorage.getItem("keisoku-gyakubiki-ai") &&
     !A.win.localStorage.getItem("keisoku-gyakubiki-ai"));

  return (async () => {
    A.doc.querySelectorAll("#k-list .kpick")[1].click();   /* 一覧は [白紙, 山田, 佐藤] */
    await g("t-ask").onclick();
    ok("Anthropic のエンドポイントに送っている",
       A.sent.url === "https://api.anthropic.com/v1/messages", A.sent.url);
    ok("ブラウザから直接たたくヘッダがある",
       A.sent.headers["anthropic-dangerous-direct-browser-access"] === "true");
    ok("APIキーを送っている", A.sent.headers["x-api-key"] === "sk-ant-test");
    ok("既定は Opus 5", A.sent.body.model === "claude-opus-5");
    ok("Opus では安全分類のフォールバックを使う",
       A.sent.body.fallbacks === "default" &&
       A.sent.headers["anthropic-beta"] === "server-side-fallback-2026-07-01");
    ok("adaptive thinking を使う", A.sent.body.thinking.type === "adaptive");
    ok("装置一覧を積んだ文を送っている",
       A.sent.body.messages[0].content.indexOf("この学校で使える装置") >= 0);
    ok("その生徒の相談を送っている",
       A.sent.body.messages[0].content.indexOf("教室が暑いとき") >= 0);
    ok("答えがつながって入る", g("t-ans").value === "かわいた土とぬれた土を比べよう", g("t-ans").value);
    ok("読んでから渡すよう知らせる", /直してから生徒に渡/.test(g("t-msg").textContent));

    const saved2 = JSON.parse(A.win.localStorage.getItem("keisoku-gyakubiki-soudan"));
    ok("答えも保存される", saved2[1].ans === "かわいた土とぬれた土を比べよう", JSON.stringify(saved2[1].ans));

    /* Haiku のときは thinking と fallbacks を外す */
    const B = mkWin(() => sse(OK_SSE));
    const gb = id => B.doc.getElementById(id);
    gb("k-in").value = CARD2; gb("k-read").click();
    B.doc.querySelectorAll("#k-list .kpick")[0].click();
    gb("t-key").value = "sk-ant-x";
    gb("t-model").value = "claude-haiku-4-5-20251001";
    gb("t-save").click();
    await gb("t-ask").onclick();
    ok("Haiku では adaptive thinking を外す", B.sent.body.thinking === undefined);
    ok("Haiku では fallbacks を外す", B.sent.body.fallbacks === undefined);

    /* エラーのときの言い方 */
    const C = mkWin(() => sse([], 401));
    const gc = id => C.doc.getElementById(id);
    gc("k-blank").click();
    gc("k-theme").value = "てすと"; gc("k-theme").dispatchEvent(new C.win.Event("input"));
    gc("t-key").value = "sk-ant-bad"; gc("t-save").click();
    await gc("t-ask").onclick();
    ok("401 はキーが違うと伝える",
       /401/.test(gc("t-msg").textContent) && /キー/.test(gc("t-msg").textContent),
       gc("t-msg").textContent);

    const D = mkWin(() => sse([], 429));
    const gd = id => D.doc.getElementById(id);
    gd("k-blank").click();
    gd("k-theme").value = "てすと"; gd("k-theme").dispatchEvent(new D.win.Event("input"));
    gd("t-key").value = "sk-ant-x"; gd("t-save").click();
    await gd("t-ask").onclick();
    ok("429 は待つよう伝える", /待って/.test(gd("t-msg").textContent), gd("t-msg").textContent);

    const E = mkWin(() => sse([
      'data: {"type":"message_delta","delta":{"stop_reason":"refusal"}}\n'], 200));
    const ge = id => E.doc.getElementById(id);
    ge("k-blank").click();
    ge("k-theme").value = "てすと"; ge("k-theme").dispatchEvent(new E.win.Event("input"));
    ge("t-key").value = "sk-ant-x"; ge("t-save").click();
    await ge("t-ask").onclick();
    ok("断られたらそう伝える", /断り/.test(ge("t-msg").textContent), ge("t-msg").textContent);

    /* キーを消せる */
    ge("t-forget").click();
    ok("キーを消すとボタンが消える", ge("t-ask").hidden === true);
    ok("消すと保存先にも残らない",
       !E.win.sessionStorage.getItem("keisoku-gyakubiki-ai") &&
       !E.win.localStorage.getItem("keisoku-gyakubiki-ai"));

    console.log("\n結果: " + pass + " 件 合格 / " + fail + " 件 不合格");
    process.exit(fail ? 1 : 0);
  })();
}
