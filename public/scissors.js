'use strict';
const G = CutGeometry;
let activePointer = null, strokeBefore = [];
state.lesson = null;
state.pending = [];
state.history = [];
state.remaining = [];
state.holes = [];
state.tool = 'scissors';
state.stampKind = 'circle';
state.stampSize = 24;

function initialPaper(){
  const {a0,a1}=params();
  if(state.shape==='circle')return [{x:C,y:C},...Array.from({length:97},(_,i)=>ptAt(a0+(a1-a0)*i/96,R))];
  return clipHalf(clipHalf([{x:C-H,y:C-H},{x:C+H,y:C-H},{x:C+H,y:C+H},{x:C-H,y:C+H}],a0,1),a1,-1)
    .filter((p,i,all)=>G.distance(p,all[(i+1)%all.length])>.001);
}
function resetScissors(){
  activePointer=null;state.pending=[];state.history=[];state.remaining=initialPaper();state.holes=[];
}
function pushHistory(){
  state.history.push({remaining:state.remaining,holes:state.holes.slice(),cuts:state.cuts.slice()});
}
function restoreHistory(){
  const snap=state.history.pop();
  if(!snap)return;
  state.remaining=snap.remaining;
  state.holes=snap.holes;
  state.cuts=snap.cuts;
}
function syncToolBar(){
  const bar=$('#tool-mode-bar'),shapes=$('#stamp-shapes');
  const free=!state.lesson;
  if(bar)bar.hidden=!free||state.mode!=='cut';
  if(!free)state.tool='scissors';
  if(shapes)shapes.hidden=!(free&&state.tool==='stamp'&&state.mode==='cut');
  document.querySelectorAll('#tool-mode-bar [data-tool]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.tool===state.tool);
  });
  document.querySelectorAll('#stamp-shapes [data-stamp]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.stamp===state.stampKind);
  });
}
function currentLesson(){return LESSONS[state.lesson?.id ?? 0];}
function currentStep(){return currentLesson().steps[Math.min(state.cuts.length,currentLesson().steps.length-1)];}
function guidePoints(){return currentStep().guide();}
function targetFlower(){return lessonTarget(state.lesson?.id ?? 0);}
function lessonPanel(){
  const panel=$('#lesson-panel'),lesson=state.lesson;
  panel.hidden=!lesson;panel.classList.remove('needs-answer');if(!lesson)return;
  const needsAnswer=lesson.phase==='predict'&&lesson.guess===undefined;
  if(needsAnswer)panel.classList.add('needs-answer');
  const needsStart=lesson.phase==='intro'||lesson.phase==='between';
  const course=currentLesson();
  let heading='',body='',actions='';
  const button=(action,label,primary=false)=>`<button data-action="${action}" class="${primary?'primary':''}">${label}</button>`;
  if(lesson.phase==='intro'){
    heading=`第 ${lesson.id+1} 課：${course.title}`;body=course.intro;
    actions=button('begin','開始跟線剪',true);
  }else if(lesson.phase==='cut'||lesson.phase==='between'){
    const step=currentStep();
    heading=`第 ${state.cuts.length+1} 步：${step.name}`;
    body=step.text;
    if(lesson.phase==='between'){
      body='剪好了！看看右上角的小圖。<br>按「下一步」，再跟白色線剪。';
      actions=button('next-cut','下一步',true);
    }
  }else if(lesson.phase==='predict'){
    heading='最後一步：揀答案，再睇作品';body=course.question;
    actions=course.choices.map((text,i)=>button('guess-'+i,text)).join('');
    if(lesson.guess!==undefined){
      body+=`<p class="prediction">${lesson.guess===course.answer?'答啱了！':'一齊睇返剪法：'} ${course.explain}</p>`;
      actions+=button('reveal','展開睇作品',true);
    }
  }else{
    heading=course.title+'完成';body=course.finish;
    actions=button('retry','再跟線練一次')+button('explore','去掉引導線，自己試')+button('courses','揀下一課',true);
  }
  panel.innerHTML=`<div class="lesson-row">${lesson.phase==='predict'?'':targetFlower()}<div><div class="eyebrow">跟住學 · ${course.title}</div><div class="step-progress">已完成 ${state.cuts.length} / ${course.steps.length} 步</div><h3>${heading}</h3>${needsStart?`<div class="answer-box start-box"><div class="answer-prompt" role="status"><span class="answer-hand" aria-hidden="true">👇</span><div><strong>${lesson.phase==='intro'?'按下面按鈕，開始剪紙':'按「下一步」，繼續剪紙'}</strong><span>按完就會出現白色引導線。</span></div></div>`:''}${needsAnswer?'<div class="answer-box"><div class="answer-prompt" role="status"><span class="answer-hand" aria-hidden="true">👇</span><div><strong>請按下面其中一個答案</strong><span>先揀答案，先可以展開作品。</span></div><b class="answer-alert" aria-hidden="true">!</b></div>':''}<div>${body}</div><div class="lesson-actions">${actions}</div>${needsAnswer||needsStart?'</div>':''}<div class="culture-note"><strong>文化小知識</strong><p>${course.culture}</p><a href="${course.source}" target="_blank" rel="noopener">來源：${course.sourceName}</a></div></div></div>`;
}
function guideMarkup(){
  if(state.lesson?.phase!=='cut')return '';
  const guide=guidePoints(),start=guide[0],end=guide[guide.length-1];
  // Text stays upright despite the folded paper's display rotation.
  const text=(p,word,dx)=>`<g transform="translate(${p.x} ${p.y}) rotate(${params().w/2})"><text x="${dx}" y="-13" text-anchor="${dx<0?'end':'start'}" font-size="17" fill="var(--ink)" stroke="var(--ground)" stroke-width="5" paint-order="stroke">${word}</text></g>`;
  return `<g pointer-events="none"><path d="${polylineD(guide)}" fill="none" stroke="#F5E8CB" stroke-width="4" stroke-dasharray="9 8"/>
    <circle cx="${start.x}" cy="${start.y}" r="9" fill="var(--gold)" stroke="var(--ground)" stroke-width="2"/>
    <circle cx="${end.x}" cy="${end.y}" r="8" fill="none" stroke="var(--ground)" stroke-width="3"/>
    ${text(start,'起剪',-15)}${text(end,'剪出',15)}</g>`;
}
function bladeMarkup(){
  if(!state.pending.length)return '';
  const p=state.pending[state.pending.length-1];
  return `<g pointer-events="none"><path d="${polylineD(state.pending)}" fill="none" stroke="var(--ground)" stroke-width="3" stroke-linecap="round"/>
    <g transform="translate(${p.x} ${p.y}) rotate(${params().w/2})"><circle r="11" fill="var(--surface)" stroke="var(--gold)" stroke-width="2"/><text x="0" y="7" text-anchor="middle" font-size="23" fill="var(--ink)">✂</text></g></g>`;
}
function drawBlade(){
  $('#thumbsvg').innerHTML=orientationThumbMarkup();
  const layer=$('#scissor-overlay');if(layer)layer.innerHTML=bladeMarkup();
  $('#btn-undo').disabled=!(state.pending.length||state.cuts.length||state.holes.length);
}
const baseRender=render;
render=function(){
  baseRender();
  lessonPanel();
  syncToolBar();
  if(state.mode==='cut'){
    const group=document.createElementNS('http://www.w3.org/2000/svg','g');
    group.setAttribute('transform',`rotate(${-params().w/2} ${C} ${C})`);
    group.setAttribute('pointer-events','none');
    group.innerHTML=guideMarkup()+'<g id="scissor-overlay"></g>';
    svg.appendChild(group);drawBlade();
    if(state.pending.length)$('#hint').textContent='仲未剪斷。由剪刀尖接住剪，接通紙邊先會甩。';
    else if(!state.lesson&&state.tool==='stamp')$('#hint').textContent='喺紙入面撳一下，印出圓形或正方形窿（唔可以貼邊）。';
  }
  $('#btn-mode').disabled=!!(state.lesson&&['intro','cut','between'].includes(state.lesson.phase));
  if(state.lesson?.phase==='predict'){$('#btn-mode').disabled=false;$('#btn-mode').textContent=state.lesson.guess===undefined?'先揀上面嘅答案 ↑':'展開作品';$('#hint').textContent='仲有一步：按上面其中一個答案，就可以展開作品。';}
  $('#btn-clear').disabled=!(state.pending.length||state.cuts.length||state.holes.length);
  $('#back-folds').textContent=state.lesson?'‹ 返回':'‹ 摺法';
};
function startLesson(id=0){
  state.shape='square';state.folds=3;state.cuts=[];state.mode='cut';state.lesson={id,phase:'intro'};
  resetScissors();enterCutScreen();show('#s-cut');
}
$('#lesson-cards').innerHTML=LESSONS.map((course,id)=>`<button class="card" data-lesson="${id}">${lessonTarget(id,'card-target-'+id)}<span class="name">第 ${id+1} 課 · ${course.title}</span><span class="desc">${course.tag}</span></button>`).join('');
$('#start-lesson').addEventListener('click',()=>show('#s-lessons'));
$('#lessons-back').addEventListener('click',()=>show('#s-home'));
$('#lesson-cards').addEventListener('click',e=>{const id=e.target.closest('button')?.dataset.lesson;if(id!==undefined)startLesson(Number(id));});
$('#start-free').addEventListener('click',()=>{state.lesson=null;show('#s-shape');});
$('#back-home').addEventListener('click',()=>show('#s-home'));
$('#lesson-panel').addEventListener('click',e=>{
  const action=e.target.closest('button')?.dataset.action;
  if(!action)return;
  if(action==='begin'||action==='next-cut'){state.lesson.phase='cut';render();}
  if(action.startsWith('guess-')){state.lesson.guess=Number(action.slice(6));render();$('#hint').textContent='答好了！按「展開睇作品」或右下角「展開作品」。';}
  if(action==='reveal'){state.lesson.phase='done';state.mode='preview';render();animateReveal();}
  if(action==='courses')show('#s-lessons');
  if(action==='retry'){startLesson(state.lesson.id);state.lesson.phase='cut';render();}
  if(action==='explore'){
    state.lesson=null;state.cuts=[];state.mode='cut';resetScissors();enterCutScreen();
    $('#hint').textContent='試改一改弧線：由摺邊入剪，再剪返出另一條邊，觀察展開後的花瓣。';
  }
});
function animateReveal(){
  svg.classList.remove('reveal');void svg.getBoundingClientRect();svg.classList.add('reveal');
}
function togglePreview(){
  if(state.lesson?.phase==='predict'){
    if(state.lesson.guess!==undefined){state.lesson.phase='done';state.mode='preview';render();animateReveal();return;}
    $('#lesson-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
    $('#lesson-panel button')?.focus({preventScroll:true});
    $('#hint').textContent='請先按上面的答案按鈕，再展開作品。';return;
  }
  if(state.lesson&&['intro','cut','between','predict'].includes(state.lesson.phase))return;
  state.mode=state.mode==='cut'?'preview':'cut';render();
  if(state.mode==='preview'){
    if(state.pending.length)$('#hint').textContent='這條刀線仲未剪斷，未有紙碎掉落。返回可接住剪。';
    animateReveal();
  }
}
$('#btn-mode').addEventListener('click',togglePreview);
$('#thumbwrap').addEventListener('click',togglePreview);
$('#btn-undo').addEventListener('click',()=>{
  if(state.pending.length)state.pending=[];
  else if(state.history.length)restoreHistory();
  if(state.lesson&&state.lesson.phase!=='intro')state.lesson={id:state.lesson.id,phase:'cut'};
  state.mode='cut';render();
});
$('#btn-clear').addEventListener('click',()=>{
  state.cuts=[];resetScissors();state.mode='cut';
  if(state.lesson)state.lesson={id:state.lesson.id,phase:'cut'};render();
});
function tolerance(){
  const m=svg.getScreenCTM();return Math.min(35,16/Math.hypot(m.a,m.b));
}
function onGuide(p){
  const guide=guidePoints();
  for(let i=1;i<guide.length;i++)if(G.nearest([guide[i-1],guide[i]],p).distance<currentStep().tolerance)return true;
  return false;
}
function applyStampAt(point){
  const shape={kind:state.stampKind,cx:point.x,cy:point.y,size:state.stampSize};
  const result=G.punchStamp(state.remaining,shape);
  if(result.status!=='ok'){
    $('#hint').textContent=result.status==='outside'
      ?'印章要完全喺紙入面，唔可以貼邊或伸出紙外。'
      :'呢度印唔到，試移入紙中間少少。';
    return;
  }
  for(const hole of state.holes){
    if(result.removed.some(p=>G.inside(hole,p))||G.inside(hole,{x:shape.cx,y:shape.cy})){
      $('#hint').textContent='唔好疊喺已經印出嘅窿上面。';
      return;
    }
  }
  pushHistory();
  state.holes=state.holes.concat([result.removed]);
  state.pending=[];
  render();
  $('#hint').textContent='印好了！展開預覽會見到對稱嘅窿。';
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('transform',`rotate(${-params().w/2} ${C} ${C})`);g.setAttribute('pointer-events','none');
  g.innerHTML=`<path class="paper-drop" d="${polyD(result.removed)}" fill="var(--red)" stroke="var(--red-deep)" stroke-width="2"/>`;
  svg.appendChild(g);setTimeout(()=>g.remove(),700);
}
svg.addEventListener('pointerdown',e=>{
  if(state.mode!=='cut'||activePointer!==null||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
  if(state.lesson&&state.lesson.phase!=='cut')return;
  const point=modelPt(e),tol=tolerance();
  if(!state.lesson&&state.tool==='stamp'){
    applyStampAt(point);e.preventDefault();return;
  }
  if(state.pending.length){
    if(G.distance(point,state.pending[state.pending.length-1])>tol*1.5){$('#hint').textContent='由剪刀尖接住剪；想重新開始，可以按「復原」。';return;}
  }else{
    const edge=G.nearest(state.remaining,point);
    if(edge.distance>tol){$('#hint').textContent='剪刀要由紙邊入，唔可以喺紙中間直接挖窿。';return;}
    if(state.lesson&&G.distance(edge.point,guidePoints()[0])>32){$('#hint').textContent='今次由金色「起剪」點開始，沿淺色引導線剪。';return;}
    state.pending=[edge.point];
  }
  strokeBefore=state.pending.slice();activePointer=e.pointerId;
  svg.setPointerCapture(e.pointerId);drawBlade();e.preventDefault();
});
function moveBlade(e){
  if(activePointer!==e.pointerId)return;
  const point=modelPt(e),last=state.pending[state.pending.length-1];
  if(G.distance(last,point)<2)return;
  if(state.lesson){
    const count=Math.ceil(G.distance(last,point)/10);
    for(let i=1;i<=count;i++){
      if(!onGuide({x:last.x+(point.x-last.x)*i/count,y:last.y+(point.y-last.y)*i/count})){
        $('#hint').textContent='慢慢沿淺色引導線行；剪刀會留喺最後剪到的位置。';return;
      }
    }
  }
  const path=state.pending.concat(point),result=G.trace(state.remaining,path);
  if(result.status==='split'){
    if(state.lesson){
      const guide=guidePoints(),end=result.line[result.line.length-1];
      const tolerance=currentStep().tolerance;
      const checkpoints=[.2,.4,.6,.8].map(t=>guide[Math.round(t*(guide.length-1))]);
      const follows=checkpoints.every(p=>result.line.slice(1).some((q,i)=>G.nearest([result.line[i],q],p).distance<tolerance+5));
      if(G.distance(end,guide[guide.length-1])>tolerance+8 || !follows){
        $('#hint').textContent='沿整條引導線剪到「剪出」，轉角也要跟住剪。';return;
      }
    }
    pushHistory();state.remaining=result.remaining;state.cuts.push(result.removed);
    state.pending=[];activePointer=null;
    if(state.lesson)state.lesson.phase=state.cuts.length<currentLesson().steps.length?'between':'predict';
    render();
    $('#hint').textContent=state.lesson?.phase==='predict'?'剪好了！請按上面其中一個答案，再展開作品。':'剪斷了！較細塊紙掉落，留下的部分會組成作品。';
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform',`rotate(${-params().w/2} ${C} ${C})`);g.setAttribute('pointer-events','none');
    g.innerHTML=`<path class="paper-drop" d="${polyD(result.removed)}" fill="var(--red)" stroke="var(--red-deep)" stroke-width="2"/>`;
    svg.appendChild(g);setTimeout(()=>g.remove(),700);return;
  }
  if(result.status!=='pending'){
    $('#hint').textContent=result.status==='crossing'?'呢一版先練不交叉的刀線，試向另一條紙邊剪。':'向紙入面剪，再剪返出紙邊。';return;
  }
  state.pending=path;drawBlade();
}
svg.addEventListener('pointermove',moveBlade);
svg.addEventListener('pointerup',e=>{
  if(activePointer!==e.pointerId)return;
  moveBlade(e);activePointer=null;
  if(state.pending.length){render();$('#hint').textContent='仲未剪斷。放手可以休息，再由剪刀尖接住剪。';}
});
svg.addEventListener('pointercancel',e=>{
  if(activePointer!==e.pointerId)return;
  state.pending=strokeBefore;activePointer=null;render();
});

$('#tool-mode-bar')?.addEventListener('click',e=>{
  const tool=e.target.closest('[data-tool]')?.dataset.tool;
  const stamp=e.target.closest('[data-stamp]')?.dataset.stamp;
  if(tool){
    state.tool=tool;
    state.pending=[];
    render();
    $('#hint').textContent=tool==='stamp'
      ?'喺紙入面撳一下，印出圓形或正方形窿（唔可以貼邊）。'
      :'由紙邊入剪，剪到另一條邊，較細塊紙先會掉落。';
  }
  if(stamp){
    state.stampKind=stamp;
    syncToolBar();
  }
});
