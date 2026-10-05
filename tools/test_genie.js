/* ⓪「ジーニーに当ててもらう」の動作確認。
     node tools/test_genie.js
   1) 全カードそれぞれを「思いうかべた生徒」が正直に答えたら、当てられるか
   2) 答えをときどきまちがえる生徒でも、だいたい当てられるか
   3) 画面の流れ（はじめる → 答える → もどる → 当てる → 下の欄にうつる） */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
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
    w.print = function () {};
    w.confirm = function () { return true; };
  },
});
dom.window.addEventListener("error", e => errs.push(String(e.error || e.message)));
const w = dom.window, d = w.document;
const $ = id => d.getElementById(id);
const J = s => w.eval(s);

console.log("=== 読み込み ===");
ok("スクリプトがエラーなく走る", errs.length === 0, errs.join(" / "));
ok("画像が埋めこまれている", /^data:image\/webp;base64,/.test(J("GENIE_IMG")));
const TANE = J("TANE.map(function(t){return t.id;})");
ok("どのカードにも札の行がある", TANE.every(id => J("typeof GN_TAG['" + id + "']") === "string"),
   TANE.filter(id => J("typeof GN_TAG['" + id + "']") !== "string").join(","));
ok("札にないカードidがない", J("Object.keys(GN_TAG)").every(id => TANE.indexOf(id) >= 0));

console.log("=== 質問に答えだけ・装置名が入っていない ===");
const qs = J("GN_Q.map(function(q){return q.q;})").join("\n");
const devs = J("DEV.map(function(v){return v.n||'';})").filter(Boolean);
const leak = devs.filter(n => n.length >= 3 && qs.indexOf(n) >= 0);
ok("質問に装置名が出てこない", leak.length === 0, leak.join(","));
ok("質問に「センサ」が出てこない", qs.indexOf("センサ") < 0);

/* 決まった並びの乱数 */
J(`var __s=1; function __rnd(){ __s=(__s*16807)%2147483647; return (__s-1)/2147483646; }`);

/* 生徒をまねる。noise: 答えをずらす割合 */
function play(id, noise, seed) {
  return J(`(function(){
    __s=${seed};
    var t=taneOf('${id}'), h=[], cur=gnNext(h,__rnd), guard=0;
    while(guard++<60){
      if(cur.q){
        var y=gnQ(cur.q).f(t), a=y?'yes':'no', r=__rnd();
        if(r<${noise}*0.5) a=y?'prob':'pnot';
        else if(r<${noise}*0.8) a='dk';
        else if(r<${noise}) a=y?'no':'yes';
        h.push({q:cur.q,a:a});
      }else if(cur.g){
        if(cur.g==='${id}') return {hit:1,q:gnCount(h).q,g:gnCount(h).g};
        h.push({g:cur.g});
      }else return {hit:0,q:gnCount(h).q,g:gnCount(h).g};
      cur=gnNext(h,__rnd);
    }
    return {hit:0,q:99,g:0};
  })()`);
}

console.log(`=== 正直に答える生徒（${TANE.length}枚 × 3通りの質問順） ===`);
let hit = 0, n = 0, qsum = 0, first = 0; const miss = [];
TANE.forEach(id => [1, 7, 42].forEach(seed => {
  const r = play(id, 0, seed); n++;
  if (r.hit) { hit++; qsum += r.q; if (r.g === 0) first++; } else miss.push(id);
}));
console.log(`  当たり ${hit}/${n}（1回めで当てた ${first}）・平均 ${(qsum / Math.max(hit, 1)).toFixed(1)} 問`);
ok("正直に答えれば、3回以内でほぼ全部当たる（97%以上）", hit / n >= 0.97, [...new Set(miss)].join(","));
ok("平均14問以内で当たる", qsum / Math.max(hit, 1) <= 14);

console.log("=== ときどきまちがえる生徒（2割ずれる） ===");
let hit2 = 0, n2 = 0;
TANE.forEach(id => [3, 11, 29].forEach(seed => { n2++; if (play(id, 0.2, seed).hit) hit2++; }));
console.log(`  当たり ${hit2}/${n2}`);
ok("2割ずれても、7割以上は当たる", hit2 / n2 >= 0.7);

