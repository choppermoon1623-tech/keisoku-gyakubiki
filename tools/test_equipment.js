// Integration tests with two UI instances and a fake Firestore backend.
// This does not verify the deployed Firebase rules or actual network delivery.
const fs=require('fs'),path=require('path'),assert=require('assert');
const code=fs.readFileSync(path.join(__dirname,'test_cloud.js'),'utf8').split('(async function main(){')[0];
const harness=new Function('require','__dirname',code+'\nreturn {makeBackend,makeFbq,makeWindow,typeIn,settle,errs};')(require,__dirname);
const {makeBackend,makeWindow,typeIn,settle,errs}=harness;
let passed=0;
function check(name,condition){assert.ok(condition,name);passed++;}
function attach(be,w){
  const listeners=[];
  w.fbq.watchRoom=(id,cb,err)=>{
    const l={id,cb,err};listeners.push(l);cb(be.getRoom(id),{fromCache:false});
    return ()=>{const i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1);};
  };
  w.fbq.updateEquipment=(id,equipment)=>{
    try {be.saveRoom(id,{equipment},w.fbq.uid());return Promise.resolve();}
    catch(e){return Promise.reject(e);}
  };
  const previous=be.fire;
  be.fire=()=>{previous();listeners.slice().forEach(l=>l.cb(be.getRoom(l.id),{fromCache:false}));};
  return listeners;
}
(async()=>{
  const be=makeBackend();
  const save=be.saveRoom;
  be.saveRoom=(...args)=>{save(...args);be.fire();};
  const T=makeWindow(be),S=makeWindow(be,'pupil1');
  const t=T.window,s=S.window,td=t.document,sd=s.document;
  attach(be,t);const watchers=attach(be,s);
  const $t=id=>td.getElementById(id),$s=id=>sd.getElementById(id);
  $t('k-login').click();await settle();
  typeIn(t,'k-newtitle','2年A組');$t('k-newroom').click();await settle();
  const A=[...be.rooms.keys()][0];
  check('teacher equipment editor appears',!$t('eq-teacher').hidden);
  check('all 51 devices can be configured',$t('eq-device-list').querySelectorAll('select').length===51);
  check('all devices start unknown',Array.from($t('eq-device-list').querySelectorAll('select')).every(e=>e.value==='unknown'));
  check('students cannot see teacher editor',$s('eq-teacher').hidden);
  typeIn(s,'eq-code',A);await settle();
  check('one code is shared with consultation',$s('g-code').value===A);
  check('student sees room name',$s('eq-summary').textContent.includes('2年A組'));
  check('unconfigured remains unknown',$s('eq-summary').textContent.includes('未確認 51'));
  const light=t.DEV.find(v=>v.n==='光センサ');
  const pir=t.DEV.find(v=>v.n==='人感センサ');
  const soil=t.DEV.find(v=>v.n==='土壌水分センサ');
  function choose(id,status){const el=$t('eq-'+id);el.value=status;el.dispatchEvent(new t.Event('change'));}
  choose(light.id,'yes');choose(pir.id,'ask');choose(soil.id,'no');
  check('draft is not shared',s.eqStatus(light)==='unknown');
  $t('eq-save').click();await settle();
  check('available is shared live',s.eqStatus(light)==='yes');
  check('ask is shared live',s.eqStatus(pir)==='ask');
  check('no is shared live',s.eqStatus(soil)==='no');
  check('save does not overwrite room title',be.getRoom(A).title==='2年A組');
  check('updated time displayed',$s('eq-summary').textContent.includes('最終更新'));
  check('unavailable hidden by default',!$s('list').querySelector('[data-id="'+soil.id+'"]'));
  $s('eq-showall').click();
  check('catalog option reveals unavailable',!!$s('list').querySelector('[data-id="'+soil.id+'"]'));
  s.pick(soil.id);
  check('unavailable design stays in memo',s.memo.s===soil.n && $s('eq-memo').textContent.includes('使えない'));
  choose(soil.id,'yes');$t('eq-save').click();await settle();
  check('memo status refreshes without clearing',s.memo.s===soil.n && $s('eq-memo').textContent.includes('使える'));
  choose(soil.id,'no');$t('eq-save').click();await settle();
  typeIn(s,'g-theme','土が乾いたら水やり');typeIn(s,'g-mine','土壌水分センサを使いたい');
  check('hints exclude unavailable',!s.gRank('s',3).some(v=>v.id===soil.id));
  const prompt=s.buildPrompt({theme:'植物を育てる',sens:soil.n},'teach');
  check('AI receives room status',prompt.includes('この受付の装置の状態') && prompt.includes(soil.n+'：使えない'));
  check('AI told not to propose unavailable',prompt.includes('「使えない」は提案しない'));
  check('appending current state replaces old block',s.eqAppendPrompt(prompt).split('【この受付の装置の状態】').length===2);
  choose(light.id,'ask');
  be.saveRoom(A,{open:false},t.fbq.uid());await settle();
  check('remote room update does not destroy unsaved teacher edit',$t('eq-'+light.id).value==='ask');
  check('closed consultation retains equipment data',s.eqStatus(light)==='yes');
  const denied=t.fbq.updateEquipment;
  t.fbq.updateEquipment=()=>Promise.reject(new Error('permission-denied'));
  $t('eq-save').click();await settle();
  check('failed save is visible',$t('eq-save-msg').textContent.includes('保存できません'));
  check('failed save preserves draft',$t('eq-'+light.id).value==='ask');
  check('failed save never changes student',s.eqStatus(light)==='yes');
  t.fbq.updateEquipment=denied;
  $t('eq-discard').click();
  check('discard restores saved setting',$t('eq-'+light.id).value==='yes');
  $t('eq-mark-rest').click();
  check('bulk operation preserves configured devices',$t('eq-'+light.id).value==='yes' && $t('eq-'+pir.id).value==='ask');
  check('bulk operation leaves no unknown selects',Array.from($t('eq-device-list').querySelectorAll('select')).every(e=>e.value!=='unknown'));
  $t('eq-discard').click();
  const B='ZZZZZZ';
  be.saveRoom(B,{ownerUid:t.fbq.uid(),title:'2年B組',open:true,equipment:{states:{[light.id]:'no'},updatedAt:Date.now()}},t.fbq.uid());
  const stale=watchers[0].cb;
  typeIn(s,'eq-code',B);await settle();
  check('room switch loads new settings',s.eqStatus(light)==='no' && s.eqStatus(pir)==='unknown');
  stale(be.getRoom(A),{fromCache:false});
  check('old callback cannot overwrite new class',s.croom.id===B && s.eqStatus(light)==='no');
  watchers[0].cb(be.getRoom(B),{fromCache:true});
  check('cached snapshot is labelled',$s('eq-summary').textContent.includes('最新の状態を確認できません'));
  watchers[0].err(new Error('permission-denied'));
  check('listener error is not displayed as live',$s('eq-summary').textContent.includes('最新の状態を確認できません'));
  $s('eq-disconnect').click();
  check('disconnect removes class status',s.eqStatus(light)==='unknown');
  check('disconnect removes listener',watchers.length===0);
  check('disconnect preserves design',s.memo.s===soil.n);
  check('invalid status is unknown',t.eqStates({equipment:{states:{[light.id]:'invalid','bad-id':'yes'}}})[light.id]===undefined);
  // Another teacher cannot modify this room in the fake owner-based backend.
  const X=makeWindow(be);attach(be,X.window);X.window.fbq.__set('teacher2',false);await settle();
  await assert.rejects(()=>X.window.fbq.updateEquipment(A,{states:{}}));passed++;
  check('no runtime errors',errs.length===0);
  [T,S,X].forEach(x=>x.window.close());
  console.log('Equipment: '+passed+' passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
