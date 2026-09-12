const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('./load-geometry.cjs');
const square=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
const p=(x,y)=>({x,y});
test('a stroke in the middle cannot punch a hole',()=>{
 assert.equal(G.trace(square,[p(30,30),p(60,30),p(60,60),p(30,30)]).status,'invalid');
});
test('stopping inside leaves the sheet intact; continuation splits it',()=>{
 const path=[p(0,20),p(40,40)];
 assert.equal(G.trace(square,path).status,'pending');
 const cut=G.trace(square,[...path,p(100,20)]);
 assert.equal(cut.status,'split');assert.equal(G.area(cut.remaining)+G.area(cut.removed),10000);
 assert.equal(G.area(cut.removed),3000);
});
test('straight edge-to-edge stroke cuts off a strip without automatic closure',()=>{
 const cut=G.trace(square,[p(0,20),p(120,20)]);
 assert.equal(cut.status,'split');assert.equal(G.area(cut.removed),2000);
});
test('a later cut can start at the newly exposed edge',()=>{
 const first=G.trace(square,[p(0,20),p(100,20)]);
 const second=G.trace(first.remaining,[p(50,20),p(80,50),p(100,50)]);
 assert.equal(second.status,'split');assert.equal(G.area(second.remaining)+G.area(second.removed),8000);
});
test('outward and boundary-only motion do not remove paper',()=>{
 assert.equal(G.trace(square,[p(0,20),p(-20,30)]).status,'outside');
 assert.notEqual(G.trace(square,[p(0,20),p(0,80)]).status,'split');
});
test('self-crossing blade paths are rejected',()=>{
 assert.equal(G.trace(square,[p(0,20),p(60,20),p(30,60),p(30,10)]).status,'crossing');
});
test('corner endpoints preserve area',()=>{
 const cut=G.trace(square,[p(0,0),p(100,100)]);
 assert.equal(cut.status,'split');assert.equal(G.area(cut.remaining),5000);
});
test('guided curved cut leaves a center-connected petal wedge',()=>{
 const poly=[p(500,500),p(500,70),p(930,70)];
 const path=Array.from({length:33},(_,i)=>{
 const t=i/32,r=330+100*Math.sin(Math.PI*t),a=(-90+45*t)*Math.PI/180;
 return p(500+r*Math.cos(a),500+r*Math.sin(a));});
 const cut=G.trace(poly,path);
 assert.equal(cut.status,'split');assert(G.inside(cut.remaining,p(501,490)));
 assert(Math.abs(G.area(cut.remaining)+G.area(cut.removed)-G.area(poly))<.001);
});
