# loon-scripts

个人 Loon 插件与脚本，供 Loon 通过远程 URL 安装与自动更新。

## 文件

| 文件 | 说明 |
|---|---|
| `chery_sign.lpt` | 奇瑞汽车每周签到 · 插件（Loon 里装这个） |
| `chery_daily.js` | 奇瑞签到脚本（插件里按 URL 远程引用） |
| `jiangsu_oil.lpt` | 江苏每日油价 · 插件（Loon 里装这个） |
| `jiangsu_oil.js` | 油价脚本（插件里按 URL 远程引用） |

## Loon 安装地址（插件页 + 填这两个）

```
https://raw.githubusercontent.com/322Z/loon-scripts/main/chery_sign.lpt
https://raw.githubusercontent.com/322Z/loon-scripts/main/jiangsu_oil.lpt
```

插件内部引用的脚本地址（已写好，无需手填）：

```
https://raw.githubusercontent.com/322Z/loon-scripts/main/chery_daily.js
https://raw.githubusercontent.com/322Z/loon-scripts/main/jiangsu_oil.js
```

## 更新

1. 在 GitHub 上点开对应文件 → 铅笔图标 → 修改 → Commit changes；
2. 回到 Loon → 配置 → 插件 → 下拉刷新；
3. 脚本没变化时，去 Loon「脚本」页清掉该脚本缓存，再重载配置。

改 `.js` 不会影响插件里已填的 token / 地区参数。

## 注意

- 仓库为 Public，`raw.githubusercontent.com` 才能免 token 拉取。
- 奇瑞 token 只存在 Loon 插件参数里，没有写进本仓库任何文件。
