
/* =========================================================
   ⓪の4つめの入口：ジーニーに当ててもらう（アキネーター風）
   「なんにも思いつかない」生徒でも、聞かれたことに答えるだけなら できる。
   ★AIではない。★ 77枚の困りごとカード（var TANE）を、
   質問への答えで しぼりこんでいくだけ。通信もしない。
   ★当てたあとは、カードの文を下の欄にうつすだけ（「これにする」と同じ）。★
   hint（何が分かれば）はここでも出さない。課題の設定を肩代わりしないため。
   ========================================================= */
var GN_HOME   = ['daidokoro','furo','genkan','heya','toilet','beranda','kazoku'];
var GN_SCHOOL = ['kyoushitsu','rouka','taiikukan'];
var GN_OUT    = ['tsuugaku','hatake','mise'];

/* 場所と型だけでは見分けがつかないので、場面に出てくるものを1文字の札で持たせる。
   M 水・お湯・雨・しめりけ ／ N 火・暑さ寒さ・熱いもの ／ A 明るさ・暗さ・あかり
   H だれかが来る・近づく・通る ／ K 家電・ストーブなどの道具 ／ P 植物・作物
   F 料理・食べ物・えさ ／ D 動物・生き物 ／ T こまるのは自分より家ぞく・ほかの人
   Y 夜・朝・毎朝など決まった時間帯 ／ R 自分がその場にいないとき ／ S 気になる・心配
   ★札は「場面のようす」だけ。何が分かれば助かるか（hint）は入れない。★ */
var GN_TAG = {
 t01:'NKRS', t02:'AR',  t03:'M',   t04:'RS',  t05:'KF',  t06:'A',
 t07:'MN',   t08:'K',   t09:'H',   t10:'H',   t11:'MD',  t12:'D',
 t13:'MNF',  t14:'NKTH',t15:'MP',  t16:'MS',  t17:'DF',  t18:'N',
 t19:'MP',   t20:'N',   t21:'A',   t22:'MN',  t23:'MND', t24:'NKY',
 t25:'M',    t26:'NF',  t27:'MD',  t28:'M',   t29:'',    t30:'M',
 t31:'MA',   t32:'H',   t33:'NKY', t34:'TH',  t35:'',    t36:'A',
 t37:'MP',   t38:'NKF', t39:'Y',   t40:'M',   t41:'Y',   t42:'N',
 t43:'AY',   t44:'H',   t45:'H',   t46:'AYT', t47:'NK',  t48:'H',
 t49:'H',    t50:'N',   t51:'MP',  t52:'',    t53:'Y',   t54:'H',
 t55:'MPRS', t56:'TRS', t57:'DRS', t58:'NR',  t59:'T',   t60:'T',
 h01:'Y',    h02:'MN',  h03:'N',   h04:'',    h05:'NK',  h06:'MN',
 h07:'',     h08:'S',   h09:'',    h10:'',    h11:'DS',  h12:'D',
 h13:'DP',   h14:'D',   h15:'DR',  h16:'D',   h17:'DNY'
};
function gnTag(t,c){ return String(GN_TAG[t.id]||'').indexOf(c)>=0; }
function gnBa(t,list){ return t.ba.some(function(b){ return list.indexOf(b)>=0; }); }

