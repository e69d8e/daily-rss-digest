# Daily RSS Digest（每日 RSS 智汇晨报）

现代化、自托管、支持云端 Serverless 部署的每日多源 RSS 智能聚合、聚类提炼与多端触达平台。支持自定义多主题频道、关键词规则过滤、跨源降噪聚类、三协议 AI 提炼引擎（Chat Completions / Responses / Claude Messages）、语音早报（TTS）、OPML 批量迁移导入导出，以及飞书、企业微信、Telegram、Discord 和邮件 Newsletter 多渠道自动分发。

---

## 🏛️ 系统架构 (Architecture)

```mermaid
flowchart TD
    subgraph Ingestion["1. 资讯摄取与解析层"]
        RSS["各源 RSS / Atom / JSON Feed"] --> Parser["rss-parser 解析引擎"]
        Parser --> FullText{"是否开启全文抓取?"}
        FullText -- 是 --> Cheerio["Cheerio 正文提取与清洗"]
        FullText -- 否 --> Filter["关键词黑白名单过滤"]
        Cheerio --> Filter
        OPML["OPML 文件"] --> OpmlParser["fast-xml-parser 导入导出"]
    end

    subgraph Storage["2. 持久化存储引擎 (Prisma + LibSQL / SQLite)"]
        Filter --> ArticleDB[("文章库 Article")]
        OpmlParser --> DB_Source[("数据源 FeedSource")]
        ChannelDB[("频道表 Channel")]
        DigestDB[("简报表 DailyDigest")]
        SettingsDB[("系统设置 SystemSetting")]
        LogDB[("投递日志 DeliveryLog")]
    end

    subgraph Intelligence["3. AI 智能聚类提炼引擎"]
        ArticleDB --> AISummarizer["多协议 AI 提炼引擎 (callLlmModel)"]
        SettingsDB -. 提供 Provider 与协议配置 .-> AISummarizer
        AISummarizer --> ModeA["Chat Completions (OpenAI/DeepSeek/Ollama)"]
        AISummarizer --> ModeB["Responses API (OpenAI 最新规范)"]
        AISummarizer --> ModeC["Messages API (Claude 原生规范)"]
        AISummarizer --> Synthesis["跨源议题聚类 & 影响力打分"]
        Synthesis --> AudioScript["生成 TTS 播音文稿"]
        Synthesis --> DigestDB
    end

    subgraph Security["4. 安全防护与管理隔离层"]
        AdminLock["管理密码访问锁 (ADMIN_PASSWORD)"] --> SettingsGuard["/settings 路由与 API 鉴权拦截 (401)"]
        MaskingEngine["接口数据脱敏引擎"] --> SecretProtection["API Key / Webhook 掩码保护"]
        EnvInjection["云端环境变量直接注入 (AI_API_KEY)"] --> Isolation["零数据库存储与物理隔离"]
    end

    subgraph Delivery["5. 多端分发与交互体验层"]
        DigestDB --> WebApp["报刊式现代化 Web 阅览器 (Next.js 16 + React 19)"]
        WebApp --> TTS["客户端 Web Speech API 原生流式语音早报"]
        DigestDB --> Dispatcher["多渠道通知派发器 (Notification Dispatcher)"]
        Dispatcher --> Feishu["飞书机器人 (Interactive Card)"]
        Dispatcher --> WeCom["企业微信机器人 (Markdown)"]
        Dispatcher --> TG["Telegram Bot (MarkdownV2)"]
        Dispatcher --> Discord["Discord Webhook (Embed)"]
        Dispatcher --> Email["邮件 Newsletter (Nodemailer SMTP)"]
        DigestDB --> ExtRSS["对外输出聚合 RSS (/api/feed/[slug]/rss.xml)"]
    end
```

---

## 🛠️ 技术栈清单 (Tech Stack)

