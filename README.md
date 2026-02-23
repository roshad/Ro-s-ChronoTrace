# Ro's ChronoTrace

[![Version](https://img.shields.io/github/v/release/roshad/Ro-s-ChronoTrace?sort=semver)](https://github.com/roshad/Ro-s-ChronoTrace/releases)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-1.75+-000000?logo=rust)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

一个基于 Tauri 的桌面时间跟踪应用，具备自动截图和窗口活动捕获功能。
- 解决了toggl track的一些痛点
    - 偶尔需要重登录
    - 统计需要到网页看
    - 内存占用高，且有内存泄漏
    - 界面操作不流畅，越用越卡

- 本应用不断增长、没有自动清理的数据：
    - 截图、窗口活动
    - 进程采样数据，默认保留30天，可设置更长时间

## 🛠️ 技术栈

### 前端
- **React 18** - UI 框架
- **TypeScript 5.x** - 类型安全
- **Vite** - 构建工具
- **Zustand** - 状态管理
- **Tanstack Query** - 数据获取和缓存
- **Lucide React** - 图标库

### 后端
- **Rust** - 系统编程语言
- **Tauri 2.x** - 桌面应用框架
- **SQLite** - 嵌入式数据库
- **Tokio** - 异步运行时
- **rusqlite** - SQLite 绑定

### Windows API
- **windows-rs** - Windows API 绑定
- **windows-capture** - 屏幕截图捕获
- **rdev** - 输入事件监听（空闲检测）

## 🚀 快速开始

### 前置条件

- **Node.js** 20+ 
- **Rust** 1.75+
- **Windows** 10/11

### 安装步骤

```bash
# 克隆仓库
git clone <repository-url>
cd toggl_like

# 安装前端依赖
npm install

# 安装 Tauri CLI
npm install -g @tauri-apps/cli
```

### 开发模式

```bash
# 启动开发服务器（同时运行前端和后端）
npm run tauri:dev
```

### 生产构建

```bash
# 构建生产版本
npm run tauri:build

# 输出目录: src-tauri/target/release/bundle/
```

## 📦 发布 EXE 到 GitHub

项目已内置工作流：`.github/workflows/release-exe.yml`。

### 一次性配置

1. 在 GitHub 创建仓库（例如 `toggl_like`）。
2. 关联并推送本地代码：

```bash
git remote add origin https://github.com/<你的用户名>/toggl_like.git
git branch -M main
git push -u origin main
```
### 版本更新

AI默认生成工作流触发条件“push tags: v*”（release-exe.yml）。称是常见方案。
[Tauri v2 官方建议里](https://v2.tauri.app/distribute/#versioning)，应用版本以 tauri.conf.json > version 为主，而且这个字段可以直接指向 package.json（即单一来源）：
让AI改为运行release脚本一键完成。不改多处。

### 给用户下载链接

发布完成后，分享：
- `https://github.com/<你的用户名>/toggl_like/releases`

## 🔄 自动更新（已接入）

应用会在启动时自动检查 GitHub Release 的 `latest.json`，检测到新版本后自动下载、安装并重启。

当前更新源：
- `https://github.com/roshad/Ro-s-ChronoTrace/releases/latest/download/latest.json`

### 一次性配置（必须）

1. 在本机生成签名密钥（若还没有）：

```bash
npx tauri signer generate -w %USERPROFILE%\\.tauri\\ros-chronotrace.key
```

2. 将私钥内容配置到 项目 Settings Secrets and variables - actions -New repository secret：
- `TAURI_SIGNING_PRIVATE_KEY`: 私钥文件全文（例如 `%USERPROFILE%\\.tauri\\ros-chronotrace.key` 的内容）
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: 私钥密码（如果生成时未设置密码，可留空）

3. 确认 `src-tauri/tauri.conf.json` 中 `plugins.updater.pubkey` 与你的私钥对应的公钥一致。
4. 确认 `src-tauri/tauri.conf.json` 中 `bundle.createUpdaterArtifacts` 为 `true`（否则 Release 不会有 `latest.json`）。

### 发布行为

当你推送新 tag（例如 `v0.1.1`）后，Release 工作流会：
- 构建安装包
- 生成签名文件
- 更新并上传 `latest.json`
- 校验 Release 资产必须包含 `latest.json` 和 `*.sig`（缺失则 CI 失败）

客户端下次启动会自动更新到最新版。

## 📁 项目结构

```
toggl_like/
├── src/                          # React 前端源码
│   ├── components/               # UI 组件
│   │   ├── capture/              # 捕获状态组件
│   │   ├── export/               # 导出功能组件
│   │   ├── idle/                 # 空闲提示组件
│   │   ├── search/               # 搜索组件
│   │   └── timeline/             # 时间轴组件
│   ├── pages/                    # 页面组件
│   │   └── TimelineView.tsx      # 主时间轴页面
│   ├── services/                 # 服务和状态管理
│   │   ├── api.ts                # Tauri 命令封装
│   │   ├── store.ts              # Zustand 状态管理
│   │   └── types.ts              # TypeScript 类型定义
│   ├── App.tsx                   # 应用主组件
│   └── main.tsx                  # 应用入口
├── src-tauri/                    # Rust 后端源码
│   ├── src/
│   │   ├── data/                 # 数据库和 CRUD 操作
│   │   │   ├── database.rs       # 数据库初始化和连接
│   │   │   ├── time_entries.rs   # 时间条目 CRUD
│   │   │   ├── screenshot.rs     # 截图数据管理
│   │   │   ├── window_activity.rs# 窗口活动管理
│   │   │   ├── idle.rs           # 空闲时间管理
│   │   │   ├── search.rs         # 搜索功能
│   │   │   └── export.rs         # 数据导出
│   │   ├── capture/              # 捕获模块
│   │   │   ├── screenshot.rs     # 截图捕获实现
│   │   │   └── window.rs         # 窗口信息捕获
│   │   ├── idle/                 # 空闲检测模块
│   │   │   └── detection.rs      # 空闲检测实现
│   │   ├── types.rs              # Rust 类型定义
│   │   ├── lib.rs                # 库入口
│   │   └── main.rs               # 应用入口
│   ├── tests/                    # 集成测试
│   └── Cargo.toml                # Rust 依赖配置
├── specs/                        # 项目文档和规范
│   └── 001-digital-diary/
│       ├── spec.md               # 功能规范
│       ├── plan.md               # 实施计划
│       ├── data-model.md         # 数据模型
│       └── tasks.md              # 任务列表
├── package.json                  # Node.js 依赖配置
├── tsconfig.json                 # TypeScript 配置
├── vite.config.ts                # Vite 配置
└── README.md                     # 本文件
```

## 💾 数据存储

### 数据库位置
- **数据库文件**: `%LocalAppData%\\RosChronoTrace\\database.db`
- **截图存储**: `%LocalAppData%\\RosChronoTrace\\screenshots\\YYYY\\MM\\DD\\`

### 数据库表结构

| 表名 | 描述 |
|------|------|
| `time_entries` | 时间条目（标签、颜色、起止时间） |
| `screenshots` | 截图元数据（时间戳、文件路径） |
| `window_activity` | 窗口活动记录（窗口标题、进程名） |
| `idle_periods` | 空闲时间段记录 |

## 🧪 测试

### Rust 测试

```bash
cd src-tauri

# 运行所有测试
cargo test

# 运行特定测试
cargo test test_time_entry_crud

# 运行性能测试
cargo test performance
```

### React 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 代码检查

```bash
# Rust 代码检查
cd src-tauri && cargo clippy

# Rust 代码格式化
cd src-tauri && cargo fmt

# TypeScript 类型检查
npm run build
```

## 📊 性能目标

根据项目性能预算，所有目标均已达成：

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 空闲内存使用 | <50MB | 45MB | ✅ |
| 活动内存使用 | <100MB | 55MB | ✅ |
| 时间轴渲染 | <50ms | <50ms | ✅ |
| 截图捕获 | <100ms | 24ms | ✅ |
| 搜索性能 | <1s | 16ms | ✅ |
| 悬停预览 | <200ms | <200ms | ✅ |

## 📝 使用指南

### 创建时间条目
1. 在时间轴上点击并拖拽选择时间范围
2. 在弹出的对话框中输入标签
3. 选择颜色（可选）
4. 点击保存

### 浏览历史
- 使用"前一天"/"后一天"按钮导航
- 点击"今天"返回当前日期
- 日期显示在页面顶部

### 搜索活动
1. 在搜索框中输入关键词（至少2个字符）
2. 查看搜索结果列表
3. 点击结果跳转到对应日期

### 导出数据
1. 点击"Export Data (JSON)"按钮
2. 数据将下载为 JSON 文件
3. 文件名包含导出日期

### 处理空闲时间
当检测到空闲时间后：
- **Discard**: 保持为空白时间段
- **Add to Previous**: 合并到上一个时间条目
- **Create New**: 创建新的时间条目

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发流程

1. 更新功能规范（`specs/001-digital-diary/spec.md`）
2. 在 Rust 中实现后端逻辑
3. 在 React 中实现前端 UI
4. 添加测试
5. 更新文档

## 📄 文档

- [功能规范](specs/001-digital-diary/spec.md) - 详细功能需求
- [实施计划](specs/001-digital-diary/plan.md) - 项目计划和架构
- [数据模型](specs/001-digital-diary/data-model.md) - 数据库设计
- [任务列表](specs/001-digital-diary/tasks.md) - 实施任务清单
- [API 契约](specs/001-digital-diary/contracts/api.yaml) - API 规范

## 🏗️ 架构概览

```
┌─────────────────────────────────────────┐
│           React Frontend                │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  Timeline   │  │  Search/Export  │  │
│  │  Component  │  │  Components     │  │
│  └─────────────┘  └─────────────────┘  │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  Zustand    │  │  Tanstack Query │  │
│  │  Store      │  │  Data Fetching  │  │
│  └─────────────┘  └─────────────────┘  │
└──────────────────┬──────────────────────┘
                   │ Tauri IPC
┌──────────────────┴──────────────────────┐
│           Rust Backend                  │
│  ┌─────────────────────────────────┐   │
│  │  Time Entry CRUD                │   │
│  │  Screenshot Capture (Background)│   │
│  │  Window Activity (Background)   │   │
│  │  Idle Detection (Background)    │   │
│  │  Search & Export                │   │
│  └─────────────────────────────────┘   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│         Data Storage                    │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │   SQLite     │  │   File System   │ │
│  │  (Metadata)  │  │  (Screenshots)  │ │
│  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────┘
```

## 📜 许可证

[MIT](LICENSE)

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 用户界面库
- [Rust](https://www.rust-lang.org/) - 系统编程语言
- [windows-rs](https://github.com/microsoft/windows-rs) - Windows API 绑定

---

**版本**: 0.1.0 (MVP)  
**最后更新**: 2026-01-28  
**状态**: ✅ Phase 0-5 已完成，可构建和测试


