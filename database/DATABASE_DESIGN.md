# TutorPlatform 数据库与后端架构设计

## 1. 文档范围

本设计面向“大学生家教撮合平台 Website Demo V1.0”的完整业务闭环：

家长注册 → 发布家教需求 → 大学生注册并完善简历 → 上传学生证明 → 管理员审核 → 学生浏览需求并投递 → 家长接受或拒绝 → 建立聊天 → 预约试课 → 完成评价。

本阶段仅定义概念模型、状态流转、数据关系和 API 规划，不创建数据库、不编写 SQL，也不实现 API。

## 2. 通用设计约定

- 主键统一使用 `id`，建议采用 UUID，避免对外暴露连续业务数量。
- 外键字段统一使用 `<entity>_id` 命名。
- 时间统一存储为 UTC，API 按 ISO 8601 格式传输，前端负责转换为本地时间。
- 所有核心实体包含 `created_at`、`updated_at`。
- 金额使用定点数，禁止使用浮点数；同时保存币种，默认 `CNY`。
- 密码只保存安全哈希 `password_hash`，不保存明文密码。
- 枚举值在数据库和 API 中使用稳定的英文代码，中文仅作为界面文案。
- 账号、需求等业务对象优先采用状态停用或软删除，避免破坏历史投递、聊天、预约和评价。
- 上传材料只保存受控对象存储的文件标识或私有地址，不在业务表中保存文件二进制；下载时应通过鉴权后的临时地址访问。
- 涉及状态变更的操作应在事务中完成，并由服务端校验操作者角色、资源归属和前置状态。

## 3. 数据库实体

### 3.1 User（用户）

家长、大学生和管理员共用一张用户表，通过角色区分身份。

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 用户 ID，主键 |
| email | String | 条件必填 | 登录邮箱，全局唯一；与手机号至少填写一项 |
| phone | String | 条件必填 | 登录手机号，全局唯一；与邮箱至少填写一项 |
| password_hash | String | 是 | 密码哈希 |
| role | Enum | 是 | `PARENT`、`STUDENT`、`ADMIN` |
| status | Enum | 是 | `ACTIVE`、`SUSPENDED`、`DISABLED` |
| display_name | String | 是 | 站内展示名称 |
| last_login_at | DateTime | 否 | 最近登录时间 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `email`、`phone` 分别建立唯一索引；空值不参与唯一性冲突。
- 同一账号 V1.0 只允许一个角色，避免家长与学生权限边界模糊。
- `status != ACTIVE` 的用户禁止登录或执行新增业务操作，但历史数据继续保留。

### 3.2 StudentProfile（大学生资料）

仅 `User.role = STUDENT` 的用户可以拥有学生资料。

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 资料 ID，主键 |
| user_id | UUID | 是 | 关联学生用户，唯一外键 |
| school | String | 是 | 学校 |
| major | String | 是 | 专业 |
| grade | String | 是 | 大学年级，如大一、研一 |
| subjects | JSON/Array | 是 | 擅长科目代码集合 |
| teaching_experience | Text | 否 | 教学经验 |
| bio | Text | 否 | 自我介绍 |
| expected_price_min | Decimal | 否 | 期望最低课时价格 |
| expected_price_max | Decimal | 否 | 期望最高课时价格 |
| price_unit | Enum | 否 | 默认 `PER_HOUR` |
| currency | String | 是 | 默认 `CNY` |
| teaching_regions | JSON/Array | 是 | 可授课区域代码集合 |
| certification_status | Enum | 是 | 认证状态快照 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `user_id` 唯一，保证 User 与 StudentProfile 为 1:0..1。
- 最低价格不得大于最高价格，金额不得小于 0。
- `certification_status` 是当前有效认证结果的查询快照；完整审核历史以 Certification 为准。
- 科目和区域在 V1.0 可使用受控代码数组，后续需要运营配置时再拆为字典表和关联表。

### 3.3 Certification（学生认证）

