# 基准台：Axon 的延迟、吞吐与内存

一句话结论：**每次调用的固定开销不在"算"上，而在"消息走几趟"上**——一次 JS→PY
往返要经过 2 次 IPC 冲洗、2 次 JSON 编解码、1 次线程跳。小调用靠并发能摊到
0.66 ms/次（1500 次/秒），单次串行延迟则被 IPC 的冲洗节奏决定（本机软件渲染下
~108 ms，真机上是零点几毫秒级）。大 payload 走文本 JSON，实测上限约
**50–100 MB/s**。CPU 密集的 Python 处理器受 GIL 限制，4 个并发只跑出约 1.9×。

## 怎么跑

```bash
# 需要给 Chromium 一个真 X 显示（offscreen 会把定时器节流到 ~1s，测出来全是假数据）
sudo apt-get install -y xvfb libxcb-cursor0 libxkbcommon-x11-0 libnss3 \
    libxcomposite1 libxdamage1 libxrandr2 libxtst6 libasound2 libegl1
Xvfb :99 -screen 0 1600x1000x24 &
DISPLAY=:99 QT_QPA_PLATFORM=xcb \
  python core-py/benchmarks/run_bench.py --json /tmp/bench.json
```

三个窗口（`bench` / `bench2` / `bench3`）共用 `web/index.html`：JS 侧驱动
Axon JS→PY 的串行/突发/载荷/getVar，Python 侧驱动 PY→JS 与跨窗口扇出，
另外测并发伸缩与常驻内存。结果同时打印并写进 `--json`。

## 结果（2026-11-25，本机容器：无 GPU、llvmpipe 软件渲染、Xvfb 1600×1000）

### 1. 单次往返延迟

| 路径 | 串行 p50 | 说明 |
| --- | --- | --- |
| JS → PY → JS（Axon，`def`） | **108.6 ms** | 稳定到 ±0.4 ms |
| JS → PY → JS（Axon，`async def`） | 108.6 ms | 与 `def` 一样，线程模型不是瓶颈 |
| 同环境 raw QWebChannel 回声 | 3 / 53 ms 交替 | 说明环境本身有 ~50 ms 的 IPC 冲洗节奏 |

结论：**这个绝对数字是环境的**（软件渲染 + 无 GPU），但它暴露了结构：
我们比裸通道多一趟，因为处理器在后台线程算完、结果要再经主线程发回去。

### 2. 并发摊薄（同时发 N 个，总量 / N）

| 批量 | 总耗时 | 摊薄 | 吞吐 |
| --- | --- | --- | --- |
| 50 | 207 ms | 4.14 ms | 241 次/秒 |
| 200 | 430 ms | 2.15 ms | 465 次/秒 |
| 800 | 527 ms | **0.66 ms** | **1517 次/秒** |

单次延迟高、但吞吐能上去——说明瓶颈是"每批的固定冲洗"，不是 CPU。

### 3. 载荷（每次并发 20 个）

| 大小 | 摊薄 | 吞吐 |
| --- | --- | --- |
| 1 KB | 10.4 ms | 0.1 MB/s |
| 64 KB | 20.7 ms | 3.0 MB/s |
| 512 KB | 24.2 ms | 20.7 MB/s |
| 1 MB | 20.3 ms | 49.2 MB/s |
| 4 MB | 40.6 ms | **98.7 MB/s** |

小 payload 全被固定开销吃掉；大 payload 才看到真实带宽 ≈ 100 MB/s（文本 JSON
两次编解码 + 两次拷贝的成绩）。想要更快只有绕开 JSON。

### 4. 反方向 PY → JS（Python 发起）

| 场景 | 数值 |
| --- | --- |
| 50 个并发 `call` | 0.03–0.08 ms/次（1.4–3.8 ms 总量） |
| 64 KB | 0.135 ms p50 |
| 1 MB | 1.92 ms p50 |
| `getVar` | ≈0.001 ms p50 |

Python 侧发起快得多：只有一趟消息，没有"等 JS 回来"的往返。

### 5. 跨窗口扇出

| 场景 | p50 |
| --- | --- |
| `AxonCross.broadcast`（2 窗口，带结果） | 2.2 ms |
| `AxonCross.call` A→B | 2.2 ms |
| `AxonEvent.dispatch_js_event_batch`（2 窗口，不等结果） | 0.06 ms |

扇出是 O(窗口数) 的消息，不是多播；不等结果的广播几乎是免费的。

### 6. 并发伸缩（三类处理器，各 4 个并发）

| 处理器 | 4 并发总耗时 | 相对串行 |
| --- | --- | --- |
| `def` 忙循环 200 ms（占 GIL） | 419 ms | 800 ms → **1.9×** |
| `def` + `time.sleep(300)`（让出 GIL） | 305 ms | ≈满并行 |
| `async def` + `asyncio.sleep(300)` | 308 ms | ≈满并行 |

线程池能让阻塞型处理器并行，但**纯 Python 计算只有约 2×**——GIL 摆在那里。

### 7. 启动与内存

