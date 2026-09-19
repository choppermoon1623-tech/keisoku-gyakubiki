/* 計測・制御 逆引き ―― クラウド連携（生徒が送る／先生が返す）の検査

   生徒用と先生用の jsdom を同時に立ち上げ、共通の偽Firestoreでつないで
   実際にやりとりさせる。Firebase の module script は jsdom が実行しないので、
   beforeParse で window.fbq に偽物を刺している。

   偽Firestore は AIおたずね箱の scratchpad/smoke/test_otazune.js と同じ作りで、
   ルールの要点（受付が開いているか・持ち主か・出した本人か・status）を真似る。
   ★ 本物のセキュリティルールの挙動はこれでは分からない。そこは実機で確かめること。

     node tools/test_cloud.js
*/
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra){
  if(cond) pass++;
  else { fail++; fails.push(name + (extra ? "  → " + extra : "")); }
}
const clone = o => JSON.parse(JSON.stringify(o));
const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async () => { for(let i = 0; i < 6; i++) await tick(); };

/* ---------- 偽Firestore（おたずね箱のルールの要点を真似る） ---------- */
function makeBackend(){
  const rooms = new Map();           // code -> room
  const reqs  = new Map();           // code -> Map(id -> req)
  const subs  = { rooms:[], reqs:[] };
  let seq = 0;
  const denied = () => Object.assign(new Error("permission-denied"), { code:"permission-denied" });

  function fire(){
    subs.rooms.forEach(s => s.cb([...rooms.values()].filter(r => r.ownerUid === s.uid).map(clone)));
    subs.reqs.forEach(s => {
      const m = reqs.get(s.code) || new Map();
      let l = [...m.values()];
      /* 生徒は自分が出した分だけ、先生は自分が持ち主の分だけ。
         where を外したクエリは本物のルールなら丸ごと拒否される */
      l = s.mine ? l.filter(r => r.authorUid === s.mine) : l.filter(r => r.ownerUid === s.uid);
      s.cb(l.map(clone));
    });
  }
  return {
    rooms, reqs, fire, subs,
    getRoom(code){ return rooms.has(code) ? clone(rooms.get(code)) : null; },
    saveRoom(code, data, uid){
      const cur = rooms.get(code);
      if(cur && cur.ownerUid !== uid) throw denied();
      if(!cur && data.ownerUid !== uid) throw denied();
      rooms.set(code, Object.assign({ id:code }, cur || {}, data));
      fire();
    },
    addReq(code, data, uid){
      const room = rooms.get(code);
      if(!room || room.open !== true) throw denied();
      if(room.ownerUid !== data.ownerUid) throw denied();
      if(data.authorUid !== uid) throw denied();
      if(data.status !== "new" || data.answer !== "") throw denied();
      if(typeof data.name !== "string" || data.name.length > 40) throw denied();
      if(!data.fields || typeof data.fields !== "object") throw denied();
      /* ルールの hasOnly。余計なキーがあると create が通らない */
      const allowed = ["v","ownerUid","authorUid","no","name","kind","fields",
                       "status","answer","memo","policy","createdAt","updatedAt","answeredAt"];
      if(Object.keys(data).some(k => allowed.indexOf(k) < 0)) throw denied();
      if(!reqs.has(code)) reqs.set(code, new Map());
      const id = "r" + (++seq);
      reqs.get(code).set(id, Object.assign({ id }, data));
      fire();
      return id;
    },
    updateReq(code, id, patch, uid){
      const m = reqs.get(code), cur = m && m.get(id);
      if(!cur) throw Object.assign(new Error("not-found"), { code:"not-found" });
      const isOwner = cur.ownerUid === uid, isAuthor = cur.authorUid === uid;
      if(!isOwner && !(isAuthor && cur.status === "new")) throw denied();
      m.set(id, Object.assign({}, cur, patch));
      fire();
    },
    deleteReq(code, id, uid){
      const m = reqs.get(code), cur = m && m.get(id);
      if(!cur) return;
      if(cur.ownerUid !== uid && !(cur.authorUid === uid && cur.status === "new")) throw denied();
      m.delete(id); fire();
    }
  };
}

