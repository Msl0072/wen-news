# -*- coding: utf-8 -*-
"""
文 · 桌面版
本地 HTTP 服务（静态资源 + 新闻代理） + 原生窗口（WebView2）
仅依赖 Python 标准库 + pywebview（打包时已内置）
"""
import os
import re
import sys
import json
import time
import gzip
import socket
import ipaddress
import threading
import webbrowser
import urllib.request
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

APP_NAME = "文"
VERSION = "3.7.9"
BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(BASE_DIR, "web")

# WEN_LAN=1 时监听所有网卡，供同一 WiFi 下的手机 / 微信访问；
# 平台托管会注入 PORT，此时自动进入「纯服务 + 监听所有网卡」模式；
# 两者都不设时仍只监听 127.0.0.1，桌面版行为不变。
PLATFORM_PORT = os.environ.get("PORT")
LAN_MODE = os.environ.get("WEN_LAN") == "1" or bool(PLATFORM_PORT)
NO_WINDOW = os.environ.get("WEN_NO_WINDOW") == "1" or bool(PLATFORM_PORT)
BIND_HOST = "0.0.0.0" if LAN_MODE else "127.0.0.1"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

_MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}

_cache = {}          # url -> (ts, text)
_CACHE_TTL = 60
_cache_lock = threading.Lock()


def _decode(raw, header_charset=None):
    """按声明顺序尝试解码，兼容 GBK 系站点"""
    if header_charset:
        try:
            return raw.decode(header_charset, "ignore")
        except Exception:
            pass
    head = raw[:2048].decode("ascii", "ignore")
    m = re.search(r'encoding=["\']([\w-]+)', head, re.I) or re.search(r'charset=["\']?([\w-]+)', head, re.I)
    if m:
        cs = m.group(1).lower()
        if cs in ("gb2312", "gbk", "gb18030"):
            cs = "gb18030"
        try:
            return raw.decode(cs, "ignore")
        except Exception:
            pass
    for cs in ("utf-8", "gb18030", "big5", "latin-1"):
        try:
            return raw.decode(cs)
        except Exception:
            continue
    return raw.decode("utf-8", "ignore")


def fetch(url, timeout=15, no_cache=False):
    now = time.time()
    if not no_cache:
        with _cache_lock:
            hit = _cache.get(url)
            if hit and now - hit[0] < _CACHE_TTL:
                return hit[1]

    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        # 注意：不要带 Referer（新浪滚动接口会 403 同源 Referer），也不要协商压缩
        "Accept-Encoding": "identity",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        enc = (resp.headers.get("Content-Encoding") or "").lower()
        if "gzip" in enc:
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
        cs = None
        ct = resp.headers.get("Content-Type") or ""
        m = re.search(r"charset=([\w-]+)", ct, re.I)
        if m:
            cs = m.group(1)
        text = _decode(raw, cs)

    if not no_cache:
        with _cache_lock:
            if len(_cache) > 400:
                _cache.clear()
            _cache[url] = (time.time(), text)
    return text


# 行情类接口必须每次回源，不能被 60 秒缓存挡住，也不能写入缓存池
_REALTIME_HOSTS = ("qt.gtimg.cn", "push2.eastmoney.com", "hq.sinajs.cn")


def _is_public_url(url):
    """线上部署时禁止 /api/proxy 访问内网 / 环回 / 链路本地地址，
    避免公开链接被当成 SSRF 跳板。域名交给 DNS，这里只拦明显的字面 IP。"""
    try:
        p = urllib.parse.urlsplit(url)
        if p.scheme not in ("http", "https"):
            return False
        host = p.hostname or ""
        if host.lower() in ("localhost", "metadata.google.internal", "0.0.0.0"):
            return False
        try:
            ip = ipaddress.ip_address(host)
            return not (ip.is_private or ip.is_loopback or ip.is_link_local
                        or ip.is_reserved or ip.is_multicast)
        except ValueError:
            return True
    except Exception:
        return False


