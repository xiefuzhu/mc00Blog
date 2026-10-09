# 博客管理控制台 RESTful API 契约与跨架构规范

本规范定义了博客管理控制台的标准 RESTful API 契约。
前端（Astro + Svelte 5）与后端完全剥离解耦，通过标准 HTTP JSON 协议通信。当前后端临时采用 PHP 8 单入口实现，后续可零成本平替为 Java Web（Spring Boot / Spring MVC）。

---

## 一、 统一响应格式 (Unified Response JSON)

所有 API 统一返回如下标准 JSON 结构：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功提示语",
  "timestamp": 1775560000
}
```

- `success`: 布尔值，标识业务逻辑是否成功；
- `data`: 业务载荷，失败时可为 `null`；
- `message`: 描述信息；
- `timestamp`: 服务端秒级时间戳。

---

## 二、 核心端点清单

### 1. 后台门禁接口 (Admin Gate)

管理后台采用单密码门禁，校验通过后签发 HMAC-SHA256 会话令牌；所有写操作只接受该令牌。

| 请求方法 | 路由路径 | 说明 | 请求体 (Body) |
|---|---|---|---|
| POST | `/api/admin/login` | 提交管理密码换取会话令牌 | `{"password": "..."}` → `{"token": "...", "expiresAt": 1775560000}` |
| GET | `/api/admin/session` | 校验当前令牌是否仍然有效 | 无 → `{"authenticated": true}` |

### 2. 文章接口 (Posts)

| 请求方法 | 路由路径 | 说明 | 过滤参数 (Query) |
|---|---|---|---|
| GET | `/api/posts` | 获取文章列表 | `?keyword=...&status=published&category=cat-1` |
| GET | `/api/posts/{id}` | 获取文章详情 | 无 |
| POST | `/api/posts` | 新建文章 | `{"title":"...","content":"...","status":"published","categories":[],"tags":[]}` |
| PUT | `/api/posts/{id}` | 更新文章 | 同上 |
| DELETE | `/api/posts/{id}` | 删除指定文章 | 无 |

### 3. 分类与标签接口 (Taxonomies)

| 请求方法 | 路由路径 | 说明 |
|---|---|---|
| GET | `/api/categories` | 获取所有分类列表 |
| POST | `/api/categories` | 新增分类：`{"name":"...","slug":"...","description":"...","color":"#3b82f6"}` |
| PUT | `/api/categories/{id}` | 更新指定分类信息 |
| DELETE | `/api/categories/{id}` | 删除指定分类 |
| GET | `/api/tags` | 获取所有标签列表 |
| POST | `/api/tags` | 新增标签：`{"name":"...","slug":"...","color":"#3b82f6"}` |
| PUT | `/api/tags/{id}` | 更新指定标签信息 |
| DELETE | `/api/tags/{id}` | 删除指定标签 |

### 4. 媒体附件接口 (Attachments)

| 请求方法 | 路由路径 | 说明 |
|---|---|---|
| GET | `/api/attachments` | 获取媒体附件列表 |
| POST | `/api/attachments` | 登记/新增媒体素材：`{"name":"...","url":"...","size":102400,"type":"image/webp"}` |
| DELETE | `/api/attachments/{id}` | 删除指定媒体素材 |

### 5. 系统设置接口 (Settings)

| 请求方法 | 路由路径 | 说明 |
|---|---|---|
| GET | `/api/settings` | 获取站点系统全局配置 |
| PUT | `/api/settings` | 更新系统配置：`{"siteName":"...","announcement":"..."}` |

### 6. 操作日志接口 (Audit Logs)

| 请求方法 | 路由路径 | 说明 |
|---|---|---|
| GET | `/api/logs` | 获取最新 100 条管理操作审计日志 |
| POST | `/api/logs` | 记录操作日志：`{"action":"...","detail":"...","level":"info","operator":"admin"}` |

### 7. 统计与大盘指标 (Dashboard Stats & Throughput)

| 请求方法 | 路由路径 | 说明 |
|---|---|---|
| GET | `/api/stats` | 获取大盘运行状态、总字数、发布比例、最新文章流以及 20 个 10 分钟时段的流量吞吐数据 |

---

## 三、 Java Web (Spring Boot) 平替迁移对照指南

当后续将 PHP 后端迁移至 Java Web 时，只需在 Spring Boot 工程中创建以下控制器，前端无需更改任何一行代码，只需指定后端端口地址即可：

| 功能模块 | PHP 控制器 (当前) | Java Spring Boot 控制器 (后续) |
|---|---|---|
| 后台门禁 | `AdminController.php` | `com.blog.controller.AdminController` (`@RestController @RequestMapping("/api/admin")`) |
| 文章管理 | `PostController.php` | `com.blog.controller.PostController` (`@RestController @RequestMapping("/api/posts")`) |
| 分类管理 | `CategoryController.php` | `com.blog.controller.CategoryController` (`@RequestMapping("/api/categories")`) |
| 标签管理 | `TagController.php` | `com.blog.controller.TagController` (`@RequestMapping("/api/tags")`) |
| 媒体资源 | `AttachmentController.php` | `com.blog.controller.AttachmentController` (`@RequestMapping("/api/attachments")`) |
| 站点设置 | `SettingsController.php` | `com.blog.controller.SettingsController` (`@RequestMapping("/api/settings")`) |
| 审计日志 | `LogsController.php` | `com.blog.controller.LogsController` (`@RequestMapping("/api/logs")`) |
| 仪表盘指标 | `StatsController.php` | `com.blog.controller.StatsController` (`@RequestMapping("/api/stats")`) |

所有 DTO 字段（`title`, `slug`, `content`, `wordCount`, `status`, `pinned`, `categories`, `tags`, `throughput`）与 Java 实体字段完全 1:1 映射。
