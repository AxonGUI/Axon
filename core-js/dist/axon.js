function Z(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function F(e, t) {
  for (const r in t)
    Object.defineProperty(e, r, {
      value: t[r],
      enumerable: !0,
      configurable: !0
    });
  return e;
}
function ee(e, t, r) {
  if (!e || typeof e == "string")
    throw new TypeError("Please pass an Error to err-code");
  r || (r = {}), typeof t == "object" && (r = t, t = void 0), t != null && (r.code = t);
  try {
    return F(e, r);
  } catch {
    r.message = e.message, r.stack = e.stack;
    const i = function() {
    };
    return i.prototype = Object.create(Object.getPrototypeOf(e)), F(new i(), r);
  }
}
var te = ee, G = {};
function b(e, t) {
  typeof t == "boolean" && (t = { forever: t }), this._originalTimeouts = JSON.parse(JSON.stringify(e)), this._timeouts = e, this._options = t || {}, this._maxRetryTime = t && t.maxRetryTime || 1 / 0, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
}
var re = b;
b.prototype.reset = function() {
  this._attempts = 1, this._timeouts = this._originalTimeouts;
};
b.prototype.stop = function() {
  this._timeout && clearTimeout(this._timeout), this._timeouts = [], this._cachedTimeouts = null;
};
b.prototype.retry = function(e) {
  if (this._timeout && clearTimeout(this._timeout), !e)
    return !1;
  var t = (/* @__PURE__ */ new Date()).getTime();
  if (e && t - this._operationStart >= this._maxRetryTime)
    return this._errors.unshift(new Error("RetryOperation timeout occurred")), !1;
  this._errors.push(e);
  var r = this._timeouts.shift();
  if (r === void 0)
    if (this._cachedTimeouts)
      this._errors.splice(this._errors.length - 1, this._errors.length), this._timeouts = this._cachedTimeouts.slice(0), r = this._timeouts.shift();
    else
      return !1;
  var n = this, i = setTimeout(function() {
    n._attempts++, n._operationTimeoutCb && (n._timeout = setTimeout(function() {
      n._operationTimeoutCb(n._attempts);
    }, n._operationTimeout), n._options.unref && n._timeout.unref()), n._fn(n._attempts);
  }, r);
  return this._options.unref && i.unref(), !0;
};
b.prototype.attempt = function(e, t) {
  this._fn = e, t && (t.timeout && (this._operationTimeout = t.timeout), t.cb && (this._operationTimeoutCb = t.cb));
  var r = this;
  this._operationTimeoutCb && (this._timeout = setTimeout(function() {
    r._operationTimeoutCb();
  }, r._operationTimeout)), this._operationStart = (/* @__PURE__ */ new Date()).getTime(), this._fn(this._attempts);
};
b.prototype.try = function(e) {
  console.log("Using RetryOperation.try() is deprecated"), this.attempt(e);
};
b.prototype.start = function(e) {
  console.log("Using RetryOperation.start() is deprecated"), this.attempt(e);
};
b.prototype.start = b.prototype.try;
b.prototype.errors = function() {
  return this._errors;
};
b.prototype.attempts = function() {
  return this._attempts;
};
b.prototype.mainError = function() {
  if (this._errors.length === 0)
    return null;
  for (var e = {}, t = null, r = 0, n = 0; n < this._errors.length; n++) {
    var i = this._errors[n], c = i.message, s = (e[c] || 0) + 1;
    e[c] = s, s >= r && (t = i, r = s);
  }
  return t;
};
(function(e) {
  var t = re;
  e.operation = function(r) {
    var n = e.timeouts(r);
    return new t(n, {
      forever: r && r.forever,
      unref: r && r.unref,
      maxRetryTime: r && r.maxRetryTime
    });
  }, e.timeouts = function(r) {
    if (r instanceof Array)
      return [].concat(r);
    var n = {
      retries: 10,
      factor: 2,
      minTimeout: 1 * 1e3,
      maxTimeout: 1 / 0,
      randomize: !1
    };
    for (var i in r)
      n[i] = r[i];
    if (n.minTimeout > n.maxTimeout)
      throw new Error("minTimeout is greater than maxTimeout");
    for (var c = [], s = 0; s < n.retries; s++)
      c.push(this.createTimeout(s, n));
    return r && r.forever && !c.length && c.push(this.createTimeout(s, n)), c.sort(function(o, a) {
      return o - a;
    }), c;
  }, e.createTimeout = function(r, n) {
    var i = n.randomize ? Math.random() + 1 : 1, c = Math.round(i * n.minTimeout * Math.pow(n.factor, r));
    return c = Math.min(c, n.maxTimeout), c;
  }, e.wrap = function(r, n, i) {
    if (n instanceof Array && (i = n, n = null), !i) {
      i = [];
      for (var c in r)
        typeof r[c] == "function" && i.push(c);
    }
    for (var s = 0; s < i.length; s++) {
      var o = i[s], a = r[o];
      r[o] = function(C) {
        var v = e.operation(n), u = Array.prototype.slice.call(arguments, 1), _ = u.pop();
        u.push(function(f) {
          v.retry(f) || (f && (arguments[0] = v.mainError()), _.apply(this, arguments));
        }), v.attempt(function() {
          C.apply(r, u);
        });
      }.bind(r, a), r[o].options = n;
    }
  };
})(G);
var ne = G, oe = te, ie = ne, se = Object.prototype.hasOwnProperty;
function z(e) {
  return e && e.code === "EPROMISERETRY" && se.call(e, "retried");
}
function ce(e, t) {
  var r, n;
  return typeof e == "object" && typeof t == "function" && (r = t, t = e, e = r), n = ie.operation(t), new Promise(function(i, c) {
    n.attempt(function(s) {
      Promise.resolve().then(function() {
        return e(function(o) {
          throw z(o) && (o = o.retried), oe(new Error("Retrying"), "EPROMISERETRY", { retried: o });
        }, s);
      }).then(i, function(o) {
        z(o) && (o = o.retried, n.retry(o || new Error())) || c(o);
      });
    });
  });
}
var ae = ce;
const ue = /* @__PURE__ */ Z(ae);
var K = { exports: {} };
(function(e) {
  var t = {
    signal: 1,
    propertyUpdate: 2,
    init: 3,
    idle: 4,
    debug: 5,
    invokeMethod: 6,
    connectToSignal: 7,
    disconnectFromSignal: 8,
    setProperty: 9,
    response: 10
  }, r = function(i, c) {
    if (typeof i != "object" || typeof i.send != "function") {
      console.error("The QWebChannel expects a transport object with a send function and onmessage callback property. Given is: transport: " + typeof i + ", transport.send: " + typeof i.send);
      return;
    }
    var s = this;
    this.transport = i, this.send = function(o) {
      typeof o != "string" && (o = JSON.stringify(o)), s.transport.send(o);
    }, this.transport.onmessage = function(o) {
      var a = o.data;
      switch (typeof a == "string" && (a = JSON.parse(a)), a.type) {
        case t.signal:
          s.handleSignal(a);
          break;
        case t.response:
          s.handleResponse(a);
          break;
        case t.propertyUpdate:
          s.handlePropertyUpdate(a);
          break;
        default:
          console.error("invalid message received:", o.data);
          break;
      }
    }, this.execCallbacks = {}, this.execId = 0, this.exec = function(o, a) {
      if (!a) {
        s.send(o);
        return;
      }
      if (s.execId === Number.MAX_VALUE && (s.execId = Number.MIN_VALUE), o.hasOwnProperty("id")) {
        console.error("Cannot exec message with property id: " + JSON.stringify(o));
        return;
      }
      o.id = s.execId++, s.execCallbacks[o.id] = a, s.send(o);
    }, this.objects = {}, this.handleSignal = function(o) {
      var a = s.objects[o.object];
      a ? a.signalEmitted(o.signal, o.args) : console.warn("Unhandled signal: " + o.object + "::" + o.signal);
    }, this.handleResponse = function(o) {
      if (!o.hasOwnProperty("id")) {
        console.error("Invalid response message received: ", JSON.stringify(o));
        return;
      }
      s.execCallbacks[o.id](o.data), delete s.execCallbacks[o.id];
    }, this.handlePropertyUpdate = function(o) {
      o.data.forEach((a) => {
        var S = s.objects[a.object];
        S ? S.propertyUpdate(a.signals, a.properties) : console.warn("Unhandled property update: " + a.object + "::" + a.signal);
      }), s.exec({ type: t.idle });
    }, this.debug = function(o) {
      s.send({ type: t.debug, data: o });
    }, s.exec({ type: t.init }, function(o) {
      for (const a of Object.keys(o))
        new n(a, o[a], s);
      for (const a of Object.keys(s.objects))
        s.objects[a].unwrapProperties();
      c && c(s), s.exec({ type: t.idle });
    });
  };
  function n(i, c, s) {
    this.__id__ = i, s.objects[i] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {};
    var o = this;
    this.unwrapQObject = function(u) {
      if (u instanceof Array)
        return u.map((h) => o.unwrapQObject(h));
      if (!(u instanceof Object))
        return u;
      if (!u["__QObject*__"] || u.id === void 0) {
        var _ = {};
        for (const h of Object.keys(u))
          _[h] = o.unwrapQObject(u[h]);
        return _;
      }
      var f = u.id;
      if (s.objects[f])
        return s.objects[f];
      if (!u.data) {
        console.error("Cannot unwrap unknown QObject " + f + " without data.");
        return;
      }
      var l = new n(f, u.data, s);
      return l.destroyed.connect(function() {
        s.objects[f] === l && (delete s.objects[f], Object.keys(l).forEach((h) => delete l[h]));
      }), l.unwrapProperties(), l;
    }, this.unwrapProperties = function() {
      for (const u of Object.keys(o.__propertyCache__))
        o.__propertyCache__[u] = o.unwrapQObject(o.__propertyCache__[u]);
    };
    function a(u, _) {
      var f = u[0], l = u[1];
      o[f] = {
        connect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to connect to signal " + f);
            return;
          }
          o.__objectSignals__[l] = o.__objectSignals__[l] || [], o.__objectSignals__[l].push(h), !_ && (f === "destroyed" || f === "destroyed()" || f === "destroyed(QObject*)" || o.__objectSignals__[l].length == 1 && s.exec({
            type: t.connectToSignal,
            object: o.__id__,
            signal: l
          }));
        },
        disconnect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to disconnect from signal " + f);
            return;
          }
          o.__objectSignals__[l] = (o.__objectSignals__[l] || []).filter(function(E) {
            return E != h;
          }), !_ && o.__objectSignals__[l].length === 0 && s.exec({
            type: t.disconnectFromSignal,
            object: o.__id__,
            signal: l
          });
        }
      };
    }
    function S(u, _) {
      var f = o.__objectSignals__[u];
      f && f.forEach(function(l) {
        l.apply(l, _);
      });
    }
    this.propertyUpdate = function(u, _) {
      for (const l of Object.keys(_)) {
        var f = _[l];
        o.__propertyCache__[l] = this.unwrapQObject(f);
      }
      for (const l of Object.keys(u))
        S(l, u[l]);
    }, this.signalEmitted = function(u, _) {
      S(u, this.unwrapQObject(_));
    };
    function C(u) {
      var _ = u[0], f = u[1], l = _[_.length - 1] === ")" ? f : _;
      o[_] = function() {
        for (var h = [], E, L, Q = 0; Q < arguments.length; ++Q) {
          var H = arguments[Q];
          typeof H == "function" ? E = H : h.push(H);
        }
        var q;
        return !E && typeof Promise == "function" && (q = new Promise(function(P, D) {
          E = P, L = D;
        })), s.exec({
          type: t.invokeMethod,
          object: o.__id__,
          method: l,
          args: h
        }, function(P) {
          if (P !== void 0) {
            var D = o.unwrapQObject(P);
            E && E(D);
          } else L && L();
        }), q;
      };
    }
    function v(u) {
      var _ = u[0], f = u[1], l = u[2];
      o.__propertyCache__[_] = u[3], l && (l[0] === 1 && (l[0] = f + "Changed"), a(l, !0)), Object.defineProperty(o, f, {
        configurable: !0,
        get: function() {
          var h = o.__propertyCache__[_];
          return h === void 0 && console.warn('Undefined value in property cache for property "' + f + '" in object ' + o.__id__), h;
        },
        set: function(h) {
          if (h === void 0) {
            console.warn("Property setter for " + f + " called with undefined value!");
            return;
          }
          o.__propertyCache__[_] = h;
          var E = h;
          s.exec({
            type: t.setProperty,
            object: o.__id__,
            property: _,
            value: E
          });
        }
      });
    }
    c.methods.forEach(C), c.properties.forEach(v), c.signals.forEach(function(u) {
      a(u, !1);
    }), Object.assign(o, c.enums);
  }
  n.prototype.toJSON = function() {
    return this.__id__ === void 0 ? {} : {
      id: this.__id__,
      "__QObject*__": !0
    };
  }, e.exports = {
    QWebChannel: r
  };
})(K);
var le = K.exports;
const g = {};
let j = {
  connected: !1,
  objects: []
}, k;
function fe() {
  return k || (k = (async () => {
    if (typeof window > "u" || !window.qt)
      return j = {
        connected: !1,
        reason: "no-qt-transport",
        objects: []
      }, j;
    try {
      await ue(
        () => new Promise((e) => {
          new le.QWebChannel(window.qt.webChannelTransport, function(t) {
            Object.assign(g, t.objects), e();
          });
        }),
        { retries: 50, minTimeout: 10, maxTimeout: 10 }
      ), j = {
        connected: !0,
        objects: Object.keys(g)
      };
    } catch (e) {
      j = {
        connected: !1,
        reason: "retry-exhausted",
        objects: [],
        error: e?.message || String(e)
      }, console.error(
        `[AxonChannel] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${j.error}`
      );
    }
    return j;
  })(), k);
}
function Ue() {
  return j.connected;
}
const y = [];
for (let e = 0; e < 256; ++e)
  y.push((e + 256).toString(16).slice(1));
