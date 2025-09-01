#!/bin/bash

# Cassandra UI Tool Startup Script
# This script helps you start the development environment

set -e

echo "🚀 Starting Cassandra UI Tool..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if Cassandra/nodetool is available (optional warning)
if ! command -v nodetool &> /dev/null; then
    echo "⚠️  Warning: nodetool not found in PATH. Some operations may not work."
    echo "   Make sure Cassandra is installed and nodetool is accessible."
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install:all
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating default .env file..."
    cat > backend/.env << EOF
PORT=3001
REFRESH_INTERVAL=5000
CORS_ORIGIN=http://localhost:3000
EOF
    echo "✅ Created backend/.env with default configuration"
    echo "   Connect to Cassandra via the UI connection form."
fi

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Port $port is already in use. Please stop the service using this port."
        echo "   You can find the process with: lsof -i :$port"
        return 1
    fi
    return 0
}

# Check if required ports are available
echo "🔍 Checking port availability..."
check_port 3000 || exit 1  # Frontend
check_port 3001 || exit 1  # Backend API

echo "✅ All ports are available"

# Check Cassandra connectivity (basic check)
echo "🔗 Testing Cassandra connectivity..."
if command -v nc &> /dev/null; then
    if ! nc -z 127.0.0.1 9042 2>/dev/null; then
        echo "⚠️  Warning: Cannot connect to Cassandra at 127.0.0.1:9042"
        echo "   Make sure Cassandra is running and accessible."
        echo "   You can check with: nodetool status"
    else
        echo "✅ Cassandra appears to be running on 127.0.0.1:9042"
    fi
else
    echo "ℹ️  Skipping connectivity check (nc not available)"
fi

# Start the application
echo ""
echo "🎯 Starting development servers..."
echo "   Backend API: http://localhost:3001"
echo "   Frontend UI: http://localhost:3000"
echo "   WebSocket: ws://localhost:3001/ws"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start both frontend and backend
npm run dev
