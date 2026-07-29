const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const html=fs.readFileSync((process.argv[2] || __dirname + '/../index.html'),'utf8');
const MCLOVIN=`====================LEAP DATABASE ENTRY====================
    NAME:          MCLOVIN, BOBBY
    DOB:           1987-1-20
    SEX:           M
    HOME ADDR:     LITTLE SEOUL, LOS SANTOS
    PHONE NO:      1717
====================     FLAGS     ====================
    WANTED:        YES              [ACTIVE CRIMINAL WARRANT]
    BAIL:          NO
    GANG AFF:      NO      VIOLENCE POLICE:    NO
    POS WEAP:      NO      VIOLENCE:           NO
`;
const CLEAN=MCLOVIN.replace('WANTED:        YES              [ACTIVE CRIMINAL WARRANT]','WANTED:        NO');
(async()=>{
  const errors=[];const vc=new VirtualConsole().on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x/',virtualConsole:vc});
  const {window}=dom,d=window.document;await sleep(500);
  const set=(id,v)=>{const e=d.getElementById(id);if(!e)return;e.value=v;
    e.dispatchEvent(new window.Event('input',{bubbles:true}));e.dispatchEvent(new window.Event('change',{bubbles:true}));};
  const banner=()=>d.getElementById('leapFlags');
  const chips=()=>[...banner().querySelectorAll('.lf-chip')].map(c=>c.textContent);
  let fail=0;const ck=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);if(!ok)fail++;
    console.log(`  ${ok?'ok  ':'FAIL'}  ${l.padEnd(38)} ${JSON.stringify(g)}${ok?'':' want '+JSON.stringify(w)}`);};
  console.log('── wanted person (Bobby McLovin)');
  set('swPaste',MCLOVIN);await sleep(250);
  ck('banner visible',/\bshow\b/.test(banner().className),true);
  ck('chips shown',chips(),['WANTED']);
  console.log('── same person, WANTED: NO');
  set('swPaste','');await sleep(100);set('swPaste',CLEAN);await sleep(250);
  ck('banner hidden',/\bshow\b/.test(banner().className),false);
  ck('no chips',chips(),[]);
  console.log('\npage errors: '+(errors.length?errors.join(' | '):'none'));
  console.log(fail?`FAIL ${fail}`:'PASS');
  window.close();process.exit(fail?1:0);
})();
