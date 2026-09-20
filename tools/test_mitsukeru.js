/* ⓪「もんだいをみつける」タブの動作確認。
     node tools/test_mitsukeru.js
     M0_TARGET=../index.before-mitsukeru-… node tools/test_mitsukeru.js  ← 直す前にぶつける用

   ★この検査は、⓪を入れる前の版にぶつけて落ちることを見てから書いた。
     そうしないと「何も見ていない検査」が増える。 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const TARGET = process.env.M0_TARGET || "../index.html";
const HTML = fs.readFileSync(path.join(__dirname, TARGET), "utf8");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log("  NG  " + name + (extra ? "  → " + extra : "")); }
}

const errs = [];
const dom = new JSDOM(HTML, {
  url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(w) {
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.scrollTo = function () {};
    w.print = function () { w.__printed = (w.__printed || 0) + 1; };
    w.confirm = function () { return true; };
  },
});
dom.window.addEventListener("error", e => errs.push(String(e.error || e.message)));
dom.window.onerror = m => errs.push(String(m));
const w = dom.window, d = w.document;
const $ = id => d.getElementById(id);
const txt = id => ($(id) ? $(id).textContent : "");
const shown = el => !!el && !el.hidden;

/* ①の検索欄に打ちこんだのと同じ経路（qTail を通る） */
function search(q) {
  $("q").value = q;
  $("q").dispatchEvent(new w.Event("input"));
  const cols = []; let cur = null;
  d.querySelectorAll("#list > *").forEach(el => {
    if (el.classList.contains("ghead")) { cur = []; cols.push(cur); }
    else if (cur) [...el.querySelectorAll(".card h3")].forEach(e => cur.push(e.textContent));
  });
  return cols;
}
function firstIn(cols, name) {
  return cols.some(c => c.length && c[0].indexOf(name) >= 0);
}
function setVal(id, v) {
  $(id).value = v;
  $(id).dispatchEvent(new w.Event("input"));
}

console.log("=== 読み込み ===");
ok("スクリプトがエラーなく走る", errs.length === 0, errs.join(" / "));
ok("⓪のタブボタンがある", !!$("t-find0"));
ok("⓪のパネルがある", !!$("p-find0"));
ok("①〜⑥の番号は動いていない",
  ["t-find", "t-ex", "t-step", "t-memo", "t-stuck", "t-teach"].every(i => !!$(i)));
ok("①のボタンの文字は「① さがす」のまま", (txt("t-find") || "").indexOf("① さがす") >= 0, txt("t-find"));
ok("何も書いていない生徒には⓪を開く", shown($("p-find0")) && !shown($("p-find")));
ok("m0Started は、まだ何も無ければ false", w.m0Started() === false);

console.log("=== タブの範囲（検索欄・装置パネルで2回踏んだ型） ===");
$("t-find0").click();
ok("⓪では検索欄を出さない", !shown($("searchbar")));
ok("⓪では検索のヒントも出さない", !shown($("searchhint")));
ok("⓪では装置パネルを出さない", !shown($("eq-shared")));
$("t-find").click();
ok("①に移ると検索欄が出る", shown($("searchbar")));
ok("①に移ると⓪の中身は消える", !shown($("p-find0")));
["ex", "step", "memo", "stuck", "teach"].forEach(k => {
  $("t-" + k).click();
  ok("②〜⑥で⓪が出ていない（" + k + "）", !shown($("p-find0")));
});
$("t-find0").click();
ok("⓪に戻れる", shown($("p-find0")));

console.log("=== 入口 ===");
ok("入口が3つ出ている", $("m-modes").querySelectorAll(".m-mode").length === 3);
ok("えらぶ前は作業エリアが出ていない", !shown($("m-work")));

console.log("=== ① あるある判定 ===");
$("m-modes").querySelector('[data-m="aruaru"]').click();
ok("入口を押すと作業エリアが出る", shown($("m-work")));
let cards = $("m-work").querySelectorAll(".m-card");
ok("カードは12枚ずつ出す", cards.length === 12, "出た枚数=" + cards.length);
ok("★束を一覧では見せない（60枚は出ていない）", cards.length < 60);
const firstId = $("m-work").querySelector(".m-b").dataset.id;
$("m-work").querySelector('.m-b[data-v="aru"]').click();
ok("「ある」を押すと印がつく", $("m-work").querySelector(".m-card").classList.contains("hit"));
ok("「ある」を押すと「これにする」が出る", !!$("m-work").querySelector('.m-take[data-take="' + firstId + '"]'));
ok("1つでは、かたよりはまだ出さない", txt("m-tally").indexOf("気づきやすい") < 0);
[...$("m-work").querySelectorAll(".m-card")].slice(1, 3).forEach(c => c.querySelector('.m-b[data-v="aru"]').click());
ok("「ある」が3つで、型のかたよりが出る", txt("m-tally").indexOf("気づきやすい") >= 0, txt("m-tally").slice(0, 40));
$("m-more").click();
ok("「つぎの12まい」で24枚になる", $("m-work").querySelectorAll(".m-card").length === 24);

