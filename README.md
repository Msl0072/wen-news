# 文 · 实时资讯工作台（Web 在线版）

一套「静态前端 + 轻量转发接口」的实时新闻工作台：19 个信源聚合、全网热榜、7×24 快讯、央视直播轮播、天气与大盘行情、搜索、收藏与归档。

前端 `web/` 与桌面 EXE、安卓 APK 共用同一份代码；本仓库是**可直接部署到 EdgeOne Pages** 的 Web 版本，转发接口用 Node Functions 实现（21 个新闻源多为 GBK 编码，函数内按声明顺序解码）。

## 目录结构

```
web/                         Pages 输出目录（index.html + css/ + js/）
node-functions/api/proxy.js  /api/proxy：新闻 / 天气 / 行情转发，绕开 CORS
node-functions/api/ai.js     /api/ai：可选，转发 OpenAI 兼容接口做 AI 总结
node-functions/api/health.js /api/health：健康检查
edgeone.json                 输出目录、Node 版本、函数超时
main.py / requirements.txt   本地 / 桌面版服务（仅 Python 标准库，可选）
```

接口：

| 路径 | 用途 |
| --- | --- |
| `GET /api/proxy?u=<url>` | 转发外部接口，禁止访问内网 / 环回 / 链路本地地址（防 SSRF） |
| `GET /api/health` | 返回 `{"ok":true,"version":"3.7.9"}` |
| `POST /api/ai` | 转发 OpenAI 兼容的 `/chat/completions`，用于 AI 总结 |

## 本地预览

```bash
npm install -g edgeone
edgeone pages dev          # 同时跑静态页和 node-functions
```

或只跑 Python 版本地服务：`python main.py`，打开 http://127.0.0.1:8731/index.html。

## 部署到 EdgeOne Pages

1. 打开 https://console.cloud.tencent.com/edgeone/pages ，用腾讯云账号登录（需完成实名认证）
2. **创建项目** → 选择 **导入 Git 仓库**，授权 GitHub 后选 `Msl0072/wen-news`
3. 框架预设选 **其他 / 静态站点**，构建命令留空（仓库里 `edgeone.json` 已声明输出目录 `web`、Node `20.18.0`）
4. 点击部署，首次构建约 1~2 分钟
5. 构建完成后到项目的 **域名管理** 使用平台分配的默认域名访问；也可绑定自己的域名

部署成功后可以访问：

- `https://<你的域名>/` —— 页面
- `https://<你的域名>/api/health` —— 应返回 `{"ok":true,...}`
- `https://<你的域名>/api/proxy?u=https%3A%2F%2Fnews.sina.com.cn` —— 应返回到新闻页 HTML

## 注意事项

- 线上版与本地 EXE / 局域网版的收藏、设置、归档各自独立（域名不同，`localStorage` 不共享）。
- Node Function 单次运行上限 30 秒（`edgeone.json` 的 `maxDuration`），代理请求超时按 15 秒设置。
- 站点无登录鉴权，`/api/proxy` 已限制内网地址，但请不要大范围公开传播。
- 海外/国内节点抓取国内媒体速度不同，个别源偶发失败会自动跳过并显示在线源数量。

## 其它形态

- 桌面 EXE：`python -m PyInstaller --onefile --windowed --icon icon.ico --add-data "web;web" --name 文 main.py`
- 安卓 APK：`python android/build_apk.py`（WebView 以 `file://` 加载 `assets/web`，走原生桥而非 `/api/proxy`）