保存学生每次提交及管理员审核记录，允许驳回后重新提交。

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 认证记录 ID |
| student_id | UUID | 是 | 提交认证的学生用户 |
| material_url | String | 是 | 私有上传材料的文件标识或地址 |
| material_type | Enum | 是 | 如 `STUDENT_CARD`、`ENROLLMENT_CERTIFICATE` |
| status | Enum | 是 | `PENDING`、`APPROVED`、`REJECTED` |
| submitted_at | DateTime | 是 | 提交时间 |
| reviewed_at | DateTime | 否 | 审核时间 |
| reviewed_by | UUID | 否 | 审核管理员用户 ID |
| rejection_reason | Text | 否 | 驳回原因 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `student_id` 必须关联 `STUDENT` 用户，`reviewed_by` 必须关联 `ADMIN` 用户。
- `APPROVED` 或 `REJECTED` 时，`reviewed_at` 和 `reviewed_by` 必填。
- `REJECTED` 时 `rejection_reason` 必填；其他状态必须为空。
- 同一学生同一时刻最多存在一条 `PENDING` 认证记录。
- 历史记录不覆盖；最新有效记录同步决定 StudentProfile 的认证状态。

> “未提交”表示学生尚无 Certification 记录，是派生状态，不需要创建空认证行。

### 3.4 Demand（家教需求）

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 需求 ID |
| parent_id | UUID | 是 | 发布家长用户 ID |
| title | String | 是 | 需求标题 |
| child_grade | String | 是 | 孩子年级 |
| subject | String | 是 | 科目代码 |
| region | String | 是 | 授课区域代码 |
| address_detail | String | 否 | 详细地址，仅在有权限的撮合双方间展示 |
| schedule_description | String | 是 | 期望授课时间说明 |
| budget_min | Decimal | 是 | 最低预算 |
| budget_max | Decimal | 是 | 最高预算 |
| price_unit | Enum | 是 | 默认 `PER_HOUR` |
| currency | String | 是 | 默认 `CNY` |
| description | Text | 否 | 补充要求 |
| status | Enum | 是 | `DRAFT`、`RECRUITING`、`MATCHED`、`COMPLETED`、`CLOSED` |
| published_at | DateTime | 否 | 首次发布时间 |
| matched_at | DateTime | 否 | 匹配时间 |
| completed_at | DateTime | 否 | 完成时间 |
| closed_at | DateTime | 否 | 下架时间 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `parent_id` 必须关联 `PARENT` 用户。
- 最低预算不得大于最高预算，预算不得小于 0。
- 建议为 `(status, subject, region, published_at)` 建立组合索引，支持公开需求列表筛选。
- `DRAFT` 仅发布者可见；学生只能浏览 `RECRUITING` 状态。
- 详细地址属于敏感信息，列表接口不得直接返回。

### 3.5 Application（投递）

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 投递 ID |
| student_id | UUID | 是 | 投递学生用户 ID |
| demand_id | UUID | 是 | 目标需求 ID |
| cover_message | Text | 是 | 自荐语 |
| status | Enum | 是 | `PENDING`、`VIEWED`、`ACCEPTED`、`REJECTED` |
| viewed_at | DateTime | 否 | 家长首次查看时间 |
| decided_at | DateTime | 否 | 接受或拒绝时间 |
| created_at | DateTime | 是 | 投递时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `(student_id, demand_id)` 建立唯一约束，防止重复投递。
- `student_id` 必须是认证通过且账号有效的学生。
- 只能向 `RECRUITING` 需求投递。
- 只有需求发布家长可以查看、接受或拒绝投递。
- 接受某条投递时，需在同一事务中将该投递设为 `ACCEPTED`、其余未决投递设为 `REJECTED`、需求设为 `MATCHED`，并创建 Conversation。

### 3.6 Conversation（会话）

用于将站内聊天绑定到一次已接受的投递，是支撑 Message 权限和分页的必要实体。

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 会话 ID |
| application_id | UUID | 是 | 已接受投递 ID，唯一 |
| demand_id | UUID | 是 | 关联需求 ID |
| parent_id | UUID | 是 | 家长用户 ID |
| student_id | UUID | 是 | 学生用户 ID |
| status | Enum | 是 | `ACTIVE`、`CLOSED` |
| last_message_at | DateTime | 否 | 最后消息时间 |
| created_at | DateTime | 是 | 建立时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- 只有 `ACCEPTED` 投递可以创建会话。
- `application_id` 唯一，保证一次撮合只有一个会话。
- 参与者必须与投递及需求中的学生、家长一致。

### 3.7 Message（聊天消息）

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 消息 ID |
| conversation_id | UUID | 是 | 所属会话 ID |
| sender_id | UUID | 是 | 发送者用户 ID |
| receiver_id | UUID | 是 | 接收者用户 ID |
| content | Text | 是 | 消息内容 |
| message_type | Enum | 是 | V1.0 为 `TEXT` |
| sent_at | DateTime | 是 | 发送时间 |
| read_at | DateTime | 否 | 阅读时间 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- 发送者和接收者必须是 Conversation 的两名参与者，且不能是同一用户。
- `content` 去除首尾空白后不能为空，并设置合理长度上限。
- 建议为 `(conversation_id, sent_at, id)` 建立索引，用于游标分页。
- 消息发送后原则上不可物理删除或修改；后续如需要撤回，应增加状态字段而不是删除记录。

