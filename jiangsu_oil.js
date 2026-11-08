// 江苏省每日油价（Loon 脚本）
// 数据源：金投网城市油价数据中心（公开接口，允许跨域）
//   价格表 https://datacenter.cngold.org/city_oil/all_price_by_year/
//   调价窗口 https://datacenter.cngold.org/city_oil/near_time/
// 插件里用 [Argument] 传地区名，默认「江苏」；脚本也可直接以字符串参数传地区名。

var API_PRICE = "https://datacenter.cngold.org/city_oil/all_price_by_year/";
var API_NEAR = "https://datacenter.cngold.org/city_oil/near_time/";
var API_FORECAST = "http://www.qiyoujiage.com/{slug}.shtml"; // 下一轮预测文案
var STORE_KEY = "js_oil_last_date";

/* 省名 → 汽油价格网的页面路径；没有的地区会跳过预测 */
var SLUG = {
  "北京": "beijing", "天津": "tianjin", "河北": "hebei", "山西": "shanxi",
  "内蒙古": "neimenggu", "辽宁": "liaoning", "吉林": "jilin", "黑龙江": "heilongjiang",
  "上海": "shanghai", "江苏": "jiangsu", "浙江": "zhejiang", "安徽": "anhui",
  "福建": "fujian", "江西": "jiangxi", "山东": "shandong", "河南": "henan",
  "湖北": "hubei", "湖南": "hunan", "广东": "guangdong", "广西": "guangxi",
  "海南": "hainan", "重庆": "chongqing", "四川": "sichuan", "贵州": "guizhou",
  "云南": "yunnan", "西藏": "xizang", "陕西": "shaanxi", "甘肃": "gansu",
  "青海": "qinghai", "宁夏": "ningxia", "新疆": "xinjiang"
};

var HEADERS = {
  "accept": "application/json, text/plain, */*",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  "accept-language": "zh-CN,zh;q=0.9"
};

function parseJson(text) {
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function resolveRegion() {
  var arg = typeof $argument === "undefined" ? null : $argument;
  var r = "";
  if (arg && typeof arg === "object") r = String(arg.region || "");
  else if (typeof arg === "string") r = arg;
  r = r.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区/g, "").trim();
  return r || "江苏";
}

/* 涨跌统一成 ↑0.27 / ↓0.20 / 持平 三种形态，长度一致方便上下对齐 */
function chg(v) {
  var n = Number(v);
  if (!n || isNaN(n)) return "─ 持平";
  return (n > 0 ? "↑" : "↓") + Math.abs(n).toFixed(2);
}

function normName(s) {
  return String(s || "").replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区/g, "");
}

/* 在 1400 条记录里找该地区，按日期倒序取最新与上一轮 */
function pickRegion(rows, region) {
  var hit = [];
  for (var i = 0; i < rows.length; i++) {
    if (normName(rows[i].regionName) === region) hit.push(rows[i]);
  }
  hit.sort(function (a, b) { return String(b.date) > String(a.date) ? 1 : -1; });
  return hit;
}

function daysUntil(dateStr) {
  var parts = String(dateStr).split("-");
  if (parts.length !== 3) return null;
  var target = Date.parse(parts[0] + "/" + Number(parts[1]) + "/" + Number(parts[2]) + " 00:00:00");
  if (isNaN(target)) return null;
  var today = new Date();
  var t0 = Date.parse((today.getMonth() + 1) + "/" + today.getDate() + "/" + today.getFullYear() + " 00:00:00");
  return Math.round((target - t0) / 86400000);
}

/* 从汽油价格网页面里抠「目前预计上调油价90元/吨(0.07元/升-0.08元/升)」这一段 */
function parseForecast(html) {
  if (typeof html !== "string" || !html.length) return null;
  var i = html.indexOf("目前预计");
  if (i < 0) return null;
  var seg = html.slice(i, i + 140);

  var dirM = seg.match(/目前预计\s*(上调|下调|搁浅)/);
  if (!dirM) return null;

  var ton = seg.match(/([0-9.]+)\s*元\/吨/);
  var rng = seg.match(/([0-9.]+)\s*元\/升\s*[-~–]\s*([0-9.]+)\s*元\/升/);

  return {
    dir: dirM[1],
    ton: ton ? ton[1] : "",
    lo: rng ? rng[1] : "",
    hi: rng ? rng[2] : ""
  };
}

