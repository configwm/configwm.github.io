'use strict';

// One configuration enables every matching resource entry, including the header/footer.
const siteConfig=window.CONFIGWM_SITE||{};
document.querySelectorAll('[data-resource]').forEach(link=>{
  const destination=(siteConfig[link.dataset.resource]||'').trim();
  if(!destination)return;
  link.href=destination;
  link.removeAttribute('aria-disabled');
  if(/^https?:\/\//i.test(destination)){link.target='_blank';link.rel='noopener';}
});
const citation=(siteConfig.citation||'').trim();
document.getElementById('bibtex').textContent=citation;
document.getElementById('copy-citation').hidden=!citation;

const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
if('IntersectionObserver' in window&&!reducedMotion.matches){
  revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.dataset.reveal='shown';revealObserver.unobserve(entry.target);}
    });
  },{threshold:.03});
  document.querySelectorAll('.section h2,.section .paper-figure,.world-grid,#query-panel').forEach(element=>{
    // Do not hide initially visible content or the target of a deep link.
    const bounds=element.getBoundingClientRect();
    if(bounds.top<window.innerHeight&&bounds.bottom>0)return;
    element.dataset.reveal='pending';revealObserver.observe(element);
  });
}
reducedMotion.addEventListener('change',event=>{
  if(event.matches){
    revealObserver?.disconnect();
    document.querySelectorAll('[data-reveal]').forEach(element=>element.dataset.reveal='shown');
  }
});

// Original embedded JPEGs from the updated appendix figure, without resizing.
// These are recorded results, not generated images or live model inference.
const queryEnvironments = {
  tworoom:{name:'Two-Room', size:160, colors:['Brown','Yellow','Pink','Green','Cyan','Orange','Purple','Red','Blue']},
  pusht:{name:'Push-T', size:224, colors:['Brown','Yellow','Pink','Gray','Cyan','Orange','Purple','Red','Blue']},
  cube:{name:'OGBench-Cube', size:160, colors:['Silver','Yellow','Pink','Green','Cyan','Orange','Purple','Red','Blue']},
};
function queryAsset(environment,name){return `assets/perception-20261016/${environment}/${name}.jpg`;}
const swatches={Brown:'#946444',Yellow:'#dcc529',Pink:'#d155b0',Green:'#258657',Gray:'#666b72',Cyan:'#0999ab',Orange:'#d57a22',Purple:'#7853af',Red:'#bf4249',Blue:'#435c9c',Silver:'#77818d'};
const textColors={...swatches,Yellow:'#88711a',Pink:'#a83d83',Cyan:'#087386',Orange:'#a46819'};
let activeEnvironment='tworoom';
let activeQuery=3;
const environmentTabs=[...document.querySelectorAll('[data-query-environment]')];
const queryButtons=[...document.querySelectorAll('[data-query-index]')];
const queryFrames=[...document.querySelectorAll('.query-frame')];
const queryAssets=new Map();
let queryGeneration=0;

function loadQueryAsset(asset,priority='auto'){
  if(queryAssets.has(asset))return queryAssets.get(asset);
  const promise=new Promise((resolve,reject)=>{
    const image=new Image();
    image.decoding='async';
    image.fetchPriority=priority;
    const timeout=setTimeout(()=>finish(new Error('Image loading timed out')),20000);
    function finish(error){
      clearTimeout(timeout);
      image.onload=null;image.onerror=null;
      if(error)reject(error);else resolve(image);
    }
    image.onload=()=>image.decode().then(()=>finish(),finish);
    image.onerror=()=>finish(new Error('Image unavailable'));
    image.src=asset;
  });
  queryAssets.set(asset,promise);
  promise.catch(()=>{if(queryAssets.get(asset)===promise)queryAssets.delete(asset);});
  return promise;
}

function installQueryImage(id,image,label,size){
  image.id=id;
  image.className='query-image';
  image.alt=label;
  image.width=size;image.height=size;
  image.draggable=false;
  const previous=document.getElementById(id);
  if(previous!==image)previous.replaceWith(image);
}

