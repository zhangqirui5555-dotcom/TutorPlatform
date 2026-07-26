# TutorPlatform 数据库设计 V1.0 Final

## 1. 版本定位

本设计是“大学生家教撮合平台 Website Demo V1.0”的最终数据库设计基线，服务于以下闭环：

家长注册 → 发布家教需求 → 大学生注册并完善资料 → 上传学生证明 → 管理员审核 → 学生浏览并投递 → 家长接受或拒绝 → 双方聊天 → 预约试课 → 完成评价。

本阶段只确定数据结构和技术方案，不创建业务表、不生成迁移、不编写 API、页面或业务逻辑。

## 2. V1.0 调整及原因

### 2.1 主键由 UUID 调整为 INTEGER 自增 ID

- 所有实体主键统一采用 SQLite `INTEGER` 自增 ID。
- Prisma 模型实现时使用 `Int @id @default(autoincrement())`。
- Demo 为单实例、单数据库运行，不需要 UUID 的分布式唯一性。
- 整数主键更容易调试、展示和手工检查，也更适合当前 SQLite 原型。
- ID 仅作为技术标识；正式产品若公开暴露资源编号，可再评估不可枚举 ID 或外部业务编号。

### 2.2 数据库技术确定为 SQLite + Prisma ORM

- SQLite 无需单独部署数据库服务，适合本地开发和 Demo 演示。
- Prisma 提供声明式模型、类型安全客户端和迁移工具，便于后续从设计进入实现。
- V1.0 使用单进程、低并发场景；若进入生产或高并发阶段，再迁移至 PostgreSQL 等服务型数据库。

### 2.3 认证文件采用本地 uploads 路径

- 删除对象存储、私有桶和临时签名地址等复杂设计。
- `Certification.material_path` 仅保存相对于后端上传根目录的路径，例如：

```text
uploads/certifications/12/student-card-1710000000.jpg
```

- 数据库不保存文件二进制，也不保存本机绝对路径。
- 后续实现时由后端统一生成文件名、校验类型和大小，并通过受权限保护的接口读取。
- `backend/uploads/` 属于运行数据，后续应加入 `.gitignore`，但本阶段暂不创建上传逻辑。

### 2.4 删除 StudentProfile 的重复认证状态

- `StudentProfile` 不再保存 `certification_status`。
- 认证状态只由 `Certification` 的最新记录确定，避免资料表快照与审核记录不一致。
- “未提交”由不存在认证记录推导；“审核中、通过、驳回”来自最新认证记录。

## 3. 通用约定

- 主键：`id`，INTEGER 自增。
- 外键：`<entity>_id`。
- 时间：数据库保存 UTC 时间，API 后续统一使用 ISO 8601。
- 核心实体保留 `created_at`、`updated_at`。
- 金额使用定点表示；Prisma 建模阶段根据 SQLite 支持情况确定 Decimal 或以整数“分”保存。
- 枚举在设计层使用英文稳定代码；Prisma + SQLite 的具体实现可采用 String 并由应用层常量约束。
- 密码只保存 `password_hash`，绝不保存明文。
- 业务历史数据不物理删除，通过状态字段停用或下架。

## 4. 最终实体列表

V1.0 最终保留 9 个实体：

1. `User`：家长、大学生和管理员账号。
2. `StudentProfile`：大学生简历资料。
3. `Certification`：学生证明提交及管理员审核记录。
4. `Demand`：家长发布的家教需求。
5. `Application`：学生对需求的投递。
6. `Conversation`：一次成功撮合后建立的会话。
7. `Message`：会话内站内消息。
8. `TrialLesson`：试课预约。
9. `Review`：试课完成后的双方评价。

## 5. 实体字段设计

### 5.1 User

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| email | TEXT | 条件必填 | 登录邮箱，唯一；与手机号至少一项 |
| phone | TEXT | 条件必填 | 登录手机号，唯一；与邮箱至少一项 |
| password_hash | TEXT | 是 | 密码哈希 |
| role | TEXT | 是 | `PARENT`、`STUDENT`、`ADMIN` |
| status | TEXT | 是 | `ACTIVE`、`SUSPENDED`、`DISABLED` |
| display_name | TEXT | 是 | 展示名称 |
| last_login_at | DATETIME | 否 | 最近登录时间 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- `email` 与 `phone` 分别唯一。
- V1.0 一个账号只有一个角色。
- 非 `ACTIVE` 用户不得进行新增业务操作。

