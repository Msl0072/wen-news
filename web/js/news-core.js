/* ============================================================
 * 文 · news-core.js  v3.7.9
 * 新闻源 / 热榜 / 快讯 / 解析 / 清洗 / 去重 / 正文提取
 * 共用运行于：桌面 WebView2、安卓 WebView、Node 测试环境
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------------- 新闻源 ---------------- */
  const SINA = (lid, cat, name) => ({
    id: 'sina-' + lid, name, cat, kind: 'sina',
    url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=' + lid + '&num=40&page=1',
    home: 'https://news.sina.com.cn/'
  });
  const SOURCES = [
    SINA(2509, '要闻', '新浪 · 要闻'),
    SINA(2510, '国内', '新浪 · 国内'),
    SINA(2511, '国际', '新浪 · 国际'),
    SINA(2514, '国际', '新浪 · 军事'),
    SINA(2515, '财经', '新浪 · 财经'),
    SINA(2512, '体育', '新浪 · 体育'),
    SINA(2513, '娱乐', '新浪 · 娱乐'),
    { id: '36kr', name: '36氪', cat: '科技', kind: 'rss', url: 'https://www.36kr.com/feed', home: 'https://36kr.com/' },
    { id: 'ithome', name: 'IT之家', cat: '科技', kind: 'rss', url: 'https://www.ithome.com/rss/', home: 'https://www.ithome.com/' },
    { id: 'tmtpost', name: '钛媒体', cat: '科技', kind: 'rss', url: 'https://www.tmtpost.com/rss.xml', home: 'https://www.tmtpost.com/' },
    { id: 'sspai', name: '少数派', cat: '科技', kind: 'rss', url: 'https://sspai.com/feed', home: 'https://sspai.com/' }
  ];

  const CATS = ['全部', '要闻', '国内', '国际', '财经', '科技', '体育', '娱乐'];

  /* 央视直播：轮播固定入口，点击直接跳转央视网官方直播页。
   * a/b 为该频道封面的渐变配色，封面由 CSS 本地绘制，不依赖外链图片。 */
  const LIVE_CHANNELS = [
    { id: 'cctv13', no: 'CCTV-13', name: '新闻', desc: '全天新闻直播 · 央视新闻频道', url: 'https://tv.cctv.com/live/cctv13/', a: '#0b2f66', b: '#1e6fd9' },
    { id: 'cctv1',  no: 'CCTV-1',  name: '综合', desc: '综合频道高清直播', url: 'https://tv.cctv.com/live/cctv1/',  a: '#7a1420', b: '#e0452f' },
    { id: 'cctv2',  no: 'CCTV-2',  name: '财经', desc: '财经频道高清直播', url: 'https://tv.cctv.com/live/cctv2/',  a: '#6a3a08', b: '#e09a1e' },
    { id: 'cctv5',  no: 'CCTV-5',  name: '体育', desc: '体育频道高清直播', url: 'https://tv.cctv.com/live/cctv5/',  a: '#0a3d1c', b: '#28a45a' },
    { id: 'cctv4',  no: 'CCTV-4',  name: '中文国际', desc: '中文国际频道（亚洲版）高清直播', url: 'https://tv.cctv.com/live/cctv4/', a: '#084a4a', b: '#1aa8a0' },
    { id: 'cctv3',  no: 'CCTV-3',  name: '综艺', desc: '综艺频道高清直播', url: 'https://tv.cctv.com/live/cctv3/',  a: '#4a1450', b: '#c13fa8' },
    { id: 'cctv5p', no: 'CCTV-5+', name: '体育赛事', desc: '体育赛事频道高清直播', url: 'https://tv.cctv.com/live/cctv5plus/', a: '#08324a', b: '#1f8fb5' },
    { id: 'cctv16', no: 'CCTV-16', name: '奥林匹克', desc: '奥林匹克频道高清直播', url: 'https://tv.cctv.com/live/cctv16/', a: '#2b1a63', b: '#7058d8' }
  ];

  /* 热榜 */
  const BOARDS = [
    { id: 'baidu', name: '百度热搜', kind: 'baidu', url: 'https://top.baidu.com/api/board?platform=wise&tab=realtime' },
    { id: 'toutiao', name: '今日头条', kind: 'toutiao', url: 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc' },
    { id: 'thepaper', name: '澎湃热榜', kind: 'thepaper', url: 'https://cache.thepaper.cn/contentapi/wwwIndex/rightSidebar' }
  ];

  /* 7x24 快讯 */
  const FLASH = [
    { id: 'wscn-global', name: '华尔街见闻 · 全球', url: 'https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=40' },
    { id: 'wscn-a', name: '华尔街见闻 · A股', url: 'https://api-one.wallstcn.com/apiv1/content/lives?channel=a-stock-channel&limit=30' }
  ];

  /* 天气城市：按地区分组，覆盖 30+ 主要城市，可搜索选择 */
  const CITIES = [
    // 华北
    { id: 'beijing', name: '北京', region: '华北', lat: 39.9042, lon: 116.4074 },
    { id: 'tianjin', name: '天津', region: '华北', lat: 39.3434, lon: 117.3616 },
    { id: 'shijiazhuang', name: '石家庄', region: '华北', lat: 38.0428, lon: 114.5149 },
    { id: 'taiyuan', name: '太原', region: '华北', lat: 37.8706, lon: 112.5489 },
    { id: 'hohhot', name: '呼和浩特', region: '华北', lat: 40.8414, lon: 111.7519 },
    // 东北
    { id: 'shenyang', name: '沈阳', region: '东北', lat: 41.8057, lon: 123.4315 },
    { id: 'dalian', name: '大连', region: '东北', lat: 38.9140, lon: 121.6147 },
    { id: 'changchun', name: '长春', region: '东北', lat: 43.8171, lon: 125.3235 },
    { id: 'harbin', name: '哈尔滨', region: '东北', lat: 45.8038, lon: 126.5349 },
    // 华东
    { id: 'shanghai', name: '上海', region: '华东', lat: 31.2304, lon: 121.4737 },
    { id: 'hangzhou', name: '杭州', region: '华东', lat: 30.2741, lon: 120.1551 },
    { id: 'nanjing', name: '南京', region: '华东', lat: 32.0603, lon: 118.7969 },
    { id: 'suzhou', name: '苏州', region: '华东', lat: 31.2989, lon: 120.5853 },
    { id: 'hefei', name: '合肥', region: '华东', lat: 31.8206, lon: 117.2272 },
    { id: 'fuzhou', name: '福州', region: '华东', lat: 26.0745, lon: 119.2965 },
    { id: 'xiamen', name: '厦门', region: '华东', lat: 24.4798, lon: 118.0894 },
    { id: 'nanchang', name: '南昌', region: '华东', lat: 28.6829, lon: 115.8582 },
    { id: 'jinan', name: '济南', region: '华东', lat: 36.6512, lon: 117.1201 },
    { id: 'qingdao', name: '青岛', region: '华东', lat: 36.0671, lon: 120.3826 },
    // 华中
    { id: 'wuhan', name: '武汉', region: '华中', lat: 30.5928, lon: 114.3055 },
    { id: 'changsha', name: '长沙', region: '华中', lat: 28.2282, lon: 112.9388 },
    { id: 'zhengzhou', name: '郑州', region: '华中', lat: 34.7466, lon: 113.6254 },
    // 华南
    { id: 'shenzhen', name: '深圳', region: '华南', lat: 22.5431, lon: 114.0579 },
    { id: 'guangzhou', name: '广州', region: '华南', lat: 23.1291, lon: 113.2644 },
    { id: 'dongguan', name: '东莞', region: '华南', lat: 23.0207, lon: 113.7518 },
    { id: 'foshan', name: '佛山', region: '华南', lat: 23.0218, lon: 113.1214 },
    { id: 'nanning', name: '南宁', region: '华南', lat: 22.8170, lon: 108.3665 },
    { id: 'haikou', name: '海口', region: '华南', lat: 20.0442, lon: 110.1999 },
    { id: 'sanya', name: '三亚', region: '华南', lat: 18.2528, lon: 109.5119 },
    { id: 'hongkong', name: '中国香港', region: '华南', lat: 22.3193, lon: 114.1694 },
    { id: 'macao', name: '中国澳门', region: '华南', lat: 22.1987, lon: 113.5439 },
    // 西南
    { id: 'chengdu', name: '成都', region: '西南', lat: 30.5728, lon: 104.0668 },
    { id: 'chongqing', name: '重庆', region: '西南', lat: 29.5630, lon: 106.5516 },
    { id: 'kunming', name: '昆明', region: '西南', lat: 25.0389, lon: 102.7183 },
    { id: 'guiyang', name: '贵阳', region: '西南', lat: 26.6470, lon: 106.6302 },
    { id: 'lhasa', name: '拉萨', region: '西南', lat: 29.6520, lon: 91.1721 },
    // 西北
    { id: 'xian', name: '西安', region: '西北', lat: 34.3416, lon: 108.9398 },
    { id: 'lanzhou', name: '兰州', region: '西北', lat: 36.0611, lon: 103.8343 },
    { id: 'yinchuan', name: '银川', region: '西北', lat: 38.4872, lon: 106.2309 },
    { id: 'xining', name: '西宁', region: '西北', lat: 36.6171, lon: 101.7782 },
    { id: 'urumqi', name: '乌鲁木齐', region: '西北', lat: 43.8256, lon: 87.6168 }
  ];

  /* 天气：Open-Meteo（免密钥） + 中央气象台官方预警 */
  const WMO = {
    0: ['晴', '☀'], 1: ['多云转晴', '🌤'], 2: ['多云', '⛅'], 3: ['阴', '☁'],
    45: ['雾', '🌫'], 48: ['冻雾', '🌫'], 51: ['毛毛雨', '🌦'], 53: ['小雨', '🌦'],
    55: ['中雨', '🌧'], 56: ['冻雨', '🌧'], 57: ['冻雨', '🌧'],
    61: ['小雨', '🌧'], 63: ['中雨', '🌧'], 65: ['大雨', '🌧'],
    66: ['冻雨', '🌧'], 67: ['冻雨', '🌧'],
    71: ['小雪', '🌨'], 73: ['中雪', '🌨'], 75: ['大雪', '❄'], 77: ['米雪', '🌨'],
    80: ['阵雨', '🌦'], 81: ['阵雨', '🌧'], 82: ['暴雨', '⛈'],
    85: ['阵雪', '🌨'], 86: ['阵雪', '❄'],
    95: ['雷阵雨', '⛈'], 96: ['雷雨伴冰雹', '⛈'], 99: ['强雷雨冰雹', '⛈']
  };
  const weatherDesc = code => (WMO[code] || ['未知', '🌡'])[0];
  const weatherIcon = code => (WMO[code] || ['未知', '🌡'])[1];

  async function fetchWeather(cityId) {
    const c = CITIES.find(x => x.id === cityId) || CITIES[0];
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
      '&timezone=Asia%2FShanghai&forecast_days=2';
    let d;
    try { d = JSON.parse(await httpText(url, 12000)); } catch (e) { return null; }
    const cur = d.current || {}, daily = d.daily || {};
    return {
      city: c.name, temp: cur.temperature_2m, feel: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
      code: cur.weather_code, desc: weatherDesc(cur.weather_code), icon: weatherIcon(cur.weather_code),
      max: (daily.temperature_2m_max || [])[0], min: (daily.temperature_2m_min || [])[0],
      tomorrowCode: (daily.weather_code || [])[1],
      tomorrowMax: (daily.temperature_2m_max || [])[1],
      tomorrowMin: (daily.temperature_2m_min || [])[1]
    };
  }

  async function fetchAlarms() {
    let d;
    try {
      d = JSON.parse(await httpText('http://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=12', 12000));
    } catch (e) { return []; }
    const list = (d && d.data && d.data.page && d.data.page.list) || [];
    return list.map(x => {
      const t = String(x.title || '');
      const lv = /红色/.test(t) ? 'red' : /橙色/.test(t) ? 'orange' : /黄色/.test(t) ? 'yellow' : 'blue';
      return {
        title: t,
        level: lv,
        levelName: lv === 'red' ? '红色' : lv === 'orange' ? '橙色' : lv === 'yellow' ? '黄色' : '蓝色',
        time: String(x.issuetime || ''),
        url: /^https?:/.test(x.url || '') ? x.url : ('https://www.nmc.cn' + (x.url || ''))
      };
    }).filter(x => x.title);
  }

  /* 大盘行情：腾讯行情（主） + 东方财富（备1） + 新浪（备2），红涨绿跌
   * 每次请求都带时间戳参数绕过代理 60 秒缓存，保证刷新即取新数据 */
  const STOCKS_URL = 'https://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006,s_hkHSI';
  const STOCKS_BACKUP = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f12,f13,f14&secids=1.000001,0.399001,0.399006,100.HSI';
  const STOCKS_SINA = 'https://hq.sinajs.cn/list=s_sh000001,s_sz399001,s_sz399006,int_hangseng';
  function bust(u) {
    // 各源都接受额外查询参数，时间戳让代理缓存键每次不同
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  async function fetchStocks() {
    const stamp = Date.now();
    // 主源：腾讯（GBK 由本地代理统一转成 UTF-8）
    try {
      const text = await httpText(bust(STOCKS_URL), 12000);
      const re = /v_s_([\w]+)="([^"]+)"/g;
      const out = [];
      let m;
      while ((m = re.exec(text))) {
        const p = m[2].split('~');
        if (p.length < 6) continue;
        const price = Number(p[3]);
        if (isNaN(price) || !price) continue;
        const key = m[1];
        out.push({
          name: p[1], code: p[2], price, pct: Number(p[5]), change: Number(p[4]), ts: stamp,
          url: /hk/i.test(key) ? 'https://quote.eastmoney.com/center/gridlist.html#index_hk'
            : ('https://quote.eastmoney.com/' + (/sh/i.test(key) ? 'sh' : 'sz') + p[2] + '.html')
        });
      }
      if (out.length) return out;
    } catch (e) { }
    // 备源1：东方财富
    try {
      const d = JSON.parse(await httpText(bust(STOCKS_BACKUP), 12000));
      const diff = (d && d.data && d.data.diff) || [];
      const out = diff.map(x => ({
        name: x.f14, code: x.f12, price: Number(x.f2), pct: Number(x.f3), change: Number(x.f4), ts: stamp,
        url: x.f13 === 100 ? 'https://quote.eastmoney.com/center/gridlist.html#index_hk'
          : ('https://quote.eastmoney.com/' + (String(x.f13) === '1' ? 'sh' : 'sz') + x.f12 + '.html')
      })).filter(x => x.name && !isNaN(x.price));
      if (out.length) return out;
    } catch (e) { }
    // 备源2：新浪（需 Referer，桌面代理不带 Referer，可能被拒；安卓端可成功）
    try {
      const text = await httpText(bust(STOCKS_SINA), 12000);
      const re = /v_hq_str_([\w]+)="([^"]*)"/g;
      const out = [];
      let m;
      while ((m = re.exec(text))) {
        const p = m[2].split(',');
        if (p.length < 4) continue;
        const price = Number(p[1]);
        if (isNaN(price) || !price) continue;
        const key = m[1];
        out.push({
          name: p[0], code: key.replace('int_', ''), price, pct: Number(p[3]), change: Number(p[2]), ts: stamp,
          url: /hk|hangseng/i.test(key) ? 'https://quote.eastmoney.com/center/gridlist.html#index_hk'
            : ('https://quote.eastmoney.com/' + (/sh/i.test(key) ? 'sh' : 'sz') + key.replace(/^s_[a-z]+/, '') + '.html')
        });
      }
      if (out.length) return out;
    } catch (e) { }
    return [];
  }

  /* 为无图新闻补抓文章页的 og:image（过滤小图标） */
  function usableImage(u) {
    if (!u || u.length > 600) return '';
    const s = u.replace(/^\/\//, 'https://');
    if (!/^https?:\/\//.test(s)) return '';
    if (/\b(icon|logo|avatar|blank|spacer|placeholder|qrcode|weixin)\b/i.test(s)) return '';
    const wh = s.match(/\/w(\d{1,4})h(\d{1,4})/i) || s.match(/[?&]w=(\d{1,4})/i);
    if (wh && Number(wh[1]) < 220) return '';
    return s;
  }
  async function fetchArticleImage(link) {
    if (!link || !/^https?:/.test(link)) return '';
    try {
      const html = await httpText(link, 10000);
      const pats = [
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i
      ];
      for (let i = 0; i < pats.length; i++) {
        const m = html.match(pats[i]);
        if (m) { const u = usableImage(decodeEntities(m[1])); if (u) return u; }
      }
    } catch (e) { }
    return '';
  }

  let customSources = [];
  function setCustomSources(list) {
    customSources = (list || []).filter(s => s && s.url && /^https?:/.test(s.url) && s.enabled !== false)
      .map((s, i) => ({
        id: 'custom-' + i, name: s.name || '自定义源', cat: s.cat || '要闻',
        kind: 'rss', url: s.url, home: s.url, custom: true
      }));
  }
  function allSources() { return SOURCES.concat(customSources); }

  /* ---------------- 网络层 ---------------- */
  let tokenSeq = 0;
  const pending = new Map();

  function androidFetch(url, timeout) {
    return new Promise(function (resolve, reject) {
      const token = 'r' + (++tokenSeq) + '_' + Date.now();
      const timer = setTimeout(function () { pending.delete(token); reject(new Error('timeout')); }, timeout || 15000);
      pending.set(token, { resolve, reject, timer });
      try { global.AndroidBridge.getText(url, token); }
      catch (e) { clearTimeout(timer); pending.delete(token); reject(e); }
    });
  }
  global.__netResolve = function (token, ok, text) {
    const p = pending.get(token);
    if (!p) return;
    pending.delete(token);
    clearTimeout(p.timer);
    ok ? p.resolve(text) : p.reject(new Error('network'));
  };

  async function httpText(url, timeout) {
    const ms = timeout || 15000;
    if (global.AndroidBridge && global.AndroidBridge.getText) return androidFetch(url, ms);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, ms);
    try {
      let target = url;
      if (global.__PROXY__) target = global.__PROXY__ + encodeURIComponent(url);
      const res = await fetch(target, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } finally { clearTimeout(timer); }
  }

  /* ---------------- 文本工具 ---------------- */
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', hellip: '…', mdash: '—', middot: '·' };
  function decodeEntities(s) {
    return String(s || '')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] !== undefined ? ENT[n] : m);
  }
  function stripTags(html) {
    let s = String(html == null ? '' : html).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    return decodeEntities(s).replace(/\s+/g, ' ').trim();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'n' + (h >>> 0).toString(36);
  }
  function parseDate(s) {
    if (!s) return 0;
    const t = String(s).trim();
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m && t.indexOf('GMT') < 0 && t.indexOf('+') < 0) {
      return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    }
    const v = Date.parse(t);
    return isNaN(v) ? 0 : v;
  }
  function makeItem(o) {
    const link = String(o.link || '').replace(/^\/\//, 'https://').trim();
    return {
      id: hash(link || o.title), title: (o.title || '').replace(/\s+/g, ' ').trim(), link,
      summary: (o.summary || '').trim(), descHtml: o.descHtml || '', ts: o.ts || Date.now(),
      source: (o.source || '').trim(), sourceId: o.sourceId || '', cat: o.cat || '要闻',
      image: (o.image || '').replace(/^\/\//, 'https://')
    };
  }

  /* ---------------- 新闻解析 ---------------- */
  function parseSina(text, src) {
    let d; try { d = JSON.parse(text); } catch (e) { return []; }
    const list = (d && d.result && d.result.data) || [];
    return list.map(it => {
      const title = stripTags(it.title || ''), url = it.url || (it.urls && it.urls[0]) || '';
      if (!title || !url) return null;
      let image = '';
      if (Array.isArray(it.images) && it.images.length) {
        const im = it.images[0];
        image = typeof im === 'string' ? im : (im.u || im.url || '');
      }
      return makeItem({
        title, link: url, summary: stripTags(it.intro || it.summary || '').slice(0, 220),
        ts: (+it.ctime || 0) * 1000 || Date.now(),
        source: (it.media_name || '').trim() || src.name, sourceId: src.id, cat: src.cat, image
      });
    }).filter(Boolean);
  }

  function tagText(block, names) {
    for (let i = 0; i < names.length; i++) {
      const m = block.match(new RegExp('<' + names[i] + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + names[i] + '>', 'i'));
      if (m) return m[1];
    }
    return '';
  }
  function parseRssByRegex(text, src) {
    const out = [];
    const blocks = text.split(/<item[\s>]/i).slice(1).concat(text.split(/<entry[\s>]/i).slice(1));
    blocks.forEach(b => {
      const body = b.split(/<\/item>|<\/entry>/i)[0];
      const title = stripTags(tagText(body, ['title']));
      let link = tagText(body, ['link']);
      if (!link || link.indexOf('<') >= 0) {
        const m = body.match(/<link[^>]*href="([^"]+)"/i);
        if (m) link = m[1];
      }
      link = stripTags(link) || (link || '').trim();
      if (!title || !link) return;
      const rawDesc = tagText(body, ['content:encoded', 'description', 'summary', 'content']);
      const dateStr = stripTags(tagText(body, ['pubDate', 'dc:date', 'published', 'updated']));
      const enc = body.match(/<enclosure[^>]*url="([^"]+)"/i);
      const med = body.match(/<media:content[^>]*url="([^"]+)"/i);
      const imgInDesc = rawDesc.match(/<img[^>]+(?:data-src|data-original|src)="([^"]+)"/i);
      out.push(makeItem({
        title, link, summary: stripTags(rawDesc).slice(0, 220), descHtml: rawDesc,
        ts: parseDate(dateStr) || Date.now(), source: src.name, sourceId: src.id, cat: src.cat,
        image: (enc && enc[1]) || (med && med[1]) || (imgInDesc && imgInDesc[1]) || ''
      }));
    });
    return out;
  }
  function parseRss(text, src) {
    let items = [];
    if (typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        const nodes = doc.querySelectorAll('item, entry');
        if (nodes.length) {
          items = Array.prototype.map.call(nodes, node => {
            const pick = sel => { const el = node.querySelector(sel); return el ? el.textContent : ''; };
            let link = pick('link');
            if (!link) { const l = node.querySelector('link[href]'); if (l) link = l.getAttribute('href'); }
            if (!link) { const g = node.querySelector('guid'); if (g && /^https?:/.test(g.textContent.trim())) link = g.textContent.trim(); }
            const rawDesc = pick('content\\:encoded') || pick('description') || pick('summary') || pick('content');
            const imgEl = node.querySelector('enclosure[url], media\\:content[url], *[data-src]');
            let image = imgEl ? (imgEl.getAttribute('url') || imgEl.getAttribute('data-src') || '') : '';
            if (!image) { const m = String(rawDesc).match(/<img[^>]+(?:data-src|data-original|src)="([^"]+)"/i); if (m) image = m[1]; }
            return makeItem({
              title: stripTags(pick('title')), link: String(link).trim(), descHtml: rawDesc,
              summary: stripTags(rawDesc).slice(0, 220),
              ts: parseDate(pick('pubDate') || pick('dc\\:date') || pick('published') || pick('updated')) || Date.now(),
              source: src.name, sourceId: src.id, cat: src.cat, image
            });
          });
        }
      } catch (e) { /* 落到正则 */ }
    }
    if (!items.length) items = parseRssByRegex(text, src);
    return items.filter(i => i.title && i.link);
  }

  /* ---------------- 热榜解析 ---------------- */
  function parseBoard(kind, text) {
    let d; try { d = JSON.parse(text); } catch (e) { return []; }
    const out = [];
    if (kind === 'baidu') {
      const cards = (d.data && d.data.cards) || [];
      let list = [];
      cards.forEach(c => (c.content || []).forEach(x => {
        if (Array.isArray(x.content)) list = list.concat(x.content);
        else if (x.word) list.push(x);
      }));
      list.forEach((x, i) => {
        if (!x.word) return;
        out.push({ rank: x.index || (i + 1), title: x.word, url: x.url || '', desc: x.newHotName || '', hot: x.hotTag || '', image: '' });
      });
    } else if (kind === 'toutiao') {
      (d.data || []).forEach((x, i) => {
        if (!x.Title) return;
        out.push({ rank: i + 1, title: x.Title, url: x.Url || '', desc: x.LabelDesc || '', hot: x.HotValue || '', image: (x.Image && x.Image.url) || '' });
      });
    } else if (kind === 'thepaper') {
      const list = (d.data && d.data.hotNews) || [];
      list.forEach((x, i) => {
        const title = stripTags(x.name || x.title || '');
        if (!title) return;
        out.push({
          rank: i + 1, title,
          url: x.link || ('https://www.thepaper.cn/newsDetail_forward_' + x.contId),
          desc: '', hot: x.praiseTimes || x.interactionNum || '',
          image: x.pic || x.smallPic || ''
        });
      });
    }
    return out;
  }

  async function fetchBoard(board) {
    const text = await httpText(board.url, 14000);
    return parseBoard(board.kind, text);
  }
  async function fetchBoards(onOne) {
    const result = {};
    await Promise.all(BOARDS.map(async b => {
      try { const list = await fetchBoard(b); result[b.id] = list; if (onOne) onOne(b.id, list); }
      catch (e) { result[b.id] = []; if (onOne) onOne(b.id, []); }
    }));
    return result;
  }

  /* ---------------- 7x24 快讯 ---------------- */
  function parseFlash(text, src) {
    let d; try { d = JSON.parse(text); } catch (e) { return []; }
    const list = (d && d.data && d.data.items) || [];
    return list.map(x => {
      const title = stripTags(x.title || x.highlight_title || '');
      const body = stripTags(x.content_text || x.content || '');
      const text2 = title || body;
      if (!text2) return null;
      const img = (Array.isArray(x.images) && x.images[0]) || (Array.isArray(x.cover_images) && x.cover_images[0]) || '';
      return {
        id: 'f' + (x.id || hash(text2)),
        title: text2.slice(0, 60),
        body: (title && body && body !== title) ? body : '',
        ts: (+x.display_time || 0) * 1000 || Date.now(),
        source: src.name,
        link: (x.uri && /^https?:/.test(x.uri)) ? x.uri : ('https://wallstreetcn.com/live/' + (x.id || '')),
        image: typeof img === 'string' ? img : (img && (img.url || img.uri)) || '',
        important: !!x.is_calendar
      };
    }).filter(Boolean);
  }
  async function fetchFlash() {
    const all = [];
    await Promise.all(FLASH.map(async s => {
      try { const t = await httpText(s.url, 14000); parseFlash(t, s).forEach(i => all.push(i)); } catch (e) { }
    }));
    const seen = new Set();
    return all.filter(i => {
      const k = i.title.replace(/\s/g, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a, b) => b.ts - a.ts);
  }

  /* ---------------- 本地智能摘要（离线，双端通用） ---------------- */
  // 不使用后行断言/正则新特性，兼容低版本 Android WebView
  const AI_STOP = new Set(['这个', '那个', '我们', '他们', '可以', '已经', '没有', '什么', '如何', '为何',
    '记者', '报道', '消息', '表示', '相关', '目前', '今天', '昨日', '今日', '新闻', '最新', '发布',
    '进行', '通过', '以及', '对于', '其中', '之后', '此前', '同时', '开始', '这些', '那些', '不是',
    '就是', '还是', '可能', '应该', '需要', '能够', '一个', '一种', '一些', '方面', '情况', '问题']);

  function sentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/([。！？!?；;])/g, '$1\n')
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length >= 10 && s.length <= 400);
  }

  function wordFreq(text) {
    const freq = new Map();
    const chunks = String(text || '').match(/[\u4e00-\u9fa5]{2,}/g) || [];
    chunks.forEach(seg => {
      for (let n = 2; n <= 6; n++) {
        for (let i = 0; i + n <= seg.length; i++) {
          const w = seg.slice(i, i + n);
          if (AI_STOP.has(w)) continue;
          freq.set(w, (freq.get(w) || 0) + 1);
        }
      }
    });
    return freq;
  }

  /**
   * 抽取式摘要：按词频给句子打分，保留原文顺序输出要点，并给出关键词。
   * @returns {{points:string[], keywords:string[], chars:number, mode:string}}
   */
  function summarize(text, opts) {
    const limit = (opts && opts.limit) || 4;
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 30) {
      return { points: clean ? [clean] : [], keywords: [], chars: clean.length, mode: 'local' };
    }
    const sents = sentences(clean);
    const freq = wordFreq(clean);
    // 标题里的词更能代表主题，加权后用于关键词筛选
    if (opts && opts.title) {
      (String(opts.title).match(/[\u4e00-\u9fa5]{2,}/g) || []).forEach(seg => {
        for (let n = 2; n <= 6; n++) {
          for (let i = 0; i + n <= seg.length; i++) {
            const w = seg.slice(i, i + n);
            freq.set(w, (freq.get(w) || 0) + 2);
          }
        }
      });
    }
    const scored = sents.map((s, i) => {
      let score = 0, n = 0;
      const chunks = s.match(/[\u4e00-\u9fa5]{2,}/g) || [];
      chunks.forEach(seg => {
        for (let k = 0; k + 2 <= seg.length; k++) {
          score += freq.get(seg.slice(k, k + 2)) || 0;
          n++;
        }
      });
      score = n ? score / Math.pow(n, .62) : 0;
      if (i === 0) score *= 1.35;                       // 首句通常是导语
      if (/[0-9%％]/.test(s)) score *= 1.12;            // 含数据的句子更重要
      if (/(表示|指出|强调|宣布|透露|认为|显示)/.test(s)) score *= 1.08;
      return { s, i, score };
    });
    const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, limit)
      .sort((a, b) => a.i - b.i).map(x => x.s);
    // 关键词：按「词频 × 长度权重」排序，并剔除共享 2-gram 的滑窗碎片
    const overlap2 = (a, b) => {
      for (let i = 0; i + 2 <= a.length; i++) {
        if (b.indexOf(a.slice(i, i + 2)) >= 0) return true;
      }
      return false;
    };
    const chosen = [];
    const ranked = Array.from(freq.entries())
      .filter(([w, c]) => c >= 2 && w.length >= 2 && !AI_STOP.has(w))
      .map(([w, c]) => [w, c * (1 + (w.length - 2) * .35)])
      .sort((a, b) => b[1] - a[1]);
    // 先取 3 字以上的完整词；不足 4 个时再用高频二字词补齐
    [[w => w.length >= 3, 6], [w => w.length === 2 && ranked.length >= 0, 4]].forEach(([ok, cap]) => {
      ranked.forEach(([w]) => {
        if (chosen.length >= cap || !ok(w)) return;
        if (chosen.some(p => overlap2(p, w) || overlap2(w, p))) return;
        chosen.push(w);
      });
    });
    return { points: top, keywords: chosen, chars: clean.length, mode: 'local' };
  }

  /* ---------------- 去重 ---------------- */
  function titleKey(t) {
    return String(t).toLowerCase().replace(/[\s\u3000]/g, '')
      .replace(/[，。！？、：；“”‘’（）《》【】\-—…·,\.!\?:;"'()\[\]<>|~`@#$%^&*+=_\\\/]/g, '').slice(0, 26);
  }
  function dedupe(items) {
    const byKey = new Map(), byLink = new Set();
    items.forEach(it => {
      if (!it.title) return;
      const lk = it.link.split('#')[0];
      if (byLink.has(lk)) return;
      byLink.add(lk);
      const k = titleKey(it.title), prev = byKey.get(k);
      if (prev) {
        const richer = (it.descHtml.length + it.summary.length) > (prev.descHtml.length + prev.summary.length) ? it : prev;
        richer.sources = Array.from(new Set((prev.sources || [prev.source]).concat(it.sources || [it.source]).filter(Boolean)));
        if (!richer.image) richer.image = prev.image || it.image;
        byKey.set(k, richer);
        return;
      }
      it.sources = [it.source];
      byKey.set(k, it);
    });
    return Array.from(byKey.values()).sort((a, b) => b.ts - a.ts);
  }

  async function fetchAll(sources, onSource) {
    const pool = (sources || allSources()).slice();
    const collected = [], ok = [], failed = [];
    async function worker() {
      while (pool.length) {
        const src = pool.shift();
        try {
          const text = await httpText(src.url, 14000);
          const items = src.kind === 'sina' ? parseSina(text, src) : parseRss(text, src);
          if (items.length) { collected.push.apply(collected, items); ok.push(src.name); }
          else failed.push({ name: src.name, reason: '空数据' });
        } catch (e) { failed.push({ name: src.name, reason: String(e.message || e) }); }
        if (onSource) onSource(src, collected.length);
      }
    }
    await Promise.all(Array(6).fill(0).map(worker));
    return { items: dedupe(collected), ok, failed };
  }

  /* ---------------- 联网搜索（本地无结果时兜底） ----------------
   * 必应 RSS 结果经本地 /api/proxy 转发，统一转成与 RSS 完全相同的 item 结构，
   * 前端无需为「网络结果」写第二套渲染逻辑。 */
  function bingUrl(q) {
    return 'https://www.bing.com/search?format=rss&count=20&mkt=zh-CN&setlang=zh-CN&q=' + encodeURIComponent(q);
  }
  function bingDate(s) {
    // 例：周二, 17 11月 2026 00:45:00 GMT
    const m = String(s || '').match(/(\d{1,2})\s+(\d{1,2})月?\s+(\d{4})\s+(\d{2}):(\d{2})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
    return parseDate(s) || Date.now();
  }
  function parseBingRss(text, limit) {
    const out = [], re = /<item>([\s\S]*?)<\/item>/gi;
    const pick = (b, tag) => {
      const m = b.match(new RegExp('<' + tag + '>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</' + tag + '>', 'i'));
      return m ? stripTags(m[1]) : '';
    };
    let m;
    while ((m = re.exec(text)) && out.length < limit) {
      const b = m[1], title = pick(b, 'title'), link = pick(b, 'link');
      if (!title || !/^https?:\/\//i.test(link)) continue;
      const hm = link.match(/^https?:\/\/([^/?#]+)/i);
      out.push(makeItem({
        title, link, summary: pick(b, 'description').slice(0, 220),
        ts: bingDate(pick(b, 'pubDate')),
        source: hm ? hm[1].replace(/^www\./, '') : '联网搜索',
        sourceId: 'web', cat: '要闻'
      }));
    }
    return out;
  }
  async function fetchWebSearch(q, limit) {
    const query = String(q || '').trim(), n = limit || 12;
    if (!query) return [];
    const tries = [query];
    const short = query.replace(/[\s，。、！？·,\.]+/g, '').slice(0, 8);
    if (short.length >= 2 && short !== query) tries.push(short);
    for (let i = 0; i < tries.length; i++) {
      try {
        const items = parseBingRss(await httpText(bingUrl(tries[i]), 12000), n);
        if (items.length) return items;
      } catch (e) { /* 换短词再试 */ }
    }
    return [];
  }

  /* ---------------- 中文热词 ---------------- */
  const STOP = new Set(['中国', '一个', '我们', '他们', '这个', '那个', '可以', '进行', '已经', '没有', '什么', '如何', '为何', '记者', '报道', '消息', '表示', '相关', '目前', '今天', '昨日', '今日', '新闻', '最新', '发布', '公司', '市场', '国家', '世界', '问题', '方面', '出现', '成为', '通过', '有关', '以及', '对于', '其中', '之后', '此前', '同时', '开始', '一次', '这些', '那些', '不是', '就是', '还是', '可能', '应该', '需要', '能够']);
  function hotWords(items, limit) {
    const freq = new Map();
    items.forEach(it => {
      const t = it.title.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, ' ');
      t.split(/\s+/).forEach(seg => {
        if (!seg) return;
        for (let n = 2; n <= 4; n++) {
          for (let i = 0; i + n <= seg.length; i++) {
            const w = seg.slice(i, i + n);
            if (!/^[\u4e00-\u9fa5]{2,4}$/.test(w) || STOP.has(w)) continue;
            freq.set(w, (freq.get(w) || 0) + 1);
          }
        }
      });
    });
    return Array.from(freq.entries())
      .filter(([w, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, (limit || 20) * 3)
      .filter(([w], i, arr) => !arr.slice(0, i).some(([p, pc]) => p.includes(w) && pc <= arr[i][1]))
      .slice(0, limit || 20)
      .map(([word, count]) => ({ word, count }));
  }

  /* ---------------- 正文提取 ---------------- */
  const KEEP = { P: 1, H2: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, UL: 1, OL: 1, LI: 1, FIGURE: 1, FIGCAPTION: 1, IMG: 1, STRONG: 1, EM: 1, B: 1, I: 1, BR: 1, A: 1, TABLE: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, SPAN: 1, DIV: 1, SECTION: 1, HR: 1 };
  const DROP_SEL = 'script,style,noscript,iframe,form,input,button,svg,video,audio,nav,footer,aside,header,'
    + '.ad,.ads,.advert,.comment,.comments,.related,.share,.toolbar,.breadcrumb,.recommend,.sidebar,.footer,.header,'
    + '.top-bar,.top-nav,.nav-bar,.crumb,.editor,.qrcode,.qr-code,.qr_wrap,.appendQr_wrap,.login,.login-wrap,'
    + '.register,.app-download,.download,.download-app,.side-bar,.hot-news,.video-player';
  // 站点装饰图（logo / 登录头像 / 二维码 / App 下载 / 分享图标），不能混进正文
  const DECOR_IMG = /(?:logo|qrcode|qr[-_]?code|ewm|erweima|thumb_default|avatar|app2x|sinafinance_app|share[-_]?icon|spacer|pixel|blank\.(?:gif|png))/i;
  function absolutize(u, base) {
    if (!u) return '';
    u = u.trim();
    if (/^data:/.test(u)) return '';
    if (/^\/\//.test(u)) return 'https:' + u;
    try { return new URL(u, base).href; } catch (e) { return u; }
  }
  function sanitizeInto(node, base, out) {
    // 顶层 out 是数组（收集节点），递归时 out 是新建的 DOM 元素；统一走 add，避免 out.push is not a function
    const add = n => { if (Array.isArray(out)) out.push(n); else out.appendChild(n); };
    Array.prototype.forEach.call(node.childNodes, function (child) {
      if (child.nodeType === 3) {
        const t = child.nodeValue.replace(/\s+/g, ' ');
        if (t.trim()) add(document.createTextNode(t));
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName;
      if (!KEEP[tag]) { sanitizeInto(child, base, out); return; }
      if (tag === 'BR') { add(document.createElement('br')); return; }
      if (tag === 'IMG') {
        const src = child.getAttribute('data-src') || child.getAttribute('data-original') || child.getAttribute('data-lazy-src') || child.getAttribute('src') || '';
        const url = absolutize(src, base);
        const w = parseInt(child.getAttribute('width') || '0', 10);
        if (!url || w === 1 || DECOR_IMG.test(url)) return;
        const img = document.createElement('img');
        img.setAttribute('src', url); img.setAttribute('loading', 'lazy');
        if (child.getAttribute('alt')) img.setAttribute('alt', child.getAttribute('alt'));
        add(img); return;
      }
      if (tag === 'A') {
        const href = absolutize(child.getAttribute('href') || '', base);
        if (/^https?:/.test(href)) {
          const a = document.createElement('a');
          a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noreferrer noopener');
          sanitizeInto(child, base, a); add(a); return;
        }
        sanitizeInto(child, base, out); return;
      }
      const el = document.createElement(tag.toLowerCase());
      sanitizeInto(child, base, el);
      if (el.textContent.trim() || el.querySelector('img')) add(el);
    });
  }
  function extractArticle(html, url) {
    const result = { title: '', contentHtml: '', chars: 0, ok: false };
    if (typeof DOMParser === 'undefined') return result;
    let doc; try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (e) { return result; }
    if (!doc || !doc.body) return result;
    const tEl = doc.querySelector('h1') || doc.querySelector('meta[property="og:title"]');
    if (tEl) result.title = (tEl.textContent || tEl.getAttribute('content') || '').trim();
    doc.querySelectorAll(DROP_SEL).forEach(n => n.remove());
    const cands = [doc.body].concat(Array.prototype.slice.call(doc.querySelectorAll('article, .article, .content, .article-content, #content, .post, .post-content, .detail, #artibody, .main-content, .text, #detail')));
    // body 与嵌套的正文容器常常包含同一批 <p>，绝对分数完全相同；
    // 若让先出现的 body 胜出，整站导航 / 登录框 / App 二维码都会被当成正文。
    // 给明确的正文容器加权、body 降权，同分时选更内层的容器。
    let best = null, bestScore = 0;
    cands.forEach(c => {
      const ps = c.querySelectorAll('p');
      if (!ps.length) return;
      let len = 0, n = 0;
      Array.prototype.forEach.call(ps, p => { const t = (p.textContent || '').trim().length; if (t > 20) { len += t; n++; } });
      let score = len + n * 30 + (c.tagName === 'ARTICLE' ? 200 : 0);
      const tag = ((c.id || '') + ' ' + (c.className || '')).toLowerCase();
      if (/artibody|article[-_]?content|post[-_]?content|entry[-_]?content|rich_media_content|detail[-_]?content/.test(tag)) score += 400;
      if (c === doc.body) score *= 0.5;
      if (score > bestScore || (score === bestScore && best && best.contains(c))) { bestScore = score; best = c; }
    });
    if (!best) best = doc.body;
    const out = []; sanitizeInto(best, url, out);
    const wrap = doc.createElement('div');
    out.forEach(n => wrap.appendChild(n));
    wrap.querySelectorAll('p, div').forEach(p => {
      const txt = (p.textContent || '').trim();
      if (!p.querySelector('img') && txt.length < 14 && !p.querySelector('a, strong, em')) p.remove();
    });
    wrap.querySelectorAll('div').forEach(d => { if (!d.textContent.trim() && !d.querySelector('img')) d.remove(); });
    result.contentHtml = wrap.innerHTML;
    result.chars = (wrap.textContent || '').replace(/\s/g, '').length;
    const head = (wrap.textContent || '').replace(/\s+/g, '').slice(0, 120);
    // 质量标记：抓到的是站点导航 / 登录墙 / 下载页时，宁可退回 RSS 摘要，
    // 也不能把整页 UI 塞进阅读器
    result.ok = result.chars >= 150 && !/新浪首页|移动客户端|通行证注册|扫码下载|扫一扫|下载新浪财经/.test(head);
    return result;
  }

  const Core = {
    SOURCES, CATS, BOARDS, FLASH, LIVE_CHANNELS,
    setCustomSources, allSources, fetchAll, fetchBoards, fetchBoard, fetchFlash,
    parseBoard, parseFlash, parseRss, parseSina, dedupe, makeItem, extractArticle,
    httpText, stripTags, esc, hash, parseDate, hotWords, summarize, sentences,
    CITIES, fetchWeather, fetchAlarms, weatherDesc, weatherIcon,
    fetchStocks, fetchArticleImage, fetchWebSearch
  };
  global.NewsCore = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
