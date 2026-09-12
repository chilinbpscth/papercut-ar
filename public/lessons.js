'use strict';
// Original teaching patterns inspired by traditional motifs; not copies of a named master's work.
const petalGuide=()=>Array.from({length:41},(_,i)=>{
  const t=i/40;return ptAt(-90+45*t,330+100*Math.sin(Math.PI*t));
});
const leafGuide=()=>Array.from({length:41},(_,i)=>{
  const t=i/40;return {x:C+36*Math.sin(Math.PI*t),y:C-200-110*t};
});
const toothGuide=()=>{
  const radii=[330,410,330,425,330,410,330],points=[];
  for(let i=0;i<6;i++){
    const a=ptAt(-90+i*7.5,radii[i]),b=ptAt(-90+(i+1)*7.5,radii[i+1]);
    for(let k=0;k<8;k++)points.push({x:a.x+(b.x-a.x)*k/8,y:a.y+(b.y-a.y)*k/8});
  }
  points.push(ptAt(-45,330));return points;
};
const centerGuide=()=>Array.from({length:33},(_,i)=>ptAt(-90+45*i/32,85));
const petalStep={name:'剪出花瓣形狀',text:'從「起剪」開始，沿白色線剪到「剪出」。<br>想停一停？放手後，再從剪刀的位置繼續。',guide:petalGuide,tolerance:42};
const leafStep={name:'剪半片葉子',text:'沿白色線剪半片葉子，剪回同一條紙邊。<br>打開後，兩個半片會變成一個完整的葉形小孔。',guide:leafGuide,tolerance:18};
const toothStep={name:'剪出尖尖的花邊',text:'沿白色線剪。到尖角時，停一停，再轉彎。<br>每個尖角都要剪到，不要抄捷徑。',guide:toothGuide,tolerance:23};
const centerStep={name:'剪走中心的小角',text:'沿白色線，剪走金點旁邊的小角。<br>打開後，花的中間就會有一個圓孔。',guide:centerGuide,tolerance:14};
const LESSONS=[
 {title:'對稱花瓣',tag:'入門 · 1 步',intro:'剪一條彎彎的線，打開紙，就會出現八塊花瓣！',culture:'「團花」的花紋向四周排列，像一朵圓圓的花，有「團團圓圓」的意思。',steps:[petalStep],question:'這張紙摺了 3 次。打開後，你估會有幾塊花瓣？',choices:['4 塊','8 塊','16 塊'],answer:1,explain:'每摺一次，紙就多一倍層數：2 層、4 層、8 層。所以一剪，就剪出八塊花瓣。',finish:'你剪出八瓣花了！下次把線剪深一點，看看花瓣會有甚麼不同。',source:'https://www.xinhuameiyu.com/subject/getChapter.action?vo.id=8ab3f7395b8a006c015b8a006cdf011c',sourceName:'新華美育：團花製作'},
 {title:'柳葉紋團花',tag:'進階一 · 2 步',intro:'先剪一朵花，再剪葉形小孔。讓你的花多一層花紋！',culture:'「柳葉紋」像尖尖、長長的柳樹葉子。把紙對摺，只剪半片，打開就是一片。',steps:[petalStep,leafStep],question:'剛才剪了半片葉子。打開紙後，會看到甚麼？',choices:['完整的葉形小孔','只剩半片葉','紙外邊的尖角'],answer:0,explain:'兩個半片合起來，就變成完整的葉形小孔。剪出透光的小孔，叫做「鏤空」。',finish:'葉形小孔出現了！小孔和紙邊之間要留一條紅紙，作品才不會斷開。',source:'https://www.xinhuameiyu.com/subject/getChapter.action?requestPageNum=1&vo.id=8ab3f7395b89f5d0015b89f5d0e5011b',sourceName:'新華美育：柳葉紋'},
 {title:'鋸齒紋窗花',tag:'進階二 · 2 步',intro:'先剪尖尖的花邊，再剪中間的小孔。這次要練習轉彎！',culture:'「鋸齒紋」像一排小牙齒。剪紙藝人會用它來剪動物的毛和小草；我們用它做花邊。',steps:[toothStep,centerStep],question:'剪到尖角時，應該怎樣做？',choices:['跳過尖角','停一停再轉向','在紙中間畫圈'],answer:1,explain:'先剪到尖角，再轉彎，就能剪出一排尖尖的花邊。',finish:'看看這一排尖角！下次試試剪大一點或小一點，設計另一款花邊。',source:'https://www.yantai.gov.cn/art/2023/11/28/art_83093_3160238.html',sourceName:'土山鎮中心小學：妙手剪窗花'},
 {title:'團圓窗花',tag:'綜合挑戰 · 3 步',intro:'一起做一張窗花：先剪花瓣，再剪葉形小孔，最後剪中間的圓孔。',culture:'剪紙有小孔，也要有連住各部分的紅紙。這些連接像小橋，所以叫「紙橋」。',steps:[petalStep,leafStep,centerStep],question:'怎樣才能讓窗花連成一張，不會散開？',choices:['留下所有紙碎','留下連接的紅紙','留下所有白色線'],answer:1,explain:'留下連接各部分的紅紙，就像留住一座座小橋，窗花才不會散開。',finish:'你的團圓窗花完成了！下次試試改變花瓣或小孔的大小，做自己的設計。',source:'https://www.xinhuameiyu.com/subject/getChapter.action?vo.id=8ab3f7395b8a006c015b8a006cdf011c',sourceName:'新華美育：團花製作'}
];
function lessonDesign(id){
  let remaining=[{x:C,y:C},{x:C,y:C-H},{x:C+H,y:C-H}];
  const cuts=[];
  for(const step of LESSONS[id].steps){
    const result=CutGeometry.trace(remaining,step.guide());
    if(result.status!=='split')throw new Error('Invalid teaching pattern: '+id+' '+step.name);
    remaining=result.remaining;cuts.push(result.removed);
  }
  return {remaining,cuts};
}
function lessonTarget(id,prefix='lesson-target'){
  const cuts=lessonDesign(id).cuts.map(poly=>`<path d="${polyD(poly)}" fill="black"/>`).join('');
  const copies=Array.from({length:8},(_,k)=>{
    const transform=k%2===0?`rotate(${k*45})`:`rotate(${-180+(k+1)*45}) scale(1 -1)`;
    return `<g transform="translate(500 500) ${transform} translate(-500 -500)">${cuts}</g>`;
  }).join('');
  return `<svg class="target" viewBox="0 0 1000 1000" role="img" aria-label="${LESSONS[id].title}目標"><defs><mask id="${prefix}"><path d="M70 70H930V930H70Z" fill="white"/>${copies}</mask></defs><path d="M70 70H930V930H70Z" fill="var(--red)" mask="url(#${prefix})"/></svg>`;
}
