<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/orca-dark.png" /><img src="apps/web/public/brand/orca-light.png" width="150" alt="Orcabot" /></picture></p>

# Orcabot

**面向跨机器、跨云任务交付的助手工作台。**

[English](README.md) · 简体中文 · [中文文档](docs/zh-CN/README.md)

围绕一个目标，把讨论、执行、成果和验收放到同一个工作区。用户关注要完成的事情；多 Agent 协作属于底层能力。

## 当前能力

- 持久化对话、实时事件、人工交互、取消和原执行恢复。
- 通过 OctoRuntime 使用本地或远程执行节点，本地依赖自动准备。
- 任务看板、版本化流程、独占认领、成果证据、人工通过或返工。
- 项目下的持久工作线程，支持改名、归档与工作目录边界。
- 有限预算的例行任务，结果返回原工作线程。
- 独立 worker 与 Web 客户端，命令行和 SDK 支持无界面接入。
- 默认英文，支持简体中文、浅色/深色/系统主题和响应式布局。
- SQLite 保存事实；执行结果未知时不会盲目重新提交。

感知连接器、自动协调、A2UI、Electron/DMG 是后续方向，尚未交付。见 [产品方向](docs/zh-CN/product-direction.md)。

## 快速启动

需要 **Node.js 24/26**、**pnpm 11.25.0**，以及所选执行框架的供应商凭证。首次本地启动需要联网、npm 和可用的当前用户服务管理器。

```sh
git clone https://github.com/orcabot-ai/orcabot.git
cd orcabot
pnpm install --frozen-lockfile
pnpm build
pnpm start worker run
```

另一个终端：

```sh
pnpm start web run
```

打开 **http://127.0.0.1:4320**，输入 worker 输出的 Service Key。API 在 **4310**。密钥和 stdout 应保密；设置 `ORCABOT_TOKEN` 可在重启后保持密钥。执行依赖自动安装和启动，供应商登录仍需准备。

只管理远端节点时使用 `pnpm start worker run --execution remote`；页面可用 `--worker-url https://worker.example.com` 连接远端 worker。配置执行节点和 Agent 后，可开始对话或在 `/work` 创建业务任务。工作目录属于执行机器，应预先创建。

## CLI 与开发

```sh
pnpm start --help
pnpm start version
pnpm start doctor
pnpm board list --json
pnpm board create --input work.json --json
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm licenses:report
```

链接后的 CLI 使用 `orcabot` 代替 `pnpm start`。`.env.example` 是配置参考，不会自动加载。Vite 开发使用 5173 端口，并设置 `ORCABOT_PUBLIC_URL=http://127.0.0.1:5173`；`ORCABOT_EXECUTION=remote` 可跳过本地执行准备。生产使用独立的 worker 与 web 命令。

项目采用 pnpm workspace：`apps/cli` 负责命令与依赖准备，`apps/worker` 负责 API/SQLite，`apps/web` 是 React/Tailwind/TanStack，`orcabot-web-server` 提供页面和同源代理，其他 `orcabot-*` 包负责协议、存储、流程与 SDK。

## 状态与参与

目前为早期 OSS 项目。共享密钥代表同一个可信操作者，尚无独立用户、Agent 权限或独立审核者保证。远程接入应使用可信网络或 HTTPS；SQLite 中有私密历史与配置凭证。

[项目与例行任务](docs/zh-CN/threads-and-routines.md) · [架构](docs/zh-CN/architecture.md) · [P1 交付](docs/zh-CN/p1-delivery.md) · [验证边界](docs/zh-CN/validation.md) · [贡献指南](CONTRIBUTING.zh-CN.md) · [安全报告](SECURITY.md)

## 协议

Orcabot 自有代码、文档和提供的项目品牌资产采用 [MIT](LICENSE)。移植的 OctoRuntime 部分保留 Apache-2.0；第三方依赖不被重新许可。见 [第三方声明](THIRD_PARTY_NOTICES.md)、[依赖清单](licenses/dependencies.json) 和 [中文许可说明](docs/zh-CN/licensing.md)。
