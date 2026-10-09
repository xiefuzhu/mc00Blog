<?php
/**
 * 文章/内容仓储
 *
 * 以 php/articles/ 为内容根目录, 用真实目录树表达博客的文件夹嵌套结构:
 *   php/articles/posts/**.md|mdx|html   (文章, 带 YAML frontmatter)
 *   php/articles/albums|diary|projects|skills|timeline/**.json
 *
 * 对外暴露的路径一律为「集合根目录相对路径」, 并经过白名单校验, 只能操作
 * 集合根目录内的文件, 禁止绝对路径 / 盘符 / ".." 越界。
 */

class ContentRepository {
    /** 集合注册表 (与前端 SiteCollectionKey 保持一致) */
    public static function collections(): array {
        return [
            'posts'    => ['relRoot' => 'posts',    'extensions' => ['.md', '.mdx', '.html'], 'kind' => 'markdown', 'label' => 'Posts',    'listUrl' => '/archive/'],
            'albums'   => ['relRoot' => 'albums',   'extensions' => ['.json'],                'kind' => 'json',     'label' => 'Albums',   'listUrl' => '/albums/'],
            'diary'    => ['relRoot' => 'diary',    'extensions' => ['.json'],                'kind' => 'json',     'label' => 'Diary',    'listUrl' => '/diary/'],
            'projects' => ['relRoot' => 'projects', 'extensions' => ['.json'],                'kind' => 'json',     'label' => 'Projects', 'listUrl' => '/projects/'],
            'skills'   => ['relRoot' => 'skills',   'extensions' => ['.json'],                'kind' => 'json',     'label' => 'Skills',   'listUrl' => '/skills/'],
            'timeline' => ['relRoot' => 'timeline', 'extensions' => ['.json'],                'kind' => 'json',     'label' => 'Timeline', 'listUrl' => '/timeline/'],
        ];
    }

    public static function collection(string $key): ?array {
        $all = self::collections();
        return $all[$key] ?? null;
    }

    /** 内容根目录 (php/articles) */
    public static function root(): string {
        $dir = (string) Config::get('articlesDir', dirname(__DIR__) . '/articles');
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        return rtrim(str_replace('\\', '/', $dir), '/');
    }

    private static function collectionRoot(string $key): ?string {
        $def = self::collection($key);
        return $def ? self::root() . '/' . $def['relRoot'] : null;
    }

    /* ------------------------------------------------------------------ */
    /* 路径守卫                                                            */
    /* ------------------------------------------------------------------ */

    private static function validateSegments(string $relPath): ?string {
        if ($relPath === '') return '路径不能为空';
        if (str_starts_with($relPath, '/')) return '不允许绝对路径';
        if (preg_match('/^[A-Za-z]:/', $relPath)) return '不允许盘符路径';
        foreach (explode('/', $relPath) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') return '路径包含非法片段';
        }
        return null;
    }

    /** @return array{ok:bool, abs?:string, relPath?:string, def?:array, error?:string} */
    public static function resolveEntry(string $collectionKey, string $rawRelPath): array {
        $def = self::collection($collectionKey);
        if (!$def) return ['ok' => false, 'error' => "未知的内容集合: {$collectionKey}"];

        $relPath = ltrim(str_replace('\\', '/', $rawRelPath), '/');
        if (str_starts_with($relPath, './')) $relPath = substr($relPath, 2);
        $err = self::validateSegments($relPath);
        if ($err) return ['ok' => false, 'error' => $err];

        $ext = strtolower((string) pathinfo($relPath, PATHINFO_EXTENSION));
        $ext = $ext !== '' ? '.' . $ext : '';
        if (!in_array($ext, $def['extensions'], true)) {
            return ['ok' => false, 'error' => '扩展名不被允许: ' . ($ext ?: '(无扩展名)')];
        }

        $root = self::collectionRoot($collectionKey);
        $abs = self::joinWithin($root, $relPath);
        if ($abs === null) return ['ok' => false, 'error' => '路径越界'];
        return ['ok' => true, 'abs' => $abs, 'relPath' => $relPath, 'def' => $def];
    }

