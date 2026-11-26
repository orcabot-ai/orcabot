# 贡献指南

[English](CONTRIBUTING.md) · 简体中文

较大变更先通过 Issue 讨论问题、预期行为、边界和验收标准。使用 Node 24/26 与 pnpm 11.25.0，运行 `pnpm install --frozen-lockfile`。

提交前执行 `pnpm check`、`pnpm format:check`；依赖变化后运行 `pnpm licenses:report`。测试应验证行为；普通测试不调用付费模型或注册原生服务。明确平台跳过项，不提交密钥、数据库或对话内容。

保持原执行身份、恢复、认证、事务和证据约束。界面变更检查桌面/移动端、深浅主题；英文和中文文档一起更新，默认英文。使用 Conventional Commits，PR 说明行为、风险和验证。

自有贡献按 MIT 提交；移植代码保留原许可、署名和来源，不统一改成 MIT。本地 octo-spec 与生成的 Agent 集成文件不纳入版本控制。
