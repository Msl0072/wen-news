# 文 · 实时资讯工作台（Web 在线版）

一套「Python 标准库 HTTP 服务 + 原生 JS 前端」的实时新闻工作台：19 个信源聚合、全网热榜、7×24 快讯、央视直播轮播、天气与大盘行情、搜索、收藏与归档。

前端（`web/`）与桌面 EXE、安卓 APK 共用同一份代码，本仓库是从 `在线版/` 整理出的**可直接托管运行**版本。

## 目录结构

```
main.py             HTTP 服务入口：静态资源 + 新闻代理 + 可选 AI 转发
requirements.txt    仅标准库，无第三方依赖
web/index.html      页面骨架
web/css/style.css   全部样式（含响应式）
web/js/news-core.js 数据层：信源、解析、去重、正文提取、天气、预警、行情
web/js/app.js       UI 层：渲染、交互、状态、localStorage 持久化
render.yaml         Render 一键部署蓝图
Procfile            Railway / Zeabur 等平台的启动声明
```

服务端接口：

| 路径 | 用途 |
| --- | --- |
| `/api/proxy?u=<url>` | 新闻 / 天气 / 行情转发，规避浏览器 CORS，60 秒缓存 |
| `/api/health` | 健康检查，返回 `{"ok": true, "version": "3.7.9"}` |
| `/api/open?u=<url>` | 桌面端用系统浏览器打开外链 |
| `/api/top?on=0\|1` | 桌面端窗口置顶 |
| `POST /api/ai` | 可选，转发 OpenAI 兼容接口用于 AI 总结 |

## 本地运行

```bash
python main.py
# 打开 http://127.0.0.1:8731/index.html
```

## 部署到 GitHub + 免费平台

GitHub Pages 只能托管静态文件，跑不了 `main.py`，`/api/proxy` 不存在时前端会被跨域拦住、抓不到任何新闻。所以做法是：**代码放 GitHub，平台从 GitHub 拉代码运行 Python 服务**。

### 第一步：推到 GitHub

```bash
git init -b main
git add .
git commit -m "chore: init 文 在线版部署仓库"
git remote add origin https://github.com/<你的用户名>/wen-news.git
git push -u origin main
```

（先在 GitHub 网页上新建一个空仓库 `wen-news`，不要勾选 README / .gitignore。）

### 第二步：Render 部署（推荐，免费）

1. 用 GitHub 账号登录 <https://render.com>。
2. 右上角 **New +** → **Blueprint**。
3. 选择刚推送的 `wen-news` 仓库，Render 会自动识别根目录的 `render.yaml`。
4. 点 **Apply**，等待首次构建（约 1~3 分钟）。
5. 部署完成后拿到形如 `https://wen-news-xxxx.onrender.com` 的 HTTPS 地址，手机流量、微信里都能直接打开。

平台会注入 `PORT` 环境变量，`main.py` 检测到后自动改为监听 `0.0.0.0`、只起服务不开窗口。

### 备选：Railway / Zeabur

同样是 GitHub 授权 → 选择仓库 → 部署，构建命令 `pip install -r requirements.txt`，启动命令 `python main.py`（`Procfile` 已写好，多数平台会自动读取）。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `PORT` | 平台注入。设置后进入托管模式：绑定 `0.0.0.0`、只跑服务 |
| `WEN_LAN` | 设为 `1` 时监听所有网卡，供同一 WiFi 下手机 / 微信访问 |
| `WEN_NO_WINDOW` | 设为 `1` 时不打开桌面窗口，只跑 HTTP 服务 |
| `WEN_PORT` | 强制指定本地端口（默认 8731 起自动挑选） |

## 注意事项

- **免费实例会休眠**：Render 免费版约 15 分钟无访问后休眠，下一次访问首屏需等 30~60 秒唤醒；升级付费实例或定时访问 `/api/health` 可规避。
- **抓取速度**：托管节点在海外，访问新浪、央视等国内站点可能偏慢或偶发失败，前端会自动跳过失败信源并显示在线源数量。对速度敏感可换香港 / 新加坡节点（`render.yaml` 的 `region`）。
- **无鉴权**：站点公开可访问，且 `/api/proxy` 已禁止访问内网、环回、链路本地地址（防 SSRF），但请不要大范围公开传播。
- **数据不共享**：收藏、稍后读、设置、归档都存在浏览器 `localStorage`，域名不同即各存各的。

## 其它形态

- 桌面 EXE：`python -m PyInstaller --onefile --windowed --icon icon.ico --add-data "web;web" --name 文 main.py`
- 安卓 APK：`python android/build_apk.py`（WebView 以 `file://` 加载 `assets/web`，走原生桥而非 `/api/proxy`）