| 领域 | 核心选型 | 说明 |
|---|---|---|
| **全栈框架** | Next.js 16.2 (App Router) | 高性能前后端一体，React 19 Server & Client Components，原生集成 Turbopack |
| **语言与类型** | TypeScript 5 | 全链路严格类型保证，前后端同构类型定义 |
| **样式与设计** | Tailwind CSS v4 + Lucide Icons | 报刊杂志优雅排版，响应式移动端深度适配与无框架矢量设计 |
| **数据持久化** | Prisma ORM 6.19 + LibSQL / SQLite | 支持单文件本地存储 (`dev.db`) 或无缝切换 Turso Cloud Serverless 分布式数据库 |
| **RSS & 网页爬虫** | `rss-parser` + `cheerio` | 兼容 RSS 2.0 / Atom 1.0，正文智能提取、清洗与截断源深度抓取 |
| **OPML 处理** | `fast-xml-parser` | 支持从 Feedly、Follow、NetNewsWire 等主流阅读器无缝双向导入导出 |
| **多协议 AI 引擎** | 原生 Fetch 统一抽象 | 适配 **Chat Completions**（主流/DeepSeek）、**Responses**（OpenAI 最新）与 **Messages**（Claude 原生）|
| **音频体验** | Web Speech API | 零第三方延迟、浏览器原生流式语音播报，支持播放/暂停/文稿联播 |
| **通知派发** | Webhook + `nodemailer` | 原生接入飞书富文本卡片、企业微信、Telegram、Discord 与 SMTP 邮件 |
| **聚合分发** | `feed` | 将提炼后的晨报输出为标准聚合 RSS 2.0，供第三方阅读器反向订阅 |
| **云端部署** | Netlify + Turso | 标准 Netlify Functions / Next.js Serverless 架构，开箱即用 |

---

## ⏱️ 核心业务时序图 (Daily Digest Lifecycle)

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户 / 定时任务 (Cron)
    participant API as Next.js API (/api/digests)
    participant Engine as 晨报生成引擎 (Digest Generator)
    participant RSS as RSS 源站点
    participant DB as LibSQL / SQLite (Prisma)
    participant AI as AI 多协议提炼引擎
    participant Push as 消息派发 (Webhook / Email)

    User->>API: 触发生成晨报 (手动触发或定时 Cron)
    API->>Engine: 调用 generateDailyDigestForChannel(channelId, date)
    Engine->>DB: 查询当前频道关联的 RSS 源与关键词过滤规则
    loop 遍历频道订阅源
        Engine->>RSS: 抓取最新 Feed XML
        RSS-->>Engine: 返回文章列表
        alt 开启正文抓取
            Engine->>RSS: HTTP 请求抓取文章 HTML 并用 Cheerio 清洗正文
        end
        Engine->>DB: 留存文章记录并执行关键词黑白名单过滤
    end
    Engine->>AI: 提交文章候选集，根据频道 Prompt 进行跨源聚类与 TL;DR 提炼
    AI-->>Engine: 返回聚合议题、影响力评分、深度洞察与 TTS 语音文稿
    Engine->>DB: Upsert 存储当日 DailyDigest
    Engine->>Push: 派发飞书 / 企微 / Telegram / Discord / 邮件通知
    Push-->>Engine: 写入 DeliveryLog 投递日志
    Engine-->>API: 返回最新排版的完整晨报数据
    API-->>User: 前端报刊视图实时渲染并就绪语音早报播放
