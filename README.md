# loon-scripts

个人 Loon 插件与脚本，供 Loon 通过远程 URL 安装与更新。

## 目录

```
loon-scripts/
├── chery/                奇瑞汽车每周签到
│   ├── chery_sign.lpt    插件（Loon 装这个）
│   └── chery_daily.js    脚本（插件里按 URL 远程引用）
├── oil/                  江苏每日油价
│   ├── jiangsu_oil.lpt   插件（Loon 装这个）
│   └── jiangsu_oil.js    脚本（插件里按 URL 远程引用）
└── README.md
```

## Loon 里的安装地址

插件地址（在 Loon 里填这个）：

```
https://raw.githubusercontent.com/322Z/loon-scripts/main/chery/chery_sign.lpt
https://raw.githubusercontent.com/322Z/loon-scripts/main/oil/jiangsu_oil.lpt
```

脚本地址（插件里已经写好，不用手填；改脚本时也只动这些文件）：

```
https://raw.githubusercontent.com/322Z/loon-scripts/main/chery/chery_daily.js
https://raw.githubusercontent.com/322Z/loon-scripts/main/oil/jiangsu_oil.js
```

> 如果仓库名不是 `loon-scripts`，或分支不是 `main`，把上面 URL 里的对应部分换掉，插件 `[Script]` 里的三行也要一起换。

## 安装步骤

1. Loon → 配置 → 插件 → 右上角 `+` → 粘贴插件地址 → 保存；
2. 打开刚加的插件，按需填写参数（奇瑞要填 token，油价改地区即可）；
3. 点插件里的「手动测试」条目跑一次，看日志和通知。

## 更新方式

- **只改了脚本（.js）**：Loon 里对插件下拉刷新一次（或重载配置），远程脚本会重新下载；
  若发现还是旧行为，去 Loon「脚本」页把对应脚本的缓存删掉，再重载配置。
- **改了插件本身（.lpt，比如改 cron）**：同样下拉刷新插件；插件参数里已填的 token 会保留，不用重填。
- **想固定某个版本**：把 URL 里的 `main` 换成分支名或标签名（如 `v1`），就不会跟着最新提交变。

## 注意

- 仓库必须是 **Public**：`raw.githubusercontent.com` 取私有仓库需要 token，Loon 不方便带。
- 因此**不要把 token 写进仓库里的任何文件**。奇瑞 token 只存在 Loon 插件的参数里（插件里默认值是空字符串）。
- `chery_daily.js` 里带着奇瑞 App 自身的 AES 公钥常量，公开仓库会露出来——它属于 App 客户端常量，不含你的账号信息。