async function renderQuery(){
  const generation=++queryGeneration;
  const key=activeEnvironment;
  const environment=queryEnvironments[key];
  const color=environment.colors[activeQuery];
  queryFrames.forEach(frame=>{frame.dataset.state='loading';frame.setAttribute('aria-busy','true');});
  document.getElementById('query-load-error').hidden=true;
  document.getElementById('query-name').textContent=`“${color}”`;
  document.getElementById('query-name').style.color=textColors[color];
  document.getElementById('query-status').textContent=`Loading ${environment.name}, ${color} query.`;
  queryButtons.forEach((button,index)=>{
    const name=environment.colors[index];
    button.querySelector('span').textContent=name;
    button.style.setProperty('--swatch',swatches[name]);
    button.setAttribute('aria-pressed',String(index===activeQuery));
  });
  try{
    const [input,output]=await Promise.all([
      loadQueryAsset(queryAsset(key,'input_noisy')),
      loadQueryAsset(queryAsset(key,`decoded_${color.toLowerCase()}`)),
    ]);
    if(generation!==queryGeneration)return;
    installQueryImage('query-input',input,`Fixed ${environment.name} input observation with all objects`,environment.size);
    installQueryImage('query-output',output,`Recorded ${environment.name} decoded state for the ${color} task query`,environment.size);
    queryFrames.forEach(frame=>{frame.dataset.state='ready';frame.setAttribute('aria-busy','false');});
    document.getElementById('query-status').textContent=`Recorded decoding results, not live inference. ${environment.name}, ${color} query.`;
  }catch(error){
    if(generation!==queryGeneration)return;
    queryFrames.forEach(frame=>{frame.dataset.state='error';frame.setAttribute('aria-busy','false');});
    document.getElementById('query-load-error').hidden=false;
    document.getElementById('query-status').textContent='Images could not load. Use Retry to load this selection again.';
  }
}

function warmQueryAssets(){
  // All 30 images total about 123 KB. Warm every environment, including Cube,
  // with four low-priority workers; switching tabs never waits to start a fetch.
  const keys=Object.keys(queryEnvironments);
  const assets=new Set();
  for(const key of keys){
    assets.add(queryAsset(key,'input_noisy'));
    assets.add(queryAsset(key,`decoded_${queryEnvironments[key].colors[3].toLowerCase()}`));
  }
  for(let index=0;index<9;index++)for(const key of keys){
    assets.add(queryAsset(key,`decoded_${queryEnvironments[key].colors[index].toLowerCase()}`));
  }
  const queue=[...assets];
  async function worker(){
    while(queue.length){
      const asset=queue.shift();
      // A failed speculative load must not change the visible selection.
      try{await loadQueryAsset(asset,'low');}catch{}
    }
  }
  return Promise.all(Array.from({length:4},worker));
}
function selectEnvironment(tab){
  activeEnvironment=tab.dataset.queryEnvironment;
  environmentTabs.forEach(item=>{const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;});
  document.getElementById('query-panel').setAttribute('aria-labelledby',tab.id);
  renderQuery();
}
function addTabKeyboard(tabs,select){
  tabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight')next=tabs[(index+1)%tabs.length];
    if(event.key==='ArrowLeft')next=tabs[(index-1+tabs.length)%tabs.length];
    if(event.key==='Home')next=tabs[0];
    if(event.key==='End')next=tabs[tabs.length-1];
    if(next){event.preventDefault();select(next);next.focus();}
  }));
}
environmentTabs.forEach(tab=>tab.addEventListener('click',()=>selectEnvironment(tab)));
addTabKeyboard(environmentTabs,selectEnvironment);
queryButtons.forEach(button=>button.addEventListener('click',()=>{activeQuery=Number(button.dataset.queryIndex);renderQuery();}));
document.getElementById('query-retry').addEventListener('click',renderQuery);
renderQuery();
warmQueryAssets();

const resultTabs=[...document.querySelectorAll('.result-tabs [role="tab"]')];
function selectResult(tab){
  resultTabs.forEach(item=>{const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!selected;});
}
resultTabs.forEach(tab=>tab.addEventListener('click',()=>selectResult(tab)));
addTabKeyboard(resultTabs,selectResult);

const dialog=document.getElementById('figure-dialog');
document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
  const image=document.getElementById('enlarged-figure');
  image.src=button.dataset.zoom;
  image.alt=button.querySelector('img').alt;
  document.getElementById('figure-dialog-title').textContent=button.dataset.title;
  dialog.showModal();
}));
document.getElementById('close-figure').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{
  const r=dialog.getBoundingClientRect();
  if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();
});
document.getElementById('copy-citation').addEventListener('click',async event=>{
  const code=document.getElementById('bibtex');
  try{await navigator.clipboard.writeText(code.textContent);event.target.textContent='Copied';document.getElementById('copy-status').textContent='Citation copied.';}
  catch{const range=document.createRange();range.selectNodeContents(code);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);event.target.textContent='Selected · Ctrl/Cmd+C';document.getElementById('copy-status').textContent='Citation selected. Press Control C or Command C to copy.';}
});
