# P1 业务交付

[English](../en/p1-delivery.md) · 简体中文

## 业务闭环

单一可信操作者在默认工作区创建目标和逐条验收标准，选择已存在 Agent、频道和不可变流程版本。每个 WorkItem 拥有一个共享 Thread；消息本身不触发执行。

默认流程是 working → submit → review → approve → accepted；reject 返回执行阶段并生成修正任务。自定义流程当前要求执行阶段与审核阶段配对，尚无可视化流程编辑器。通过审核不能伪造 `approved:true`。

## 认领与执行

认领是 120 秒服务端租约，用不透明 token、代次和 revision 防止旧持有者操作。提交执行意图、Conversation、Run 与关联事件在一次事务中写入，随后才发起观察。已 admitted 或 unknown 的执行不能因租约过期被替换；只有已确认失败才能显式重试。

## 命令与证据

所有写入需要 commandId；同一 ID 和请求返回原回执，换请求会冲突。expectedRevision 拒绝过期操作。提交的 Markdown 不可变，服务端计算 SHA-256，提交者确认每项标准；审核针对当前确切 evidenceId 并要求说明。链接与哈希不代表自动验证正确性。

| API                                                   | 用途                    |
| ----------------------------------------------------- | ----------------------- |
| `GET /api/board`、`/attention`                        | 分页列表、待审核        |
| `POST /api/board/work`                                | 创建目标                |
| `GET /api/board/work/:id`                             | 当前状态、历史与 Thread |
| `POST /api/board/tasks/:id/claim`、`renew`、`release` | 租约操作                |
| `POST /api/board/tasks/:id/dispatch`                  | 启动原执行              |
| `POST /api/board/work/:id/evidence`                   | 提交成果                |
| `POST /api/board/work/:id/review`                     | 通过或返工              |
| `POST /api/board/work/:id/messages`、`retry`          | 讨论、已知失败重试      |

## 无界面接入

CLI 为 `orcabot board`，脚本使用 `--json`，写入 JSON 来自 `--input 文件` 或 stdin。环境为 ORCABOT_URL 与 ORCABOT_TOKEN。SDK 的 BoardClient 要求调用方保存 commandId，不能盲目重试不确定结果。回执可能含认领 token，应保密。

## 限制

每次执行显式启动；一般 DAG、自动派活、独立工作者凭证、自动证据验证尚未提供。历史按游标分页；页面仅展示近期证据，数据库保留完整记录。
