const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../public');
function app(){
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',style:{},handlers:{},classList:{add(){},remove(){}},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},setAttribute(){},appendChild(){},remove(){},setPointerCapture(){},getBoundingClientRect(){return {};},getScreenCTM(){return {a:1,b:0,inverse(){return {};}};}});return nodes.get(id);}
 const doc={querySelector:node,querySelectorAll:()=>[],createElementNS:()=>node(Symbol())};
 const context=vm.createContext({document:doc,CutGeometry:require('./load-geometry.cjs'),console,setTimeout:()=>{},DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}}});
 const inline=fs.readFileSync(path.join(root,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInContext(inline,context);vm.runInContext(fs.readFileSync(path.join(root,'lessons.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'scissors.js'),'utf8'),context);
 const run=s=>vm.runInContext(s,context);
 function emit(type,p){
  const display=run(`rotPt(${JSON.stringify(p)},-params().w/2)`);
  for(const handler of node('#cutsvg').handlers[type]??[])handler({clientX:display.x,clientY:display.y,pointerId:1,isPrimary:true,pointerType:'mouse',button:0,preventDefault(){}});
 }
 function click(id){for(const handler of node(id).handlers.click??[])handler({});}
 return {run,emit,click,node};
}
test('lesson can pause, resume, update live preview, and complete with one actual removed polygon',()=>{
 const a=app();a.run("startLesson();state.lesson.phase='cut';render()");
 const points=a.run('guidePoints()');
 a.emit('pointerdown',points[0]);for(const p of points.slice(1,21))a.emit('pointermove',p);a.emit('pointerup',points[20]);
 assert.equal(a.run('state.cuts.length'),0);assert(a.run('state.pending.length')>10);
 assert(a.node('#thumbsvg').innerHTML.includes('stroke-width="7"'));
 a.emit('pointerdown',points[20]);for(const p of points.slice(21))a.emit('pointermove',p);a.emit('pointerup',points.at(-1));
 assert.equal(a.run('state.lesson.phase'),'predict');assert.equal(a.run('state.cuts.length'),1);assert.equal(a.run('state.pending.length'),0);
 assert(a.node('#thumbsvg').innerHTML.includes('mask="url(#thm)"'));
 assert(!a.run("previewMarkup('arx')").includes('紙中心'));
 a.click('#btn-undo');assert.equal(a.run('state.cuts.length'),0);assert.equal(a.run('state.lesson.phase'),'cut');
});
test('free drawing cannot start in paper interior, and cancellation restores last paused stroke',()=>{
 const a=app();a.run("state.shape='square';state.folds=3;state.mode='cut';resetScissors();render()");
 a.emit('pointerdown',{x:600,y:200});assert.equal(a.run('state.pending.length'),0);
 a.emit('pointerdown',{x:500,y:200});a.emit('pointermove',{x:560,y:200});a.emit('pointerup',{x:560,y:200});
 const count=a.run('state.pending.length');
 a.emit('pointerdown',{x:560,y:200});a.emit('pointermove',{x:600,y:200});a.emit('pointercancel',{x:600,y:200});
 assert.equal(a.run('state.pending.length'),count);assert.equal(a.run('state.cuts.length'),0);
 a.click('#btn-undo');assert.equal(a.run('state.pending.length'),0);
});
test('a tiny shortcut near the lesson start does not count as success',()=>{
 const a=app();a.run("startLesson();state.lesson.phase='cut';render()");
 a.emit('pointerdown',{x:500,y:170});a.emit('pointermove',{x:510,y:165});a.emit('pointermove',{x:499,y:150});
 assert.equal(a.run('state.cuts.length'),0);assert.equal(a.run('state.lesson.phase'),'cut');
});

for(let id=1;id<4;id++)test(`advanced lesson ${id+1}: all guided cuts, progress, undo and preview`,()=>{
 const a=app();a.run(`startLesson(${id});state.lesson.phase='cut';render()`);
 const steps=a.run('currentLesson().steps.length');
 for(let i=0;i<steps;i++){
  const points=a.run('guidePoints()');a.emit('pointerdown',points[0]);
  for(const p of points.slice(1))a.emit('pointermove',p);a.emit('pointerup',points.at(-1));
  assert.equal(a.run('state.cuts.length'),i+1);
  assert.equal(a.run('state.lesson.phase'),i+1<steps?'between':'predict');
  if(i+1<steps)a.run("state.lesson.phase='cut';render()");
 }
 assert(a.run('G.area(state.remaining)')>1000);
 const remaining=a.run('G.area(state.remaining)');
 a.click('#btn-undo');assert.equal(a.run('state.lesson.id'),id);assert.equal(a.run('state.cuts.length'),steps-1);
 assert(a.run('G.area(state.remaining)')>remaining);
 const points=a.run('guidePoints()');a.emit('pointerdown',points[0]);for(const p of points.slice(1))a.emit('pointermove',p);a.emit('pointerup',points.at(-1));
 assert.equal(a.run('state.cuts.length'),steps);assert.equal(a.run('state.lesson.phase'),'predict');
 assert(a.run('Math.abs(G.area(lessonDesign(state.lesson.id).remaining)-G.area(state.remaining))')<.01);
});
