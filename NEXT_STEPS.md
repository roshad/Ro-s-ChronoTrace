# Digital Diary - 下一步行动清单

**更新日期**: 2026-01-18
**当前状态**: Phase 0-2 已完成，准备构建测试

---

## 🔴 立即执行（今天）

### 1. 测试构建和启动
```bash
# 从项目根目录执行
npm run tauri:dev
```

**预期结果**:
- ✅ Rust 代码编译成功
- ✅ React 前端构建成功
- ✅ 应用窗口打开
- ✅ 数据库在 %LocalAppData%\DigitalDiary\ 创建

**如果失败**:
1. 检查编译错误输出
2. 查看 [BUILD_AND_TEST.md](BUILD_AND_TEST.md) 故障排除部分
3. 记录错误信息

### 2. 基本功能验证

**测试清单**:
- [ ] 应用成功启动，无崩溃
- [ ] 时间轴显示 24 小时横轴
- [ ] 在时间轴上拖拽可以选择时间范围
- [ ] 弹出对话框，可以创建时间条目
- [ ] 时间条目显示在时间轴上
- [ ] 日期导航按钮工作正常
- [ ] 搜索框接受输入并显示结果
- [ ] 导出按钮可以下载 JSON 文件

**如果功能异常**:
1. 打开浏览器开发者工具查看错误
2. 检查 Rust 控制台输出
3. 记录问题和错误信息

### 3. 记录问题和创建 Issues

如果发现问题，创建 GitHub Issues：

**Issue 模板**:
```markdown
## 问题描述
[简要描述问题]

## 重现步骤
1. [步骤 1]
2. [步骤 2]
3. [步骤 3]

## 预期行为
[描述预期的行为]

## 实际行为
[描述实际发生的情况]

## 错误信息
```
[粘贴错误信息]
```

## 环境
- OS: Windows [版本]
- Node.js: [版本]
- Rust: [版本]

## 优先级
[高/中/低]
```

---

## 🟡 本周完成（1-3 天）

### 4. 实现真实截图捕获

**当前状态**: 使用占位符文件
**目标**: 集成 windows-capture crate

**步骤**:
1. 研究 windows-capture API 文档
2. 修改 `src-tauri/src/capture/screenshot.rs`
3. 实现真实的屏幕捕获
4. 测试性能（目标 <100ms）
5. 添加错误处理

**参考资源**:
- windows-capture 文档: https://docs.rs/windows-capture/
- 示例代码: https://github.com/NiiightmareXD/windows-capture/tree/main/examples

**验收标准**:
- [ ] 每 5 分钟自动捕获真实截图
- [ ] 截图保存为 PNG 文件
- [ ] 文件大小合理（<1MB）
- [ ] 捕获性能 <100ms
- [ ] 无内存泄漏

### 5. 实现窗口活动捕获

**当前状态**: 未实现
**目标**: 集成 windows-rs crate

**步骤**:
1. 研究 windows-rs API 文档
2. 创建 `src-tauri/src/capture/window.rs`
3. 实现活动窗口检测
4. 实现批量插入数据库
5. 测试数据记录

**参考资源**:
- windows-rs 文档: https://docs.rs/windows/
- GetForegroundWindow API: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow

**验收标准**:
- [ ] 每 1 分钟记录活动窗口
- [ ] 记录窗口标题和进程名
- [ ] 批量插入数据库（每 5 分钟）
- [ ] 搜索功能可以找到窗口活动

### 6. 添加基本单元测试

**当前状态**: 0% 测试覆盖率
**目标**: 关键功能测试覆盖

**步骤**:
1. 创建 `src-tauri/src/data/time_entries_tests.rs`
2. 测试 CRUD 操作
3. 测试输入验证
4. 运行 `cargo test`

**测试用例**:
- [ ] 创建时间条目成功
- [ ] 创建时间条目失败（end_time <= start_time）
- [ ] 查询时间条目按日期
- [ ] 更新时间条目
- [ ] 删除时间条目

**验收标准**:
- [ ] 所有测试通过
- [ ] 测试覆盖率 >50%（关键路径）

---

## 🟢 下周完成（4-7 天）

### 7. 完善空闲检测

**当前状态**: 基础框架
**目标**: 真实活动检测和用户提示

**步骤**:
1. 研究 rdev crate 或 Windows API
2. 实现鼠标/键盘活动监听
3. 实现空闲期记录到数据库
4. 添加 Tauri 事件通知前端
5. 实现空闲提示对话框（React）

**验收标准**:
- [ ] 5 分钟无活动后检测到空闲
- [ ] 用户返回后显示提示对话框
- [ ] 可以选择丢弃/合并/标记空闲时间
- [ ] 空闲期记录到数据库

