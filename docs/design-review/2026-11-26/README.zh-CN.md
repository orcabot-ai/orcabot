# Orcabot UI审阅 — 11月26日

[English](README.md) · 简体中文

本轮覆盖19个核心页面与弹窗：真实截图、Gemini点评和实际生成图、按图实现、整改截图、独立review及英文提交。实现与检查已完成，最后一个实现提交由收尾审计写入清单。

见[覆盖清单](manifest.json)。图稿是设计参考，不是产品数据，也不代表图中功能都已实现。

| 分组                     | 界面数 | 图稿与实现材料                                                                                                                                          |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 个人首页与入口           | 3      | [实际图稿](references/personal-home-landing-gemini.jpg) · [实现取舍](references/personal-home-review.md)                                                |
| 助手、本机与远端配置     | 3      | [实际图稿](references/setup-dialogs-gemini.jpg) · [审阅](references/setup-review.md)                                                                    |
| 任务列表、创建与详情     | 3      | [实际图稿](references/tasks-gemini.jpg) · [边界修正](references/task-review.md)                                                                         |
| 项目、线程管理与例行任务 | 5      | [项目图稿](references/projects-gemini.jpg) · [例行任务图稿](references/routines-attention-gemini.jpg) · [实现](references/organization-review.md)       |
| 待处理事项               | 1      | [实际图稿](references/routines-attention-gemini.jpg) · [验证](references/attention-review.md)                                                           |
| 对话、授权与交付引用     | 3      | [对话图稿](references/conversation-gemini.jpg) · [更正后的授权图](references/permission-gemini.jpg) · [实现](references/conversation-implementation.md) |
| 手机导航                 | 1      | [实际图稿](references/mobile-gemini.jpg) · [响应式验证](references/mobile-review.md)                                                                    |

## 改了什么

首页以真实委托入口为主，展示进展、待处理事项和已验收交付，技术配置退到次级位置。共享设计采用Manrope、暖近白与柔和海蓝，保留原版Orca。Base UI弹窗与选择器参考coss组合方式，配置逐步展开，取消和主动作明确，手机触摸区域可用。7:3入口把粒子留在品牌区，支持暂停与减少动效。

任务采用聚焦的创建抽屉和可理解的活动记录；多阶段SOP中的审核通过不会冒充最终验收。对话结果在过程记录之前，授权保留原执行与范围，文件位置不会伪装成Web路由。引用仍是未经验证的位置元数据，不上传文件。手机抽屉保留焦点、背景隔离和可见的底部操作。

图稿虚构的人物、任务、部署地址、工作日日程、无限执行、替代标志和混淆权限/验收的操作均未采用。最初的额度限制和后续出图错误已通过实际下载解决；更正后的授权图与单独手机审阅均保留。

## 验证

`pnpm check`共172项：150项通过、22项平台跳过。`pnpm e2e`通过31组浏览器流程，夹具不调用付费模型。覆盖实际界面受理、原始标识、证据/审核边界、较早任务分页、取消/焦点、会话偏好、深浅模式、320px布局、短屏导航、授权允许/拒绝/回答/取消、复制降级与隐藏字段校验。每个实现分组及review提出的修正都经过标准与规格两条独立审阅。

另有真实任务经过运行中的Orcabot worker与OctoRuntime：首次尝试等待授权过期，第二次在逐次授权后完成。通过UI验证了执行完成不自动验收、提交证据进入审核、操作者单独决定验收；刷新后保留两次尝试、证据与决定。附加的文件引用仍标记为未经验证。确认处理被替代的首次尝试后，警报清除，但失败历史和业务已验收状态保持不变。

俄罗斯方块只是验证Orcabot整体流程的场景，不宣称做了完整游戏质量验收。夹具与真实模型材料分开记录，授权整改截图来自隔离夹具。

Taste营销页gate仍有12项未通过，不宣称Taste PASS；每项及适用性说明见[检查报告](references/taste-check.md)。常规应用测试和截图覆盖单独记录。

追踪材料只含本任务创建的示例数据，凭据与原始系统截图不提交。部分较晚的`before/`图片包含共享控件整改中间状态，不表示全部来自最早Git基线。

运行`pnpm ui:review`校验材料；`pnpm ui:review --require-complete`要求每个界面都有实际图稿、整改截图、检查和提交记录。
