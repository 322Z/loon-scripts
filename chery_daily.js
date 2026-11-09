// 奇瑞汽车 App 每日签到 + 分享（Loon 脚本版）
// 依赖：Loon Build >= 988（$crypto.aes.encrypt）；已在 3.5.3(1014) 的 API 文档上校对
// 对应原 Python 逻辑：src/daily.py --quick-only（签到 SJ10002 + 分享 2 次领 SJ10003 + 查积分）
//
// $argument 支持两种形态：
//   1) 插件对象参数：{ token: "..." }  （Loon 插件 [Argument] 传入）
//   2) 字符串：直接就是 token
//
// 调试：在 Loon 里配成 generic 脚本手动跑一次，日志里能看到每一步结果。

var BASE = "https://mobile-consumer-sapp.chery.cn";
var AES_KEY_B64 = "vVfnp9ozfDQyonMKuqgZUWjtdV+7PtBqtMCwJqz2HKQ=";

var APP_HEADERS = {
  "user-agent": "Dart/2.19 (dart:io)",
  "appversioncode": "26030901",
  "accept": "application/json, text/plain, */*",
  "appversion": "3.6.9",
  "accept-language": "zh-CN,zh;q=0.9",
  "content-type": "application/json; charset=UTF-8",
  "agent": "android",
  "encryptflag": "true",
  "request-channel": "app",
  "accept-encoding": "identity"
};

var UA_HEADERS = {
  "user-agent": "Dart/2.19 (dart:io)",
  "accept": "application/json, text/plain, */*"
};

/* ---------------- 基础工具 ---------------- */

var B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function b64Encode(bytes) {
  var out = "";
  var i;
  for (i = 0; i + 2 < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64_ALPHABET.charAt((n >> 18) & 63) +
           B64_ALPHABET.charAt((n >> 12) & 63) +
           B64_ALPHABET.charAt((n >> 6) & 63) +
           B64_ALPHABET.charAt(n & 63);
  }
  var rest = bytes.length - i;
  if (rest === 1) {
    var n1 = bytes[i] << 16;
    out += B64_ALPHABET.charAt((n1 >> 18) & 63) + B64_ALPHABET.charAt((n1 >> 12) & 63) + "==";
  } else if (rest === 2) {
    var n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64_ALPHABET.charAt((n2 >> 18) & 63) +
           B64_ALPHABET.charAt((n2 >> 12) & 63) +
           B64_ALPHABET.charAt((n2 >> 6) & 63) + "=";
  }
  return out;
}