### 3.8 TrialLesson（试课预约）

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 预约 ID |
| application_id | UUID | 是 | 关联的已接受投递 |
| demand_id | UUID | 是 | 关联需求 |
| parent_id | UUID | 是 | 家长用户 ID |
| student_id | UUID | 是 | 学生用户 ID |
| proposed_by | UUID | 是 | 发起预约的用户 |
| scheduled_start_at | DateTime | 是 | 试课开始时间 |
| scheduled_end_at | DateTime | 是 | 试课结束时间 |
| method | Enum | 是 | `ONLINE`、`OFFLINE` |
| location_or_link | String | 否 | 线下地点或线上方式；属于敏感信息 |
| status | Enum | 是 | `PENDING_CONFIRMATION`、`CONFIRMED`、`COMPLETED`、`CANCELLED` |
| cancellation_reason | Text | 否 | 取消原因 |
| confirmed_at | DateTime | 否 | 确认时间 |
| completed_at | DateTime | 否 | 完成时间 |
| cancelled_at | DateTime | 否 | 取消时间 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `scheduled_end_at` 必须晚于 `scheduled_start_at`。
- 预约双方必须与已接受投递一致。
- 发起人必须是预约双方之一；另一方负责确认。
- 只有 `CONFIRMED` 的预约可被标记为 `COMPLETED`。
- 允许取消后重新创建预约记录，保留历史。

### 3.9 Review（评价）

| 字段 | 建议类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | UUID | 是 | 评价 ID |
| trial_lesson_id | UUID | 是 | 已完成试课 ID |
| reviewer_id | UUID | 是 | 评价人用户 ID |
| reviewee_id | UUID | 是 | 被评价人用户 ID |
| rating | Integer | 是 | 星级，1 至 5 |
| content | Text | 否 | 评价内容 |
| created_at | DateTime | 是 | 创建时间 |
| updated_at | DateTime | 是 | 更新时间 |

约束与索引：

- `(trial_lesson_id, reviewer_id)` 唯一，保证每位参与者对一次试课最多评价一次。
- `rating` 只能为 1、2、3、4、5。
- 评价人与被评价人不能相同，且必须是该试课双方。
- 只有 `COMPLETED` 试课允许评价。
- 评价默认不可自行修改或删除；争议处理由后续管理机制扩展。

## 4. 状态流转

### 4.1 账号状态

```text
ACTIVE ──管理员封禁──> SUSPENDED
SUSPENDED ──管理员解封──> ACTIVE
ACTIVE/SUSPENDED ──注销或永久停用──> DISABLED
```

- `DISABLED` 为终态，恢复需特殊管理流程。
- 管理员不能停用自己当前正在使用的唯一超级管理账号，具体规则后续定义。

### 4.2 认证状态

对外状态：

```text
NOT_SUBMITTED ──学生提交──> PENDING
PENDING ──管理员通过──> APPROVED
PENDING ──管理员驳回──> REJECTED
REJECTED ──学生重新提交──> PENDING
APPROVED ──材料失效/重新认证──> PENDING
```

- `NOT_SUBMITTED` 由“没有认证记录”派生。
- 提交后学生不能直接修改审核中的材料；如需修改，应撤回能力另行设计。
- 管理员只能处理 `PENDING` 记录。

### 4.3 需求状态

```text
DRAFT ──家长发布──> RECRUITING
RECRUITING ──接受投递──> MATCHED
MATCHED ──履约完成──> COMPLETED
DRAFT/RECRUITING/MATCHED ──家长下架或管理员关闭──> CLOSED
```

- `DRAFT`：草稿，仅发布家长可见。
- `RECRUITING`：招募中，可公开浏览和投递。
- `MATCHED`：已接受一名学生，停止新投递。
- `COMPLETED`：业务闭环已完成，终态。
- `CLOSED`：已下架，终态；若未来支持重新发布，应复制为新需求，保留原记录。

### 4.4 投递状态

```text
PENDING ──家长首次查看──> VIEWED
PENDING/VIEWED ──家长接受──> ACCEPTED
PENDING/VIEWED ──家长拒绝──> REJECTED
PENDING/VIEWED ──其他投递被接受──> REJECTED
```

