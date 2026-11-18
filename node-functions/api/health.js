/** GET /api/health —— 部署后用于确认函数与静态资源是否在线 */
export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, version: '3.7.9', runtime: 'edgeone-node' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
