<?php
/**
 * 配置读取器
 *
 * 统一加载 php 根目录的 config.php, 供各控制器与服务复用。
 */

class Config {
    /** @var array<string,mixed>|null */
    private static $data = null;

    /** @return array<string,mixed> */
    public static function all(): array {
        if (self::$data === null) {
            $path = dirname(__DIR__) . '/config.php';
            $loaded = is_file($path) ? require $path : [];
            self::$data = is_array($loaded) ? $loaded : [];
        }
        return self::$data;
    }

    /** @param mixed $default @return mixed */
    public static function get(string $key, $default = null) {
        $all = self::all();
        return array_key_exists($key, $all) ? $all[$key] : $default;
    }
}
