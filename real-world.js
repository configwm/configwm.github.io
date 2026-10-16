(() => {
  'use strict';
  const tasks=[{"id": "dinosaur", "label": "Move Dinosaur", "prompt": "Use both hands to pick up a dinosaur on the right side and move it to the left side."}, {"id": "baskets", "label": "Sort Objects", "prompt": "Place multiple objects separately in different baskets."}, {"id": "button", "label": "Press Button", "prompt": "Press the red button with the right hand."}, {"id": "cap", "label": "Place Cap", "prompt": "Move the baseball cap to the top of the book."}, {"id": "kettle", "label": "Close Kettle", "prompt": "Push down on the lid of the kettle with the right hand to close it."}, {"id": "cocktail", "label": "Make Cocktail", "prompt": "Watch someone making a cocktail."}];
  const models=[{"id": "dinov2", "label": "DINOv2"}, {"id": "dinov3", "label": "DINOv3"}, {"id": "vjepa21", "label": "V-JEPA 2.1"}, {"id": "lingbot", "label": "LingBot-Vision"}];
  const taskButtons=[...document.querySelectorAll('[data-realworld-task]')];
  const modelButtons=[...document.querySelectorAll('[data-realworld-model]')];
  const panel=document.getElementById('realworld-panel');
  const errorBox=document.getElementById('realworld-error');
  const status=document.getElementById('realworld-status');
  const cache=new Map();
  let taskId=tasks[0].id,modelId=models[0].id,generation=0,started=false;
  const asset=(task,column)=>`assets/real-world-20261019/${task}/${column}.webp${task==='cap'&&column==='clean'?'?v=20261019-corrected':''}`;
  function load(url,priority='auto'){
    if(cache.has(url))return cache.get(url);
    const promise=new Promise((resolve,reject)=>{
      const image=new Image();image.decoding='async';image.fetchPriority=priority;
      const timeout=setTimeout(()=>finish(new Error('Image loading timed out')),20000);
      function finish(error){clearTimeout(timeout);image.onload=null;image.onerror=null;error?reject(error):resolve(image);}
      image.onload=()=>image.decode().then(()=>finish(),finish);
      image.onerror=()=>finish(new Error('Image unavailable'));
      image.src=url;
    });
    cache.set(url,promise);
    promise.catch(()=>{if(cache.get(url)===promise)cache.delete(url);});
    return promise;
  }
  function selections(task,model){return [['noisy','noisy'],['baseline',model],['ours',`ours-${model}`],['clean','clean']].map(([id,column])=>({id,url:asset(task,column)}));}
  async function render(){
    started=true;
    const current=++generation;
    const task=tasks.find(item=>item.id===taskId),model=models.find(item=>item.id===modelId);
    panel.dataset.state='loading';panel.setAttribute('aria-busy','true');errorBox.hidden=true;
    taskButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.realworldTask===task.id)));
    modelButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.realworldModel===model.id)));
    document.getElementById('realworld-task-prompt').textContent=task.prompt;
    document.getElementById('realworld-baseline-label').textContent=model.label;
    document.getElementById('realworld-ours-label').textContent=`Ours (${model.label})`;
    status.textContent=`Loading ${task.label}, ${model.label}.`;
    const selected=selections(task.id,model.id);
    try{
      const images=await Promise.all(selected.map(item=>load(item.url)));
      if(current!==generation)return;
      images.forEach((image,index)=>{
        const kind=selected[index].id,id=`realworld-${kind}`;
        const labels={noisy:'Noisy observation',baseline:`${model.label} representation`,ours:`ConfigWM with ${model.label} representation`,clean:'Clean observation'};
        image.id=id;image.className='realworld-image';image.width=1024;image.height=1024;image.draggable=false;
        image.alt=`${labels[kind]}. ${task.prompt}`;
        const previous=document.getElementById(id);if(previous!==image)previous.replaceWith(image);
      });
      panel.dataset.state='ready';panel.setAttribute('aria-busy','false');
      status.textContent=`${task.label}. Comparing ${model.label} and ConfigWM. Recorded representation visualizations.`;
    }catch{
      if(current!==generation)return;
      panel.dataset.state='error';panel.setAttribute('aria-busy','false');errorBox.hidden=false;
      status.textContent='Images could not load. Use Retry to load this selection again.';
    }
  }
  function warm(task,model){
    if(!started||navigator.connection?.saveData)return;
    // Warm only the selection the visitor points to, never the entire 60-image collection.
    for(const item of selections(task,model))load(item.url,'low').catch(()=>{});
  }
  function chooseTask(button){taskId=button.dataset.realworldTask;render();}
  function chooseModel(button){modelId=button.dataset.realworldModel;render();}
  function keyboard(buttons,choose){
    buttons.forEach((button,index)=>button.addEventListener('keydown',event=>{
      const next=event.key==='ArrowRight'?buttons[(index+1)%buttons.length]:event.key==='ArrowLeft'?buttons[(index-1+buttons.length)%buttons.length]:event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):null;
      if(next){event.preventDefault();choose(next);next.focus();}
    }));
  }
  taskButtons.forEach(button=>{button.addEventListener('click',()=>chooseTask(button));button.addEventListener('pointerenter',()=>warm(button.dataset.realworldTask,modelId));button.addEventListener('focus',()=>warm(button.dataset.realworldTask,modelId));});
  modelButtons.forEach(button=>{button.addEventListener('click',()=>chooseModel(button));button.addEventListener('pointerenter',()=>warm(taskId,button.dataset.realworldModel));button.addEventListener('focus',()=>warm(taskId,button.dataset.realworldModel));});
  keyboard(taskButtons,chooseTask);keyboard(modelButtons,chooseModel);
  document.getElementById('realworld-retry').addEventListener('click',render);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();if(!started)render();}},{rootMargin:'400px'});
    observer.observe(document.querySelector('.realworld-demo'));
  }else render();
})();
