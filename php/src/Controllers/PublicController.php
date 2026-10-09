<?php
/**
 * 公开读取控制器 (/api/public/*)
 *
 * 供博客前台在运行时拉取文章与目录树。默认不需要鉴权密钥
 * (可通过 config.php 的 requireAuthKeyForPublic 打开)。
 */

class PublicController {
    /**
     * GET /api/public/posts[?withContent=1]
     * withContent=1 时同时返回正文 (供 RSS / Atom 等需要全文的场景使用)。
     */
    public function posts(array $query = []): void {
        $withContent = !empty($query['withContent']);
        rawJson([
            'ok' => true,
            'generatedAt' => date('c'),
            'posts' => ContentRepository::listPublishedPosts($withContent),
        ]);
    }

    /** GET /api/public/posts/{slug} */
    public function post(string $slug): void {
        $post = ContentRepository::readPost($slug);
        if ($post === null) {
            rawJson(['ok' => false, 'message' => '文章不存在'], 404);
        }
        rawJson(['ok' => true, 'post' => $post]);
    }

    /** GET /api/public/directory */
    public function directory(): void {
        rawJson(['ok' => true, 'generatedAt' => date('c'), 'tree' => ContentRepository::buildTree()]);
    }

    /** GET /api/public/collection/{key} */
    public function collection(string $key): void {
        if (ContentRepository::collection($key) === null) {
            rawJson(['ok' => false, 'message' => "未知的内容集合: {$key}"], 404);
        }
        rawJson(['ok' => true, 'collection' => $key, 'entries' => ContentRepository::listCollection($key)]);
    }

    /**
     * GET /api/public/asset?collection=&path=
     * 直接输出集合目录内的静态资源 (文章配图等), 供运行时引用相对路径图片。
     */
    public function asset(array $query): void {
        $collection = (string) ($query['collection'] ?? 'posts');
        $path = (string) ($query['path'] ?? '');
        $resolved = ContentRepository::resolveAsset($collection, $path);
        if (!$resolved['ok'] || !is_file($resolved['abs'])) {
            rawJson(['ok' => false, 'message' => '资源不存在'], 404);
        }

        $abs = $resolved['abs'];
        $mime = function_exists('mime_content_type') ? (mime_content_type($abs) ?: 'application/octet-stream') : 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($abs));
        header('Cache-Control: public, max-age=86400');
        readfile($abs);
        exit;
    }
}
