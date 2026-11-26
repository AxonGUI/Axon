function Z(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function q(e, t) {
  for (const r in t)
    Object.defineProperty(e, r, {
      value: t[r],
      enumerable: !0,
      configurable: !0
    });
  return e;
}
function X(e, t, r) {
  if (!e || typeof e == "string")
    throw new TypeError("Please pass an Error to err-code");
  r || (r = {}), typeof t == "object" && (r = t, t = void 0), t != null && (r.code = t);
  try {
    return q(e, r);
  } catch {
    r.message = e.message, r.stack = e.stack;
    const i = function() {
    };
    return i.prototype = Object.create(Object.getPrototypeOf(e)), q(new i(), r);
  }
}
var ee = X, W = {};
function b(e, t) {
  typeof t == "boolean" && (t = { forever: t }), this._originalTimeouts = JSON.parse(JSON.stringify(e)), this._timeouts = e, this._options = t || {}, this._maxRetryTime = t && t.maxRetryTime || 1 / 0, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
}
var te = b;
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
    var i = this._errors[n], s = i.message, a = (e[s] || 0) + 1;
    e[s] = a, a >= r && (t = i, r = a);
  }
  return t;
};
(function(e) {
  var t = te;
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
    for (var s = [], a = 0; a < n.retries; a++)
      s.push(this.createTimeout(a, n));
    return r && r.forever && !s.length && s.push(this.createTimeout(a, n)), s.sort(function(o, c) {
      return o - c;
    }), s;
  }, e.createTimeout = function(r, n) {
    var i = n.randomize ? Math.random() + 1 : 1, s = Math.round(i * n.minTimeout * Math.pow(n.factor, r));
    return s = Math.min(s, n.maxTimeout), s;
  }, e.wrap = function(r, n, i) {
    if (n instanceof Array && (i = n, n = null), !i) {
      i = [];
      for (var s in r)
        typeof r[s] == "function" && i.push(s);
    }
    for (var a = 0; a < i.length; a++) {
      var o = i[a], c = r[o];
      r[o] = function(j) {
        var v = e.operation(n), u = Array.prototype.slice.call(arguments, 1), _ = u.pop();
        u.push(function(f) {
          v.retry(f) || (f && (arguments[0] = v.mainError()), _.apply(this, arguments));
        }), v.attempt(function() {
          j.apply(r, u);
        });
      }.bind(r, c), r[o].options = n;
    }
  };
})(W);
var re = W, ne = ee, oe = re, ie = Object.prototype.hasOwnProperty;
function F(e) {
  return e && e.code === "EPROMISERETRY" && ie.call(e, "retried");
}
function ae(e, t) {
  var r, n;
  return typeof e == "object" && typeof t == "function" && (r = t, t = e, e = r), n = oe.operation(t), new Promise(function(i, s) {
    n.attempt(function(a) {
      Promise.resolve().then(function() {
        return e(function(o) {
          throw F(o) && (o = o.retried), ne(new Error("Retrying"), "EPROMISERETRY", { retried: o });
        }, a);
      }).then(i, function(o) {
        F(o) && (o = o.retried, n.retry(o || new Error())) || s(o);
      });
    });
  });
}
var se = ae;
const ce = /* @__PURE__ */ Z(se);
var G = { exports: {} };
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
  }, r = function(i, s) {
    if (typeof i != "object" || typeof i.send != "function") {
      console.error("The QWebChannel expects a transport object with a send function and onmessage callback property. Given is: transport: " + typeof i + ", transport.send: " + typeof i.send);
      return;
    }
    var a = this;
    this.transport = i, this.send = function(o) {
      typeof o != "string" && (o = JSON.stringify(o)), a.transport.send(o);
    }, this.transport.onmessage = function(o) {
      var c = o.data;
      switch (typeof c == "string" && (c = JSON.parse(c)), c.type) {
        case t.signal:
          a.handleSignal(c);
          break;
        case t.response:
          a.handleResponse(c);
          break;
        case t.propertyUpdate:
          a.handlePropertyUpdate(c);
          break;
        default:
          console.error("invalid message received:", o.data);
          break;
      }
    }, this.execCallbacks = {}, this.execId = 0, this.exec = function(o, c) {
      if (!c) {
        a.send(o);
        return;
      }
      if (a.execId === Number.MAX_VALUE && (a.execId = Number.MIN_VALUE), o.hasOwnProperty("id")) {
        console.error("Cannot exec message with property id: " + JSON.stringify(o));
        return;
      }
      o.id = a.execId++, a.execCallbacks[o.id] = c, a.send(o);
    }, this.objects = {}, this.handleSignal = function(o) {
      var c = a.objects[o.object];
      c ? c.signalEmitted(o.signal, o.args) : console.warn("Unhandled signal: " + o.object + "::" + o.signal);
    }, this.handleResponse = function(o) {
      if (!o.hasOwnProperty("id")) {
        console.error("Invalid response message received: ", JSON.stringify(o));
        return;
      }
      a.execCallbacks[o.id](o.data), delete a.execCallbacks[o.id];
    }, this.handlePropertyUpdate = function(o) {
      o.data.forEach((c) => {
        var E = a.objects[c.object];
        E ? E.propertyUpdate(c.signals, c.properties) : console.warn("Unhandled property update: " + c.object + "::" + c.signal);
      }), a.exec({ type: t.idle });
    }, this.debug = function(o) {
      a.send({ type: t.debug, data: o });
    }, a.exec({ type: t.init }, function(o) {
      for (const c of Object.keys(o))
        new n(c, o[c], a);
      for (const c of Object.keys(a.objects))
        a.objects[c].unwrapProperties();
      s && s(a), a.exec({ type: t.idle });
    });
  };
  function n(i, s, a) {
    this.__id__ = i, a.objects[i] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {};
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
      if (a.objects[f])
        return a.objects[f];
      if (!u.data) {
        console.error("Cannot unwrap unknown QObject " + f + " without data.");
        return;
      }
      var l = new n(f, u.data, a);
      return l.destroyed.connect(function() {
        a.objects[f] === l && (delete a.objects[f], Object.keys(l).forEach((h) => delete l[h]));
      }), l.unwrapProperties(), l;
    }, this.unwrapProperties = function() {
      for (const u of Object.keys(o.__propertyCache__))
        o.__propertyCache__[u] = o.unwrapQObject(o.__propertyCache__[u]);
    };
    function c(u, _) {
      var f = u[0], l = u[1];
      o[f] = {
        connect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to connect to signal " + f);
            return;
          }
          o.__objectSignals__[l] = o.__objectSignals__[l] || [], o.__objectSignals__[l].push(h), !_ && (f === "destroyed" || f === "destroyed()" || f === "destroyed(QObject*)" || o.__objectSignals__[l].length == 1 && a.exec({
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
          o.__objectSignals__[l] = (o.__objectSignals__[l] || []).filter(function(C) {
            return C != h;
          }), !_ && o.__objectSignals__[l].length === 0 && a.exec({
            type: t.disconnectFromSignal,
            object: o.__id__,
            signal: l
          });
        }
      };
    }
    function E(u, _) {
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
        E(l, u[l]);
    }, this.signalEmitted = function(u, _) {
      E(u, this.unwrapQObject(_));
    };
    function j(u) {
      var _ = u[0], f = u[1], l = _[_.length - 1] === ")" ? f : _;
      o[_] = function() {
        for (var h = [], C, L, N = 0; N < arguments.length; ++N) {
          var Q = arguments[N];
          typeof Q == "function" ? C = Q : h.push(Q);
        }
        var J;
        return !C && typeof Promise == "function" && (J = new Promise(function(P, H) {
          C = P, L = H;
        })), a.exec({
          type: t.invokeMethod,
          object: o.__id__,
          method: l,
          args: h
        }, function(P) {
          if (P !== void 0) {
            var H = o.unwrapQObject(P);
            C && C(H);
          } else L && L();
        }), J;
      };
    }
    function v(u) {
      var _ = u[0], f = u[1], l = u[2];
      o.__propertyCache__[_] = u[3], l && (l[0] === 1 && (l[0] = f + "Changed"), c(l, !0)), Object.defineProperty(o, f, {
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
          var C = h;
          a.exec({
            type: t.setProperty,
            object: o.__id__,
            property: _,
            value: C
          });
        }
      });
    }
    s.methods.forEach(j), s.properties.forEach(v), s.signals.forEach(function(u) {
      c(u, !1);
    }), Object.assign(o, s.enums);
  }
  n.prototype.toJSON = function() {
    return this.__id__ === void 0 ? {} : {
      id: this.__id__,
      "__QObject*__": !0
    };
  }, e.exports = {
    QWebChannel: r
  };
})(G);
var ue = G.exports;
const g = {};
let S = {
  connected: !1,
  objects: []
}, R;
function le() {
  return R || (R = (async () => {
    if (typeof window > "u" || !window.qt)
      return S = {
        connected: !1,
        reason: "no-qt-transport",
        objects: []
      }, S;
    try {
      await ce(
        () => new Promise((e) => {
          new ue.QWebChannel(window.qt.webChannelTransport, function(t) {
            Object.assign(g, t.objects), e();
          });
        }),
        { retries: 50, minTimeout: 10, maxTimeout: 10 }
      ), S = {
        connected: !0,
        objects: Object.keys(g)
      };
    } catch (e) {
      S = {
        connected: !1,
        reason: "retry-exhausted",
        objects: [],
        error: e?.message || String(e)
      }, console.error(
        `[AxonChannel] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${S.error}`
      );
    }
    return S;
  })(), R);
}
function ke() {
  return S.connected;
}
const y = [];
for (let e = 0; e < 256; ++e)
  y.push((e + 256).toString(16).slice(1));
