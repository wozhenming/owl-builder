@echo off
chcp 65001 >nul
REM ============================================================
REM  CostOntology Editor 一键启动脚本
REM  启动后端 (http://localhost:8000) 与前端 (http://localhost:5173)
REM  注意：务必使用本脚本启动，避免 vite 工作目录错误导致代理失效
REM ============================================================
cd /d "%~dp0"

echo [1/2] 启动后端服务 (http://localhost:8000) ...
if not exist "backend\.venv\Scripts\python.exe" (
    echo     未找到虚拟环境，正在创建并安装依赖...
    cd backend
    python -m venv .venv
    .venv\Scripts\pip install -r requirements.txt -q
    cd ..
)
start "CostOntology-Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python -m uvicorn app.main:app --port 8000"

echo [2/2] 启动前端开发服务器 (http://localhost:5173) ...
if not exist "frontend\node_modules" (
    echo     未安装前端依赖，正在安装...
    cd frontend
    call npm install --no-audit --no-fund
    cd ..
)
start "CostOntology-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo 已启动！浏览器打开 http://localhost:5173
echo （关闭对应窗口即可停止服务）
timeout /t 2 >nul
