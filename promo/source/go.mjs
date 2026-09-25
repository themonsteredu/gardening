// Scripted walk-through of the real student + teacher flow (local app, demo code GARDEN24, browser storage only).
import { session, record, BASE } from './rec.mjs';
import fs from 'node:fs';
const w = ms => new Promise(r => setTimeout(r, ms));
const which = process.argv[2];
// smooth mouse path helper
async function glide(p, x, y, steps = 18) { await p.mouse.move(x, y, { steps }); }
async function drag(p, pts, step = 16, dt = 22) {
  await glide(p, ...pts[0], 12); await w(150); await p.mouse.down();
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step);
    for (let k = 1; k <= n; k++) { await p.mouse.move(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n); await w(dt); }
  }
  await p.mouse.up(); await w(300);
}
async function clickEl(p, loc, pause = 250) { const bx = await loc.boundingBox(); await glide(p, bx.x + bx.width / 2, bx.y + bx.height / 2, 14); await w(pause); await loc.click(); }

async function studioFlow(p, rec) {
    await rec(p, 'join', async () => {
      await p.goto(BASE + '/join'); await w(1500);
      await p.locator('#class-code').pressSequentially('GARDEN24', { delay: 130 }); await w(400);
      await clickEl(p, p.locator('#student-nickname'));
      await p.locator('#student-nickname').pressSequentially('초록설계자', { delay: 150 }); await w(600);
      await clickEl(p, p.getByRole('button', { name: /내 설계실 열기/ }), 400);
      await w(4500);
    });
    // aerial view: paint surfaces
    await p.getByRole('button', { name: '항공샷', exact: true }).click(); await w(1800);
    await rec(p, 'paint', async () => {
      await w(600);
      await clickEl(p, p.getByRole('button', { name: /잔디/ }).first()); await w(500);
      await drag(p, [[885, 452], [1015, 452], [1015, 500], [885, 500], [885, 548], [1015, 548]]);
      await drag(p, [[625, 700], [1245, 700]]);
      await clickEl(p, p.getByRole('button', { name: /산책로/ }).first()); await w(500);
      await drag(p, [[960, 705], [960, 600], [990, 470]]);
      await w(1200);
    });
    await p.getByRole('tab', { name: '2 조경물 놓기' }).click(); await w(600);
    const btns = p.locator('.sample-materials__grid button');
    let cur = null;
    const place = async (name, x, y) => {
      if (cur !== name) { await clickEl(p, btns.filter({ hasText: name }).first()); cur = name; await w(350); }
      await glide(p, x, y, 16); await w(200); await p.mouse.click(x, y); await w(650);
    };
    await rec(p, 'place', async () => {
      await w(500);
      await place('벚나무', 700, 670); await place('벚나무', 1200, 670); await place('느티나무', 635, 600);
      await clickEl(p, p.getByRole('tab', { name: '꽃·관목' })); cur = null; await w(400);
      await place('혼합꽃', 905, 470); await place('라벤더', 1000, 530); await place('수국', 1100, 655);
      await clickEl(p, p.getByRole('tab', { name: '시설' })); cur = null; await w(400);
      await place('벤치', 1010, 640); await place('꽃화단', 800, 690);
      await w(1000);
    });
    // deselect placing mode so drags orbit the camera
    await clickEl(p, btns.filter({ hasText: '꽃화단' }).first()); await w(300);
    await rec(p, 'views', async () => {
      await clickEl(p, p.getByRole('button', { name: '입체', exact: true })); await w(2600);
      await drag(p, [[1200, 330], [1080, 330]], 6, 45); await w(1600);
      await clickEl(p, p.getByRole('button', { name: '학생 시점', exact: true })); await w(3200);
      await clickEl(p, p.getByRole('button', { name: '뒤·옆', exact: true })); await w(2800);
    });
  }

if (which === 'studio') {
  await session(async p => { await studioFlow(p, record); });
}

if (which === 'mini') {
  await session(async p => {
    // rebuild the same 3D design off-camera (the studio clips were recorded in a separate DPR-1 session)
    await studioFlow(p, async (_p, _n, fn) => fn());
    await p.getByRole('button', { name: /완성/ }).click(); await w(1500);
    await record(p, 'intent', async () => {
      await w(800);
      await clickEl(p, p.locator('.intention-keywords button', { hasText: '휴식' })); await w(500);
      await clickEl(p, p.locator('textarea'));
      await p.locator('textarea').pressSequentially('큰 나무 아래에 벤치를 놓아 쉬는 시간에 친구들이 그늘에서 쉴 수 있게 했어요.', { delay: 45 }); await w(700);
      await clickEl(p, p.getByRole('button', { name: /갤러리에 제출/ }), 400); await w(2500);
      await p.mouse.wheel(0, 380); await w(2200);
    });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.getByRole('button', { name: '미니조경 모델링 시작' }).click(); await w(1500);
    await record(p, 'pot', async () => {
      await w(1200);
      await clickEl(p, p.getByRole('button', { name: '화분 확대' })); await w(500);
      await p.getByRole('button', { name: '화분 확대' }).click(); await w(900);
      await clickEl(p, p.getByRole('button', { name: /색모래 층 쌓기/ }), 400); await w(1500);
      const add = n => clickEl(p, p.locator('button', { hasText: n }).filter({ hasText: '추가' }).first());
      const up = async k => { const b = p.getByRole('button', { name: '+ 0.5cm' }); await clickEl(p, b); for (let i = 1; i < k; i++) { await w(220); await b.click(); } };
      await add('흰 모래'); await w(500); await up(4); await w(500);
      await add('분홍 모래'); await w(500); await up(4); await w(500);
      await add('흰 모래'); await w(500); await up(2); await w(1500);
    });
    await record(p, 'objects', async () => {
      await clickEl(p, p.getByRole('button', { name: /식물·돌·장식 배치/ }), 400); await w(1500);
      const addObj = async n => { await clickEl(p, p.locator('button', { hasText: n }).filter({ hasText: '배치' }).first()); await w(700); };
      await addObj('작은 꽃나무'); await addObj('분홍 꽃'); await addObj('분홍 꽃'); await addObj('장식 돌'); await addObj('초록 이끼');
      await w(1200);
    });
    await p.getByRole('button', { name: /제작 순서 확인/ }).click(); await w(1500);
    await record(p, 'making', async () => {
      await w(1200);
      const checks = p.locator('.student-making-check'); const n = await checks.count();
      for (let k = 0; k < n; k++) { await checks.nth(k).scrollIntoViewIfNeeded(); await clickEl(p, checks.nth(k), 120); await w(260); }
      await w(800);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await w(1200);
      await clickEl(p, p.getByRole('button', { name: /완성작 촬영 및 비교/ }), 400); await w(3000);
    });
  }, { dpr: 2 });
}

if (which === 'teacher') {
  await session(async p => {
    await p.goto(BASE + '/teacher'); await w(1500);
    await record(p, 'teacher', async () => {
      await w(1800);
      await clickEl(p, p.getByRole('tab', { name: /학생 현황/ })); await w(2200);
      await clickEl(p, p.getByRole('tab', { name: '반 작품 보기' })); await w(2600);
    });
    await p.goto(BASE + '/teacher/mini-garden-kit'); await w(1500);
    await record(p, 'kit', async () => {
      await w(1000);
      for (const n of ['원형', '넓고 낮은 화분', '높은 원통형']) { await clickEl(p, p.locator('button', { hasText: n }).first()); await w(1100); }
      await w(800);
    });
  }, { dpr: 2 });
}