/* ---------- 偽 window.fbq（index.html が呼ぶ形にそろえる） ---------- */
function makeFbq(be, anonUid){
  let user = null;
  const cbs = [];
  const un = { rooms:null, reqs:null, mine:null };
  const set = (uid, anon) => {
    user = uid ? { uid, isAnonymous:!!anon, displayName: anon ? "" : uid, email: anon ? "" : uid + "@school.jp" } : null;
    cbs.forEach(cb => cb(user));
  };
  const api = {
    __set:set,
    onAuth(cb){ cbs.push(cb); cb(user); },
    user(){ return user; },
    uid(){ return user ? user.uid : null; },
    isAnon(){ return !!(user && user.isAnonymous); },
    signInTeacher(){ set("teacher1", false); return Promise.resolve(user); },
    signInStudent(){ if(user) return Promise.resolve(user); set(anonUid || "stuA", true); return Promise.resolve(user); },
    signOut(){ api.stopAll(); set(null); return Promise.resolve(); },
    stopAll(){ ["rooms","reqs","mine"].forEach(k => { if(un[k]){ un[k](); un[k] = null; } }); },
    stopReqs(){ if(un.reqs){ un.reqs(); un.reqs = null; } },
    stopMine(){ if(un.mine){ un.mine(); un.mine = null; } },
    /* 打ちかえの競合を試すため、受付コードごとに応答を遅らせられるようにする。
       api.__delay[コード] = ミリ秒 */
    __delay: {},
    getRoom(code){
      const room = be.getRoom(code);
      const d = api.__delay[code] || 0;
      if(!d) return Promise.resolve(room);
      return new Promise(res => setTimeout(() => res(room), d));
    },
    saveRoom(code, data){ try{ be.saveRoom(code, data, api.uid()); return Promise.resolve(); }catch(e){ return Promise.reject(e); } },
    watchRooms(uid, cb){
      if(un.rooms) un.rooms();
      const s = { uid, cb }; be.subs.rooms.push(s);
      un.rooms = () => { const i = be.subs.rooms.indexOf(s); if(i >= 0) be.subs.rooms.splice(i, 1); };
      be.fire();
    },
    watchReqs(code, cb){
      if(un.reqs) un.reqs();
      const s = { code, mine:null, uid:api.uid(), cb }; be.subs.reqs.push(s);
      un.reqs = () => { const i = be.subs.reqs.indexOf(s); if(i >= 0) be.subs.reqs.splice(i, 1); };
      be.fire();
    },
    watchMine(code, uid, cb){
      if(un.mine) un.mine();
      const s = { code, mine:uid, uid, cb }; be.subs.reqs.push(s);
      un.mine = () => { const i = be.subs.reqs.indexOf(s); if(i >= 0) be.subs.reqs.splice(i, 1); };
      be.fire();
    },
    addReq(code, data){ try{ be.addReq(code, data, api.uid()); return Promise.resolve(); }catch(e){ return Promise.reject(e); } },
    updateReq(code, id, patch){ try{ be.updateReq(code, id, patch, api.uid()); return Promise.resolve(); }catch(e){ return Promise.reject(e); } },
    deleteReq(code, id){ try{ be.deleteReq(code, id, api.uid()); return Promise.resolve(); }catch(e){ return Promise.reject(e); } }
  };
  return api;
}

const errs = [];
function makeWindow(be, anonUid){
  const dom = new JSDOM(HTML, {
    url: "https://keisoku.test/", runScripts:"dangerously", pretendToBeVisual:true,
    beforeParse(w){
      w.fbq = makeFbq(be, anonUid);
      w.HTMLElement.prototype.scrollIntoView = function(){};
      w.scrollTo = () => {};
      w.confirm = () => true;
      w.alert = () => {};
      w.onerror = m => errs.push(String(m));
    }
  });
  /* module script は jsdom が走らせないので、fbq-ready を自分で撃つ */
  dom.window.dispatchEvent(new dom.window.Event("fbq-ready"));
  return dom;
}

function typeIn(w, id, v){
  const el = w.document.getElementById(id);
  el.value = v;
  el.dispatchEvent(new w.Event("input", { bubbles:true }));
}

