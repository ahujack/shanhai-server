/**
 * Playwright 冒烟：关键页可打开 + 可选登录 UI
 *
 * 用法（shanhai-server）：
 *   npx playwright install chromium
 *   node scripts/playwright-smoke.js
 *
 * 读取 .env.smoke 中的 SMOKE_EMAIL / SMOKE_PASSWORD / WEB_BASE_URL
 */
const fs = require('fs');
const path = require('path');

try {
  const smokeEnv = path.join(__dirname, '..', '.env.smoke');
  if (fs.existsSync(smokeEnv)) require('dotenv').config({ path: smokeEnv });
  else require('dotenv').config();
} catch {
  /* optional */
}

const WEB_BASE = (process.env.WEB_BASE_URL || 'https://www.shanhai.app').replace(/\/$/, '');
const EMAIL = String(process.env.SMOKE_EMAIL || '').trim();
const PASSWORD = String(process.env.SMOKE_PASSWORD || '');

const results = [];
function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function skip(name, detail = '') {
  results.push({ name, pass: true, skipped: true, detail });
  console.log(`  ○ ${name}${detail ? ` — ${detail}` : ''}`);
}

function maskEmail(email) {
  return String(email || '').replace(/(^.).*(@.*$)/, '$1***$2');
}

async function main() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.error('未安装 playwright。请先执行：npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  console.log('山海灵境 Playwright Smoke');
  console.log(`WEB: ${WEB_BASE}`);
  console.log(`EMAIL: ${EMAIL ? maskEmail(EMAIL) : '(not set)'}`);

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('\n[1] 关键页渲染');
    const pages = [
      { path: '/', expect: /山海|卡住|云游|灵境/ },
      { path: '/about', expect: /关于|信任|山海/ },
      { path: '/pricing', expect: /价格|会员|积分|USD|VIP/i },
      { path: '/faq', expect: /常见问题|FAQ|积分|VIP/i },
      { path: '/guides/bazi-day-master', expect: /日主|八字/ },
    ];

    for (const item of pages) {
      const url = `${WEB_BASE}${item.path}`;
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
        const status = resp ? resp.status() : 0;
        await page.waitForTimeout(800);
        const text = await page.locator('body').innerText();
        if (status >= 200 && status < 400 && item.expect.test(text)) {
          ok(`page ${item.path}`, `status=${status}`);
        } else {
          fail(`page ${item.path}`, `status=${status} textPreview=${text.slice(0, 80).replace(/\s+/g, ' ')}`);
        }
      } catch (e) {
        fail(`page ${item.path}`, String(e.message || e));
      }
    }

    console.log('\n[2] 首页交互（游客）');
    await page.goto(`${WEB_BASE}/`, { waitUntil: 'networkidle' }).catch(() => null);
    await page.waitForTimeout(1500);
    const input = page.locator('textarea, input[type="text"]').filter({ hasNot: page.locator('[type="password"]') }).last();
    if (await input.count()) {
      await input.click();
      await input.fill('');
      await input.type('我想测一下最近状态，先给一句结论。', { delay: 20 });
      // 触发 React Native Web 的 onChange
      await input.evaluate((el) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      ok('home input fill');
      const sendBtn = page.getByText('发送', { exact: true }).first();
      if (await sendBtn.count()) {
        await sendBtn.click({ force: true });
        try {
          await page.waitForFunction(
            () => {
              const body = document.body?.innerText || '';
              return /结论|建议|测字|占卜|八字|这次我用|云游|听到|抱抱|状态|下一步/.test(body);
            },
            { timeout: 45000 },
          );
          ok('home agent reply', '收到回复文本');
        } catch {
          fail('home agent reply', '45s 内未见明显回复');
        }
      } else {
        skip('home send', '未找到发送按钮文案');
      }
    } else {
      fail('home input', '未找到输入框');
    }

    console.log('\n[3] 登录 UI');
    if (!EMAIL || !PASSWORD) {
      skip('login ui', '未配置 SMOKE_EMAIL/SMOKE_PASSWORD');
    } else {
      await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      // 切到密码登录
      const pwdTab = page.getByText(/密码登录|Password|密碼登入/).first();
      if (await pwdTab.count()) {
        await pwdTab.click({ force: true });
        await page.waitForTimeout(400);
      }
      const emailBox = page.getByPlaceholder(/邮箱|email/i).first();
      const passBox = page.getByPlaceholder(/密码|password/i).first();
      if ((await emailBox.count()) && (await passBox.count())) {
        await emailBox.fill(EMAIL);
        await passBox.fill(PASSWORD);
        await passBox.press('Enter').catch(() => null);
        // RN Web 的 TouchableOpacity 常不是 button role；点页面下方主按钮文案
        try {
          await page.locator('div[dir="auto"]').filter({ hasText: /^登录$/ }).last().click({ force: true, timeout: 5000 });
        } catch {
          await page.evaluate(() => {
            const nodes = Array.from(document.querySelectorAll('div,span,button'));
            const btn = nodes.reverse().find((n) => (n.textContent || '').trim() === '登录');
            if (btn) (btn).click();
          });
        }
        try {
          await page.waitForFunction(
            () => {
              const t = document.body?.innerText || '';
              const url = location.href;
              return /签到|我的|积分|灵石|退出|欢迎回来/.test(t) || !/\/login/.test(url);
            },
            { timeout: 25000 },
          );
          ok('login ui', '登录后离开登录页或出现账号入口');
        } catch {
          const body = (await page.locator('body').innerText()).slice(0, 120).replace(/\s+/g, ' ');
          fail('login ui', `超时；页面片段: ${body}`);
        }
      } else {
        fail('login ui', '未找到邮箱/密码输入框');
      }
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log('\n========');
  console.log(`通过 ${passed} / 跳过 ${skipped} / 失败 ${failed} / 合计 ${results.length}`);
  if (failed > 0) {
    for (const r of results.filter((x) => !x.pass)) console.log(`  - ${r.name}: ${r.detail}`);
    process.exit(1);
  }
  console.log('全部通过 ✓');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
