# 有因有果 · 名师推荐小程序 Demo

面向 K12 教育 MCN 场景的微信小程序 Demo：名师展示、收藏对比、预约咨询、直播课报名、消息通知与运营管理后台。

前端为原生微信小程序，后端为 Express 5 + MySQL，Redis 可选（未配置时自动降级为进程内缓存）。

## 功能

- 账号：微信静默登录（openid 自动建号）、用户名注册/登录，JWT 鉴权
- 名师：列表、分页、分类、关键词搜索、热搜、详情
- 收藏：收藏/取消收藏、收藏列表、多选对比
- 预约：提交预约、我的预约、管理员流转状态（待联系 → 已联系）、状态变更自动通知
- 课程：直播课列表/详情、报名（事务行锁防超卖、幂等）、已结束拦截、我的课程
- 消息：未读数量、消息列表、标记已读、定时清理过期通知
- 管理后台：数据看板（7 日趋势）、名师新增/编辑/上下架、头像上传
- 其他：接口文档、请求日志与 requestId、集成测试、Dockerfile、Python 数据采集脚本

## 技术栈

| 层 | 选型 |
| --- | --- |
| 小程序 | 原生 WXML/WXSS/JS |
| 后端 | Node.js 20+、Express 5 |
| 数据库 | MySQL 8（utf8mb4） |
| 缓存 | Redis（可选，自动降级） |
| 鉴权 | JWT + scrypt 密码哈希 |
| 测试 | Node.js 内置 `node:test` |
| 爬虫 | Python 3 + requests + BeautifulSoup（可选） |
| 部署 | Docker（server/Dockerfile） |

## 目录结构

```
.
├── app.js / app.json / app.wxss     小程序入口
├── pages/                           小程序页面（名师、课程、消息、管理后台等）
├── components/                      自定义组件
├── utils/                           请求封装、登录态、配置
├── images/                          本地图标
├── server/                          后端服务
│   ├── app.js                       启动入口
│   ├── routes/                      接口路由
│   ├── repositories/                MySQL / 内存双实现
│   ├── data/                        种子数据
│   ├── test/                        集成测试
│   ├── init_db.js                   建库建表与种子数据
│   ├── Dockerfile
│   └── .env.example                 环境变量模板
├── crawler/                         Python 数据采集脚本（可选）
└── project.config.json              微信开发者工具配置
```

## 快速开始

### 1. 启动后端

前置：Node.js 20+、MySQL 8。Redis 可不装。

```bash
cd server
npm ci
copy .env.example .env    # macOS/Linux 用 cp .env.example .env
npm run init-db           # 注意：会 DROP 并重建所有表
npm start
```

默认地址：

- 健康检查：http://127.0.0.1:3000/api/health
- 接口文档：http://127.0.0.1:3000/api/docs

`.env` 中至少修改 `DB_PASSWORD`、`JWT_SECRET`；数据库不存在时 `init-db` 会自动创建 `teacher_mcn`。

### 2. 运行小程序

1. 微信开发者工具导入项目根目录（AppID 在 `project.config.json`）；
2. 详情 → 本地设置 → 勾选“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”；
3. 确认 `utils/config.js` 的 `baseUrl` 指向后端，默认 `http://127.0.0.1:3000`；
4. 编译运行。

演示账号：

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 学员 | student | student123 |

### 3. 微信静默登录（可选）

在 `server/.env` 配置：

```ini
WX_APPID=你的小程序AppID
WX_APPSECRET=你的小程序AppSecret
WX_MOCK=0
```

小程序启动时会调用 `wx.login` → `POST /api/auth/wx-login`，首次登录自动建号并签发 JWT。

本地没有可用 AppID 时可设 `WX_MOCK=1`，请求 `{ "code": "mock_openid_demo" }` 即可跳过微信接口完成联调。

注意：真机与体验版需要 HTTPS 域名，并在小程序后台配置 request/downloadFile/uploadFile 合法域名。

### 4. 测试

```bash
cd server
npm test
```

测试使用内存仓库（`DB_PORT=1`）与 mock 微信登录，不依赖 MySQL/Redis。

### 5. 数据采集脚本（可选）

```bash
cd crawler
pip install -r requirements.txt
python spider.py              # 解析 fixtures/teachers.html，输出 output/teachers.json
python spider.py --mysql      # 同时 upsert 到 teachers 表
```

### 6. Docker

```bash
cd server
docker build -t teacher-mcn-server .
docker run --rm -p 3000:3000 --env-file .env teacher-mcn-server
```

容器内不包含 MySQL，需要通过 `DB_HOST` 指向外部数据库。

## 主要环境变量

| 变量 | 说明 |
| --- | --- |
| `PORT` | 服务端口，默认 3000 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接信息 |
| `DB_POOL` | 连接池大小 |
| `REDIS_URL` | 留空则使用进程内缓存 |
| `CACHE_TTL` | 缓存秒数 |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | JWT 密钥与有效期 |
| `LOG_LEVEL` / `LOG_RETENTION_DAYS` | 日志级别与保留天数 |
| `CORS_ORIGIN` | 允许的来源，`*` 或逗号分隔 |
| `WX_APPID` / `WX_APPSECRET` | 微信小程序凭据，仅放在服务端 |
| `WX_MOCK` | `1` 时启用 mock 微信登录，生产必须为 `0` |

完整模板见 [server/.env.example](server/.env.example)。

## 安全与合规

- `.env`、日志、上传文件、`node_modules` 均已在 `.gitignore` 中排除，请勿提交真实密钥；
- 上线前更换 `JWT_SECRET` 与数据库默认密码，并使用 HTTPS；
- 种子数据中的名师姓名与粉丝量来自公司介绍，公开仓库或正式发布前需确认授权；用于演示时建议替换为虚构数据。
