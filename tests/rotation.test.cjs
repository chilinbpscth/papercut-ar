const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('orientation presets, drag and roll update model angles across 360 degrees',()=>{
 const nodes={};const make=()=>({style:{},handlers:{},addEventListener(t,f){this.handlers[t]=f;},setPointerCapture(){}});
 for(const name of ['.rotation-sphere','.rotation-globe','input','output','.rotation-values'])nodes[name]=make();
 const buttons=['flat','wall','reset'].map(preset=>({...make(),dataset:{preset}}));
 const host={querySelector:n=>nodes[n],querySelectorAll:()=>buttons,replaceChildren(){}};
 const ctx=vm.createContext({host,seen:null});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/rotation-controls.js'),'utf8'),ctx);
 vm.runInContext('mountRotationControls(host,a=>seen=a)',ctx);
 buttons[1].handlers.click();assert.equal(ctx.seen.pitch,90);
 const ball=nodes['.rotation-sphere'];ball.handlers.pointerdown({pointerId:1,clientX:0,clientY:0,button:0,pointerType:'mouse',preventDefault(){}});
 ball.handlers.pointermove({pointerId:1,clientX:260,clientY:20});assert.equal(ctx.seen.yaw,30);assert.equal(ctx.seen.pitch,120);
 nodes.input.value='270';nodes.input.handlers.input();assert.equal(ctx.seen.roll,270);
 ball.handlers.pointerup();ball.handlers.pointermove({pointerId:1,clientX:300,clientY:100});assert.equal(ctx.seen.yaw,30);
 buttons[2].handlers.click();assert.equal(ctx.seen.pitch+ctx.seen.yaw+ctx.seen.roll,0);
});