function _e(e, t = 0) {
  return (y[e[t + 0]] + y[e[t + 1]] + y[e[t + 2]] + y[e[t + 3]] + "-" + y[e[t + 4]] + y[e[t + 5]] + "-" + y[e[t + 6]] + y[e[t + 7]] + "-" + y[e[t + 8]] + y[e[t + 9]] + "-" + y[e[t + 10]] + y[e[t + 11]] + y[e[t + 12]] + y[e[t + 13]] + y[e[t + 14]] + y[e[t + 15]]).toLowerCase();
}
let J;
const he = new Uint8Array(16);
function de() {
  if (!J) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    J = crypto.getRandomValues.bind(crypto);
  }
  return J(he);
}
const pe = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), W = { randomUUID: pe };
function ye(e, t, r) {
  e = e || {};
  const n = e.random ?? e.rng?.() ?? de();
  if (n.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return n[6] = n[6] & 15 | 64, n[8] = n[8] & 63 | 128, _e(n);
}
function me(e, t, r) {
  return W.randomUUID && !e ? W.randomUUID() : ye(e);
}
class N extends Error {
  /** 稳定的机器可读错误码，便于在 catch 里分流而不是匹配文案。 */
  code;
  constructor(t, r = {}) {
    super(t), this.name = r.name ?? "AxonError", this.code = r.code ?? "AXON", r.cause !== void 0 && (this.cause = r.cause);
  }
}
class ge extends N {
  constructor(t = "Python 没有在给定时间内返回") {
    super(t, { code: "TIMEOUT", name: "AxonTimeoutError" });
  }
}
class be extends N {
  constructor(t = "Axon 通道还没有连上，先 await AxonInit()") {
    super(t, { code: "NOT_CONNECTED", name: "AxonNotConnectedError" });
  }
}
class ve extends N {
  constructor(t, r) {
    super(t, { code: "REMOTE", name: "AxonRemoteError", cause: r });
  }
}
const we = 256 * 1024, xe = 0.9, R = "__axon_gz", Y = "__axon_esc";
function Ce(e) {
  let t = "";
  for (let n = 0; n < e.length; n += 32768)
    t += String.fromCharCode.apply(null, Array.from(e.subarray(n, n + 32768)));
  return btoa(t);
}
function Ee(e) {
  const t = atob(e), r = new Uint8Array(t.length);
  for (let n = 0; n < t.length; n++) r[n] = t.charCodeAt(n);
  return r;
}
async function je(e) {
  const t = new TextEncoder().encode(e), r = new Blob([t]).stream().pipeThrough(new CompressionStream("gzip")), n = new Uint8Array(await new Response(r).arrayBuffer());
  return Ce(n);
}
async function Se(e) {
  const t = Ee(e), r = new Blob([t]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(r).text();
}
async function Ae(e) {
  if (e.length < we) return e;
  const t = await je(e);
  return t.length < e.length * xe ? { [R]: t } : e;
}
async function U(e) {
  if (typeof e == "string") return Ae(e);
  if (Array.isArray(e)) {
    const t = [];
    for (const r of e) t.push(await U(r));
    return t;
  }
  if (e && typeof e == "object") {
    if (Object.prototype.hasOwnProperty.call(e, R))
      return { [Y]: e };
    const t = {};
    for (const r of Object.keys(e)) t[r] = await U(e[r]);
    return t;
  }
  return e;
}
async function B(e) {
  if (Array.isArray(e)) {
    const t = [];
    for (const r of e) t.push(await B(r));
    return t;
  }
  if (e && typeof e == "object") {
    const t = Object.keys(e);
    if (t.length === 1 && t[0] === R && typeof e[R] == "string")
      return await Se(e[R]);
    if (t.length === 1 && t[0] === Y)
      return e[Y];
    const r = {};
    for (const n of t) r[n] = await B(e[n]);
    return r;
  }
  return e;
}
const T = {}, O = [];
let M = !1, V = !1;
function Te() {
  if (V) return;
  V = !0;
  const e = () => {
    if (V = !1, O.length === 0) return;
    const t = g.AxonJSCallHandler;
    if (!t) {
      O.length = 0;
      return;
    }
    const r = O.splice(0, O.length);
    Promise.all(
      r.map(async (n) => {
        if (!n.payload) return n;
        const i = await n.payload;
        return delete n.payload, { ...n, args: i.args, kwargs: i.kwargs };
      })
    ).then((n) => {
      n.length !== 0 && (n.length === 1 ? t.onCall(n[0]) : t.onCall({ batch: n }));
    });
  };
  typeof queueMicrotask == "function" ? queueMicrotask(e) : Promise.resolve().then(e);
}
const p = {
  async init() {
    const e = g.AxonJSCallHandler;
    try {
      e.returnReceiverSignal.disconnect(p.returnReceiver);
    } catch {
    }
    e.returnReceiverSignal.connect(p.returnReceiverDecoded);
    try {
      const t = g.AxonEnv;
      t && t.supports_codec && (M = !0, typeof t.codec == "function" && t.codec(!0));
    } catch {
      M = !1;
    }
    try {
      const t = e.returnReceiverBatchSignal;
      t && t.connect(p.returnReceiverBatch);
    } catch {
    }
  },
  __call__({
    controller_id: e,
    prop: t,
    args: r = [],
    kwargs: n = {},
    timeout: i,
    type: c = "call"
  }) {
    return new Promise((s, o) => {
      const a = me();
      if (i !== void 0) {
        let C;
        T[a] = {
          resolve: (v) => {
            clearTimeout(C), s(v);
          },
          reject: (v) => {
            clearTimeout(C), o(v);
          }
        }, C = setTimeout(
          () => p.returnReceiver([
            a,
            "reject",
            new ge(`Python 没有在 ${i}ms 内返回`)
          ]),
          i
        );
      } else T[a] = { resolve: s, reject: o };
      if (!g.AxonJSCallHandler) {
        delete T[a], o(new be());
        return;
      }
      const S = M ? Promise.all([U(r), U(n)]).then(([C, v]) => ({
        args: C,
        kwargs: v
      })) : null;
      O.push({
        call_id: a,
        web_name: g.AxonEnv.web_name,
        controller_id: e,
        prop: t,
        args: r,
        kwargs: n,
        type: c,
        payload: S
      }), Te();
    });
  },
  /** 调 Python 控制器的方法；返回类型可以自己指定：`await AxonCall.call<number>({...})`。 */
  call(e) {
    return p.__call__({ ...e, type: "call", prop: e.func });
  },
  setVar({
    controller_id: e,
    var_name: t,
    value: r,
    timeout: n
  }) {
    return p.__call__({
      controller_id: e,
      type: "set",
      args: [r],
      prop: t,
      timeout: n
    });
  },
  getVar({
    controller_id: e,
    var_name: t,
    timeout: r
  }) {
    return p.__call__({
      controller_id: e,
      type: "get",
      prop: t,
      timeout: r
    });
  },
  crossCall(e) {
    const { timeout: t, ...r } = e;
    return p.call({
      controller_id: "AxonCrossCallHandler",
      func: "onCall",
      args: [r],
      timeout: t
    });
  },
  returnReceiverBatch(e) {
    for (const t of e) p.returnReceiverDecoded(t);
  },
  async returnReceiverDecoded([e, t, r]) {
    let n = r;
    if (M && t === "resolve")
      try {
        n = await B(r);
      } catch {
        n = r;
      }
    p.returnReceiver([e, t, n]);
  },
  returnReceiver([e, t, r]) {
    const n = T[e];
    if (n) {
      if (delete T[e], t === "reject") {
        const i = r instanceof N ? r : new ve(
          typeof r == "string" ? r : JSON.stringify(r ?? "远程调用失败")
        );
        n.reject(i);
        return;
      }
      n.resolve(r);
    }
  }
}, I = {}, x = function(e) {
  return (t) => {
    const r = e !== void 0 ? e : t.name;
    return I[r] = new t(), t;
  };
};
x.get = (e) => {
  const t = I[e];
  if (!t)
    throw `[AxonController Error] Controller "${e}" not found`;
  return t;
};
x.register = (e, t) => {
  I[e] = t;
};
x.unregister = (e) => {
  delete I[e];
};
const w = {
  async init() {
    const e = g.AxonPYCall;
    if (!e) throw new Error("[AxonPYCallHandler] AxonPYCall channel missing");
    try {
      e.onCallSignal.disconnect(w.onCall);
    } catch {
    }
    e.onCallSignal.connect(w.onCall);
    try {
      e.hasControllerSignal.disconnect(w.hasController);
    } catch {
    }
    e.hasControllerSignal.connect(w.hasController);
  },
  callback(e) {
    g.AxonPYCall.returnReceiver(e);
  },
  hasController({
    call_id: e,
    controller_id: t
  }) {
    try {
      x.get(t), w.callback({
        call_id: e,
        state: "resolve",
        data: !0
      });
    } catch {
      w.callback({
        call_id: e,
        state: "resolve",
        data: !1
      });
    }
  },
  async onCall(e) {
    try {
      const t = x.get(e.controller_id);
      if (e.type === "set") {
        t[e.prop] = e.args[0], w.callback({
          call_id: e.call_id,
          state: "resolve",
          data: null
        });
        return;
      }
      const r = t[e.prop];
      if (e.type === "get") {
        w.callback({
          call_id: e.call_id,
          state: "resolve",
          data: r
        });
        return;
      }
      const n = e.kwargs || {}, i = Object.keys(n).length ? [...e.args, n] : e.args, c = await r.apply(t, i);
      w.callback({
        call_id: e.call_id,
        state: "resolve",
        data: c
      });
    } catch (t) {
      w.callback({
        call_id: e.call_id,
        state: "reject",
        data: String(t)
      });
    }
  }
};
class Oe {
  name;
  value;
  store;
  constructor(t, r, n) {
    this.name = t, this.value = r, this.store = n;
  }
  get() {
    return this.value;
  }
  /**
   * 让 `await store.get("k")` 直接拿到值（和 `Axon.Ctl.prop` 的手感一致）。
   * 不改变 `store.get("k").get()` 的同步用法。
   */
  then(t, r) {
    return Promise.resolve(this.value).then(t, r);
  }
  set(t) {
    this.value !== t && (this.value = t, p.call({
      controller_id: this.store.controller_id,
      func: "set",
      args: [this.name, t]
    }));
  }
  /** 由 Python 侧写入（Python 调这个）, 只更新本地值, 不再回推。 */
  setFromPeer(t) {
    this.value !== t && (this.value = t);
  }
}
class m {
  static AxonStoreMap = /* @__PURE__ */ new Map();
  static shared;
  id;
  store;
  controller_id;
  static init() {
    m.shared = new m("__shared__"), x.register(m.shared.id, m.shared), x.register(
      "JSAxonStoreSyncManager",
      new Re()
    );
  }
  constructor(t, r = !0) {
    if (m.AxonStoreMap.has(t)) return m.AxonStoreMap.get(t);
    this.id = t, this.controller_id = `__AxonStore_${this.id}__`, this.store = /* @__PURE__ */ new Map(), m.AxonStoreMap.set(t, this), x.register(this.controller_id, this), r && p.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "createStore",
      args: [this.id, g.AxonEnv.web_name]
    });
  }
  prop(t, r) {
    if (this.store.has(t)) return this.store.get(t);
    const n = new Oe(t, r, this);
    return this.store.set(t, n), n;
  }
  /** 读一个键的**值**（两端同名同义）：`const v = store.get<number>("k")`。 */
  get(t) {
    return this.prop(t).get();
  }
  /** 写一个键: `store.set("k", 1)` 等价于 `store.prop("k").set(1)`。 */
  set(t, r) {
    this.prop(t).set(r);
  }
  /** 由 Python 侧写入, 只更新本地值。 */
  setFromPeer(t, r) {
    this.prop(t).setFromPeer(r);
  }
  release() {
    this._release(), p.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "deleteStore",
      args: [this.id, g.AxonEnv.web_name]
    });
  }
  _release() {
    m.AxonStoreMap.delete(this.id), x.unregister(this.controller_id);
  }
}
class Re {
  createStore(t) {
    return new m(t);
  }
  deleteStore(t) {
    const r = m.AxonStoreMap.get(t);
    r && r._release();
  }
}
function $(e) {
  return e.length === 0 ? { args: [] } : Array.isArray(e[0]) && e.length > 1 ? {
    args: e[0],
    kwargs: e[1],
    timeout: e[2]
  } : { args: e };
}
const Ne = new Proxy(
  {},
  {
    get(e, t) {
      return new Proxy(
        {},
        {
          get(r, n) {
            const i = (...o) => p.call({
              controller_id: t,
              func: n,
              ...$(o)
            });
            let c;
            const s = () => (c || (c = p.getVar({
              controller_id: t,
              var_name: n
            })), c);
            return i.then = function(o, a) {
              return s().then(o, a);
            }, i.catch = function(o) {
              return s().catch(o);
            }, i.finally = function(o) {
              return s().finally(o);
            }, i;
          },
          set(r, n, i) {
            return p.setVar({
              controller_id: t,
              var_name: n,
              value: i
            }), !0;
          }
        }
      );
    }
  }
), Pe = "AxonCrossCallHandler";
function A(e, t) {
  return p.call({
    controller_id: Pe,
    func: "onCall",
    args: [e],
    timeout: t
  });
}
const X = {
  /** 现在还活着的窗口名。 */
  windows() {
    return A({ action: "windows" });
  },
  /** 这个窗口还在不在。 */
  async has(e) {
    return (await X.windows()).includes(e);
  },
  /**
   * 直接调另一个窗口，写法跟 `Axon.xxx` 一样：
   * `AxonCross.web("charts").Charts.reload("600s")`
   */
  web(e) {
    return new Proxy(
      {},
      {
        get(t, r) {
          return new Proxy(
            {},
            {
              get(n, i) {
                return (...c) => A({
                  action: "call",
                  web_name: e,
                  controller_id: r,
                  func: i,
                  ...$(c)
                });
              }
            }
          );
        }
      }
    );
  },
  /** 调另一个窗口里的一个方法，参数/超时写法同 `Axon`。 */
  call({ web: e, controller: t, func: r, args: n = [], kwargs: i, timeout: c }) {
    return A(
      {
        action: "call",
        web_name: e,
        controller_id: t,
        func: r,
        args: n,
        kwargs: i,
        timeout: c
      },
      c
    );
  },
  /** 一次打到所有窗口，返回每个窗口自己的结果。 */
  broadcast({
    controller: e,
    func: t,
    args: r = [],
    kwargs: n,
    timeout: i,
    exclude: c
  }) {
    return A(
      {
        action: "broadcast",
        controller_id: e,
        func: t,
        args: r,
        kwargs: n,
        timeout: i,
        exclude: c
      },
      i
    );
  },
  /** 发一个事件给所有窗口（对方用 `AxonEvent.addListener(type, fn)` 接）。 */
  emit(e, ...t) {
    return A({ action: "emit", type: e, args: t });
  },
  /** 发一个事件给指定窗口。 */
  emitTo(e, t, ...r) {
    return A({
      action: "call",
      web_name: e,
      controller_id: "AxonEvent",
      func: "dispatchEvent",
      args: [t, ...r]
    });
  }
}, Ie = X, d = new class {
  __listeners;
  __onceEventListenerMap;
  constructor() {
    this.__listeners = {}, this.__onceEventListenerMap = {};
  }
  on = this.addListener;
  off = this.removeListener;
  addListener(e, t, r) {
    let n = t;
    if (d.__listeners[e] ||= /* @__PURE__ */ new Set(), d.__onceEventListenerMap[e] ||= /* @__PURE__ */ new Map(), d.__listeners[e].has(t))
      return () => d.removeListener(e, t);
    if (d.__onceEventListenerMap[e].has(t))
      return () => d.removeListener(e, t);
    if (r?.once) {
      const i = t;
      n = (...c) => {
        d.removeListener(e, i), i(...c);
      }, d.__onceEventListenerMap[e].set(i, n);
    }
    return d.__listeners[e].add(n), () => d.removeListener(e, t);
  }
  removeListener(e, t) {
    if (!d.__listeners[e] || !d.__onceEventListenerMap[e])
      return;
    const r = d.__onceEventListenerMap[e].get(t);
    if (r) {
      d.__onceEventListenerMap[e].delete(t), d.__listeners[e].delete(r);
      return;
    }
    d.__listeners[e].delete(t);
  }
  removeAllListeners(e) {
    d.__listeners[e]?.clear(), d.__onceEventListenerMap[e]?.clear();
  }
  dispatchEvent(e, ...t) {
    d.__listeners[e]?.forEach((r) => {
      try {
        r(...t);
      } catch (n) {
        console.error(`事件监听器执行异常 - 事件类型: ${e}`, n);
      }
    });
  }
  dispatchPYEvent({
    type: e,
    args: t = [],
    kwargs: r = {}
  }) {
    return p.call({
      controller_id: "AxonEvent",
      func: "dispatch_event",
      args: [e, ...t],
      kwargs: r
    });
  }
}();
x.register("AxonEvent", d);
async function Le() {
  const e = await fe(), t = {
    mode: "web",
    connected: e.connected,
    ready: !1,
    reason: e.reason,
    objects: e.objects,
    error: e.error
  };
  return e.connected ? (await w.init(), await p.init(), await m.init(), await ke(), { ...t, ready: !0, mode: "app" }) : t;
}
async function ke() {
  const e = g.AxonEnv;
  if (!(!e || typeof e.ready != "function"))
    try {
      await e.ready();
    } catch (t) {
      console.warn("[AxonInit] 通知 Python 前端就绪失败:", t);
    }
}
function Qe() {
  return j.connected && !!Me();
}
function Me() {
  const e = j.objects;
  return e.includes("AxonEnv") && e.includes("AxonJSCallHandler") && e.includes("AxonPYCall");
}
export {
  Ne as Axon,
  p as AxonCall,
  j as AxonChannelStatus,
  g as AxonChannels,
  x as AxonController,
  Ie as AxonCross,
  N as AxonError,
  d as AxonEvent,
  Le as AxonInit,
  be as AxonNotConnectedError,
  ve as AxonRemoteError,
  m as AxonStore,
  ge as AxonTimeoutError,
  fe as initChannels,
  Ue as isAxonConnected,
  Qe as isAxonReady
};
