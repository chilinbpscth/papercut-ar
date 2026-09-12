'use strict';
// Shared manual orientation control for the embedded AR scene and model-viewer.
function mountRotationControls(host,onChange){
  let angles={pitch:0,yaw:0,roll:0},pointer=null,last=null;
  host.innerHTML=`<div class="rotation-panel"><div class="rotation-sphere" tabindex="0" role="group" aria-label="角度球：拖動或用方向鍵轉動作品"><div class="rotation-globe"><i></i><i></i><i></i><b>紙</b></div></div><div class="rotation-options"><strong>拖動球體，轉動作品</strong><p>上下翻轉・左右轉向</p><div class="rotation-presets"><button type="button" data-preset="flat">平放</button><button type="button" data-preset="wall">貼牆 90°</button><button type="button" data-preset="reset">重設</button></div><label>自轉 <input type="range" min="0" max="360" value="0" step="1" aria-label="作品自轉角度"><output>0°</output></label><small class="rotation-values" aria-live="polite"></small></div></div>`;
  const sphere=host.querySelector('.rotation-sphere'),globe=host.querySelector('.rotation-globe'),slider=host.querySelector('input'),value=host.querySelector('output'),status=host.querySelector('.rotation-values');
  const wrap=v=>((v%360)+360)%360;
  function update(){
    for(const k of Object.keys(angles))angles[k]=wrap(angles[k]);
    globe.style.transform=`rotateY(${angles.yaw}deg) rotateX(${angles.pitch}deg) rotateZ(${angles.roll}deg)`;
    slider.value=angles.roll;value.textContent=Math.round(angles.roll)+'°';
    status.textContent=`翻轉 ${Math.round(angles.pitch)}° · 轉向 ${Math.round(angles.yaw)}°`;
    onChange({...angles});
  }
  sphere.addEventListener('pointerdown',e=>{
    if(pointer!==null||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    pointer=e.pointerId;last={x:e.clientX,y:e.clientY};sphere.setPointerCapture(pointer);e.preventDefault();
  });
  sphere.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer)return;
    angles.yaw+=(e.clientX-last.x)*1.5;angles.pitch+=(e.clientY-last.y)*1.5;
    last={x:e.clientX,y:e.clientY};update();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])sphere.addEventListener(event,()=>{pointer=null;});
  sphere.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();angles[e.key.includes('Left')||e.key.includes('Right')?'yaw':'pitch']+=['ArrowLeft','ArrowUp'].includes(e.key)?-5:5;update();
  });
  slider.addEventListener('input',()=>{angles.roll=Number(slider.value);update();});
  host.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
    angles={pitch:button.dataset.preset==='wall'?90:0,yaw:0,roll:0};update();
  }));
  update();
  return {reset(){angles={pitch:0,yaw:0,roll:0};update();},destroy(){host.replaceChildren();}};
}