console.log("=== 画面の流れ ===");
const click = el => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
$("t-find0").click();
const gb = d.querySelector('.m-mode[data-m="genie"]');
ok("入口にジーニーがある", !!gb);
ok("入口のボタンに顔がある", !!(gb && gb.querySelector("img.gn-av")));
click(gb);
ok("ジーニーの舞台が出る", !!d.querySelector("#m-work .gn-stage"));
ok("はじめは質問せずに、思いうかべさせる", !!$("gn-start") && !d.querySelector(".gn-a[data-a]"));
click($("gn-start"));
ok("質問が出る", d.querySelectorAll(".gn-a[data-a]").length === 5);
ok("「しつもん 1」", /しつもん 1/.test(d.querySelector(".gn-k").textContent));
const q1 = d.querySelector(".gn-say").textContent;
click(d.querySelector('.gn-a[data-a="yes"]'));
ok("答えると次の質問", /しつもん 2/.test(d.querySelector(".gn-k").textContent));
ok("はっきり答えると有力な候補数が減る", Number(d.querySelector('.gn-status').textContent.match(/候補 (\d+)件/)[1]) < TANE.length);
click($("gn-back"));
ok("ひとつもどると前の質問に戻る", d.querySelector(".gn-say").textContent === q1 && /しつもん 1/.test(d.querySelector(".gn-k").textContent));
ok("答えは保存されている", (() => { try { return !!JSON.parse(w.localStorage.getItem("keisoku-gyakubiki-mitsukeru")).gn; } catch (e) { return false; } })());

/* 1枚を思いうかべて、画面で最後まで答える */
const target = "h03";
let guard = 0;
while (guard++ < 40) {
  const cur = J("m0.gn.cur");
  if (cur.q) {
    const y = J(`gnQ('${cur.q}').f(taneOf('${target}'))`);
    click(d.querySelector('.gn-a[data-a="' + (y ? "yes" : "no") + '"]'));
  } else if (cur.g) {
    if (cur.g === target) { click($("gn-hit")); break; }
    click($("gn-miss"));
  } else break;
}
ok("画面で答えても当てられる", J("m0.gn.cur && m0.gn.cur.hit") === target);
ok("当てた画面に hint を出さない", d.querySelector(".gn-stage").textContent.indexOf(J(`taneOf('${target}').hint`)) < 0);
click(d.querySelector(".gn-stage .m-take"));
ok("「もんだいの文をつくる」で こまりごとが下の欄にうつる", $("m-komari").value === J(`taneOf('${target}').t`));
ok("型もうつる", J("m0.kt") === J(`taneOf('${target}').kt`));
ok("何が分かれば は空のまま（肩代わりしない）", $("m-wakaru").value === "");

/* あいまいな回答では無理に当てず、候補を見て選べる */
J("m0.gn={h:[],cur:null}"); J("m0RenderWork()");
click($("gn-start"));
guard = 0;
while (guard++ < 60) {
  const cur = J("m0.gn.cur");
  if (cur.q) click(d.querySelector('.gn-a[data-a="dk"]'));
  else if (cur.g) click($("gn-miss"));
  else break;
}
ok("わからないが3回続くと候補一覧", J("m0.gn.cur.list") === 1 && J("m0.gn.h.length") === 3);
ok("6件の候補から選べる", d.querySelectorAll(".gn-near .m-take").length === 6);
ok("根拠のない型を決めつけない", J("gnKata(m0.gn.h)") === null);
ok("外したカードは近いカードに出さない", [...d.querySelectorAll(".gn-near .m-take")].every(b => J("m0.gn.h").every(x => x.g !== b.dataset.take)));
/* 「はい」と答えた型があれば、それを渡す */
J("m0.gn={h:[{q:'k-osoi',a:'yes'},{q:'ie',a:'dk'},{g:'t25'},{g:'t26'},{g:'t27'}],cur:{lose:1}}"); J("m0RenderWork()");
J("m0.kt=''");
click($("gn-kt"));
ok("型だけもらえる（はいと答えた型）", J("m0.kt") === "osoi");
ok("型をもらうと こまりごとの欄へ", d.activeElement === $("m-komari"));

click($("gn-reset"));
ok("はじめからで最初の画面に戻る", !!$("gn-start"));

