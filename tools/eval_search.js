/* ①の検索を、生徒が打ちそうな言葉でまとめて評価する。
     node tools/eval_search.js
   結果は「列（計測／制御）の中での順位」で見る。
   search_cases.js は調整に使った問題集、search_cases_holdout.js は
   語彙を足す前に作って、最後に一度だけ使った問題集（こちらが実力に近い）。 */
const fs=require("fs");const {JSDOM}=require("jsdom");
const H=fs.readFileSync(require("path").join(__dirname,"..","index.html"),"utf8");
const dom=new JSDOM(H,{url:"http://localhost/",runScripts:"dangerously",pretendToBeVisual:true,beforeParse(w){w.HTMLElement.prototype.scrollIntoView=function(){};}});
const w=dom.window,d=w.document;
function search(q){
  d.getElementById("q").value=q;d.getElementById("q").dispatchEvent(new w.Event("input"));
  const cols=[];let cur=null;
  d.querySelectorAll("#list > *").forEach(el=>{
    if(el.classList.contains("ghead")){cur=[];cols.push(cur);}
    else if(cur) [...el.querySelectorAll(".card h3")].forEach(e=>cur.push(e.textContent));
  });
  return cols;
}
const SETS={"調整用":require("./search_cases.js"),"別問題集":require("./search_cases_holdout.js")};
for(const [nm,CASES] of Object.entries(SETS)){
  let t1=0,t3=0,n=0,len=0,none=0;const bad=[];
  CASES.forEach(([q,want])=>{
    const cols=search(q); const flat=[].concat(...cols);
    len+=flat.length; if(!flat.length)none++;
    if(!want)return; n++;
    const ws=Array.isArray(want)?want:[want];
    let best=99;
    cols.forEach(c=>{const i=c.findIndex(x=>ws.some(y=>x.indexOf(y)>=0)); if(i>=0)best=Math.min(best,i);});
    if(best===0)t1++; if(best<3)t3++;
    if(best!==0) bad.push([q,ws.join("/"),cols.map(c=>c.slice(0,3).join(" / ")).join("  ||  ")]);
  });
  console.log("【"+nm+"】列の1位 "+t1+"/"+n+" ("+Math.round(t1/n*100)+"%)  列の3位内 "+Math.round(t3/n*100)+"%  平均"+(len/CASES.length).toFixed(1)+"件  0件"+none);
  bad.forEach(([q,wt,r])=>console.log("   "+q.padEnd(16)+" 期待:"+wt.padEnd(20)+" "+r));
}