/* 質問。f(カード) が true のカードは「はい」の側。 */
var GN_Q = [
 {k:'ie',     q:'それは、家（家の中や、家のまわり）で起きること？',      f:function(t){ return gnBa(t,GN_HOME); }},
 {k:'gakkou', q:'それは、学校で起きること？',                            f:function(t){ return gnBa(t,GN_SCHOOL); }},
 {k:'soto',   q:'通学路・畑・お店など、家と学校の外での話？',            f:function(t){ return gnBa(t,GN_OUT); }},
 {k:'yuki',   q:'冬や雪に関係のある話？',                                f:function(t){ return t.ba.indexOf('yuki')>=0; }},
 {k:'b-daidokoro', q:'台所や、料理のときの話？',          f:function(t){ return t.ba.indexOf('daidokoro')>=0; }},
 {k:'b-furo',      q:'おふろの話？',                      f:function(t){ return t.ba.indexOf('furo')>=0; }},
 {k:'b-genkan',    q:'げんかん（家の出入り口）の話？',    f:function(t){ return t.ba.indexOf('genkan')>=0; }},
 {k:'b-heya',      q:'自分の部屋や、家の部屋の中の話？',  f:function(t){ return t.ba.indexOf('heya')>=0; }},
 {k:'b-toilet',    q:'トイレや洗面所の話？',              f:function(t){ return t.ba.indexOf('toilet')>=0; }},
 {k:'b-beranda',   q:'ベランダや庭の話？',                f:function(t){ return t.ba.indexOf('beranda')>=0; }},
 {k:'b-kyoushitsu',q:'教室の話？',                        f:function(t){ return t.ba.indexOf('kyoushitsu')>=0; }},
 {k:'b-rouka',     q:'ろうかや階段の話？',                f:function(t){ return t.ba.indexOf('rouka')>=0; }},
 {k:'b-taiikukan', q:'体育館や部活の話？',                f:function(t){ return t.ba.indexOf('taiikukan')>=0; }},
 {k:'b-tsuugaku',  q:'通学路や、道を歩いているときの話？',f:function(t){ return t.ba.indexOf('tsuugaku')>=0; }},
 {k:'b-hatake',    q:'畑・花だん・牛舎など、何かを育てている場所の話？', f:function(t){ return t.ba.indexOf('hatake')>=0; }},
 {k:'b-mise',      q:'お店や町、倉庫などの話？',          f:function(t){ return t.ba.indexOf('mise')>=0; }},
 /* 場面に出てくるもの */
 {k:'M', q:'水やお湯、雨、しめりけが出てくる話？',               f:function(t){ return gnTag(t,'M'); }},
 {k:'N', q:'火や、暑い・寒い・熱いが出てくる話？',               f:function(t){ return gnTag(t,'N'); }},
 {k:'A', q:'明るさや暗さ、あかり（電気）が出てくる話？',         f:function(t){ return gnTag(t,'A'); }},
 {k:'H', q:'だれかが来たり、近づいたり、通ったりする話？',       f:function(t){ return gnTag(t,'H'); }},
 {k:'K', q:'ストーブ・冷ぞう庫・エアコンなど、家の道具が出てくる？', f:function(t){ return gnTag(t,'K'); }},
 {k:'P', q:'植物や作物が出てくる話？',                           f:function(t){ return gnTag(t,'P'); }},
 {k:'F', q:'料理や食べ物（ペットのえさもふくむ）が出てくる？',   f:function(t){ return gnTag(t,'F'); }},
 {k:'D', q:'動物や生き物（ペット・魚もふくむ）が出てくる？',     f:function(t){ return gnTag(t,'D'); }},
 {k:'T', q:'こまっているのは、自分よりも 家ぞくや ほかの人？',   f:function(t){ return gnTag(t,'T'); }},
 {k:'Y', q:'夜や朝など、決まった時間帯に起きること？',           f:function(t){ return gnTag(t,'Y'); }},
 {k:'R', q:'自分がその場にいないとき（出かけている・はなれている）の話？', f:function(t){ return gnTag(t,'R'); }},
 {k:'S', q:'「だいじょうぶかな」と気になって、落ちつかなくなること？', f:function(t){ return gnTag(t,'S'); }},
 /* 困りごとの10の型。ことばを「型の名前」ではなく、そのときの気持ちにしてある */
 {k:'k-wasure',  q:'あとになって「しまった、〜し忘れた！」と気づくこと？',          f:function(t){ return t.kt==='wasure'; }},
 {k:'k-mienai',  q:'いまどうなっているか、行って見ないと分からないこと？',          f:function(t){ return t.kt==='mienai'; }},
 {k:'k-zutto',   q:'だれかが、ずっとそばで見ていないといけないこと？',              f:function(t){ return t.kt==='zutto'; }},
 {k:'k-choudo',  q:'やりすぎたり足りなかったり、「ちょうどよく」できないこと？',    f:function(t){ return t.kt==='choudo'; }},
 {k:'k-osoi',    q:'気づいたときには、もう手おくれになっていること？',              f:function(t){ return t.kt==='osoi'; }},
 {k:'k-todoka',  q:'手がふさがっていたり、届かなかったりして こまること？',          f:function(t){ return t.kt==='todoka'; }},
 {k:'k-barabara',q:'やる人や日によって、やり方や結果がちがってしまうこと？',        f:function(t){ return t.kt==='barabara'; }},
 {k:'k-abunai',  q:'けがをしそう・ぶつかりそうなど、あぶないこと？',                f:function(t){ return t.kt==='abunai'; }},
 {k:'k-kazoe',   q:'手で数えたり、書きうつしたりするのが めんどうなこと？',          f:function(t){ return t.kt==='kazoe'; }},
 {k:'k-tooku',   q:'はなれた場所のようすが分からなくて こまること？',                f:function(t){ return t.kt==='tooku'; }}
];
var GN_ANS = [['yes','はい'],['prob','たぶん そう'],['dk','わからない'],['pnot','たぶん ちがう'],['no','いいえ']];
/* [はいの側のカードに掛ける, いいえの側のカードに掛ける]。
   0 にしないのは、生徒の答えまちがい・札の付けかたのずれを1回で致命傷にしないため */
