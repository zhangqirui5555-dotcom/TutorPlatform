# TutorPlatform MVP 部署指南

## 已完成的部署修复

- 后端 Prisma 从 SQLite 切换为 PostgreSQL，并生成 PostgreSQL 初始迁移。
- 后端使用 Railway 注入的 `PORT`，新增 `/health` 健康检查。
- CORS 改为通过 `CORS_ORIGINS` 白名单控制。
- 前端 API 地址改为 `VITE_API_BASE_URL`，不再固定访问 localhost。
- 添加 `backend/railway.json` 和 `frontend/vercel.json`。
- Seed 密码改为 `DEMO_SEED_PASSWORD`，不再写死在源码中。

## Railway 后端与 PostgreSQL

1. 在 Railway 项目画布点击 **+ New → Database → PostgreSQL**。
2. 打开后端服务 **Settings → Source**，连接 GitHub 仓库。
3. 在 **Settings → Build** 设置：
   - Root Directory：`/backend`
   - Config File Path：`/backend/railway.json`
   - Build Command：由配置文件提供，等价于 `npm ci && npm run build`
   - Start Command：由配置文件提供，等价于 `npm start`
4. 在后端服务 **Variables** 添加：
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET=<至少 32 字符的随机值>`
   - `JWT_EXPIRES_IN=1d`
   - `CORS_ORIGINS=https://你的前端域名.vercel.app`
   - `DEMO_SEED_PASSWORD=<与 JWT_SECRET 不同的强密码>`（仅 seed 时需要）
5. 点击 **Deploy/Redeploy**。配置中的 pre-deploy 会执行 `npm run prisma:deploy`。
6. 部署成功后，进入 **Settings → Networking → Generate Domain**。
7. 浏览器打开 `https://你的后端域名/health`，应看到：

```json
{"status":"ok","message":"TutorPlatform backend running"}
```

8. 第一次需要演示账号时，在 Railway 后端服务命令环境中执行一次：

```bash
npm run prisma:seed
```

不要把 `DATABASE_URL`、`JWT_SECRET` 或 `DEMO_SEED_PASSWORD` 写入 GitHub。

## Vercel 前端

1. 在 Vercel 点击 **Add New → Project**，导入同一个 GitHub 仓库。
2. 配置：
   - Root Directory：`frontend`
   - Framework Preset：`Vite`
   - Install Command：`npm ci`
   - Build Command：`npm run build`
   - Output Directory：`dist`
3. 在 **Environment Variables** 添加：
   - `VITE_API_BASE_URL=https://你的Railway后端域名/api/v1`
4. 点击 **Deploy**。成功后应看到 Vercel 生成的访问域名。
5. 把最终 Vercel 域名回填到 Railway 后端的 `CORS_ORIGINS`，然后重新部署后端。
6. 如果还要允许 Vercel Preview 域名，将多个完整来源用英文逗号分隔；不要使用 `*`。

## 验收

1. 打开 Vercel 域名，确认刷新 `/login`、`/register` 等路由不出现 404。
2. 浏览器开发者工具 Network 中，API 请求应发往 Railway HTTPS 域名。
3. 验证：注册 → 登录 → 家长发布需求 → 学生浏览并投递 → 家长接受 → 双方消息 → 试课 → 评价。
4. Railway Logs 中不应出现 Prisma 连接、迁移、CORS 或 JWT 配置错误。

## 常见错误

- `No start command could be found`：Root Directory 必须是 `/backend`。
- `DATABASE_URL is required`：给后端服务添加 PostgreSQL 引用变量并 Redeploy。
- Prisma migration 失败：确认 `DATABASE_URL` 指向新建且可访问的 PostgreSQL；查看 pre-deploy logs。
- 浏览器 CORS 错误：`CORS_ORIGINS` 必须是前端完整来源，例如 `https://abc.vercel.app`，不能带路径或末尾 `/`。
- 前端请求 localhost：确认 `VITE_API_BASE_URL` 已设置，并在修改变量后重新 Deploy；Vite 变量在构建时写入产物。
- Vercel 子路由刷新 404：确认 `frontend/vercel.json` 已提交并位于 Vercel Root Directory 内。
- Railway 健康检查失败：先访问部署日志，确认应用监听 `process.env.PORT`，再检查 `/health`。
