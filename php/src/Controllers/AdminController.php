<?php
/**
 * 后台管理门禁控制器
 *
 *  - POST /api/admin/login   使用 config.php 的 adminPassword 校验, 成功后签发 HMAC 会话令牌
 *  - GET  /api/admin/session 校验令牌是否仍然有效, 供前端恢复会话
 *
 * 这是进入 /console/ 管理后台的唯一入口, 取代了此前的多账号登录/注册体系。
 */

class AdminController {
    public function login($body): void {
        $password = (string) ($body['password'] ?? '');

        if ($password === '') {
            jsonResponse(false, null, '请输入管理密码', 400);
        }

        if (!Auth::verifyAdminPassword($password)) {
            jsonResponse(false, null, '密码错误', 401);
        }

        $issued = Auth::issueAdminToken();
        jsonResponse(true, [
            'token' => $issued['token'],
            'expiresAt' => $issued['expiresAt'],
        ], '验证成功');
    }

    public function session(): void {
        $payload = Auth::verifyToken(Auth::bearerToken());
        if ($payload === null) {
            jsonResponse(false, null, '会话已失效，请重新验证', 401);
        }
        jsonResponse(true, ['authenticated' => true], '会话有效');
    }
}