### 5.2 StudentProfile

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| user_id | INTEGER | 是 | 学生用户 ID，唯一 |
| school | TEXT | 是 | 学校 |
| major | TEXT | 是 | 专业 |
| grade | TEXT | 是 | 大学年级 |
| subjects | TEXT | 是 | 擅长科目；V1.0 使用 JSON 字符串 |
| teaching_experience | TEXT | 否 | 教学经验 |
| bio | TEXT | 否 | 自我介绍 |
| expected_price_min | DECIMAL/INTEGER | 否 | 最低期望价格 |
| expected_price_max | DECIMAL/INTEGER | 否 | 最高期望价格 |
| price_unit | TEXT | 否 | 默认 `PER_HOUR` |
| currency | TEXT | 是 | 默认 `CNY` |
| teaching_regions | TEXT | 是 | 授课区域；V1.0 使用 JSON 字符串 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- `user_id` 唯一且必须关联 `STUDENT` 用户。
- 最低价格不得高于最高价格。
- 本表不保存认证状态。

### 5.3 Certification

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| student_id | INTEGER | 是 | 提交认证的学生用户 ID |
| material_path | TEXT | 是 | `uploads/` 下的本地相对路径 |
| material_type | TEXT | 是 | `STUDENT_CARD`、`ENROLLMENT_CERTIFICATE` |
| status | TEXT | 是 | `PENDING`、`APPROVED`、`REJECTED` |
| submitted_at | DATETIME | 是 | 提交时间 |
| reviewed_at | DATETIME | 否 | 审核时间 |
| reviewed_by | INTEGER | 否 | 审核管理员用户 ID |
| rejection_reason | TEXT | 否 | 驳回原因 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- `student_id` 必须关联 `STUDENT`。
- `reviewed_by` 必须关联 `ADMIN`。
- 同一学生同时只能有一条 `PENDING` 记录。
- 通过或驳回时必须记录审核人和审核时间；驳回时必须填写原因。
- 历史认证记录保留，不覆盖旧记录。

### 5.4 Demand

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| parent_id | INTEGER | 是 | 发布家长用户 ID |
| title | TEXT | 是 | 标题 |
| child_grade | TEXT | 是 | 孩子年级 |
| subject | TEXT | 是 | 科目 |
| region | TEXT | 是 | 授课区域 |
| address_detail | TEXT | 否 | 详细地址，敏感字段 |
| schedule_description | TEXT | 是 | 期望授课时间 |
| budget_min | DECIMAL/INTEGER | 是 | 最低预算 |
| budget_max | DECIMAL/INTEGER | 是 | 最高预算 |
| price_unit | TEXT | 是 | 默认 `PER_HOUR` |
| currency | TEXT | 是 | 默认 `CNY` |
| description | TEXT | 否 | 补充要求 |
| status | TEXT | 是 | `DRAFT`、`RECRUITING`、`MATCHED`、`COMPLETED`、`CLOSED` |
| published_at | DATETIME | 否 | 发布时间 |
| matched_at | DATETIME | 否 | 匹配时间 |
| completed_at | DATETIME | 否 | 完成时间 |
| closed_at | DATETIME | 否 | 下架时间 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- `parent_id` 必须关联 `PARENT`。
- 最低预算不得高于最高预算。
- 学生只能浏览和投递 `RECRUITING` 需求。

### 5.5 Application

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| student_id | INTEGER | 是 | 投递学生用户 ID |
| demand_id | INTEGER | 是 | 目标需求 ID |
| cover_message | TEXT | 是 | 自荐语 |
| status | TEXT | 是 | `PENDING`、`VIEWED`、`ACCEPTED`、`REJECTED` |
| viewed_at | DATETIME | 否 | 首次查看时间 |
| decided_at | DATETIME | 否 | 决定时间 |
| created_at | DATETIME | 是 | 投递时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- `(student_id, demand_id)` 唯一。
- 只有认证通过的学生可向 `RECRUITING` 需求投递。
- 一个需求最多有一条 `ACCEPTED` 投递。

### 5.6 Conversation

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| application_id | INTEGER | 是 | 已接受投递 ID，唯一 |
| demand_id | INTEGER | 是 | 需求 ID |
| parent_id | INTEGER | 是 | 家长用户 ID |
| student_id | INTEGER | 是 | 学生用户 ID |
| status | TEXT | 是 | `ACTIVE`、`CLOSED` |
| last_message_at | DATETIME | 否 | 最后消息时间 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- 只有 `ACCEPTED` 投递能够建立会话。
- 一次投递只能建立一个会话。
- 双方必须与投递和需求一致。