(async function main(){
  const be = makeBackend();

  /* ---------- 先生：ログインして受付をつくる ---------- */
  const T = makeWindow(be), tw = T.window, td = tw.document, t = id => td.getElementById(id);
  t("t-teach").click();
  console.log("=== 先生：受付をひらく ===");
  ok("最初はログインの案内が出ている", t("k-signin").hidden === false && t("k-signed").hidden === true);
  t("k-login").click();
  await settle();
  ok("ログインすると受付の画面になる", t("k-signin").hidden === true && t("k-signed").hidden === false);
  ok("だれでログインしたかが出る", /teacher1/.test(t("k-who").textContent), t("k-who").textContent);
  ok("受付が無いことが分かる", /まだ受付がありません/.test(t("k-rooms").textContent));

  typeIn(tw, "k-newtitle", "2年A組 計測・制御");
  t("k-newroom").click();
  await settle();
  const CODE = [...be.rooms.keys()][0];
  ok("受付が1つできた", be.rooms.size === 1, String(be.rooms.size));
  ok("コードは6文字", /^[A-Z0-9]{6}$/.test(CODE || ""), CODE);
  ok("まぎらわしい I O 0 1 を使っていない", !/[IO01]/.test(CODE || ""), CODE);
  ok("コードが画面に出る", t("k-rooms").textContent.indexOf(CODE) >= 0);
  ok("受付は開いた状態ではじまる", be.rooms.get(CODE).open === true);
  ok("作った本人が持ち主", be.rooms.get(CODE).ownerUid === "teacher1");
  ok("受付の名前がついている", be.rooms.get(CODE).title === "2年A組 計測・制御");
  ok("おたずね箱の型として計測・制御が入る",
     JSON.stringify(be.rooms.get(CODE).kinds) === JSON.stringify(["keisoku"]),
     JSON.stringify(be.rooms.get(CODE).kinds));
  ok("この時点では届いていない", /まだ届いていません/.test(t("k-cloudlist").textContent));

  /* ---------- 生徒A：コードを入れて送る ---------- */
  const S = makeWindow(be, "stuA"), sw = S.window, sd = sw.document, s = id => sd.getElementById(id);
  s("t-stuck").click();
  console.log("=== 生徒：受付コードを入れて送る ===");
  ok("コードが無いうちは送れない", s("g-send").disabled === true);
  ok("答えの欄はからっぽ", s("g-inbox").innerHTML === "");

  typeIn(sw, "g-theme", "祖父が夜トイレに行くとき、暗くてあぶない");
  typeIn(sw, "g-mine",  "人が通ったら電気をつける案を考えた");
  typeIn(sw, "g-stuck", "夜だけ動かしたいのに、昼も反応してしまう");
  typeIn(sw, "g-name",  "1年A組 12番 山田");
  sd.querySelector('#g-kinds .chip[data-k="cond"]').click();
  ok("3つ書いてもコードが無ければ送れない", s("g-send").disabled === true);

  typeIn(sw, "g-code", "ZZZZZZ");
  await settle();
  ok("知らないコードは断られる", /見つかりませんでした/.test(s("g-roommsg").textContent), s("g-roommsg").textContent);
  ok("知らないコードでは送れない", s("g-send").disabled === true);

  typeIn(sw, "g-code", CODE.toLowerCase());
  await settle();
  ok("小文字で入れても大文字になる", s("g-code").value === CODE, s("g-code").value);
  ok("受付につながったと出る", /につながりました/.test(s("g-roommsg").textContent), s("g-roommsg").textContent);
  ok("受付の名前が出る", s("g-roommsg").textContent.indexOf("2年A組") >= 0, s("g-roommsg").textContent);
  ok("ここで送れるようになる", s("g-send").disabled === false);

  s("g-send").click();
  await settle();
  ok("先生に届いたと出る", /先生に届きました/.test(s("g-sendmsg").textContent), s("g-sendmsg").textContent);
  const box = be.reqs.get(CODE);
  ok("クラウドに1件入った", box && box.size === 1, box ? String(box.size) : "なし");
  const sent = [...box.values()][0];
  ok("型は計測・制御", sent.kind === "keisoku", sent.kind);
  ok("持ち主は先生", sent.ownerUid === "teacher1");
  ok("出した人は生徒A", sent.authorUid === "stuA");
  ok("未対応ではじまる", sent.status === "new");
  ok("答えはからっぽで送られる", sent.answer === "");
  ok("テーマが入っている", sent.fields.theme.indexOf("祖父") >= 0);
  ok("行きづまりが入っている", sent.fields.stuck.indexOf("昼も反応") >= 0);
  ok("困っていることが入っている", /しきい値/.test(sent.fields.komari), sent.fields.komari);
  ok("逆引きが出した計測の候補も送られる", /センサ/.test(sent.fields.sens || ""), sent.fields.sens);
  ok("なまえが入っている", sent.name === "1年A組 12番 山田");

  console.log("=== 生徒：自分の相談が見える ===");
  ok("自分の相談が画面に出る", sd.querySelectorAll("#g-inbox .card").length === 1);
  ok("待っている状態だと分かる", /先生が見るのを待っています/.test(s("g-inbox").textContent));
  ok("まだ答えは出ていない", sd.querySelectorAll("#g-inbox .ans").length === 0);
  ok("先生が見る前なら取り消せる", sd.querySelectorAll("#g-inbox .cdel").length === 1);

  /* ---------- 先生：届いた相談を開いて返す ---------- */
  console.log("=== 先生：届いた相談を開く ===");
  await settle();
  ok("先生の一覧に出る", td.querySelectorAll("#k-cloudlist .card").length === 1,
     t("k-cloudlist").textContent.slice(0, 60));
  ok("なまえが見える", t("k-cloudlist").textContent.indexOf("山田") >= 0);
  ok("未対応と出る", /未対応/.test(t("k-cloudlist").textContent));

  td.querySelector("#k-cloudlist .cpick").click();
  await settle();
  ok("④のフォームが開く", t("k-edit").hidden === false);
  ok("テーマが入る", t("k-theme").value.indexOf("祖父") >= 0, t("k-theme").value);
  ok("行きづまりが入る", t("k-stuck").value.indexOf("昼も反応") >= 0);
  ok("困っていることのチップが選ばれる",
     !!td.querySelector('#k-kind .chip[aria-pressed="true"]'));
  ok("クラウドの相談だと分かる表示が出る", t("k-src-lb").hidden === false
     && t("k-src-lb").textContent.indexOf(CODE) >= 0, t("k-src-lb").textContent);
  ok("「生徒に返す」が出る", t("c-reply").hidden === false);
  ok("ローカル用の「返したことにする」は隠れる", t("k-done").hidden === true);

  const src = t("t-src").value;
  console.log("=== AIに送る文 ===");
  ok("AIに送る文ができている", src.length > 400, String(src.length));
  ok("生徒が書いた内容が入る", src.indexOf("祖父") >= 0);
  /* もとは「この学校で使える装置」。実物があるか確かめていないので言い方を変えた */
  ok("装置の一覧が同梱される", /この教材で扱う装置/.test(src));
  ok("学校にあると断定していない", src.indexOf("この学校で使える装置") < 0);
  ok("実物の有無は教師が確認すると書いてある", /実物があるとはかぎりません/.test(src));
  ok("一覧に無い部品をすすめるなと書いてある", /そこに無い部品/.test(src));
  ok("つなぎ方や数値は書くなと指示がある", /コネクタ番号/.test(src) && /しきい値の具体的な数値/.test(src));
  ok("石川研究室の資料を見よと書いてある", /石川研究室/.test(src));
  ok("そのまま提出できる完成品は書くなとある", /完成品/.test(src));

  console.log("=== 先生：答えを返す ===");
  t("c-reply").click();
  await settle();
  ok("答えが空なら返せない", /空です/.test(t("c-msg").textContent), t("c-msg").textContent);
  ok("空のまま返していない", [...be.reqs.get(CODE).values()][0].status === "new");

  t("c-work").click();
  await settle();
  ok("対応中にできる", [...be.reqs.get(CODE).values()][0].status === "work");
  await settle();
  ok("生徒の画面も対応中になる", /先生が見ています/.test(s("g-inbox").textContent));
  ok("対応中になったら取り消せない", sd.querySelectorAll("#g-inbox .cdel").length === 0);

  t("t-ans").value = "夜だけ動かしたいのですね。まず、昼と夜で光センサの値がどう変わるかを読んでみましょう。";
  t("t-ans").dispatchEvent(new tw.Event("input", { bubbles:true }));
  t("c-reply").click();
  await settle();
  const done = [...be.reqs.get(CODE).values()][0];
  ok("返すと「返した」になる", done.status === "done", done.status);
  ok("答えが保存される", done.answer.indexOf("光センサ") >= 0);
  ok("答え方の方針も残る", !!done.policy, done.policy);
  ok("返した時刻が入る", done.answeredAt > 0);

  console.log("=== 生徒：答えが届く ===");
  await settle();
  ok("答えが返ってきたと出る", /答えが返ってきました/.test(s("g-inbox").textContent));
  ok("答えの中身が画面に出る", s("g-inbox").textContent.indexOf("光センサ") >= 0);
  ok("答えの枠が出る", sd.querySelectorAll("#g-inbox .ans").length === 1);

  /* ---------- 他人の相談は見えない ---------- */
  console.log("=== ほかの人の相談は見えない ===");
  const S2 = makeWindow(be, "stuB"), s2w = S2.window, s2d = s2w.document, s2 = id => s2d.getElementById(id);
  s2("t-stuck").click();
  typeIn(s2w, "g-theme", "教室が暑いのに気づかない");
  typeIn(s2w, "g-mine",  "温度をはかる案");
  typeIn(s2w, "g-stuck", "はかったあとどう知らせるか");
  s2d.querySelector('#g-kinds .chip[data-k="dev"]').click();
  typeIn(s2w, "g-code", CODE);
  await settle();
  s2("g-send").click();
  await settle();
  ok("生徒Bも送れた", be.reqs.get(CODE).size === 2, String(be.reqs.get(CODE).size));
  ok("生徒Bには自分の1件だけ見える", s2d.querySelectorAll("#g-inbox .card").length === 1,
     String(s2d.querySelectorAll("#g-inbox .card").length));
  ok("生徒Bの画面に生徒Aのテーマは出ない", s2("g-inbox").textContent.indexOf("祖父") < 0);
  await settle();
  ok("生徒Aにも自分の1件だけ", sd.querySelectorAll("#g-inbox .card").length === 1);
  ok("生徒Aの画面に生徒Bのテーマは出ない", s("g-inbox").textContent.indexOf("教室が暑い") < 0);
  ok("先生には2件とも見える", td.querySelectorAll("#k-cloudlist .card").length === 2,
     String(td.querySelectorAll("#k-cloudlist .card").length));

  /* ---------- 受付を閉じる ---------- */
  console.log("=== 受付を閉じる ===");
  td.querySelectorAll("#k-rooms .rtoggle")[0].click();
  await settle();
  ok("受付が閉じる", be.rooms.get(CODE).open === false);
  const S3 = makeWindow(be, "stuC"), s3w = S3.window, s3d = s3w.document, s3 = id => s3d.getElementById(id);
  s3("t-stuck").click();
  typeIn(s3w, "g-theme", "あとから来た人");
  typeIn(s3w, "g-mine",  "何か考えた");
  typeIn(s3w, "g-stuck", "止まった");
  s3d.querySelector('#g-kinds .chip[data-k="idea"]').click();
  typeIn(s3w, "g-code", CODE);
  await settle();
  ok("閉じた受付には送れない", s3("g-send").disabled === true);
  ok("閉じていると画面に出る", /閉じています/.test(s3("g-roommsg").textContent), s3("g-roommsg").textContent);
  ok("閉じても前の答えは読めると案内する", /答えは見られます/.test(s3("g-roommsg").textContent));

  /* ---------- コードを覚えている ---------- */
  console.log("=== コードを覚えている ===");
  ok("コードが localStorage に残る",
     (sw.localStorage.getItem("keisoku-gyakubiki-code") || "").indexOf(CODE) >= 0,
     sw.localStorage.getItem("keisoku-gyakubiki-code"));
  s("g-forget").click();
  await settle();
  ok("忘れさせられる", !sw.localStorage.getItem("keisoku-gyakubiki-code"));
  ok("忘れると答えの欄も消える", s("g-inbox").innerHTML === "");
  ok("忘れると送れない", s("g-send").disabled === true);

  /* ---------- 先生がログアウトすると見えなくなる ---------- */
  console.log("=== 先生がログアウトする ===");
  t("k-logout").click();
  await settle();
  ok("ログインの案内にもどる", t("k-signin").hidden === false);
  ok("受付の一覧が消える", /まだ受付がありません/.test(t("k-rooms").textContent));
  ok("届いた相談も消える", /受付をひらくと/.test(t("k-cloudlist").textContent));

  /* ================================================================
     ⑤ 古い応答を捨て、入力中のコードと送信先を必ず一致させる

     もとの形は「確認中なら新しい入力を無視する」だったので、
     1つめを確かめている最中に打ちかえると、2つめは調べられないまま、
     画面には2つめが見えているのに、つながっているのは1つめになった。
     遅い応答が後から返って上書きすることもありえた。
     ================================================================ */
  console.log("=== ⑤ 打ちかえたときに、古い応答を捨てる ===");
  /* 先生をもう一度ログインさせて、受付を2つ用意する */
  t("k-login").click();
  await settle();
  const CODE_A = CODE;                       /* さきほどの受付（いまは閉じている） */
  await be.saveRoom(CODE_A, { open:true }, "teacher1");
  typeIn(tw, "k-newtitle", "2年B組 計測・制御");
  t("k-newroom").click();
  await settle();
  const CODE_B = [...be.rooms.keys()].filter(c => c !== CODE_A)[0];
  ok("受付が2つある", !!CODE_B && CODE_B !== CODE_A, CODE_A + " / " + CODE_B);

  const S4 = makeWindow(be, "stuD"), s4w = S4.window, s4d = S4.window.document, s4 = id => s4d.getElementById(id);
  s4("t-stuck").click();
  typeIn(s4w, "g-theme", "ベランダの植木がかれる");
  typeIn(s4w, "g-mine",  "土のかわきで水をやりたい");
  typeIn(s4w, "g-stuck", "いつやればいいか決まらない");
  s4d.querySelector('#g-kinds .chip[data-k="cond"]').click();

  /* Aの応答をわざと遅らせ、Aを入れたすぐあとにBへ打ちかえる */
  s4w.fbq.__delay[CODE_A] = 60;
  typeIn(s4w, "g-code", CODE_A);
  await tick();                              /* Aの確認が飛んだ直後 */
  s4w.fbq.__delay[CODE_B] = 0;
  typeIn(s4w, "g-code", CODE_B);             /* すぐ打ちかえる */
  await settle();
  ok("打ちかえた直後はBにつながる", s4w.eval("ccode") === CODE_B, s4w.eval("ccode"));

  await new Promise(r => setTimeout(r, 120)); /* 遅れていたAの応答が返ってくる */
  await settle();
  ok("遅れて返ってきたAで上書きされない", s4w.eval("ccode") === CODE_B, s4w.eval("ccode"));
  ok("画面の案内もBのまま", /2年B組/.test(s4("g-roommsg").textContent), s4("g-roommsg").textContent);
  ok("入力欄とつながり先が一致している",
     s4("g-code").value === s4w.eval("ccode"), s4("g-code").value + " / " + s4w.eval("ccode"));
  ok("覚えているコードもBになっている",
     (s4w.localStorage.getItem("keisoku-gyakubiki-code") || "").indexOf(CODE_B) >= 0,
     s4w.localStorage.getItem("keisoku-gyakubiki-code"));

  /* 確認中に打ちかえても、2つめがちゃんと調べられる
     （もとは cChecking で丸ごと無視していたので、ここが Aのままになっていた） */
  ok("2つめのコードも調べられている", s4w.eval("croom") && s4w.eval("croom").id === CODE_B,
     JSON.stringify(s4w.eval("croom") && s4w.eval("croom").id));

  /* 送るとBに入る */
  s4("g-send").click();
  await settle();
  ok("送り先はBの受付", (be.reqs.get(CODE_B) || new Map()).size === 1,
     String((be.reqs.get(CODE_B) || new Map()).size));
  ok("Aの受付には入っていない", (be.reqs.get(CODE_A) || new Map()).size === 2,
     String((be.reqs.get(CODE_A) || new Map()).size));

  console.log("=== ⑤-b 入力中のコードとずれていたら送らせない ===");
  /* 入力欄だけ書きかえて（確認が終わる前に）押した状態を作る */
  s4w.fbq.__delay[CODE_A] = 60;
  typeIn(s4w, "g-code", CODE_A);             /* まだ確認中。ccode は B のまま */
  ok("確認が終わるまでは押せない", s4("g-send").disabled === true);
  s4w.eval("$('g-send').disabled=false;");   /* 無理に押せる状態にして確かめる */
  s4("g-send").click();
  await settle();
  ok("ずれていたら送らない", (be.reqs.get(CODE_B) || new Map()).size === 1,
     String((be.reqs.get(CODE_B) || new Map()).size));
  ok("ずれている理由を知らせる", /受付コードが変わりました/.test(s4("g-sendmsg").textContent),
     s4("g-sendmsg").textContent);
  await new Promise(r => setTimeout(r, 120));
  await settle();
  ok("待てばAにつながる", s4w.eval("ccode") === CODE_A, s4w.eval("ccode"));
  ok("つながれば送れるようになる", s4("g-send").disabled === false);

  console.log("=== エラー ===");
  ok("実行時エラーは出ていない", errs.length === 0, errs.join(" / "));

  if(fails.length) console.log("\n" + fails.map(f => "  NG  " + f).join("\n"));
  console.log("\n結果: " + pass + " 件 合格 / " + fail + " 件 不合格");
  process.exit(fail ? 1 : 0);
})();
