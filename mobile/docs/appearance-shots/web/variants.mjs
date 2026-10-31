import { chromium } from 'playwright-core';
import fs from 'fs';
const url = fs.readFileSync('/tmp/weburl','utf8').trim();
const OUT='/workspace/dsbot-app/mobile/docs/appearance-shots/web/';
const base={theme:'deepseek',layout:'bubble',width:80,flatWidth:100,motion:'normal',thinking:false};
const V=[];
for (const th of ['deepseek','mono','paper','moonlight']) for (const sc of ['light','dark']) V.push([`w01-${th}-${sc}-chat`,{theme:th},sc]);
V.push(['w02-accent-rose-light-chat',{accent:'ROSE'},'light']);
V.push(['w03-accent-custom-8a2be2-light-chat',{accent:'#8a2be2'},'light']);
V.push(['w04-bubble-width50-chat',{width:50},'light']);
V.push(['w05-bubble-width100-chat',{width:100},'light']);
V.push(['w06-flat-width100-chat',{layout:'flat',flatWidth:100},'light']);
V.push(['w07-flat-width50-chat',{layout:'flat',flatWidth:50},'light']);
V.push(['w08-thinking-on-chat',{thinking:true},'light']);
for (const m of ['quiet','normal','lively']) V.push([`w09-motion-${m}-drawer`,{motion:m},'light','drawer']);
V.push(['w10-deepseek-dark-drawer',{},'dark','drawer']);
const only=process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args:['--no-sandbox'] });
const rose = (await import('/tmp/rb2/ds-bot/src/client/inks.js')).INKS.rose[0];
for (const [name,p,sc,view] of V) {
  if (only && !name.includes(only)) continue;
  const prefs={...base,...p}; if (prefs.accent==='ROSE') prefs.accent=rose;
  const ctx = await b.newContext({ viewport:{width:412,height:915}, deviceScaleFactor:2.625, isMobile:true, hasTouch:true, colorScheme: sc });
  await ctx.addInitScript(([v,sb])=>{localStorage.setItem('ds-bot:prefs',v);localStorage.setItem('ds-bot:sidebar',sb)}, [JSON.stringify(prefs), JSON.stringify({pref:view==='drawer'?'open':'hidden',shown:'open',width:300})]);
  const pg = await ctx.newPage(); await pg.goto(url); await pg.waitForTimeout(2000);
  const sp={...prefs}; if(!sp.accent) sp.accent=null;
  console.log(JSON.stringify(await pg.evaluate(async b=>{const r=await fetch('/api/bot',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:'set-prefs',payload:b})});return r.status+' '+(await r.text()).slice(0,200)}, sp)));
  await pg.reload(); await pg.waitForTimeout(5000);
  if (view!=='drawer') { for (let k=0;k<3;k++){ const w=await pg.evaluate(()=>{const e=document.querySelector('.bt-leftcol');return e?e.getBoundingClientRect().width:0}); if(w<20) break; await pg.mouse.click(44,25); await pg.waitForTimeout(1500);} } else { const g = await pg.locator('.bt-leftcol-grip').boundingBox(); await pg.mouse.move(g.x+4,g.y+300); await pg.mouse.down(); for (let x=g.x;x<330;x+=10) { await pg.mouse.move(x,g.y+300); await pg.waitForTimeout(30); } await pg.mouse.up(); await pg.waitForTimeout(800); }
  await pg.screenshot({ path: OUT+name+'.png' }); console.log(name); await ctx.close();
}
await b.close();
