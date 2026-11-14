const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{ const dir=process.argv[2]; const b=await chromium.launch(); const p=await b.newPage();
 for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.svg'))) {
  const s=fs.readFileSync(path.join(dir,f),'utf8'); const [w,h]=s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  const H = f.startsWith('logo-mark')||f==='app-icon.svg' ? 512 : f.startsWith('logo') ? 256 : 1024;
  const W = Math.round(w*H/h);
  await p.setViewportSize({width:W,height:H});
  await p.setContent(`<body style="margin:0"><img style="display:block;width:${W}px;height:${H}px" src="data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}">`);
  await p.screenshot({path:path.join(dir,f.replace('.svg','.png')),omitBackground:true});
 } await b.close(); })();