### 5.7 Message

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| conversation_id | INTEGER | 是 | 所属会话 |
| sender_id | INTEGER | 是 | 发送者 |
| receiver_id | INTEGER | 是 | 接收者 |
| content | TEXT | 是 | 文本内容 |
| message_type | TEXT | 是 | V1.0 固定为 `TEXT` |
| sent_at | DATETIME | 是 | 发送时间 |
| read_at | DATETIME | 否 | 阅读时间 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- 发送者和接收者必须是会话双方，且不能相同。
- 消息内容不能为空。
- V1.0 仅支持文本消息。

### 5.8 TrialLesson

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| application_id | INTEGER | 是 | 已接受投递 ID |
| demand_id | INTEGER | 是 | 需求 ID |
| parent_id | INTEGER | 是 | 家长用户 ID |
| student_id | INTEGER | 是 | 学生用户 ID |
| proposed_by | INTEGER | 是 | 发起预约的用户 ID |
| scheduled_start_at | DATETIME | 是 | 开始时间 |
| scheduled_end_at | DATETIME | 是 | 结束时间 |
| method | TEXT | 是 | `ONLINE`、`OFFLINE` |
| location_or_link | TEXT | 否 | 地点或线上方式 |
| status | TEXT | 是 | `PENDING_CONFIRMATION`、`CONFIRMED`、`COMPLETED`、`CANCELLED` |
| cancellation_reason | TEXT | 否 | 取消原因 |
| confirmed_at | DATETIME | 否 | 确认时间 |
| completed_at | DATETIME | 否 | 完成时间 |
| cancelled_at | DATETIME | 否 | 取消时间 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- 结束时间必须晚于开始时间。
- 预约双方必须与已接受投递一致。
- 只有 `CONFIRMED` 预约可完成。

### 5.9 Review

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | INTEGER | 是 | 自增主键 |
| trial_lesson_id | INTEGER | 是 | 已完成试课 ID |
| reviewer_id | INTEGER | 是 | 评价人 |
| reviewee_id | INTEGER | 是 | 被评价人 |
| rating | INTEGER | 是 | 1 至 5 星 |
| content | TEXT | 否 | 评价内容 |
| created_at | DATETIME | 是 | 创建时间 |
| updated_at | DATETIME | 是 | 更新时间 |

约束：

- `(trial_lesson_id, reviewer_id)` 唯一。
- 评价双方必须是该试课参与者，且不能是同一人。
- 只有 `COMPLETED` 试课可以评价。

## 6. 状态流转

### 6.1 认证

```text
NOT_SUBMITTED（无记录） → PENDING → APPROVED
                              └──→ REJECTED → 再次提交新的 PENDING 记录
```

### 6.2 需求

```text
DRAFT → RECRUITING → MATCHED → COMPLETED
  └────────┴──────────┴──────→ CLOSED
```

### 6.3 投递

```text
PENDING → VIEWED → ACCEPTED
    └────────┴──→ REJECTED
```

接受一条投递时，应在同一事务内拒绝该需求的其他未决投递、将需求改为 `MATCHED`，并创建 Conversation。

### 6.4 试课预约

```text
PENDING_CONFIRMATION → CONFIRMED → COMPLETED
          └──────────────┴──────→ CANCELLED
```

## 7. ER 关系

```text
User 1 : 0..1 StudentProfile
User(STUDENT) 1 : N Certification
User(ADMIN) 1 : N Certification（审核）
User(PARENT) 1 : N Demand
User(STUDENT) 1 : N Application
Demand 1 : N Application
Application 1 : 0..1 Conversation
Conversation 1 : N Message
Application 1 : N TrialLesson
Demand 1 : N TrialLesson
TrialLesson 1 : 0..2 Review
User 1 : N Message / TrialLesson / Review（按各角色外键）
```

## 8. Prisma V1.0 基础配置

技术方案：

```text
Database: SQLite
ORM: Prisma
Schema: backend/prisma/schema.prisma
Prisma config: backend/prisma.config.ts
Local database URL: file:./prisma/dev.db
```

本阶段 `schema.prisma` 只包含 generator 和 datasource，数据库 URL 按 Prisma 7 的要求由 `prisma.config.ts` 从 `.env` 读取。上述 9 个模型将在下一阶段确认字段映射后一次性加入，并通过 Prisma migration 创建数据库。

## 9. 下一阶段开发计划

1. 将本文件中的 9 个实体转换为 Prisma models、relations、indexes 和 unique constraints。
2. 确定金额在 SQLite 中采用整数“分”还是 Decimal 映射。
3. 增加 Prisma 开发命令和首次 migration。
4. 创建最小种子数据：管理员、示例家长、示例学生。
5. 设计后端目录分层：routes、controllers、services、repositories、middlewares。
6. 在数据模型验证通过后，再按认证、需求、投递、聊天、试课、评价的顺序实现 API。

以上计划均属于后续阶段，本阶段不执行。
