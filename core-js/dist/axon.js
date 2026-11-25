function B(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function J(e, t) {
  for (const r in t)
    Object.defineProperty(e, r, {
      value: t[r],
      enumerable: !0,
      configurable: !0
    });
  return e;
}
function G(e, t, r) {
  if (!e || typeof e == "string")
    throw new TypeError("Please pass an Error to err-code");
  r || (r = {}), typeof t == "object" && (r = t, t = void 0), t != null && (r.code = t);
  try {
    return J(e, r);
  } catch {
    r.message = e.message, r.stack = e.stack;
    const a = function() {
    };
    return a.prototype = Object.create(Object.getPrototypeOf(e)), J(new a(), r);
  }
}
var $ = G, q = {};
function g(e, t) {
  typeof t == "boolean" && (t = { forever: t }), this._originalTimeouts = JSON.parse(JSON.stringify(e)), this._timeouts = e, this._options = t || {}, this._maxRetryTime = t && t.maxRetryTime || 1 / 0, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
}
var z = g;
g.prototype.reset = function() {
  this._attempts = 1, this._timeouts = this._originalTimeouts;
};
g.prototype.stop = function() {
  this._timeout && clearTimeout(this._timeout), this._timeouts = [], this._cachedTimeouts = null;
};
g.prototype.retry = function(e) {
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
  var o = this, a = setTimeout(function() {
    o._attempts++, o._operationTimeoutCb && (o._timeout = setTimeout(function() {
      o._operationTimeoutCb(o._attempts);
    }, o._operationTimeout), o._options.unref && o._timeout.unref()), o._fn(o._attempts);
  }, r);
  return this._options.unref && a.unref(), !0;
};
g.prototype.attempt = function(e, t) {
  this._fn = e, t && (t.timeout && (this._operationTimeout = t.timeout), t.cb && (this._operationTimeoutCb = t.cb));
  var r = this;
  this._operationTimeoutCb && (this._timeout = setTimeout(function() {
    r._operationTimeoutCb();
  }, r._operationTimeout)), this._operationStart = (/* @__PURE__ */ new Date()).getTime(), this._fn(this._attempts);
};
g.prototype.try = function(e) {
  console.log("Using RetryOperation.try() is deprecated"), this.attempt(e);
};
g.prototype.start = function(e) {
  console.log("Using RetryOperation.start() is deprecated"), this.attempt(e);
};
g.prototype.start = g.prototype.try;
g.prototype.errors = function() {
  return this._errors;
};
g.prototype.attempts = function() {
  return this._attempts;
};
g.prototype.mainError = function() {
  if (this._errors.length === 0)
    return null;
  for (var e = {}, t = null, r = 0, o = 0; o < this._errors.length; o++) {
    var a = this._errors[o], c = a.message, i = (e[c] || 0) + 1;
    e[c] = i, i >= r && (t = a, r = i);
  }
  return t;
};
(function(e) {
  var t = z;
  e.operation = function(r) {
    var o = e.timeouts(r);
    return new t(o, {
      forever: r && r.forever,
      unref: r && r.unref,
      maxRetryTime: r && r.maxRetryTime
    });
  }, e.timeouts = function(r) {
    if (r instanceof Array)
      return [].concat(r);
    var o = {
      retries: 10,
      factor: 2,
      minTimeout: 1 * 1e3,
      maxTimeout: 1 / 0,
      randomize: !1
    };
    for (var a in r)
      o[a] = r[a];
    if (o.minTimeout > o.maxTimeout)
      throw new Error("minTimeout is greater than maxTimeout");
    for (var c = [], i = 0; i < o.retries; i++)
      c.push(this.createTimeout(i, o));
    return r && r.forever && !c.length && c.push(this.createTimeout(i, o)), c.sort(function(n, s) {
      return n - s;
    }), c;
  }, e.createTimeout = function(r, o) {
    var a = o.randomize ? Math.random() + 1 : 1, c = Math.round(a * o.minTimeout * Math.pow(o.factor, r));
    return c = Math.min(c, o.maxTimeout), c;
  }, e.wrap = function(r, o, a) {
    if (o instanceof Array && (a = o, o = null), !a) {
      a = [];
      for (var c in r)
        typeof r[c] == "function" && a.push(c);
    }
    for (var i = 0; i < a.length; i++) {
      var n = a[i], s = r[n];
      r[n] = function(S) {
        var T = e.operation(o), l = Array.prototype.slice.call(arguments, 1), _ = l.pop();
        l.push(function(f) {
          T.retry(f) || (f && (arguments[0] = T.mainError()), _.apply(this, arguments));
        }), T.attempt(function() {
          S.apply(r, l);
        });
      }.bind(r, s), r[n].options = o;
    }
  };
})(q);
var X = q, K = $, Z = X, ee = Object.prototype.hasOwnProperty;
function Y(e) {
  return e && e.code === "EPROMISERETRY" && ee.call(e, "retried");
}
function te(e, t) {
  var r, o;
  return typeof e == "object" && typeof t == "function" && (r = t, t = e, e = r), o = Z.operation(t), new Promise(function(a, c) {
    o.attempt(function(i) {
      Promise.resolve().then(function() {
        return e(function(n) {
          throw Y(n) && (n = n.retried), K(new Error("Retrying"), "EPROMISERETRY", { retried: n });
        }, i);
      }).then(a, function(n) {
        Y(n) && (n = n.retried, o.retry(n || new Error())) || c(n);
      });
    });
  });
}
var re = te;
const ne = /* @__PURE__ */ B(re);
var D = { exports: {} };
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
  }, r = function(a, c) {
    if (typeof a != "object" || typeof a.send != "function") {
      console.error("The QWebChannel expects a transport object with a send function and onmessage callback property. Given is: transport: " + typeof a + ", transport.send: " + typeof a.send);
      return;
    }
    var i = this;
    this.transport = a, this.send = function(n) {
      typeof n != "string" && (n = JSON.stringify(n)), i.transport.send(n);
    }, this.transport.onmessage = function(n) {
      var s = n.data;
      switch (typeof s == "string" && (s = JSON.parse(s)), s.type) {
        case t.signal:
          i.handleSignal(s);
          break;
        case t.response:
          i.handleResponse(s);
          break;
        case t.propertyUpdate:
          i.handlePropertyUpdate(s);
          break;
        default:
          console.error("invalid message received:", n.data);
          break;
      }
    }, this.execCallbacks = {}, this.execId = 0, this.exec = function(n, s) {
      if (!s) {
        i.send(n);
        return;
      }
      if (i.execId === Number.MAX_VALUE && (i.execId = Number.MIN_VALUE), n.hasOwnProperty("id")) {
        console.error("Cannot exec message with property id: " + JSON.stringify(n));
        return;
      }
      n.id = i.execId++, i.execCallbacks[n.id] = s, i.send(n);
    }, this.objects = {}, this.handleSignal = function(n) {
      var s = i.objects[n.object];
      s ? s.signalEmitted(n.signal, n.args) : console.warn("Unhandled signal: " + n.object + "::" + n.signal);
    }, this.handleResponse = function(n) {
      if (!n.hasOwnProperty("id")) {
        console.error("Invalid response message received: ", JSON.stringify(n));
        return;
      }
      i.execCallbacks[n.id](n.data), delete i.execCallbacks[n.id];
    }, this.handlePropertyUpdate = function(n) {
      n.data.forEach((s) => {
        var w = i.objects[s.object];
        w ? w.propertyUpdate(s.signals, s.properties) : console.warn("Unhandled property update: " + s.object + "::" + s.signal);
      }), i.exec({ type: t.idle });
    }, this.debug = function(n) {
      i.send({ type: t.debug, data: n });
    }, i.exec({ type: t.init }, function(n) {
      for (const s of Object.keys(n))
        new o(s, n[s], i);
      for (const s of Object.keys(i.objects))
        i.objects[s].unwrapProperties();
      c && c(i), i.exec({ type: t.idle });
    });
  };
  function o(a, c, i) {
    this.__id__ = a, i.objects[a] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {};
    var n = this;
    this.unwrapQObject = function(l) {
      if (l instanceof Array)
        return l.map((h) => n.unwrapQObject(h));
      if (!(l instanceof Object))
        return l;
      if (!l["__QObject*__"] || l.id === void 0) {
        var _ = {};
        for (const h of Object.keys(l))
          _[h] = n.unwrapQObject(l[h]);
        return _;
      }
      var f = l.id;
      if (i.objects[f])
        return i.objects[f];
      if (!l.data) {
        console.error("Cannot unwrap unknown QObject " + f + " without data.");
        return;
      }
      var u = new o(f, l.data, i);
      return u.destroyed.connect(function() {
        i.objects[f] === u && (delete i.objects[f], Object.keys(u).forEach((h) => delete u[h]));
      }), u.unwrapProperties(), u;
    }, this.unwrapProperties = function() {
      for (const l of Object.keys(n.__propertyCache__))
        n.__propertyCache__[l] = n.unwrapQObject(n.__propertyCache__[l]);
    };
    function s(l, _) {
      var f = l[0], u = l[1];
      n[f] = {
        connect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to connect to signal " + f);
            return;
          }
          n.__objectSignals__[u] = n.__objectSignals__[u] || [], n.__objectSignals__[u].push(h), !_ && (f === "destroyed" || f === "destroyed()" || f === "destroyed(QObject*)" || n.__objectSignals__[u].length == 1 && i.exec({
            type: t.connectToSignal,
            object: n.__id__,
            signal: u
          }));
        },
        disconnect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to disconnect from signal " + f);
            return;
          }
          n.__objectSignals__[u] = (n.__objectSignals__[u] || []).filter(function(j) {
            return j != h;
          }), !_ && n.__objectSignals__[u].length === 0 && i.exec({
            type: t.disconnectFromSignal,
            object: n.__id__,
            signal: u
          });
        }
      };
    }
    function w(l, _) {
      var f = n.__objectSignals__[l];
      f && f.forEach(function(u) {
        u.apply(u, _);
      });
    }
    this.propertyUpdate = function(l, _) {
      for (const u of Object.keys(_)) {
        var f = _[u];
        n.__propertyCache__[u] = this.unwrapQObject(f);
      }
      for (const u of Object.keys(l))
        w(u, l[u]);
    }, this.signalEmitted = function(l, _) {
      w(l, this.unwrapQObject(_));
    };
    function S(l) {
      var _ = l[0], f = l[1], u = _[_.length - 1] === ")" ? f : _;
      n[_] = function() {
        for (var h = [], j, M, U = 0; U < arguments.length; ++U) {
          var I = arguments[U];
          typeof I == "function" ? j = I : h.push(I);
        }
        var V;
        return !j && typeof Promise == "function" && (V = new Promise(function(P, L) {
          j = P, M = L;
        })), i.exec({
          type: t.invokeMethod,
          object: n.__id__,
          method: u,
          args: h
        }, function(P) {
          if (P !== void 0) {
            var L = n.unwrapQObject(P);
            j && j(L);
          } else M && M();
        }), V;
      };
    }
    function T(l) {
      var _ = l[0], f = l[1], u = l[2];
      n.__propertyCache__[_] = l[3], u && (u[0] === 1 && (u[0] = f + "Changed"), s(u, !0)), Object.defineProperty(n, f, {
        configurable: !0,
        get: function() {
          var h = n.__propertyCache__[_];
          return h === void 0 && console.warn('Undefined value in property cache for property "' + f + '" in object ' + n.__id__), h;
        },
        set: function(h) {
          if (h === void 0) {
            console.warn("Property setter for " + f + " called with undefined value!");
            return;
          }
          n.__propertyCache__[_] = h;
          var j = h;
          i.exec({
            type: t.setProperty,
            object: n.__id__,
            property: _,
            value: j
          });
        }
      });
    }
    c.methods.forEach(S), c.properties.forEach(T), c.signals.forEach(function(l) {
      s(l, !1);
    }), Object.assign(n, c.enums);
  }
  o.prototype.toJSON = function() {
    return this.__id__ === void 0 ? {} : {
      id: this.__id__,
      "__QObject*__": !0
    };
  }, e.exports = {
    QWebChannel: r
  };
})(D);
var oe = D.exports;
const b = {};
let C = {
  connected: !1,
  objects: []
}, R;
function ie() {
  return R || (R = (async () => {
    if (typeof window > "u" || !window.qt)
      return C = {
        connected: !1,
        reason: "no-qt-transport",
        objects: []
      }, C;
    try {
      await ne(
        () => new Promise((e) => {
          new oe.QWebChannel(window.qt.webChannelTransport, function(t) {
            Object.assign(b, t.objects), e();
          });
        }),
        { retries: 50, minTimeout: 10, maxTimeout: 10 }
      ), C = {
        connected: !0,
        objects: Object.keys(b)
      };
    } catch (e) {
      C = {
        connected: !1,
        reason: "retry-exhausted",
        objects: [],
        error: e?.message || String(e)
      }, console.error(
        `[AxonChannel] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${C.error}`
      );
    }
    return C;
  })(), R);
}
function ge() {
  return C.connected;
}
const p = [];
for (let e = 0; e < 256; ++e)
  p.push((e + 256).toString(16).slice(1));
