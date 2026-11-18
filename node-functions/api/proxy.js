/**
 * /api/proxy?u=<url>
 * 将外部新闻 / 天气 / 行情接口转发到同源，绕开浏览器 CORS。
 * 与原先 Python 版行为一致：无缓存、行情域名直连回源、禁止访问内网地址。
 */
import net from 'node:net';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', '0.0.0.0']);

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd');
  }
  return false;
}

/** 公开代理必须拒绝内网 / 环回 / 链路本地地址，避免被当成 SSRF 跳板 */
function isPublicUrl(raw) {
  let p;
  try {
    p = new URL(raw);
  } catch {
    return false;
  }
  if (p.protocol !== 'http:' && p.protocol !== 'https:') return false;
  const host = p.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return false;
  if (net.isIP(host)) return !isPrivateIp(host);
  return true;
}

/** 按声明顺序尝试解码，兼容 GBK 系站点（Node 20 自带完整 ICU） */
function decodeText(buf, contentType) {
  const head = Buffer.from(buf.subarray(0, 2048)).toString('latin1');
  const m =
    /charset=["']?([\w-]+)/i.exec(contentType || '') ||
    /encoding=["']([\w-]+)/i.exec(head) ||
    /charset=["']?([\w-]+)/i.exec(head);
  if (m) {
    let cs = m[1].toLowerCase();
    if (cs === 'gb2312' || cs === 'gbk') cs = 'gb18030';
    try {
      return new TextDecoder(cs).decode(buf);
    } catch {
      /* 未知编码，继续兜底 */
    }
  }
  for (const cs of ['utf-8', 'gb18030', 'big5']) {
    try {
      return new TextDecoder(cs, { fatal: true }).decode(buf);
    } catch {
      /* 下一个 */
    }
  }
  return new TextDecoder('utf-8').decode(buf);
}

export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(target) || !isPublicUrl(target)) {
    return new Response('bad url', { status: 400 });
  }
  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        // 不要带 Referer：新浪滚动接口会 403 同源 Referer
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    const buf = new Uint8Array(await upstream.arrayBuffer());
    const text = decodeText(buf, upstream.headers.get('content-type'));
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response('fetch failed: ' + (e && e.message), {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
