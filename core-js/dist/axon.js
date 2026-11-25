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
    var i = this._errors[n], c = i.message, a = (e[c] || 0) + 1;
    e[c] = a, a >= r && (t = i, r = a);
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
    for (var c = [], a = 0; a < n.retries; a++)
      c.push(this.createTimeout(a, n));
    return r && r.forever && !c.length && c.push(this.createTimeout(a, n)), c.sort(function(o, s) {
      return o - s;
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
    for (var a = 0; a < i.length; a++) {
      var o = i[a], s = r[o];
      r[o] = function(j) {
        var v = e.operation(n), l = Array.prototype.slice.call(arguments, 1), _ = l.pop();
        l.push(function(f) {
          v.retry(f) || (f && (arguments[0] = v.mainError()), _.apply(this, arguments));
        }), v.attempt(function() {
          j.apply(r, l);
        });
      }.bind(r, s), r[o].options = n;
    }
  };
})(W);
var re = W, ne = ee, oe = re, ie = Object.prototype.hasOwnProperty;
function F(e) {
  return e && e.code === "EPROMISERETRY" && ie.call(e, "retried");
}
function ae(e, t) {
  var r, n;
  return typeof e == "object" && typeof t == "function" && (r = t, t = e, e = r), n = oe.operation(t), new Promise(function(i, c) {
    n.attempt(function(a) {
      Promise.resolve().then(function() {
        return e(function(o) {
          throw F(o) && (o = o.retried), ne(new Error("Retrying"), "EPROMISERETRY", { retried: o });
        }, a);
      }).then(i, function(o) {
        F(o) && (o = o.retried, n.retry(o || new Error())) || c(o);
      });
    });
  });
}
var ce = ae;
const se = /* @__PURE__ */ Z(ce);
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
  }, r = function(i, c) {
    if (typeof i != "object" || typeof i.send != "function") {
      console.error("The QWebChannel expects a transport object with a send function and onmessage callback property. Given is: transport: " + typeof i + ", transport.send: " + typeof i.send);
      return;
    }
    var a = this;
    this.transport = i, this.send = function(o) {
      typeof o != "string" && (o = JSON.stringify(o)), a.transport.send(o);
    }, this.transport.onmessage = function(o) {
      var s = o.data;
      switch (typeof s == "string" && (s = JSON.parse(s)), s.type) {
        case t.signal:
          a.handleSignal(s);
          break;
        case t.response:
          a.handleResponse(s);
          break;
        case t.propertyUpdate:
          a.handlePropertyUpdate(s);
          break;
        default:
          console.error("invalid message received:", o.data);
          break;
      }
    }, this.execCallbacks = {}, this.execId = 0, this.exec = function(o, s) {
      if (!s) {
        a.send(o);
        return;
      }
      if (a.execId === Number.MAX_VALUE && (a.execId = Number.MIN_VALUE), o.hasOwnProperty("id")) {
        console.error("Cannot exec message with property id: " + JSON.stringify(o));
        return;
      }
      o.id = a.execId++, a.execCallbacks[o.id] = s, a.send(o);
    }, this.objects = {}, this.handleSignal = function(o) {
      var s = a.objects[o.object];
      s ? s.signalEmitted(o.signal, o.args) : console.warn("Unhandled signal: " + o.object + "::" + o.signal);
    }, this.handleResponse = function(o) {
      if (!o.hasOwnProperty("id")) {
        console.error("Invalid response message received: ", JSON.stringify(o));
        return;
      }
      a.execCallbacks[o.id](o.data), delete a.execCallbacks[o.id];
    }, this.handlePropertyUpdate = function(o) {
      o.data.forEach((s) => {
        var E = a.objects[s.object];
        E ? E.propertyUpdate(s.signals, s.properties) : console.warn("Unhandled property update: " + s.object + "::" + s.signal);
      }), a.exec({ type: t.idle });
    }, this.debug = function(o) {
      a.send({ type: t.debug, data: o });
    }, a.exec({ type: t.init }, function(o) {
      for (const s of Object.keys(o))
        new n(s, o[s], a);
      for (const s of Object.keys(a.objects))
        a.objects[s].unwrapProperties();
      c && c(a), a.exec({ type: t.idle });
    });
  };
  function n(i, c, a) {
    this.__id__ = i, a.objects[i] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {};
    var o = this;
    this.unwrapQObject = function(l) {
      if (l instanceof Array)
        return l.map((h) => o.unwrapQObject(h));
      if (!(l instanceof Object))
        return l;
      if (!l["__QObject*__"] || l.id === void 0) {
        var _ = {};
        for (const h of Object.keys(l))
          _[h] = o.unwrapQObject(l[h]);
        return _;
      }
      var f = l.id;
      if (a.objects[f])
        return a.objects[f];
      if (!l.data) {
        console.error("Cannot unwrap unknown QObject " + f + " without data.");
        return;
      }
      var u = new n(f, l.data, a);
      return u.destroyed.connect(function() {
        a.objects[f] === u && (delete a.objects[f], Object.keys(u).forEach((h) => delete u[h]));
      }), u.unwrapProperties(), u;
    }, this.unwrapProperties = function() {
      for (const l of Object.keys(o.__propertyCache__))
        o.__propertyCache__[l] = o.unwrapQObject(o.__propertyCache__[l]);
    };
    function s(l, _) {
      var f = l[0], u = l[1];
      o[f] = {
        connect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to connect to signal " + f);
            return;
          }
          o.__objectSignals__[u] = o.__objectSignals__[u] || [], o.__objectSignals__[u].push(h), !_ && (f === "destroyed" || f === "destroyed()" || f === "destroyed(QObject*)" || o.__objectSignals__[u].length == 1 && a.exec({
            type: t.connectToSignal,
            object: o.__id__,
            signal: u
          }));
        },
        disconnect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to disconnect from signal " + f);
            return;
          }
          o.__objectSignals__[u] = (o.__objectSignals__[u] || []).filter(function(C) {
            return C != h;
          }), !_ && o.__objectSignals__[u].length === 0 && a.exec({
            type: t.disconnectFromSignal,
            object: o.__id__,
            signal: u
          });
        }
      };
    }
    function E(l, _) {
      var f = o.__objectSignals__[l];
      f && f.forEach(function(u) {
        u.apply(u, _);
      });
    }
    this.propertyUpdate = function(l, _) {
      for (const u of Object.keys(_)) {
        var f = _[u];
        o.__propertyCache__[u] = this.unwrapQObject(f);
      }
      for (const u of Object.keys(l))
        E(u, l[u]);
    }, this.signalEmitted = function(l, _) {
      E(l, this.unwrapQObject(_));
    };
    function j(l) {
      var _ = l[0], f = l[1], u = _[_.length - 1] === ")" ? f : _;
      o[_] = function() {
        for (var h = [], C, N, L = 0; L < arguments.length; ++L) {
          var Q = arguments[L];
          typeof Q == "function" ? C = Q : h.push(Q);
        }
        var J;
        return !C && typeof Promise == "function" && (J = new Promise(function(R, H) {
          C = R, N = H;
        })), a.exec({
          type: t.invokeMethod,
          object: o.__id__,
          method: u,
          args: h
        }, function(R) {
          if (R !== void 0) {
            var H = o.unwrapQObject(R);
            C && C(H);
          } else N && N();
        }), J;
      };
    }
    function v(l) {
      var _ = l[0], f = l[1], u = l[2];
      o.__propertyCache__[_] = l[3], u && (u[0] === 1 && (u[0] = f + "Changed"), s(u, !0)), Object.defineProperty(o, f, {
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
    c.methods.forEach(j), c.properties.forEach(v), c.signals.forEach(function(l) {
      s(l, !1);
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
})(G);
var le = G.exports;
const g = {};
let S = {
  connected: !1,
  objects: []
}, P;
function ue() {
  return P || (P = (async () => {
    if (typeof window > "u" || !window.qt)
      return S = {
        connected: !1,
        reason: "no-qt-transport",
        objects: []
      }, S;
    try {
      await se(
        () => new Promise((e) => {
          new le.QWebChannel(window.qt.webChannelTransport, function(t) {
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
  })(), P);
}
function ke() {
  return S.connected;
}
const p = [];
for (let e = 0; e < 256; ++e)
  p.push((e + 256).toString(16).slice(1));
function fe(e, t = 0) {
  return (p[e[t + 0]] + p[e[t + 1]] + p[e[t + 2]] + p[e[t + 3]] + "-" + p[e[t + 4]] + p[e[t + 5]] + "-" + p[e[t + 6]] + p[e[t + 7]] + "-" + p[e[t + 8]] + p[e[t + 9]] + "-" + p[e[t + 10]] + p[e[t + 11]] + p[e[t + 12]] + p[e[t + 13]] + p[e[t + 14]] + p[e[t + 15]]).toLowerCase();
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
const d = {
  async init() {
    const e = g.AxonJSCallHandler;
    try {
      e.returnReceiverSignal.disconnect(d.returnReceiver);
    } catch {
    }
    e.returnReceiverSignal.connect(d.returnReceiverDecoded);
    try {
      const t = g.AxonEnv;
      t && t.supports_codec && (M = !0, typeof t.codec == "function" && t.codec(!0));
    } catch {
      M = !1;
    }
    try {
      const t = e.returnReceiverBatchSignal;
      t && t.connect(d.returnReceiverBatch);
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
    return new Promise((a, o) => {
      const s = ye();
      if (i !== void 0) {
        let j;
        A[s] = {
          resolve: (v) => {
            clearTimeout(j), a(v);
          },
          reject: (v) => {
            clearTimeout(j), o(v);
          }
        }, j = setTimeout(
          () => d.returnReceiver([
            s,
            "reject",
            `Timeout Error, py not return in ${i}ms`
          ]),
          i
        );
      } else A[s] = { resolve: a, reject: o };
      if (!g.AxonJSCallHandler) {
        delete A[s], o("Axon 通道还没有连上，先 await AxonInit()");
        return;
      }
      const E = M ? Promise.all([U(r), U(n)]).then(([j, v]) => ({
        args: j,
        kwargs: v
      })) : null;
      O.push({
        call_id: s,
        web_name: g.AxonEnv.web_name,
        controller_id: e,
        prop: t,
        args: r,
        kwargs: n,
        type: c,
        payload: E
      }), Ce();
    });
  },
  call(e) {
    return d.__call__({ ...e, type: "call", prop: e.func });
  },
  setVar({
    controller_id: e,
    var_name: t,
    value: r,
    timeout: n
  }) {
    return d.__call__({
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
    return d.__call__({
      controller_id: e,
      type: "get",
      prop: t,
      timeout: r
    });
  },
  crossCall(e) {
    const { timeout: t, ...r } = e;
    return d.call({
      controller_id: "AxonCrossCallHandler",
      func: "onCall",
      args: [r],
      timeout: t
    });
  },
  returnReceiverBatch(e) {
    for (const t of e) d.returnReceiverDecoded(t);
  },
  async returnReceiverDecoded([e, t, r]) {
    let n = r;
    if (M && t === "resolve")
      try {
        n = await B(r);
      } catch {
        n = r;
      }
    d.returnReceiver([e, t, n]);
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
  set(t) {
    this.value !== t && (this.value = t, d.call({
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
    this.id = t, this.controller_id = `__AxonStore_${this.id}__`, this.store = /* @__PURE__ */ new Map(), m.AxonStoreMap.set(t, this), x.register(this.controller_id, this), r && d.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "createStore",
      args: [this.id, g.AxonEnv.web_name]
    });
  }
  prop(t, r = void 0) {
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
    this._release(), d.call({
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
const Re = new Proxy(
  {},
  {
    get(e, t) {
      return new Proxy(
        {},
        {
          get(r, n) {
            const i = (...o) => d.call({
              controller_id: t,
              func: n,
              ...K(o)
            });
            let c;
            const a = () => (c || (c = d.getVar({
              controller_id: t,
              var_name: n
            })), c);
            return i.then = function(o, s) {
              return a().then(o, s);
            }, i.catch = function(o) {
              return a().catch(o);
            }, i.finally = function(o) {
              return a().finally(o);
            }, i;
          },
          set(r, n, i) {
            return d.setVar({
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
  return d.call({
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
                return (...c) => T({
                  action: "call",
                  web_name: e,
                  controller_id: r,
                  func: i,
                  ...K(c)
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
    return T(
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
    return T(
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
}, Pe = $, y = new class {
  __listeners;
  __onceEventListenerMap;
  constructor() {
    this.__listeners = {}, this.__onceEventListenerMap = {};
  }
  on = this.addListener;
  off = this.removeListener;
  addListener(e, t, r) {
    let n = t;
    if (y.__listeners[e] ||= /* @__PURE__ */ new Set(), y.__onceEventListenerMap[e] ||= /* @__PURE__ */ new Map(), !y.__listeners[e].has(t) && !y.__onceEventListenerMap[e].has(t)) {
      if (r?.once) {
        const i = t;
        n = (...c) => {
          y.removeListener(e, i), i(...c);
        }, y.__onceEventListenerMap[e].set(i, n);
      }
      y.__listeners[e].add(n);
    }
  }
  removeListener(e, t) {
    if (!y.__listeners[e] || !y.__onceEventListenerMap[e])
      return;
    const r = y.__onceEventListenerMap[e].get(t);
    if (r) {
      y.__onceEventListenerMap[e].delete(t), y.__listeners[e].delete(r);
      return;
    }
    y.__listeners[e].delete(t);
  }
  removeAllListeners(e) {
    y.__listeners[e]?.clear(), y.__onceEventListenerMap[e]?.clear();
  }
  dispatchEvent(e, ...t) {
    y.__listeners[e]?.forEach((r) => {
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
    return d.call({
      controller_id: "AxonEvent",
      func: "dispatch_event",
      args: [e, ...t],
      kwargs: r
    });
  }
}();
x.register("AxonEvent", y);
async function Me() {
  const e = await ue(), t = {
    connected: e.connected,
    ready: !1,
    reason: e.reason,
    objects: e.objects,
    error: e.error
  };
  return e.connected ? (await w.init(), await d.init(), await m.init(), await Ae(), { ...t, ready: !0 }) : t;
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
  Re as Axon,
  d as AxonCall,
  S as AxonChannelStatus,
  g as AxonChannels,
  x as AxonController,
  Pe as AxonCross,
  y as AxonEvent,
  Me as AxonInit,
  m as AxonStore,
  ue as initChannels,
  ke as isAxonConnected,
  Ue as isAxonReady
};