var GN_F = {yes:[1,.1], prob:[1,.4], dk:[1,1], pnot:[.4,1], no:[.1,1]};
var GN_MAXQ = 20;   /* これだけ聞いたら、当てにいく */
var GN_MAXG = 3;    /* 外していいのは3回まで */
var GN_SURE = .5;   /* 1位がこれだけの重みを持ったら当てにいく */
var GN_MINQ = 4;

function gnQ(k){ return GN_Q.filter(function(x){ return x.k===k; })[0] || null; }
function gnNew(){ return {h:[], cur:null}; }
function gnCount(h){
  var n={q:0,g:0};
  h.forEach(function(x){ if(x.q) n.q++; else if(x.g) n.g++; });
  return n;
}
/* 答えの履歴から、カードごとの重みを毎回はじめから計算しなおす（「ひとつもどる」を簡単にするため） */
function gnWeights(h){
  var w={};
  TANE.forEach(function(t){ w[t.id]=1; });
  h.forEach(function(x){
    if(x.g){ w[x.g]=0; return; }
    var Q=gnQ(x.q), f=GN_F[x.a];
    if(!Q || !f) return;
    TANE.forEach(function(t){ w[t.id] *= Q.f(t) ? f[0] : f[1]; });
  });
  return w;
}
function gnRank(w){
  return TANE.map(function(t){ return t.id; })
    .filter(function(id){ return w[id]>0; })
    .sort(function(a,b){ return w[b]-w[a]; });
}
/* 次の一手。rnd は検査で決まった並びにするために差しかえられるようにしてある */
function gnNext(h, rnd){
  rnd = rnd || Math.random;
  var w=gnWeights(h), rank=gnRank(w), n=gnCount(h);
  if(!rank.length || n.g>=GN_MAXG) return {lose:1};
  var tot=rank.reduce(function(s,id){ return s+w[id]; },0);
  var share=w[rank[0]]/tot;
  if(n.q>=GN_MAXQ) return {g:rank[0]};
  if(n.q>=GN_MINQ && share>=GN_SURE) return {g:rank[0]};
  /* まだ聞いていない質問のうち、のこりのカードをいちばん半分に近く分けるもの */
  var asked={}; h.forEach(function(x){ if(x.q) asked[x.q]=1; });
  var sc=[];
  GN_Q.forEach(function(Q){
    if(asked[Q.k]) return;
    var y=0;
    rank.forEach(function(id){ if(Q.f(taneOf(id))) y+=w[id]; });
    var p=y/tot;
    if(p<.03 || p>.97) return;
    sc.push({k:Q.k, s:Math.min(p,1-p)});
  });
  if(!sc.length) return {g:rank[0]};
  sc.sort(function(a,b){ return b.s-a.s; });
  /* いちばん良いものだけだと毎回同じ順で聞くので、ほぼ同じくらい良いものから選ぶ */
  var top=sc.filter(function(x){ return x.s>=sc[0].s*.85; });
  return {q:top[Math.floor(rnd()*top.length)].k};
}
/* 外れたときに「型だけ」渡す。答えから、いちばん重みの集まった型 */
function gnKata(h){
  var w=gnWeights(h), c={};
  TANE.forEach(function(t){ c[t.kt]=(c[t.kt]||0)+w[t.id]; });
  h.forEach(function(x){
    if(x.q && x.q.indexOf('k-')===0 && (x.a==='yes'||x.a==='prob')){ var k=x.q.slice(2); c[k]=(c[k]||0)+1e6; }
  });
  var best=Object.keys(c).sort(function(a,b){ return c[b]-c[a]; })[0];
  return best ? kataOf(best) : null;
}

