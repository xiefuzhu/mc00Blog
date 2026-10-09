<?php
/**
 * 标签控制器
 */

class TagController {
    public function list() {
        $tags = Storage::get('tags');
        jsonResponse(true, $tags, '获取标签列表成功');
    }

    public function create($body) {
        $name = trim($body['name'] ?? '');
        if ($name === '') {
            jsonResponse(false, null, '标签名称不能为空', 400);
        }

        $tags = Storage::get('tags');
        $newTag = [
            'id' => 'tag-' . (count($tags) + 1),
            'name' => $name,
            'slug' => $body['slug'] ?? ('tag-' . time()),
            'color' => $body['color'] ?? '#3b82f6',
            'count' => 0
        ];
        $tags[] = $newTag;
        Storage::set('tags', $tags);
        jsonResponse(true, $newTag, '创建标签成功', 201);
    }

    public function update($id, $body) {
        $tags = Storage::get('tags');
        $found = false;

        foreach ($tags as &$t) {
            if ($t['id'] === $id) {
                if (isset($body['name'])) $t['name'] = trim($body['name']);
                if (isset($body['slug'])) $t['slug'] = trim($body['slug']);
                if (isset($body['color'])) $t['color'] = trim($body['color']);
                $found = true;
                $updatedTag = $t;
                break;
            }
        }

        if (!$found) {
            jsonResponse(false, null, '标签不存在', 404);
        }

        Storage::set('tags', $tags);
        jsonResponse(true, $updatedTag, '标签更新成功');
    }

    public function delete($id) {
        $tags = Storage::get('tags');
        $originalCount = count($tags);
        $tags = array_filter($tags, fn($t) => $t['id'] !== $id);

        if (count($tags) === $originalCount) {
            jsonResponse(false, null, '标签不存在', 404);
        }

        Storage::set('tags', array_values($tags));
        jsonResponse(true, ['id' => $id], '删除标签成功');
    }
}
