<?php
/**
 * 用户管理控制器
 */

class UserController {
    public function list() {
        $users = Storage::get('users');
        // 安全起见隐藏密码字段
        $sanitized = array_map(function($u) {
            unset($u['password']);
            return $u;
        }, $users);
        jsonResponse(true, $sanitized, '获取用户列表成功');
    }

    public function get($id) {
        $users = Storage::get('users');
        foreach ($users as $u) {
            if ($u['id'] === $id) {
                unset($u['password']);
                jsonResponse(true, $u, '获取用户成功');
            }
        }
        jsonResponse(false, null, '用户不存在', 404);
    }

    public function create($body) {
        $username = trim($body['username'] ?? '');
        $email = trim($body['email'] ?? '');
        if ($username === '' || $email === '') {
            jsonResponse(false, null, '用户名和电子邮箱不能为空', 400);
        }

        $users = Storage::get('users');
        foreach ($users as $u) {
            if ($u['username'] === $username) {
                jsonResponse(false, null, '用户名已存在', 400);
            }
        }

        $newUser = [
            'id' => 'user-' . (count($users) + 1) . '-' . substr(bin2hex(random_bytes(3)), 0, 5),
            'username' => $username,
            'name' => $body['name'] ?? $username,
            'email' => $email,
            'role' => $body['role'] ?? 'author',
            'avatar' => $body['avatar'] ?? "https://api.dicebear.com/7.x/bottts/svg?seed={$username}",
            'bio' => $body['bio'] ?? '',
            'status' => 'active',
            'createdAt' => date('c'),
        ];

        $users[] = $newUser;
        Storage::set('users', $users);

        jsonResponse(true, $newUser, '用户创建成功', 201);
    }

    public function update($id, $body) {
        $users = Storage::get('users');
        $found = false;

        foreach ($users as &$u) {
            if ($u['id'] === $id) {
                if (isset($body['name'])) $u['name'] = trim($body['name']);
                if (isset($body['email'])) $u['email'] = trim($body['email']);
                if (isset($body['role'])) $u['role'] = $body['role'];
                if (isset($body['bio'])) $u['bio'] = trim($body['bio']);
                if (isset($body['avatar'])) $u['avatar'] = trim($body['avatar']);
                if (isset($body['status'])) $u['status'] = $body['status'];
                $found = true;
                $updatedUser = $u;
                unset($updatedUser['password']);
                break;
            }
        }

        if (!$found) {
            jsonResponse(false, null, '目标用户不存在', 404);
        }

        Storage::set('users', $users);
        jsonResponse(true, $updatedUser, '用户更新成功');
    }

    public function delete($id) {
        if ($id === 'user-1' || $id === 'u-admin') {
            jsonResponse(false, null, '超级管理员账号不可删除', 403);
        }

        $users = Storage::get('users');
        $originalCount = count($users);
        $users = array_filter($users, fn($u) => $u['id'] !== $id);

        if (count($users) === $originalCount) {
            jsonResponse(false, null, '目标用户不存在', 404);
        }

        Storage::set('users', array_values($users));
        jsonResponse(true, ['id' => $id], '用户删除成功');
    }
}
