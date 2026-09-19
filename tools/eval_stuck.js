/* ⑤「行きづまったら」の候補の当たり具合を、生徒が書きそうな文で採点する。
   want  … 出てほしい装置（1つでも入っていれば○）
   must  … かならず入っていてほしい装置
   avoid … 出てほしくない装置（関係ないのに混じる雑音） */
const fs = require("fs");
const { JSDOM } = require("jsdom");
const HTML = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");

const CASES = [
  { nm:"夜の廊下が暗い",
    theme:"祖父が夜トイレに行くとき、暗くてあぶない", joken:"3週間でつくる。学校にある装置だけ",
    mine:"人が通ったら電気をつける案を考えた", stuck:"夜だけ動かしたいのに、昼も反応してしまう", kind:"cond",
    must:["人感センサ"], want:["光センサ","明るさセンサ（内蔵）"], avoid:["CO2センサ（模擬）"] },
  { nm:"教室が暑い",
    theme:"教室が暑いとき、だれも気づかない", joken:"2週間でつくる",
    mine:"温度をはかる案を考えた", stuck:"はかったあと、どうやって知らせればいいか分からない", kind:"dev",
    want:["接触型温度センサ","非接触型温度センサ","温度センサ（内蔵）"], avoid:["CO2センサ（模擬）"] },
  { nm:"ろうかを走る",
    theme:"ろうかを走る人にやめてほしい", joken:"",
    mine:"音声で注意する装置を作りたい", stuck:"何をきっかけに鳴らせばいいか決まらない", kind:"idea",
    must:["音声発生装置（録音再生装置）"], want:["人感センサ"], avoid:[] },
  { nm:"水やり",
    theme:"植物の水やりを忘れる", joken:"学校にある装置だけ",
    mine:"土がかわいたら水を出す装置。土壌水分センサと水中ポンプを使う", stuck:"何の値で水を出すか、境目が決められない", kind:"cond",
    must:["土壌水分センサ","水中ポンプ"], want:[], avoid:[] },
  { nm:"火の消し忘れ",
    theme:"台所で火を消し忘れるのがこわい", joken:"",
    mine:"けむりが出たら知らせる案", stuck:"けむりのセンサが学校にあるか分からない", kind:"dev",
    /* 「煙・異臭センサ」は、実測できないことが分かるよう「（模擬）」付きに改名した */
    must:["煙・異臭センサ（模擬）"], want:[], avoid:["光センサ"] },
  { nm:"ドアの開けっぱなし",
    theme:"教室のドアが開けっぱなしで寒い", joken:"",
    mine:"ドアが開いたら知らせたい", stuck:"どうやってドアが開いたと分かるのか", kind:"dev",
    must:["開閉検知センサ"], want:[], avoid:[] },
  { nm:"お年寄りの見守り",
    theme:"一人暮らしの祖母が心配", joken:"",
    mine:"動いているかどうかを遠くから知りたい", stuck:"はなれた家にどうやって伝えるのか分からない", kind:"dev",
    must:["人感センサ"], want:["無線通信（内蔵）","ネットワーク通信装置"], avoid:[] },
  { nm:"まぶしい日ざし",
    theme:"教室の西日がまぶしい", joken:"",
    mine:"明るくなったらカーテンを閉めたい", stuck:"カーテンを動かす方法が分からない", kind:"dev",
    want:["光センサ","明るさセンサ（内蔵）"], avoid:["CO2センサ（模擬）"] },
  { nm:"意味のない文字", theme:"あああ", joken:"", mine:"いいい", stuck:"ううう", kind:"idea",
    must:[], want:[], avoid:"ANY" },
  { nm:"装置の話が無い",
    theme:"グループで話し合いがうまくいかない", joken:"",
    mine:"みんなの意見をまとめたい", stuck:"どうやって決めればいいか分からない", kind:"idea",
    must:[], want:[], avoid:"ANY" },
  { nm:"まだ何も無い",
    theme:"とくに思いつかない", joken:"", mine:"まだ何も考えていない", stuck:"何から始めればいいか分からない", kind:"idea",
    must:[], want:[], avoid:"ANY" },
];

let score = 0, full = 0, lines = [];
CASES.forEach(c => {
  const dm = new JSDOM(HTML, { url:"http://localhost/", runScripts:"dangerously", pretendToBeVisual:true,
    beforeParse(win){ win.HTMLElement.prototype.scrollIntoView = function(){}; } });
  const w = dm.window, d = w.document, g = id => d.getElementById(id);
  g("t-stuck").click();
  g("g-theme").value = c.theme; g("g-joken").value = c.joken;
  g("g-mine").value = c.mine;   g("g-stuck").value = c.stuck;
  ["g-theme","g-joken","g-mine","g-stuck"].forEach(id =>
    g(id).dispatchEvent(new w.Event("input", { bubbles:true })));
  d.querySelector('#g-kinds .chip[data-k="' + c.kind + '"]').click();
  g("g-go").click();
  const names = [...d.querySelectorAll("#g-out .gdev b")].map(e => e.textContent);
  const ex    = [...d.querySelectorAll("#g-out .ex h3")].map(e => e.textContent);

  const missed = (c.must || []).filter(n => !names.includes(n));
  const wantOk = !(c.want || []).length || c.want.some(n => names.includes(n));
  const noise  = c.avoid === "ANY" ? names : (c.avoid || []).filter(n => names.includes(n));

  const pts = (missed.length ? 0 : 1) + (wantOk ? 1 : 0) + (noise.length ? 0 : 1);
  score += pts; full += 3;
  lines.push("■ " + c.nm + "  [" + pts + "/3]"
    + "\n   出た   : " + (names.join(" / ") || "（なし）")
    + (missed.length ? "\n   ★欠け : " + missed.join(" / ") : "")
    + (wantOk ? "" : "\n   ★望み : " + c.want.join(" / ") + " が1つも出ない")
    + (noise.length ? "\n   ★雑音 : " + noise.join(" / ") : "")
    + "\n   授業例 : " + (ex.join(" / ") || "（なし）"));
  dm.window.close();
});
console.log(lines.join("\n\n"));
console.log("\n合計 " + score + " / " + full);
