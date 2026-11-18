/**
 * POST /api/ai
 * 可选：把浏览器端填写的 OpenAI 兼容接口转发出去，用于「AI 总结」。
 * 未配置时前端会自动回退到本地抽取式摘要。
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36';

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const base = String(body.base || '');
    if (!base.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'bad base url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    const upstream = await fetch(base.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + String(body.key || ''),
        'User-Agent': UA,
      },
      body: JSON.stringify({
        model: body.model || 'gpt-4o-mini',
        messages: body.messages || [],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e && e.message) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
