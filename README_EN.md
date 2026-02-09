# Topoo Gateway 🚀

> Personal AI Account Management & API Gateway

<div align="center">
  <img src="public/topoo.png" alt="Topoo Gateway Logo" width="120" height="120" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">

  <h3>Your Personal AI Gateway</h3>
  <p>Multi-Account Management · Protocol Conversion · Smart Routing</p>
  
  <p>
    <img src="https://img.shields.io/badge/Version-0.0.126-blue?style=flat-square" alt="Version">
    <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri">
    <img src="https://img.shields.io/badge/Backend-Rust-red?style=flat-square" alt="Rust">
    <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square" alt="React">
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-changelog">Changelog</a>
  </p>

  <p>
    <a href="./README.md">简体中文</a> |
    <strong>English</strong>
  </p>
</div>

---

**Topoo Gateway** is a desktop application designed for developers and AI enthusiasts, providing multi-account management, protocol conversion, and intelligent request routing for seamless AI platform integration.

## ✨ Features

- 🔐 **Multi-Account Management**: Unified management for Google Gemini, Claude, and more
- 🔌 **Protocol Conversion**: Convert Web Sessions to standard API interfaces (OpenAI/Anthropic/Gemini)
- 🔀 **Smart Routing**: Automatic account rotation, quota management, and failover
- 🎨 **Multimodal Support**: Imagen 3 image generation
- 🖥️ **Cross-Platform**: macOS, Windows, Linux support
- 🐳 **Docker Deployment**: Container deployment for NAS/server environments

## 📦 Installation

### macOS

Download the latest `.dmg` from [GitHub Releases](https://github.com/viosson-d/topoo-gateway/releases).

**"Cannot open" error on first launch?**

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Topoo Gateway.app"
```

### Windows

Download `.msi` installer or portable `.zip` from [GitHub Releases](https://github.com/viosson-d/topoo-gateway/releases).

### Linux

Download `.deb` or `AppImage` from [GitHub Releases](https://github.com/viosson-d/topoo-gateway/releases).

### Docker Deployment

```bash
docker run -d --name topoo-gateway \
  -p 8045:8045 \
  -e API_KEY=sk-your-api-key \
  -e WEB_PASSWORD=your-login-password \
  -v ~/.topoo_gateway:/root/.antigravity_tools \
  viosson/topoo-gateway:latest
```

Access: `http://localhost:8045`

See [Docker Deployment Guide](./docker/README.md) for details.

## 🔌 Quick Start

### OAuth Authorization (Add Account)

1. Open "Accounts" → "Add Account" → "OAuth"
2. Click the generated authorization link and complete in browser
3. App will automatically save the account after authorization

### Claude Code CLI Integration

```bash
export ANTHROPIC_API_KEY="sk-antigravity"
export ANTHROPIC_BASE_URL="http://127.0.0.1:8045"
claude
```

### Python Example

```python
import openai

client = openai.OpenAI(
    api_key="sk-antigravity",
    base_url="http://127.0.0.1:8045/v1"
)

response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)
```

### Image Generation (Imagen 3)

```python
response = client.images.generate(
    model="gemini-3-pro-image",
    prompt="A futuristic cyberpunk city with neon lights",
    size="1920x1080",
    quality="hd"
)
```

## 📝 Changelog

### v0.0.126 (2026-02-09)

- ✨ **Dynamic Version Display**: Version automatically read from package.json
- 🔧 **Window Configuration**: Default 1280x800, minimum 1024x700
- 🐛 **Code Signing Fix**: Resolved app launch issues
- 📦 **GitHub Release**: Direct DMG download from GitHub

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Rust + Axum + Tauri
- **Database**: SQLite
- **Protocols**: OpenAI API / Anthropic API / Gemini API

## 📄 License

Based on Antigravity Manager.

---

**Star ⭐ this project to support development!**
