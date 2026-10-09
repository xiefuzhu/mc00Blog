<?php
/**
 * 认证控制器
 *
 *  - 常规账号密码登录 / 注册 / 一键免密登入
 *  - 登录成功后由 Auth 用 config.php 的 authKey 做 HMAC-SHA256 签名签发令牌
 *  - /auth/me 校验令牌并返回当前用户
 */

class AuthController {
    public function login($body): void {
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($username === '' || $password === '') {
            jsonResponse(false, null, '请输入用户名与密码', 400);
        }

        $user = self::findUser($username);
        if ($user === null || !self::verifyPassword($user, $password)) {
            jsonResponse(false, null, '用户名或密码不匹配', 401);
        }

        self::respondWithToken($user, '登录成功');
    }

    public function quickLogin(): void {
        $user = self::findUser('admin');
        if ($user === null) {
            jsonResponse(false, null, '未找到管理员账号', 404);
        }
        self::respondWithToken($user, '一键免密登入成功');
    }

    public function me(): void {
        $payload = Auth::verifyToken(Auth::bearerToken());
        if ($payload === null) {
            jsonResponse(false, null, '未登录或令牌已失效', 401);
        }
        $user = self::findUser((string) ($payload['usr'] ?? ''));
        if ($user === null) {
            jsonResponse(false, null, '用户不存在', 404);
        }
        jsonResponse(true, ['user' => self::publicUser($user)], '获取用户信息成功');
    }

    public function register($body): void {
        $username = trim((string) ($body['username'] ?? ''));
        $name = trim((string) ($body['name'] ?? '')) ?: $username;
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($username === '' || $password === '' || $email === '') {
            jsonResponse(false, null, '用户名、邮箱和密码均为必填项', 400);
        }
        if (mb_strlen($password) < 5) {
            jsonResponse(false, null, '密码长度不得少于 5 位', 400);
        }

        $users = Storage::get('users', []);
        foreach ($users as $u) {
            if (isset($u['username']) && strtolower((string) $u['username']) === strtolower($username)) {
                jsonResponse(false, null, '该用户名已被占用', 400);
            }
            if (isset($u['email']) && strtolower((string) $u['email']) === strtolower($email)) {
                jsonResponse(false, null, '该邮箱已被注册', 400);
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
            'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
            'createdAt' => date('c'),
        ];

        $users[] = $newUser;
        Storage::set('users', $users);

        jsonResponse(true, ['user' => self::publicUser($newUser)], '注册成功');
    }

    /* ------------------------------------------------------------------ 工具 */

    /** @return array<string,mixed>|null */
    private static function findUser(string $identifier): ?array {
        $needle = strtolower(trim($identifier));
        if ($needle === '') return null;
        foreach (Storage::get('users', []) as $user) {
            if (!is_array($user)) continue;
            $username = strtolower((string) ($user['username'] ?? ''));
            $email = strtolower((string) ($user['email'] ?? ''));
            if ($username === $needle || ($email !== '' && $email === $needle)) {
                return $user;
            }
        }
        return null;
    }

    /** @param array<string,mixed> $user */
    private static function verifyPassword(array $user, string $password): bool {
        if (!empty($user['passwordHash'])) {
            return password_verify($password, (string) $user['passwordHash']);
        }
        if (!empty($user['password'])) {
            return hash_equals((string) $user['password'], $password);
        }
        // 引导账号: 尚未设置密码的 admin 允许使用默认口令 admin 登录
        return strtolower((string) ($user['username'] ?? '')) === 'admin' && $password === 'admin';
    }

    /** @param array<string,mixed> $user */
    private static function respondWithToken(array $user, string $message): void {
        $issued = Auth::issueToken($user);
        jsonResponse(true, [
            'token' => $issued['token'],
            'expiresAt' => $issued['expiresAt'],
            'user' => self::publicUser($user),
        ], $message);
    }

    /** @param array<string,mixed> $user @return array<string,mixed> */
    private static function publicUser(array $user): array {
        unset($user['password'], $user['passwordHash']);
        return $user;
    }
}
