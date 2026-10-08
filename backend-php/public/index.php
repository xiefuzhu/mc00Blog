<?php
/**
 * PHP RESTful 后端单入口
 * 前后端完全解耦，提供标准 RESTful API
 * 可通过 php -S 127.0.0.1:8000 -t public 启动
 */

// 统一跨域与安全响应头
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// OPTIONS 预检请求直接通过
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 自动加载核心类
require_once __DIR__ . '/../src/Storage.php';
require_once __DIR__ . '/../src/Controllers/AuthController.php';
require_once __DIR__ . '/../src/Controllers/PostController.php';
require_once __DIR__ . '/../src/Controllers/CategoryController.php';
require_once __DIR__ . '/../src/Controllers/TagController.php';
require_once __DIR__ . '/../src/Controllers/AttachmentController.php';
require_once __DIR__ . '/../src/Controllers/StatsController.php';
require_once __DIR__ . '/../src/Controllers/UserController.php';
require_once __DIR__ . '/../src/Controllers/SettingsController.php';
require_once __DIR__ . '/../src/Controllers/LogsController.php';

// 统一 JSON 输出辅助函数
function jsonResponse($success, $data = null, $message = '', $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
        'timestamp' => time()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// 获取请求路径与方法
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// 统一去除 /api 前缀，匹配路由
$path = preg_replace('#^/api#', '', $uri);
$path = rtrim($path, '/');
if ($path === '') $path = '/';

// 获取 JSON 请求体
$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true) ?: [];

// 路由分发器
try {
    // 1. 认证路由
    if ($path === '/auth/login' && $method === 'POST') {
        (new AuthController())->login($body);
    } elseif ($path === '/auth/register' && $method === 'POST') {
        (new AuthController())->register($body);
    } elseif ($path === '/auth/quick-login' && $method === 'POST') {
        (new AuthController())->quickLogin();
    } elseif ($path === '/auth/me' && $method === 'GET') {
        (new AuthController())->me();
    }

    // 2. 统计大盘路由
    elseif ($path === '/stats' && $method === 'GET') {
        (new StatsController())->getStats();
    }

    // 3. 文章路由
    elseif ($path === '/posts' && $method === 'GET') {
        (new PostController())->list($_GET);
    } elseif (preg_match('#^/posts/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'GET') {
        (new PostController())->get($matches[1]);
    } elseif ($path === '/posts' && $method === 'POST') {
        (new PostController())->create($body);
    } elseif (preg_match('#^/posts/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'PUT') {
        (new PostController())->update($matches[1], $body);
    } elseif (preg_match('#^/posts/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'DELETE') {
        (new PostController())->delete($matches[1]);
    }

    // 4. 分类路由
    elseif ($path === '/categories' && $method === 'GET') {
        (new CategoryController())->list();
    } elseif ($path === '/categories' && $method === 'POST') {
        (new CategoryController())->create($body);
    } elseif (preg_match('#^/categories/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'PUT') {
        (new CategoryController())->update($matches[1], $body);
    } elseif (preg_match('#^/categories/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'DELETE') {
        (new CategoryController())->delete($matches[1]);
    }

    // 5. 标签路由
    elseif ($path === '/tags' && $method === 'GET') {
        (new TagController())->list();
    } elseif ($path === '/tags' && $method === 'POST') {
        (new TagController())->create($body);
    } elseif (preg_match('#^/tags/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'PUT') {
        (new TagController())->update($matches[1], $body);
    } elseif (preg_match('#^/tags/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'DELETE') {
        (new TagController())->delete($matches[1]);
    }

    // 6. 附件资源路由
    elseif ($path === '/attachments' && $method === 'GET') {
        (new AttachmentController())->list();
    } elseif ($path === '/attachments' && $method === 'POST') {
        (new AttachmentController())->create($body);
    } elseif (preg_match('#^/attachments/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'DELETE') {
        (new AttachmentController())->delete($matches[1]);
    }

    // 7. 用户管理路由
    elseif ($path === '/users' && $method === 'GET') {
        (new UserController())->list();
    } elseif (preg_match('#^/users/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'GET') {
        (new UserController())->get($matches[1]);
    } elseif ($path === '/users' && $method === 'POST') {
        (new UserController())->create($body);
    } elseif (preg_match('#^/users/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'PUT') {
        (new UserController())->update($matches[1], $body);
    } elseif (preg_match('#^/users/([a-zA-Z0-9_\-]+)$#', $path, $matches) && $method === 'DELETE') {
        (new UserController())->delete($matches[1]);
    }

    // 8. 站点设置路由
    elseif ($path === '/settings' && $method === 'GET') {
        (new SettingsController())->get();
    } elseif ($path === '/settings' && ($method === 'PUT' || $method === 'POST')) {
        (new SettingsController())->update($body);
    }

    // 9. 操作日志路由
    elseif ($path === '/logs' && $method === 'GET') {
        (new LogsController())->list();
    } elseif ($path === '/logs' && $method === 'POST') {
        (new LogsController())->create($body);
    }

    // 404 路由未命中
    else {
        jsonResponse(false, null, "Endpoint not found: [{$method}] {$uri}", 404);
    }
} catch (Exception $e) {
    jsonResponse(false, null, "Internal server error: " . $e->getMessage(), 500);
}