function ae(e, t = 0) {
  return (p[e[t + 0]] + p[e[t + 1]] + p[e[t + 2]] + p[e[t + 3]] + "-" + p[e[t + 4]] + p[e[t + 5]] + "-" + p[e[t + 6]] + p[e[t + 7]] + "-" + p[e[t + 8]] + p[e[t + 9]] + "-" + p[e[t + 10]] + p[e[t + 11]] + p[e[t + 12]] + p[e[t + 13]] + p[e[t + 14]] + p[e[t + 15]]).toLowerCase();
}
let Q;
const ce = new Uint8Array(16);
function se() {
  if (!Q) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    Q = crypto.getRandomValues.bind(crypto);
  }
  return Q(ce);
}
const le = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), H = { randomUUID: le };
function ue(e, t, r) {
  e = e || {};
  const o = e.random ?? e.rng?.() ?? se();
  if (o.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return o[6] = o[6] & 15 | 64, o[8] = o[8] & 63 | 128, ae(o);
}
function fe(e, t, r) {
  return H.randomUUID && !e ? H.randomUUID() : ue(e);
}
const A = {}, O = [];
let N = !1;
function _e() {
  if (N) return;
  N = !0;
  const e = () => {
    if (N = !1, O.length === 0) return;
    const t = b.AxonJSCallHandler;
    if (!t) {
      O.length = 0;
      return;
    }
    const r = O.splice(0, O.length);
    r.length === 1 ? t.onCall(r[0]) : t.onCall({ batch: r });
  };
  typeof queueMicrotask == "function" ? queueMicrotask(e) : Promise.resolve().then(e);
}
const d = {
  async init() {
    const e = b.AxonJSCallHandler;
    try {
      e.returnReceiverSignal.disconnect(d.returnReceiver);
    } catch {
    }
    e.returnReceiverSignal.connect(d.returnReceiver);
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
    kwargs: o = {},
    timeout: a,
    type: c = "call"
  }) {
    return new Promise((i, n) => {
      const s = fe();
      if (a !== void 0) {
        let w;
        A[s] = {
          resolve: (S) => {
            clearTimeout(w), i(S);
          },
          reject: (S) => {
            clearTimeout(w), n(S);
          }
        }, w = setTimeout(
          () => d.returnReceiver([
            s,
            "reject",
            `Timeout Error, py not return in ${a}ms`
          ]),
          a
        );
      } else A[s] = { resolve: i, reject: n };
      if (!b.AxonJSCallHandler) {
        delete A[s], n("Axon 通道还没有连上，先 await AxonInit()");
        return;
      }
      O.push({
        call_id: s,
        web_name: b.AxonEnv.web_name,
        controller_id: e,
        prop: t,
        args: r,
        kwargs: o,
        type: c
      }), _e();
    });
  },
  call(e) {
    return d.__call__({ ...e, type: "call", prop: e.func });
  },
  setVar({
    controller_id: e,
    var_name: t,
    value: r,
    timeout: o
  }) {
    return d.__call__({
      controller_id: e,
      type: "set",
      args: [r],
      prop: t,
      timeout: o
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
    for (const t of e) d.returnReceiver(t);
  },
  returnReceiver([e, t, r]) {
    const o = A[e];
    o && (delete A[e], o[t](r));
  }
}, k = {}, x = function(e) {
  return (t) => {
    const r = e !== void 0 ? e : t.name;
    return k[r] = new t(), t;
  };
};
x.get = (e) => {
  const t = k[e];
  if (!t)
    throw `[AxonController Error] Controller "${e}" not found`;
  return t;
};
x.register = (e, t) => {
  k[e] = t;
};
x.unregister = (e) => {
  delete k[e];
};
const v = {
  async init() {
    const e = b.AxonPYCall;
    if (!e) throw new Error("[AxonPYCallHandler] AxonPYCall channel missing");
    try {
      e.onCallSignal.disconnect(v.onCall);
    } catch {
    }
    e.onCallSignal.connect(v.onCall);
    try {
      e.hasControllerSignal.disconnect(v.hasController);
    } catch {
    }
    e.hasControllerSignal.connect(v.hasController);
  },
  callback(e) {
    b.AxonPYCall.returnReceiver(e);
  },
  hasController({
    call_id: e,
    controller_id: t
  }) {
    try {
      x.get(t), v.callback({
        call_id: e,
        state: "resolve",
        data: !0
      });
    } catch {
      v.callback({
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
        t[e.prop] = e.args[0], v.callback({
          call_id: e.call_id,
          state: "resolve",
          data: null
        });
        return;
      }
      const r = t[e.prop];
      if (e.type === "get") {
        v.callback({
          call_id: e.call_id,
          state: "resolve",
          data: r
        });
        return;
      }
      const o = e.kwargs || {}, a = Object.keys(o).length ? [...e.args, o] : e.args, c = await r.apply(t, a);
      v.callback({
        call_id: e.call_id,
        state: "resolve",
        data: c
      });
    } catch (t) {
      v.callback({
        call_id: e.call_id,
        state: "reject",
        data: String(t)
      });
    }
  }
};
class he {
  name;
  value;
  store;
  constructor(t, r, o) {
    this.name = t, this.value = r, this.store = o;
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
      new de()
    );
  }
  constructor(t, r = !0) {
    if (m.AxonStoreMap.has(t)) return m.AxonStoreMap.get(t);
    this.id = t, this.controller_id = `__AxonStore_${this.id}__`, this.store = /* @__PURE__ */ new Map(), m.AxonStoreMap.set(t, this), x.register(this.controller_id, this), r && d.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "createStore",
      args: [this.id, b.AxonEnv.web_name]
    });
  }
  prop(t, r = void 0) {
    if (this.store.has(t)) return this.store.get(t);
    const o = new he(t, r, this);
    return this.store.set(t, o), o;
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
      args: [this.id, b.AxonEnv.web_name]
    });
  }
  _release() {
    m.AxonStoreMap.delete(this.id), x.unregister(this.controller_id);
  }
}
class de {
  createStore(t) {
    return new m(t);
  }
  deleteStore(t) {
    const r = m.AxonStoreMap.get(t);
    r && r._release();
  }
}
function F(e) {
  return e.length === 0 ? { args: [] } : Array.isArray(e[0]) && e.length > 1 ? {
    args: e[0],
    kwargs: e[1],
    timeout: e[2]
  } : { args: e };
}
const ve = new Proxy(
  {},
  {
    get(e, t) {
      return new Proxy(
        {},
        {
          get(r, o) {
            const a = (...n) => d.call({
              controller_id: t,
              func: o,
              ...F(n)
            });
            let c;
            const i = () => (c || (c = d.getVar({
              controller_id: t,
              var_name: o
            })), c);
            return a.then = function(n, s) {
              return i().then(n, s);
            }, a.catch = function(n) {
              return i().catch(n);
            }, a.finally = function(n) {
              return i().finally(n);
            }, a;
          },
          set(r, o, a) {
            return d.setVar({
              controller_id: t,
              var_name: o,
              value: a
            }), !0;
          }
        }
      );
    }
  }
), pe = "AxonCrossCallHandler";
function E(e, t) {
  return d.call({
    controller_id: pe,
    func: "onCall",
    args: [e],
    timeout: t
  });
}
const W = {
  /** 现在还活着的窗口名。 */
  windows() {
    return E({ action: "windows" });
  },
  /** 这个窗口还在不在。 */
  async has(e) {
    return (await W.windows()).includes(e);
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
              get(o, a) {
                return (...c) => E({
                  action: "call",
                  web_name: e,
                  controller_id: r,
                  func: a,
                  ...F(c)
                });
              }
            }
          );
        }
      }
    );
  },
  /** 调另一个窗口里的一个方法，参数/超时写法同 `Axon`。 */
  call({ web: e, controller: t, func: r, args: o = [], kwargs: a, timeout: c }) {
    return E(
      {
        action: "call",
        web_name: e,
        controller_id: t,
        func: r,
        args: o,
        kwargs: a,
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
    kwargs: o,
    timeout: a,
    exclude: c
  }) {
    return E(
      {
        action: "broadcast",
        controller_id: e,
        func: t,
        args: r,
        kwargs: o,
        timeout: a,
        exclude: c
      },
      a
    );
  },
  /** 发一个事件给所有窗口（对方用 `AxonEvent.addListener(type, fn)` 接）。 */
  emit(e, ...t) {
    return E({ action: "emit", type: e, args: t });
  },
  /** 发一个事件给指定窗口。 */
  emitTo(e, t, ...r) {
    return E({
      action: "call",
      web_name: e,
      controller_id: "AxonEvent",
      func: "dispatchEvent",
      args: [t, ...r]
    });
  }
}, be = W, y = new class {
  __listeners;
  __onceEventListenerMap;
  constructor() {
    this.__listeners = {}, this.__onceEventListenerMap = {};
  }
  on = this.addListener;
  off = this.removeListener;
  addListener(e, t, r) {
    let o = t;
    if (y.__listeners[e] ||= /* @__PURE__ */ new Set(), y.__onceEventListenerMap[e] ||= /* @__PURE__ */ new Map(), !y.__listeners[e].has(t) && !y.__onceEventListenerMap[e].has(t)) {
      if (r?.once) {
        const a = t;
        o = (...c) => {
          y.removeListener(e, a), a(...c);
        }, y.__onceEventListenerMap[e].set(a, o);
      }
      y.__listeners[e].add(o);
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
      } catch (o) {
        console.error(`事件监听器执行异常 - 事件类型: ${e}`, o);
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
async function we() {
  const e = await ie(), t = {
    connected: e.connected,
    ready: !1,
    reason: e.reason,
    objects: e.objects,
    error: e.error
  };
  return e.connected ? (await v.init(), await d.init(), await m.init(), await ye(), { ...t, ready: !0 }) : t;
}
async function ye() {
  const e = b.AxonEnv;
  if (!(!e || typeof e.ready != "function"))
    try {
      await e.ready();
    } catch (t) {
      console.warn("[AxonInit] 通知 Python 前端就绪失败:", t);
    }
}
function xe() {
  return C.connected && !!me();
}
function me() {
  const e = C.objects;
  return e.includes("AxonEnv") && e.includes("AxonJSCallHandler") && e.includes("AxonPYCall");
}
export {
  ve as Axon,
  d as AxonCall,
  C as AxonChannelStatus,
  b as AxonChannels,
  x as AxonController,
  be as AxonCross,
  y as AxonEvent,
  we as AxonInit,
  m as AxonStore,
  ie as initChannels,
  ge as isAxonConnected,
  xe as isAxonReady
};