    /** @return array{ok:bool, abs?:string, relPath?:string, def?:array, error?:string} */
    public static function resolveAsset(string $collectionKey, string $rawRelPath): array {
        $def = self::collection($collectionKey);
        if (!$def) return ['ok' => false, 'error' => "未知的内容集合: {$collectionKey}"];
        $relPath = ltrim(str_replace('\\', '/', $rawRelPath), '/');
        if (str_starts_with($relPath, './')) $relPath = substr($relPath, 2);
        $err = self::validateSegments($relPath);
        if ($err) return ['ok' => false, 'error' => $err];
        $root = self::collectionRoot($collectionKey);
        $abs = self::joinWithin($root, $relPath);
        if ($abs === null) return ['ok' => false, 'error' => '路径越界'];
        return ['ok' => true, 'abs' => $abs, 'relPath' => $relPath, 'def' => $def];
    }

    /** @return array{ok:bool, abs?:string, relPath?:string, def?:array, error?:string} */
    public static function resolveFolder(string $collectionKey, string $rawRelFolder, bool $allowRoot = false): array {
        $def = self::collection($collectionKey);
        if (!$def) return ['ok' => false, 'error' => "未知的内容集合: {$collectionKey}"];

        $relPath = trim(str_replace('\\', '/', $rawRelFolder), '/');
        if (str_starts_with($relPath, './')) $relPath = substr($relPath, 2);
        $root = self::collectionRoot($collectionKey);

        if ($relPath === '') {
            if (!$allowRoot) return ['ok' => false, 'error' => '文件夹路径不能为空'];
            return ['ok' => true, 'abs' => $root, 'relPath' => '', 'def' => $def];
        }
        $err = self::validateSegments($relPath);
        if ($err) return ['ok' => false, 'error' => $err];

        $abs = self::joinWithin($root, $relPath);
        if ($abs === null) return ['ok' => false, 'error' => '路径越界'];
        return ['ok' => true, 'abs' => $abs, 'relPath' => $relPath, 'def' => $def];
    }

    /** 在 root 内解析相对路径, 越界返回 null */
    private static function joinWithin(string $root, string $relPath): ?string {
        $root = rtrim(str_replace('\\', '/', $root), '/');
        $abs = $root . '/' . $relPath;
        // 归一化 . 与 .., 判断是否仍在 root 内
        $normalized = self::normalize($abs);
        if ($normalized === null) return null;
        if ($normalized !== $root && !str_starts_with($normalized, $root . '/')) return null;
        return $normalized;
    }

