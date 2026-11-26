<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/orca-dark.png" />
    <img src="apps/web/public/brand/orca-light.png" width="112" alt="Orcabot 标志" />
  </picture>
</p>

<h1 align="center">Orcabot</h1>
<p align="center"><strong>让 AI 对话走向可验收的成果。</strong></p>
<p align="center">可自托管的 AI 工作台，连接任务、对话与例行工作。<br />保留目标，在合适的机器上执行，回来时直接检查成果。</p>

<p align="center">
  <a href="#体验-orcabot">体验 Orcabot</a> ·
  <a href="docs/zh-CN/README.md">阅读文档</a> ·
  <a href="https://github.com/orcabot-ai/orcabot/issues">反馈建议</a> ·
  <a href="README.md">English</a>
</p>
<p align="center">
  <a href="https://github.com/orcabot-ai/orcabot/actions/workflows/ci.yml"><img src="https://github.com/orcabot-ai/orcabot/actions/workflows/ci.yml/badge.svg" alt="构建与 E2E 状态" /></a>
  · 早期预览 · 自托管 · <a href="LICENSE">MIT</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/readme-work-dark.png" />
  <img src="docs/screenshots/readme-work-light.png" alt="Orcabot 任务审核页面，包含目标、验收标准、执行状态和已提交的交付证据" width="1440" />
</picture>

_实际 Orcabot 界面，使用隔离测试夹具中的示例数据，未调用付费模型。界面默认英文，可切换简体中文。_

## 少一点反复盯进度，多一点可检查的成果

面向在本地和远端机器上运行 AI 任务的开发者与操作者，Orcabot 将对话、任务与结果放在一起。回来时能继续原来的讨论、了解发生了什么，再决定下一步需要关注什么。

| 你想做什么           | Orcabot 如何帮你                                                                  |
| -------------------- | --------------------------------------------------------------------------------- |
| 随时接着上次的工作   | 项目下的持久 Thread 保留对话和执行历史，支持改名、整理、归档。                    |
| 看清哪些工作可以验收 | 任务看板将目标、验收标准、交付证据和审核决定放在一起。                            |
| 重复执行有用的工作   | Routine 按固定间隔执行指令，结果返回同一个 Thread，并提供执行预算和连续失败暂停。 |
| 跨机器开展工作       | 连接本地或远端执行节点，在需要的机器上启动 worker，通过浏览器访问。               |
| 接入自己的工具       | CLI 和 SDK 提供无界面命令，与 Web 界面共用任务能力。                              |

支持英文与简体中文、浅色／深色／系统主题。响应式 Web 界面基于 React、Tailwind CSS 和 TanStack。

## 从目标到验收，三步形成闭环

1. **明确目标。** 创建任务，写好验收标准，选择已配置执行机器的 Agent。
2. **执行工作。** 在对话中跟进实时进展、回应输入请求，保留原始执行历史。
3. **检查成果。** 提交交付证据，对照标准检查，再决定通过或返工。

执行完成与业务验收各有含义。即使运行成功，任务仍需提交证据并经过审核，才能被标记为已验收。

## 把重复工作交给 Routine

给已有 Thread 绑定一条持续指令，设置执行间隔和次数预算，结果就会回到原对话。支持在 UI 或 CLI 中暂停、恢复、立即执行。错过的执行窗口会跳过；连续三次确认失败会自动暂停，执行结果未知时立即暂停并等待排查。

<details>
<summary>查看例行任务编辑器</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/routine-dark.png" />
  <img src="docs/screenshots/routine-light.png" alt="例行任务编辑器，可选择 Thread、填写指令、设置间隔和执行预算" width="1200" loading="lazy" />
</picture>

[项目、Thread 与 Routine 的行为约定](docs/zh-CN/threads-and-routines.md)

</details>

## 体验 Orcabot

当前预览版从源码启动。需要 **Node.js 24 或 26**、**pnpm 11.25.0**，以及所选执行框架的供应商凭证。首次本地启动需要联网、npm 和支持的当前用户服务管理器。

**1. 构建并启动 worker。**

```sh
git clone https://github.com/orcabot-ai/orcabot.git
cd orcabot
pnpm install --frozen-lockfile
pnpm build
pnpm start worker run
```

**2. 在另一个终端启动 Web 客户端。**

```sh
pnpm start web run
```

**3. 打开 [localhost:4320](http://127.0.0.1:4320)**，输入 worker 输出的 Service Key。配置执行节点和 Agent，在执行机器上准备工作目录，然后创建第一个对话或任务。

Orcabot 自动通过 OctoRuntime 准备本地执行环境。供应商登录仍需完成，模型费用取决于你的供应商账户。请保密 Service Key 和 worker stdout；设置 `ORCABOT_TOKEN` 可在重启后保持密钥。API 默认监听 `127.0.0.1:4310`。

<details>
<summary>连接远端 worker，或使用无界面命令</summary>

```sh
# 只管理远端执行节点的中控：
pnpm start worker run --execution remote

# 连接另一台机器上的 worker：
pnpm start web run --worker-url https://worker.example.com

# 浏览命令并查看任务：
pnpm start --help
pnpm start version
pnpm board list --json
pnpm start routine list --json
```

安装／链接后的 CLI 使用 `orcabot` 代替 `pnpm start`。无界面命令通过 `ORCABOT_URL` 和 `ORCABOT_TOKEN` 访问服务。`.env.example` 仅供参考，不会自动加载。

[CLI、配置与部署](docs/zh-CN/cli-and-deployment.md)

</details>

## 已经能做什么，接下来做什么

**已交付：** 持久对话和项目 Thread，实时执行、输入请求与取消，任务交付和人工审核，有次数预算的间隔 Routine，本地／远端执行，Web／CLI／SDK，以及 SQLite 持久化和保留原执行身份的恢复。

**规划中：** 感知连接器、自动协调、更广泛的流程自定义、Git worktree、cron／时区调度、A2UI，以及 Electron／DMG。以上均尚未交付，详见 [产品方向](docs/zh-CN/product-direction.md) 和 [当前实现边界](docs/zh-CN/threads-and-routines.md)。

当前为早期预览版，共享密钥／会话代表同一个可信操作者，尚无独立用户、Agent 权限或独立审核者保证。远程接入使用可信网络或 HTTPS；SQLite 中包含私密对话与配置凭证。见 [安全说明](SECURITY.md) 和 [验证边界](docs/zh-CN/validation.md)。

## 一起把它做好

用一个真实任务试试，告诉我们哪里不顺手。[报告问题或建议功能](https://github.com/orcabot-ai/orcabot/issues)。贡献代码请先阅读 [贡献指南](CONTRIBUTING.zh-CN.md)。

```sh
pnpm dev
pnpm check
pnpm format:check
pnpm e2e
# 依赖变化后：
pnpm licenses:report
```

Vite 开发使用 5173 端口，需要设置 `ORCABOT_PUBLIC_URL=http://127.0.0.1:5173`；`ORCABOT_EXECUTION=remote` 可跳过本地执行准备。pnpm workspace 的分工见 [架构](docs/zh-CN/architecture.md)，生产配置见 [部署说明](docs/zh-CN/cli-and-deployment.md)。

## 协议

Orcabot 自有代码、文档和提供的项目品牌资产采用 [MIT](LICENSE)。移植的 OctoRuntime 部分保留 Apache-2.0；第三方依赖保留各自协议。详见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [中文许可说明](docs/zh-CN/licensing.md)。