function forecastLine(fc) {
  if (!fc) return "";
  if (fc.dir === "搁浅") return "预计 搁浅（本轮不作调整）";
  var sign = fc.dir === "上调" ? "↑" : "↓";
  // 只报每升多少钱：有区间就用区间，没有就退回吨价
  var amount = fc.lo ? fc.lo + "~" + fc.hi + " 元/升" : (fc.ton ? fc.ton + " 元/吨" : "");
  return "预计 " + sign + amount;
}

function buildMessage(region, rows, near, fc) {
  var list = pickRegion(rows, region);
  if (!list.length) return { ok: false, msg: "没找到「" + region + "」的价格数据" };

  var cur = list[0];

  // 只保留 92# / 95#，两行等宽排布：油品 + 现价 + 涨跌
  var rows2 = [
    ["92#", cur.n92, cur.n92Change],
    ["95#", cur.n95, cur.n95Change]
  ];
  var lines = [];
  for (var i = 0; i < rows2.length; i++) {
    lines.push(rows2[i][0] + "  " + Number(rows2[i][1]).toFixed(2) + "  " + chg(rows2[i][2]) + " 元/升");
  }

  var tip = "";
  if (near) {
    var d = daysUntil(near);
    var md = near.slice(5, 7) + "月" + near.slice(8, 10) + "日";
    if (d === 0) tip = "今晚 24 时调价";
    else if (d === 1) tip = "明晚 24 时调价";
    else if (d > 1) tip = "下轮 " + md + " 0时";
    else tip = "下轮 " + md;
  }

  var fcLine = forecastLine(fc);

  var content = lines.join("\n") +
                (tip ? "\n" + tip : "") +
                (fcLine ? "\n" + fcLine : "");
  return { ok: true, title: region + "油价", content: content, date: cur.date };
}

function main() {
  var region = resolveRegion();
  console.log("油价任务启动：地区 " + region +
              " | Loon " + (typeof $loon === "undefined" ? "未知" : $loon));

  $httpClient.get({ url: API_PRICE, headers: HEADERS, timeout: 20000 }, function (err, resp, data) {
    if (err) {
      console.log("价格接口失败: " + err);
      $notification.post("油价查询失败", region, String(err));
      $done();
      return;
    }
    var d = parseJson(data);
    if (!d || !d.data || !d.data.length) {
      console.log("价格接口返回异常，长度 " + String(data).length);
      $notification.post("油价查询失败", region, "接口返回结构异常");
      $done();
      return;
    }

    $httpClient.get({ url: API_NEAR, headers: HEADERS, timeout: 8000 }, function (e2, r2, d2) {
      var near = null;
      var n = parseJson(d2);
      if (n && n.data && n.data.length > 1) near = n.data[1].date;

      var slug = SLUG[region];
      if (!slug) {
        console.log("该地区没有预测源，跳过下一轮预测");
        finish(near, null);
        return;
      }

      $httpClient.get({ url: API_FORECAST.replace("{slug}", slug), headers: HEADERS, timeout: 10000 },
        function (e3, r3, d3) {
          var fc = null;
          if (!e3) fc = parseForecast(String(d3));
          else console.log("预测接口失败，跳过预测: " + e3);
          if (!fc) console.log("预测文案没取到，本次只发价格");
          finish(near, fc);
        });

      function finish(nearDate, fc) {
        var built = buildMessage(region, d.data, nearDate, fc);
        if (!built.ok) {
          console.log(built.msg);
          $notification.post("油价查询失败", region, built.msg);
          $done();
          return;
        }

        var last = $persistentStore.read(STORE_KEY);
        var isNewRound = last && last !== built.date;
        if (last !== built.date) $persistentStore.write(built.date, STORE_KEY);

        console.log(built.content.replace(/\n/g, " | "));
        if (isNewRound) console.log("检测到新一轮调价: " + last + " → " + built.date);

        $notification.post(
          isNewRound ? "油价已调整" : "每日油价",
          "",
          built.content
        );
        $done();
      }
    });
  });
}

if (typeof JS_OIL_TEST === "undefined") {
  main();
}
