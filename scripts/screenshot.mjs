#!/usr/bin/env node
// 디자인 확인용 스크린샷. 페이지 × 라이트/다크 × 1280/390을 전체 페이지로 찍고 한눈에 보는 index.html을 만든다.
// 사용: pnpm shots [baseURL] [페이지...]   예) pnpm shots http://localhost:3000 / /about
// 서버(pnpm dev 또는 pnpm preview)는 먼저 띄워 둔다. 브라우저는 설치된 Chrome을 쓴다(다운로드 없음).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_PAGES = ['/', '/about', '/to-yasiro'];
const THEMES = ['light', 'dark'];
const WIDTHS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const OUT = join(process.cwd(), 'screenshots');

const [baseURL = 'http://localhost:3000', ...pageArgs] = process.argv.slice(2);
const pages = pageArgs.length ? pageArgs : DEFAULT_PAGES;
const slug = (path) => (path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-'));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const shots = [];

try {
  for (const path of pages) {
    for (const theme of THEMES) {
      for (const vp of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
        });
        // layout.tsx의 inline script가 hydration 전에 읽는 값이라 goto 전에 심는다
        await context.addInitScript((t) => localStorage.setItem('yasiro-theme', t), theme);
        const page = await context.newPage();
        await page.goto(new URL(path, baseURL).href, { waitUntil: 'networkidle' });
        const applied = await page.getAttribute('html', 'data-theme');
        if (applied !== theme) throw new Error(`${path}: data-theme=${applied}, 기대값 ${theme}`);
        // dev 오버레이(N 배지·Issues)를 가린다
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        await page.evaluate(() => document.fonts.ready);

        const file = `${slug(path)}-${theme}-${vp.name}.png`;
        await page.screenshot({ path: join(OUT, file), fullPage: true, animations: 'disabled' });
        shots.push({ path, theme, vp: vp.name, file });
        console.log(`✓ ${file}`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const rows = pages
  .map((path) => {
    const cells = shots
      .filter((s) => s.path === path)
      .map((s) => `<figure class="${s.vp}"><figcaption>${s.theme} · ${s.vp}</figcaption><a href="${s.file}"><img src="${s.file}" loading="lazy"></a></figure>`)
      .join('');
    return `<section><h2>${path}</h2><div class="row">${cells}</div></section>`;
  })
  .join('');

writeFileSync(
  join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>yasiro 스크린샷</title>
<style>
body{font:14px system-ui;margin:24px;background:#ddd}h2{margin:32px 0 12px}
.row{display:flex;gap:16px;align-items:flex-start;overflow-x:auto}
figure{margin:0;flex:none}figure.desktop{width:640px}figure.mobile{width:195px}
figure img{width:100%;display:block;border:1px solid #999}figcaption{margin-bottom:4px;color:#444}
</style>
<p>${new Date().toLocaleString('ko-KR')} · ${baseURL}</p>${rows}`,
);
console.log(`\n${join(OUT, 'index.html')}`);