| 指标 | 数值 |
| --- | --- |
| 建窗口 → 页面加载 → `AxonInit` 完成 | **137 ms** |
| 常驻内存（Python + Qt + 1 个窗口的全部 Chromium 进程） | **442 MB** |
| 每多一个窗口 | **+115 MB**（第二个窗口后 557 MB） |

每个 `AxonGUI` 是一个独立的 `QWebEngineView`，也就是一个独立 renderer 进程。

## 瓶颈在哪，受限于什么

1. **消息路径太长（主要瓶颈，小调用时压倒一切）**
   `JS 调用 → QWebChannel → 主线程 → controller 线程池 → 结果 → 主线程 → QWebChannel → JS`。
   两个方向各一次 JSON 序列化，主线程和后台线程之间还有一次排队。裸通道只要一趟。
   → 小调用多的场景，**批量接口**收益最大（现在 800 个并发已能到 1500 次/秒，
   合并成一次消息理论上还能再上一个量级）。
2. **传输是文本 JSON（大 payload 的天花板）**
   QWebChannel 只传 JSON 字符串：Python 侧 `json.dumps` + QVariant 转 QJsonValue
   再转字符串，JS 侧 `JSON.parse`。实测 ~100 MB/s。传 10 MB 以上或二进制
   （图片、TypedArray）就会明显卡。→ 需要共享内存 / base64 + 分块 / 走文件。
3. **Python 侧只有一层线程池（CPU 密集上不去）**
   `def` 处理器进 `ThreadPoolExecutor(max_workers=cpu+4)`，受 GIL 约束（4 并发 ≈2×）；
   `async def` 全在同一个 asyncio loop 里，单线程。CPU 重的活要么放子进程，要么
   别指望并行。阻塞型（IO、sleep、等锁）反而能靠线程池并行。
4. **窗口 = renderer 进程（内存与渲染）**
   每个窗口 +115 MB 常驻，Chromium 的合成/渲染都在各自进程里。多窗口场景内存是
   线性增长；同时渲染多个窗口时 CPU 也争抢（尤其无 GPU 环境）。
5. **扇出是逐窗口发消息**
   `broadcast` / `AxonCross` 每个目标窗口一条消息、一个往返；N 个窗口就是 N 份开销。
   不等结果的 `emit` 便宜得多（0.06 ms），因为它是 fire-and-forget。
6. **Store 的写是同步往返**
   每次 `set` 都要问 Python，再由 Python 推给其它窗口——写多读少的场景不划算
   （读是本地缓存，几乎零成本）。

## 还可以怎么优化（按性价比排序）

| 方向 | 做法 | 预期 |
| --- | --- | --- |
| 批量调用 | `AxonCall.batch([...])` 一次消息带 N 个调用 | 小调用吞吐 ×2~×10 |
| 大 payload | 超过阈值（如 256 KB）改传 base64 分块或写临时文件 + 传路径 | 突破 100 MB/s |
| 少一次跳 | 给"快而纯"的处理器一个 `inline=True`，直接在主线程算，省掉线程往返 | 单次延迟少一趟冲洗 |
| 多窗口 | 一个窗口 + 前端路由，或者把重渲染的窗口按需创建/销毁 | 内存线性项消失 |
| CPU 密集 | 子进程池（`ProcessPoolExecutor`）或 Qt 侧 `QtConcurrent` | 真并行 |
| 扇出 | 已有 `emit`/`dispatch_js_event_batch` 走 fire-and-forget；需要结果的场景才用 `broadcast` | 广播成本 ≈0 |

## 请求 / 回包合并（5.4.2）的效果

`AxonCall` 侧把同一轮事件循环里发出的调用攒成一条消息（请求合并），Python 侧把 worker 线程算完的结果攒到下一轮事件循环一次性回（回包合并）。**对外接口没有变化**：每个调用仍然各自返回自己的 Promise，超时与异常语义不变。

同一台机器、同一次会话里跑「一批 N 个调用同时发」（3 次取最小值）：

| 一批 N 个 | 改造前 总耗时 | 改造后 总耗时 | IPC 消息数 |
| --- | --- | --- | --- |
| 50 | 206.2 ms | 207.6 ms | 50 → 1 |
| 200 | 237.0 ms | 11.5 ms | 200 → 1 |
| 800 | 307.6 ms | 212.6 ms | 800 → 1 |
| 2000 | 481.0 ms | 235.9 ms | 2000 → 1 |

一次跑 9,150 个调用，Python 侧 `onCall` 被调用 **9,151 次 → 13 次**（99.86% 的消息没了）。

几点说明：

- 单次串行调用**没有变慢**（本机最小 8.2 ms，两版一致）。本机页面被 Chromium 的定时器节流，p50 会落在 205 ms 的窗口里，两版一样，所以数字看着大但同口径可比。
- N=50 时改造前后都是「一个节流窗口」，所以总耗时没区别；收益从 N=200 起明显。
- 绝对数字受这台机器（无 GPU、软件渲染）影响，别拿去和外面对比；要看的是同一会话里的「前 / 后」两列。
- 调研过但没用的方案（`QWebChannel.setBlockUpdates` / `propertyUpdateInterval`、VS Code 的 buffer 协议、Electron 的 sendSync）写在 `PERF-RESEARCH.md`。