console.log("=== ② 場所からさがす ===");
$("m-modes").querySelector('[data-m="basho"]').click();
const baChips = $("m-bas").querySelectorAll(".chip");
ok("どこ・どんなときが15ある（場所13＋冬・雪／動物）", baChips.length === 15, "出た数=" + baChips.length);
let thin = [];
[...baChips].forEach(c => {
  c.click();
  const n = $("m-work").querySelectorAll(".m-card").length;
  if (n < 3) thin.push(c.textContent + "=" + n);
  c.click();   /* 選びなおし（同じものをもう一度押すと解除） */
});
ok("★どれをえらんでも3枚以上ある（行き止まりを作らない）", thin.length === 0, thin.join(" / "));
baChips[0].click();
ok("場所をえらぶと観察シートのボタンが出る", !!$("m-sheet-go"));
$("m-sheet-go").click();
ok("観察シートが刷られる", (w.__printed || 0) > 0);
ok("観察シートに書きこむ欄がある", $("m-sheet").innerHTML.indexOf("見てきたこと") >= 0);
ok("★観察シートにも答え（hint）は出さない", $("m-sheet").innerHTML.indexOf("土壌") < 0);

console.log("=== 北海道ならでは（冬・雪／動物・生き物） ===");
const hk = w.TANE.filter(t => t.id.indexOf("h") === 0);
ok("北海道のカードが17枚ある", hk.length === 17, "枚数=" + hk.length);
ok("「冬・雪」のカードが10枚", w.TANE.filter(t => t.ba.indexOf("yuki") >= 0).length === 10);
ok("「動物・生き物」のカードが7枚", w.TANE.filter(t => t.ba.indexOf("ikimono") >= 0).length === 7);
ok("★北海道のカードにも、必ず場所のタグが付いている（場所からも引ける）",
  hk.every(t => t.ba.some(b => ["yuki", "ikimono"].indexOf(b) < 0)),
  hk.filter(t => t.ba.every(b => ["yuki", "ikimono"].indexOf(b) >= 0)).map(t => t.id).join(","));
/* 前の節で すでに場所の入口にいる。もう一度押すと閉じてしまう */
if (!$("m-bas")) $("m-modes").querySelector('[data-m="basho"]').click();
[["yuki", "雪"], ["ikimono", "クマ"]].forEach(([k, word]) => {
  const chip = [...$("m-bas").querySelectorAll(".chip")].filter(c => c.dataset.b === k)[0];
  ok("「" + k + "」のボタンがある", !!chip);
  chip.click();
  const t = $("m-work").textContent;
  ok("「" + k + "」をえらぶと " + word + " の話が出る", t.indexOf(word) >= 0);
  chip.click();
});
[...$("m-bas").querySelectorAll(".chip")].filter(c => c.dataset.b === "tsuugaku")[0].click();
ok("通学路からもクマのカードが出る（場所からも引ける）",
  $("m-work").textContent.indexOf("クマ") >= 0);
[...$("m-bas").querySelectorAll(".chip")].filter(c => c.dataset.b === "tsuugaku")[0].click();

console.log("=== ③ 作りたい物から逆算 ===");
const GY = require("./mitsukeru_cases.js").GYAKUSAN;
$("m-modes").querySelector('[data-m="gyaku"]').click();
ok("逆算の欄が出る", !!$("m-gwhat"));
GY.forEach(c => {
  $("m-gwhat").value = c.say;
  $("m-gwhat").dispatchEvent(new w.Event("input"));
  $("m-gwhat").dispatchEvent(new w.Event("change"));
  const guess = $("m-work").querySelector(".m-guess");
  if (c.kata) {
    const K = w.KATA.filter(k => k.k === c.kata)[0];
    ok("逆算「" + c.say + "」→ " + (K ? K.nm : c.kata), !!guess && guess.textContent.indexOf(K.nm) >= 0,
      guess ? guess.textContent.slice(0, 30) : "（見立てが出ない）");
  } else {
    ok("逆算「" + c.say + "」→ 当たらなければ当てない", !guess,
      guess ? guess.textContent.slice(0, 30) : "");
  }
});
$("m-gwhat").value = "自動ドアを作りたい"; $("m-gwhat").dispatchEvent(new w.Event("change"));
setVal("m-gdare", "にもつを持った家の人");
setVal("m-gima", "手がふさがっていて、ドアが開けられない");
$("m-gapply").click();
ok("「下の欄にうつす」で だれが が入る", $("m-dare").value === "にもつを持った家の人", $("m-dare").value);
ok("「下の欄にうつす」で こまっていること が入る", $("m-komari").value.indexOf("ドアが開けられない") >= 0);
ok("「下の欄にうつす」で 型 も決まる", $("m-katas").querySelector(".chip.act") !== null);

