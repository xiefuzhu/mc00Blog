<?php
/**
 * 本地 JSON 数据存储层
 * 提供持久化读写与初始测试数据
 */

class Storage {
    private static $dataDir = __DIR__ . '/../data';

    private static function ensureDataDir() {
        if (!is_dir(self::$dataDir)) {
            mkdir(self::$dataDir, 0777, true);
        }
    }

    public static function get($collection, $default = []) {
        self::ensureDataDir();
        $file = self::$dataDir . '/' . $collection . '.json';
        if (!file_exists($file)) {
            self::initDefaultData($collection);
        }
        if (!file_exists($file)) {
            return $default;
        }
        $content = file_get_contents($file);
        return json_decode($content, true) ?: $default;
    }

    public static function set($collection, $data) {
        self::ensureDataDir();
        $file = self::$dataDir . '/' . $collection . '.json';
        return file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private static function initDefaultData($collection) {
        if ($collection === 'posts') {
            $posts = [
                [
                    'id' => 'post-1',
                    'title' => 'Halo 2.0 风格管理控制台重构实践：解耦与沉浸式体验',
                    'slug' => 'halo-2-console-refactor',
                    'content' => "# Halo 2.0 风格管理控制台重构实践\n\n通过前后端完全解耦架构与 Svelte 5 响应式引擎，我们打造了高质感与高性能的博客工作台。",
                    'excerpt' => '探索前后端分离、Svelte 5 响应式引擎与液态毛玻璃视觉在现代内容管理系统中的实践。',
                    'status' => 'published',
                    'pinned' => true,
                    'author' => 'Halo 管理员',
                    'authorId' => 'admin',
                    'categories' => ['cat-1'],
                    'tags' => ['tag-1', 'tag-2'],
                    'views' => 1420,
                    'wordCount' => 520,
                    'createdAt' => '2026-04-01T10:00:00Z',
                    'updatedAt' => '2026-04-02T14:20:00Z',
                ],
                [
                    'id' => 'post-2',
                    'title' => '深入浅出 Svelte 5：Runes 响应式驱动的现代状态管理',
                    'slug' => 'svelte-5-runes-guide',
                    'content' => "# 深入浅出 Svelte 5\n\nRunes 带来更清晰的显式响应式语义，大幅提升了复杂组件状态的可预测性。",
                    'excerpt' => '解读 $state, $derived, $effect 等全新 Runes 特性及其在工程架构中的最佳实践。',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => '签约专栏作家 Tom',
                    'authorId' => 'author_tom',
                    'categories' => ['cat-1', 'cat-2'],
                    'tags' => ['tag-2', 'tag-3'],
                    'views' => 880,
                    'wordCount' => 430,
                    'createdAt' => '2026-04-03T09:30:00Z',
                    'updatedAt' => '2026-04-03T11:00:00Z',
                ],
                [
                    'id' => 'post-3',
                    'title' => 'Astro 与 Twilight 毛玻璃视觉：打造高通透感现代博客',
                    'slug' => 'astro-twilight-glass-design',
                    'content' => "# Astro 与 Twilight 毛玻璃视觉\n\n结合 CSS 滤镜与折射高光打造通透自然的 Apple 质感界面。",
                    'excerpt' => '深度解析 LiquidGlass 液态毛玻璃设计系统在 Astro 模板中的落地与多端适配技巧。',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => '签约专栏作家 Tom',
                    'authorId' => 'author_tom',
                    'categories' => ['cat-3'],
                    'tags' => ['tag-4'],
                    'views' => 650,
                    'wordCount' => 380,
                    'createdAt' => '2026-04-05T15:00:00Z',
                    'updatedAt' => '2026-04-05T15:00:00Z',
                ],
                [
                    'id' => 'post-4',
                    'title' => '下一代轻量化内容发布系统架构思考（草稿）',
                    'slug' => 'next-gen-cms-architecture',
                    'content' => "# 下一代轻量化内容发布系统架构思考\n\n解耦前后端，支持多端部署与静态化分发方案。",
                    'excerpt' => '探讨静态站点生成（SSG）与动态管理后台的有机融合，提升安全与访问速度。',
                    'status' => 'draft',
                    'pinned' => false,
                    'author' => '投稿人 Lucy',
                    'authorId' => 'contrib_lucy',
                    'categories' => ['cat-2'],
                    'tags' => ['tag-5'],
                    'views' => 0,
                    'wordCount' => 160,
                    'createdAt' => '2026-04-06T08:00:00Z',
                    'updatedAt' => '2026-04-06T08:00:00Z',
                ],
                [
                    'id' => 'post-5',
                    'title' => '测试 Halo 控制台重构效果',
                    'slug' => 'test-console-feature',
                    'content' => "# 测试控制台功能\n\n验证文章发布与实时统计指标更新。",
                    'excerpt' => '快速测试文章保存与多分类标签关联。',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'admin',
                    'categories' => ['cat-1'],
                    'tags' => ['tag-1'],
                    'views' => 12,
                    'wordCount' => 39,
                    'createdAt' => '2026-10-07T12:00:00Z',
                    'updatedAt' => '2026-10-07T12:00:00Z',
                ]
            ];
            self::set('posts', $posts);
        }

        if ($collection === 'categories') {
            $categories = [
                ['id' => 'cat-1', 'name' => '架构与工程', 'slug' => 'architecture', 'description' => '前后端全栈工程实践与性能优化', 'color' => '#3b82f6', 'count' => 3],
                ['id' => 'cat-2', 'name' => '前端生态', 'slug' => 'frontend', 'description' => 'Svelte, Astro, Vue 与现代化工具链', 'color' => '#10b981', 'count' => 2],
                ['id' => 'cat-3', 'name' => '设计与质感', 'slug' => 'design', 'description' => 'LiquidGlass 液态毛玻璃与界面美学', 'color' => '#8b5cf6', 'count' => 1],
                ['id' => 'cat-4', 'name' => '随笔日常', 'slug' => 'daily', 'description' => '开发者的日常随想与感悟记录', 'color' => '#f59e0b', 'count' => 0],
            ];
            self::set('categories', $categories);
        }

        if ($collection === 'tags') {
            $tags = [
                ['id' => 'tag-1', 'name' => 'Halo2', 'slug' => 'halo2', 'color' => '#3b82f6', 'count' => 2],
                ['id' => 'tag-2', 'name' => 'Svelte5', 'slug' => 'svelte5', 'color' => '#ff3e00', 'count' => 2],
                ['id' => 'tag-3', 'name' => 'Runes', 'slug' => 'runes', 'color' => '#10b981', 'count' => 1],
                ['id' => 'tag-4', 'name' => '毛玻璃UI', 'slug' => 'glassmorphism', 'color' => '#8b5cf6', 'count' => 1],
                ['id' => 'tag-5', 'name' => '静态博客', 'slug' => 'ssg', 'color' => '#ec4899', 'count' => 1],
            ];
            self::set('tags', $tags);
        }

        if ($collection === 'attachments') {
            $attachments = [
                ['id' => 'att-1', 'name' => 'twilight-hero.webp', 'url' => '/_astro/Twilight_Cover.CodURR07_Z1vOv5x.webp', 'size' => 184320, 'type' => 'image/webp', 'uploadedAt' => '2026-04-01T12:00:00Z'],
                ['id' => 'att-2', 'name' => 'architecture-flow.svg', 'url' => '/icons/favicon.svg', 'size' => 12400, 'type' => 'image/svg+xml', 'uploadedAt' => '2026-04-02T15:20:00Z'],
                ['id' => 'att-3', 'name' => 'avatar-admin.png', 'url' => '/logo.png', 'size' => 45600, 'type' => 'image/png', 'uploadedAt' => '2026-04-03T08:00:00Z']
            ];
            self::set('attachments', $attachments);
        }

        if ($collection === 'users') {
            $users = [
                [
                    'id' => 'u-admin',
                    'username' => 'admin',
                    'name' => 'Halo 管理员',
                    'email' => 'admin@halo.run',
                    'role' => 'admin',
                    'avatar' => '/logo.png',
                    'bio' => '系统超级管理员，负责全站配置与架构维护。',
                    'status' => 'active',
                    'createdAt' => '2026-01-01T00:00:00.000Z'
                ],
                [
                    'id' => 'u-tom',
                    'username' => 'tom',
                    'name' => '签约专栏作家 Tom',
                    'email' => 'tom@mc00blog.local',
                    'role' => 'author',
                    'avatar' => 'https://api.dicebear.com/7.x/bottts/svg?seed=tom',
                    'bio' => '专注于前沿前端生态与交互动效。',
                    'status' => 'active',
                    'createdAt' => '2026-02-01T00:00:00.000Z'
                ]
            ];
            self::set('users', $users);
        }

        if ($collection === 'settings') {
            $settings = [
                'siteName' => 'Twilight Blog',
                'siteSubtitle' => '现代化液态毛玻璃博客管理控制台',
                'announcement' => '控制台已顺利升级为 CPAMC 风格架构，全功能支持液态/毛玻璃双模式切换。',
                'allowRegistration' => false,
                'allowComments' => true,
                'copyProtection' => false,
                'enableRss' => true,
                'footerText' => 'Powered by Twilight & Halo Engine'
            ];
            self::set('settings', $settings);
        }

        if ($collection === 'logs') {
            $logs = [
                [
                    'id' => 'log-1',
                    'action' => '系统初始化',
                    'detail' => '博客管理控制台服务启动成功，RESTful 接口载入完毕',
                    'level' => 'success',
                    'operator' => 'system',
                    'ip' => '127.0.0.1',
                    'timestamp' => date('c', time() - 3600)
                ],
                [
                    'id' => 'log-2',
                    'action' => '超级管理员登录',
                    'detail' => '账号 admin 通过凭据登录成功',
                    'level' => 'info',
                    'operator' => 'admin',
                    'ip' => '127.0.0.1',
                    'timestamp' => date('c', time() - 1200)
                ]
            ];
            self::set('logs', $logs);
        }
    }
}
