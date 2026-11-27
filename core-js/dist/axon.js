// \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t, t.exports), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (let c of r(i)) !a.call(e, c) && c !== o && (s = n(i, c), t(e, c, {
		get: s && s.get && !s.configurable ? s.get : () => i[c],
		enumerable: !s || s.enumerable
	}));
	return e;
}, c = (n, r, o) => (o = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule || !a.call(n, "default") ? t(o, "default", {
	value: n,
	enumerable: !0
}) : o, n)), l = /* @__PURE__ */ o(((e, t) => {
	function n(e, t) {
		for (let n in t) Object.defineProperty(e, n, {
			value: t[n],
			enumerable: !0,
			configurable: !0
		});
		return e;
	}
	t.exports = function(e, t, r) {
		if (!e || typeof e == "string") throw TypeError("Please pass an Error to err-code");
		r ||= {}, typeof t == "object" && (r = t, t = void 0), t != null && (r.code = t);
		try {
			return n(e, r);
		} catch {
			r.message = e.message, r.stack = e.stack;
			let t = function() {};
			return t.prototype = Object.create(Object.getPrototypeOf(e)), n(new t(), r);
		}
	};
})), u = /* @__PURE__ */ o(((e, t) => {
	function n(e, t) {
		typeof t == "boolean" && (t = { forever: t }), this._originalTimeouts = JSON.parse(JSON.stringify(e)), this._timeouts = e, this._options = t || {}, this._maxRetryTime = t && t.maxRetryTime || 1e400, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
	}
	t.exports = n, n.prototype.reset = function() {
		this._attempts = 1, this._timeouts = this._originalTimeouts;
	}, n.prototype.stop = function() {
		this._timeout && clearTimeout(this._timeout), this._timeouts = [], this._cachedTimeouts = null;
	}, n.prototype.retry = function(e) {
		if (this._timeout && clearTimeout(this._timeout), !e) return !1;
		var t = (/* @__PURE__ */ new Date()).getTime();
		if (e && t - this._operationStart >= this._maxRetryTime) return this._errors.unshift(/* @__PURE__ */ Error("RetryOperation timeout occurred")), !1;
		this._errors.push(e);
		var n = this._timeouts.shift();
		if (n === void 0) {
			if (this._cachedTimeouts) this._errors.splice(this._errors.length - 1, this._errors.length), this._timeouts = this._cachedTimeouts.slice(0), n = this._timeouts.shift();
			else return !1;
		}
		var r = this, i = setTimeout(function() {
			r._attempts++, r._operationTimeoutCb && (r._timeout = setTimeout(function() {
				r._operationTimeoutCb(r._attempts);
			}, r._operationTimeout), r._options.unref && r._timeout.unref()), r._fn(r._attempts);
		}, n);
		return this._options.unref && i.unref(), !0;
	}, n.prototype.attempt = function(e, t) {
		this._fn = e, t && (t.timeout && (this._operationTimeout = t.timeout), t.cb && (this._operationTimeoutCb = t.cb));
		var n = this;
		this._operationTimeoutCb && (this._timeout = setTimeout(function() {
			n._operationTimeoutCb();
		}, n._operationTimeout)), this._operationStart = (/* @__PURE__ */ new Date()).getTime(), this._fn(this._attempts);
	}, n.prototype.try = function(e) {
		console.log("Using RetryOperation.try() is deprecated"), this.attempt(e);
	}, n.prototype.start = function(e) {
		console.log("Using RetryOperation.start() is deprecated"), this.attempt(e);
	}, n.prototype.start = n.prototype.try, n.prototype.errors = function() {
		return this._errors;
	}, n.prototype.attempts = function() {
		return this._attempts;
	}, n.prototype.mainError = function() {
		if (this._errors.length === 0) return null;
		for (var e = {}, t = null, n = 0, r = 0; r < this._errors.length; r++) {
			var i = this._errors[r], a = i.message, o = (e[a] || 0) + 1;
			e[a] = o, o >= n && (t = i, n = o);
		}
		return t;
	};
})), d = /* @__PURE__ */ o(((e) => {
	var t = u();
	e.operation = function(n) {
		return new t(e.timeouts(n), {
			forever: n && n.forever,
			unref: n && n.unref,
			maxRetryTime: n && n.maxRetryTime
		});
	}, e.timeouts = function(e) {
		if (e instanceof Array) return [].concat(e);
		var t = {
			retries: 10,
			factor: 2,
			minTimeout: 1e3,
			maxTimeout: 1e400,
			randomize: !1
		};
		for (var n in e) t[n] = e[n];
		if (t.minTimeout > t.maxTimeout) throw Error("minTimeout is greater than maxTimeout");
		for (var r = [], i = 0; i < t.retries; i++) r.push(this.createTimeout(i, t));
		return e && e.forever && !r.length && r.push(this.createTimeout(i, t)), r.sort(function(e, t) {
			return e - t;
		}), r;
	}, e.createTimeout = function(e, t) {
		var n = t.randomize ? Math.random() + 1 : 1, r = Math.round(n * t.minTimeout * t.factor ** +e);
		return r = Math.min(r, t.maxTimeout), r;
	}, e.wrap = function(t, n, r) {
		if (n instanceof Array && (r = n, n = null), !r) for (var i in r = [], t) typeof t[i] == "function" && r.push(i);
		for (var a = 0; a < r.length; a++) {
			var o = r[a], s = t[o];
			t[o] = function(r) {
				var i = e.operation(n), a = Array.prototype.slice.call(arguments, 1), o = a.pop();
				a.push(function(e) {
					i.retry(e) || (e && (arguments[0] = i.mainError()), o.apply(this, arguments));
				}), i.attempt(function() {
					r.apply(t, a);
				});
			}.bind(t, s), t[o].options = n;
		}
	};
})), ee = /* @__PURE__ */ o(((e, t) => {
	t.exports = d();
})), f = /* @__PURE__ */ o(((e, t) => {
	var n = l(), r = ee(), i = Object.prototype.hasOwnProperty;
	function a(e) {
		return e && e.code === "EPROMISERETRY" && i.call(e, "retried");
	}
	t.exports = function(e, t) {
		var i, o;
		return typeof e == "object" && typeof t == "function" && (i = t, t = e, e = i), o = r.operation(t), new Promise(function(t, r) {
			o.attempt(function(i) {
				Promise.resolve().then(function() {
					return e(function(e) {
						throw a(e) && (e = e.retried), n(/* @__PURE__ */ Error("Retrying"), "EPROMISERETRY", { retried: e });
					}, i);
				}).then(t, function(e) {
					a(e) && (e = e.retried, o.retry(e || /* @__PURE__ */ Error())) || r(e);
				});
			});
		});
	};
})), p = /* @__PURE__ */ o(((e, t) => {
	var n = {
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
	}, r = function(e, t) {
		if (typeof e != "object" || typeof e.send != "function") console.error("The QWebChannel expects a transport object with a send function and onmessage callback property. Given is: transport: " + typeof e + ", transport.send: " + typeof e.send);
		else {
			var r = this;
			this.transport = e, this.send = function(e) {
				typeof e != "string" && (e = JSON.stringify(e)), r.transport.send(e);
			}, this.transport.onmessage = function(e) {
				var t = e.data;
				switch (typeof t == "string" && (t = JSON.parse(t)), t.type) {
					case n.signal:
						r.handleSignal(t);
						break;
					case n.response:
						r.handleResponse(t);
						break;
					case n.propertyUpdate:
						r.handlePropertyUpdate(t);
						break;
					default: console.error("invalid message received:", e.data);
				}
			}, this.execCallbacks = {}, this.execId = 0, this.exec = function(e, t) {
				t ? (r.execId === Number.MAX_VALUE && (r.execId = Number.MIN_VALUE), e.hasOwnProperty("id") ? console.error("Cannot exec message with property id: " + JSON.stringify(e)) : (e.id = r.execId++, r.execCallbacks[e.id] = t, r.send(e))) : r.send(e);
			}, this.objects = {}, this.handleSignal = function(e) {
				var t = r.objects[e.object];
				t ? t.signalEmitted(e.signal, e.args) : console.warn("Unhandled signal: " + e.object + "::" + e.signal);
			}, this.handleResponse = function(e) {
				e.hasOwnProperty("id") ? (r.execCallbacks[e.id](e.data), delete r.execCallbacks[e.id]) : console.error("Invalid response message received: ", JSON.stringify(e));
			}, this.handlePropertyUpdate = function(e) {
				e.data.forEach((e) => {
					var t = r.objects[e.object];
					t ? t.propertyUpdate(e.signals, e.properties) : console.warn("Unhandled property update: " + e.object + "::" + e.signal);
				}), r.exec({ type: n.idle });
			}, this.debug = function(e) {
				r.send({
					type: n.debug,
					data: e
				});
			}, r.exec({ type: n.init }, function(e) {
				for (let t of Object.keys(e)) new i(t, e[t], r);
				for (let e of Object.keys(r.objects)) r.objects[e].unwrapProperties();
				t && t(r), r.exec({ type: n.idle });
			});
		}
	};
	function i(e, t, r) {
		this.__id__ = e, r.objects[e] = this, this.__objectSignals__ = {}, this.__propertyCache__ = {};
		var a = this;
		this.unwrapQObject = function(e) {
			if (e instanceof Array) return e.map((e) => a.unwrapQObject(e));
			if (!(e instanceof Object)) return e;
			if (!e["__QObject*__"] || e.id === void 0) {
				var t = {};
				for (let n of Object.keys(e)) t[n] = a.unwrapQObject(e[n]);
				return t;
			}
			var n = e.id;
			if (r.objects[n]) return r.objects[n];
			if (!e.data) console.error("Cannot unwrap unknown QObject " + n + " without data.");
			else {
				var o = new i(n, e.data, r);
				return o.destroyed.connect(function() {
					r.objects[n] === o && (delete r.objects[n], Object.keys(o).forEach((e) => delete o[e]));
				}), o.unwrapProperties(), o;
			}
		}, this.unwrapProperties = function() {
			for (let e of Object.keys(a.__propertyCache__)) a.__propertyCache__[e] = a.unwrapQObject(a.__propertyCache__[e]);
		};
		function o(e, t) {
			var i = e[0], o = e[1];
			a[i] = {
				connect: function(e) {
					typeof e == "function" ? (a.__objectSignals__[o] = a.__objectSignals__[o] || [], a.__objectSignals__[o].push(e), t || i !== "destroyed" && i !== "destroyed()" && i !== "destroyed(QObject*)" && a.__objectSignals__[o].length == 1 && r.exec({
						type: n.connectToSignal,
						object: a.__id__,
						signal: o
					})) : console.error("Bad callback given to connect to signal " + i);
				},
				disconnect: function(e) {
					typeof e == "function" ? (a.__objectSignals__[o] = (a.__objectSignals__[o] || []).filter(function(t) {
						return t != e;
					}), !t && a.__objectSignals__[o].length === 0 && r.exec({
						type: n.disconnectFromSignal,
						object: a.__id__,
						signal: o
					})) : console.error("Bad callback given to disconnect from signal " + i);
				}
			};
		}
		function s(e, t) {
			var n = a.__objectSignals__[e];
			n && n.forEach(function(e) {
				e.apply(e, t);
			});
		}
		this.propertyUpdate = function(e, t) {
			for (let e of Object.keys(t)) {
				var n = t[e];
				a.__propertyCache__[e] = this.unwrapQObject(n);
			}
			for (let t of Object.keys(e)) s(t, e[t]);
		}, this.signalEmitted = function(e, t) {
			s(e, this.unwrapQObject(t));
		};
		function c(e) {
			var t = e[0], i = e[1], o = t[t.length - 1] === ")" ? i : t;
			a[t] = function() {
				for (var e = [], t, i, s = 0; s < arguments.length; ++s) {
					var c = arguments[s];
					typeof c == "function" ? t = c : e.push(c);
				}
				var l;
				return !t && typeof Promise == "function" && (l = new Promise(function(e, n) {
					t = e, i = n;
				})), r.exec({
					type: n.invokeMethod,
					object: a.__id__,
					method: o,
					args: e
				}, function(e) {
					if (e !== void 0) {
						var n = a.unwrapQObject(e);
						t && t(n);
					} else i && i();
				}), l;
			};
		}
		function l(e) {
			var t = e[0], i = e[1], s = e[2];
			a.__propertyCache__[t] = e[3], s && (s[0] === 1 && (s[0] = i + "Changed"), o(s, !0)), Object.defineProperty(a, i, {
				configurable: !0,
				get: function() {
					var e = a.__propertyCache__[t];
					return e === void 0 && console.warn("Undefined value in property cache for property \"" + i + "\" in object " + a.__id__), e;
				},
				set: function(e) {
					if (e === void 0) console.warn("Property setter for " + i + " called with undefined value!");
					else {
						a.__propertyCache__[t] = e;
						var o = e;
						r.exec({
							type: n.setProperty,
							object: a.__id__,
							property: t,
							value: o
						});
					}
				}
			});
		}
		t.methods.forEach(c), t.properties.forEach(l), t.signals.forEach(function(e) {
			o(e, !1);
		}), Object.assign(a, t.enums);
	}
	i.prototype.toJSON = function() {
		return this.__id__ === void 0 ? {} : {
			id: this.__id__,
			"__QObject*__": !0
		};
	}, typeof t == "object" && (t.exports = { QWebChannel: r });
})), m = /* @__PURE__ */ c(f(), 1), h = p(), g = {}, _ = {
	connected: !1,
	objects: []
}, v;
function y() {
	return v || (v = (async () => {
		if (typeof window > "u" || !window.qt) return _ = {
			connected: !1,
			reason: "no-qt-transport",
			objects: []
		}, _;
		try {
			await (0, m.default)(() => new Promise((e) => {
				new h.QWebChannel(window.qt.webChannelTransport, function(t) {
					Object.assign(g, t.objects), e();
				});
			}), {
				retries: 50,
				minTimeout: 10,
				maxTimeout: 10
			}), _ = {
				connected: !0,
				objects: Object.keys(g)
			};
		} catch (e) {
			_ = {
				connected: !1,
				reason: "retry-exhausted",
				objects: [],
				error: e?.message || String(e)
			}, console.error(`[AxonChannel] QWebChannel 初始化彻底失败。 - 重试次数: 50 - 错误信息: ${_.error}`);
		}
		return _;
	})(), v);
}
function te() {
	return _.connected;
}
// node_modules/uuid/dist/stringify.js
var b = [];
for (let e = 0; e < 256; ++e) b.push((e + 256).toString(16).slice(1));
function ne(e, t = 0) {
	return (b[e[t + 0]] + b[e[t + 1]] + b[e[t + 2]] + b[e[t + 3]] + "-" + b[e[t + 4]] + b[e[t + 5]] + "-" + b[e[t + 6]] + b[e[t + 7]] + "-" + b[e[t + 8]] + b[e[t + 9]] + "-" + b[e[t + 10]] + b[e[t + 11]] + b[e[t + 12]] + b[e[t + 13]] + b[e[t + 14]] + b[e[t + 15]]).toLowerCase();
}
// node_modules/uuid/dist/rng.js
var x = /* @__PURE__ */ new Uint8Array(16);
function S() {
	return crypto.getRandomValues(x);
}
// node_modules/uuid/dist/v4.js
function C(e, t, n) {
	return !t && !e && crypto.randomUUID ? crypto.randomUUID() : w(e, t, n);
}
function w(e, t, n) {
	e ||= {};
	let r = e.random ?? e.rng?.() ?? S();
	if (r.length < 16) throw Error("Random bytes length must be >= 16");
	if (r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, t) {
		if (n ||= 0, n < 0 || n + 16 > t.length) throw RangeError(`UUID byte range ${n}:${n + 15} is out of buffer bounds`);
		for (let e = 0; e < 16; ++e) t[n + e] = r[e];
		return t;
	}
	return ne(r);
}
// lib/AxonError.ts
var T = class extends Error {
	code;
	constructor(e, t = {}) {
		super(e), this.name = t.name ?? "AxonError", this.code = t.code ?? "AXON", t.cause !== void 0 && (this.cause = t.cause);
	}
}, E = class extends T {
	constructor(e = "Python 没有在给定时间内返回") {
		super(e, {
			code: "TIMEOUT",
			name: "AxonTimeoutError"
		});
	}
}, D = class extends T {
	constructor(e = "Axon 通道还没有连上，先 await AxonInit()") {
		super(e, {
			code: "NOT_CONNECTED",
			name: "AxonNotConnectedError"
		});
	}
}, O = class extends T {
	constructor(e, t) {
		super(e, {
			code: "REMOTE",
			name: "AxonRemoteError",
			cause: t
		});
	}
}, k = "__axon_gz", A = "__axon_esc";
function j(e) {
	let t = "", n = 32768;
	for (let r = 0; r < e.length; r += n) t += String.fromCharCode.apply(null, Array.from(e.subarray(r, r + n)));
	return btoa(t);
}
function M(e) {
	let t = atob(e), n = new Uint8Array(t.length);
	for (let e = 0; e < t.length; e++) n[e] = t.charCodeAt(e);
	return n;
}
async function N(e) {
	let t = new TextEncoder().encode(e), n = new Blob([t]).stream().pipeThrough(new CompressionStream("gzip"));
	return j(new Uint8Array(await new Response(n).arrayBuffer()));
}
async function re(e) {
	let t = M(e), n = new Blob([t]).stream().pipeThrough(new DecompressionStream("gzip"));
	return await new Response(n).text();
}
async function P(e) {
	if (e.length < 262144) return e;
	let t = await N(e);
	return t.length < e.length * .9 ? { [k]: t } : e;
}
async function F(e) {
	if (typeof e == "string") return P(e);
	if (Array.isArray(e)) {
		let t = [];
		for (let n of e) t.push(await F(n));
		return t;
	}
	if (e && typeof e == "object") {
		if (Object.prototype.hasOwnProperty.call(e, k)) return { [A]: e };
		let t = {};
		for (let n of Object.keys(e)) t[n] = await F(e[n]);
		return t;
	}
	return e;
}
async function I(e) {
	if (Array.isArray(e)) {
		let t = [];
		for (let n of e) t.push(await I(n));
		return t;
	}
	if (e && typeof e == "object") {
		let t = Object.keys(e);
		if (t.length === 1 && t[0] === k && typeof e[k] == "string") return await re(e[k]);
		if (t.length === 1 && t[0] === A) return e[A];
		let n = {};
		for (let r of t) n[r] = await I(e[r]);
		return n;
	}
	return e;
}
// lib/AxonJSCall.ts
var L = {}, R = [], z = !1, B = !1;
function V() {
	if (B) return;
	B = !0;
	let e = () => {
		if (B = !1, R.length === 0) return;
		let e = g.AxonJSCallHandler;
		if (!e) {
			R.length = 0;
			return;
		}
		let t = R.splice(0, R.length);
		Promise.all(t.map(async (e) => {
			if (!e.payload) return e;
			let t = await e.payload;
			return delete e.payload, {
				...e,
				args: t.args,
				kwargs: t.kwargs
			};
		})).then((t) => {
			t.length !== 0 && (t.length === 1 ? e.onCall(t[0]) : e.onCall({ batch: t }));
		});
	};
	typeof queueMicrotask == "function" ? queueMicrotask(e) : Promise.resolve().then(e);
}
var H = {
	async init() {
		let e = g.AxonJSCallHandler;
		try {
			e.returnReceiverSignal.disconnect(H.returnReceiver);
		} catch {}
		e.returnReceiverSignal.connect(H.returnReceiverDecoded);
		try {
			let e = g.AxonEnv;
			e && e.supports_codec && (z = !0, typeof e.codec == "function" && e.codec(!0));
		} catch {
			z = !1;
		}
		try {
			let t = e.returnReceiverBatchSignal;
			t && t.connect(H.returnReceiverBatch);
		} catch {}
	},
	__call__({ controller_id: e, prop: t, args: n = [], kwargs: r = {}, timeout: i, type: a = "call" }) {
		return new Promise((o, s) => {
			let c = C();
			if (i !== void 0) {
				let e;
				L[c] = {
					resolve: (t) => {
						clearTimeout(e), o(t);
					},
					reject: (t) => {
						clearTimeout(e), s(t);
					}
				}, e = setTimeout(() => H.returnReceiver([
					c,
					"reject",
					new E(`Python 没有在 ${i}ms 内返回`)
				]), i);
			} else L[c] = {
				resolve: o,
				reject: s
			};
			if (!g.AxonJSCallHandler) {
				delete L[c], s(new D());
				return;
			}
			let l = z ? Promise.all([F(n), F(r)]).then(([e, t]) => ({
				args: e,
				kwargs: t
			})) : null;
			R.push({
				call_id: c,
				web_name: g.AxonEnv.web_name,
				controller_id: e,
				prop: t,
				args: n,
				kwargs: r,
				type: a,
				payload: l
			}), V();
		});
	},
	call(e) {
		return H.__call__({
			...e,
			type: "call",
			prop: e.func
		});
	},
	setVar({ controller_id: e, var_name: t, value: n, timeout: r }) {
		return H.__call__({
			controller_id: e,
			type: "set",
			args: [n],
			prop: t,
			timeout: r
		});
	},
	getVar({ controller_id: e, var_name: t, timeout: n }) {
		return H.__call__({
			controller_id: e,
			type: "get",
			prop: t,
			timeout: n
		});
	},
	crossCall(e) {
		let { timeout: t, ...n } = e;
		return H.call({
			controller_id: "AxonCrossCallHandler",
			func: "onCall",
			args: [n],
			timeout: t
		});
	},
	returnReceiverBatch(e) {
		for (let t of e) H.returnReceiverDecoded(t);
	},
	async returnReceiverDecoded([e, t, n]) {
		let r = n;
		if (z && t === "resolve") try {
			r = await I(n);
		} catch {
			r = n;
		}
		H.returnReceiver([
			e,
			t,
			r
		]);
	},
	returnReceiver([e, t, n]) {
		let r = L[e];
		if (r) {
			if (delete L[e], t === "reject") {
				let e = n instanceof T ? n : new O(typeof n == "string" ? n : JSON.stringify(n ?? "远程调用失败"));
				r.reject(e);
			} else r.resolve(n);
		}
	}
}, U = {}, W = function(e) {
	return (t) => {
		let n = e === void 0 ? t.name : e;
		return U[n] = new t(), t;
	};
};
W.get = (e) => {
	let t = U[e];
	if (!t) throw `[AxonController Error] Controller "${e}" not found`;
	return t;
}, W.register = (e, t) => {
	U[e] = t;
}, W.unregister = (e) => {
	delete U[e];
};
var G = {
	async init() {
		let e = g.AxonPYCall;
		if (!e) throw Error("[AxonPYCallHandler] AxonPYCall channel missing");
		try {
			e.onCallSignal.disconnect(G.onCall);
		} catch {}
		e.onCallSignal.connect(G.onCall);
		try {
			e.hasControllerSignal.disconnect(G.hasController);
		} catch {}
		e.hasControllerSignal.connect(G.hasController);
	},
	callback(e) {
		g.AxonPYCall.returnReceiver(e);
	},
	hasController({ call_id: e, controller_id: t }) {
		try {
			W.get(t), G.callback({
				call_id: e,
				state: "resolve",
				data: !0
			});
		} catch {
			G.callback({
				call_id: e,
				state: "resolve",
				data: !1
			});
		}
	},
	async onCall(e) {
		try {
			let t = W.get(e.controller_id);
			if (e.type === "set") {
				t[e.prop] = e.args[0], G.callback({
					call_id: e.call_id,
					state: "resolve",
					data: null
				});
				return;
			}
			let n = t[e.prop];
			if (e.type === "get") {
				G.callback({
					call_id: e.call_id,
					state: "resolve",
					data: n
				});
				return;
			}
			let r = e.kwargs || {}, i = Object.keys(r).length ? [...e.args, r] : e.args, a = await n.apply(t, i);
			G.callback({
				call_id: e.call_id,
				state: "resolve",
				data: a
			});
		} catch (t) {
			G.callback({
				call_id: e.call_id,
				state: "reject",
				data: String(t)
			});
		}
	}
}, K = class {
	name;
	value;
	store;
	constructor(e, t, n) {
		this.name = e, this.value = t, this.store = n;
	}
	get() {
		return this.value;
	}
	then(e, t) {
		return Promise.resolve(this.value).then(e, t);
	}
	set(e) {
		this.value !== e && (this.value = e, H.call({
			controller_id: this.store.controller_id,
			func: "set",
			args: [this.name, e]
		}));
	}
	setFromPeer(e) {
		this.value !== e && (this.value = e);
	}
}, q = class e {
	static AxonStoreMap = /* @__PURE__ */ new Map();
	static shared;
	id;
	store;
	controller_id;
	static init() {
		e.shared = new e("__shared__"), W.register(e.shared.id, e.shared), W.register("JSAxonStoreSyncManager", new J());
	}
	constructor(t, n = !0) {
		if (e.AxonStoreMap.has(t)) return e.AxonStoreMap.get(t);
		this.id = t, this.controller_id = `__AxonStore_${this.id}__`, this.store = /* @__PURE__ */ new Map(), e.AxonStoreMap.set(t, this), W.register(this.controller_id, this), n && H.call({
			controller_id: "PYAxonStoreSyncManager",
			func: "createStore",
			args: [this.id, g.AxonEnv.web_name]
		});
	}
	prop(e, t) {
		if (this.store.has(e)) return this.store.get(e);
		let n = new K(e, t, this);
		return this.store.set(e, n), n;
	}
	get(e) {
		return this.prop(e).get();
	}
	set(e, t) {
		this.prop(e).set(t);
	}
	setFromPeer(e, t) {
		this.prop(e).setFromPeer(t);
	}
	release() {
		this._release(), H.call({
			controller_id: "PYAxonStoreSyncManager",
			func: "deleteStore",
			args: [this.id, g.AxonEnv.web_name]
		});
	}
	_release() {
		e.AxonStoreMap.delete(this.id), W.unregister(this.controller_id);
	}
}, J = class {
	createStore(e) {
		return new q(e);
	}
	deleteStore(e) {
		let t = q.AxonStoreMap.get(e);
		t && t._release();
	}
};
// lib/Axon.ts
function Y(e) {
	return e.length === 0 ? { args: [] } : Array.isArray(e[0]) && e.length > 1 ? {
		args: e[0],
		kwargs: e[1],
		timeout: e[2]
	} : { args: e };
}
var ie = new Proxy({}, { get(e, t) {
	return new Proxy({}, {
		get(e, n) {
			let r = (...e) => H.call({
				controller_id: t,
				func: n,
				...Y(e)
			}), i, a = () => (i ||= H.getVar({
				controller_id: t,
				var_name: n
			}), i);
			return r.then = function(e, t) {
				return a().then(e, t);
			}, r.catch = function(e) {
				return a().catch(e);
			}, r.finally = function(e) {
				return a().finally(e);
			}, r;
		},
		set(e, n, r) {
			return H.setVar({
				controller_id: t,
				var_name: n,
				value: r
			}), !0;
		}
	});
} }), ae = "AxonCrossCallHandler";
function X(e, t) {
	return H.call({
		controller_id: ae,
		func: "onCall",
		args: [e],
		timeout: t
	});
}
var Z = {
	windows() {
		return X({ action: "windows" });
	},
	async has(e) {
		return (await Z.windows()).includes(e);
	},
	web(e) {
		return new Proxy({}, { get(t, n) {
			return new Proxy({}, { get(t, r) {
				return (...t) => X({
					action: "call",
					web_name: e,
					controller_id: n,
					func: r,
					...Y(t)
				});
			} });
		} });
	},
	call({ web: e, controller: t, func: n, args: r = [], kwargs: i, timeout: a }) {
		return X({
			action: "call",
			web_name: e,
			controller_id: t,
			func: n,
			args: r,
			kwargs: i,
			timeout: a
		}, a);
	},
	broadcast({ controller: e, func: t, args: n = [], kwargs: r, timeout: i, exclude: a }) {
		return X({
			action: "broadcast",
			controller_id: e,
			func: t,
			args: n,
			kwargs: r,
			timeout: i,
			exclude: a
		}, i);
	},
	emit(e, ...t) {
		return X({
			action: "emit",
			type: e,
			args: t
		});
	},
	emitTo(e, t, ...n) {
		return X({
			action: "call",
			web_name: e,
			controller_id: "AxonEvent",
			func: "dispatchEvent",
			args: [t, ...n]
		});
	}
}, Q = Z, $ = new class {
	__listeners;
	__onceEventListenerMap;
	constructor() {
		this.__listeners = {}, this.__onceEventListenerMap = {};
	}
	on = this.addListener;
	off = this.removeListener;
	addListener(e, t, n) {
		let r = t;
		if ($.__listeners[e] ||= /* @__PURE__ */ new Set(), $.__onceEventListenerMap[e] ||= /* @__PURE__ */ new Map(), $.__listeners[e].has(t) || $.__onceEventListenerMap[e].has(t)) return () => $.removeListener(e, t);
		if (n?.once) {
			let n = t;
			r = (...t) => {
				$.removeListener(e, n), n(...t);
			}, $.__onceEventListenerMap[e].set(n, r);
		}
		return $.__listeners[e].add(r), () => $.removeListener(e, t);
	}
	removeListener(e, t) {
		if (!$.__listeners[e] || !$.__onceEventListenerMap[e]) return;
		let n = $.__onceEventListenerMap[e].get(t);
		n ? ($.__onceEventListenerMap[e].delete(t), $.__listeners[e].delete(n)) : $.__listeners[e].delete(t);
	}
	removeAllListeners(e) {
		$.__listeners[e]?.clear(), $.__onceEventListenerMap[e]?.clear();
	}
	dispatchEvent(e, ...t) {
		$.__listeners[e]?.forEach((n) => {
			try {
				n(...t);
			} catch (t) {
				console.error(`事件监听器执行异常 - 事件类型: ${e}`, t);
			}
		});
	}
	dispatchPYEvent({ type: e, args: t = [], kwargs: n = {} }) {
		return H.call({
			controller_id: "AxonEvent",
			func: "dispatch_event",
			args: [e, ...t],
			kwargs: n
		});
	}
}();
W.register("AxonEvent", $);
// lib/index.ts
async function oe() {
	let e = await y(), t = {
		mode: "web",
		connected: e.connected,
		ready: !1,
		reason: e.reason,
		objects: e.objects,
		error: e.error
	};
	return e.connected ? (await G.init(), await H.init(), await q.init(), await se(), {
		...t,
		ready: !0,
		mode: "app"
	}) : t;
}
async function se() {
	let e = g.AxonEnv;
	if (e && typeof e.ready == "function") try {
		await e.ready();
	} catch (e) {
		console.warn("[AxonInit] 通知 Python 前端就绪失败:", e);
	}
}
function ce() {
	return _.connected && !!le();
}
function le() {
	let e = _.objects;
	return e.includes("AxonEnv") && e.includes("AxonJSCallHandler") && e.includes("AxonPYCall");
}
export { ie as Axon, H as AxonCall, _ as AxonChannelStatus, g as AxonChannels, W as AxonController, Q as AxonCross, T as AxonError, $ as AxonEvent, oe as AxonInit, D as AxonNotConnectedError, O as AxonRemoteError, q as AxonStore, E as AxonTimeoutError, y as initChannels, te as isAxonConnected, ce as isAxonReady };
