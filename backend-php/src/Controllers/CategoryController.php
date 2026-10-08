<?php
/**
 * 分类控制器
 */

class CategoryController {
    public function list() {
        $categories = Storage::get('categories');
        jsonResponse(true, $categories, '获取分类列表成功');
    }

    public function create($body) {
        $name = trim($body['name'] ?? '');
        if ($name === '') {
            jsonResponse(false, null, '分类名称不能为空', 400);
        }

        $categories = Storage::get('categories');
        $newCat = [
            'id' => 'cat-' . (count($categories) + 1),
            'name' => $name,
            'slug' => $body['slug'] ?? ('cat-' . time()),
            'description' => $body['description'] ?? '',
            'color' => $body['color'] ?? '#3b82f6',
            'count' => 0
        ];
        $categories[] = $newCat;
        Storage::set('categories', $categories);
        jsonResponse(true, $newCat, '创建分类成功', 201);
    }

    public function update($id, $body) {
        $categories = Storage::get('categories');
        $found = false;

        foreach ($categories as &$c) {
            if ($c['id'] === $id) {
                if (isset($body['name'])) $c['name'] = trim($body['name']);
                if (isset($body['slug'])) $c['slug'] = trim($body['slug']);
                if (isset($body['description'])) $c['description'] = trim($body['description']);
                if (isset($body['color'])) $c['color'] = trim($body['color']);
                $found = true;
                $updatedCat = $c;
                break;
            }
        }

        if (!$found) {
            jsonResponse(false, null, '分类不存在', 404);
        }

        Storage::set('categories', $categories);
        jsonResponse(true, $updatedCat, '分类更新成功');
    }

    public function delete($id) {
        $categories = Storage::get('categories');
        $originalCount = count($categories);
        $categories = array_filter($categories, fn($c) => $c['id'] !== $id);

        if (count($categories) === $originalCount) {
            jsonResponse(false, null, '分类不存在', 404);
        }

        Storage::set('categories', array_values($categories));
        jsonResponse(true, ['id' => $id], '删除分类成功');
    }
}
