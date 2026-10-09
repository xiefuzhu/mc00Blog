#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "[启动] 正在启动博客 PHP RESTful 后端服务 (读取 config.php)..."
php serve.php
