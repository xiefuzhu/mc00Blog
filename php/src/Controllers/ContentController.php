<?php
/**
 * 内容管理控制器 (/api/content/*)
 *
 * 契约与前端 src/account/contentApi.ts 保持一致: 响应体为 { ok: true, ... } 或
 * { ok: false, message, ... }, 不套用统一业务信封。
 */

class ContentController {
    /* ---------------------------------------------------------------- 工具 */

    /** @param array<string,mixed> $payload */
    private function ok(array $payload): void {
        rawJson(array_merge(['ok' => true], $payload));
    }

    /** @param array<string,mixed> $extra */
    private function fail(string $message, int $status = 400, array $extra = []): void {
        rawJson(array_merge(['ok' => false, 'message' => $message], $extra), $status);
    }

    /** @return array<string,mixed> */
    private function body(): array {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw !== false ? $raw : '', true);
        return is_array($decoded) ? $decoded : [];
    }

    private function filePath(string $collection, string $relPath): string {
        $def = ContentRepository::collection($collection);
        $relRoot = $def ? $def['relRoot'] : $collection;
        return 'articles/' . $relRoot . '/' . $relPath;
    }

    private const WRITE_REASON = 'PHP 后端直接管理 php/articles 目录, 可实时写回';

    /* ---------------------------------------------------------------- 路由处理 */

    public function capabilities(): void {
        $collections = [];
        foreach (ContentRepository::collections() as $key => $def) {
            $collections[] = [
                'key' => $key,
                'label' => $def['label'],
                'root' => 'articles/' . $def['relRoot'],
                'relRoot' => $def['relRoot'],
                'extensions' => $def['extensions'],
                'entryKind' => $def['kind'],
                'listUrl' => $def['listUrl'],
            ];
        }
        $this->ok([
            'writable' => true,
            'reason' => self::WRITE_REASON,
            'contentRoot' => ContentRepository::root(),
            'repoRoot' => dirname(dirname(__DIR__)),
            'collections' => $collections,
        ]);
    }

    public function tree(): void {
        $this->ok([
            'generatedAt' => date('c'),
            'writable' => true,
            'reason' => self::WRITE_REASON,
            'tree' => ContentRepository::buildTree(),
        ]);
    }

    /** GET /api/content/entry?collection=&path= */
    public function entryGet(array $query): void {
        $collection = (string) ($query['collection'] ?? '');
        $path = (string) ($query['path'] ?? '');
        $res = ContentRepository::readEntry($collection, $path);
        if (!$res['ok']) $this->fail($res['error'], 404);
        $this->ok([
            'collection' => $collection,
            'path' => $path,
            'filePath' => $this->filePath($collection, $path),
            'content' => $res['content'],
            'data' => $res['data'],
        ]);
    }

    /** PUT /api/content/entry */
    public function entryPut(): void {
        Auth::requireWrite();
        $body = $this->body();
        $collection = (string) ($body['collection'] ?? '');
        $path = (string) ($body['path'] ?? '');
        $overwrite = ($body['overwrite'] ?? true) !== false;

        $res = ContentRepository::writeEntry($collection, $path, $body, $overwrite);
        if (!$res['ok']) $this->fail($res['error'], 409);

        $this->ok([
            'created' => (bool) $res['created'],
            'collection' => $collection,
            'path' => $res['path'],
            'filePath' => $this->filePath($collection, $res['path']),
        ]);
    }

    /** POST /api/content/entry  { op: "move", collection, from, to } */
    public function entryMove(): void {
        Auth::requireWrite();
        $body = $this->body();
        if (($body['op'] ?? '') !== 'move') $this->fail('不支持的操作');

        $collection = (string) ($body['collection'] ?? '');
        $from = (string) ($body['from'] ?? '');
        $to = (string) ($body['to'] ?? '');
        $overwrite = ($body['overwrite'] ?? false) === true;

        $res = ContentRepository::moveEntry($collection, $from, $to, $overwrite);
        if (!$res['ok']) $this->fail($res['error'], 409);

        $this->ok([
            'collection' => $collection,
            'from' => $res['from'],
            'to' => $res['to'],
            'filePath' => $this->filePath($collection, $res['to']),
        ]);
    }

    /** DELETE /api/content/entry?collection=&path= */
    public function entryDelete(array $query): void {
        Auth::requireWrite();
        $collection = (string) ($query['collection'] ?? '');
        $path = (string) ($query['path'] ?? '');
        $res = ContentRepository::deleteEntry($collection, $path);
        if (!$res['ok']) $this->fail($res['error'], 404);
        $this->ok(['collection' => $collection, 'path' => $res['path']]);
    }

    /** POST /api/content/folder  { collection, parent, name } */
    public function folderCreate(): void {
        Auth::requireWrite();
        $body = $this->body();
        $collection = (string) ($body['collection'] ?? '');
        $parent = (string) ($body['parent'] ?? '');
        $name = (string) ($body['name'] ?? '');

        $nameError = self::validateFolderName($name);
        if ($nameError !== null) $this->fail($nameError);

        $res = ContentRepository::createFolder($collection, $parent, trim($name));
        if (!$res['ok']) $this->fail($res['error'], 409);
        $this->ok(['collection' => $collection, 'path' => $res['path']]);
    }

    /** PUT /api/content/folder  { collection, from, to } */
    public function folderRename(): void {
        Auth::requireWrite();
        $body = $this->body();
        $collection = (string) ($body['collection'] ?? '');
        $from = (string) ($body['from'] ?? '');
        $to = (string) ($body['to'] ?? '');

        $fromResolved = ContentRepository::resolveFolder($collection, $from);
        if (!$fromResolved['ok']) $this->fail('源文件夹非法: ' . $fromResolved['error']);
        $toResolved = ContentRepository::resolveFolder($collection, $to);
        if (!$toResolved['ok']) $this->fail('目标文件夹非法: ' . $toResolved['error']);

        // 禁止移动到自身或子孙目录
        if ($toResolved['abs'] === $fromResolved['abs'] || str_starts_with($toResolved['abs'], $fromResolved['abs'] . '/')) {
            $this->fail('不能移动到自身或子文件夹中');
        }

        $res = ContentRepository::renameFolder($collection, $from, $to);
        if (!$res['ok']) $this->fail($res['error'], 409);
        $this->ok(['collection' => $collection, 'from' => $res['from'], 'to' => $res['to']]);
    }

    /** DELETE /api/content/folder?collection=&path=&keepEntries= */
    public function folderDelete(array $query): void {
        Auth::requireWrite();
        $collection = (string) ($query['collection'] ?? '');
        $path = (string) ($query['path'] ?? '');
        $keepEntries = ($query['keepEntries'] ?? 'false') === 'true';

        $res = ContentRepository::deleteFolder($collection, $path, $keepEntries);
        if (!$res['ok']) $this->fail($res['error'], 409);
        $this->ok(['collection' => $collection, 'path' => $res['path'], 'keepEntries' => $keepEntries]);
    }

    private static function validateFolderName(string $name): ?string {
        $trimmed = trim($name);
        if ($trimmed === '') return '文件夹名称不能为空';
        if ($trimmed === '.' || $trimmed === '..') return '文件夹名称非法';
        if (str_starts_with($trimmed, '.')) return '文件夹名称不能以点号开头';
        if (preg_match('/[\\\\\/:*?"<>|]/', $trimmed)) return '文件夹名称包含非法字符';
        return null;
    }
}
