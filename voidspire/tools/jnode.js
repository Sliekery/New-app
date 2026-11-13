// Minimal Node shim for macOS jsc: require/module/process/console, enough for the Voidspire sims.
// usage: jsc jnode.js -- [VAR=val ...] script.js [args...]
(function () {
  var args = Array.prototype.slice.call(arguments.length ? arguments : (typeof scriptArgs !== 'undefined' ? scriptArgs : []));
})();
var __a = (typeof arguments !== 'undefined') ? Array.prototype.slice.call(arguments) : [];
var __env = {};
while (__a.length && /^[A-Z_]+=/.test(__a[0])) { var kv = __a.shift(); var i = kv.indexOf('='); __env[kv.slice(0, i)] = kv.slice(i + 1); }
var __script = __a.shift();
globalThis.global = globalThis;
globalThis.process = { argv: ['node', __script].concat(__a), env: __env, exit: function (c) { throw { __exit: c | 0 }; },
  stdout: { write: function (s) { printErr === undefined ? print(s) : print(String(s).replace(/\n$/, '')); } }, hrtime: function () { return [0, 0]; },
  memoryUsage: function () { return { heapUsed: 0 }; }, on: function () {} };
function __fmt(a) { return Array.prototype.map.call(a, function (x) { return typeof x === 'object' && x !== null ? (function(){ try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x); }).join(' '); }
globalThis.console = { log: function () { print(__fmt(arguments)); }, error: function () { print(__fmt(arguments)); }, warn: function () { print(__fmt(arguments)); }, info: function () { print(__fmt(arguments)); } };
var __cache = {};
function __dir(p) { return p.replace(/\/[^\/]*$/, '') || '.'; }
function __norm(p) { var out = []; p.split('/').forEach(function (s, k) { if (s === '..') out.pop(); else if (s !== '.' && (s !== '' || k === 0)) out.push(s); }); return out.join('/'); }
function __req(from) {
  var r = function (p) {
    if (p === 'fs') return { readFileSync: function (f) { return readFile(f); }, existsSync: function () { return false; }, writeFileSync: function () {} };
    if (p === 'path') return { join: function () { return __norm(Array.prototype.join.call(arguments, '/')); }, resolve: function () { return __norm(Array.prototype.join.call(arguments, '/')); }, dirname: __dir };
    var full = __norm((p[0] === '/' ? '' : from + '/') + p);
    if (!/\.js$/.test(full)) full += '.js';
    if (__cache[full]) return __cache[full].exports;
    var module = { exports: {} }; __cache[full] = module;
    var fn = new Function('require', 'module', 'exports', '__dirname', '__filename', readFile(full));
    var rq = __req(__dir(full)); rq.main = r.main;
    fn(rq, module, module.exports, __dir(full), full);
    return module.exports;
  };
  return r;
}
var __root = __req('.');
// absolute, so a script's path.join(__dirname, '..') resolves the same as under Node
var __mainPath = __norm(__script[0] === '/' ? __script : (__env.JNODE_CWD || '.') + '/' + __script);
var __mainMod = { exports: {} }; __cache[__mainPath] = __mainMod;
var __rq = __req(__dir(__mainPath)); __rq.main = __mainMod;
try {
  (new Function('require', 'module', 'exports', '__dirname', '__filename', readFile(__mainPath)))(__rq, __mainMod, __mainMod.exports, __dir(__mainPath), __mainPath);
} catch (e) { if (e && e.__exit !== undefined) { if (e.__exit) print('exit ' + e.__exit); } else { print('ERROR ' + e + '\n' + (e && e.stack)); } }
