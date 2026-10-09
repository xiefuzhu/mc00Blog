@echo off
chcp 65001 >nul
echo [启动] 正在启动博客 PHP RESTful 后端服务 (端口 8000)...
echo [提示] 访问地址: http://127.0.0.1:8000/api/stats
php -S 127.0.0.1:8000 -t public
pause