console.log("=== 関門（必須がそろうまで進めない） ===");
$("m-clear").click();
ok("消すと出口のボタンは押せない", $("m-go-find").disabled === true);
setVal("m-dare", "家の人");
setVal("m-itsu", "冬の朝、家を出たあと");
setVal("m-komari", "ストーブを消したか分からなくて気になる");
ok("型をえらぶまでは、まだ押せない", $("m-go-find").disabled === true);
$("m-katas").querySelector(".chip").click();
ok("「何が分かれば」が空なら、まだ押せない", $("m-go-find").disabled === true);
setVal("m-wakaru", "ストーブがついたままか");
ok("5つそろうと押せる", $("m-go-find").disabled === false, txt("m-gate"));
ok("もんだいの文が組み上がる",
  txt("m-sentence").indexOf("家の人") >= 0 && txt("m-sentence").indexOf("ストーブがついたままか") >= 0,
  txt("m-sentence"));

console.log("=== 関門1：測れない言葉（言いかえを出す。止めない） ===");
const C = require("./mitsukeru_cases.js");
C.MUZU.forEach(c => {
  setVal("m-komari", c.say);
  ok("測れない「" + c.say + "」に言いかえが出る", shown($("m-muzu")), txt("m-muzu").slice(0, 30));
  ok("測れなくても、ボタンは止めない（" + c.say + "）", $("m-go-find").disabled === false);
});
C.MAZUKUNAI.forEach(c => {
  setVal("m-komari", c.say);
  ok("測れる「" + c.say + "」に言いかえを出さない（誤検知）", !shown($("m-muzu")), txt("m-muzu").slice(0, 30));
});

console.log("=== 関門2：人が考えて決めることは機械にできない ===");
setVal("m-komari", "ストーブを消したか分からなくて気になる");
ok("はじめは注意が出ていない", !shown($("m-rule-w")));
[...$("m-rule").querySelectorAll(".chip")].filter(c => c.dataset.r === "human")[0].click();
ok("「そのつど人が決める」で注意が出る", shown($("m-rule-w")));
[...$("m-rule").querySelectorAll(".chip")].filter(c => c.dataset.r === "same")[0].click();
ok("「同じルールでよい」にすると消える", !shown($("m-rule-w")));

console.log("=== ★答えを先に渡さない ===");
$("m-modes").querySelector('[data-m="basho"]').click();
$("m-bas").querySelectorAll(".chip")[0].click();
const takeId = $("m-work").querySelector(".m-take").dataset.take;
const tane = w.TANE.filter(t => t.id === takeId)[0];
$("m-work").querySelector(".m-take").click();
ok("カードを選ぶと こまっていること に入る", $("m-komari").value === tane.t);
ok("★カードを選んだだけでは hint を画面に出さない",
  $("p-find0").textContent.indexOf(tane.hint) < 0, "hint=" + tane.hint);
ok("「何が分かれば」は空のまま（生徒が書く）", $("m-wakaru").value === "");
$("m-wak").click();
ok("「わからない」1回目は考え方だけ", shown($("m-wak-out")) && txt("m-wak-out").indexOf(tane.hint) < 0,
  txt("m-wak-out").slice(0, 40));
$("m-wak").click();
ok("「わからない」2回目で例を出す", txt("m-wak-out").indexOf(tane.hint) >= 0, txt("m-wak-out").slice(0, 40));

console.log("=== 出口（①④⑤へ引きわたす） ===");
setVal("m-dare", "家の人");
setVal("m-itsu", "冬の朝、家を出たあと");
setVal("m-komari", "ストーブを消したか分からなくて気になる");
setVal("m-wakaru", "ストーブがついたままか");
if (!$("m-katas").querySelector(".chip.act")) $("m-katas").querySelector(".chip").click();