```

---

## 🗄️ 数据模型表 (Database Schema)

| 数据表 | 字段 | 类型 | 说明 |
|---|---|---|---|
| `Channel` | `id`, `name`, `slug`, `description`, `icon`, `scheduleTime`, `promptTemplate`, `filterKeywords`, `isEnabled` | String / Boolean | 频道主题与规则定制表（包含个性化 Prompt 规则与过滤词） |
| `FeedSource` | `id`, `channelId`, `title`, `url`, `siteUrl`, `isFullTextFetch`, `lastFetchedAt`, `status`, `lastError` | String / DateTime / Boolean | RSS 订阅源信息与运行健康状态 |
| `Article` | `id`, `feedSourceId`, `title`, `link`, `author`, `publishedAt`, `summarySnippet`, `fullContent` | String / DateTime | 抓取到的原始文章快照缓存表 |
| `DailyDigest` | `id`, `channelId`, `date`, `title`, `overview`, `sectionsJson`, `rawAiOutput`, `audioText`, `articleCount`, `status` | String / Int | 每日智能晨报聚合数据（复合唯一键：`channelId` + `date`） |
| `SystemSetting` | `key`, `value`, `description`, `updatedAt` | String / DateTime | 全局 AI Provider、协议规范、密钥与 Webhook/SMTP 推送配置 |
| `DeliveryLog` | `id`, `digestId`, `targetType`, `targetDestination`, `status`, `message`, `sentAt` | String / DateTime | 多渠道通知推送记录与投递日志 |

---

## 🔒 安全防护机制 (Security Architecture)

为了杜绝云端部署时 API Key 等核心机密发生泄露，系统构建了**三重防泄露安全屏障**：

### 1. 访问控制：设置中心管理密码锁 (`ADMIN_PASSWORD`)
- 在环境变量中设置 `ADMIN_PASSWORD` 后，访问 `/settings` 会立即激活管理验证锁屏卡片。
- 未输入密码的访客无法查看或修改任何配置；调用 `/api/settings` 和 `/api/test-ai` 会被后端直接拦截并返回 `HTTP 401 Unauthorized`。
- 验证成功后通过 HttpOnly Cookie（`admin_session`，30 天免密）维持鉴权，支持随时一键注销锁定。

### 2. 接口脱敏：API Key 与 Webhook 永不暴露明文
- 调用 `GET /api/settings` 获取配置时，服务端自动进行掩码脱敏处理（例如：`sk-c••••••••a5wn`）。
- 浏览器网络 DevTools、抓包工具或第三方插件无法获取真实密钥字符串。
- 连通性测试接口（`POST /api/test-ai`）支持自动识别脱敏占位符，由服务端在底层直接调用存储的密钥进行探测，无需前端传回明文。

### 3. 架构隔离：云端 Serverless 环境变量直接注入 (`AI_API_KEY`)
- 支持在 Netlify 或 Vercel 等平台的环境变量中直接注入 `AI_API_KEY`。
- 此时系统进入**物理隔离模式**：API Key 永远不写入数据库，由云端运行时统一托管，前端显示 `🔒 云端环境变量已注入 (安全防泄露)` 并自动锁定输入框。

---

## 🚀 环境搭建与快速开始 (Getting Started)

### 1. 克隆与安装依赖

```bash
git clone <your-repo-url>
cd daily-rss-digest

# 安装 Node 依赖
npm install
```

### 2. 配置环境变量 (`.env`)

复制环境配置模板：

```bash
cp .env.example .env
```

根据您的运行环境选择以下配置方案：

#### 方案 A：本地开发模式（基于本地单文件 SQLite）

```env
# 留空 TURSO 变量即自动回退至本地 SQLite
TURSO_DATABASE_URL=""
TURSO_AUTH_TOKEN=""

# 管理员安全访问密码（留空则不开启访问锁）
ADMIN_PASSWORD="your_admin_secret_password"

# 定时任务安全调用秘钥
CRON_SECRET="rss_digest_secret_key_2026"
```

#### 方案 B：云端与生产模式（基于 Turso Cloud LibSQL）

```env
TURSO_DATABASE_URL="libsql://your-db-name.turso.io"
TURSO_AUTH_TOKEN="your_turso_jwt_token"

