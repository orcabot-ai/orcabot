# 项目、工作线程与例行任务

[English](../en/threads-and-routines.md) · 简体中文

2026-11-26 的首个实现切片：参考 T3 Code 的项目/持久 Thread、服务器工作空间所有权与事务性意图；参考 OpenBot 的持续指令、原对话回投、错过窗口不补跑和失败暂停。本次没有复制上游代码或品牌，也不宣称功能完全对齐。

## 工作模型

项目保存 Agent 执行节点与工作目录根的快照；Thread 是原有 Conversation，新增项目归属、标题、归档标记与 revision。每次 Run 的输入、模型配置、续接和恢复身份保持独立。改名、归档、调整项目不会重写历史。

项目归属不能跨执行节点或逃出目录根。POSIX 路径区分大小写，Windows 盘符/UNC 使用 Windows 语义；不在浏览器或控制服务器创建远程目录。项目页可以新建幂等的空线程，也可管理已有的未分配线程。归档阻止新执行，但保留历史和已受理工作，不等于取消。

## Routine 的边界

例行任务绑定一个既有 Thread 和 Agent，包含名字、指令、间隔、首次时间、可选结束时间和有限次数预算。间隔至少 15 分钟，最多 30 天；预算 1–1000 次，默认 20。最多保存 100 个例行任务，同时启用最多 20 个；最多 100 个项目。

worker 每 5 秒检查。过期超过 60 秒的时段记录为 skipped，下一次从当前检查时间加间隔计算，不补跑停机期间的历史。这是固定间隔，不是 cron 或时区日历。线程忙时跳过本次，线程归档或执行未知时暂停。立即运行也检查预算、归档和未知状态；暂停只阻止后续派发，不取消已受理工作。恢复清零失败计数，重新等待一个间隔。

## 持久化与安全

一次事务写入 occurrence、原 Run 意图、次数和下一时间，外层业务命令提交后才调用执行层。相同例行任务/到期时间或手动 commandId 不会生成第二次执行；容量不足则整体回滚。结果、交互和事件仍写到原 Thread。

成功清零失败计数；连续三次已确认失败/取消会暂停；unknown 立即暂停，保留原执行身份用于调查。重启绝不自动补发不确定的工作。Routine 完成不表示业务任务通过验收，也不替代人工证据审核。

## 界面和接口

项目页支持创建项目、新建线程、改名、归档、恢复和重新归属。例行任务页支持创建、暂停、恢复、立即运行和打开原线程。错误在当前弹窗内可见，移动端单列；深浅主题与中英文继续使用同一套界面。

API 为 `/api/projects`、`/api/projects/:id/threads`、`/api/threads/:id`、`/api/routines`、`/api/routines/:id`、`/api/routines/:id/state`、`/api/routines/:id/run`。写入都需要 commandId，线程编辑、例行状态及手动派发还需要 expectedRevision。时间为 UTC epoch 毫秒；界面按本地习惯显示。

CLI 为 `orcabot project list/create` 和 `orcabot routine list/show/create/pause/resume/run`。写入 JSON 从 stdin 或 `--input 文件` 读取，脚本使用 `--json`，通过 ORCABOT_URL 与 ORCABOT_TOKEN 连接。

## 验证和后续

数据库 v4 增加项目、例行任务、发生记录，保留 v1–v3 的历史和证据。单一可信操作者与单控制端 SQLite 边界不变，不代表独立用户/Agent 权限或 HA。

`pnpm check` 验证事务、权限、路径、预算、幂等、失败与重启；`pnpm e2e` 使用隔离的 SQLite、固定执行夹具和 Chrome/Chromium（可设置 CHROME_PATH），真实经过 HTTP 与 UI，不调用付费模型，截图不含生产数据。本地默认保留浏览器沙箱；临时 Ubuntu CI 环境因 runner 限制，显式设置 `ORCABOT_E2E_NO_SANDBOX=1`。

Git/worktree、跨 provider 回滚、子 Agent 树、cron/时区规则、事件连接器、仅通知的工具权限、check-in、独立身份、自动业务验收以及完整目标系统仍为后续工作。