$("m-go-find").click();
ok("①でさがす → ①が開く", shown($("p-find")));
ok("①でさがす → 検索欄に「何が分かれば」が入る", $("q").value === "ストーブがついたままか", $("q").value);
ok("①でさがす → 結果が出ている", d.querySelectorAll("#list .card").length > 0);
ok("①でさがす → 炎センサが出る", d.querySelector("#list .card h3").textContent.indexOf("炎センサ") >= 0,
  d.querySelector("#list .card h3").textContent);

$("t-find0").click();
$("m-go-memo").click();
ok("④のテーマに入れる → ④が開く", shown($("p-memo")));
ok("④のテーマに文が入る", $("theme").value.indexOf("ストーブがついたままか") >= 0, $("theme").value);

$("t-find0").click();
$("m-go-stuck").click();
ok("⑤へ持っていく → ⑤が開く", shown($("p-stuck")));
ok("⑤のテーマに文が入る", $("g-theme").value.indexOf("ストーブがついたままか") >= 0, $("g-theme").value);
ok("⑤の「自分が考えた案」も埋まる", $("g-mine").value.trim().length > 0);
ok("⑤の困りごとは「テーマや案が思いつかない」になる",
  $("g-kinds").querySelector('.chip[aria-pressed="true"]') &&
  $("g-kinds").querySelector('.chip[aria-pressed="true"]').textContent.indexOf("思いつかない") >= 0);
ok("⑤は「行きづまったところ」だけが残る（そこは生徒が書く）",
  txt("g-gate").indexOf("行きづまった") >= 0, txt("g-gate"));

console.log("=== 保存（次の時間に続きができる） ===");
const saved = JSON.parse(w.localStorage.getItem("keisoku-gyakubiki-mitsukeru"));
ok("⓪に書いたものが保存される", saved && saved.dare === "家の人" && saved.wakaru === "ストーブがついたままか");
ok("④・⑤の保存とはキーを分けている",
  w.localStorage.getItem("keisoku-gyakubiki-memos") !== w.localStorage.getItem("keisoku-gyakubiki-mitsukeru"));

console.log("=== ①の検索の回帰（文末の「か」） ===");
ok("「人が近づいたか」→ 人感センサが1位", firstIn(search("人が近づいたか"), "人感センサ"),
  search("人が近づいたか").map(c => c.slice(0, 2).join("／")).join(" ｜ "));
ok("「ボタンをおしたか」→ 押しボタンセンサが1位", firstIn(search("ボタンをおしたか"), "押しボタンセンサ"),
  search("ボタンをおしたか").map(c => c.slice(0, 2).join("／")).join(" ｜ "));
ok("「まどが開いているか」→ 開閉検知センサが1位", firstIn(search("まどが開いているか"), "開閉検知センサ"));
ok("「何分たったか」→ 年月日・時刻が1位", firstIn(search("何分たったか"), "年月日・時刻"));
ok("★短い言葉からは「か」を削らない（「しずか」→マイク）", firstIn(search("しずか"), "マイク"),
  search("しずか").map(c => c.slice(0, 2).join("／")).join(" ｜ "));
ok("「ほのお」はこれまでどおり", firstIn(search("ほのお"), "炎センサ"));
ok("「夜だけ動かしたい」はこれまでどおり", firstIn(search("夜だけ動かしたい"), "年月日・時刻"));

console.log("=== 束のつくり（データ） ===");
ok("カードは77枚（もとの60＋北海道17）", w.TANE.length === 77, "枚数=" + w.TANE.length);
ok("型は10", w.KATA.length === 10);
const kc = {}; w.TANE.forEach(t => kc[t.kt] = (kc[t.kt] || 0) + 1);
ok("どの型にも4枚以上ある", w.KATA.every(k => (kc[k.k] || 0) >= 4),
  w.KATA.map(k => k.nm + ":" + (kc[k.k] || 0)).join(" "));
ok("型タグに誤字がない", w.TANE.every(t => w.KATA.some(k => k.k === t.kt)));
ok("場所タグに誤字がない", w.TANE.every(t => t.ba.every(b => w.BA.some(x => x.k === b))));
ok("カードのidが重複していない", new Set(w.TANE.map(t => t.id)).size === w.TANE.length);
ok("★カードの本文に装置名を書いていない",
  w.TANE.every(t => !w.DEV.some(v => t.t.indexOf(v.n) >= 0)),
  w.TANE.filter(t => w.DEV.some(v => t.t.indexOf(v.n) >= 0)).map(t => t.id).join(","));

console.log("\n結果: " + pass + " 件 合格 / " + fail + " 件 不合格");
process.exit(fail ? 1 : 0);
