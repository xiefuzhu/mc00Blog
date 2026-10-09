<?php
/**
 * 本地 JSON 数据存储层
 * 提供持久化读写与初始测试数据
 */

class Storage {
    /** 数据目录 (由 config.php 的 dataDir 控制) */
    private static function dataDir(): string {
        $dir = (string) Config::get('dataDir', dirname(__DIR__) . '/data');
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        return rtrim(str_replace('\\', '/', $dir), '/');
    }

    private static function file(string $collection): string {
        return self::dataDir() . '/' . $collection . '.json';
    }

    public static function get($collection, $default = []) {
        $file = self::file($collection);
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
        return file_put_contents(
            self::file($collection),
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
        );
    }

    private static function initDefaultData($collection) {
        if ($collection === 'posts') {
            $posts = [
                [
                    'id' => 'post-getting-started',
                    'title' => 'Guide for Template - Getting Started',
                    'slug' => 'guide-getting-started',
                    'content' => "# Guide for Template - Getting Started\n\nTip: For the things that are not mentioned in this guide, you may find the answers in the Astro Docs.\n\n## Front-matter of Posts\n\n```yaml\n---\ntitle: My First Blog Post\npublished: 2020-02-02\ndescription: This is the first post of my new Astro blog.\n```",
                    'excerpt' => 'How to use this blog template.',
                    'status' => 'published',
                    'pinned' => true,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-guides', 'cat-getting-started'],
                    'tags' => [],
                    'views' => 1820,
                    'wordCount' => 650,
                    'createdAt' => '2001-10-02T00:00:00Z',
                    'updatedAt' => '2001-10-02T00:00:00Z',
                ],
                [
                    'id' => 'post-mermaid',
                    'title' => 'Mermaid Example',
                    'slug' => 'mermaids',
                    'content' => "# Complete Guide to Markdown with Mermaid Diagrams\n\nThis article demonstrates how to create various complex diagrams using Mermaid in Markdown documents, including flowcharts, sequence diagrams, Gantt charts, class diagrams, and state diagrams.",
                    'excerpt' => 'A simple example of a Markdown blog post with Mermaid.',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-examples'],
                    'tags' => ['tag-markdown', 'tag-mermaid'],
                    'views' => 1240,
                    'wordCount' => 420,
                    'createdAt' => '2011-11-02T00:00:00Z',
                    'updatedAt' => '2011-11-02T00:00:00Z',
                ],
                [
                    'id' => 'post-encryption',
                    'title' => 'Encryption Example',
                    'slug' => 'encryption',
                    'content' => "# Password Protected Post\n\nThis is an example of a password-protected post in the mc00 theme. The content below is encrypted using AES and can only be viewed by entering the correct password.",
                    'excerpt' => 'Password: 123456',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-examples'],
                    'tags' => ['tag-encryption'],
                    'views' => 980,
                    'wordCount' => 310,
                    'createdAt' => '2020-02-02T00:00:00Z',
                    'updatedAt' => '2020-02-02T00:00:00Z',
                ],
                [
                    'id' => 'post-video',
                    'title' => 'Video Example',
                    'slug' => 'videos',
                    'content' => "## Instructions\n\nJust copy the embed code from YouTube or other platforms, and paste it in the markdown file.",
                    'excerpt' => 'This post demonstrates how to embed video in a blog post.',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-examples'],
                    'tags' => ['tag-markdown', 'tag-video'],
                    'views' => 860,
                    'wordCount' => 290,
                    'createdAt' => '2021-12-02T00:00:00Z',
                    'updatedAt' => '2021-12-02T00:00:00Z',
                ],
                [
                    'id' => 'post-copy-protection',
                    'title' => 'Copy Protection Example',
                    'slug' => 'copy-protection',
                    'content' => "# Post with Copy Protection Enabled\n\nThis post has all four copyProtection sub-options enabled in its frontmatter.",
                    'excerpt' => 'This post demonstrates the copyProtection frontmatter option with granular controls.',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-examples'],
                    'tags' => ['tag-copy-protection'],
                    'views' => 1120,
                    'wordCount' => 380,
                    'createdAt' => '2022-11-01T00:00:00Z',
                    'updatedAt' => '2022-11-01T00:00:00Z',
                ],
                [
                    'id' => 'post-advanced-customization',
                    'title' => 'Guide for Template - Advanced Customization',
                    'slug' => 'guide-advanced-customization',
                    'content' => "# Guide for Template - Advanced Customization\n\nThis guide covers advanced customization options and features available in the mc00 template, from global configurations to specialized Markdown extensions.",
                    'excerpt' => 'Master the advanced features and customization options of the mc00 template.',
                    'status' => 'published',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-guides', 'cat-advanced-customization'],
                    'tags' => [],
                    'views' => 1530,
                    'wordCount' => 780,
                    'createdAt' => '2024-02-10T00:00:00Z',
                    'updatedAt' => '2024-02-10T00:00:00Z',
                ],
                [
                    'id' => 'post-draft',
                    'title' => 'Draft Example',
                    'slug' => 'draft',
                    'content' => "# This Article is a Draft\n\nThis article is currently in a draft state and is not published. Therefore, it will not be visible to the general audience.",
                    'excerpt' => 'This article is currently in a draft state and is not published.',
                    'status' => 'draft',
                    'pinned' => false,
                    'author' => 'Halo 管理员',
                    'authorId' => 'u-admin',
                    'categories' => ['cat-examples'],
                    'tags' => ['tag-markdown'],
                    'views' => 0,
                    'wordCount' => 150,
                    'createdAt' => '2021-12-02T00:00:00Z',
                    'updatedAt' => '2021-12-02T00:00:00Z',
                ]
            ];
            self::set('posts', $posts);
        }

        if ($collection === 'categories') {
            $categories = [
                ['id' => 'cat-examples', 'name' => '示例', 'slug' => 'examples', 'description' => '各类功能特性演示与排版范例', 'color' => '#3b82f6', 'count' => 5],
                ['id' => 'cat-guides', 'name' => '向导', 'slug' => 'guides', 'description' => '模板指南与全流程使用向导', 'color' => '#10b981', 'count' => 2],
                ['id' => 'cat-advanced-customization', 'name' => '高级定制', 'slug' => 'advanced-customization', 'description' => '进阶玩法与定制扩展', 'color' => '#8b5cf6', 'count' => 1, 'parentId' => 'cat-guides'],
                ['id' => 'cat-getting-started', 'name' => '入门指南', 'slug' => 'getting-started', 'description' => '快速上手与基础配置', 'color' => '#f59e0b', 'count' => 1, 'parentId' => 'cat-guides'],
            ];
            self::set('categories', $categories);
        }

        if ($collection === 'tags') {
            $tags = [
                ['id' => 'tag-copy-protection', 'name' => '防拷', 'slug' => 'copy-protection', 'color' => '#6366f1', 'count' => 1],
                ['id' => 'tag-encryption', 'name' => '加密', 'slug' => 'encryption', 'color' => '#ec4899', 'count' => 1],
                ['id' => 'tag-markdown', 'name' => '折扣', 'slug' => 'markdown', 'color' => '#10b981', 'count' => 3],
                ['id' => 'tag-mermaid', 'name' => '美人鱼', 'slug' => 'mermaid', 'color' => '#06b6d4', 'count' => 1],
                ['id' => 'tag-video', 'name' => '视频', 'slug' => 'video', 'color' => '#f97316', 'count' => 1],
            ];
            self::set('tags', $tags);
        }

        if ($collection === 'attachments') {
            $attachments = [
                ['id' => 'att-1', 'name' => 'Cover - Getting Started.jpg', 'url' => '/_astro/Cover - Getting Started.CLLNYX7x_vs76V.webp', 'size' => 145280, 'type' => 'image/webp', 'uploadedAt' => '2026-04-01T12:00:00Z'],
                ['id' => 'att-2', 'name' => 'Cover - Advanced Customization.jpg', 'url' => '/_astro/Cover - Advanced Customization.BlPeYdZm_Z1PEq3k.webp', 'size' => 204890, 'type' => 'image/webp', 'uploadedAt' => '2026-04-02T15:20:00Z'],
                ['id' => 'att-3', 'name' => 'defaultWallpaper.jpg', 'url' => '/assets/images/defaultWallpaper.jpg', 'size' => 312500, 'type' => 'image/jpeg', 'uploadedAt' => '2026-04-03T08:00:00Z']
            ];
            self::set('attachments', $attachments);
        }

        if ($collection === 'settings') {
            $settings = [
                'siteName' => 'mc00',
                'siteSubtitle' => 'Blog Template',
                'announcement' => '欢迎访问 mc00 博客管理控制台，全站支持液态玻璃与毛玻璃材质！',
                'allowComments' => true,
                'copyProtection' => false,
                'enableRss' => true,
                'footerText' => '© 2026 mc00. All Rights Reserved. / Powered by Twilight'
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
