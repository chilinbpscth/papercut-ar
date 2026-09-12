/* Polygon scissors: an open edge-to-edge cut splits the remaining sheet. */
(function(root){
  const EPS=1e-7;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const cross=(a,b)=>a.x*b.y-a.y*b.x;
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  function area(poly){
    return Math.abs(poly.reduce((sum,p,i)=>sum+cross(p,poly[(i+1)%poly.length]),0))/2;
  }
  function nearest(poly,p){
    let best={distance:Infinity};
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],v=sub(b,a),n=v.x*v.x+v.y*v.y;
      const t=n?Math.max(0,Math.min(1,((p.x-a.x)*v.x+(p.y-a.y)*v.y)/n)):0;
      const point=lerp(a,b,t),d=distance(point,p);
      if(d<best.distance)best={point,distance:d,at:i+t};
    }
    return best;
  }
  function inside(poly,p){
    if(nearest(poly,p).distance<EPS)return true;
    let yes=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
    }
    return yes;
  }
  function intersection(a,b,c,d){
    const r=sub(b,a),s=sub(d,c),den=cross(r,s);
    if(Math.abs(den)<EPS)return null;
    const t=cross(sub(c,a),s)/den,u=cross(sub(c,a),r)/den;
    return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{point:lerp(a,b,t),t,u}:null;
  }
  function boundary(poly,from,to){
    let start=nearest(poly,from).at%poly.length,end=nearest(poly,to).at%poly.length;
    if(end<=start+EPS)end+=poly.length;
    const points=[from];
    for(let i=Math.floor(start)+1;i<end-EPS;i++)points.push(poly[i%poly.length]);
    points.push(to);return points;
  }
  function split(poly,line){
    const start=line[0],end=line[line.length-1];
    const a=line.concat(boundary(poly,end,start).slice(1,-1));
    const b=[...line].reverse().concat(boundary(poly,start,end).slice(1,-1));
    const aa=area(a),ab=area(b),original=area(poly);
    if(Math.min(aa,ab)<3||Math.abs(aa+ab-original)>Math.max(.01,original*1e-7))return {status:'invalid'};
    return {status:'split',remaining:aa>=ab?a:b,removed:aa>=ab?b:a,line};
  }
  function trace(poly,path){
    if(path.length<2)return {status:'pending'};
    if(nearest(poly,path[0]).distance>EPS)return {status:'invalid'};
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];
      if(distance(a,b)<EPS)continue;
      // Keep paths simple: crossing an unfinished cut would need a separate topology model.
      for(let j=1;j<i-1;j++){
        const hit=intersection(a,b,path[j-1],path[j]);
        if(hit&&hit.t>EPS)return {status:'crossing'};
      }
      const hits=[];
      for(let j=0;j<poly.length;j++){
        const h=intersection(a,b,poly[j],poly[(j+1)%poly.length]);
        if(h&&h.t>EPS)hits.push(h);
      }
      hits.sort((x,y)=>x.t-y.t);
      if(hits.length){
        const hit=hits[0];
        if(!inside(poly,lerp(a,hit.point,.5)))return {status:'outside'};
        return split(poly,path.slice(0,i).concat(hit.point));
      }
      if(!inside(poly,b)||nearest(poly,lerp(a,b,.5)).distance<EPS)return {status:'outside'};
    }
    return {status:'pending'};
  }
  const api={area,nearest,inside,intersection,trace,distance};
  if(typeof module!=='undefined')module.exports=api;else root.CutGeometry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