function fe(e, t = 0) {
  return (y[e[t + 0]] + y[e[t + 1]] + y[e[t + 2]] + y[e[t + 3]] + "-" + y[e[t + 4]] + y[e[t + 5]] + "-" + y[e[t + 6]] + y[e[t + 7]] + "-" + y[e[t + 8]] + y[e[t + 9]] + "-" + y[e[t + 10]] + y[e[t + 11]] + y[e[t + 12]] + y[e[t + 13]] + y[e[t + 14]] + y[e[t + 15]]).toLowerCase();
}
let D;
const _e = new Uint8Array(16);
function he() {
  if (!D) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    D = crypto.getRandomValues.bind(crypto);
  }
  return D(_e);
}
const de = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), z = { randomUUID: de };
function pe(e, t, r) {
  e = e || {};
  const n = e.random ?? e.rng?.() ?? he();
  if (n.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return n[6] = n[6] & 15 | 64, n[8] = n[8] & 63 | 128, fe(n);
}
function ye(e, t, r) {
  return z.randomUUID && !e ? z.randomUUID() : pe(e);
}
const me = 256 * 1024, ge = 0.9, k = "__axon_gz", Y = "__axon_esc";
function be(e) {
  let t = "";
  for (let n = 0; n < e.length; n += 32768)
    t += String.fromCharCode.apply(null, Array.from(e.subarray(n, n + 32768)));
  return btoa(t);
}
function ve(e) {
  const t = atob(e), r = new Uint8Array(t.length);
  for (let n = 0; n < t.length; n++) r[n] = t.charCodeAt(n);
  return r;
}
async function we(e) {
  const t = new TextEncoder().encode(e), r = new Blob([t]).stream().pipeThrough(new CompressionStream("gzip")), n = new Uint8Array(await new Response(r).arrayBuffer());
  return be(n);
}
async function xe(e) {
  const t = ve(e), r = new Blob([t]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(r).text();
}
async function je(e) {
  if (e.length < me) return e;
  const t = await we(e);
  return t.length < e.length * ge ? { [k]: t } : e;
}
async function U(e) {
  if (typeof e == "string") return je(e);
  if (Array.isArray(e)) {
    const t = [];
    for (const r of e) t.push(await U(r));
    return t;
  }
  if (e && typeof e == "object") {
    if (Object.prototype.hasOwnProperty.call(e, k))
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
    if (t.length === 1 && t[0] === k && typeof e[k] == "string")
      return await xe(e[k]);
    if (t.length === 1 && t[0] === Y)
      return e[Y];
    const r = {};
    for (const n of t) r[n] = await B(e[n]);
    return r;
  }
  return e;
}
const A = {}, O = [];
let M = !1, V = !1;
function Ce() {
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
    type: s = "call"
  }) {
    return new Promise((a, o) => {
      const c = ye();
      if (i !== void 0) {
        let j;
        A[c] = {
          resolve: (v) => {
            clearTimeout(j), a(v);
          },
          reject: (v) => {
            clearTimeout(j), o(v);
          }
        }, j = setTimeout(
          () => p.returnReceiver([
            c,
            "reject",
            `Timeout Error, py not return in ${i}ms`
          ]),
          i
        );
      } else A[c] = { resolve: a, reject: o };
      if (!g.AxonJSCallHandler) {
        delete A[c], o("Axon 通道还没有连上，先 await AxonInit()");
        return;
      }
      const E = M ? Promise.all([U(r), U(n)]).then(([j, v]) => ({
        args: j,
        kwargs: v
      })) : null;
      O.push({
        call_id: c,
        web_name: g.AxonEnv.web_name,
        controller_id: e,
        prop: t,
        args: r,
        kwargs: n,
        type: s,
        payload: E
      }), Ce();
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
    const n = A[e];
    n && (delete A[e], n[t](r));
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
      const n = e.kwargs || {}, i = Object.keys(n).length ? [...e.args, n] : e.args, s = await r.apply(t, i);
      w.callback({
        call_id: e.call_id,
        state: "resolve",
        data: s
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
class Se {
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
      new Ee()
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
    const n = new Se(t, r, this);
    return this.store.set(t, n), n;
  }
  /** 读一个键: `store.get("k")` 等价于 `store.prop("k")`。 */
  get(t) {
    return this.prop(t);
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
class Ee {
  createStore(t) {
    return new m(t);
  }
  deleteStore(t) {
    const r = m.AxonStoreMap.get(t);
    r && r._release();
  }
}
function K(e) {
  return e.length === 0 ? { args: [] } : Array.isArray(e[0]) && e.length > 1 ? {
    args: e[0],
    kwargs: e[1],
    timeout: e[2]
  } : { args: e };
}
const Pe = new Proxy(
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
              ...K(o)
            });
            let s;
            const a = () => (s || (s = p.getVar({
              controller_id: t,
              var_name: n
            })), s);
            return i.then = function(o, c) {
              return a().then(o, c);
            }, i.catch = function(o) {
              return a().catch(o);
            }, i.finally = function(o) {
              return a().finally(o);
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
), Te = "AxonCrossCallHandler";
function T(e, t) {
  return p.call({
    controller_id: Te,
    func: "onCall",
    args: [e],
    timeout: t
  });
}
const $ = {
  /** 现在还活着的窗口名。 */
  windows() {
    return T({ action: "windows" });
  },
  /** 这个窗口还在不在。 */
  async has(e) {
    return (await $.windows()).includes(e);
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
                return (...s) => T({
                  action: "call",
                  web_name: e,
                  controller_id: r,
                  func: i,
                  ...K(s)
                });
              }
            }
          );
        }
      }
    );
  },
  /** 调另一个窗口里的一个方法，参数/超时写法同 `Axon`。 */
  call({ web: e, controller: t, func: r, args: n = [], kwargs: i, timeout: s }) {
    return T(
      {
        action: "call",
        web_name: e,
        controller_id: t,
        func: r,
        args: n,
        kwargs: i,
        timeout: s
      },
      s
    );
  },
  /** 一次打到所有窗口，返回每个窗口自己的结果。 */
  broadcast({
    controller: e,
    func: t,
    args: r = [],
    kwargs: n,
    timeout: i,
    exclude: s
  }) {
    return T(
      {
        action: "broadcast",
        controller_id: e,
        func: t,
        args: r,
        kwargs: n,
        timeout: i,
        exclude: s
      },
      i
    );
  },
  /** 发一个事件给所有窗口（对方用 `AxonEvent.addListener(type, fn)` 接）。 */
  emit(e, ...t) {
    return T({ action: "emit", type: e, args: t });
  },
  /** 发一个事件给指定窗口。 */
  emitTo(e, t, ...r) {
    return T({
      action: "call",
      web_name: e,
      controller_id: "AxonEvent",
      func: "dispatchEvent",
      args: [t, ...r]
    });
  }
}, Re = $, d = new class {
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
      n = (...s) => {
        d.removeListener(e, i), i(...s);
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
async function Me() {
  const e = await le(), t = {
    connected: e.connected,
    ready: !1,
    reason: e.reason,
    objects: e.objects,
    error: e.error
  };
  return e.connected ? (await w.init(), await p.init(), await m.init(), await Ae(), { ...t, ready: !0 }) : t;
}
async function Ae() {
  const e = g.AxonEnv;
  if (!(!e || typeof e.ready != "function"))
    try {
      await e.ready();
    } catch (t) {
      console.warn("[AxonInit] 通知 Python 前端就绪失败:", t);
    }
}
function Ue() {
  return S.connected && !!Oe();
}
function Oe() {
  const e = S.objects;
  return e.includes("AxonEnv") && e.includes("AxonJSCallHandler") && e.includes("AxonPYCall");
}
export {
  Pe as Axon,
  p as AxonCall,
  S as AxonChannelStatus,
  g as AxonChannels,
  x as AxonController,
  Re as AxonCross,
  d as AxonEvent,
  Me as AxonInit,
  m as AxonStore,
  le as initChannels,
  ke as isAxonConnected,
  Ue as isAxonReady
};
