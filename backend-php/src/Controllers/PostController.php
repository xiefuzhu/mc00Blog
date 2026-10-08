<?php
/**
 * 文章控制器
 * 完整的文章增删改查 REST 接口
 */

class PostController {
    public function list($query) {
        $posts = Storage::get('posts');
        $keyword = trim($query['keyword'] ?? '');
        $status = trim($query['status'] ?? '');
        $category = trim($query['category'] ?? '');
        $tag = trim($query['tag'] ?? '');

        // 过滤
        $filtered = array_filter($posts, function($p) use ($keyword, $status, $category, $tag) {
            if ($status !== '' && $status !== 'all') {
                if (($p['status'] ?? 'published') !== $status) return false;
            } else if ($status === '' || $status === 'all') {
                // 默认不展示回收站文章，除非显式指定
                if (($p['status'] ?? '') === 'recycle') return false;
            }

            if ($category !== '' && $category !== 'all') {
                $cats = $p['categories'] ?? [];
                if (!in_array($category, $cats)) return false;
            }

            if ($tag !== '' && $tag !== 'all') {
                $tags = $p['tags'] ?? [];
                if (!in_array($tag, $tags)) return false;
            }

            if ($keyword !== '') {
                $inTitle = mb_stripos($p['title'] ?? '', $keyword) !== false;
                $inContent = mb_stripos($p['content'] ?? '', $keyword) !== false;
                $inSlug = mb_stripos($p['slug'] ?? '', $keyword) !== false;
                if (!$inTitle && !$inContent && !$inSlug) return false;
            }
            return true;
        });

        // 排序（置顶优先，然后按更新时间倒序）
        usort($filtered, function($a, $b) {
            $aPinned = !empty($a['pinned']);
            $bPinned = !empty($b['pinned']);
            if ($aPinned !== $bPinned) {
                return $aPinned ? -1 : 1;
            }
            return strcmp($b['updatedAt'] ?? '', $a['updatedAt'] ?? '');
        });

        jsonResponse(true, array_values($filtered), '获取文章列表成功');
    }

    public function get($id) {
        $posts = Storage::get('posts');
        foreach ($posts as $p) {
            if ($p['id'] === $id || ($p['slug'] ?? '') === $id) {
                jsonResponse(true, $p, '获取文章详情成功');
            }
        }
        jsonResponse(false, null, '文章不存在', 404);
    }

    public function create($body) {
        $title = trim($body['title'] ?? '');
        if ($title === '') {
            jsonResponse(false, null, '文章标题不能为空', 400);
        }

        $posts = Storage::get('posts');
        $newId = 'post-' . (count($posts) + 1) . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
        $content = $body['content'] ?? '';
        $cleanText = strip_tags(preg_replace('/[#*`_~\[\]()!]/', '', $content));
        $wordCount = mb_strlen(preg_replace('/\s+/', '', $cleanText));
        $readingTime = max(1, (int)ceil($wordCount / 300));

        $newPost = [
            'id' => $newId,
            'title' => $title,
            'slug' => trim($body['slug'] ?? '') ?: ('post-' . time()),
            'content' => $content,
            'summary' => trim($body['summary'] ?? $body['excerpt'] ?? mb_substr($cleanText, 0, 120)),
            'excerpt' => trim($body['excerpt'] ?? $body['summary'] ?? mb_substr($cleanText, 0, 120)),
            'cover' => $body['cover'] ?? '',
            'status' => $body['status'] ?? 'draft',
            'visibility' => $body['visibility'] ?? 'public',
            'pinned' => (bool)($body['pinned'] ?? false),
            'allowComment' => isset($body['allowComment']) ? (bool)$body['allowComment'] : true,
            'author' => $body['author'] ?? $body['authorName'] ?? 'Halo 管理员',
            'authorId' => $body['authorId'] ?? 'admin',
            'authorName' => $body['authorName'] ?? $body['author'] ?? 'Halo 管理员',
            'categories' => $body['categories'] ?? ['cat-1'],
            'tags' => $body['tags'] ?? ['tag-1'],
            'views' => (int)($body['views'] ?? 0),
            'wordCount' => $wordCount,
            'readingTime' => $readingTime,
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ];

        array_unshift($posts, $newPost);
        Storage::set('posts', $posts);

        jsonResponse(true, $newPost, '文章创建成功', 201);
    }

    public function update($id, $body) {
        $posts = Storage::get('posts');
        $found = false;

        foreach ($posts as &$p) {
            if ($p['id'] === $id) {
                if (isset($body['title'])) $p['title'] = $body['title'];
                if (isset($body['slug'])) $p['slug'] = $body['slug'];
                if (isset($body['content'])) {
                    $p['content'] = $body['content'];
                    $cleanText = strip_tags(preg_replace('/[#*`_~\[\]()!]/', '', $body['content']));
                    $p['wordCount'] = mb_strlen(preg_replace('/\s+/', '', $cleanText));
                    $p['readingTime'] = max(1, (int)ceil($p['wordCount'] / 300));
                }
                if (isset($body['summary'])) $p['summary'] = $body['summary'];
                if (isset($body['excerpt'])) $p['excerpt'] = $body['excerpt'];
                if (isset($body['cover'])) $p['cover'] = $body['cover'];
                if (isset($body['status'])) $p['status'] = $body['status'];
                if (isset($body['visibility'])) $p['visibility'] = $body['visibility'];
                if (isset($body['pinned'])) $p['pinned'] = (bool)$body['pinned'];
                if (isset($body['allowComment'])) $p['allowComment'] = (bool)$body['allowComment'];
                if (isset($body['categories'])) $p['categories'] = $body['categories'];
                if (isset($body['tags'])) $p['tags'] = $body['tags'];
                if (isset($body['views'])) $p['views'] = (int)$body['views'];
                $p['updatedAt'] = date('c');

                $found = true;
                $updatedPost = $p;
                break;
            }
        }

        if (!$found) {
            jsonResponse(false, null, '目标文章不存在', 404);
        }

        Storage::set('posts', $posts);
        jsonResponse(true, $updatedPost, '文章更新成功');
    }

    public function delete($id) {
        $posts = Storage::get('posts');
        $originalCount = count($posts);
        $posts = array_filter($posts, fn($p) => $p['id'] !== $id);

        if (count($posts) === $originalCount) {
            jsonResponse(false, null, '目标文章不存在', 404);
        }

        Storage::set('posts', array_values($posts));
        jsonResponse(true, ['id' => $id], '文章删除成功');
    }
}