    private static function normalize(string $path): ?string {
        $isAbsolute = str_starts_with($path, '/');
        $parts = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') continue;
            if ($segment === '..') {
                if (empty($parts)) return null;
                array_pop($parts);
                continue;
            }
            $parts[] = $segment;
        }
        return ($isAbsolute ? '/' : '') . implode('/', $parts);
    }

    /* ------------------------------------------------------------------ */
    /* 文件系统扫描                                                        */
    /* ------------------------------------------------------------------ */

    private static function walkFiles(string $dir): array {
        $result = [];
        if (!is_dir($dir)) return $result;
        $items = @scandir($dir) ?: [];
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $abs = $dir . '/' . $item;
            if (is_dir($abs)) {
                $result = array_merge($result, self::walkFiles($abs));
            } else {
                $result[] = $abs;
            }
        }
        return $result;
    }

    private static function walkFolders(string $dir, string $base): array {
        $result = [];
        if (!is_dir($dir)) return $result;
        $items = @scandir($dir) ?: [];
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $abs = $dir . '/' . $item;
            if (is_dir($abs)) {
                $result[] = ltrim(str_replace('\\', '/', substr($abs, strlen($base))), '/');
                $result = array_merge($result, self::walkFolders($abs, $base));
            }
        }
        return $result;
    }

    /* ------------------------------------------------------------------ */
    /* 条目收集与树构建                                                    */
    /* ------------------------------------------------------------------ */

    /** 收集全部集合的条目 */
    public static function collectEntries(): array {
        $entries = [];
        foreach (self::collections() as $key => $def) {
            $root = self::collectionRoot($key);
            foreach (self::walkFiles($root) as $abs) {
                $relPath = ltrim(str_replace('\\', '/', substr($abs, strlen($root))), '/');
                $base = basename($relPath);
                if (str_starts_with($base, '_') || str_starts_with($base, '.')) continue;
                $ext = strtolower('.' . pathinfo($relPath, PATHINFO_EXTENSION));
                if (!in_array($ext, $def['extensions'], true)) continue;

                $id = substr($relPath, 0, strlen($relPath) - strlen($ext));
                $folderPath = str_contains($relPath, '/') ? substr($relPath, 0, strrpos($relPath, '/')) : '';

                if ($def['kind'] === 'markdown') {
                    $text = (string) @file_get_contents($abs);
                    $data = Frontmatter::parse($text);
                    $routeName = isset($data['routeName']) && is_string($data['routeName']) ? ltrim($data['routeName'], '/') : '';
                    $displayName = self::firstString($data['directoryTitle'] ?? null)
                        ?? self::firstString($data['title'] ?? null)
                        ?? $base;
                    $entries[] = [
                        'collection' => $key,
                        'id' => $id,
                        'relPath' => $relPath,
                        'folderPath' => $folderPath,
                        'name' => $displayName,
                        'url' => $routeName !== '' ? "/posts/{$routeName}/" : "/posts/{$id}/",
                        'format' => self::detectFormat($relPath),
                        'file' => 'articles/' . $def['relRoot'] . '/' . $relPath,
                        'meta' => [
                            'title' => $data['title'] ?? '',
                            'directoryTitle' => $data['directoryTitle'] ?? '',
                            'draft' => ($data['draft'] ?? false) === true,
                            'pinned' => ($data['pinned'] ?? false) === true,
                            'published' => $data['published'] ?? null,
                            'description' => $data['description'] ?? '',
                            'cover' => $data['cover'] ?? '',
                            'category' => $data['category'] ?? null,
                            'tags' => is_array($data['tags'] ?? null) ? $data['tags'] : [],
                        ],
                    ];
                    continue;
                }

                $raw = (string) @file_get_contents($abs);
                $data = json_decode($raw, true);
                if (!is_array($data)) $data = [];
                $displayName = self::firstString($data['title'] ?? null)
                    ?? self::firstString($data['name'] ?? null)
                    ?? $id;
                $entries[] = [
                    'collection' => $key,
                    'id' => $id,
                    'relPath' => $relPath,
                    'folderPath' => $folderPath,
                    'name' => $displayName,
                    'url' => self::jsonEntryUrl($key, $id),
                    'format' => 'json',
                    'file' => 'articles/' . $def['relRoot'] . '/' . $relPath,
                    'meta' => array_merge($data, ['visible' => ($data['visible'] ?? true) !== false]),
                ];
            }
        }
        return $entries;
    }

    /** 构建 6 个根集合的目录树 (含空文件夹) */
    public static function buildTree(): array {
        $entries = self::collectEntries();
        $roots = [];

        foreach (self::collections() as $key => $def) {
            $label = $def['label'];
            $root = (object) [
                'path' => $key, 'folderPath' => '', 'name' => $label, 'label' => $label,
                'type' => 'collection', 'collection' => $key, 'count' => 0, 'selfCount' => 0, 'children' => [],
            ];
            /** @var array<string, object> $index folderPath => 节点 */
            $index = ['' => $root];

            $collectionRoot = self::collectionRoot($key);
            $folderPaths = self::walkFolders($collectionRoot, $collectionRoot);
            // 父目录先于子目录建立
            usort($folderPaths, fn($a, $b) => substr_count($a, '/') <=> substr_count($b, '/'));
            foreach ($folderPaths as $folderPath) {
                if ($folderPath === '') continue;
                $segments = explode('/', $folderPath);
                $name = end($segments);
                $parentPath = implode('/', array_slice($segments, 0, -1));
                $node = (object) [
                    'path' => $key . '/' . $folderPath, 'folderPath' => $folderPath, 'name' => $name, 'label' => $name,
                    'type' => 'folder', 'collection' => $key, 'count' => 0, 'selfCount' => 0, 'children' => [],
                ];
                $index[$folderPath] = $node;
                $parent = $index[$parentPath] ?? $root;
                $parent->children[] = $node;
            }

            foreach ($entries as $entry) {
                if ($entry['collection'] !== $key) continue;
                $node = (object) [
                    'path' => $key . '/' . $entry['relPath'],
                    'folderPath' => $entry['folderPath'],
                    'name' => $entry['name'],
                    'label' => $entry['name'],
                    'type' => 'entry',
                    'collection' => $key,
                    'count' => 0,
                    'selfCount' => 0,
                    'url' => $entry['url'],
                    'file' => $entry['file'],
                    'entryId' => $entry['id'],
                    'format' => $entry['format'],
                    'meta' => $entry['meta'],
                ];
                $parentPath = $entry['folderPath'];
                $parent = ($parentPath !== '' && isset($index[$parentPath])) ? $index[$parentPath] : $root;
                $parent->children[] = $node;
                $root->selfCount++;
            }

            // 递归统计与排序 (文件夹优先, 同级按名称字母序)
            $finalize = function ($node) use (&$finalize) {
                $total = $node->selfCount;
                foreach ($node->children as $child) {
                    $total += $finalize($child);
                }
                $node->count = $total;
                usort($node->children, function ($a, $b) {
                    $rankA = $a->type === 'entry' ? 1 : 0;
                    $rankB = $b->type === 'entry' ? 1 : 0;
                    if ($rankA !== $rankB) return $rankA - $rankB;
                    return strcasecmp($a->name, $b->name);
                });
                return $total;
            };
            $finalize($root);
            $roots[] = self::nodeToArray($root);
        }

        return $roots;
    }

    /** 把 stdClass 目录节点递归转回关联数组 */
    private static function nodeToArray(object $node): array {
        $result = (array) $node;
        $children = [];
        foreach ($node->children as $child) {
            $children[] = self::nodeToArray($child);
        }
        $result['children'] = $children;
        return $result;
    }

    /* ------------------------------------------------------------------ */
    /* 条目读写                                                            */
    /* ------------------------------------------------------------------ */

    /** @return array{ok:bool, content?:string, data?:array, file?:string, error?:string} */
    public static function readEntry(string $collectionKey, string $relPath): array {
        $resolved = self::resolveEntry($collectionKey, $relPath);
        if (!$resolved['ok']) return ['ok' => false, 'error' => $resolved['error']];
        if (!is_file($resolved['abs'])) return ['ok' => false, 'error' => '条目不存在'];

        $content = (string) @file_get_contents($resolved['abs']);
        $data = null;
        if ($resolved['def']['kind'] === 'markdown') {
            $data = Frontmatter::parse($content);
        } else {
            $decoded = json_decode($content, true);
            $data = is_array($decoded) ? $decoded : [];
        }
        return ['ok' => true, 'content' => $content, 'data' => $data, 'file' => $resolved['abs']];
    }

    /**
     * 写入条目 (创建或更新)。
     * @param array $payload content / data / frontmatterKeys
     */
    public static function writeEntry(string $collectionKey, string $relPath, array $payload, bool $overwrite = true): array {
        $resolved = self::resolveEntry($collectionKey, $relPath);
        if (!$resolved['ok']) return ['ok' => false, 'error' => $resolved['error']];

        $abs = $resolved['abs'];
        $exists = is_file($abs);
        if ($exists && !$overwrite) return ['ok' => false, 'error' => '目标文件已存在'];

        $content = isset($payload['content']) ? (string) $payload['content'] : null;
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : null;
        $managedKeys = is_array($payload['frontmatterKeys'] ?? null) ? $payload['frontmatterKeys'] : [];

        if ($resolved['def']['kind'] === 'markdown') {
            if ($content === null) {
                $content = "---\n" . Frontmatter::dump($data ?? []) . "---\n";
            }
            if ($exists && $managedKeys) {
                $original = (string) @file_get_contents($abs);
                $content = Frontmatter::merge($original, $content, $managedKeys);
            }
            $body = $content;
        } else {
            if ($data !== null) {
                $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
            } elseif ($content !== null) {
                $body = $content;
            } else {
                $body = "{}\n";
            }
        }

        if (!is_dir(dirname($abs))) @mkdir(dirname($abs), 0777, true);
        if (@file_put_contents($abs, $body) === false) {
            return ['ok' => false, 'error' => '写入文件失败'];
        }
        return ['ok' => true, 'created' => !$exists, 'path' => $resolved['relPath'], 'file' => $abs];
    }

    public static function moveEntry(string $collectionKey, string $from, string $to, bool $overwrite = false): array {
        $src = self::resolveEntry($collectionKey, $from);
        if (!$src['ok']) return ['ok' => false, 'error' => $src['error']];
        $dst = self::resolveEntry($collectionKey, $to);
        if (!$dst['ok']) return ['ok' => false, 'error' => $dst['error']];
        if (!is_file($src['abs'])) return ['ok' => false, 'error' => '源文件不存在'];
        if (is_file($dst['abs']) && !$overwrite) return ['ok' => false, 'error' => '目标文件已存在'];

        if (!is_dir(dirname($dst['abs']))) @mkdir(dirname($dst['abs']), 0777, true);
        if ($overwrite && is_file($dst['abs'])) @unlink($dst['abs']);
        if (!@rename($src['abs'], $dst['abs'])) return ['ok' => false, 'error' => '移动失败'];
        return ['ok' => true, 'from' => $src['relPath'], 'to' => $dst['relPath'], 'file' => $dst['abs']];
    }

    public static function deleteEntry(string $collectionKey, string $relPath): array {
        $resolved = self::resolveEntry($collectionKey, $relPath);
        if (!$resolved['ok']) return ['ok' => false, 'error' => $resolved['error']];
        if (!is_file($resolved['abs'])) return ['ok' => false, 'error' => '条目不存在'];
        if (!@unlink($resolved['abs'])) return ['ok' => false, 'error' => '删除失败'];
        return ['ok' => true, 'path' => $resolved['relPath']];
    }

    /* ------------------------------------------------------------------ */
    /* 文件夹操作                                                          */
    /* ------------------------------------------------------------------ */

    public static function createFolder(string $collectionKey, string $parent, string $name): array {
        $name = trim($name);
        if ($name === '' || strpbrk($name, "/\\") !== false) return ['ok' => false, 'error' => '文件夹名称非法'];
        $parentResolved = self::resolveFolder($collectionKey, $parent, true);
        if (!$parentResolved['ok']) return ['ok' => false, 'error' => $parentResolved['error']];
        $target = rtrim($parentResolved['abs'], '/') . '/' . $name;
        if (is_dir($target)) return ['ok' => false, 'error' => '同名文件夹已存在'];
        if (!@mkdir($target, 0777, true)) return ['ok' => false, 'error' => '创建文件夹失败'];
        $rel = $parent !== '' ? trim($parent, '/') . '/' . $name : $name;
        return ['ok' => true, 'path' => $rel];
    }

    public static function renameFolder(string $collectionKey, string $from, string $to): array {
        $fromResolved = self::resolveFolder($collectionKey, $from);
        if (!$fromResolved['ok']) return ['ok' => false, 'error' => $fromResolved['error']];
        $toResolved = self::resolveFolder($collectionKey, $to);
        if (!$toResolved['ok']) return ['ok' => false, 'error' => $toResolved['error']];
        if (!is_dir($fromResolved['abs'])) return ['ok' => false, 'error' => '源文件夹不存在'];
        if (is_dir($toResolved['abs'])) return ['ok' => false, 'error' => '目标文件夹已存在'];
        if (!is_dir(dirname($toResolved['abs']))) @mkdir(dirname($toResolved['abs']), 0777, true);
        if (!@rename($fromResolved['abs'], $toResolved['abs'])) return ['ok' => false, 'error' => '重命名失败'];
        return ['ok' => true, 'from' => $fromResolved['relPath'], 'to' => $toResolved['relPath']];
    }

    /** 删除文件夹; keepEntries=true 时把直接子项上移一级 */
    public static function deleteFolder(string $collectionKey, string $relPath, bool $keepEntries): array {
        $resolved = self::resolveFolder($collectionKey, $relPath);
        if (!$resolved['ok']) return ['ok' => false, 'error' => $resolved['error']];
        $abs = $resolved['abs'];
        if (!is_dir($abs)) return ['ok' => false, 'error' => '文件夹不存在'];

        if ($keepEntries) {
            $parent = dirname($abs);
            foreach (array_diff(@scandir($abs) ?: [], ['.', '..']) as $item) {
                $src = $abs . '/' . $item;
                $dst = $parent . '/' . $item;
                if (file_exists($dst)) return ['ok' => false, 'error' => "目标位置已存在同名项, 无法上移: {$item}"];
                if (!@rename($src, $dst)) return ['ok' => false, 'error' => "上移失败: {$item}"];
            }
        }
        if (!self::removeDir($abs)) return ['ok' => false, 'error' => '删除文件夹失败'];
        return ['ok' => true, 'path' => $resolved['relPath']];
    }

    private static function removeDir(string $dir): bool {
        foreach (array_diff(@scandir($dir) ?: [], ['.', '..']) as $item) {
            $abs = $dir . '/' . $item;
            if (is_dir($abs)) {
                if (!self::removeDir($abs)) return false;
            } elseif (!@unlink($abs)) {
                return false;
            }
        }
        return @rmdir($dir);
    }

    /* ------------------------------------------------------------------ */
    /* 公开读取 (博客前台)                                                 */
    /* ------------------------------------------------------------------ */

    /** 已发布文章列表 (置顶优先, 其次按发布日期倒序) */
    public static function listPublishedPosts(): array {
        $posts = [];
        $root = self::collectionRoot('posts');
        foreach (self::walkFiles($root) as $abs) {
            $relPath = ltrim(str_replace('\\', '/', substr($abs, strlen($root))), '/');
            $base = basename($relPath);
            if (str_starts_with($base, '_') || str_starts_with($base, '.')) continue;
            $ext = strtolower('.' . pathinfo($relPath, PATHINFO_EXTENSION));
            if (!in_array($ext, ['.md', '.mdx', '.html'], true)) continue;

            $text = (string) @file_get_contents($abs);
            $data = Frontmatter::parse($text);
            if (($data['draft'] ?? false) === true) continue;

            $id = substr($relPath, 0, strlen($relPath) - strlen($ext));
            $routeName = isset($data['routeName']) && is_string($data['routeName']) ? ltrim($data['routeName'], '/') : '';
            [, $body] = Frontmatter::split($text);
            $plain = self::plainText($body);

            $posts[] = [
                'id' => $id,
                'slug' => $id,
                'relPath' => $relPath,
                'folderPath' => str_contains($relPath, '/') ? substr($relPath, 0, strrpos($relPath, '/')) : '',
                'url' => $routeName !== '' ? "/posts/{$routeName}/" : "/posts/{$id}/",
                'format' => self::detectFormat($relPath),
                'data' => $data,
                'excerpt' => self::firstString($data['description'] ?? null) ?? mb_substr($plain, 0, 160),
                'wordCount' => mb_strlen(preg_replace('/\s+/', '', $plain) ?? ''),
                'pinned' => ($data['pinned'] ?? false) === true,
                'published' => (string) ($data['published'] ?? ''),
                'updated' => (string) ($data['updated'] ?? ''),
            ];
        }

        usort($posts, function ($a, $b) {
            if ($a['pinned'] !== $b['pinned']) return $a['pinned'] ? -1 : 1;
            return strcmp($b['published'], $a['published']);
        });
        return $posts;
    }

    /** 按 slug / id / routeName 读取单篇文章 */
    public static function readPost(string $identifier): ?array {
        foreach (self::listPublishedPosts() as $post) {
            $routeName = isset($post['data']['routeName']) && is_string($post['data']['routeName'])
                ? ltrim($post['data']['routeName'], '/') : '';
            if ($post['slug'] === $identifier || $post['id'] === $identifier || ($routeName !== '' && $routeName === $identifier)) {
                $abs = self::collectionRoot('posts') . '/' . $post['relPath'];
                $text = (string) @file_get_contents($abs);
                [, $body] = Frontmatter::split($text);
                $post['content'] = $body;
                return $post;
            }
        }
        return null;
    }

    /** 某个集合的全部条目 (公开读取) */
    public static function listCollection(string $key): array {
        $def = self::collection($key);
        if (!$def) return [];
        $result = [];
        foreach (self::collectEntries() as $entry) {
            if ($entry['collection'] !== $key) continue;
            $result[] = [
                'id' => $entry['id'],
                'relPath' => $entry['relPath'],
                'folderPath' => $entry['folderPath'],
                'name' => $entry['name'],
                'url' => $entry['url'],
                'format' => $entry['format'],
                'data' => $entry['meta'],
            ];
        }
        return $result;
    }

    /* ------------------------------------------------------------------ */
    /* 工具                                                                */
    /* ------------------------------------------------------------------ */

    private static function detectFormat(string $relPath): string {
        if (preg_match('/\.html?$/i', $relPath)) return 'html';
        if (preg_match('/\.mdx$/i', $relPath)) return 'mdx';
        return 'markdown';
    }

    private static function jsonEntryUrl(string $collection, string $id): string {
        switch ($collection) {
            case 'albums': return "/albums/{$id}/";
            case 'diary': return '/diary/';
            case 'projects': return '/projects/';
            case 'skills': return '/skills/';
            case 'timeline': return '/timeline/';
            default: return '/';
        }
    }

    /** @param mixed $value */
    private static function firstString($value): ?string {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function plainText(string $markdown): string {
        $text = preg_replace('/```[\s\S]*?```/', ' ', $markdown) ?? $markdown;
        $text = preg_replace('/[#*`_~\[\]()!>|-]/', '', $text) ?? $text;
        $text = strip_tags($text);
        return trim(preg_replace('/\s+/', ' ', $text) ?? $text);
    }
}
