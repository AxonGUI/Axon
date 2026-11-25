/* 在页面里跑：所有耗时都用 performance.now() 计，单位 ms。
   因为 QWebChannel 在本机（软件渲染）有一个 ~50ms 的批量冲洗节奏，
   单次串行往返会被这个节奏放大，所以主要用「并发一批、算摊薄」的口径。 */
(async () => {
  const lib = window.axon;
  const out = document.getElementById("out");
  const results = {};
  const step = (x) => { window.__benchStep = x; };
  const pct = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const stat = (arr) => ({
    n: arr.length,
    p50: +pct(arr, 0.5).toFixed(2), p95: +pct(arr, 0.95).toFixed(2),
    mean: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2),
    min: +Math.min(...arr).toFixed(2), max: +Math.max(...arr).toFixed(2),
  });
  window.__ready = true;
  const payload = (n) => "x".repeat(n);
  // 给 Python 侧调回来用（PY→JS）
  lib.AxonController.register("Echo", { echo: (v) => v, value: 7 });
  try {
    const status = await lib.AxonInit();
    if (!status.ready) { window.__bench = { error: status.reason || "not-ready" }; return; }
    const call = lib.Axon.Bench;

    // 串行往返
    step("seq");
    for (let i = 0; i < 20; i++) await call.echo(1);
    const seq = [];
    for (let i = 0; i < 60; i++) { const s = performance.now(); await call.echo(1); seq.push(performance.now() - s); }
    results["seq-1B"] = stat(seq);

    // 并发吞吐：一批 N 个同时发，摊薄到每次
    step("burst");
    for (const n of [50, 200, 800]) {
      const t0 = performance.now();
      await Promise.all(Array.from({ length: n }, (_, i) => call.echo(i)));
      const total = performance.now() - t0;
      results[`burst-${n}`] = { total: +total.toFixed(1), perCall: +(total / n).toFixed(3), perSec: +(n / (total / 1000)).toFixed(0) };
    }

    // 载荷：每种大小并发 20 个，摊薄
    step("payload");
    for (const size of [1024, 64 * 1024, 512 * 1024, 1024 * 1024, 4 * 1024 * 1024]) {
      const s = payload(size);
      const t0 = performance.now();
      await Promise.all(Array.from({ length: 20 }, () => call.echo(s)));
      const total = performance.now() - t0;
      const mb = (size * 20) / (1024 * 1024);
      results[`payload-${size >= 1024 * 1024 ? size / 1024 / 1024 + "MB" : size / 1024 + "KB"}`] = {
        perCallMs: +(total / 20).toFixed(2),
        throughputMBps: +(mb / (total / 1000)).toFixed(1),
      };
    }

    // 属性读 / 无返回值
    step("getvar");
    {
      const t0 = performance.now();
      await Promise.all(Array.from({ length: 100 }, () => lib.Axon.Bench.counter));
      results["getVar-burst100"] = { total: +(performance.now() - t0).toFixed(1) };
    }

    step("done");
    window.__bench = results;
    out.textContent = JSON.stringify(results, null, 2);
  } catch (err) {
    window.__bench = { error: String((err && err.stack) || err) };
    out.textContent = window.__bench.error;
  }
})();
