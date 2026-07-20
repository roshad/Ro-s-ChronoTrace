# Changelog

本文件记录 Ro's ChronoTrace 各版本的重要变化。

## [Unreleased]

## [1.5.0] - 2026-07-21

### ✨ Added

- 主窗口重建时恢复上次的位置、尺寸、最大化状态和时间轴滚动位置。
- 新增窗口行为设置，可关闭“失焦 1 分钟后自动销毁界面”，让主窗口保持常驻。

### 🔄 Changed

- 主界面当前行为操作区直接横向展示分类，无需再打开分类下拉菜单。

## [1.4.0] - 2026-07-20

### ✨ Added

- 新增后台驻留模式，关闭主窗口后仍可继续截图和记录活动。
- 新增系统托盘入口，可重新打开主窗口或明确退出应用。
- 新增单实例运行，重复启动时会打开已有应用窗口。
- 创建或编辑时间条目时，可直接在窗口中选择分类。

### 🔄 Changed

- 主窗口失去焦点一分钟后会销毁闲置 WebView，从托盘打开时自动重建。
- 关闭主窗口不再退出应用；如需完全退出，请使用系统托盘中的“退出”。

[Unreleased]: https://github.com/roshad/Ro-s-ChronoTrace/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/roshad/Ro-s-ChronoTrace/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/roshad/Ro-s-ChronoTrace/compare/v1.3.0...v1.4.0
