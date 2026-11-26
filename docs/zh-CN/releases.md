# 版本与发布

[English](../en/releases.md) · 简体中文

Orcabot 参考 OctoRuntime：源码包版本保持 `0.0.0`，用 annotated `vX.Y.Z`
标签确定不可变的稳定发行版本。私有 workspace 包组装成一个独立发行包。
CLI 始终显示版本、源码 commit 和 UTC 构建时间。

`release.config.json` 定义 npm 包名，目前暂定 `@orcabot-ai/orcabot`，首次发布前
需要确认 npm scope 所有权。GitHub 仓库保持私有。
[npm 不支持私有仓库生成 provenance](https://docs.npmjs.com/trusted-publishers/)，
流程只在源码仓库公开时启用该功能。

## 验证源码与安装包

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm format:check
pnpm e2e
pnpm pack:release --version 0.0.0
pnpm verify:release dist/release/orcabot-ai-orcabot-0.0.0.tgz
```

占位版本只用于验收，不能通过正式发布检查。`prepack` 禁止直接发布 workspace 根目录。
发行包包含生产依赖、编译后的 CLI/worker、Web 资源、MIT 协议、Apache 改编声明、
第三方声明及 Manrope OFL 协议，不携带 workspace 链接、本地数据库、密钥或开发工具配置。

验收在空 npm 缓存中离线安装，然后在临时 loopback 端口启动独立 worker 和 Web，
检查 SQLite 状态、认证及 HTML 页面。worker 使用 remote 模式，不安装 Runtime、
不改变现有服务，不调用模型。这覆盖 Linux CI 和本地 macOS，不代表 Windows 发行认证。

## 发布稳定版本

1. 确认包名、npm 所有权和版本号，在仓库 Actions secrets 配置最小权限的 `NPM_TOKEN`，
   不要把 token 写进源码或 issue。
2. 等待目标 main commit 的 **CI Gate** 通过。
3. 创建并推送 annotated 标签，例如：

   ```sh
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```

Release Publish 验证稳定 SemVer、annotated tag 和 main 祖先关系，针对准确 commit
重新运行 Node 24/26 CI。构建时间使用 commit 的 UTC 时间，重试时保留相同来源信息。
只有 Node 24 验收过的同一份包会上传 npm 并附加到 GitHub Release。

发布前检查 npm 已有版本的 SHA-512。相同包允许恢复，不同内容禁止覆盖；GitHub
资源也执行同样检查。先使用版本专属 npm dist-tag，再更新 `latest`，旧版本不能回退
`latest`。发布流程串行运行，npm 确认成功后才创建 GitHub Release。

## Dry-run 与恢复

进入 **Actions → Release Publish → Run workflow**，输入已有 annotated tag 并选择
`dry-run`。流程验证并打包，不上传 npm、不改变 dist-tag，也不发布 GitHub Release。
需要干净的标签提交。选择 `recover` 可用同一标签继续部分完成的发布；不要移动或覆盖
标签。认证和 registry 错误会明确失败。

首次配置发布流程的过程中没有正式发布任何版本或 npm 包。

发行构建会把 TanStack 根节点 hydration 缓存时间固定为构建时间。CI 再次编译
Web/CLI 并打包，逐字节比较两份包；序列化格式变化或包内容不一致都会阻止发布。
