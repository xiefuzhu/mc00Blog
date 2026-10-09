<?php
/**
 * 鉴权: 共享密钥 + HMAC 登录令牌
 *
 *  - 共享密钥: 前端以 Authorization: Bearer <authKey> 携带, 用于服务间调用与健康检查。
 *  - 登录令牌: 登录成功后由后端用 authKey 做 HMAC-SHA256 签名签发, 后续请求携带。
 *  - 写操作: 共享密钥或有效登录令牌任一通过即可。
 */

class Auth {
    /** 请求头中的 Bearer 令牌 / 密钥 */
    public static function bearerToken(): ?string {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (is_string($header) && preg_match('/Bearer\s+(.+)/i', $header, $m)) {
            return trim($m[1]);
        }
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
        return is_string($apiKey) && $apiKey !== '' ? trim($apiKey) : null;
    }

    /** 校验共享密钥 (未配置 authKey 时视为放行) */
    public static function checkSharedKey(): bool {
        $expected = (string) Config::get('authKey', '');
        if ($expected === '') return true;
        $provided = self::bearerToken();
        return is_string($provided) && $provided !== '' && hash_equals($expected, $provided);
    }

    /** 用 authKey 签发登录令牌 */
    public static function issueToken(array $user): array {
        $ttl = (int) Config::get('tokenTtl', 604800);
        $exp = time() + max(60, $ttl);
        $payload = [
            'sub' => (string) ($user['id'] ?? ''),
            'usr' => (string) ($user['username'] ?? ''),
            'role' => (string) ($user['role'] ?? 'reader'),
            'exp' => $exp,
        ];
        $body = self::b64url((string) json_encode($payload, JSON_UNESCAPED_UNICODE));
        $sig = self::b64url(hash_hmac('sha256', $body, self::secret(), true));
        return ['token' => $body . '.' . $sig, 'expiresAt' => $exp];
    }

    /** 校验登录令牌, 返回 payload 或 null */
    public static function verifyToken(?string $token): ?array {
        if (!is_string($token) || $token === '') return null;
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;
        [$body, $sig] = $parts;
        $expected = self::b64url(hash_hmac('sha256', $body, self::secret(), true));
        if (!hash_equals($expected, $sig)) return null;
        $decoded = self::b64urlDecode($body);
        $payload = $decoded !== false ? json_decode($decoded, true) : null;
        if (!is_array($payload)) return null;
        if (isset($payload['exp']) && time() > (int) $payload['exp']) return null;
        return $payload;
    }

    /** 写操作鉴权守卫: 不通过直接返回 401 并终止 */
    public static function requireWrite(): void {
        if (self::checkSharedKey()) return;
        if (self::verifyToken(self::bearerToken()) !== null) return;
        jsonResponse(false, null, '未授权: 缺少有效的共享密钥或登录令牌', 401);
    }

    private static function secret(): string {
        $key = (string) Config::get('authKey', '');
        return $key !== '' ? $key : 'mc00-default-secret';
    }

    private static function b64url(string $bin): string {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    /** @return string|false */
    private static function b64urlDecode(string $value) {
        return base64_decode(strtr($value, '-_', '+/'));
    }
}
