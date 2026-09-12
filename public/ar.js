'use strict';
/* =====================================================================
   AR 擺放模組
   將展開嘅剪紙即場生成 3D 資產（GLB 俾 Android WebXR、USDZ 俾 iOS
   AR Quick Look），實物尺寸 0.2 m × 0.2 m。
   GLB／USDZ 兩個 exporter 都係手寫、零依賴；model-viewer 只負責
   渲染同進入 AR。
   ===================================================================== */

/* ---------- 通用 binary 工具 ---------- */
const AR_SIZE = 0.2;               /* 實物邊長（米）＝ 20 cm */
const AR_TEX = 1024;               /* 貼圖解像度 */

function concatBytes(chunks){
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks){ out.set(c, off); off += c.length; }
  return out;
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- 貼圖：展開圖 SVG → PNG（透明底） ---------- */
function paperTextureSVG(){
  /* viewBox 啱啱好裁到紙嘅邊界（C±H ＝ 70…930），
     令 20 cm quad 上嘅紙係足串 20 cm */
  const body = previewMarkup('arx').replace('var(--red)', '#BC3532');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="70 70 860 860">${body}</svg>`;
}
function renderTextureCanvas(){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([paperTextureSVG()], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = AR_TEX;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, AR_TEX, AR_TEX);
      ctx.drawImage(img, 0, 0, AR_TEX, AR_TEX);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('texture SVG load failed')); };
    img.src = url;
  });
}
async function buildTexturePNG(){
  const canvas = await renderTextureCanvas();
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) return reject(new Error('texture toBlob failed'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

/* ---------- 幾何（GLB 同 USDZ 共用） ---------- */
/* 平放喺 XZ 平面、法線 +Y、雙面。glTF UV 原點喺左上。 */
const QUAD = {
  positions: new Float32Array([
    -AR_SIZE/2, 0, -AR_SIZE/2,
    -AR_SIZE/2, 0,  AR_SIZE/2,
     AR_SIZE/2, 0,  AR_SIZE/2,
     AR_SIZE/2, 0, -AR_SIZE/2,
  ]),
  normals: new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0]),
  uvs: new Float32Array([0,0, 0,1, 1,1, 1,0]),
  indices: new Uint16Array([0,1,2, 0,2,3]),
};

/* ---------- GLB exporter ---------- */
function buildGLB(png){
  const enc = new TextEncoder();
  const pos = new Uint8Array(QUAD.positions.buffer.slice(0));
  const nrm = new Uint8Array(QUAD.normals.buffer.slice(0));
  const uv  = new Uint8Array(QUAD.uvs.buffer.slice(0));
  const idx = new Uint8Array(QUAD.indices.buffer.slice(0));

  const views = [];
  const parts = [];
  let off = 0;
  const push = (bytes, target) => {
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length,
                 ...(target ? { target } : {}) });
    parts.push(bytes);
    off += bytes.length;
    const pad = (4 - off % 4) % 4;
    if (pad){ parts.push(new Uint8Array(pad)); off += pad; }
    return views.length - 1;
  };
  const vPos = push(pos, 34962), vNrm = push(nrm, 34962),
        vUv = push(uv, 34962), vIdx = push(idx, 34963), vImg = push(png);
  const bin = concatBytes(parts);

  const json = {
    asset: { version: '2.0', generator: 'papercut-workshop' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Paper' }],
    meshes: [{ primitives: [{
      attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
      indices: 3, material: 0 }] }],
    materials: [{
      pbrMetallicRoughness: { baseColorTexture: { index: 0 },
        metallicFactor: 0, roughnessFactor: 1 },
      alphaMode: 'MASK', alphaCutoff: 0.5, doubleSided: true }],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: vImg, mimeType: 'image/png' }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors: [
      { bufferView: vPos, componentType: 5126, count: 4, type: 'VEC3',
        min: [-AR_SIZE/2, 0, -AR_SIZE/2], max: [AR_SIZE/2, 0, AR_SIZE/2] },
      { bufferView: vNrm, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: vUv,  componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: vIdx, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
  };
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - jsonBytes.length % 4) % 4;
  if (jsonPad) jsonBytes = concatBytes([jsonBytes, enc.encode(' '.repeat(jsonPad))]);

  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const head = new DataView(new ArrayBuffer(12 + 8));
  head.setUint32(0, 0x46546C67, true);          /* 'glTF' */
  head.setUint32(4, 2, true);
  head.setUint32(8, total, true);
  head.setUint32(12, jsonBytes.length, true);
  head.setUint32(16, 0x4E4F534A, true);         /* 'JSON' */
  const binHead = new DataView(new ArrayBuffer(8));
  binHead.setUint32(0, bin.length, true);
  binHead.setUint32(4, 0x004E4942, true);       /* 'BIN\0' */
  return concatBytes([new Uint8Array(head.buffer), jsonBytes,
                      new Uint8Array(binHead.buffer), bin]);
}

/* ---------- USDZ exporter ---------- */
function paperUSDA(){
  const s = AR_SIZE / 2;
  /* USD 嘅 st 原點喺左下，所以 v 同 glTF 相反 */
  return `#usda 1.0
(
    customLayerData = {
        string creator = "papercut-workshop-poc"
    }
    defaultPrim = "Paper"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Paper"
{
    def Mesh "Sheet"
    {
        uniform bool doubleSided = 1
        float3[] extent = [(-${s}, 0, -${s}), (${s}, 0, ${s})]
        int[] faceVertexCounts = [3, 3]
        int[] faceVertexIndices = [0, 1, 2, 0, 2, 3]
        normal3f[] normals = [(0, 1, 0), (0, 1, 0), (0, 1, 0), (0, 1, 0)] (
            interpolation = "vertex"
        )
        point3f[] points = [(-${s}, 0, -${s}), (-${s}, 0, ${s}), (${s}, 0, ${s}), (${s}, 0, -${s})]
        texCoord2f[] primvars:st = [(0, 1), (0, 0), (1, 0), (1, 1)] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
        rel material:binding = </Paper/Mat>
    }

    def Material "Mat"
    {
        token outputs:surface.connect = </Paper/Mat/PBRShader.outputs:surface>

        def Shader "PBRShader"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor.connect = </Paper/Mat/DiffuseTex.outputs:rgb>
            float inputs:metallic = 0
            float inputs:opacity.connect = </Paper/Mat/DiffuseTex.outputs:a>
            float inputs:opacityThreshold = 0.5
            float inputs:roughness = 1
            token outputs:surface
        }

        def Shader "stReader"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st"
            float2 outputs:result
        }

        def Shader "DiffuseTex"
        {
            uniform token info:id = "UsdUVTexture"
            asset inputs:file = @texture.png@
            float2 inputs:st.connect = </Paper/Mat/stReader.outputs:result>
            token inputs:wrapS = "clamp"
            token inputs:wrapT = "clamp"
            float3 outputs:rgb
            float outputs:a
        }
    }
}
`;
}
/* USDZ ＝ 無壓縮 zip，每個檔案 data 要 64-byte 對齊（用 extra field 填充） */
function buildUSDZ(png){
  const enc = new TextEncoder();
  const files = [
    { name: 'Paper.usda', data: enc.encode(paperUSDA()) },
    { name: 'texture.png', data: png },
  ];
  const chunks = [], central = [];
  let off = 0;
  for (const fexp of files){
    const nameBytes = enc.encode(fexp.name);
    const crc = crc32(fexp.data);
    let pad = (64 - ((off + 30 + nameBytes.length) % 64)) % 64;
    if (pad > 0 && pad < 4) pad += 64;      /* extra field 最少 4 byte */
    const extra = new Uint8Array(pad);
    if (pad){
      const ev = new DataView(extra.buffer);
      ev.setUint16(0, 0x1986, true);        /* 自定 padding ID，讀取器會跳過 */
      ev.setUint16(2, pad - 4, true);
    }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034B50, true);
    lh.setUint16(4, 20, true);              /* version needed */
    lh.setUint16(8, 0, true);               /* method: stored */
    lh.setUint32(14, crc, true);
    lh.setUint32(18, fexp.data.length, true);
    lh.setUint32(22, fexp.data.length, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, pad, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014B50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(10, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, fexp.data.length, true);
    ch.setUint32(24, fexp.data.length, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint32(42, off, true);
    central.push(concatBytes([new Uint8Array(ch.buffer), nameBytes]));
    chunks.push(new Uint8Array(lh.buffer), nameBytes, extra, fexp.data);
    off += 30 + nameBytes.length + pad + fexp.data.length;
  }
  const centralBytes = concatBytes(central);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054B50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralBytes.length, true);
  eocd.setUint32(16, off, true);
  return concatBytes([concatBytes(chunks), centralBytes, new Uint8Array(eocd.buffer)]);
}

/* 俾自動化測試同 ar-live.js 用 */
globalThis.__paperAR = { buildGLB, buildUSDZ, buildTexturePNG, renderTextureCanvas, paperUSDA };

/* ---------- Quick Look／3D 預覽彈窗（而家係後備路徑，由 ar-live.js 調度） ---------- */
if (typeof document !== 'undefined' && document.querySelector('#btn-ar')){
  const modal = document.querySelector('#ar-modal');
  const body = document.querySelector('#ar-body');
  const hint = document.querySelector('#ar-hint');
  const btnEnter = document.querySelector('#ar-enter');
  let mvReady = null, urls = [];

  function cleanupURLs(){
    urls.forEach(u => URL.revokeObjectURL(u));
    urls = [];
  }
  async function openAR(){
    modal.hidden = false;
    hint.textContent = '整緊 3D 模型…';
    btnEnter.disabled = true;
    try {
      if (!mvReady) mvReady = import('./vendor/model-viewer.min.js');
      const [png] = await Promise.all([buildTexturePNG(), mvReady]);
      const glbURL = URL.createObjectURL(new Blob([buildGLB(png)], { type: 'model/gltf-binary' }));
      const usdzURL = URL.createObjectURL(new Blob([buildUSDZ(png)], { type: 'model/vnd.usdz+zip' }));
      cleanupURLs();
      urls = [glbURL, usdzURL];
      body.innerHTML = '';
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', glbURL);
      mv.setAttribute('ios-src', usdzURL);
      mv.setAttribute('ar', '');
      mv.setAttribute('ar-modes', 'webxr quick-look');
      mv.setAttribute('ar-scale', 'fixed');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('touch-action', 'pan-y');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('alt', '剪紙成品 3D 模型');
      body.appendChild(mv);
      await new Promise((res, rej) => {
        mv.addEventListener('load', res, { once: true });
        mv.addEventListener('error', e => rej(new Error('model load error')), { once: true });
      });
      if (mv.canActivateAR){
        hint.textContent = '實物尺寸 20 cm × 20 cm，可貼牆或平放檯面。';
        btnEnter.disabled = false;
        btnEnter.onclick = () => mv.activateAR();
      } else {
        hint.textContent = '呢部裝置唔支援 AR，可以用手指旋轉睇 3D 預覽。iPad／iPhone 請用 Safari 開。';
        btnEnter.disabled = true;
      }
    } catch (err){
      console.error(err);
      hint.textContent = '3D 模型生成失敗，請重試。';
    }
  }
  globalThis.__paperAR.openViewerAR = openAR;   /* ar-live.js 後備入口 */
  document.querySelector('#ar-close').addEventListener('click', () => {
    modal.hidden = true;
    body.innerHTML = '';       /* 停止 WebGL context */
    cleanupURLs();
  });
}
