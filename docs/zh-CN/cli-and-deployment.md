# 命令行与部署

[English](../en/cli-and-deployment.md) · 简体中文

## 日常启动

需要 Node.js 24/26 和 pnpm 11.25.0。在项目目录执行：

```sh
pnpm install
pnpm build
pnpm start worker run
# 另一终端
pnpm start web run
```

worker 默认监听 `127.0.0.1:4310`，Web 默认 `127.0.0.1:4320`。在页面输入 worker 输出的密钥。stdout 包含执行权限凭证，应保密；设置 `ORCABOT_TOKEN` 可保持密钥稳定。

## 自动执行依赖

默认 local 模式发现已安装环境，否则安装固定的 OctoRuntime 1.1.15，再调用其原生启动入口，通过公开 SDK 检查 execution_ready 后打开 SQLite。不会自动升级到 latest。退出 worker 不会停止共享执行服务；供应商登录仍需单独完成。

```sh
orcabot worker run --execution remote
orcabot web run --worker-url https://worker.example.com
orcabot version
orcabot doctor
orcabot board list --json
```

remote 跳过本地安装。高级 attach 模式只连接已有 IPC；`runtime` 隐藏子命令用于安装、启停、日志、适配器和诊断，普通启动不需要它。

## 配置

`ORCABOT_DATA_DIR` 默认 `.orcabot`；`ORCABOT_HOST/PORT` 控制 API；`ORCABOT_WEB_HOST/PORT` 控制页面；`ORCABOT_WORKER_URL` 指定上游；`ORCABOT_PUBLIC_URL` 和 `ORCABOT_WEB_PUBLIC_URL` 是反向代理后的规范来源。环境文件不会自动加载。地址只接受不含凭证、路径、query 或 fragment 的 HTTP(S) origin。

高级变量为 `ORCABOT_RUNTIME_HOME`、`ORCABOT_RUNTIME_INSTALL_DIR`、`ORCABOT_RUNTIME_CLI`、`ORCABOT_RUNTIME_ENDPOINT`。安装锁残留时，先确认无安装进程再清理，不可同时修改同一前缀。

## 输出与代理

`--json` 将成功和 `{error:{code,message,...}}` 写入 stdout；文本诊断走 stderr。参数错误退出 2、依赖缺失 3、不可用 4、其他错误 1；高级委托命令保持上游退出码。version 包含版本、commit、dirty 和 UTC 构建时间，`ORCABOT_BUILD_TIME` 可固定构建时间。

Web host 不保存密钥或数据库，不重试写入、不跟随重定向。检查浏览器来源后代理 `/api`，转发授权与签名会话，保持 SSE 流式输出。跨机器应使用 HTTPS。Electron 可以复用该 host；目前没有生成 DMG。
