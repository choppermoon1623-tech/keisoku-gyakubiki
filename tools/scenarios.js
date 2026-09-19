/* ⑤が実際に返すものを、生徒が書きそうな文で並べて見る */
const fs = require("fs");
const { JSDOM } = require("jsdom");
const HTML = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");

const SC = [
  ["夜の廊下が暗い", "祖父が夜トイレに行くとき、暗くてあぶない", "3週間でつくる。学校にある装置だけ",
   "人が通ったら電気をつける案を考えた", "夜だけ動かしたいのに、昼も反応してしまう", "cond"],
  ["教室が暑い", "教室が暑いとき、だれも気づかない", "2週間でつくる",
   "温度をはかる案を考えた", "はかったあと、どうやって知らせればいいか分からない", "dev"],
  ["ろうかを走る", "ろうかを走る人にやめてほしい", "",
   "音声で注意する装置を作りたい", "何をきっかけに鳴らせばいいか決まらない", "idea"],
  ["水やり", "植物の水やりを忘れる", "学校にある装置だけ",
   "土がかわいたら水を出す装置。土壌水分センサと水中ポンプを使う", "何の値で水を出すか、境目が決められない", "cond"],
  ["火の消し忘れ", "台所で火を消し忘れるのがこわい", "",
   "けむりが出たら知らせる案", "けむりのセンサが学校にあるか分からない", "dev"],
  ["ドアの開けっぱなし", "教室のドアが開けっぱなしで寒い", "",
   "ドアが開いたら知らせたい", "どうやってドアが開いたと分かるのか", "dev"],
  ["お年寄りの見守り", "一人暮らしの祖母が心配", "",
   "動いているかどうかを遠くから知りたい", "はなれた家にどうやって伝えるのか分からない", "dev"],
  ["意味のない文字", "あああ", "", "いいい", "ううう", "idea"],
  ["装置の話が無い", "グループで話し合いがうまくいかない", "",
   "みんなの意見をまとめたい", "どうやって決めればいいか分からない", "idea"],
  ["まだ何も無い", "とくに思いつかない", "", "まだ何も考えていない", "何から始めればいいか分からない", "idea"],
];

SC.forEach(([nm, theme, joken, mine, stuck, kind]) => {
  const dm = new JSDOM(HTML, { url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.HTMLElement.prototype.scrollIntoView = function () {}; } });
  const ww = dm.window, dd = ww.document, g = id => dd.getElementById(id);
  const set = (id, v) => { g(id).value = v; g(id).dispatchEvent(new ww.Event("input")); };
  set("g-theme", theme); set("g-joken", joken); set("g-mine", mine); set("g-stuck", stuck);
  dd.querySelector('#g-kinds .chip[data-k="' + kind + '"]').click();
  g("g-go").click();
  const o = g("g-out");
  const sens = [...o.querySelectorAll(".gdev:not(.act) b")].map(e => e.textContent);
  const acts = [...o.querySelectorAll(".gdev.act b")].map(e => e.textContent);
  const gaps = [...o.querySelectorAll(".ghint:not(.ask) h3")].map(e => e.textContent);
  const ex = [...o.querySelectorAll(".ex h3")].map(e => e.textContent);
  console.log("\n■ " + nm);
  console.log("   センサ : " + (sens.join(" / ") || "（出さない）"));
  console.log("   動作   : " + (acts.join(" / ") || "（出さない）"));
  console.log("   指摘   : " + gaps.join(" ｜ "));
  console.log("   授業例 : " + (ex.join(" / ") || "（なし）"));
});