class Handler(SimpleHTTPRequestHandler):
    server_version = "Wen/" + VERSION

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB_DIR, **kw)

    # 安静一点，别刷控制台
    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype="text/plain; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def do_POST(self):
        """可选：转发 OpenAI 兼容的大模型请求（用于 AI 总结）"""
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path != "/api/ai":
            return self._send(404, "not found")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n).decode("utf-8", "ignore"))
            base = body.get("base", "")
            if not base.startswith("https://"):
                return self._send(400, "bad base url")
            payload = json.dumps({
                "model": body.get("model") or "gpt-4o-mini",
                "messages": body.get("messages") or [],
                "temperature": 0.3,
                "max_tokens": 600
            }).encode("utf-8")
            req = urllib.request.Request(
                base.rstrip("/") + "/chat/completions",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + str(body.get("key") or ""),
                    "User-Agent": UA,
                },
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                text = resp.read().decode("utf-8", "ignore")
            return self._send(200, text, "application/json")
        except Exception as e:
            return self._send(502, json.dumps({"error": str(e)}), "application/json")

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/api/proxy":
            url = (qs.get("u") or [""])[0]
            if not url.startswith(("http://", "https://")) or not _is_public_url(url):
                return self._send(400, "bad url")
            try:
                # 行情接口直连回源；其余资源沿用 60 秒缓存
                realtime = (qs.get("nc") or ["0"])[0] == "1" or any(h in url for h in _REALTIME_HOSTS)
                text = fetch(url, no_cache=realtime)
                return self._send(200, text, "text/plain; charset=utf-8")
            except Exception as e:
                return self._send(502, "fetch failed: %s" % e)

        if path == "/api/open":
            url = (qs.get("u") or [""])[0]
            if url.startswith(("http://", "https://")):
                # 局域网/微信访问时不要在服务器上弹浏览器，前端会自行 window.open
                if self.client_address[0].startswith(("127.", "::1")):
                    try:
                        webbrowser.open(url)
                    except Exception:
                        pass
                return self._send(200, "ok")
            return self._send(400, "bad url")

        if path == "/api/top":
            on = (qs.get("on") or ["0"])[0] == "1"
            try:
                if _WINDOW is not None:
                    _WINDOW.on_top = on
            except Exception:
                pass
            return self._send(200, "ok")

        if path == "/api/health":
            return self._send(200, json.dumps({"ok": True, "version": VERSION}), "application/json")

        if path in ("/", ""):
            path = "/index.html"

        fpath = os.path.join(WEB_DIR, path.lstrip("/").replace("/", os.sep))
        if not os.path.isfile(fpath):
            return self._send(404, "not found")

        ext = os.path.splitext(fpath)[1].lower()
        ctype = _MIME.get(ext, "application/octet-stream")
        try:
            with open(fpath, "rb") as f:
                data = f.read()
        except Exception as e:
            return self._send(500, str(e))
        if path == "/index.html":
            # 由服务端注入代理标记：用局域网 IP / 域名访问时也能走 /api/proxy，
            # 否则前端会直连新闻源被 CORS 拦住，微信里抓不到任何新闻。
            # 平台经反向代理访问时来源可能是本机，强制按「远程」处理
            remote = bool(PLATFORM_PORT) or not self.client_address[0].startswith(("127.", "::1"))
            hook = ('<script>window.__PROXY__="/api/proxy?u=";'
                    'window.__WEN_REMOTE__=%s;</script>' %
                    ("true" if remote else "false")).encode("utf-8")
            data = data.replace(b"<!--WEN_PROXY_HOOK-->", hook)
        self._send(200, data, ctype)


_WINDOW = None


def lan_ips():
    """只返回当前上网网卡的 IPv4（微信 / 手机同 WiFi 用这个）。
    不再枚举所有网卡：169.254.* 自动专用地址、VMware/WSL 虚拟网卡
    混进来会误导用户。"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("223.5.5.5", 80))   # UDP connect 不实际发包，只为取默认出口网卡
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith(("127.", "169.254.", "0.")):
            return [ip]
    except Exception:
        pass
    return []


def pick_port():
    # 允许显式指定端口（便于调试时避开已运行的实例）
    env = PLATFORM_PORT or os.environ.get("WEN_PORT")
    if env and env.isdigit() and 0 < int(env) < 65535:
        return int(env)
    for port in range(8731, 8831):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((BIND_HOST, port))
            s.close()
            return port
        except OSError:
            continue
    return 8731


def main():
    port = pick_port()
    httpd = ThreadingHTTPServer((BIND_HOST, port), Handler)
    httpd.daemon_threads = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    url = "http://127.0.0.1:%d/index.html" % port
    if LAN_MODE and not PLATFORM_PORT:
        # 用纯 ASCII，避免控制台代码页不同时中文提示变成乱码
        print("LAN mode: listening on %s:%d" % (BIND_HOST, port), flush=True)
        for ip in lan_ips():
            print("LAN URL (phone / WeChat): http://%s:%d/index.html" % (ip, port), flush=True)
    if PLATFORM_PORT:
        print("Hosted mode: listening on %s:%d" % (BIND_HOST, port), flush=True)

    # 调试 / 平台托管：只起服务，不开窗口
    if NO_WINDOW:
        print("serving on " + url, flush=True)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return

    try:
        import webview
    except Exception:
        webview = None

    if webview is not None:
        try:
            window = webview.create_window(
                title=APP_NAME + " · 实时资讯工作台",
                url=url,
                width=1480,
                height=940,
                min_size=(880, 600),
                background_color="#f4f6fa",
                text_select=True,
            )
            global _WINDOW
            _WINDOW = window
            # pywebview 默认 private_mode=True：每次退出会删掉 WebView2 用户数据目录，
            # localStorage（主题 / 城市 / 筛选 / 收藏 / 7 日归档）全部丢失，
            # 表现就是「每次打开上次的设置都不一样」。关闭私有模式并固定档案目录。
            storage = os.path.join(
                os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'WenWorkbench')
            try:
                os.makedirs(storage, exist_ok=True)
                if not os.access(storage, os.W_OK):
                    storage = None
            except Exception:
                storage = None
            webview.start(private_mode=False, storage_path=storage)
            return
        except Exception:
            pass

    # 兜底：默认浏览器
    webbrowser.open(url)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
