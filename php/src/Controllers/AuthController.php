<?php
/**
 * 认证控制器
 * 支持常规账号密码登录、免密快捷登入与身份信息获取
 */

class AuthController {
    public function login($body) {
        $username = trim($body['username'] ?? '');
        $password = trim($body['password'] ?? '');

        if ($username === '' || $password === '') {
            jsonResponse(false, null, '请输入用户名与密码', 400);
        }

        // 默认模拟管理员账号校验
        if ($username === 'admin' && $password === 'admin') {
            $user = [
                'id' => 'user-1',
                'username' => 'admin',
                'name' => 'Halo 管理员',
                'email' => 'admin@halo.run',
                'role' => 'admin',
                'avatar' => '/logo.png',
                'bio' => '超级系统管理员，全权限管控中枢'
            ];
            $token = 'mock-jwt-token-admin-' . bin2hex(random_bytes(16));
            jsonResponse(true, ['token' => $token, 'user' => $user], '登录成功');
        }

        jsonResponse(false, null, '用户名或密码不匹配，默认账号 admin / admin', 401);
    }

    public function quickLogin() {
        // 一键免密快捷登入超级管理员
        $user = [
            'id' => 'user-1',
            'username' => 'admin',
            'name' => 'Halo 管理员',
            'email' => 'admin@halo.run',
            'role' => 'admin',
            'avatar' => '/logo.png',
            'bio' => '超级系统管理员，全权限管控中枢'
        ];
        $token = 'mock-jwt-token-admin-' . bin2hex(random_bytes(16));
        jsonResponse(true, ['token' => $token, 'user' => $user], '一键免密登入成功');
    }

    public function me() {
        $user = [
            'id' => 'user-1',
            'username' => 'admin',
            'name' => 'Halo 管理员',
            'email' => 'admin@halo.run',
            'role' => 'admin',
            'avatar' => '/logo.png',
            'bio' => '超级系统管理员，全权限管控中枢'
        ];
        jsonResponse(true, ['user' => $user], '获取用户信息成功');
    }

    public function register($body) {
        $username = trim($body['username'] ?? '');
        $name = trim($body['name'] ?? '') ?: $username;
        $email = trim($body['email'] ?? '');
        $password = trim($body['password'] ?? '');

        if ($username === '' || $password === '' || $email === '') {
            jsonResponse(false, null, '用户名、邮箱和密码均为必填项', 400);
        }

        $users = Storage::get('users', []);
        foreach ($users as $u) {
            if (isset($u['username']) && strtolower($u['username']) === strtolower($username)) {
                jsonResponse(false, null, '该用户名已被占用', 400);
            }
        }

        $newUser = [
            'id' => 'u-' . time(),
            'username' => $username,
            'name' => $name,
            'email' => $email,
            'role' => 'reader',
            'avatar' => "https://api.dicebear.com/7.x/bottts/svg?seed={$username}",
            'bio' => '新注册用户',
            'status' => 'active',
            'createdAt' => date('c'),
            'password' => $password
        ];

        $users[] = $newUser;
        Storage::set('users', $users);

        $token = 'mock-jwt-token-' . bin2hex(random_bytes(16));
        jsonResponse(true, ['token' => $token, 'user' => $newUser], '注册成功');
    }
}
