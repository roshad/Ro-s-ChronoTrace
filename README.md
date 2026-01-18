# Digital Diary

一个基于 Tauri 的桌面时间跟踪应用，具备自动截图和窗口活动捕获功能。

## 功能特性

- ✅ **可视化时间轴**: 24小时横向时间轴，直观显示一天的时间分配
- ✅ **拖拽创建条目**: 在时间轴上拖拽选择时间范围，快速创建时间条目
- ✅ **自动截图捕获**: 每5分钟自动捕获屏幕截图（后台运行）
- ✅ **活动搜索**: 全文搜索时间条目和窗口活动
- ✅ **数据导出**: 导出所有数据为 JSON 格式
- ✅ **日期导航**: 轻松浏览不同日期的时间记录
- ⏳ **空闲检测**: 检测5分钟以上的空闲时间（基础框架已实现）

## 技术栈

- **前端**: React 18, TypeScript, Zustand, Tanstack Query
- **后端**: Rust, Tauri 2.x
- **数据库**: SQLite
- **构建工具**: Vite, Cargo

## 快速开始

### 前置条件

- Node.js 20+
- Rust 1.75+
- Windows 10/11

### 安装和运行

```bash
# 克隆仓库
git clone <repository-url>
cd toggl_like

# 安装依赖
npm install

# 开发模式运行
npm run tauri:dev

# 生产构建
npm run tauri:build
```

### 数据存储位置

- **数据库**: `%LocalAppData%\DigitalDiary\database.db`
- **截图**: `%LocalAppData%\DigitalDiary\screenshots\YYYY\MM\DD\`

## 使用说明

1. **创建时间条目**: 在时间轴上点击并拖拽选择时间范围，输入标签和选择颜色
2. **浏览历史**: 使用"前一天"/"后一天"/"今天"按钮导航
3. **搜索活动**: 在搜索框中输入关键词（至少2个字符）
4. **导出数据**: 点击"Export Data (JSON)"按钮下载所有数据

## 项目状态

**当前版本**: 0.1.0 (MVP)
**完成度**: 约 74%
**状态**: Phase 0-2 已完成，Phase 3 部分完成，可进行构建和测试

### 已完成
- ✅ 项目架构和基础设施
- ✅ 数据库设计和实现 (SQLite + 迁移系统)
- ✅ 时间条目 CRUD 操作 (含单元测试)
- ✅ 时间轴可视化组件 (SVG-based)
- ✅ 拖拽交互和条目创建
- ✅ 搜索和导出功能
- ✅ 截图捕获实现 (windows-capture)
- ✅ 窗口活动捕获 (windows-rs)
- ✅ 空闲检测实现 (rdev)
- ✅ 前端构建成功 (无 TypeScript 错误)

### 待完成
- ⏳ 更多单元测试和集成测试
- ⏳ React 组件测试
- ⏳ 性能验证和基准测试
- ⏳ 文档完善和 README 更新

详细信息请查看：
- [实施状态报告](IMPLEMENTATION_STATUS.md)
- [构建和测试指南](BUILD_AND_TEST.md)
- [实施总结](IMPLEMENTATION_SUMMARY.md)

## 项目文档

- **功能规范**: `specs/001-digital-diary/spec.md`
- **实施计划**: `specs/001-digital-diary/plan.md`
- **技术研究**: `specs/001-digital-diary/research.md`
- **数据模型**: `specs/001-digital-diary/data-model.md`
- **任务列表**: `specs/001-digital-diary/tasks.md`
- **API 契约**: `specs/001-digital-diary/contracts/api.yaml`

## 架构概览

```
┌─────────────────────────────────────────┐
│           React Frontend                │
│  (Timeline, Search, Export UI)          │
└──────────────┬──────────────────────────┘
               │ Tauri IPC
┌──────────────┴──────────────────────────┐
│           Rust Backend                  │
│  ┌─────────────────────────────────┐   │
│  │  Time Entry CRUD                │   │
│  │  Screenshot Capture (Background)│   │
│  │  Window Activity (Background)   │   │
│  │  Idle Detection (Background)    │   │
│  │  Search & Export                │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
┌──────────────┴──────────────────────────┐
│         Data Storage                    │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │   SQLite     │  │   File System   │ │
│  │  (Metadata)  │  │  (Screenshots)  │ │
│  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────┘
```

## 性能目标

根据项目宪法（Constitution）定义的性能预算：

- **内存使用**: <100MB（活动状态），<50MB（空闲状态）
- **UI 响应**: <50ms（时间轴渲染）
- **截图捕获**: <100ms（每次捕获）
- **搜索性能**: <1s（跨1年数据）
- **悬停预览**: <200ms（截图加载）

## 开发

### 项目结构

```
toggl_like/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── pages/              # 页面组件
│   └── services/           # API 和状态管理
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── data/           # 数据库和 CRUD
│       ├── capture/        # 截图捕获
│       └── idle/           # 空闲检测
└── specs/                  # 项目文档
```

### 添加新功能

1. 更新功能规范（`specs/001-digital-diary/spec.md`）
2. 在 Rust 中实现后端逻辑
3. 在 React 中实现前端 UI
4. 添加测试
5. 更新文档

### 运行测试

```bash
# Rust 测试
cd src-tauri
cargo test

# React 测试（待实现）
npm test
```

## 贡献

本项目使用 [Specify 框架](https://github.com/specify-systems/specify) 进行开发，遵循以下流程：

1. `/speckit.specify` - 创建功能规范
2. `/speckit.clarify` - 澄清需求
3. `/speckit.plan` - 生成实施计划
4. `/speckit.tasks` - 生成任务列表
5. `/speckit.implement` - 执行实施

## 许可证

[待定]

## 致谢

- 使用 [Tauri](https://tauri.app/) 构建跨平台桌面应用
- 使用 [React](https://react.dev/) 构建用户界面
- 使用 [Specify](https://github.com/specify-systems/specify) 框架进行项目管理

---

**注意**: 这是一个正在开发中的项目。某些功能可能尚未完全实现或需要进一步优化。