- `PENDING`：待查看。
- `VIEWED`：已查看，尚未决定。
- `ACCEPTED`、`REJECTED` 均为终态。
- 接受操作必须具备幂等性，并防止并发接受两名学生。

### 4.5 试课预约状态

```text
PENDING_CONFIRMATION ──另一方确认──> CONFIRMED
PENDING_CONFIRMATION/CONFIRMED ──任一方取消──> CANCELLED
CONFIRMED ──试课结束并确认完成──> COMPLETED
```

- `COMPLETED` 和 `CANCELLED` 为终态。
- 预约完成后才开放评价。

## 5. ER 关系文字描述

```text
User 1 : 0..1 StudentProfile
User(STUDENT) 1 : N Certification
User(ADMIN) 1 : N Certification（通过 reviewed_by 审核）
User(PARENT) 1 : N Demand
User(STUDENT) 1 : N Application
Demand 1 : N Application
Application 1 : 0..1 Conversation
Demand 1 : 0..1 Conversation（V1.0 每个需求只接受一名学生）
Conversation 1 : N Message
User 1 : N Message（作为 sender）
User 1 : N Message（作为 receiver）
Application 1 : N TrialLesson
Demand 1 : N TrialLesson
User(PARENT) 1 : N TrialLesson
User(STUDENT) 1 : N TrialLesson
TrialLesson 1 : 0..2 Review
User 1 : N Review（作为 reviewer）
User 1 : N Review（作为 reviewee）
```

关键完整性规则：

- StudentProfile、Certification、Application 中的学生必须对应 `STUDENT` 角色。
- Demand 中的发布者必须对应 `PARENT` 角色。
- Certification 的审核人必须对应 `ADMIN` 角色。
- Conversation、TrialLesson、Review 的双方必须可追溯到同一条已接受投递。
- 一个需求在 V1.0 最多有一条 `ACCEPTED` 投递；需通过事务和数据库唯一性策略共同保证。

## 6. 后端架构规划

### 6.1 建议分层

```text
Route
  → Middleware（认证、角色、校验、限流）
    → Controller（解析 HTTP 请求与响应）
      → Service（业务规则、状态机、事务）
        → Repository / ORM（数据访问）
          → Database
```

横切能力包括：

- 统一身份认证与 `PARENT`、`STUDENT`、`ADMIN` 角色授权。
- 请求参数校验与标准化。
- 统一错误码、错误响应和日志。
- 分页、排序、过滤的统一约定。
- 上传文件类型、大小和访问权限控制。
- 敏感字段脱敏，尤其是联系方式、地址和认证材料。
- 状态变更事务、幂等控制和并发保护。

### 6.2 API 通用约定

- API 前缀：`/api/v1`。
- 请求和响应使用 JSON；文件上传使用 `multipart/form-data`。
- 列表使用游标或页码分页，统一返回 `items` 和 `pagination`。
- 成功状态码遵循 HTTP 语义：创建 `201`、查询/更新 `200`、删除或无响应操作 `204`。
- 错误格式建议统一为：

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "面向用户的错误说明",
    "details": {}
  }
}
```

## 7. 后端 API 规划

以下仅为接口契约规划，不代表本阶段实现。

### 7.1 认证与当前用户

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | 公开 | 注册家长或学生账号 |
| POST | `/api/v1/auth/login` | 公开 | 登录 |
| POST | `/api/v1/auth/logout` | 已登录 | 退出登录 |
| POST | `/api/v1/auth/refresh` | 已登录 | 刷新会话令牌 |
| GET | `/api/v1/users/me` | 已登录 | 获取当前用户 |
| PATCH | `/api/v1/users/me` | 已登录 | 修改基础资料 |

### 7.2 学生资料与认证

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/v1/student-profile/me` | 学生 | 获取自己的学生资料 |
| PUT | `/api/v1/student-profile/me` | 学生 | 创建或完整更新资料 |
| PATCH | `/api/v1/student-profile/me` | 学生 | 局部更新资料 |
| GET | `/api/v1/students/:studentId/profile` | 有权限用户 | 获取可公开的学生资料 |
| POST | `/api/v1/certifications` | 学生 | 上传并提交认证 |
| GET | `/api/v1/certifications/me` | 学生 | 获取自己的认证历史和当前状态 |
| GET | `/api/v1/admin/certifications` | 管理员 | 分页查询待审或历史认证 |
| GET | `/api/v1/admin/certifications/:id` | 管理员 | 查看认证详情及受控材料 |
| POST | `/api/v1/admin/certifications/:id/approve` | 管理员 | 审核通过 |
| POST | `/api/v1/admin/certifications/:id/reject` | 管理员 | 审核驳回 |