function b64Decode(str) {
  var clean = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
  var bytes = [];
  for (var i = 0; i < clean.length; i += 4) {
    var c1 = B64_ALPHABET.indexOf(clean.charAt(i));
    var c2 = B64_ALPHABET.indexOf(clean.charAt(i + 1));
    var c3 = clean.charAt(i + 2) === "=" ? -1 : B64_ALPHABET.indexOf(clean.charAt(i + 2));
    var c4 = clean.charAt(i + 3) === "=" ? -1 : B64_ALPHABET.indexOf(clean.charAt(i + 3));
    if (c1 < 0 || c2 < 0) break;
    var n = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
    bytes.push((n >> 16) & 255);
    if (c3 >= 0) bytes.push((n >> 8) & 255);
    if (c4 >= 0) bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

function utf8Encode(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      var c2 = str.charCodeAt(++i);
      var code = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63),
               0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return new Uint8Array(out);
}

function concatBytes(a, b) {
  var out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function randomBytes(n) {
  var out = new Uint8Array(n);
  for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/* 测试用：固定 IV，正常运行时为 null */
var TEST_IV = null;

/* 单次请求超时：手机网络到奇瑞网关常要 10s+，给足 15s；失败自动重试一次 */
var REQ_TIMEOUT = 15000;
/* 国内接口强制直连，避免走代理节点导致超时 */
var FORCE_NODE = "DIRECT";

/* AES-256-CBC + PKCS7，输出 base64(iv + ciphertext)，并把 "+" 换成 "-"（与 Python 版一致） */
function aesEncrypt(plain) {
  var key = b64Decode(AES_KEY_B64);
  var iv = TEST_IV || randomBytes(16);
  var data = utf8Encode(String(plain));
  var enc;
  try {
    enc = $crypto.aes.encrypt(data, {
      mode: "cbc",
      key: key,
      iv: iv,
      padding: "pkcs7"
    });
  } catch (e) {
    throw new Error("AES_FAILED: " + ((e && (e.code || e.message)) || String(e)) +
      "（Loon Build 需 >= 988）");
  }
  var ct = enc.ciphertext;
  return b64Encode(concatBytes(iv, ct)).replace(/\+/g, "-");
}

function encParam(query) {
  return encodeURIComponent(aesEncrypt(query));
}

/* ---------------- 接口封装 ---------------- */

function parseJson(text) {
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function encPost(path, token, payload, cb) {
  var url, body;
  try {
    url = BASE + path + "?encryptParam=" + encParam("access_token=" + token + "&terminal=3");
    body = aesEncrypt(JSON.stringify(payload));
  } catch (e) {
    return cb(String((e && e.message) || e));
  }
  $httpClient.post({
    url: url,
    headers: APP_HEADERS,
    body: body,
    timeout: REQ_TIMEOUT,
    node: FORCE_NODE,
    "auto-redirect": false
  }, cb);
}

function encGet(path, token, extraQuery, cb) {
  var url;
  try {
    url = BASE + path + "?encryptParam=" + encParam("access_token=" + token + "&terminal=3");
  } catch (e) {
    return cb(String((e && e.message) || e));
  }
  if (extraQuery) url += "&" + extraQuery;
  $httpClient.get({
    url: url,
    headers: APP_HEADERS,
    timeout: REQ_TIMEOUT,
    node: FORCE_NODE,
    "auto-redirect": false
  }, cb);
}

function getInfo(token, cb, attempt) {
  attempt = attempt || 1;
  $httpClient.get({
    url: BASE + "/web/user/current/details?access_token=" + token + "&terminal=3",
    headers: UA_HEADERS,
    timeout: REQ_TIMEOUT,
    node: FORCE_NODE
  }, function (err, resp, data) {
    if (err) {
      if (attempt < 2) {
        console.log("读取账号信息超时，重试一次");
        return setTimeout(function () { getInfo(token, cb, attempt + 1); }, 1000);
      }
      return cb(err);
    }
    var d = parseJson(data);
    if (!d || !d.data) return cb("查询积分失败: " + String(data).slice(0, 100));
    var acc = d.data.pointAccount || {};
    cb(null, d.data.displayName || "账号", acc.payableBalance);
  });
}

function trigger(token, code, cb) {
  encPost("/web/event/trigger", token, { eventCode: code }, function (err, resp, data) {
    if (err) return cb(err, false, "");
    var d = parseJson(data) || {};
    cb(null, d.status === 200, d.message || "");
  });
}

/* 推荐列表的返回结构在不同版本里包了几层，这里递归找一个「条目数组」 */
function looksLikeArticle(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  var c = x.content;
  if (x.id || x.contentId || x.shareId) return true;
  return !!(c && typeof c === "object" && (c.id || c.contentId));
}

function findArticles(node, depth) {
  if (!node || depth > 5) return null;
  if (Array.isArray(node)) {
    for (var k = 0; k < node.length; k++) {
      if (looksLikeArticle(node[k])) return node;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  var keys = Object.keys(node);
  for (var i = 0; i < keys.length; i++) {
    var hit = findArticles(node[keys[i]], depth + 1);
    if (hit) return hit;
  }
  return null;
}

function articleId(item) {
  var c = item.content;
  if (c && typeof c === "object") {
    if (c.id) return String(c.id);
    if (c.contentId) return String(c.contentId);
  }
  if (item.contentId) return String(item.contentId);
  if (item.shareId) return String(item.shareId);
  if (item.id) return String(item.id);
  return "";
}

function shareOne(token, arts, index, success, cb) {
  if (index >= arts.length) return cb(null, success);
  var item = arts[index] || {};
  var aid = articleId(item);
  if (!aid) return shareOne(token, arts, index + 1, success, cb);
  encPost("/web/community/contents/" + aid + "/share", token, { contentId: aid },
    function (err, resp, data) {
      var sd = parseJson(data) || {};
      if (sd.status !== 200) return shareOne(token, arts, index + 1, success, cb);
      trigger(token, "SJ10003", function (e2, ok2) {
        shareOne(token, arts, index + 1, success + (ok2 ? 1 : 0), cb);
      });
    });
}

function doShare(token, cb) {
  encGet("/web/community/recommend/contents", token, "", function (err, resp, data) {
    if (err) return cb(err, 0);
    var d = parseJson(data) || {};
    var arts = findArticles(d, 0) || [];
    if (!arts.length) return cb(null, 0);
    shareOne(token, arts.slice(0, 2), 0, 0, cb);
  });
}

function resolveToken() {
  var arg = typeof $argument === "undefined" ? null : $argument;
  var token = "";
  if (arg && typeof arg === "object") token = String(arg.token || "");
  else if (typeof arg === "string") token = arg;
  return token.trim();
}

/* ---------------- 主流程 ---------------- */

function main() {
  var token = resolveToken();
  if (!token) {
    console.log("缺少 token：请在 Loon 插件参数里填写 CHERY_TOKEN");
    $notification.post("奇瑞签到", "未执行", "缺少 token，请在插件参数里填写 CHERY_TOKEN");
    $done();
    return;
  }

  console.log("Loon 运行环境: " + (typeof $loon === "undefined" ? "未知" : $loon) +
              " | 脚本: " + (typeof $script === "undefined" ? "-" : $script.name));
  console.log("奇瑞每日任务启动，token 长度 " + token.length);

  getInfo(token, function (err, name, before) {
    if (err) {
      console.log("读取账号信息失败: " + err);
      $notification.post("奇瑞签到", "失败", String(err));
      $done();
      return;
    }
    console.log("账号: " + name + " 当前积分: " + before);

    trigger(token, "SJ10002", function (e2, okSign, msgSign) {
      console.log((okSign ? "OK" : "FAIL") + " 签到: " + msgSign);

      doShare(token, function (e3, shared) {
        console.log((shared > 0 ? "OK" : "FAIL") + " 分享: 成功 " + shared + "/2 次");

        getInfo(token, function (e4, name2, after) {
          var delta = (Number(after) || 0) - (Number(before) || 0);
          var deltaTxt = delta === 0 ? "" : "（" + (delta > 0 ? "+" : "") + delta + "）";

          var lines = [];
          lines.push("签到  " + (okSign ? "成功" : "失败"));
          lines.push("分享  " + shared + "/2");
          lines.push("积分  " + before + " → " + after + deltaTxt);

          console.log(name2 + ": " + lines.join(" | "));
          $notification.post("奇瑞签到", "", lines.join("\n"));
          $done();
        });
      });
    });
  });
}

if (typeof CHERY_LOON_TEST === "undefined") {
  main();
}
