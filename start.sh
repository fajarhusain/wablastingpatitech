#!/bin/bash

# WA Blast PATITECH Desktop - Startup Script
# This script installs dependencies and starts the desktop application

echo "🚀 WA Blast PATITECH Desktop v2.0"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies. Please check your internet connection and try again."
        exit 1
    fi
    
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Create data directories if they don't exist
echo "📁 Creating data directories..."
mkdir -p data/templates data/contacts data/logs
echo "✅ Data directories created"

# Check if Electron is installed
if ! command -v electron &> /dev/null && [ ! -d "node_modules/.bin/electron" ]; then
    echo "📦 Installing Electron..."
    npm install electron --save-dev
    echo "✅ Electron installed"
fi

# Start the application
echo "🚀 Starting WA Blast PATITECH Desktop..."
echo "================================"

# Check if running in development mode
if [ "$1" = "--dev" ]; then
    echo "🔧 Running in development mode..."
    npm run dev
else
    echo "🏭 Running in production mode..."
    npm start
fi
