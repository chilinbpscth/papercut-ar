const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadPosterModule(){
  const code = fs.readFileSync(path.join(__dirname, '../public/memory-poster.js'), 'utf8');
  const calls = [];
  function mockCtx(){
    return {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      globalAlpha: 1,
      fillRect(...a){ calls.push(['fillRect', ...a]); },
      stroke(){ calls.push(['stroke']); },
      beginPath(){ calls.push(['beginPath']); },
      moveTo(){}, arcTo(){}, closePath(){},
      save(){ calls.push(['save']); },
      restore(){ calls.push(['restore']); },
      clip(){ calls.push(['clip']); },
      drawImage(...a){ calls.push(['drawImage', a[0], a[1], a[2], a[3], a[4]]); },
      fillText(t, x, y){ calls.push(['fillText', t, x, y]); },
    };
  }
  const canvas = {
    width: 1600, height: 1100,
    getContext(type){ assert.equal(type, '2d'); return mockCtx(); },
  };
  const documentStub = {
    readyState: 'complete',
    querySelector: () => null,
    addEventListener(){},
  };
  const context = vm.createContext({
    document: documentStub,
    Image: class {},
    URL: { createObjectURL(){ return 'blob:mock'; }, revokeObjectURL(){} },
    Blob: class {},
    navigator: {},
    globalThis: {},
    console,
    Math,
    Date,
    Intl,
    Promise,
  });
  context.globalThis = context;
  vm.runInContext(code, context);
  return { api: context.__memoryPoster, canvas, calls };
}

test('hkTodayString uses YYYY-MM-DD (Hong Kong calendar day)', () => {
  const { api } = loadPosterModule();
  const fixed = new Date('2026-09-15T04:00:00Z'); // HK already 2026-09-15 12:00
  assert.match(api.hkTodayString(fixed), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(api.hkTodayString(fixed), '2026-09-15');
});

test('posterLayout places side-by-side panels with room for title and footer', () => {
  const { api } = loadPosterModule();
  const L = api.posterLayout(1600, 1100);
  assert.equal(L.leftPanel.w, L.rightPanel.w);
  assert.ok(L.rightPanel.x > L.leftPanel.x + L.leftPanel.w);
  assert.ok(L.titleY < L.leftPanel.y);
  assert.ok(L.footerY > L.leftPanel.y + L.leftPanel.h);
});

test('composeMemoryPoster draws mount, both panels, labels and certificate text', () => {
  const { api, canvas, calls } = loadPosterModule();
  const design = { width: 200, height: 200 };
  const photo = { width: 300, height: 240 };
  const layout = api.composeMemoryPoster(canvas, {
    designImage: design,
    photoImage: photo,
    title: '團花窗花',
    name: '小明',
    date: '2026-09-15',
    seedRandom: () => 0.5,
  });
  assert.ok(layout.leftPanel);
  const texts = calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.ok(texts.includes('團花窗花'));
  assert.ok(texts.includes('線上設計'));
  assert.ok(texts.includes('實體作品'));
  assert.ok(texts.some(t => String(t).includes('小明') && String(t).includes('2026-09-15')));
  assert.ok(texts.includes('剪紙'));
  const draws = calls.filter(c => c[0] === 'drawImage');
  assert.equal(draws.length, 2);
  assert.equal(draws[0][1], design);
  assert.equal(draws[1][1], photo);
  assert.ok(calls.some(c => c[0] === 'fillRect'));
});

test('index.html wires memory-poster entry without touching cut-geometry', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('id="btn-memory-poster"'));
  assert.ok(html.includes('整紀念海報'));
  assert.ok(html.includes('memory-poster.js'));
  assert.ok(html.includes('id="mp-modal"'));
  assert.ok(html.includes("btn-memory-poster').hidden"));
  const scissors = fs.readFileSync(path.join(__dirname, '../public/scissors.js'), 'utf8');
  assert.ok(!scissors.includes('memory-poster'));
  const geo = fs.readFileSync(path.join(__dirname, '../public/cut-geometry.js'), 'utf8');
  assert.equal(geo.includes('memory'), false);
});
