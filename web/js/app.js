/* ============================================================
 * 文 v3.7.9 · app.js — 资讯工作台
 * ============================================================ */
(function () {
  'use strict';

  const C = window.NewsCore;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = C.esc;

  /* ---------------- 存储 ---------------- */
  const K = {
    settings: 'cw2:settings', read: 'cw2:read', star: 'cw2:star', later: 'cw2:later',
    cache: 'cw2:cache', boards: 'cw2:boards', archive: 'cw2:archive'
  };
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  const DEFAULTS = {
    theme: 'light', density: 'comfort', interval: 90, auto: true, flashAuto: true,
    hideRead: false, imagesOnly: false, unreadOnly: false, sort: 'new', highlight: true,
    font: 'sans', fs: 16.5, lh: 1.9, width: 720, rate: 1,
    keywords: [], customSources: [], pin: false,
    aiAuto: true, aiBase: '', aiKey: '', aiModel: 'gpt-4o-mini', city: 'shenzhen',
    disabledSources: [], range: 'all'
  };
  const settings = Object.assign({}, DEFAULTS, store.get(K.settings, {}));

  const state = {
    view: 'feed', cat: '全部', query: '', sourceFilter: '',
    items: [], boards: {}, boardTab: 'baidu', flash: [],
    current: null, bodyHtml: '', bodyText: '',
    read: new Set(store.get(K.read, [])),
    star: new Set(store.get(K.star, [])),
    later: new Set(store.get(K.later, [])),
    newIds: new Set(),
    loading: false, okSources: 0, lastUpdate: 0,
    countdown: settings.interval, flashCountdown: 30, loadSeq: 0,
    speaking: false, hotCache: null, limit: 60,
    aiCache: new Map(), aiBusy: false,
    weather: null, alarms: [],
    stocks: [], imageTried: new Set(), stockPrev: {}, stockFlash: {}, stockRetried: false,
    stockCountdown: 15, stockLoading: false, stockTs: 0,
    carouselItems: [], carouselIdx: 0, carouselTimer: null, carouselPaused: false,
    archive: [], range: settings.range || 'all',   // 随其他设置一起持久化，保持上次选择
    webResults: [], webSearching: false, webSeq: 0, webTimer: null
  };
  const RANGES = [
    { id: 'all', label: '全部' }, { id: 'today', label: '今天' },
    { id: '3d', label: '近三日' }, { id: '7d', label: '近七日' }
  ];
  function hotWordsCached(items, limit) {
    const key = items.length + '|' + state.lastUpdate + '|' + limit;
    if (!state.hotCache || state.hotCache.key !== key) {
      state.hotCache = { key, words: C.hotWords(items, limit) };
    }
    return state.hotCache.words;
  }

  /* ---------------- 图标 ---------------- */
  const I = {
    feed: '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M7 9h6M7 13h10M7 17h7"/></svg>',
    hot: '<svg viewBox="0 0 24 24"><path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5s-.5 3 1.5 3.5C11 9 12 6 12 2z"/><path d="M12 22a6 6 0 0 0 6-6"/></svg>',
    flash: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    insight: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L3.5 9.8l5.9-.8z"/></svg>',
    later: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    focus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 20v3M2 12h2M20 12h2"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    speak: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 16l-5-5-9 9"/></svg>',
    sort: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h6"/></svg>',
    density: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------------- 工具 ---------------- */
  const pad = n => n < 10 ? '0' + n : '' + n;
  function fmtTime(ts) {
    const d = new Date(ts), now = new Date(), diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (d.toDateString() === now.toDateString()) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (now.getFullYear() === d.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }
  function fmtAbs(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dayLabel(ts) {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return '今天';
    if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return '昨天';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  let toastTimer;
  function toast(msg, ms) {
    $('#toastText').textContent = msg;
    $('#toast').classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('on'), ms || 2400);
  }
  function saveSettings() {
    store.set(K.settings, settings);
    // 桌面端窗口置顶走本地 HTTP 端点；局域网/微信访问时没有本地窗口，跳过
    if (window.__PROXY__ && !window.__WEN_REMOTE__) fetch('/api/top?on=' + (settings.pin ? 1 : 0)).catch(() => { });
  }
  function openExternal(url) {
    if (!url) return;
    if (window.AndroidBridge && window.AndroidBridge.openUrl) return window.AndroidBridge.openUrl(url);
    // 局域网 / 微信内置浏览器：直接在浏览器里开新页，别让服务器去弹本地浏览器
    if (window.__WEN_REMOTE__) { window.open(url, '_blank', 'noopener'); return; }
    if (window.__PROXY__) return fetch('/api/open?u=' + encodeURIComponent(url)).catch(() => { });
    window.open(url, '_blank', 'noopener');
  }
  function copyText(text, msg) {
    if (window.AndroidBridge && window.AndroidBridge.copy) { window.AndroidBridge.copy(text); toast(msg || '已复制'); return; }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(msg || '已复制'); } catch (e) { toast('复制失败'); }
    document.body.removeChild(ta);
  }
  function download(name, text, mime) {
    try {
      const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('已导出：' + name);
    } catch (e) { toast('导出失败'); }
  }
  function hits(it) {
    if (!settings.keywords || !settings.keywords.length) return [];
    const t = (it.title + ' ' + (it.summary || '')).toLowerCase();
    return settings.keywords.filter(k => k && t.includes(k.toLowerCase()));
  }
  function hl(text) {
    let s = esc(text);
    if (!settings.highlight || !settings.keywords.length) return s;
    settings.keywords.forEach(k => {
      if (!k) return;
      const safe = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>');
    });
    return s;
  }

  /* ---------------- AI 总结 ---------------- */
  // 默认使用内置抽取式摘要（离线、双端可用）；设置里填了 API 则调用大模型
  async function cloudSummary(it, text) {
    if (!settings.aiKey || !settings.aiBase || !window.__PROXY__) throw new Error('未配置云端模型');
    const messages = [
      { role: 'system', content: '你是资深中文新闻编辑。把新闻压缩成 3 条要点，每条不超过 45 字，只输出要点，每行一条，不要序号、不要多余说明。' },
      { role: 'user', content: '标题：' + it.title + '\n来源：' + it.source + '\n内容：' + String(text).slice(0, 2800) }
    ];
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base: settings.aiBase, key: settings.aiKey, model: settings.aiModel, messages })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const c = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '';
    const points = c.split(/\n+/).map(s => s.replace(/^[\s\d\-\.、•*]+/, '').trim()).filter(s => s.length > 4).slice(0, 4);
    if (!points.length) throw new Error('模型返回为空');
    return { points, mode: 'cloud' };
  }

  async function makeSummary(it, text) {
    if (settings.aiKey && settings.aiBase && window.__PROXY__) {
      try { return await cloudSummary(it, text); } catch (e) { /* 静默回退本地 */ }
    }
    const r = C.summarize(text, { title: it.title, limit: 4 });
    return { points: r.points, chars: r.chars, mode: 'local' };
  }

  function aiCardHTML(data, busy) {
    if (busy) {
      return `<div class="ai-card" id="aiCard"><div class="ai-head"><span class="ai-mark">AI</span><b>AI 总结</b><span class="ai-src">生成中…</span></div>
        <div class="loading-body" style="padding:12px 0 0"><i></i><i></i><i></i></div></div>`;
    }
    const points = (data && data.points) || [];
    const tag = data && data.mode === 'cloud' ? settings.aiModel + ' · 云端生成' : '本地智能生成 · 无需联网';
    return `<div class="ai-card" id="aiCard">
      <div class="ai-head"><span class="ai-mark">AI</span><b>AI 总结</b><span class="ai-src">${esc(tag)}</span>
        <button class="icon-btn" data-act="aiClose" title="收起">${I.close}</button></div>
      ${points.length ? `<ul class="ai-points">${points.map((p, i) => `<li><span>${i + 1}</span><p>${esc(p)}</p></li>`).join('')}</ul>`
        : '<p class="ai-none">内容过短，暂无可提炼的要点。</p>'}
      <div class="ai-foot">以上为自动生成的摘要，仅供参考，完整内容请以原文为准。</div>
    </div>`;
  }

  function showAiCard(html) {
    const art = $('#article');
    if (!art) return;
    let box = $('#aiCard');
    if (!box) {
      box = document.createElement('div');
      const body = $('#aBody');
      if (body && body.parentNode === art) art.insertBefore(box, body);
      else art.appendChild(box);
    }
    box.outerHTML = html;
  }

  async function ensureSummary(force) {
    const it = state.current;
    if (!it) return;
    const text = (state.bodyText || it.summary || '').trim();
    if (!text) return;
    const cached = state.aiCache.get(it.id);
    if (cached && !force) { showAiCard(aiCardHTML(cached, false)); return; }
    if (state.aiBusy) return;
    state.aiBusy = true;
    showAiCard(aiCardHTML(null, true));
    try {
      const data = await makeSummary(it, text);
      state.aiCache.set(it.id, data);
      if (state.current && state.current.id === it.id) showAiCard(aiCardHTML(data, false));
    } catch (e) {
      const data = { points: C.summarize(text, { title: it.title }).points, mode: 'local' };
      state.aiCache.set(it.id, data);
      if (state.current && state.current.id === it.id) showAiCard(aiCardHTML(data, false));
    } finally { state.aiBusy = false; }
  }

  /* ---------------- 朗读 ---------------- */
  function speak(text) {
    if (!text) return;
    stopSpeak();
    if (window.AndroidBridge && window.AndroidBridge.speak) {
      try { window.AndroidBridge.setRate(settings.rate); } catch (e) { }
      window.AndroidBridge.speak(text);
      state.speaking = true; updateSpeakBar(); return;
    }
    if (!('speechSynthesis' in window)) { toast('当前环境不支持朗读'); return; }
    const u = new SpeechSynthesisUtterance(text.slice(0, 5000));
    u.lang = 'zh-CN'; u.rate = settings.rate;
    const v = speechSynthesis.getVoices().find(x => /zh|cmn/i.test(x.lang));
    if (v) u.voice = v;
    u.onend = () => { state.speaking = false; updateSpeakBar(); };
    u.onerror = () => { state.speaking = false; updateSpeakBar(); };
    speechSynthesis.speak(u);
    state.speaking = true; updateSpeakBar();
  }
  function stopSpeak() {
    state.speaking = false;
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { }
    try { if (window.AndroidBridge && window.AndroidBridge.stopSpeak) window.AndroidBridge.stopSpeak(); } catch (e) { }
    updateSpeakBar();
  }
  function updateSpeakBar() {
    const bar = $('#speakBar');
    if (!bar) return;
    bar.classList.toggle('on', state.speaking);
    const btn = $('#speakBtn');
    if (btn) btn.innerHTML = state.speaking ? I.stop : I.speak;
    if (btn) btn.classList.toggle('on', state.speaking);
  }

  /* ---------------- 侧栏 ---------------- */
  const VIEWS = [
    { v: 'feed', name: '信息流', icon: 'feed' },
    { v: 'hot', name: '全网热榜', icon: 'hot' },
    { v: 'flash', name: '7×24 快讯', icon: 'flash' },
    { v: 'insight', name: '数据洞察', icon: 'insight' }
  ];
  const MINE = [
    { v: 'saved', name: '我的收藏', icon: 'star' },
    { v: 'later', name: '稍后读', icon: 'later' },
    { v: 'focus', name: '关注话题', icon: 'focus' }
  ];
  function renderSidebar() {
    // 计数跟随当前时间范围，避免出现「侧栏 40 条、主列表 0 条」的矛盾
    const scoped = baseItems();
    const counts = {};
    C.CATS.forEach(c => counts[c] = 0);
    scoped.forEach(i => { counts[i.cat] = (counts[i.cat] || 0) + 1; counts['全部'] = (counts['全部'] || 0) + 1; });
    const srcCount = {};
    scoped.forEach(i => { srcCount[i.source] = (srcCount[i.source] || 0) + 1; });
    const topSrc = Object.entries(srcCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const item = (o, on, n) => `<button class="side-item ${on ? 'on' : ''}" data-act="view" data-v="${esc(o.v)}">${I[o.icon]}<span class="txt">${esc(o.name)}</span>${n != null && n !== '' ? `<span class="num">${n}</span>` : ''}</button>`;
    let html = '<div class="side-group"><div class="side-label">工作台</div>' +
      VIEWS.map(o => item(o, state.view === o.v, o.v === 'feed' ? scoped.length : (o.v === 'flash' ? state.flash.length : ''))).join('') + '</div>';
    html += '<div class="side-group"><div class="side-label">我的</div>' +
      MINE.map(o => item(o, state.view === o.v, o.v === 'saved' ? state.star.size : o.v === 'later' ? state.later.size : focusItems().length)).join('') + '</div>';
    html += '<div class="side-group"><div class="side-label">频道 <span>' + state.okSources + ' 源在线</span></div>' +
      C.CATS.map(c => `<button class="side-item ${state.view === 'feed' && state.cat === c && !state.sourceFilter ? 'on' : ''}" data-act="cat" data-v="${c}" style="--cat:var(${catVar(c)})"><span class="cdot"></span><span class="txt">${c}</span><span class="num">${counts[c] || ''}</span></button>`).join('') + '</div>';
    if (topSrc.length) {
      html += '<div class="side-group"><div class="side-label">常用来源</div>' +
        topSrc.map(([n, c]) => `<button class="side-item ${state.sourceFilter === n ? 'on' : ''}" data-act="src" data-v="${esc(n)}"><span class="txt">${esc(n)}</span><span class="num">${c}</span></button>`).join('') + '</div>';
    }
    html += `<div class="side-foot">文 v3.7.9 · 实时资讯工作台<br><b>${scoped.length}</b> 条内容 · 已保存近 30 日归档 ${state.archive.length} 条<br>更新于 ${state.lastUpdate ? fmtTime(state.lastUpdate) : '—'}</div>`;
    $('#sidebar').innerHTML = html;
  }

  /* ---------------- 图片有效性（有图/无图分类依据） ---------------- */
  const imageFailed = new Set();   // 加载失败或抓取失败的图片 URL
  function hasRealImage(it) {
    const u = it && it.image;
    return !!(u && /^https?:\/\//i.test(u) && !imageFailed.has(u));
  }

  /* ---------------- 媒体源选择 ---------------- */
  function isSourceOn(id) {
    const off = settings.disabledSources || [];
    return off.indexOf(id) < 0;
  }
  function toggleSource(id, on) {
    let off = (settings.disabledSources || []).slice();
    const i = off.indexOf(id);
    if (on) { if (i >= 0) off.splice(i, 1); }
    else { if (i < 0) off.push(id); }
    settings.disabledSources = off;
    saveSettings();
  }
  function enabledSources() {
    // 只保留被选中的内置源；自定义源沿用其自身 enabled 开关
    return C.allSources().filter(s => s.custom ? true : isSourceOn(s.id));
  }
  /* ---------------- 数据底座：30 日本地归档 ----------------
   * state.items 只放本次抓取结果；state.archive 是去重后持久化的近 30 日新闻，
   * 每次刷新都会累积，重启后仍在（v3.7.5 已关闭 WebView2 私有模式）。
   * 时间范围不再拿它做「过滤」，而是把这段时间的新闻置顶。 */
  const slimItem = i => ({ id: i.id, title: i.title, link: i.link, summary: i.summary,
    ts: i.ts, source: i.source, sourceId: i.sourceId, cat: i.cat, image: i.image });
  const ARCHIVE_DAYS = 30;
  const archiveCutoff = () => Date.now() - ARCHIVE_DAYS * 86400000;
  function mergeArchive(items) {
    const cut = archiveCutoff(), map = new Map();
    state.archive.forEach(i => { if (i.ts >= cut) map.set(i.id, i); });
    items.forEach(i => { if (i.ts >= cut) map.set(i.id, slimItem(i)); });
    state.archive = Array.from(map.values()).sort((a, b) => b.ts - a.ts).slice(0, 1500);
    store.set(K.archive, { ts: Date.now(), items: state.archive });
  }
  function findItem(id) {
    return state.items.find(i => i.id === id) || state.archive.find(i => i.id === id)
      || state.webResults.find(i => i.id === id) || null;
  }
  function rangeFrom() {
    if (state.range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
    if (state.range === '3d') return Date.now() - 3 * 86400000;
    if (state.range === '7d') return Date.now() - 7 * 86400000;
    return 0;
  }
  function baseItems() {
    // 本次抓取 + 30 日归档始终合并去重：归档里攒下来的近几日新闻不会因
    // 刷新换批就消失。时间范围只负责「置顶」，不再整体切换或裁剪数据源。
    const map = new Map();
    state.archive.forEach(i => map.set(i.id, i));
    state.items.forEach(i => map.set(i.id, i));   // 当前批次字段更全，优先
    return Array.from(map.values());
  }
  function filteredItems() {
    return baseItems().filter(i => !i.sourceId || isSourceOn(i.sourceId));
  }

  /* ---------------- 搜索：中文分词模糊匹配 ---------------- */
  function searchTerms(q) {
    const parts = q.toLowerCase()
      .replace(/[\s,，、。；;：:！!？?·\-—…"'（）《》【】()\[\]]+/g, ' ')
      .split(/\s+/).filter(Boolean);
    const set = new Set();
    parts.forEach(p => {
      set.add(p);
      // 整句热搜词拆成 2 字词，让长句也能命中相关报道
      if (/^[\u4e00-\u9fa5]{5,}$/.test(p)) {
        for (let i = 0; i + 2 <= p.length; i += 2) set.add(p.slice(i, i + 2));
      }
    });
    return Array.from(set);
  }
  function matchScore(it, q, terms) {
    const t = (it.title || '').toLowerCase(), s = (it.summary || '').toLowerCase();
    const src = (it.source || '').toLowerCase();
    if (t.indexOf(q) >= 0) return 100;
    let score = 0;
    terms.forEach(w => {
      if (t.indexOf(w) >= 0) score += 3;
      else if (s.indexOf(w) >= 0 || src.indexOf(w) >= 0) score += 1;
    });
    return score;
  }

  /* ---------------- 过滤（频道 → 来源 → 已读 → 有图 → 搜索；时间范围最后做置顶） ---------------- */
  function focusItems() { return state.items.filter(i => hits(i).length); }
  function visibleItems() {
    let list = filteredItems();
    if (state.cat !== '全部') list = list.filter(i => i.cat === state.cat);
    if (state.sourceFilter) list = list.filter(i => i.source === state.sourceFilter);
    if (settings.hideRead || settings.unreadOnly) list = list.filter(i => !state.read.has(i.id));
    if (settings.imagesOnly) list = list.filter(i => hasRealImage(i));
    const q = state.query.trim().toLowerCase();
    if (q) {
      const terms = searchTerms(q), need = q.length >= 8 ? 3 : 1, scored = [];
      list.forEach(i => {
        const sc = matchScore(i, q, terms);
        if (sc >= 100 || sc >= need) scored.push({ i, sc });
      });
      // 搜索按相关度优先，同分再按时间（搜索结果不被时间置顶打乱）
      return scored.sort((a, b) => b.sc - a.sc || b.i.ts - a.i.ts).map(x => x.i);
    }
    const sorted = list.sort((a, b) => settings.sort === 'old' ? a.ts - b.ts : b.ts - a.ts);
    const from = rangeFrom();
    if (!from) return sorted;
    // 时间范围 = 置顶：范围内的新闻排到最前，更早的仍保留在下面，不隐藏、不减少
    return sorted.filter(i => i.ts >= from).concat(sorted.filter(i => i.ts < from));
  }

  /* ---------------- 频道配色 ---------------- */
  const CAT_COLOR = {
    '全部': '--c-all', '要闻': '--c-top', '国内': '--c-cn', '国际': '--c-intl',
    '财经': '--c-fin', '科技': '--c-tech', '体育': '--c-sport', '娱乐': '--c-ent'
  };
  const catVar = c => CAT_COLOR[c] || '--c-all';

  let _relayoutTimer = null;
  function renderListKeepScroll(delay) {
    if (delay) {
      clearTimeout(_relayoutTimer);
      _relayoutTimer = setTimeout(() => renderListKeepScroll(0), delay);
      return;
    }
    const sc = $('.view-scroll');
    const top = sc ? sc.scrollTop : 0;
    renderList();
    if (sc) sc.scrollTop = top;
  }
  function fillMissingImages() {
    if (state.view !== 'feed') return;
    const targets = visibleItems().filter(i => !i.image && !state.imageTried.has(i.id)).slice(0, 18);
    if (!targets.length) return;
    targets.forEach(i => state.imageTried.add(i.id));
    const pool = targets.slice();
    let changed = false;
    async function worker() {
      while (pool.length) {
        const it = pool.shift();
        const url = await C.fetchArticleImage(it.link);
        if (!url || !/^https?:\/\//i.test(url)) continue;
        // 先确认图片真能打开；打不开就仍算「无图」，保留主题封面，不混进有图区
        const ok = await new Promise(res => {
          const im = new Image();
          let done = false;
          const fin = v => { if (!done) { done = true; res(v); } };
          im.onload = () => fin(true);
          im.onerror = () => fin(false);
          setTimeout(() => fin(false), 8000);
          im.src = url;
        });
        if (!ok) continue;
        const item = state.items.find(x => x.id === it.id);
        if (item && !item.image) { item.image = url; changed = true; }
      }
    }
    Promise.all(Array(4).fill(0).map(worker)).then(() => {
      if (changed && state.view === 'feed') renderListKeepScroll(0);
    });
  }

  /* ---------------- 央视直播轮播 ---------------- */
  function carouselItems() {
    // 固定为央视直播入口，不再随新闻 / 频道 / 搜索变化
    return C.LIVE_CHANNELS || [];
  }
  function renderCarousel() {
    const items = state.carouselItems;
    if (!items.length) return '';
    const slides = items.map((it, idx) => {
      const up = state.carouselIdx === idx;
      return `<div class="caro-slide ${up ? 'on' : ''}" data-idx="${idx}" data-act="live" data-v="${esc(it.url)}"
        style="--live-a:${esc(it.a)};--live-b:${esc(it.b)}" title="打开 ${esc(it.no)} ${esc(it.name)} 直播">
        <div class="caro-live-bg"><span class="caro-watermark">${esc(it.no)}</span>
          <span class="caro-live-badge"><i></i>直播中</span></div>
        <div class="caro-shade"></div>
        <div class="caro-cap">
          <span class="caro-tag" style="--cat:#e0323c">央视直播</span>
          <h3 class="caro-title">${esc(it.no)} · ${esc(it.name)}</h3>
          <div class="caro-meta"><span>${esc(it.desc)}</span><span>点击直接观看 ›</span></div>
        </div>
      </div>`;
    }).join('');
    const multi = items.length > 1;
    const dots = multi ? items.map((_, idx) => `<button class="caro-dot ${state.carouselIdx === idx ? 'on' : ''}" data-act="caroDot" data-v="${idx}" title="第 ${idx + 1} 个直播"></button>`).join('') : '';
    return `<section class="caro live-caro${multi ? '' : ' single'}" id="caro" aria-label="央视直播轮播">
      <div class="caro-stage">${slides}</div>
      ${multi ? `<button class="caro-arrow prev" data-act="caroPrev" title="上一个直播">${I.back}</button>
      <button class="caro-arrow next" data-act="caroNext" title="下一个直播">${I.chev}</button>` : ''}
      <div class="caro-label"><span class="caro-live"></span>央视直播 · LIVE</div>
      ${multi ? `<div class="caro-dots">${dots}</div>` : ''}
    </section>`;
  }
  function carGo(idx) {
    const n = state.carouselItems.length;
    if (!n) return;
    state.carouselIdx = ((idx % n) + n) % n;
    const stage = $('#caro .caro-stage');
    if (stage) $$('.caro-slide', stage).forEach((s, i) => s.classList.toggle('on', i === state.carouselIdx));
    $$('#caro .caro-dot').forEach((d, i) => d.classList.toggle('on', i === state.carouselIdx));
  }
  function canShowCarousel() {
    // 信息流的每个频道 / 来源视图都显示直播轮播；内容固定，不随筛选变化
    return state.view === 'feed';
  }
  function carStart() {
    carStop();
    if (!canShowCarousel() || state.carouselItems.length < 2) return;
    state.carouselTimer = setInterval(() => {
      const rl = $('#readerLayer');
      if (!state.carouselPaused && document.visibilityState !== 'hidden' && !(rl && rl.classList.contains('on'))) {
        carGo(state.carouselIdx + 1);
      }
    }, 5000);
  }
  function carStop() { if (state.carouselTimer) { clearInterval(state.carouselTimer); state.carouselTimer = null; } }
  function refreshCarousel() {
    // 条件不满足（切了频道/筛选/视图）时收起轮播，避免定时器空转
    if (!canShowCarousel()) {
      const old = $('#caro'); if (old) old.remove();
      state.carouselItems = []; carStop(); return;
    }
    const items = carouselItems();
    state.carouselItems = items;
    if (state.carouselIdx >= items.length) state.carouselIdx = 0;
    const box = $('#caro');
    if (!items.length) { if (box) box.remove(); carStop(); return; }
    if (box) box.outerHTML = renderCarousel();   // 局部替换，不动新闻列表
    else {
      const main = $('.wb-main');
      if (main) main.insertAdjacentHTML('afterbegin', renderCarousel());
    }
    carStart();
  }

  /* ---------------- 大盘行情 ---------------- */
  function renderStockCard() {
    const list = state.stocks;
    const last = state.stockTs ? fmtTime(state.stockTs) : '—';
    return `<div class="wb-card stock-card" id="stockCard">
      <h4><span class="bar" style="background:var(--c-cn)"></span>大盘行情<span class="stock-live"><i></i>${esc(last)}</span></h4>
      <div class="stock-grid">${list.length ? list.map(s => {
        const up = s.pct >= 0;
        const flash = (Date.now() - (state.stockFlash[s.code] || 0)) < 1600 ? ' flash' : '';
        return `<div class="stock-item${flash}" data-act="stockOpen" data-v="${esc(s.url)}" title="查看行情">
          <div class="s-name">${esc(s.name)}<small>${esc(s.code)}</small></div>
          <div class="s-price ${up ? 'up' : 'down'}">${Number(s.price).toFixed(2)}</div>
          <div class="s-chg ${up ? 'up' : 'down'}">${up ? '+' : ''}${Number(s.change).toFixed(2)}　${up ? '+' : ''}${Number(s.pct).toFixed(2)}%</div>
        </div>`;
      }).join('') : `<div class="wx-empty" data-act="refreshStocks" style="cursor:pointer">${state.stockRetried ? '行情暂不可用 · 点击重试' : '行情加载中…'}</div>`}</div>
      <div class="stock-foot"><span>红涨绿跌 · 自动刷新 <b id="stockCd">${state.stockCountdown}</b>s</span><button class="stock-rf" data-act="refreshStocks" title="立即刷新">↻</button></div>
    </div>`;
  }
  async function refreshStocks() {
    if (state.stockLoading) return;
    state.stockLoading = true;
    const s = await C.fetchStocks();
    if (s.length) {
      // 与上一次比对，价格变化则闪烁提示
      s.forEach(x => {
        const prev = state.stockPrev[x.code];
        if (prev != null && Math.abs(prev - x.price) > 0.0001) state.stockFlash[x.code] = Date.now();
        state.stockPrev[x.code] = x.price;
      });
      state.stocks = s;
      state.stockTs = Date.now();
    }
    const box = $('#stockCard');
    if (box) box.outerHTML = renderStockCard();   // 局部替换，不闪屏
    if (!s.length && !state.stockRetried) {
      state.stockRetried = true;
      setTimeout(() => { state.stockLoading = false; refreshStocks(); }, 4000);
      return;
    }
    state.stockRetried = false;
    state.stockLoading = false;
    state.stockCountdown = 15;
  }

  /* ---------------- 天气与预警 ---------------- */
  function cityOptions() {
    const groups = {};
    C.CITIES.forEach(c => { (groups[c.region] || (groups[c.region] = [])).push(c); });
    return Object.keys(groups).map(g =>
      `<optgroup label="${esc(g)}">${groups[g].map(c => `<option value="${c.id}" ${settings.city === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`
    ).join('');
  }
  function quickCities() {
    const base = ['beijing', 'shanghai', 'guangzhou', 'hangzhou', 'chengdu'];
    if (base.indexOf(settings.city) < 0) base.unshift(settings.city);
    return base.map(id => C.CITIES.find(c => c.id === id)).filter(Boolean).slice(0, 6);
  }
  function renderWeatherCard() {
    const w = state.weather, a = state.alarms.slice(0, 6);
    return `<div class="wx-card" id="wxCard">
      <div class="wx-head"><span class="bar"></span><b>天气 · 预警</b><em class="wx-count">${C.CITIES.length} 城市</em>
        <div class="wx-city"><span>⌖</span><select id="wxCity" title="全部 ${C.CITIES.length} 个城市，按地区分组">${cityOptions()}</select></div></div>
      <div class="wx-main">
        <div class="wx-icon">${w ? w.icon : '🌡'}</div>
        <div class="wx-now"><div class="wx-temp">${w ? Math.round(w.temp) + '°' : '--'}</div>
          <div class="wx-desc">${w ? esc(w.city + ' · ' + w.desc) : '获取中…'}</div></div>
        <div class="wx-extra">${w ? `<span>体感 <b>${Math.round(w.feel)}°</b></span><span>湿度 <b>${w.humidity}%</b></span><span>风 <b>${Math.round(w.wind)}km/h</b></span><span>今日 <b>${Math.round(w.min)}~${Math.round(w.max)}°</b></span>` : '<span>数据获取中…</span>'}</div>
      </div>
      <div class="wx-quick">${quickCities().map(c => `<button class="wx-q ${settings.city === c.id ? 'on' : ''}" data-act="cityQuick" data-v="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="wx-alarms">${a.length
        ? a.map(x => `<div class="wx-alarm" data-act="wxAlarm" data-v="${esc(x.url)}" title="${esc(x.title)}"><span class="wx-level ${x.level}"></span><span class="tx">${esc(x.title)}</span><span class="tm">${esc(String(x.time).slice(11, 16))}</span></div>`).join('')
        : '<div class="wx-empty">暂无最新预警，或正在获取…</div>'}</div>
    </div>`;
  }
  async function refreshWeather() {
    const [w, a] = await Promise.all([C.fetchWeather(settings.city), C.fetchAlarms()]);
    state.weather = w; state.alarms = a;
    const box = $('#wxCard');
    if (box) box.outerHTML = renderWeatherCard();   // 只替换天气卡，不打断滚动与轮播
  }

  /* ---------------- 信息流：全宽工作台 ---------------- */
  function renderFeed() {
    const showCaro = canShowCarousel();
    if (showCaro) {
      state.carouselItems = carouselItems();
      if (state.carouselIdx >= state.carouselItems.length) state.carouselIdx = 0;
    } else state.carouselItems = [];
    return `<div class="view workbench"><div class="view-scroll">
      <div class="wb-grid">
        <div class="wb-main">
          ${renderCarousel()}
          <div class="wb-head" style="--cat:var(${catVar(state.cat)})">
            <div class="wb-title"><span class="pip"></span>${esc(state.sourceFilter || state.cat)}</div>
            <div class="wb-count" id="feedCount">0 条</div>
            <div class="spacer"></div>
            <button class="mini-icon" data-act="refresh" title="刷新"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg></button>
            <button class="mini-icon ${settings.sort === 'old' ? 'on' : ''}" data-act="filter" data-v="sort" title="排序">${I.sort}</button>
            <button class="mini-icon ${settings.density === 'compact' ? 'on' : ''}" data-act="filter" data-v="density" title="列表密度">${I.density}</button>
          </div>
          <div class="wb-filters">
            <div class="seg range-seg" title="把该时间段的新闻置顶 · 本地归档自动保留近 30 天">${RANGES.map(r => `<button class="${state.range === r.id ? 'on' : ''}" data-act="range" data-v="${r.id}">${r.label}</button>`).join('')}</div>
            <span class="range-note" id="rangeNote"></span>
            <span class="filter-sep"></span>
            <button class="chip ${settings.unreadOnly ? 'on' : ''}" data-act="filter" data-v="unread">未读</button>
            <button class="chip ${settings.imagesOnly ? 'on' : ''}" data-act="filter" data-v="images">${I.image} 有图</button>
            <button class="chip ${settings.hideRead ? 'on' : ''}" data-act="filter" data-v="hideread">隐藏已读</button>
            ${state.sourceFilter ? `<button class="chip on" data-act="src" data-v="">清除来源 ×</button>` : ''}
            ${state.query ? `<button class="chip" data-act="websearch">${esc(state.query)} · 网页搜索 ${I.ext}</button>` : ''}
            <span class="web-status" id="webStatus"></span>
          </div>
          <div class="newbar" id="newbar" data-act="newbar"><b id="newbarText">有新内容</b><span>点击查看</span></div>
          <div class="news-grid ${settings.density === 'compact' ? 'compact' : ''}" id="list"></div>
          <button class="load-more" id="loadMore" data-act="loadMore">加载更多</button>
        </div>
        ${renderAside()}
      </div>
    </div></div>`;
  }

  function renderAside() {
    const board = C.BOARDS.find(b => b.id === state.boardTab) || C.BOARDS[0];
    const hot = (state.boards[board.id] || []).slice(0, 7);
    const flash = state.flash.slice(0, 5);
    const words = hotWordsCached(state.items, 12);
    const srcs = {};
    state.items.forEach(i => srcs[i.source] = (srcs[i.source] || 0) + 1);
    const top = Object.entries(srcs).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = Math.max(1, ...top.map(x => x[1]));
    const colors = ['--c-top', '--c-cn', '--c-intl', '--c-fin', '--c-tech', '--c-sport'];
    return `<aside class="wb-side">
      ${renderWeatherCard()}
      <div class="wb-card"><h4><span class="bar"></span>实时热榜<span>${board.name}</span></h4>
        <div class="seg" style="margin:9px 12px 4px">${C.BOARDS.map(b => `<button class="${state.boardTab === b.id ? 'on' : ''}" data-act="board" data-v="${b.id}" style="flex:1;padding:4px 6px;font-size:10px">${b.name.replace('热搜', '').replace('热榜', '')}</button>`).join('')}</div>
        ${hot.map((x, i) => `<div class="wb-mini" data-act="hotword" data-v="${esc(x.title)}"><span class="rk r${i + 1}">${i + 1}</span><span class="tx"><b>${hl(x.title)}</b><small>${esc(x.hot ? '热度 ' + x.hot : board.name)}</small></span></div>`).join('') || '<div class="wb-mini"><span class="tx"><b style="color:var(--ink-3)">热榜加载中…</b></small></span></div>'}
      </div>
      ${renderStockCard()}
      <div class="wb-card"><h4><span class="bar" style="background:var(--c-fin)"></span>今日热词<span>点击检索</span></h4>
        <div class="wb-pills">${words.map(w => `<button class="wb-pill" data-act="hotword" data-v="${esc(w.word)}">${esc(w.word)}<b>${w.count}</b></button>`).join('')}</div>
      </div>
      <div class="wb-card"><h4><span class="bar" style="background:var(--c-intl)"></span>来源分布<span>Top 6</span></h4>
        <div class="src-bars">${top.map(([n, v], i) => `<div class="sb"><span class="n" title="${esc(n)}">${esc(n)}</span><span class="t"><span class="f" style="width:${Math.max(5, v / max * 100)}%;background:var(${colors[i]})"></span></span><span class="v">${v}</span></div>`).join('')}</div>
      </div>
    </aside>`;
  }

  function cardHTML(it, hero) {
    const on = state.current && state.current.id === it.id;
    const hit = hits(it);
    const badge = state.newIds.has(it.id) ? '<span class="n-badge">NEW</span>'
      : hit.length ? `<span class="n-badge">${esc(hit[0])}</span>` : '';
    const star = state.star.has(it.id), later = state.later.has(it.id);
    const actions = `<div class="n-foot">
        <button class="c-act ${star ? 'on' : ''}" data-act="star" data-id="${it.id}" title="收藏">${I.star}</button>
        <button class="c-act ${later ? 'on' : ''}" data-act="later" data-id="${it.id}" title="稍后读">${I.later}</button>
        <button class="c-act" data-act="copy" data-id="${it.id}" title="复制链接">${I.copy}</button>
        <span style="margin-left:auto;font-size:10px;color:var(--ink-3)">阅读 ›</span>
      </div>`;
    const meta = `<div class="n-meta"><span class="n-cat">${esc(it.cat)}</span><span class="n-src" data-act="src" data-v="${esc(it.source)}">${esc(it.source)}</span><span class="n-time">${fmtTime(it.ts)}</span>${badge}</div>`;
    const hasImg = hasRealImage(it);
    return `<article class="card ${hero ? 'hero' : ''} ${hasImg ? '' : 'no-img'} ${state.read.has(it.id) ? 'read' : ''} ${on ? 'on' : ''}" style="--cat:var(${catVar(it.cat)})" data-act="open" data-id="${it.id}">
      ${hasImg ? `<div class="n-img"><img src="${esc(it.image)}" loading="lazy" alt=""></div>` : ''}
      <div class="n-body">${meta}<h3 class="n-title">${hl(it.title)}</h3>
        ${it.summary ? `<p class="n-sum">${hl(it.summary.slice(0, 130))}</p>` : ''}
        ${actions}
      </div>
    </article>`;
  }

  function bindImgErrors() {
    $$('#list img').forEach(img => img.addEventListener('error', () => {
      const url = img.getAttribute('src');
      if (url && !imageFailed.has(url)) { imageFailed.add(url); renderListKeepScroll(120); }
      else { const p = img.closest('.n-img'); if (p) p.style.display = 'none'; }
    }));
  }
  function updateWebStatus() {
    const el = $('#webStatus');
    if (!el) return;
    const q = state.query.trim();
    el.className = q ? 'web-status on' : 'web-status';
    el.textContent = !q ? '' : state.webSearching ? '联网搜索中…'
      : state.webResults.length ? '联网补充 ' + Math.min(state.webResults.length, 8) + ' 条'
        : '联网无结果';
  }
  function renderList() {
    const box = $('#list');
    if (!box) return;
    const q = state.query.trim(), searching = !!q;
    // 常规浏览只显示有真实图片的新闻；搜索时放开纯文字卡，避免漏掉无图报道
    const list = searching ? visibleItems() : visibleItems().filter(i => hasRealImage(i));
    const web = searching ? state.webResults.slice(0, 8) : [];
    const cnt = $('#feedCount');
    if (cnt) cnt.textContent = list.length + web.length + ' 条';
    const more = $('#loadMore');
    box.className = 'news-grid' + (settings.density === 'compact' ? ' compact' : '');

    if (!list.length && !web.length) {
      if (more) more.style.display = 'none';
      const words = hotWordsCached(state.items, 9), rec = state.items.slice(0, 6);
      const hint = q
        ? (state.webSearching ? '本地暂无命中，正在联网搜索…' : '本地与联网都没有命中，换个关键词试试')
        : '点右上角刷新，或先看看今天的推荐';
      box.innerHTML = `
        <div class="no-result">
          <div class="nr-ill"><span>✦</span></div>
          <h3>${q ? '没有找到「' + esc(q) + '」' : '这里暂时空空的'}</h3>
          <p>${hint}</p>
          <div class="nr-actions">
            ${q ? '<button class="btn primary sm" data-act="clearSearch">清除搜索</button><button class="btn sm" data-act="websearch">在网页中搜索</button>'
              : '<button class="btn primary sm" data-act="refresh">刷新新闻</button>'}
          </div>
          ${words.length ? `<div class="nr-words"><span>热门话题</span>${words.map(w => `<button class="chip" data-act="hotword" data-v="${esc(w.word)}">${esc(w.word)}</button>`).join('')}</div>` : ''}
        </div>
        <div class="group-label" style="grid-column:1/-1">为你推荐</div>
        ${rec.map(it => cardHTML(it, false)).join('')}`;
      bindImgErrors();
      updateWebStatus();
      return;
    }

    const shown = list.slice(0, state.limit), remain = list.length - shown.length;
    if (more) {
      more.style.display = remain > 0 ? 'block' : 'none';
      more.textContent = `加载更多（还有 ${remain} 条）`;
    }
    const heroOK = !q && state.cat === '全部' && !state.sourceFilter && settings.density === 'comfort';
    // 时间范围置顶：更新筛选行提示，并在「置顶区 / 更早」分界处插入分组标签
    const from = searching ? 0 : rangeFrom();
    const topCount = from ? list.filter(i => i.ts >= from).length : 0;
    const label = (RANGES.find(r => r.id === state.range) || {}).label || '';
    const note = $('#rangeNote');
    if (note) {
      note.textContent = from ? (topCount ? `已置顶${label} ${topCount} 条` : `${label}暂无新闻，${list.length} 条照常显示`) : '';
      note.classList.toggle('on', !!from);
    }
    const splitAt = from ? shown.findIndex(i => i.ts < from) : -1;
    // 首屏常被置顶新闻占满，先给一个醒目分组标题，让「点了」立刻可见
    let html = from && topCount
      ? `<div class="group-label range-top" style="grid-column:1/-1">📌 ${esc(label)} · ${topCount} 条已置顶<span>更早的新闻仍在下方，一条不少</span></div>`
      : '';
    shown.forEach((it, idx) => {
      if (idx === splitAt && splitAt > 0) {
        html += `<div class="group-label range-split" style="grid-column:1/-1">更早的新闻 · ${list.length - splitAt} 条（仍在列表里）</div>`;
      }
      html += cardHTML(it, heroOK && idx === 0);
    });
    if (web.length) {
      html += `<div class="group-label" style="grid-column:1/-1">联网搜索 · ${web.length} 条</div>`
        + web.map(it => cardHTML(it, false)).join('');
    }
    box.innerHTML = html;
    bindImgErrors();
    updateWebStatus();
  }
  /* ---------------- 搜索入口：本地立即出结果，联网结果异步补上 ---------------- */
  function setQuery(v, skipRender) {
    state.query = String(v || '').trim();
    state.limit = 60;
    closeReader();
    clearTimeout(state.webTimer);
    state.webResults = [];
    state.webSearching = !!state.query;
    const q = state.query;
    if (q.length >= 2) state.webTimer = setTimeout(() => runWebSearch(q), 420);
    if (!skipRender) {
      if (state.view !== 'feed') { state.view = 'feed'; renderView(); }
      else { renderList(); renderSidebar(); refreshCarousel(); }
    }
  }
  async function runWebSearch(q) {
    const seq = ++state.webSeq;
    const res = await C.fetchWebSearch(q, 12);
    if (seq !== state.webSeq || q !== state.query) return;   // 丢弃过期请求
    state.webResults = res;
    state.webSearching = false;
    if (state.view === 'feed') renderList();
  }

  function renderSkeleton() {
    const box = $('#list');
    if (box) box.innerHTML = Array(9).fill('<div class="skel"><i></i><i></i><i></i></div>').join('');
  }

  /* ---------------- 阅读器 ---------------- */
  function renderReader(opts) {
    const box = $('#reader');
    if (!box) return;
    const it = state.current;
    if (!it) {
      box.innerHTML = `<div class="reader-bar"><button class="icon-btn mobile-back" data-act="back">${I.back}</button><div class="reader-crumb">文 · 阅读</div></div>
        <div class="reader-scroll"><div class="reader-empty"><div class="glyph">文</div><p>选择一条新闻开始阅读</p><div class="hint"><kbd>J</kbd> <kbd>K</kbd> 切换 · <kbd>/</kbd> 搜索 · <kbd>?</kbd> 快捷键</div></div></div>`;
      return;
    }
    const star = state.star.has(it.id), later = state.later.has(it.id);
    box.innerHTML = `
      <div class="reader-bar">
        <button class="icon-btn" data-act="closeReader" title="关闭阅读">${I.close}</button>
        <div class="divide"></div>
        <button class="icon-btn" data-act="font" data-v="-1" title="缩小字号">A−</button>
        <button class="icon-btn" data-act="font" data-v="1" title="放大字号">A+</button>
        <button class="icon-btn" data-act="speak" title="朗读" id="speakBtn">${I.speak}</button>
        <button class="icon-btn" data-act="ai" title="AI 总结" id="aiBtn"><b style="font-size:11px;letter-spacing:-.02em">AI</b></button>
        <div class="divide"></div>
        <button class="icon-btn star-btn ${star ? 'on' : ''}" data-act="star" data-id="${it.id}" title="收藏">${I.star}</button>
        <button class="icon-btn later-btn ${later ? 'on' : ''}" data-act="later" data-id="${it.id}" title="稍后读">${I.later}</button>
        <button class="icon-btn" data-act="copy" data-id="${it.id}" title="复制链接">${I.copy}</button>
        <button class="icon-btn" data-act="export" title="导出 Markdown">${I.down}</button>
        <button class="icon-btn" data-act="external" title="浏览器打开原文">${I.ext}</button>
        <div class="reader-crumb" style="flex:0 1 auto;margin-left:8px">${esc(it.source)}</div>
      </div>
      <div class="speak-bar ${state.speaking ? 'on' : ''}" id="speakBar">
        <div class="wave"><i></i><i></i><i></i><i></i></div>
        <span>正在朗读</span>
        <div class="spacer"></div>
        <span>语速</span><input type="range" id="rateRange" min="0.6" max="1.8" step="0.1" value="${settings.rate}">
        <button class="btn sm" data-act="speakStop">停止</button>
      </div>
      <div class="reader-scroll" id="readerScroll">
        <article class="article" id="article" style="max-width:${settings.width}px"></article>
      </div>`;
    // 正文解析失败不能连带把阅读浮层吞掉：先保证面板可见，再兜底展示摘要
    if (!opts || opts.article !== false) {
      try { openArticle(it); }
      catch (err) {
        const body = $('#aBody');
        if (body) body.innerHTML = '<div class="no-body"><span>✦</span><p>正文解析失败，可点下方按钮打开原文。</p></div>';
        state.bodyText = it.summary || '';
      }
    }
    updateSpeakBar();
  }

  function openArticle(it) {
    const seq = ++state.loadSeq;
    const art = $('#article');
    if (!art) return;
    const rs = $('#readerScroll'); if (rs) rs.scrollTop = 0;
    const related = state.items.filter(x => x.id !== it.id && (x.cat === it.cat || x.source === it.source)).slice(0, 6);
    const relHTML = related.length ? `<div class="a-related"><h3>相关阅读<span>同频道 / 同来源</span></h3>
      ${related.map(x => `<div class="rel-item" data-act="open" data-id="${x.id}" style="--cat:var(${catVar(x.cat)})"><span class="rd"></span><span class="rt">${hl(x.title)}</span><span class="rm">${fmtTime(x.ts)}</span></div>`).join('')}
    </div>` : '';
    art.innerHTML = `
      <div class="a-kicker"><span class="tag">${esc(it.cat)}</span><span>${esc(it.source)}</span></div>
      <h1 class="a-title">${hl(it.title)}</h1>
      <div class="a-byline"><b>${esc(it.source)}</b><span>·</span><span>${fmtAbs(it.ts)}</span>${it.sources && it.sources.length > 1 ? `<span>·</span><span>${it.sources.length} 家媒体同步</span>` : ''}</div>
      <div class="a-body ${settings.font === 'serif' ? 'serif' : ''}" id="aBody"><div class="loading-body"><i></i><i></i><i></i><i></i></div></div>
      <div id="bodyNote"></div>
      <div class="a-foot">
        <button class="btn primary" data-act="external">${I.ext} 浏览器打开原文</button>
        <button class="btn ai-btn" data-act="ai">✦ AI 总结</button>
        <button class="btn" data-act="copy" data-id="${it.id}">复制链接</button>
        <button class="btn" data-act="export">导出 Markdown</button>
        <button class="btn" data-act="speak">朗读全文</button>
      </div>
      <p class="a-note">内容来自 ${esc(it.source)}，版权归原作者及原媒体所有。文仅做聚合阅读，正文可能有删减。</p>
      ${relHTML}`;
    applyArticleStyle();

    const fill = (html, note, doSummary) => {
      if (seq !== state.loadSeq) return;
      const body = $('#aBody'); if (!body) return;
      body.innerHTML = html || '<div class="no-body"><span>✦</span><p>这篇报道的正文暂时抓不到，已为你生成 AI 总结，也可以点下方按钮打开原文。</p></div>';
      const noteBox = $('#bodyNote');
      if (noteBox) noteBox.innerHTML = note ? `<div class="fetch-note">${esc(note)}</div>` : '';
      body.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', () => { img.style.display = 'none'; });
        img.addEventListener('click', () => showLightbox(img.src));
      });
      state.bodyHtml = html || '';
      state.bodyText = html ? (body.textContent || '').replace(/\s+/g, ' ').trim() : (it.summary || '');
      applyArticleStyle();
      if (doSummary) ensureSummary();
    };

    const full = it.descHtml && C.stripTags(it.descHtml).length > 260;
    if (full) {
      const r = C.extractArticle(it.descHtml, it.link);
      fill(r.ok && r.chars > 60 ? r.contentHtml : it.descHtml, '', settings.aiAuto);
      return;
    }
    // 摘要兜底：优先用 RSS 自带正文，其次纯文本摘要
    let fallback = '';
    if (it.descHtml && C.stripTags(it.descHtml).length > 12) {
      const rf = C.extractArticle(it.descHtml, it.link);
      fallback = rf.chars > 12 ? rf.contentHtml : '<p>' + hl(C.stripTags(it.descHtml)) + '</p>';
    } else if (it.summary) {
      fallback = '<p>' + hl(it.summary) + '</p>';
    }
    if (fallback) fill(fallback, '正在读取原文正文…', false);
    C.httpText(it.link, 15000).then(html => {
      const r = C.extractArticle(html, it.link);
      // 只有合格的正文才覆盖摘要；抓到登录墙/整站导航页时保留干净的 RSS 摘要
      if (r.ok && r.chars > 120) fill(r.contentHtml, '', settings.aiAuto);
      else fill(fallback, '原站返回导航/登录页，已展示可用摘要', true);
    }).catch(() => {
      fill(fallback, '网络读取失败，已展示可用摘要', true);
    });
  }
  function applyArticleStyle() {
    const b = $('#aBody');
    if (!b) return;
    b.style.fontSize = settings.fs + 'px';
    b.style.lineHeight = settings.lh;
    b.classList.toggle('serif', settings.font === 'serif');
    const art = $('#article'); if (art) art.style.maxWidth = settings.width + 'px';
  }
  function showLightbox(src) {
    if (!src) return;
    $('#lightboxImg').src = src;
    $('#lightbox').classList.add('on');
  }

  function selectItem(id, opts) {
    const it = findItem(id);
    if (!it) return;
    state.current = it;
    state.read.add(it.id); persist();
    if (state.view !== 'feed') { state.view = 'feed'; renderAll(); }
    $$('#list .card').forEach(el => {
      const on = el.dataset.id === id;
      el.classList.toggle('on', on);
      if (on) el.classList.add('read');
    });
    $('#readerLayer').classList.add('on');
    renderReader();
    if (opts && opts.scroll !== false) {
      const el = $('#list .card[data-id="' + id + '"]');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  function persist() {
    store.set(K.read, Array.from(state.read).slice(-2000));
    store.set(K.star, Array.from(state.star));
    store.set(K.later, Array.from(state.later));
  }
  function toggleSet(set, id, label) {
    const has = set.has(id);
    has ? set.delete(id) : set.add(id);
    persist();
    toast(has ? '已取消' + label : '已加入' + label);
    renderSidebar();
    if (state.view === 'feed') {
      renderList();
      $$('.reader-bar [data-act="star"]').forEach(b => b.classList.toggle('on', state.star.has(id)));
      $$('.reader-bar [data-act="later"]').forEach(b => b.classList.toggle('on', state.later.has(id)));
    } else renderView();
  }

  /* ---------------- 热榜 ---------------- */
  function renderHot() {
    const active = state.boardTab;
    const head = `<div class="view-head"><div><div class="view-title">全网热榜</div><div class="view-sub">三平台实时热榜并列对照 · 点击任意热词在本站检索相关报道</div></div><div class="spacer"></div>
      <div class="seg">${C.BOARDS.map(b => `<button class="${active === b.id ? 'on' : ''}" data-act="board" data-v="${b.id}">${b.name}</button>`).join('')}</div>
      <button class="btn sm" data-act="refreshBoards">刷新热榜</button></div>`;
    const boards = C.BOARDS.slice().sort((a, b) => (a.id === active ? -1 : b.id === active ? 1 : 0));
    const cols = boards.map(b => {
      const list = state.boards[b.id] || [];
      const rows = list.length ? list.slice(0, 18).map(x => `
        <div class="hot-row" data-act="hotword" data-v="${esc(x.title)}">
          <div class="hot-rank r${x.rank}">${x.rank}</div>
          <div class="hot-txt"><b>${hl(x.title)}</b><small>${esc(x.desc || (x.hot ? '热度 ' + x.hot : b.name))}</small></div>
          <span class="hot-go">${I.chev}</span>
        </div>`).join('') : '<div class="empty" style="padding:36px 12px">加载中或暂不可用</div>';
      return `<div class="board"><div class="board-head"><span class="bar"></span><b>${b.name}</b><span>${list.length} 条 · 实时</span></div>${rows}</div>`;
    }).join('');
    const words = hotWordsCached(state.items, 20);
    return `<div class="view"><div class="view-scroll">${head}
      <div class="hot-grid three">${cols}</div>
      <div class="hot-wide"><div class="panel"><h3>今日热词 <span>来自 ${state.items.length} 条新闻标题 · 点击检索</span></h3>
        <div class="word-cloud">${words.map(w => `<button class="word" data-act="hotword" data-v="${esc(w.word)}">${esc(w.word)}<b>${w.count}</b></button>`).join('') || '<span style="color:var(--ink-3);font-size:12px">统计中…</span>'}</div>
      </div></div>
    </div></div>`;
  }

  /* ---------------- 快讯 ---------------- */
  function renderFlash() {
    const list = state.flash.slice();
    let html = '', day = '';
    list.forEach((f, i) => {
      const d = dayLabel(f.ts);
      if (d !== day) { html += `<div class="flash-day">${d} · ${new Date(f.ts).toLocaleDateString('zh-CN')}</div>`; day = d; }
      const d2 = new Date(f.ts);
      html += `<div class="flash-item ${i < 3 ? 'hot' : ''}"><div class="flash-time">${pad(d2.getHours())}:${pad(d2.getMinutes())}</div>
        <div class="flash-line"><i></i></div>
        <div class="flash-card"><b>${hl(f.title)}</b>${f.body ? `<p>${hl(f.body)}</p>` : ''}
          <div class="flash-foot"><span>${esc(f.source)}</span><span>·</span><span>${fmtTime(f.ts)}</span>
            <a class="f-link" data-act="externalUrl" data-v="${esc(f.link)}">打开原文 ${I.ext}</a></div>
        </div></div>`;
    });
    return `<div class="view"><div class="view-head"><div><div class="view-title">7×24 快讯</div><div class="view-sub">华尔街见闻全球 / A股实时电报 · 每 30 秒自动刷新</div></div><div class="spacer"></div><button class="btn sm" data-act="refreshFlash">刷新快讯</button></div>
      <div class="view-scroll"><div class="flash-wrap">${html || '<div class="empty">快讯加载中…</div>'}</div></div></div>`;
  }

  /* ---------------- 数据洞察 ---------------- */
  function renderInsight() {
    const items = state.items;
    const today = new Date().toDateString();
    const todayN = items.filter(i => new Date(i.ts).toDateString() === today).length;
    const withImg = items.filter(i => i.image).length;
    const cats = {}; items.forEach(i => cats[i.cat] = (cats[i.cat] || 0) + 1);
    const srcs = {}; items.forEach(i => srcs[i.source] = (srcs[i.source] || 0) + 1);
    const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const srcRows = Object.entries(srcs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxCat = Math.max(1, ...catRows.map(x => x[1]));
    const maxSrc = Math.max(1, ...srcRows.map(x => x[1]));
    const buckets = Array(24).fill(0);
    const nowH = Date.now() - 24 * 3600000;
    items.forEach(i => { if (i.ts >= nowH) { const h = Math.min(23, Math.floor((i.ts - nowH) / 3600000)); buckets[h]++; } });
    const maxB = Math.max(1, ...buckets);
    const words = hotWordsCached(items, 24);
    const stat = (label, val, sub) => `<div class="stat"><small>${label}</small><b>${val}</b><em>${sub}</em></div>`;
    const bars = (rows, max) => rows.map(([n, v]) => `<div class="bar-row"><span class="n">${esc(n)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, v / max * 100)}%"></div></div><span class="v">${v}</span></div>`).join('');
    return `<div class="view"><div class="view-scroll">
      <div class="view-head"><div><div class="view-title">数据洞察</div><div class="view-sub">基于当前抓取内容的实时统计 · 每次刷新自动重算</div></div><div class="spacer"></div><button class="btn sm" data-act="exportAll">导出 CSV</button></div>
      <div class="insight">
        <div class="stat-grid">
          ${stat('内容总量', items.length, '去重后条目')}
          ${stat('今日新增', todayN, '今天发布')}
          ${stat('在线信源', state.okSources + '/' + C.allSources().length, '全部尝试源')}
          ${stat('含图报道', withImg, '占比 ' + (items.length ? Math.round(withImg / items.length * 100) : 0) + '%')}
        </div>
        <div class="panel-grid">
          <div class="panel"><h3>频道分布 <span>按条目数</span></h3>${bars(catRows, maxCat)}</div>
          <div class="panel srcs"><h3>来源 Top 10 <span>按条目数</span></h3>${bars(srcRows, maxSrc)}</div>
          <div class="panel"><h3>近 24 小时更新节奏 <span>条形高度 = 条目数</span></h3>
            <div class="hist">${buckets.map((v, i) => `<div class="col" title="${i} 小时前：${v} 条"><i style="height:${Math.max(2, v / maxB * 88)}%"></i><small>${i === 0 ? '-24h' : (i % 6 === 0 ? '-' + (24 - i) + 'h' : '')}</small></div>`).join('')}</div>
          </div>
          <div class="panel"><h3>今日热词 <span>点击检索</span></h3><div class="word-cloud">${words.map(w => `<button class="word" data-act="hotword" data-v="${esc(w.word)}">${esc(w.word)}<b>${w.count}</b></button>`).join('')}</div></div>
        </div>
      </div></div></div>`;
  }

  /* ---------------- 收藏 / 稍后读 / 关注 ---------------- */
  function renderSaved(which) {
    const set = which === 'saved' ? state.star : state.later;
    const list = state.items.filter(i => set.has(i.id)).sort((a, b) => b.ts - a.ts);
    const title = which === 'saved' ? '我的收藏' : '稍后读';
    const cards = list.map(it => `<div class="save-card" data-act="open" data-id="${it.id}">
        ${it.image ? `<img class="s-img" src="${esc(it.image)}" loading="lazy">` : ''}
        <div class="s-meta"><b>${esc(it.source)}</b><span>·</span><span>${fmtTime(it.ts)}</span></div>
        <div class="s-title">${hl(it.title)}</div>
        <div class="s-foot"><button class="btn sm" data-act="star" data-id="${it.id}">${state.star.has(it.id) ? '取消收藏' : '收藏'}</button>
          <button class="btn sm" data-act="later" data-id="${it.id}">${state.later.has(it.id) ? '移出稍后读' : '稍后读'}</button>
          <button class="btn sm" data-act="externalUrl" data-v="${esc(it.link)}">原文</button></div>
      </div>`).join('');
    return `<div class="view"><div class="view-head"><div><div class="view-title">${title}</div><div class="view-sub">${list.length} 条已保存内容 · 仅存于本机</div></div></div>
      <div class="view-scroll"><div class="card-grid">${cards || `<div class="empty"><div class="big">☆</div>还没有内容<br>在信息流里点 ☆ 或时钟图标即可加入</div>`}</div></div></div>`;
  }
  function renderFocus() {
    const list = focusItems();
    const words = settings.keywords.length ? settings.keywords : [];
    return `<div class="view"><div class="view-head"><div><div class="view-title">关注话题</div><div class="view-sub">在设置中添加关键词，命中的报道会自动汇集到这里</div></div><div class="spacer"></div><button class="btn sm" data-act="settings">管理关键词</button></div>
      <div class="view-scroll"><div style="padding:0 30px 14px;display:flex;gap:8px;flex-wrap:wrap">${words.map(w => `<button class="chip on" data-act="hotword" data-v="${esc(w)}">${esc(w)}</button>`).join('') || '<span style="font-size:12px;color:var(--ink-3)">尚未设置关注词</span>'}</div>
      <div class="card-grid">${list.map(it => `<div class="save-card" data-act="open" data-id="${it.id}">
        ${it.image ? `<img class="s-img" src="${esc(it.image)}" loading="lazy">` : ''}
        <div class="s-meta"><b>${esc(it.source)}</b><span>·</span><span>${fmtTime(it.ts)}</span></div>
        <div class="s-title">${hl(it.title)}</div>
        <div class="s-foot"><span class="chip on">${esc(hits(it)[0] || '')}</span></div></div>`).join('') || '<div class="empty">暂无命中内容</div>'}</div></div></div>`;
  }

  /* ---------------- 视图总渲染 ---------------- */
  function renderView() {
    const main = $('#main');
    let html;
    switch (state.view) {
      case 'hot': html = renderHot(); break;
      case 'flash': html = renderFlash(); break;
      case 'insight': html = renderInsight(); break;
      case 'saved': html = renderSaved('saved'); break;
      case 'later': html = renderSaved('later'); break;
      case 'focus': html = renderFocus(); break;
      default: html = renderFeed();
    }
    main.innerHTML = html;
    $$('#main .flash-card > img, #main .s-img').forEach(img => {
      img.addEventListener('error', () => { img.style.display = 'none'; });
    });
    if (state.view === 'feed') {
      renderList();
      carStart();   // 轮播自动播放
      if (state.newIds.size) { $('#newbarText').textContent = state.newIds.size + ' 条新内容'; $('#newbar').classList.add('on'); }
    } else carStop();
  }
  function renderAll() { renderSidebar(); renderView(); }
  function closeReader() {
    const l = $('#readerLayer');
    if (l) l.classList.remove('on');
    stopSpeak();
  }

  /* ---------------- 设置抽屉 ---------------- */
  function renderSettings() {
    const d = $('#drawer');
    const opt = (val, cur, label) => `<option value="${val}" ${String(cur) === String(val) ? 'selected' : ''}>${label}</option>`;
    d.innerHTML = `<div class="drawer-head"><b>设置</b><button class="icon-btn" data-act="closeDrawer">${I.close}</button></div>
      <div class="drawer-body">
        <div class="set-group"><h4>外观</h4>
          <div class="set-row"><div class="lbl">主题<small>浅色 / 护眼暖色 / 深色 / 跟随系统 / 定时夜间</small></div>
            <select data-set="theme">${opt('light', settings.theme, '浅色')}${opt('eye', settings.theme, '护眼 · 暖色低蓝光')}${opt('dark', settings.theme, '深色')}${opt('system', settings.theme, '跟随系统')}${opt('night', settings.theme, '定时夜间')}</select></div>
          <div class="set-row"><div class="lbl">列表密度</div><div class="seg"><button data-set="density" data-v="comfort" class="${settings.density === 'comfort' ? 'on' : ''}">舒适</button><button data-set="density" data-v="compact" class="${settings.density === 'compact' ? 'on' : ''}">紧凑</button></div></div>
          <div class="set-row"><div class="lbl">窗口置顶<small>仅桌面版生效</small></div><button class="switch ${settings.pin ? 'on' : ''}" data-set="pin"></button></div>
        </div>
        <div class="set-group"><h4>更新</h4>
          <div class="set-row"><div class="lbl">自动刷新</div><button class="switch ${settings.auto ? 'on' : ''}" data-set="auto"></button></div>
          <div class="set-row"><div class="lbl">刷新间隔</div><select data-set="interval">${[30, 60, 90, 180, 300].map(v => opt(v, settings.interval, v + ' 秒')).join('')}</select></div>
          <div class="set-row"><div class="lbl">快讯自动刷新<small>每 30 秒</small></div><button class="switch ${settings.flashAuto ? 'on' : ''}" data-set="flashAuto"></button></div>
          <div class="set-row"><div class="lbl">隐藏已读</div><button class="switch ${settings.hideRead ? 'on' : ''}" data-set="hideRead"></button></div>
          <div class="set-row"><div class="lbl">关键词高亮</div><button class="switch ${settings.highlight ? 'on' : ''}" data-set="highlight"></button></div>
        </div>
        <div class="set-group"><h4>阅读排版</h4>
          <div class="set-row"><div class="lbl">正文字体</div><select data-set="font">${opt('sans', settings.font, '无衬线')}${opt('serif', settings.font, '衬线')}</select></div>
          <div class="set-row"><div class="lbl">字号</div><input type="number" data-set="fs" min="13" max="24" step="0.5" value="${settings.fs}" style="width:80px"></div>
          <div class="set-row"><div class="lbl">行距</div><select data-set="lh">${opt(1.6, settings.lh, '紧凑')}${opt(1.9, settings.lh, '标准')}${opt(2.2, settings.lh, '宽松')}</select></div>
          <div class="set-row"><div class="lbl">栏宽</div><input type="number" data-set="width" min="520" max="1000" step="20" value="${settings.width}" style="width:90px"></div>
          <div class="set-row"><div class="lbl">朗读语速</div><input type="number" data-set="rate" min="0.6" max="1.8" step="0.1" value="${settings.rate}" style="width:80px"></div>
        </div>
        <div class="set-group"><h4>关注关键词</h4>
          <input type="text" data-set="keywords" value="${esc((settings.keywords || []).join('，'))}" placeholder="例如：人工智能，央行，新能源" style="width:100%;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:12px;outline:none">
          <div class="set-hint">用逗号分隔。命中的新闻会显示角标并汇集到「关注话题」。</div>
        </div>
        <div class="set-group"><h4>选择要看的媒体</h4>
          <div class="set-hint" style="margin:0 0 10px">只抓取并展示勾选的媒体，取消勾选后不再出现。</div>
          <div class="media-pick">${C.SOURCES.map(s => `<label class="mp-item ${isSourceOn(s.id) ? 'on' : ''}">
            <input type="checkbox" data-mp="${esc(s.id)}" ${isSourceOn(s.id) ? 'checked' : ''}>
            <span class="mp-dot"></span><span class="mp-name">${esc(s.name)}</span><span class="mp-cat">${esc(s.cat)}</span></label>`).join('')}</div>
          <div class="mp-actions"><button class="btn sm" data-act="mpAll">全选</button><button class="btn sm" data-act="mpNone">全不选</button><span class="mp-count">已选 ${C.SOURCES.filter(s => isSourceOn(s.id)).length} / ${C.SOURCES.length}</span></div>
        </div>
        <div class="set-group"><h4>自定义新闻源 (RSS)</h4>
          <div id="customList">${(settings.customSources || []).map((s, i) => `<div class="custom-src"><span class="n"><b>${esc(s.name)}</b><small>${esc(s.url)}</small></span>
             <button class="btn sm" data-act="toggleSrc" data-i="${i}">${s.enabled === false ? '启用' : '停用'}</button>
             <button class="btn sm" data-act="delSrc" data-i="${i}">删除</button></div>`).join('') || '<div class="set-hint">暂无自定义源</div>'}</div>
          <div class="add-src"><input id="srcName" placeholder="名称（可选）" style="max-width:110px"><input id="srcUrl" placeholder="https://example.com/rss.xml"><select id="srcCat" style="background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:7px;font-size:11.5px">${C.CATS.slice(1).map(c => `<option>${c}</option>`).join('')}</select><button class="btn primary sm" data-act="addSrc">添加</button></div>
          <div class="set-hint">添加时会校验该地址能否解析出新闻条目。</div>
        </div>
        <div class="set-group"><h4>AI 总结</h4>
          <div class="set-row"><div class="lbl">自动生成摘要<small>打开新闻时自动生成，正文抓不到时必定生成</small></div><button class="switch ${settings.aiAuto ? 'on' : ''}" data-set="aiAuto"></button></div>
          <div class="set-row"><div class="lbl">接入大模型<small>选填，仅桌面版；留空则使用本地智能摘要</small></div></div>
          <div class="set-row"><div class="lbl">API 地址<small>OpenAI 兼容，如 https://api.deepseek.com/v1</small></div><input type="text" data-set="aiBase" value="${esc(settings.aiBase)}" placeholder="https://.../v1" style="width:100%;max-width:none"></div>
          <div class="set-row"><div class="lbl">API Key<small>仅保存在本机</small></div><input type="text" data-set="aiKey" value="${esc(settings.aiKey)}" placeholder="sk-..." style="width:100%;max-width:none"></div>
          <div class="set-row"><div class="lbl">模型</div><input type="text" data-set="aiModel" value="${esc(settings.aiModel)}" placeholder="gpt-4o-mini / deepseek-chat" style="width:100%;max-width:none"></div>
          <div class="set-hint">不填也能用：内置抽取式摘要会提炼要点，完全离线。填入后自动改用大模型，调用失败会静默回退本地摘要。安卓版始终使用本地摘要。</div>
        </div>
        <div class="set-group"><h4>关于</h4><div class="set-hint">文 v3.7.9 · ${C.SOURCES.length} 个内置信源 + ${(settings.customSources || []).filter(s => s.enabled !== false).length} 个自定义源<br>3 个实时热榜 · 2 路 7×24 快讯<br>内容版权归各原媒体所有，本应用仅做聚合阅读。</div></div>
      </div>`;
    d.classList.add('on');
    $('#mask').classList.add('on');
  }
  function closeDrawer() { $('#drawer').classList.remove('on'); $('#mask').classList.remove('on'); }

  function renderHelp() {
    const rows = [
      ['聚焦搜索', 'Ctrl K /'], ['切换新闻', 'J / K / ↑ / ↓'], ['打开新闻', 'Enter'],
      ['切换频道', '1 – 9'], ['刷新', 'R'], ['收藏 / 稍后读', 'S / L'],
      ['切换主题', 'T'], ['设置', ','], ['返回 / 关闭', 'Esc']
    ];
    $('#modal').innerHTML = `<div class="modal"><h3>键盘快捷键</h3>${rows.map(([a, b]) => `<div class="kb-row"><span>${a}</span><span class="keys">${b.split(' / ').map(k => `<kbd>${k}</kbd>`).join('')}</span></div>`).join('')}
      <div style="margin-top:18px;text-align:right"><button class="btn primary" data-act="closeModal">知道了</button></div></div>`;
    $('#modal').classList.add('on');
  }

  /* ---------------- 数据刷新 ---------------- */
  async function refresh(opts) {
    if (state.loading) return;
    state.loading = true;
    const silent = opts && opts.silent;
    if (!state.items.length && state.view === 'feed') renderSkeleton();
    $('#btnRefresh').classList.add('spin');
    const before = new Set(state.items.map(i => i.id));
    // 首次加载（还没有内容或仍显示骨架屏）允许整页渲染一次，之后只做增量更新
    const firstLoad = !state.items.length ||
      (state.view === 'feed' && !!$('#list') && !!$('#list').querySelector('.skel'));
    try {
      const res = await C.fetchAll(enabledSources());
      state.okSources = res.ok.length;
      state.lastUpdate = Date.now();
      const fresh = res.items.filter(i => !before.has(i.id));
      if (before.size) state.newIds = new Set(fresh.map(i => i.id));
      state.items = res.items;
      store.set(K.cache, { ts: state.lastUpdate, items: res.items.slice(0, 300) });
      mergeArchive(res.items);   // 累积 7 日历史，供搜索与时间范围筛选使用
      if (firstLoad) renderView();   // 首次：填充骨架屏与列表
      else renderSidebar();          // 之后：只更新计数
      // 增量更新：不重建主区域，避免自动刷新时闪屏与滚动位置丢失
      if (state.view === 'feed') {
        const nb = $('#newbar');
        if (before.size && fresh.length && nb) {
          $('#newbarText').textContent = fresh.length + ' 条新内容';
          nb.classList.add('on');
        }
        fillMissingImages();
        refreshCarousel();   // 轮播跟随新闻更新
      }
      if (before.size && fresh.length) toast(`已更新 ${fresh.length} 条新内容`);
      else if (!silent) toast(`已更新 ${res.items.length} 条 · ${res.ok.length} 个源在线`);
    } catch (e) {
      if (!silent) toast('刷新失败：' + (e.message || e));
    } finally {
      state.loading = false;
      state.countdown = settings.interval;
      $('#btnRefresh').classList.remove('spin');
      renderSidebar();
    }
  }
  async function refreshBoards() {
    const res = await C.fetchBoards((id, list) => {
      state.boards[id] = list;
      if (state.view === 'hot') renderView();
    });
    state.boards = res;
    store.set(K.boards, { ts: Date.now(), data: res });
    if (state.view === 'hot') renderView();
  }
  async function refreshFlash() {
    state.flash = await C.fetchFlash();
    state.flashCountdown = 30;
    if (state.view === 'flash') renderView();
    renderSidebar();
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    let t = settings.theme;
    if (t === 'system') t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    if (t === 'night') {
      const h = new Date().getHours();
      t = (h >= 20 || h < 7) ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0d1119' : (t === 'eye' ? '#f2ecdf' : '#f4f6fa'));
  }

  // 主题循环：浅色 → 护眼 → 深色 → 浅色
  function cycleTheme() {
    const cur = document.documentElement.dataset.theme || 'light';
    settings.theme = cur === 'light' ? 'eye' : (cur === 'eye' ? 'dark' : 'light');
    saveSettings(); applyTheme();
    toast('已切换到' + (settings.theme === 'eye' ? '护眼模式' : (settings.theme === 'dark' ? '深色' : '浅色')));
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    document.addEventListener('click', async e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act, v = el.dataset.v, id = el.dataset.id;
      switch (act) {
        case 'view':
          state.view = v; state.sourceFilter = ''; state.limit = 60; closeReader();
          renderAll(); closeDrawer();
          if (v === 'hot' && !Object.keys(state.boards).length) refreshBoards();
          if (v === 'flash' && !state.flash.length) refreshFlash();
          break;
        case 'cat':
          state.view = 'feed'; state.cat = v; state.sourceFilter = ''; state.limit = 60; closeReader(); renderAll(); closeDrawer(); break;
        case 'src':
          state.view = 'feed'; state.sourceFilter = v || ''; state.cat = '全部'; state.limit = 60; closeReader(); renderAll(); break;
        case 'viewFlash': state.view = 'flash'; state.limit = 60; closeReader(); renderAll(); break;
        case 'open': e.stopPropagation(); selectItem(id); break;
        case 'star': e.stopPropagation(); toggleSet(state.star, id, '收藏'); break;
        case 'later': e.stopPropagation(); toggleSet(state.later, id, '稍后读'); break;
        case 'copy': {
          e.stopPropagation();
          const it = id ? findItem(id) : state.current;
          if (it) copyText(it.title + '\n' + it.link, '链接已复制');
          break;
        }
        case 'external': openExternal(state.current && state.current.link); break;
        case 'externalUrl': openExternal(v); break;
        case 'export': {
          const it = state.current; if (!it) break;
          const md = `# ${it.title}\n\n> 来源：${it.source} · ${fmtAbs(it.ts)} · ${it.cat}\n> 原文：${it.link}\n\n${state.bodyText || it.summary}\n`;
          download(it.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) + '.md', md, 'text/markdown;charset=utf-8');
          break;
        }
        case 'exportAll': {
          const rows = [['时间', '频道', '来源', '标题', '链接']].concat(state.items.map(i => [fmtAbs(i.ts), i.cat, i.source, i.title, i.link]));
          const csv = '\ufeff' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
          download('文-全部新闻.csv', csv, 'text/csv;charset=utf-8');
          break;
        }
        case 'speak': speak(state.bodyText || (state.current && state.current.summary) || ''); break;
        case 'speakStop': stopSpeak(); break;
        case 'ai': {
          const card = $('#aiCard');
          if (card) {
            const hidden = card.style.display === 'none';
            card.style.display = hidden ? '' : 'none';
            toast(hidden ? '已显示 AI 总结' : '已收起 AI 总结');
          } else { ensureSummary(true); toast('正在生成 AI 总结'); }
          break;
        }
        case 'aiClose': { const c2 = $('#aiCard'); if (c2) c2.remove(); break; }
        case 'font': settings.fs = Math.max(13, Math.min(24, settings.fs + Number(v))); saveSettings(); applyArticleStyle(); break;
        case 'filter':
          if (v === 'sort') settings.sort = settings.sort === 'new' ? 'old' : 'new';
          if (v === 'density') settings.density = settings.density === 'comfort' ? 'compact' : 'comfort';
          if (v === 'unread') settings.unreadOnly = !settings.unreadOnly;
          if (v === 'images') settings.imagesOnly = !settings.imagesOnly;
          if (v === 'hideread') settings.hideRead = !settings.hideRead;
          saveSettings(); state.limit = 60; renderView(); break;
        case 'loadMore': state.limit += 60; renderList(); break;
        case 'range':
          if (state.range === v) break;
          state.range = v; settings.range = v; saveSettings();
          state.limit = 60; renderView(); renderSidebar();
          { const sc = $('.view-scroll'); if (sc) sc.scrollTop = 0; }
          if (v !== 'all') toast('已把' + ((RANGES.find(r => r.id === v) || {}).label || '') + '的新闻置顶');
          break;
        case 'refresh': refresh(); break;
        case 'refreshBoards': refreshBoards(); toast('热榜已刷新'); break;
        case 'refreshFlash': refreshFlash(); toast('快讯已刷新'); break;
        case 'board': state.boardTab = v; renderView(); break;
        case 'hotword':
          state.cat = '全部'; state.sourceFilter = ''; state.view = 'feed';
          $('#search').value = v; $('#searchClear').classList.add('on');
          setQuery(v, true); renderAll(); closeDrawer();
          toast('已检索「' + v + '」'); break;
        case 'newbar':
          state.newIds.clear(); const nb = $('#newbar'); if (nb) nb.classList.remove('on');
          renderList();
          const vs = $('.view-scroll'); if (vs) vs.scrollTop = 0;
          break;
        case 'websearch': openExternal('https://www.baidu.com/s?wd=' + encodeURIComponent(state.query || v)); break;
        case 'caroPrev': carGo(state.carouselIdx - 1); break;
        case 'caroNext': carGo(state.carouselIdx + 1); break;
        case 'caroDot': carGo(Number(v)); break;
        case 'live': e.stopPropagation(); openExternal(v); break;   // 直接跳转央视网直播页
        case 'wxAlarm': openExternal(v); break;
        case 'cityQuick':
          settings.city = v; saveSettings(); refreshWeather();
          toast('已切换到 ' + ((C.CITIES.find(c => c.id === v) || {}).name || ''));
          break;
        case 'stockOpen': openExternal(v); break;
        case 'refreshStocks': refreshStocks(); toast('正在刷新行情…'); break;
        case 'clearSearch':
          $('#search').value = ''; $('#searchClear').classList.remove('on');
          setQuery('', true); renderAll(); break;
        case 'mpAll': C.SOURCES.forEach(s => toggleSource(s.id, true)); renderSettings(); renderSidebar(); refresh({ silent: true }); toast('已选择全部媒体'); break;
        case 'mpNone': C.SOURCES.forEach(s => toggleSource(s.id, false)); renderSettings(); renderSidebar(); refresh({ silent: true }); toast('已取消全部媒体'); break;
        case 'settings': renderSettings(); break;
        case 'closeDrawer': closeDrawer(); break;
        case 'closeModal': $('#modal').classList.remove('on'); break;
        case 'back': case 'closeReader': closeReader(); break;
        case 'toggleSrc': {
          const s = settings.customSources[Number(el.dataset.i)];
          if (s) { s.enabled = s.enabled === false; saveSettings(); renderSettings(); C.setCustomSources(settings.customSources); }
          break;
        }
        case 'delSrc': settings.customSources.splice(Number(el.dataset.i), 1); saveSettings(); C.setCustomSources(settings.customSources); renderSettings(); refresh(); break;
        case 'addSrc': {
          const url = ($('#srcUrl').value || '').trim();
          const name = ($('#srcName').value || '').trim() || '自定义源';
          const cat = $('#srcCat').value;
          if (!/^https?:\/\//.test(url)) { toast('请填写完整的 http(s) 地址'); break; }
          toast('正在校验该源…');
          try {
            const text = await C.httpText(url, 12000);
            const items = C.parseRss(text, { name: name, cat: cat });
            if (!items.length) throw new Error('未解析到新闻条目');
            settings.customSources.push({ name, url, cat, enabled: true });
            saveSettings(); C.setCustomSources(settings.customSources);
            renderSettings(); refresh();
            toast(`已添加「${name}」，解析到 ${items.length} 条`);
          } catch (err) { toast('添加失败：' + (err.message || err)); }
          break;
        }
      }
    });

    // 设置里的分段按钮（密度等）
    document.addEventListener('click', e => {
      if (e.target.closest('[data-act]')) return;
      const seg = e.target.closest('[data-set][data-v]');
      if (seg && seg.tagName === 'BUTTON') {
        settings[seg.dataset.set] = seg.dataset.v;
        saveSettings(); renderSettings(); renderAll();
        return;
      }
      const sw = e.target.closest('.switch[data-set]');
      if (!sw) return;
      const k = sw.dataset.set;
      settings[k] = !settings[k];
      saveSettings(); renderSettings(); renderAll();
    });
    // 设置控件：select / number / text
    document.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset && el.dataset.mp) {
        toggleSource(el.dataset.mp, el.checked);
        const row = el.closest('.mp-item');
        if (row) row.classList.toggle('on', el.checked);
        const cnt = $('.mp-count');
        if (cnt) cnt.textContent = '已选 ' + C.SOURCES.filter(s => isSourceOn(s.id)).length + ' / ' + C.SOURCES.length;
        renderSidebar();
        refresh({ silent: true });
        return;
      }
      if (el.id === 'wxCity') {
        settings.city = el.value; saveSettings(); refreshWeather();
        toast('已切换到 ' + (C.CITIES.find(c => c.id === settings.city) || {}).name);
        return;
      }
      if (!el.dataset || !el.dataset.set || el.classList.contains('switch')) return;
      const k = el.dataset.set;
      settings[k] = k === 'keywords' ? el.value.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean)
        : (['interval', 'fs', 'width', 'rate', 'lh'].indexOf(k) >= 0 ? Number(el.value) : el.value);
      if (k === 'interval') state.countdown = settings.interval;
      if (k === 'theme') applyTheme();
      saveSettings(); renderSettings(); renderAll();
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'rateRange') { settings.rate = Number(e.target.value); saveSettings(); }
    });

    // 顶栏
    $('#btnMenu').onclick = () => { $('#sidebar').classList.add('open'); $('#mask').classList.add('on'); };
    $('#mask').onclick = () => { $('#sidebar').classList.remove('open'); closeDrawer(); };
    $('#btnRefresh').onclick = () => refresh();
    $('#btnTheme').onclick = cycleTheme;
    $('#btnSettings').onclick = () => renderSettings();
    $('#btnHelp').onclick = () => renderHelp();
    $('#btnPin').onclick = () => { settings.pin = !settings.pin; saveSettings(); $('#btnPin').classList.toggle('on', settings.pin); toast(settings.pin ? '窗口已置顶' : '已取消置顶'); };
    $('#logoHome').onclick = () => { state.view = 'feed'; state.cat = '全部'; state.sourceFilter = ''; $('#search').value = ''; $('#searchClear').classList.remove('on'); setQuery('', true); renderAll(); };
    $('#lightbox').onclick = () => $('#lightbox').classList.remove('on');

    let st = null;
    $('#search').addEventListener('input', e => {
      clearTimeout(st);
      const v = e.target.value;
      $('#searchClear').classList.toggle('on', !!v);
      st = setTimeout(() => setQuery(v), 160);
    });
    $('#searchClear').onclick = () => {
      $('#search').value = ''; $('#searchClear').classList.remove('on');
      setQuery('');
    };

    // 键盘
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#search').focus(); $('#search').select(); return; }
      if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
      const list = state.view === 'feed' ? visibleItems() : [];
      const idx = state.current ? list.findIndex(i => i.id === state.current.id) : -1;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowDown' || k === 'j') { e.preventDefault(); if (list.length) selectItem(list[Math.min(list.length - 1, idx + 1)].id); }
      else if (e.key === 'ArrowUp' || k === 'k') { e.preventDefault(); if (list.length) selectItem(list[Math.max(0, idx - 1)].id); }
      else if (e.key === 'Enter' && idx >= 0) selectItem(list[idx].id);
      else if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
      else if (k === 'r') refresh();
      else if (k === 's' && state.current) toggleSet(state.star, state.current.id, '收藏');
      else if (k === 'l' && state.current) toggleSet(state.later, state.current.id, '稍后读');
      else if (k === 't') cycleTheme();
      else if (e.key === '?') renderHelp();
      else if (k === ',') renderSettings();
      else if (/^[1-9]$/.test(e.key) && C.CATS[+e.key]) { state.view = 'feed'; state.cat = C.CATS[+e.key]; state.sourceFilter = ''; renderAll(); }
      else if (e.key === 'Escape') {
        $('#modal').classList.remove('on'); $('#lightbox').classList.remove('on');
        $('#sidebar').classList.remove('open'); closeDrawer(); closeReader();
      }
    });

    // 轮播：鼠标悬停暂停
    document.addEventListener('mouseover', e => { if (e.target.closest('#caro')) state.carouselPaused = true; });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('#caro')) {
        const rel = e.relatedTarget;
        if (!rel || !rel.closest || !rel.closest('#caro')) state.carouselPaused = false;
      }
    });
    // 轮播：移动端左右滑动
    let caroTouchX = 0;
    const caroEl = () => $('#caro');
    document.addEventListener('touchstart', e => {
      if (caroEl() && e.target.closest('#caro')) caroTouchX = e.touches[0].clientX;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!caroEl() || !e.target.closest) return;
      const dx = e.changedTouches[0].clientX - caroTouchX;
      if (Math.abs(dx) > 40 && caroTouchX) carGo(state.carouselIdx + (dx < 0 ? 1 : -1));
      caroTouchX = 0;
    }, { passive: true });

    // 移动端滑动返回
    let sx = 0, sy = 0;
    document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx, dy = Math.abs(e.changedTouches[0].clientY - sy);
      if (dx > 75 && dy < 55 && window.innerWidth <= 900) closeReader();
    }, { passive: true });
  }

  window.__back = function () {
    if ($('#lightbox').classList.contains('on')) { $('#lightbox').classList.remove('on'); return 'true'; }
    if ($('#modal').classList.contains('on')) { $('#modal').classList.remove('on'); return 'true'; }
    if ($('#drawer').classList.contains('on')) { closeDrawer(); return 'true'; }
    if ($('#readerLayer').classList.contains('on')) { closeReader(); return 'true'; }
    if ($('#sidebar').classList.contains('open')) { $('#sidebar').classList.remove('open'); $('#mask').classList.remove('on'); return 'true'; }
    return 'false';
  };

  /* ---------------- 心跳 ---------------- */
  function heartbeat() {
    setInterval(() => {
      const now = new Date();
      $('#clock').textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
      if (settings.theme === 'system' || settings.theme === 'night') applyTheme();
      if (settings.auto && document.visibilityState !== 'hidden') {
        state.countdown--;
        if (state.countdown <= 0) refresh({ silent: true });
      }
      if (settings.flashAuto && state.view === 'flash' && document.visibilityState !== 'hidden') {
        state.flashCountdown--;
        if (state.flashCountdown <= 0) refreshFlash();
      }
      // 大盘行情：可见时每 15 秒刷新（交易时段更及时），倒计时显示
      if (state.view === 'feed' && document.visibilityState !== 'hidden') {
        state.stockCountdown--;
        const cd = $('#stockCd');
        if (cd) cd.textContent = state.stockCountdown > 0 ? state.stockCountdown : '0';
        if (state.stockCountdown <= 0) { state.stockCountdown = 15; refreshStocks(); }
      }
      const on = $('#online');
      if (on) {
        on.classList.toggle('stale', !state.okSources);
        on.querySelector('span').textContent = state.okSources
          ? (settings.auto ? `${state.countdown}s 后刷新` : `${state.okSources} 源在线`)
          : (state.loading ? '连接中' : '离线');
      }
    }, 1000);
    // 相对时间由每次刷新时的增量更新处理，不再每分钟整表重绘（会闪屏）
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    C.setCustomSources(settings.customSources || []);
    applyTheme();
    $('#btnPin').classList.toggle('on', !!settings.pin);
    if (settings.pin && window.__PROXY__ && !window.__WEN_REMOTE__) fetch('/api/top?on=1').catch(() => { });
    $('#searchKbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

    const cache = store.get(K.cache, null);
    if (cache && cache.items && cache.items.length) {
      state.items = cache.items; state.lastUpdate = cache.ts || 0;
    }
    const ar = store.get(K.archive, null);
    if (ar && ar.items) state.archive = ar.items.filter(i => i.ts >= archiveCutoff());
    if (!state.archive.length && state.items.length) mergeArchive(state.items);
    const bc = store.get(K.boards, null);
    if (bc && bc.data) state.boards = bc.data;

    bind();
    heartbeat();
    renderAll();
    refresh({ silent: true });
    refreshBoards();
    refreshFlash();
    refreshWeather();
    refreshStocks();
    setInterval(() => { if (document.visibilityState !== 'hidden') refreshWeather(); }, 600000);
    // 非信息流视图时兜底刷新行情（信息流视图由心跳每 15 秒刷新）
    setInterval(() => { if (state.view !== 'feed' && document.visibilityState !== 'hidden') refreshStocks(); }, 60000);

    try {
      const qs = new URLSearchParams(location.search);
      const cat = qs.get('cat');
      if (cat && C.CATS.indexOf(cat) >= 0) { state.cat = cat; state.view = 'feed'; }
      const q = qs.get('q');
      if (q) { state.view = 'feed'; $('#search').value = q; $('#searchClear').classList.add('on'); setQuery(q, true); renderAll(); }
      const v = qs.get('view');
      if (v && ['feed', 'hot', 'flash', 'insight', 'saved', 'later', 'focus'].indexOf(v) >= 0) { state.view = v; renderAll(); }
      const th = qs.get('theme');
      if (th === 'dark' || th === 'light' || th === 'eye') { settings.theme = th; applyTheme(); renderAll(); }
      if (qs.get('panel') === 'settings') renderSettings();
      if (qs.get('panel') === 'help') renderHelp();
      if (qs.has('debug')) {
        window.addEventListener('error', ev => { document.title = 'JSERR ' + ev.message; });
        window.addEventListener('unhandledrejection', ev => { document.title = 'JSERR ' + String(ev.reason); });
      }
      if (qs.get('open') === 'first') setTimeout(() => { const l = visibleItems(); if (l[0]) selectItem(l[0].id); }, 3500);
    } catch (e) { }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
