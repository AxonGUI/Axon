function D(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
function Q(e, t) {
  for (const r in t)
    Object.defineProperty(e, r, {
      value: t[r],
      enumerable: !0,
      configurable: !0
    });
  return e;
}
function F(e, t, r) {
  if (!e || typeof e == "string")
    throw new TypeError("Please pass an Error to err-code");
  r || (r = {}), typeof t == "object" && (r = t, t = void 0), t != null && (r.code = t);
  try {
    return Q(e, r);
  } catch {
    r.message = e.message, r.stack = e.stack;
    const a = function() {
    };
    return a.prototype = Object.create(Object.getPrototypeOf(e)), Q(new a(), r);
  }
}
var H = F, J = {};
function g(e, t) {
  typeof t == "boolean" && (t = { forever: t }), this._originalTimeouts = JSON.parse(JSON.stringify(e)), this._timeouts = e, this._options = t || {}, this._maxRetryTime = t && t.maxRetryTime || 1 / 0, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
}
var W = g;
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
    var a = this._errors[o], u = a.message, i = (e[u] || 0) + 1;
    e[u] = i, i >= r && (t = a, r = i);
  }
  return t;
};
(function(e) {
  var t = W;
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
    for (var u = [], i = 0; i < o.retries; i++)
      u.push(this.createTimeout(i, o));
    return r && r.forever && !u.length && u.push(this.createTimeout(i, o)), u.sort(function(n, s) {
      return n - s;
    }), u;
  }, e.createTimeout = function(r, o) {
    var a = o.randomize ? Math.random() + 1 : 1, u = Math.round(a * o.minTimeout * Math.pow(o.factor, r));
    return u = Math.min(u, o.maxTimeout), u;
  }, e.wrap = function(r, o, a) {
    if (o instanceof Array && (a = o, o = null), !a) {
      a = [];
      for (var u in r)
        typeof r[u] == "function" && a.push(u);
    }
    for (var i = 0; i < a.length; i++) {
      var n = a[i], s = r[n];
      r[n] = function(C) {
        var E = e.operation(o), c = Array.prototype.slice.call(arguments, 1), _ = c.pop();
        c.push(function(f) {
          E.retry(f) || (f && (arguments[0] = E.mainError()), _.apply(this, arguments));
        }), E.attempt(function() {
          C.apply(r, c);
        });
      }.bind(r, s), r[n].options = o;
    }
  };
})(J);
var q = J, G = H, $ = q, z = Object.prototype.hasOwnProperty;
function N(e) {
  return e && e.code === "EPROMISERETRY" && z.call(e, "retried");
}
function B(e, t) {
  var r, o;
  return typeof e == "object" && typeof t == "function" && (r = t, t = e, e = r), o = $.operation(t), new Promise(function(a, u) {
    o.attempt(function(i) {
      Promise.resolve().then(function() {
        return e(function(n) {
          throw N(n) && (n = n.retried), G(new Error("Retrying"), "EPROMISERETRY", { retried: n });
        }, i);
      }).then(a, function(n) {
        N(n) && (n = n.retried, o.retry(n || new Error())) || u(n);
      });
    });
  });
}
var X = B;
const K = /* @__PURE__ */ D(X);
var Y = { exports: {} };
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
  }, r = function(a, u) {
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
        var b = i.objects[s.object];
        b ? b.propertyUpdate(s.signals, s.properties) : console.warn("Unhandled property update: " + s.object + "::" + s.signal);
      }), i.exec({ type: t.idle });
    }, this.debug = function(n) {
      i.send({ type: t.debug, data: n });
    }, i.exec({ type: t.init }, function(n) {
      for (const s of Object.keys(n))
        new o(s, n[s], i);
      for (const s of Object.keys(i.objects))
        i.objects[s].unwrapProperties();
      u && u(i), i.exec({ type: t.idle });
    });
  };
  function o(a, u, i) {
    this.__id__ = a, i.objects[a] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {};
    var n = this;
    this.unwrapQObject = function(c) {
      if (c instanceof Array)
        return c.map((h) => n.unwrapQObject(h));
      if (!(c instanceof Object))
        return c;
      if (!c["__QObject*__"] || c.id === void 0) {
        var _ = {};
        for (const h of Object.keys(c))
          _[h] = n.unwrapQObject(c[h]);
        return _;
      }
      var f = c.id;
      if (i.objects[f])
        return i.objects[f];
      if (!c.data) {
        console.error("Cannot unwrap unknown QObject " + f + " without data.");
        return;
      }
      var l = new o(f, c.data, i);
      return l.destroyed.connect(function() {
        i.objects[f] === l && (delete i.objects[f], Object.keys(l).forEach((h) => delete l[h]));
      }), l.unwrapProperties(), l;
    }, this.unwrapProperties = function() {
      for (const c of Object.keys(n.__propertyCache__))
        n.__propertyCache__[c] = n.unwrapQObject(n.__propertyCache__[c]);
    };
    function s(c, _) {
      var f = c[0], l = c[1];
      n[f] = {
        connect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to connect to signal " + f);
            return;
          }
          n.__objectSignals__[l] = n.__objectSignals__[l] || [], n.__objectSignals__[l].push(h), !_ && (f === "destroyed" || f === "destroyed()" || f === "destroyed(QObject*)" || n.__objectSignals__[l].length == 1 && i.exec({
            type: t.connectToSignal,
            object: n.__id__,
            signal: l
          }));
        },
        disconnect: function(h) {
          if (typeof h != "function") {
            console.error("Bad callback given to disconnect from signal " + f);
            return;
          }
          n.__objectSignals__[l] = (n.__objectSignals__[l] || []).filter(function(j) {
            return j != h;
          }), !_ && n.__objectSignals__[l].length === 0 && i.exec({
            type: t.disconnectFromSignal,
            object: n.__id__,
            signal: l
          });
        }
      };
    }
    function b(c, _) {
      var f = n.__objectSignals__[c];
      f && f.forEach(function(l) {
        l.apply(l, _);
      });
    }
    this.propertyUpdate = function(c, _) {
      for (const l of Object.keys(_)) {
        var f = _[l];
        n.__propertyCache__[l] = this.unwrapQObject(f);
      }
      for (const l of Object.keys(c))
        b(l, c[l]);
    }, this.signalEmitted = function(c, _) {
      b(c, this.unwrapQObject(_));
    };
    function C(c) {
      var _ = c[0], f = c[1], l = _[_.length - 1] === ")" ? f : _;
      n[_] = function() {
        for (var h = [], j, k, R = 0; R < arguments.length; ++R) {
          var M = arguments[R];
          typeof M == "function" ? j = M : h.push(M);
        }
        var L;
        return !j && typeof Promise == "function" && (L = new Promise(function(T, U) {
          j = T, k = U;
        })), i.exec({
          type: t.invokeMethod,
          object: n.__id__,
          method: l,
          args: h
        }, function(T) {
          if (T !== void 0) {
            var U = n.unwrapQObject(T);
            j && j(U);
          } else k && k();
        }), L;
      };
    }
    function E(c) {
      var _ = c[0], f = c[1], l = c[2];
      n.__propertyCache__[_] = c[3], l && (l[0] === 1 && (l[0] = f + "Changed"), s(l, !0)), Object.defineProperty(n, f, {
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
    u.methods.forEach(C), u.properties.forEach(E), u.signals.forEach(function(c) {
      s(c, !1);
    }), Object.assign(n, u.enums);
  }
  o.prototype.toJSON = function() {
    return this.__id__ === void 0 ? {} : {
      id: this.__id__,
      "__QObject*__": !0
    };
  }, e.exports = {
    QWebChannel: r
  };
})(Y);
var Z = Y.exports;
const x = {};
let S = {
  connected: !1,
  objects: []
}, O;
function ee() {
  return O || (O = (async () => {
    if (typeof window > "u" || !window.qt)
      return S = {
        connected: !1,
        reason: "no-qt-transport",
        objects: []
      }, S;
    try {
      await K(
        () => new Promise((e) => {
          new Z.QWebChannel(window.qt.webChannelTransport, function(t) {
            Object.assign(x, t.objects), e();
          });
        }),
        { retries: 50, minTimeout: 10, maxTimeout: 10 }
      ), S = {
        connected: !0,
        objects: Object.keys(x)
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
  })(), O);
}
function _e() {
  return S.connected;
}
const d = [];
for (let e = 0; e < 256; ++e)
  d.push((e + 256).toString(16).slice(1));
function te(e, t = 0) {
  return (d[e[t + 0]] + d[e[t + 1]] + d[e[t + 2]] + d[e[t + 3]] + "-" + d[e[t + 4]] + d[e[t + 5]] + "-" + d[e[t + 6]] + d[e[t + 7]] + "-" + d[e[t + 8]] + d[e[t + 9]] + "-" + d[e[t + 10]] + d[e[t + 11]] + d[e[t + 12]] + d[e[t + 13]] + d[e[t + 14]] + d[e[t + 15]]).toLowerCase();
}
let I;
const re = new Uint8Array(16);
function ne() {
  if (!I) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    I = crypto.getRandomValues.bind(crypto);
  }
  return I(re);
}
const oe = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), V = { randomUUID: oe };
function ie(e, t, r) {
  e = e || {};
  const o = e.random ?? e.rng?.() ?? ne();
  if (o.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return o[6] = o[6] & 15 | 64, o[8] = o[8] & 63 | 128, te(o);
}
function ae(e, t, r) {
  return V.randomUUID && !e ? V.randomUUID() : ie(e);
}
const P = {}, y = {
  async init() {
    const e = x.AxonJSCallHandler;
    try {
      e.returnReceiverSignal.disconnect(y.returnReceiver);
    } catch {
    }
    e.returnReceiverSignal.connect(y.returnReceiver);
  },
  __call__({
    controller_id: e,
    prop: t,
    args: r = [],
    kwargs: o = {},
    timeout: a,
    type: u = "call"
  }) {
    return new Promise((i, n) => {
      const s = ae();
      if (a !== void 0) {
        let b;
        P[s] = {
          resolve: (C) => {
            clearTimeout(b), i(C);
          },
          reject: (C) => {
            clearTimeout(b), n(C);
          }
        }, b = setTimeout(
          () => y.returnReceiver([
            s,
            "reject",
            `Timeout Error, py not return in ${a}ms`
          ]),
          a
        );
      } else P[s] = { resolve: i, reject: n };
      x.AxonJSCallHandler.onCall({
        call_id: s,
        web_name: x.AxonEnv.web_name,
        controller_id: e,
        prop: t,
        args: r,
        kwargs: o,
        type: u
      });
    });
  },
  call(e) {
    return y.__call__({ ...e, type: "call", prop: e.func });
  },
  setVar({
    controller_id: e,
    var_name: t,
    value: r,
    timeout: o
  }) {
    return y.__call__({
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
    return y.__call__({
      controller_id: e,
      type: "get",
      prop: t,
      timeout: r
    });
  },
  crossCall(e) {
    const { timeout: t, ...r } = e;
    return y.call({
      controller_id: "AxonCrossCallHandler",
      func: "onCall",
      args: [r],
      timeout: t
    });
  },
  returnReceiver([e, t, r]) {
    const o = P[e];
    o && (delete P[e], o[t](r));
  }
}, A = {}, w = function(e) {
  return (t) => {
    const r = e !== void 0 ? e : t.name;
    return A[r] = new t(), t;
  };
};
w.get = (e) => {
  const t = A[e];
  if (!t)
    throw `[AxonController Error] Controller "${e}" not found`;
  return t;
};
w.register = (e, t) => {
  A[e] = t;
};
w.unregister = (e) => {
  delete A[e];
};
const v = {
  async init() {
    const e = x.AxonPYCall;
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
    x.AxonPYCall.returnReceiver(e);
  },
  hasController({
    call_id: e,
    controller_id: t
  }) {
    try {
      w.get(t), v.callback({
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
      const t = w.get(e.controller_id);
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
      const o = e.kwargs || {}, a = Object.keys(o).length ? [...e.args, o] : e.args, u = await r.apply(t, a);
      v.callback({
        call_id: e.call_id,
        state: "resolve",
        data: u
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
class se {
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
    this.value !== t && (this.value = t, y.call({
      controller_id: this.store.controller_id,
      func: "setFromPeer",
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
    m.shared = new m("__shared__"), w.register(m.shared.id, m.shared), w.register(
      "JSAxonStoreSyncManager",
      new ce()
    );
  }
  constructor(t, r = !0) {
    if (m.AxonStoreMap.has(t)) return m.AxonStoreMap.get(t);
    this.id = t, this.controller_id = `__AxonStore_${this.id}__`, this.store = /* @__PURE__ */ new Map(), m.AxonStoreMap.set(t, this), w.register(this.controller_id, this), r && y.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "createStore",
      args: [this.id, x.AxonEnv.web_name]
    });
  }
  prop(t, r = void 0) {
    if (this.store.has(t)) return this.store.get(t);
    const o = new se(t, r, this);
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
    this._release(), y.call({
      controller_id: "PYAxonStoreSyncManager",
      func: "deleteStore",
      args: [this.id, x.AxonEnv.web_name]
    });
  }
  _release() {
    m.AxonStoreMap.delete(this.id), w.unregister(this.controller_id);
  }
}
class ce {
  createStore(t) {
    return new m(t);
  }
  deleteStore(t) {
    const r = m.AxonStoreMap.get(t);
    r && r._release();
  }
}
function ue(e) {
  return e.length === 0 ? { args: [] } : Array.isArray(e[0]) && e.length > 1 ? {
    args: e[0],
    kwargs: e[1],
    timeout: e[2]
  } : { args: e };
}
const he = new Proxy(
  {},
  {
    get(e, t) {
      return new Proxy(
        {},
        {
          get(r, o) {
            const a = (...n) => y.call({
              controller_id: t,
              func: o,
              ...ue(n)
            });
            let u;
            const i = () => (u || (u = y.getVar({
              controller_id: t,
              var_name: o
            })), u);
            return a.then = function(n, s) {
              return i().then(n, s);
            }, a.catch = function(n) {
              return i().catch(n);
            }, a.finally = function(n) {
              return i().finally(n);
            }, a;
          },
          set(r, o, a) {
            return y.setVar({
              controller_id: t,
              var_name: o,
              value: a
            }), !0;
          }
        }
      );
    }
  }
), p = new class {
  __listeners;
  __onceEventListenerMap;
  constructor() {
    this.__listeners = {}, this.__onceEventListenerMap = {};
  }
  on = this.addListener;
  off = this.removeListener;
  addListener(e, t, r) {
    if (p.__listeners[e] ||= /* @__PURE__ */ new Set(), p.__onceEventListenerMap[e] ||= /* @__PURE__ */ new Map(), !p.__listeners[e].has(t) && !p.__onceEventListenerMap[e].has(t)) {
      if (r?.once) {
        const o = t;
        t = (...a) => {
          p.removeListener(e, o), o(...a);
        }, p.__onceEventListenerMap[e].set(o, t);
      }
      p.__listeners[e].add(t);
    }
  }
  removeListener(e, t) {
    if (!p.__listeners[e] || !p.__onceEventListenerMap[e])
      return;
    const r = p.__onceEventListenerMap[e].get(t);
    if (r) {
      p.__onceEventListenerMap[e].delete(t), p.__listeners[e].delete(r);
      return;
    }
    p.__listeners[e].delete(t);
  }
  removeAllListeners(e) {
    p.__listeners[e]?.clear(), p.__onceEventListenerMap[e]?.clear();
  }
  dispatchEvent(e, ...t) {
    p.__listeners[e]?.forEach((r) => {
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
    return y.call({
      controller_id: "AxonEvent",
      func: "dispatch_event",
      args: [e, ...t],
      kwargs: r
    });
  }
}();
w.register("AxonEvent", p);
async function de() {
  const e = await ee(), t = {
    connected: e.connected,
    ready: !1,
    reason: e.reason,
    objects: e.objects,
    error: e.error
  };
  return e.connected ? (await v.init(), await y.init(), await m.init(), await le(), { ...t, ready: !0 }) : t;
}
async function le() {
  const e = x.AxonEnv;
  if (!(!e || typeof e.ready != "function"))
    try {
      await e.ready();
    } catch (t) {
      console.warn("[AxonInit] 通知 Python 前端就绪失败:", t);
    }
}
function pe() {
  return S.connected && !!fe();
}
function fe() {
  const e = S.objects;
  return e.includes("AxonEnv") && e.includes("AxonJSCallHandler") && e.includes("AxonPYCall");
}
export {
  he as Axon,
  y as AxonCall,
  S as AxonChannelStatus,
  x as AxonChannels,
  w as AxonController,
  p as AxonEvent,
  de as AxonInit,
  m as AxonStore,
  ee as initChannels,
  _e as isAxonConnected,
  pe as isAxonReady
};
