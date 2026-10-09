# php/ — 博客后端 (PHP 8)

前后端彻底解耦: 前端在 `../astro/`，本目录是纯后端服务，只通过 HTTP JSON 通信。

## 启动

```
php/start.bat      # Windows
php/start.sh       # macOS / Linux
```

两者都会调用 `serve.php`，由它读取 `config.php` 里的 `host` / `port` 后启动 PHP 内置服务器。

## 配置

后端配置在 `config.php`（本目录根），前端配置在 `../astro/backend.config.json`。两处的 `authKey` 必须一致。

| 配置项 | 说明 |
| --- | --- |
| `host` / `port` | 服务监听地址，启动脚本读取 |
| `authKey` | 共享密钥，前端以 `Authorization: Bearer <authKey>` 携带 |
| `tokenTtl` | 登录令牌有效期（秒） |
| `requireAuthKeyForPublic` | 公开读取接口是否也要密钥 |
| `articlesDir` | 文章/内容根目录（默认 `php/articles`） |
| `dataDir` | 业务数据 JSON 目录（默认 `php/data`） |
| `corsOrigins` | 允许的跨域来源 |

## 文章目录结构

`php/articles/` 用**真实目录树**表达博客的文件夹嵌套结构，与前端展示的目录面板保持一致：

```
php/articles/
  posts/        *.md / *.mdx / *.html   文章（带 YAML frontmatter）
  albums/       *.json
  diary/        *.json
  projects/     *.json
  skills/       *.json
  timeline/     *.json
```

子目录即博客中的文件夹层级，例如 `php/articles/posts/guide/Getting Started.md` 对应目录树中的 `guide/Getting Started`。

## 鉴权

- 共享密钥：`Authorization: Bearer <authKey>` 或 `X-Api-Key`，用于服务间调用与健康检查。
- 登录令牌：`POST /api/auth/login` 成功后由 `authKey` 做 HMAC-SHA256 签名签发，前端后续请求携带。
- 所有写操作（POST / PUT / DELETE）需要上述任一凭据；`/auth/login`、`/auth/register`、`/auth/quick-login` 除外。

## 主要接口

内容管理（契约与前端 `astro/src/account/contentApi.ts` 一致，响应为 `{ ok, ... }`）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/content/capabilities` | 写回能力与 6 个集合元信息 |
| GET | `/api/content/tree` | 6 个集合的目录树（含空文件夹） |
| GET | `/api/content/entry?collection=&path=` | 读取条目原文与解析数据 |
| PUT | `/api/content/entry` | 创建/覆盖条目 |
| POST | `/api/content/entry` | `{ op: "move", ... }` 移动/重命名条目 |
| DELETE | `/api/content/entry?collection=&path=` | 删除条目 |
| POST | `/api/content/folder` | 新建文件夹 |
| PUT | `/api/content/folder` | 重命名/移动文件夹 |
| DELETE | `/api/content/folder?collection=&path=&keepEntries=` | 删除文件夹 |

公开读取（供博客前台运行时拉取）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/public/posts` | 已发布文章列表（含 frontmatter） |
| GET | `/api/public/posts/{slug}` | 单篇文章（frontmatter + 正文原文） |
| GET | `/api/public/directory` | 首页目录面板的目录树 |
| GET | `/api/public/collection/{key}` | 某个集合的全部条目 |
| GET | `/api/public/asset?collection=&path=` | 集合目录内的静态资源（文章配图等） |

业务接口（`/api/auth/*`、`/api/posts`、`/api/categories`、`/api/tags`、`/api/attachments`、`/api/users`、`/api/settings`、`/api/logs`、`/api/stats`）沿用统一信封 `{ success, data, message, timestamp }`，详见 `API_SPEC.md`。

## 依赖

- PHP 8.0+，内置服务器。
- 不依赖 `yaml` 扩展：frontmatter 由 `src/Frontmatter.php` 以轻量子集解析器处理（标量 / 行内数组 / 块数组 / 单层嵌套映射）。
