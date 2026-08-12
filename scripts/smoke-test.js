#!/usr/bin/env node
/**
 * 山海灵境生产/预发冒烟自测（HTTP）
 *
 * 用法（在 shanhai-server 目录）：
 *   export API_BASE_URL=https://shanhai-production.up.railway.app/api
 *   export WEB_BASE_URL=https://www.shanhai.app
 *   export SMOKE_EMAIL='你的邮箱'
 *   export SMOKE_PASSWORD='你的密码'
 *   npm run test:smoke
 *
 * 可选：
 *   SMOKE_DEEP=1     # 额外跑会扣积分/耗 LLM 的测字、占卜、Agent
 *   SMOKE_TIMEOUT_MS=20000
 *
 * 安全：不要把账号密码写进代码或提交到 git；用环境变量或本地未跟踪的 .env.smoke
 */

const fs = require('fs');
const path = require('path');

// 可选加载 .env.smoke（若存在）
try {
  const smokeEnv = path.join(__dirname, '..', '.env.smoke');
  if (fs.existsSync(smokeEnv)) {
    require('dotenv').config({ path: smokeEnv });
  } else {
    require('dotenv').config();
  }
} catch {
  /* dotenv 可选 */
}

const API_BASE = (process.env.API_BASE_URL || 'https://shanhai-production.up.railway.app/api').replace(
  /\/$/,
  '',
);
const WEB_BASE = (process.env.WEB_BASE_URL || 'https://www.shanhai.app').replace(/\/$/, '');
const EMAIL = String(process.env.SMOKE_EMAIL || '').trim();
const PASSWORD = String(process.env.SMOKE_PASSWORD || '');
const DEEP = String(process.env.SMOKE_DEEP || '') === '1';
const TIMEOUT_MS = Math.min(Math.max(Number(process.env.SMOKE_TIMEOUT_MS || 20000), 3000), 120000);

const results = [];
let defaultPersonaId = 'yunyouzi';

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

