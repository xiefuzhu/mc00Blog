<?php
/**
 * PHP 内置服务器启动器
 *
 * 从 config.php 读取监听地址并启动内置服务器，作为 start.bat / start.sh 的
 * 统一入口，避免在多个脚本里重复写死 host/port。
 */

$config = require __DIR__ . '/config.php';

$host = $config['host'] ?? '127.0.0.1';
$port = (int) ($config['port'] ?? 8000);
$docroot = __DIR__ . '/public';

$php = PHP_BINARY ?: 'php';
$cmd = sprintf('%s -S %s -t %s', escapeshellarg($php), escapeshellarg($host . ':' . $port), escapeshellarg($docroot));

echo "[启动] 博客 PHP 后端服务\n";
echo "[地址] http://{$host}:{$port}\n";
echo "[健康] http://{$host}:{$port}/api/stats\n";
echo "[提示] 按 Ctrl+C 停止服务\n\n";

passthru($cmd, $exitCode);
exit((int) $exitCode);
