# 许可与依赖

[English](../en/licensing.md) · 简体中文

项目自有代码、文档和所有者提供的品牌资产采用 MIT。`orcabot-cross-service`、对应移植测试和 CLI 中的上游改编部分保留 Apache-2.0 与版权/变更记录，不能标为纯 MIT。

`pnpm licenses:report` 将安装依赖的清单更新到根目录 [第三方声明](../../THIRD_PARTY_NOTICES.md)。许可证和 NOTICE 正文保留在上游包中，不在仓库内另存生成目录。包含当前平台的开发与生产依赖；其他平台可选二进制应在打包平台再次生成清单。

依赖中有 MIT、Apache、ISC、BSD、BlueOak、Python、Unlicense、0BSD，以及 lightningcss 的 MPL-2.0 和 caniuse-lite 数据的 CC-BY-4.0。分发时保留原始声明；分发或修改 MPL 文件时按其协议处理对应源码与通知，CC-BY 数据保留署名和来源。构建工具并不因此变成项目自有代码。

自动安装的 OctoRuntime、各 harness、模型服务属于独立安装与服务条款范围，不在本 workspace 清单中。Electron/DMG 发布前还应对实际包含的依赖、源码和资产做分发清单核对。

品牌原图和浅深色透明衍生图保存在 `apps/web/public/brand`。MIT 资产许可不表示派生项目获得官方背书。

有一项已安装依赖 abstract-logging 2.0.1 声明 MIT 并提供作者许可链接，但发布包没有独立许可证文件。清单保留其来源并明确记录此缺项，不伪造上游版权声明。发布二进制前应继续核对。
