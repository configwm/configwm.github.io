import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app-v3.js'),'utf8');
const refs=new Set(['index.html','styles-v3.css','app-v3.js','noisy-worlds.js','site-config.js','.nojekyll']);
for(const match of html.matchAll(/(?:src|href|poster|data-zoom)=["']([^"']+)["']/g)){
  const value=match[1];
  if(value.startsWith('#')||/^[a-z][a-z0-9+.-]*:/i.test(value))continue;
  refs.add(decodeURIComponent(value.split(/[?#]/)[0]));
}
for(const match of js.matchAll(/['"](assets\/[^'"\n]+)['"]/g))refs.add(match[1]);
for(const environment of ['tworoom','pusht','cube'])for(let level=0;level<=8;level++)refs.add(`assets/originals/noise-${environment}-${level}.png`);
for(const environment of ['tworoom','pusht','cube'])for(let level=0;level<=8;level++)refs.add(`assets/noisy-worlds/${environment}-${level}.mp4`);
const perceptionManifest='assets/perception-20261016/manifest.json';
refs.add(perceptionManifest);
const perception=JSON.parse(fs.readFileSync(path.join(root,perceptionManifest),'utf8'));
if(perception.images.length!==30)throw new Error('Expected 30 perception images.');
for(const image of perception.images)refs.add(image.asset);
const realworldManifest='assets/real-world-20261019/manifest.json';
refs.add(realworldManifest);
const realworld=JSON.parse(fs.readFileSync(path.join(root,realworldManifest),'utf8'));
if(realworld.images.length!==60||realworld.tasks.length!==6)throw new Error('Expected six real-world tasks and 60 source images.');
for(const image of realworld.images)refs.add(image.asset);
for(const ref of refs){
  const file=path.resolve(root,ref);
  if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw new Error(`Missing or invalid reference: ${ref}`);
}
const worlds=html.match(/<section[^>]+id="worlds"[\s\S]*?<\/section>/)?.[0];
if(!worlds||/<img\b|\bposter=/i.test(worlds)||(worlds.match(/<video\b/g)||[]).length!==3)throw new Error('Noisy Worlds must contain exactly three videos and no static images.');
const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1]));
for(const match of html.matchAll(/href=["']#([^"']+)["']/g))if(!ids.has(match[1]))throw new Error(`Missing anchor: ${match[1]}`);
for(const file of ['app-v3.js','noisy-worlds.js','site-config.js','real-world.js','preview.mjs']){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||`Syntax check failed: ${file}`);
}
console.log(`OK: ${refs.size} referenced files, page anchors, and JavaScript syntax.`);
