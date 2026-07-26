# TutorPlatform 大学生家教撮合平台

TutorPlatform Website Demo V1.0 是一个可真实运行的全栈 MVP，围绕“家长发布需求、大学生投递、双方撮合沟通、预约试课、完成评价”构建完整业务闭环。

> 当前版本用于产品演示与技术验证，不包含支付、实时 WebSocket、生产级文件存储等能力。

## 项目介绍

平台为有家教需求的家庭和具备教学能力的大学生提供统一的信息撮合空间：

- 家长发布家教需求并筛选学生申请；
- 大学生完善资料、提交认证并寻找家教机会；
- 管理员审核学生证明；
- 撮合成功后，双方通过站内消息沟通、预约试课并进行双向评价。

## 产品定位

TutorPlatform 面向本地化、轻量化的大学生家教撮合场景，重点解决：

- 家长寻找大学生家教时信息分散、筛选成本高；
- 大学生缺少可信身份展示与稳定获客渠道；
- 双方从初次接触到试课评价缺少结构化流程；
- 需求、申请、沟通与履约进度难以统一跟踪。

Demo 通过学生认证、角色权限、状态流转和站内业务闭环验证产品可行性。

## 技术栈

### Frontend

- React 19
- Vite 8
- React Router
- Axios
- JavaScript

### Backend

- Node.js
- Express 5
- JWT
- bcrypt
- CORS
- dotenv

### Database

- SQLite
- Prisma ORM
- `@prisma/adapter-better-sqlite3`

### 工程与测试

- npm
- Node.js Test Runner
- Oxlint

## 功能列表

### 公共功能

- 产品首页
- 家长/学生注册
- 用户登录与 JWT 身份认证
- 角色路由与访问控制
- 统一 Navbar、Footer 和页面状态组件

### 家长端

- 创建、发布、关闭家教需求
- 查看自己发布的需求
- 查看学生投递并接受或拒绝
- 接受投递后自动完成撮合并建立会话
- 站内消息沟通与消息已读
- 确认、取消和完成试课
- 提交评价并查看收到/发出的评价

### 学生端

- 维护个人资料
- 提交学生证明并查看认证状态
- 浏览和筛选公开需求
- 查看需求详情并投递
- 跟踪自己的投递记录
- 站内消息沟通与消息已读
- 创建和查看试课预约
- 提交评价并查看收到/发出的评价

### 管理员端

- 查看待审核的学生认证
- 通过或驳回认证材料

## 系统架构

项目采用前后端分离与后端分层架构：

```text
Browser
   │
   ▼
React + Vite
   │  Axios / JSON / JWT
   ▼
Express API (/api/v1)
   │
   ├── Route
   ├── Controller
   ├── Service
   └── Prisma Client
          │
          ▼
        SQLite
```

后端业务调用保持：

```text
Route → Controller → Service → Prisma → SQLite
```

核心数据模型包括：

- User
- StudentProfile
- Certification
- Demand
- Application
- Conversation
- Message
- TrialLesson
- Review

项目目录：

```text
TutorPlatform/
├── frontend/              # React + Vite 前端
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── router/
│   │   └── utils/
│   └── package.json
├── backend/               # Express + Prisma 后端
│   ├── prisma/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   └── package.json
├── database/              # 数据库设计文档
├── .env.example
└── README.md
```

## 环境要求

- Node.js 20.19 或更高版本
- npm

## 项目运行方式

### 1. 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. 配置后端环境

在项目根目录执行：

```powershell
Copy-Item .env.example backend/.env
```

macOS/Linux：

```bash
cp .env.example backend/.env
```

本地运行前，请将 `backend/.env` 中的 `JWT_SECRET` 替换为自己的随机值。

### 3. 初始化数据库

```bash
cd backend
npx prisma migrate deploy
npm run prisma:seed
```

该操作会创建本地 SQLite 数据库并写入 Demo 账号与基础演示数据。

### 4. 启动后端

```bash
cd backend
npm start
```

后端默认运行于：

```text
http://localhost:3000
```

### 5. 启动前端

另开一个终端：

```bash
cd frontend
npm run dev
```

打开终端输出的 Vite 本地地址，通常为：

```text
http://localhost:5173
```

### 6. 生产构建

```bash
cd frontend
npm run lint
npm run build
npm run preview
```

构建产物位于 `frontend/dist/`。

## Demo 账号

Seed 默认创建以下测试账号：

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@test.com` | `DEMO_SEED_PASSWORD` 环境变量的值 |
| 家长 | `parent@test.com` | `DEMO_SEED_PASSWORD` 环境变量的值 |
| 学生 | `student@test.com` | `DEMO_SEED_PASSWORD` 环境变量的值 |

这些账号和密码仅用于本地 Demo，不得用于生产环境。

## 测试

后端集成测试：

```bash
cd backend
npm run test:demand
npm run test:student-certification
npm run test:application
npm run test:conversation
npm run test:trial-lesson
npm run test:review
```

前端检查：

```bash
cd frontend
npm run lint
npm run build
```

## 发布前注意事项

- 使用高强度随机值替换 `JWT_SECRET`；
- 不提交 `.env`、SQLite 开发数据库、依赖目录和前端构建目录；
- 生产环境建议将 SQLite 替换为托管关系型数据库；
- 将前端 API 地址改为环境变量并启用 HTTPS；
- 根据实际部署域名收紧 CORS；
- 使用对象存储或受控文件服务替代本地认证材料路径；
- 增加日志、监控、限流、备份和自动化部署流程。
