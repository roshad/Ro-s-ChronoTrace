# Release Guide

本项目使用 GitHub Actions 构建 Windows EXE 并支持自动更新。

## 相关文件
- 工作流: `.github/workflows/release-exe.yml`
- 更新清单: `latest.json`
- Tauri 配置: `src-tauri/tauri.conf.json`

## 一次性配置
1. 在 GitHub 仓库中配置 Actions Secrets:
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

2. 确认 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey` 与签名私钥对应公钥一致。

## 发布流程
1. 更新版本号（推荐以 `package.json` 为单一来源）。
2. 推送代码与版本 tag（例如 `v1.2.1`），触发发布工作流。
3. 工作流会构建安装包、生成签名并上传 release 资源。
4. 客户端启动时检查 `latest.json`，检测到新版本后自动更新。

## 参考
- https://v2.tauri.app/distribute/
- https://tauri.app/reference/config/
- https://github.com/tauri-apps/tauri-action