function gnHtml(){
  var g=m0.gn, c=g.cur, n=gnCount(g.h);
  var h='<div class="gn-stage">'
    + '<div class="gn-fig"><img src="'+GENIE_IMG+'" alt="マイクロビットを持った発明ジーニー"></div>'
    + '<div class="gn-talk"><div class="gn-bubble" aria-live="polite">';
  var foot=true;
  if(!c){
    h+='<p class="gn-k">マイクロビットの発明ジーニー</p>'
     + '<p class="gn-say">わしは、こまりごとを当てるジーニーじゃ。</p>'
     + '<p class="gn-p">家や学校で「ちょっといやだな」「めんどうだな」と思うことを、<b>1つ 頭に思いうかべる</b>のじゃ。'
     + 'はっきり決まっていなくてもよい。答えているうちに、近いものが見えてくる。</p></div>'
     + '<div class="gn-ans"><button type="button" class="gn-a gn-go" id="gn-start">思いうかべた！ はじめる</button></div>';
    foot=false;
  }else if(c.q){
    var Q=gnQ(c.q);
    var w=gnWeights(g.h), rank=gnRank(w), tot=rank.reduce(function(s,id){ return s+w[id]; },0);
    var hira=rank.length ? Math.round(100*Math.min(1,(w[rank[0]]/tot)/GN_SURE)) : 0;
    h+='<p class="gn-k">しつもん '+(n.q+1)+'</p>'
     + '<p class="gn-say">'+esc(Q?Q.q:'')+'</p></div>'
     + '<div class="gn-ans" role="group" aria-label="答え">'
     + GN_ANS.map(function(a){ return '<button type="button" class="gn-a gn-'+a[0]+'" data-a="'+a[0]+'">'+esc(a[1])+'</button>'; }).join('')
     + '</div>'
     + '<div class="gn-meter" aria-hidden="true"><span>ひらめき</span><i><b style="width:'+hira+'%"></b></i></div>';
  }else if(c.g){
    var t=taneOf(c.g);
    h+='<p class="gn-k">ひらめいたぞ！'+(n.g?'（'+(n.g+1)+'回め）':'')+'</p>'
     + '<p class="gn-p">おぬしが こまっているのは……</p>'
     + '<p class="gn-card">'+esc(t?t.t:'')+'</p>'
     + '<p class="gn-p">……では ないかな？</p></div>'
     + '<div class="gn-ans gn-ans2"><button type="button" class="gn-a gn-go" id="gn-hit">そう、それ！（近い！）</button>'
     + '<button type="button" class="gn-a" id="gn-miss">ちがう</button></div>';
  }else if(c.hit){
    var t2=taneOf(c.hit);
    h+='<p class="gn-k">やはりな！ '+n.q+'問で当てたぞ</p>'
     + '<p class="gn-card">'+esc(t2?t2.t:'')+'</p>'
     + '<p class="gn-p">ただし、これは<b>よくある困りごとの形</b>じゃ。ここからは おぬしの言葉で、'
     + '<b>だれが・いつ・どこで</b> こまっているのかを書きかえるのじゃ。</p></div>'
     + '<div class="gn-ans"><button type="button" class="gn-a gn-go m-take" data-take="'+esc(c.hit)+'">この困りごとで、もんだいの文をつくる</button></div>';
  }else{
    var K=gnKata(g.h), wl=gnWeights(g.h), near=gnRank(wl).slice(0,3);
    h+='<p class="gn-k">まいった！</p>'
     + '<p class="gn-say">わしの知らない困りごとじゃな。</p>'
     + '<p class="gn-p">それこそ、<b>おぬしだけの課題</b>じゃ。下の欄に、自分の言葉で書いてみよ。</p>'
     + (K ? '<p class="gn-p">わしの見立てでは<b>「'+esc(K.nm)+'」</b>の型じゃな。'+esc(K.q)+'。</p>' : '')
     + '</div><div class="gn-ans">'
     + (K ? '<button type="button" class="gn-a gn-go" id="gn-kt" data-k="'+K.k+'">型だけもらって、自分で書く</button>' : '')
     + '</div>';
    if(near.length){
      h+='<p class="gn-p gn-near-h">もしかして、このどれかに近い？</p><div class="gn-near">'
       + near.map(function(id){ var t3=taneOf(id); return '<div class="gn-nc"><span>'+esc(t3.t)+'</span>'
       + '<button type="button" class="m-take" data-take="'+id+'">これにする</button></div>'; }).join('')
       + '</div>';
    }
  }
  if(foot){
    h+='<div class="gn-foot">'
     + '<button type="button" class="gn-link" id="gn-back"'+(g.h.length?'':' disabled')+'>ひとつもどる</button>'
     + '<button type="button" class="gn-link" id="gn-reset">はじめから</button></div>';
  }
  h+='</div></div>';
  return h;
}
function gnBind(w){
  var g=m0.gn;
  function step(){ g.cur=gnNext(g.h); m0Save(); m0RenderWork(); gnFocus(); }
  if($('gn-start')) $('gn-start').onclick=function(){ m0.gn=g=gnNew(); step(); };
  Array.prototype.forEach.call(w.querySelectorAll('.gn-a[data-a]'),function(b){
    b.onclick=function(){ if(!g.cur||!g.cur.q) return; g.h.push({q:g.cur.q, a:b.dataset.a}); step(); };
  });
  if($('gn-hit'))  $('gn-hit').onclick=function(){ g.cur={hit:g.cur.g}; m0Save(); m0RenderWork(); gnFocus(); };
  if($('gn-miss')) $('gn-miss').onclick=function(){ g.h.push({g:g.cur.g}); step(); };
  if($('gn-back')) $('gn-back').onclick=function(){
    var x=g.h.pop(); if(!x) return;
    g.cur = x.q ? {q:x.q} : {g:x.g};
    m0Save(); m0RenderWork(); gnFocus();
  };
  if($('gn-reset')) $('gn-reset').onclick=function(){ m0.gn=gnNew(); m0Save(); m0RenderWork(); };
  if($('gn-kt')) $('gn-kt').onclick=function(){
    m0.kt=$('gn-kt').dataset.k;
    m0Fill(); m0Save(); m0Gate();
    $('m-komari').focus();
    $('m-build').scrollIntoView({behavior:'smooth',block:'start'});
  };
}
/* 押すたびに描きなおすので、キーボードで答えている人のフォーカスを次の答えに戻す */
function gnFocus(){
  var b=document.querySelector('#m-work .gn-ans button');
  if(b){ try{ b.focus({preventScroll:true}); }catch(e){ b.focus(); } }
}
