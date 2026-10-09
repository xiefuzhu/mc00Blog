@echo off
chcp 65001 >nul
echo [启动] 正在启动博客 PHP RESTful 后端服务 (读取 config.php)...
php "%~dp0serve.php"
pause
