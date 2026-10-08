<?php
/**
 * 操作与系统日志控制器
 */

class LogsController {
    public function list() {
        $logs = Storage::get('logs');
        jsonResponse(true, $logs, '获取日志记录成功');
    }

    public function create($body) {
        $action = trim($body['action'] ?? '');
        if ($action === '') {
            jsonResponse(false, null, '操作动作描述不能为空', 400);
        }

        $logs = Storage::get('logs');
        $newLog = [
            'id' => 'log-' . time() . '-' . substr(bin2hex(random_bytes(3)), 0, 4),
            'action' => $action,
            'detail' => $body['detail'] ?? '',
            'level' => $body['level'] ?? 'info',
            'operator' => $body['operator'] ?? 'admin',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'timestamp' => date('c')
        ];

        array_unshift($logs, $newLog);
        // 保留最近 100 条日志
        if (count($logs) > 100) {
            $logs = array_slice($logs, 0, 100);
        }
        Storage::set('logs', $logs);

        jsonResponse(true, $newLog, '日志写入成功', 201);
    }
}
