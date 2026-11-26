# 前端与品牌

[English](../en/frontend.md) · 简体中文

## 技术与数据

React + Tailwind；TanStack Start、Router、Query、Form、Table、Virtual。路由表达工作对象，Query 管理服务端状态，Form 处理输入，Virtual 限制长历史的 DOM 大小。API 状态由 worker 决定，前端不推断业务成功。

## 深浅主题

虎鲸标志来自项目所有者。深海蓝表达稳定与结构，亮蓝表示动作、选中与焦点。浅色用冷白底和白色面板，深色用海军蓝面板与浅色标志，警告和失败保持独立语义色。系统模式和用户选择都可用。

## 弹窗与动态

统一标题、细边框、表单间距、分组和主要操作；小屏单列，内容可滚动，键盘可退出和循环聚焦。动效以约 160–200ms 的淡入和短距离位移为主，尊重 reduced-motion。React Bits 的 Animated Content、Fade Content、Spotlight Card 是效果参考，本次未复制其源码或引入其运行依赖。

## 语言与构建

默认英文；中文保存在当前标签页 sessionStorage，刷新保留。主题独立保存。生产构建生成 SPA shell 和静态资产，Web host 根据准确内联脚本计算 CSP 哈希；不使用任意 inline script 放行。