async function request(method, url, { token, body, expectJson = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json,text/html,*/*',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Smoke-Test': 'shanhai',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    let json = null;
    if (expectJson) {
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
    }
    return {
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      text,
      json,
      headers: res.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkPublicApi() {
  console.log('\n[1] 公开 API');

  {
    const r = await request('GET', `${API_BASE}/payment/status`);
    if (r.ok && r.json) ok('payment/status', `${r.status} ${r.ms}ms`);
    else fail('payment/status', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('GET', `${API_BASE}/payment/products`);
    const list = Array.isArray(r.json) ? r.json : r.json?.products || r.json?.data;
    if (r.ok && Array.isArray(list) && list.length > 0) {
      const codes = list.map((p) => p.code).filter(Boolean);
      const hasVip = codes.includes('vip_monthly');
      const hasReport = codes.includes('deep_destiny_report');
      ok(
        'payment/products',
        `${list.length} 个商品; vip_monthly=${hasVip}; deep_destiny_report=${hasReport}`,
      );
      if (!hasVip) fail('product vip_monthly', '未找到 vip_monthly');
    } else fail('payment/products', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('GET', `${API_BASE}/personas`);
    const list = Array.isArray(r.json) ? r.json : r.json?.data;
    if (r.ok && Array.isArray(list) && list.length > 0) {
      defaultPersonaId = list[0].id || list[0].code || defaultPersonaId;
      ok('personas', `${list.length} 个灵伴; default=${defaultPersonaId}`);
    } else fail('personas', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('GET', `${API_BASE}/fortunes/daily`);
    if (r.ok && r.json?.poem?.title) ok('fortunes/daily', r.json.poem.title);
    else fail('fortunes/daily', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('POST', `${API_BASE}/analytics/email-lead`, {
      body: { email: 'smoke-test@example.com', source: 'smoke_test' },
    });
    if (r.ok && (r.json?.success === true || r.status < 300)) ok('analytics/email-lead', `${r.status}`);
    else fail('analytics/email-lead', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('POST', `${API_BASE}/agent/chat`, {
      body: {
        message: '你好',
        personaId: defaultPersonaId,
        language: 'zh-CN',
        guestSessionId: `smoke_${Date.now()}`,
      },
    });
    if (r.ok && typeof r.json?.reply === 'string' && r.json.reply.length > 0) {
      ok('agent/chat(guest greeting)', `intent=${r.json.intent || '?'} ${r.ms}ms`);
    } else fail('agent/chat(guest greeting)', `${r.status} ${r.text.slice(0, 160)}`);
  }
}

async function checkWebPages() {
  console.log('\n[2] 前端关键页');
  const pages = [
    '/',
    '/about',
    '/pricing',
    '/faq',
    '/bazi-calculator',
    '/guides/bazi-day-master',
    '/guides',
  ];
  for (const p of pages) {
    const r = await request('GET', `${WEB_BASE}${p}`, { expectJson: false });
    const lower = r.text.toLowerCase();
    const looksHtml = lower.includes('<html') || lower.includes('<!doctype');
    const titleOk = /<title>[^<]{3,}/i.test(r.text);
    if (r.ok && looksHtml && titleOk) ok(`GET ${p}`, `${r.status} ${r.ms}ms`);
    else fail(`GET ${p}`, `${r.status} html=${looksHtml} title=${titleOk}`);
  }
}

async function checkAuthFlows() {
  console.log('\n[3] 登录与账号能力');
  if (!EMAIL || !PASSWORD) {
    skip('login', '未设置 SMOKE_EMAIL / SMOKE_PASSWORD，跳过登录相关用例');
    return null;
  }

  const login = await request('POST', `${API_BASE}/auth/login`, {
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!login.ok || !login.json?.success || !login.json?.token) {
    fail('login', `${login.status} ${JSON.stringify(login.json || login.text).slice(0, 160)}`);
    return null;
  }
  const token = login.json.token;
  const userId = login.json.user?.id;
  ok('login', `user=${login.json.user?.email || userId}`);

  {
    const r = await request('GET', `${API_BASE}/users/me`, { token });
    if (r.ok && (r.json?.id || r.json?.email)) ok('users/me', r.json.email || r.json.id);
    else fail('users/me', `${r.status} ${r.text.slice(0, 120)}`);
  }

  if (userId) {
    const r = await request('GET', `${API_BASE}/users/${userId}`, { token });
    if (r.ok && r.json?.id) ok('users/:id', `membership=${r.json.membership || '?'}`);
    else fail('users/:id', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('GET', `${API_BASE}/points`, { token });
    if (r.ok && (typeof r.json?.availablePoints === 'number' || typeof r.json?.points === 'number')) {
      const pts = r.json.availablePoints ?? r.json.points;
      ok('points summary', `available=${pts}`);
    } else fail('points summary', `${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    const r = await request('GET', `${API_BASE}/points/rules`, { token });
    if (r.ok && r.json) ok('points/rules', `${r.status}`);
    else fail('points/rules', `${r.status} ${r.text.slice(0, 120)}`);
  }

  if (userId) {
    const r = await request('GET', `${API_BASE}/charts/${userId}`, { token });
    if (r.status === 404 || r.json?.hasChart === false) {
      ok('charts/:id', '无命盘（可接受）');
    } else if (r.ok && (r.json?.hasChart || r.json?.dayGanZhi || r.json?.chart)) {
      ok('charts/:id', '已有命盘');
    } else {
      // 有的实现直接返回 chart 对象
      if (r.ok) ok('charts/:id', `${r.status}`);
      else fail('charts/:id', `${r.status} ${r.text.slice(0, 120)}`);
    }
  }

  {
    const r = await request('POST', `${API_BASE}/agent/chat`, {
      token,
      body: {
        message: '我最近工作很纠结，该不该换方向？先给一句结论。',
        personaId: defaultPersonaId,
        language: 'zh-CN',
      },
    });
    if (r.ok && typeof r.json?.reply === 'string' && r.json.reply.length > 8) {
      ok('agent/chat(logged-in)', `intent=${r.json.intent || '?'} ${r.ms}ms`);
    } else fail('agent/chat(logged-in)', `${r.status} ${r.text.slice(0, 160)}`);
  }

  return { token, userId };
}

async function checkDeepPaid(auth) {
  console.log('\n[4] 深度用例（可能扣积分 / 耗 LLM）');
  if (!auth?.token) {
    fail('deep suite', '未登录，跳过');
    return;
  }

  {
    const r = await request('POST', `${API_BASE}/zi/analyze`, {
      token: auth.token,
      body: { zi: '安', userQuestion: '烟雾测试：最近状态如何？' },
    });
    if (r.ok && (r.json?.zi || r.json?.interpretation)) {
      ok('zi/analyze', `${r.ms}ms`);
    } else {
      fail('zi/analyze', `${r.status} ${r.text.slice(0, 160)}`);
    }
  }

  {
    const r = await request('POST', `${API_BASE}/readings`, {
      token: auth.token,
      body: {
        question: '烟雾测试：这份工作三个月内该不该换？',
        category: 'career',
      },
    });
    if (r.ok && (r.json?.interpretation || r.json?.hexagram || r.json?.conclusion)) {
      ok('readings create', `${r.ms}ms`);
    } else {
      fail('readings create', `${r.status} ${r.text.slice(0, 160)}`);
    }
  }
}

async function main() {
  console.log('山海灵境 Smoke Test');
  console.log(`API: ${API_BASE}`);
  console.log(`WEB: ${WEB_BASE}`);
  console.log(`DEEP: ${DEEP ? 'on' : 'off'}`);
  console.log(`EMAIL: ${EMAIL ? EMAIL.replace(/(^.).*(@.*$)/, '$1***$2') : '(not set)'}`);

  try {
    await checkPublicApi();
    await checkWebPages();
    const auth = await checkAuthFlows();
    if (DEEP) await checkDeepPaid(auth);
  } catch (e) {
    fail('runner crashed', String(e?.message || e));
  }

  const passed = results.filter((r) => r.pass && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log('\n========');
  console.log(`通过 ${passed} / 跳过 ${skipped} / 失败 ${failed} / 合计 ${results.length}`);
  if (failed > 0) {
    console.log('失败项：');
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }
  console.log('全部通过 ✓');
}

main();