console.log("=== 分野・候補一覧・保存 ===");
ok("18分野と全部から探す入口", d.querySelectorAll(".gn-topic").length === 19);
click(d.querySelector('[data-topic="music"]'));
ok("分野を選ぶと対象が絞られる", J("m0.gn.topic") === "music" && J("gnScope('music').length") < TANE.length);
click($("gn-start"));
const musicQ = J("m0.gn.cur.q");
click($("gn-browse"));
ok("分野内の候補だけ出る", [...d.querySelectorAll(".gn-near .m-take")].every(b => J(`gnInTopic(taneOf('${b.dataset.take}'),'music')`)));
ok("最初の質問から候補を見るときも戻れる", !$("gn-back").disabled);
click($("gn-back"));
ok("候補一覧から同じ質問に戻る", J("m0.gn.cur.q") === musicQ && J("m0.gn.h.length") === 0);
click($("gn-browse"));
const saved = J("JSON.stringify(m0.gn)");
J("m0.gn=gnNew();m0Load();m0RenderWork()");
ok("分野と候補一覧の状態が復元される", J("JSON.stringify(m0.gn)") === saved);
click($("gn-reset"));
click($("gn-browse"));
const firstPage = [...d.querySelectorAll(".gn-near .m-take")].map(b => b.dataset.take);
ok("未回答の候補は困り方を分散する", new Set(firstPage.map(id => J(`taneOf('${id}').kt`))).size >= 4);
let listed = [...firstPage];
while ($("gn-more")) {
  click($("gn-more"));
  listed.push(...[...d.querySelectorAll(".gn-near .m-take")].map(b => b.dataset.take));
}
ok("ページを送れば149件を重複なく見られる", listed.length === TANE.length && new Set(listed).size === TANE.length);
click($("gn-first"));
ok("最初のページに戻れる", [...d.querySelectorAll(".gn-near .m-take")].map(b => b.dataset.take).join() === firstPage.join());
click($("gn-own"));
ok("自分で書くと入力欄へ移る", d.activeElement === $("m-komari"));
click(d.querySelector(".gn-near .m-take"));
ok("一覧から選んでも問題文へ渡せる", $("m-komari").value === J(`taneOf('${firstPage[0]}').t`) && $("m-wakaru").value === "");
ok("3回外したら終了し、外した候補は出さない", J("gnNext([{g:'t01'},{g:'t02'},{g:'t03'}]).lose") === 1 && !J("gnNear([{g:'t01'},{g:'t02'},{g:'t03'}],6)").some(id => ['t01','t02','t03'].includes(id)));
ok("質問の上限では候補一覧", J("gnNext(GN_Q.slice(0,20).map(function(q){return {q:q.k,a:'prob'};})).list") === 1);

console.log("=== 文章の場面から手で決めた回答で絞れるか ===");
// f(カード)を正解として再利用せず、本文を読んで独立に定めた回答。
const realCases = [
  {id:'n17', yes:['gakkou','b-kyoushitsu','d-noise','topic-sound','H','T','k-choudo'], no:['M','N','D','d-music','d-trash']},
  {id:'n21', yes:['ie','b-genkan','d-bag','d-morning','F','Y','k-wasure'], no:['gakkou','M','N','d-trash','d-clock']},
  {id:'n25', yes:['ie','b-heya','d-clock','d-morning','Y','k-wasure'], no:['gakkou','M','N','F','d-bag','d-trash']},
  {id:'n29', yes:['ie','b-toilet','d-stock','k-osoi'], no:['gakkou','M','N','F','d-trash','d-clothes']},
  {id:'n49', yes:['gakkou','b-kyoushitsu','d-trash','d-spill','k-osoi'], no:['ie','M','N','D','d-noise']},
  {id:'n53', yes:['gakkou','b-taiikukan','d-sport','d-body','d-measure','k-kazoe'], no:['ie','M','N','D','d-music']},
  {id:'n57', yes:['gakkou','b-taiikukan','d-music','d-clock','k-barabara'], no:['ie','M','N','D','d-sport']},
  {id:'n65', yes:['ie','b-heya','d-clock','d-study','k-choudo'], no:['gakkou','M','N','D','d-music','d-sport']},
  {id:'n69', yes:['ie','b-beranda','M','d-rain','d-measure','k-kazoe'], no:['gakkou','N','D','d-bag','d-clothes']},
];
realCases.forEach(c => {
  const h = c.yes.map(q => ({q,a:'yes'})).concat(c.no.map(q => ({q,a:'no'})));
  const rank = J(`gnNear(${JSON.stringify(h)},6)`);
  ok(`実際の場面 ${c.id} は上位6件に入る`, rank.includes(c.id), rank.join(','));
});
console.log("=== 分野から始めても全カードを見分けられる ===");
let scoped = 0, scopedHit = 0;
J("m0.gn=gnNew()");
J("GN_TOPICS").forEach(topic => {
  J(`gnScope('${topic.k}').map(function(t){return t.id;})`).forEach(id => {
    const result = J(`(function(){var h=[],cur=gnNext(h,function(){return 0;},'${topic.k}');for(var i=0;i<50;i++){if(cur.q){h.push({q:cur.q,a:gnQ(cur.q).f(taneOf('${id}'))?'yes':'no'});}else if(cur.g){if(cur.g==='${id}')return true;h.push({g:cur.g});}else return false;cur=gnNext(h,function(){return 0;},'${topic.k}');}return false;})()`);
    scoped++; if(result) scopedHit++;
  });
});
console.log(`  分野内の当たり ${scopedHit}/${scoped}`);
ok("分野から始めると正確な回答で全候補を当てられる", scopedHit === scoped);
ok("最後までエラーなし", errs.length === 0, errs.join(" / "));

console.log(`\n${pass} ok / ${fail} NG`);
process.exit(fail ? 1 : 0);
