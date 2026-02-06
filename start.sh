#!/bin/bash

# Topoo Gateway 启动脚本
# 自动清理端口并启动应用

echo "🧹 清理旧进程..."

# 1. 终止占用端口 1420 的进程
if lsof -ti:1420 > /dev/null 2>&1; then
    echo "   终止占用端口 1420 的进程..."
    lsof -ti:1420 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 2. 终止所有 tauri dev 和 vite 进程
echo "   清理 tauri 和 vite 进程..."
pkill -f "tauri dev" 2>/dev/null
pkill -f "vite.*1420" 2>/dev/null
pkill -f "cargo run.*tauri" 2>/dev/null
sleep 1

echo "✅ 清理完成"
echo ""
echo "🚀 启动应用..."
echo ""

# 3. 启动应用
cd "$(dirname "$0")"
npm run tauri dev
