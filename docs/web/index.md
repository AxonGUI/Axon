---
layout: home

hero:
  name: Axon
  text: Python 后端 + Web 界面
  tagline: 用 Qt WebEngine 装一个真正的桌面窗口，界面写 Vue，逻辑留在 Python。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quickstart
    - theme: alt
      text: 看可交互示例
      link: /examples/call

features:
  - title: 双向调用，一个语法糖
    details: JS 里 await Axon.Ctl.method(args, kwargs, timeout)；Python 里 Axon(web).JS.method(args).result()。两边同构，方法、属性、异常都能往返。
  - title: 双模式文档
    details: 同一份页面，没有 Python 后台时是纯说明书；被 AxonGUI 打开后自动变成可点的交互示例，演示真实的消息传递。
  - title: 事件与 Store
    details: 两端各有一个 EventTarget 风格的事件总线，外加跨端同步的 key-value Store，拖拽、右键菜单、加载完成等 Qt 事件也走同一条通道。
  - title: 主线程安全
    details: Python 方法默认在线程池里跑，async 方法在独立事件循环里跑；需要碰 Qt 控件时用 AxonMagicGUI.run() 回到主线程。
---

## 这一页在两种模式下长什么样

顶部的状态条会告诉你当前页面连没连上 Python 后端。下面这个卡片就是「交互模式」的核心体验 ——
点一下按钮，页面会真的调用 Python 方法，并把两端传递的报文、耗时、结果逐条列出来：

<LiveDemo id="call" />

没有后端时它会显示为不可点：这正是设计目标，说明文档能脱离桌面程序单独部署（比如放到静态站点上，
当纯说明书看）。

## 目录

- [快速开始](/guide/quickstart)：装依赖、跑模板、把文档站当桌面程序打开。
- [架构与消息流](/guide/architecture)：两条反向通道、线程模型、call_id 配对。
- [双模式](/guide/dual-mode)：`AxonInit()` 的状态返回值与页面降级策略。
- [可交互示例](/examples/call)：调用、属性、事件、Store、主线程任务、广播。
- [API](/api/javascript)：JavaScript 端与 Python 端的完整签名。
- [接口验证记录](/notes/verified)：本手册里每个接口都在真实 QWebEngine 里跑过，记录在此。