### 8. 性能验证和优化

**目标**: 验证所有性能目标

**测试项目**:
1. **内存使用**
   - [ ] 空闲状态 <50MB
   - [ ] 活动状态 <100MB
   - [ ] 无内存泄漏

2. **UI 响应**
   - [ ] 时间轴渲染 <50ms
   - [ ] 对话框打开 <50ms
   - [ ] 搜索结果显示 <100ms

3. **数据库查询**
   - [ ] 时间轴查询（1 天）<10ms
   - [ ] 截图查找 <10ms
   - [ ] 搜索（1 年数据）<1s

4. **截图捕获**
   - [ ] 捕获时间 <100ms
   - [ ] 不阻塞 UI

**优化措施**:
- 添加性能日志
- 使用 React DevTools Profiler
- 优化数据库查询
- 添加索引（如果需要）

### 9. 完整测试覆盖

**目标**: >80% 测试覆盖率

**测试类型**:
1. **Rust 单元测试**
   - [ ] 数据库模块
   - [ ] 截图捕获模块
   - [ ] 窗口捕获模块
   - [ ] 空闲检测模块
   - [ ] 搜索模块
   - [ ] 导出模块

2. **React 组件测试**
   - [ ] Timeline 组件
   - [ ] EntryDialog 组件
   - [ ] SearchBar 组件
   - [ ] ExportButton 组件

3. **集成测试**
   - [ ] 数据库端到端测试
   - [ ] 文件系统操作测试
   - [ ] Tauri 命令集成测试

---

## 📋 长期目标（2 周+）

### 10. 代码质量提升

**任务**:
- [ ] 运行 `cargo clippy` 并修复所有警告
- [ ] 运行 `npm run build` 并修复 TypeScript 错误
- [ ] 代码格式化（rustfmt, prettier）
- [ ] 代码审查和重构
- [ ] 移除 TODO 注释

### 11. 文档完善

**任务**:
- [ ] 更新 README.md（添加截图）
- [ ] 创建用户指南
- [ ] 创建开发者文档
- [ ] 添加 API 文档
- [ ] 创建贡献指南

### 12. 功能增强

**可选功能**:
- [ ] 捕获状态指示器 UI
- [ ] 悬停预览防抖
- [ ] 搜索结果点击导航
- [ ] 时间条目编辑功能
- [ ] 时间条目删除功能
- [ ] 颜色主题切换
- [ ] 数据备份功能

### 13. 发布准备

**任务**:
- [ ] 创建发布说明
- [ ] 准备安装包
- [ ] 测试安装流程
- [ ] 准备用户文档
- [ ] 设置 GitHub Releases

---

## 📊 进度跟踪

### 当前进度
- **Phase 0-2**: ✅ 完成（60%）
- **Phase 3**: ⏳ 待开始（0%）
- **Phase 4**: ⏳ 待开始（0%）
- **Phase 5**: 🔄 进行中（50%）

### 里程碑

**Milestone 1: MVP 可运行** (本周)
- [ ] 构建测试通过
- [ ] 基本功能验证通过
- [ ] 真实截图捕获实现
- [ ] 窗口活动捕获实现

**Milestone 2: 功能完整** (下周)
- [ ] 空闲检测完善
- [ ] 基本测试覆盖
- [ ] 性能验证通过

**Milestone 3: 生产就绪** (2 周后)
- [ ] 完整测试覆盖
- [ ] 代码质量达标
- [ ] 文档完整
- [ ] 发布准备完成

---

## 🔧 工具和资源

### 开发工具
- **Rust**: `cargo check`, `cargo test`, `cargo clippy`, `cargo fmt`
- **Node.js**: `npm run build`, `npm test`, `npm run lint`
- **Tauri**: `npm run tauri:dev`, `npm run tauri:build`

### 文档资源
- [Tauri 文档](https://v2.tauri.app/)
- [React 文档](https://react.dev/)
- [Rust 文档](https://doc.rust-lang.org/)
- [SQLite 文档](https://www.sqlite.org/docs.html)

### 项目文档
- [README.md](README.md) - 项目概览
- [BUILD_AND_TEST.md](BUILD_AND_TEST.md) - 构建和测试指南
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - 详细状态报告
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - 实施总结
- [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) - 执行报告
- [specs/001-digital-diary/tasks.md](specs/001-digital-diary/tasks.md) - 任务列表

---

## 📞 需要帮助？

如果遇到问题：
1. 查看 [BUILD_AND_TEST.md](BUILD_AND_TEST.md) 故障排除部分
2. 查看项目文档
3. 创建 GitHub Issue
4. 查看 Tauri/React 官方文档

---

**最后更新**: 2026-01-18
**下次更新**: 构建测试后