ADMIN_PASSWORD="your_strong_admin_password"
AI_API_KEY="sk-your-ai-api-key"
CRON_SECRET="your_production_cron_secret"
```

### 3. 初始化数据库结构与种子数据

```bash
# 自动根据环境（本地 SQLite 或 Turso Cloud）推送表结构
npm run prisma:push

# 注入默认精品科技频道、精选热门 RSS 源与演示晨报
npm run db:seed
```

### 4. 启动本地开发服务

```bash
npm run dev
```

在浏览器打开 [http://localhost:3000](http://localhost:3000)，即可体验杂志级晨报排版与语音早报。

### 5. 编译与运行生产版本

```bash
npm run build
npm run start
```

---

## ☁️ 云端部署指南：Netlify + Turso Serverless (Cloud Deployment)

本项目已针对 Netlify Serverless 进行了完整适配，开箱即用。

### 步骤 1：准备 Turso 云原生数据库
1. 前往 [Turso 官网](https://turso.tech) 注册并创建免费数据库：
   ```bash
   turso db create daily-rss-digest
   turso db tokens create daily-rss-digest
   ```
2. 获取数据库 URL（以 `libsql://` 开头）与 Token。

### 步骤 2：部署到 Netlify
1. 将代码推送到 GitHub / GitLab 私有仓库。
2. 登录 [Netlify 控制台](https://app.netlify.com)，点击 **Add new site** -> **Import an existing project**。
3. 选择对应代码仓库，Netlify 会自动识别根目录下的 [`netlify.toml`](./netlify.toml) 配置：
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`

### 步骤 3：在 Netlify 后台配置环境变量
进入站点设置中的 **Site configuration** -> **Environment variables**，添加以下环境变量：

| 变量名 | 必填 | 示例 / 说明 |
|---|:---:|---|
| `TURSO_DATABASE_URL` | 是 | `libsql://daily-rss-digest-xxxx.turso.io` |
| `TURSO_AUTH_TOKEN` | 是 | Turso 生成的访问 JWT Token |
| `ADMIN_PASSWORD` | 是 | 生产环境设置中心访问密码（防未授权访问） |
| `AI_API_KEY` | 推荐 | `sk-...` 直接在平台注入，API Key 不入库、不暴露 |
| `CRON_SECRET` | 是 | 外部调用定时触发接口时的鉴权令牌 |

部署完成后，点击 Netlify 提供的专属域名即可直接在线访问。

### 步骤 4：配置 GitHub Actions 自动化定时任务（彻底规避 Serverless 超时）
为彻底解决 Serverless 平台对长耗时任务（多源爬虫与大模型深度提炼）的 10 秒超时限制，项目内置了全自动化 GitHub Actions 工作流（[`.github/workflows/daily-digest.yml`](./.github/workflows/daily-digest.yml)）：

1. 进入代码仓库的 **Settings** -> **Secrets and variables** -> **Actions**。
2. 点击 **New repository secret**，配置以下密钥：
   - `TURSO_DATABASE_URL`：Turso 云数据库连接串（`libsql://...`）
   - `TURSO_AUTH_TOKEN`：Turso 访问 Token
   - `BASE_URL`：（可选）线上访问域名，例如 `https://daily-rss-digest.netlify.app`
   - `AI_API_KEY`：（可选）若未在 Web 设置中心配置，可直接在此注入
3. **运行机制**：
   - **每日定时**：每天北京时间早晨 **08:00**（UTC 00:00）自动抓取全网源并写入 Turso 数据库。
   - **手动一键触发**：进入 GitHub **Actions** 页面，选择 **Daily RSS Digest Generator** -> **Run workflow**，即可按需随时触发即时生成。

---

## 📡 核心 API 清单 (API Reference)

### 1. 安全鉴权接口 (`/api/auth`)
- `GET /api/auth`：查询系统是否启用了管理员密码及当前用户是否已登录。
- `POST /api/auth`：校验管理员密码，成功后写入 HttpOnly 安全 Cookie。
- `DELETE /api/auth`：退出登录，销毁当前管理会话。

### 2. 晨报聚合接口 (`/api/digests`)
- `GET /api/digests?channelId={id}&date={YYYY-MM-DD}`：查询指定频道与日期的完整排版数据。
- `GET /api/digests?channelId={id}&listHistory=true`：获取该频道往期历史晨报归档列表。
- `POST /api/digests`：手动触发即时抓取并生成今日晨报：
  ```json
  { "channelId": "channel_id_here", "date": "2026-09-10" }
  ```

### 3. 订阅源与 OPML 接口 (`/api/feeds`)
- `GET /api/feeds`：获取所有登记订阅源列表及其抓取健康状态。
- `POST /api/feeds`：添加新订阅源或执行单源连通性探测（`previewOnly: true`）。
- `PUT /api/feeds`：更新订阅源属性或更换归属频道。
- `DELETE /api/feeds?id={id}`：删除指定订阅源。
- `GET /api/feeds/opml`：一键导出所有频道与源为标准 `.opml` 文件。
- `POST /api/feeds/opml`：批量导入 OPML 文件，自动去重并挂载至指定频道。

### 4. 频道定制接口 (`/api/channels`)
- `GET /api/channels`：获取所有频道信息、挂载源列表及统计数据。
- `POST /api/channels`：新建频道（支持绑定源列表 `sourceIds`、配置专属 Prompt 与过滤词）。
- `PUT /api/channels`：修改频道规则、更新绑定订阅源集合。
- `DELETE /api/channels?id={id}`：删除频道。

### 5. AI 提炼引擎与系统配置 (`/api/settings` / `/api/test-ai`)
- `GET /api/settings`：获取当前系统配置（受管理密码保护，敏感密钥全量脱敏返回）。
- `POST /api/settings`：保存 AI Provider、接口协议及多渠道推送 Webhook 配置。
- `POST /api/test-ai`：实时探测目标 AI 接口连通性、网络延迟与协议兼容性。

### 6. 多端通知测试接口 (`/api/test-notify`)
- `POST /api/test-notify`：向飞书、企微、Telegram、Discord 或 SMTP 邮件发送测试卡片。

### 7. 对外聚合输出 RSS
- `GET /api/feed/[slug]/rss.xml`：输出标准 RSS 2.0 格式订阅源，支持直接填入外部阅读器或播客客户端反向订阅。

### 8. 定时自动触发任务接口 (`/api/cron/digest`)
- `GET /api/cron/digest?key={CRON_SECRET}` 或请求头携带 `Authorization: Bearer {CRON_SECRET}`：
  触发全局激活频道的晨报生成与全渠道推送任务。

---

## ⏰ 定时调度配置指南 (Cron Automation)

推荐设置每日上午定时触发（如每日上午 08:00）：

### 选项 1：Linux crontab 定时调用

```bash
# 每日早上 08:00 自动抓取汇总并分发至多端
0 8 * * * curl -s -X GET "https://your-domain.netlify.app/api/cron/digest" -H "Authorization: Bearer your_production_cron_secret" > /dev/null 2>&1
```

### 选项 2：GitHub Actions 定时任务工作流

在仓库创建 `.github/workflows/daily-digest-cron.yml`：

```yaml
name: Daily RSS Digest Cron
on:
  schedule:
    # 每天 UTC 00:00（北京时间 08:00）触发
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Daily Digest
        run: |
          curl -s -f -X GET "https://your-domain.netlify.app/api/cron/digest" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 选项 3：使用免费云端 Cron 服务
可利用 [cron-job.org](https://cron-job.org) 或 [UptimeRobot](https://uptimerobot.com) 创建定时 HTTP GET 请求，配置目标 URL 为 `https://your-domain.netlify.app/api/cron/digest`，并在 Request Headers 中添加 `Authorization: Bearer your_production_cron_secret`。
