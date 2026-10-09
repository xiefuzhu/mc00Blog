<?php
/**
 * PHP RESTful 后端单入口
 *
 * 前后端完全解耦: 前端 (astro/) 通过 HTTP JSON 与本服务通信。
 * 启动: php/start.bat (Windows) 或 php/start.sh (Unix), 内部调用 serve.php 读取 config.php。
 */

require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Frontmatter.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Storage.php';
require_once __DIR__ . '/../src/ContentRepository.php';
require_once __DIR__ . '/../src/Controllers/AdminController.php';
require_once __DIR__ . '/../src/Controllers/PostController.php';
require_once __DIR__ . '/../src/Controllers/CategoryController.php';
require_once __DIR__ . '/../src/Controllers/TagController.php';
require_once __DIR__ . '/../src/Controllers/AttachmentController.php';
require_once __DIR__ . '/../src/Controllers/StatsController.php';
require_once __DIR__ . '/../src/Controllers/SettingsController.php';
require_once __DIR__ . '/../src/Controllers/LogsController.php';
require_once __DIR__ . '/../src/Controllers/ContentController.php';
require_once __DIR__ . '/../src/Controllers/PublicController.php';

/* -------------------------------------------------------------------------- */
/* 跨域与安全响应头 (来源由 config.php 的 corsOrigins 控制)                     */
/* -------------------------------------------------------------------------- */

$allowedOrigins = Config::get('corsOrigins', ['*']);
if (!is_array($allowedOrigins)) $allowedOrigins = ['*'];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array('*', $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: *');
} elseif ($requestOrigin !== '' && in_array($requestOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Api-Key');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* -------------------------------------------------------------------------- */
/* 响应辅助                                                                    */
/* -------------------------------------------------------------------------- */

/** 统一业务信封 (auth / posts / categories / ... 等业务接口使用) */
function jsonResponse($success, $data = null, $message = '', $statusCode = 200) {
    rawJson([
        'success' => $success,
        'data' => $data,
        'message' => $message,
        'timestamp' => time(),
    ], $statusCode);
}

/** 原始 JSON 响应 (content / public 接口使用, 契约与前端 contentApi 一致) */
function rawJson($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/* -------------------------------------------------------------------------- */
/* 路由解析                                                                    */
/* -------------------------------------------------------------------------- */

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$path = preg_replace('#^/api#', '', $uri);
$path = rtrim($path, '/');
if ($path === '') $path = '/';

$body = json_decode(file_get_contents('php://input') ?: '', true) ?: [];

/* -------------------------------------------------------------------------- */
/* 写操作统一鉴权 (后台密码登录接口除外)                                        */
/* -------------------------------------------------------------------------- */

$publicWritePaths = ['/admin/login'];
if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'], true) && !in_array($path, $publicWritePaths, true)) {
    Auth::requireWrite();
}

/* -------------------------------------------------------------------------- */
/* 路由分发                                                                    */
/* -------------------------------------------------------------------------- */

try {
    $content = new ContentController();
    $public = new PublicController();

    /* 1. 后台门禁 */
    if ($path === '/admin/login' && $method === 'POST') {
        (new AdminController())->login($body);
    } elseif ($path === '/admin/session' && $method === 'GET') {
        (new AdminController())->session();
    }

    /* 2. 内容管理 (/api/content/*) */
    elseif ($path === '/content/capabilities' && $method === 'GET') {
        $content->capabilities();
    } elseif ($path === '/content/tree' && $method === 'GET') {
        $content->tree();
    } elseif ($path === '/content/entry' && $method === 'GET') {
        $content->entryGet($_GET);
    } elseif ($path === '/content/entry' && $method === 'PUT') {
        $content->entryPut();
    } elseif ($path === '/content/entry' && $method === 'POST') {
        $content->entryMove();
    } elseif ($path === '/content/entry' && $method === 'DELETE') {
        $content->entryDelete($_GET);
    } elseif ($path === '/content/folder' && $method === 'POST') {
        $content->folderCreate();
    } elseif ($path === '/content/folder' && $method === 'PUT') {
        $content->folderRename();
    } elseif ($path === '/content/folder' && $method === 'DELETE') {
        $content->folderDelete($_GET);
    }

    /* 3. 公开读取 (/api/public/*) */
    elseif ($path === '/public/posts' && $method === 'GET') {
        $public->posts($_GET);
    } elseif (preg_match('#^/public/posts/(.+)$#', $path, $m) && $method === 'GET') {
        $public->post(urldecode($m[1]));
    } elseif ($path === '/public/directory' && $method === 'GET') {
        $public->directory();
    } elseif (preg_match('#^/public/collection/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'GET') {
        $public->collection($m[1]);
    } elseif ($path === '/public/asset' && $method === 'GET') {
        $public->asset($_GET);
    }

    /* 4. 统计大盘 */
    elseif ($path === '/stats' && $method === 'GET') {
        (new StatsController())->getStats();
    }

    /* 5. 文章 (业务信封) */
    elseif ($path === '/posts' && $method === 'GET') {
        (new PostController())->list($_GET);
    } elseif (preg_match('#^/posts/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'GET') {
        (new PostController())->get($m[1]);
    } elseif ($path === '/posts' && $method === 'POST') {
        (new PostController())->create($body);
    } elseif (preg_match('#^/posts/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'PUT') {
        (new PostController())->update($m[1], $body);
    } elseif (preg_match('#^/posts/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'DELETE') {
        (new PostController())->delete($m[1]);
    }

    /* 6. 分类 */
    elseif ($path === '/categories' && $method === 'GET') {
        (new CategoryController())->list();
    } elseif ($path === '/categories' && $method === 'POST') {
        (new CategoryController())->create($body);
    } elseif (preg_match('#^/categories/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'PUT') {
        (new CategoryController())->update($m[1], $body);
    } elseif (preg_match('#^/categories/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'DELETE') {
        (new CategoryController())->delete($m[1]);
    }

    /* 7. 标签 */
    elseif ($path === '/tags' && $method === 'GET') {
        (new TagController())->list();
    } elseif ($path === '/tags' && $method === 'POST') {
        (new TagController())->create($body);
    } elseif (preg_match('#^/tags/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'PUT') {
        (new TagController())->update($m[1], $body);
    } elseif (preg_match('#^/tags/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'DELETE') {
        (new TagController())->delete($m[1]);
    }

    /* 8. 媒体附件 */
    elseif ($path === '/attachments' && $method === 'GET') {
        (new AttachmentController())->list();
    } elseif ($path === '/attachments' && $method === 'POST') {
        (new AttachmentController())->create($body);
    } elseif (preg_match('#^/attachments/([a-zA-Z0-9_\-]+)$#', $path, $m) && $method === 'DELETE') {
        (new AttachmentController())->delete($m[1]);
    }

    /* 9. 站点设置 */
    elseif ($path === '/settings' && $method === 'GET') {
        (new SettingsController())->get();
    } elseif ($path === '/settings' && ($method === 'PUT' || $method === 'POST')) {
        (new SettingsController())->update($body);
    }

    /* 10. 操作日志 */
    elseif ($path === '/logs' && $method === 'GET') {
        (new LogsController())->list();
    } elseif ($path === '/logs' && $method === 'POST') {
        (new LogsController())->create($body);
    }

    /* 404 */
    else {
        jsonResponse(false, null, "Endpoint not found: [{$method}] {$uri}", 404);
    }
} catch (Throwable $e) {
    jsonResponse(false, null, 'Internal server error: ' . $e->getMessage(), 500);
}
