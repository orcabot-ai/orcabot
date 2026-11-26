# 架构与职责

[English](../en/architecture.md) · 简体中文

## Workspace

`apps/cli` 负责 Commander、版本信息与依赖准备；`apps/worker` 负责认证 API、SQLite 与执行控制；`apps/web` 是 React 工作台；`orcabot-web-server` 只提供静态页面和同源 API 代理。

共享包包括 contracts（校验与协议）、store（事务与历史）、runtime（公开 SDK 与远程桥接）、workflows（迁移校验）、client（无界面接口）和 cross-service（保留 Apache 许可的原生服务库）。

## 执行路径

先提交持久执行意图，再观察原执行的事件。事件持久化后才对外展示。重启或流断开时结果可能是 unknown，恢复必须使用保存的原身份和游标，不能重新发送提示词。取消 ACK 仅表示请求受理。

## 业务 API

`/api/session` 交换密钥为 HttpOnly 会话；`/api/state` 返回工作区；Agent、节点、Conversation 与 Run 有独立接口；`/api/board` 提供任务、Thread、流程、证据和审核。服务端检查来源、认证、版本与幂等键。

## 三种状态

任务认领、执行结果、业务阶段分别记录。执行完成不会自动产生已验收状态。详细字段和请求体见 [P1 交付](p1-delivery.md)。