### 7.3 家教需求

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/demands` | 家长 | 创建需求草稿 |
| GET | `/api/v1/demands` | 已登录 | 查询招募中的公开需求 |
| GET | `/api/v1/demands/:id` | 有权限用户 | 获取需求详情 |
| GET | `/api/v1/parents/me/demands` | 家长 | 获取自己发布的全部需求 |
| PATCH | `/api/v1/demands/:id` | 发布家长 | 修改允许编辑的需求字段 |
| POST | `/api/v1/demands/:id/publish` | 发布家长 | 发布草稿 |
| POST | `/api/v1/demands/:id/close` | 发布家长/管理员 | 下架需求 |
| POST | `/api/v1/demands/:id/complete` | 发布家长 | 标记履约完成 |

### 7.4 投递

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/demands/:demandId/applications` | 已认证学生 | 向需求投递 |
| GET | `/api/v1/applications/me` | 学生 | 获取自己的投递列表 |
| GET | `/api/v1/demands/:demandId/applications` | 发布家长 | 获取某需求的投递列表 |
| GET | `/api/v1/applications/:id` | 投递双方 | 获取投递详情；家长首次访问可转为已查看 |
| POST | `/api/v1/applications/:id/accept` | 发布家长 | 接受投递并创建会话 |
| POST | `/api/v1/applications/:id/reject` | 发布家长 | 拒绝投递 |

### 7.5 会话与消息

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/v1/conversations` | 已登录 | 获取当前用户的会话列表 |
| GET | `/api/v1/conversations/:id/messages` | 会话参与者 | 分页获取消息 |
| POST | `/api/v1/conversations/:id/messages` | 会话参与者 | 发送文本消息 |
| POST | `/api/v1/conversations/:id/read` | 会话参与者 | 标记消息已读 |

实时消息后续可在相同鉴权和 Conversation 权限模型上增加 WebSocket；V1.0 可先用 HTTP 拉取，不影响数据模型。

### 7.6 试课预约

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/applications/:applicationId/trial-lessons` | 投递双方 | 发起试课预约 |
| GET | `/api/v1/trial-lessons` | 已登录 | 查询自己的预约 |
| GET | `/api/v1/trial-lessons/:id` | 预约双方 | 获取预约详情 |
| POST | `/api/v1/trial-lessons/:id/confirm` | 预约另一方 | 确认预约 |
| POST | `/api/v1/trial-lessons/:id/cancel` | 预约双方 | 取消预约 |
| POST | `/api/v1/trial-lessons/:id/complete` | 预约双方/按规则确认 | 标记试课完成 |

### 7.7 评价

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| POST | `/api/v1/trial-lessons/:trialLessonId/reviews` | 已完成试课参与者 | 提交评价 |
| GET | `/api/v1/users/:userId/reviews` | 已登录 | 分页获取用户收到的评价 |
| GET | `/api/v1/reviews/me` | 已登录 | 获取自己发出和收到的评价 |

### 7.8 管理员用户管理

| 方法 | 路径 | 角色 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/users` | 管理员 | 分页查询用户 |
| GET | `/api/v1/admin/users/:id` | 管理员 | 查看用户和必要的风控信息 |
| POST | `/api/v1/admin/users/:id/suspend` | 管理员 | 封禁账号 |
| POST | `/api/v1/admin/users/:id/activate` | 管理员 | 恢复账号 |

## 8. 核心事务边界

以下操作必须作为原子事务处理：

1. **管理员审核认证**：锁定待审记录 → 更新审核结果 → 同步 StudentProfile 认证状态。
2. **家长接受投递**：锁定需求及其投递 → 校验需求仍在招募 → 接受目标投递 → 拒绝其他未决投递 → 更新需求为已匹配 → 创建唯一会话。
3. **发送消息**：校验会话参与者 → 创建 Message → 更新 Conversation 的 `last_message_at`。
4. **确认或完成预约**：锁定预约 → 校验当前状态和操作者 → 更新状态及对应时间。
5. **提交评价**：锁定已完成预约 → 校验参与者及唯一性 → 创建 Review。

## 9. V1.0 暂不包含

- 数据库选型、数据库实例和连接配置。
- SQL、迁移脚本、种子数据和 ORM 模型。
- API Controller、Service、Route 等实现代码。
- 登录、页面、实时聊天和文件存储实现。
- 支付、合同、退款、举报、申诉及复杂风控。
