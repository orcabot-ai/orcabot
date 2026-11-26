# Orcabot UI 审阅 — 11 月 26 日

[English](README.md) · 简体中文

流程为：真实页面截图 → 上传 Gemini → 点评与实际生成的效果图 → 按图实现 → 验证产品行为 → 英文提交。

见[覆盖清单](manifest.json)、[配置图稿说明](references/setup-review.md)、[工作台审阅](references/workspace-review.md)及[原始生成图](references/setup-dialogs-gemini.jpg)。

## 已完成范围

Agent、本机连接、远端连接三个配置变体按照第一张生成图整改。共享弹窗与选择器采用 Base UI，参考 [coss ui](https://coss.com/ui/docs)，并自托管 Manrope。远端必填密钥保持可见且默认掩码，本地连接地址和 MCP 逐步展开。没有实现图稿虚构的 Browse 按钮，也没有替换原版鲸鱼标志；移动端控件保留 44px 触摸区域。

`pnpm check` 通过：170 项测试中 148 项通过、22 项因平台跳过。`pnpm e2e` 的 16 组浏览器流程检查通过，使用隔离的确定性执行夹具。新增覆盖助手配置保存、嵌套菜单 Escape、密钥显隐重置、取消不产生连接、手机助手选择器实际高度。

## 真实执行流程

另有真实任务通过正在运行的 Orcabot worker 与 OctoRuntime 执行。第一次尝试等待授权过期，记录保留；第二次在逐次授权后完成。通过 UI 验证：

1. 执行完成不会自动验收业务任务。
2. 提交证据使任务进入审核。
3. 单独记录操作者决策后，任务进入 accepted。
4. 刷新后保留证据、决策与两次执行尝试。
5. 原始执行保存了包含本地计算摘要的文件引用，页面仍如实标记引用未经自动验证。

俄罗斯方块仅作为验证 Orcabot 整体流程的场景，不宣称进行了完整游戏质量验收。隔离夹具与真实模型执行分别记录。

共享控件提交为 `3c35137`，GitHub Node 24/26 CI 均通过。Gemini 随后完成了[剩余五个页面与整改结果复核](references/details-review.md)。

## 个人首页与入口

图片额度已恢复，[实际生成的首页/Landing 对照图](references/personal-home-landing-gemini.jpg)已用于实现个人首页和7:3虎鲸粒子入口。[实现取舍](references/personal-home-review.md)记录了摘要范围、普通对话完成与业务验收的区别。`after/`保留深浅色与手机截图。

`pnpm check`共172项测试，150项通过、22项平台跳过。首页新增验证覆盖委托后找回原对话、较早任务分页、错误密钥重试和保留原任务链接；共享控件与工作流用例仍在。有界活动接口另外验证了授权、隐私与结果范围。

## 任务与工作整理

任务列表、交付/活动详情与创建抽屉已按照[实际任务图稿](references/tasks-gemini.jpg)实现，[实现说明](references/task-review.md)记录边界修复。[项目](references/projects-gemini.jpg)和[例行任务](references/routines-attention-gemini.jpg)图稿也已用于项目、线程管理和例行任务界面；[实现取舍](references/organization-review.md)明确了没有采用的图稿虚构能力。

工作整理阶段通过25组浏览器流程检查，新增待处理事项回归后当前为26组。项目、线程编辑、例行任务的取消不会保存草稿；例行执行仍回到原线程，并保留间隔和次数上限。

## 剩余工作

待处理事项已按实际图稿实现，每次执行只显示一条摘要，处理确认单独留痕，见[验证记录](references/attention-review.md)。对话、执行授权、交付引用与手机导航已有文字审阅，新对照图正在请求中，没有标为完成。每个列出的核心页面都完成按图整改与验证后，整个流程才算完成。

追踪截图只包含任务创建的示例数据；原始系统窗口截图与凭据不提交。部分较晚的 `before/` 截图已包含共享控件整改的中间状态，它们是页面审阅输入，不表示全部来自最早 Git 基线。

运行 `pnpm ui:review` 校验材料并报告进度；`pnpm ui:review --require-complete` 要求所有页面都有实际图稿、整改后截图、验证和提交记录，否则返回失败。待完成页面不会被算作完成。
