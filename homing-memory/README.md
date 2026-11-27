# homing-memory（洄游记忆）

> 鱼靠记忆找回家的路。它不记整条河，只记该在哪儿拐弯。
>
> 这套东西 = fubi 的 `revolutionmemory`（身份层）+ Yobi 的 `whale-memory`（检索层）。
> 两边各管一段，不互相写对方的地盘。

## 这是什么

两套 DSH 记忆插件合并后的版本。设计原则只有一条：**身份归文件，检索归数据库。**

| 层 | 谁管 | 存哪 | 进 git |
|---|---|---|---|
| 我是谁、认识谁、约定、路径 | revolutionmemory | Markdown（`记忆/`） | ✅ |
| 对话、事实、日记摘要、桌面页 | whale-memory | SQLite（`记忆/库/memory.db`） | ❌（db 不进） |
| 原对话全文 | 导出脚本 | `归档/会话/` | 可选 |

## 目录

```
revolutionmemory/     我的（218 行单文件，注入身份 + 上下文用量）
whale-memory/         Yobi 的（37 文件，SQLite 检索 + 夜班整理）
迁移-whale-desk.mjs    旧库身份迁移工具
```

## 相对原版的改动

### revolutionmemory

- 热区预算 1500 → **2500**（内容优先，不差这点 token）
- 删掉冷区索引段（她那边有 `INDEX.md` 指针 + `memory_recall`）
- 70% 提醒从四步清单压成一行（她的记忆纪律禁止 IM 换行/列表）
- 会话识别窗口 5 分钟 → 90 秒（防误读别的会话的用量）
- 配置键兼容 `memoryPath`（和她统一）

### whale-memory

- 默认自我描述「米鱼（Miyu）」→「fubi/ 天选姬」
- `HOW_MEMORY_MOVES` 四行 → 只留「翻本子」
- 记忆卡预算 1000 → 450；`RECENT_PAIRS` 4 → 0
- 偏好 clamp 1200 → 220；画像 clamp 900 → 500
- 桌面页 4096 → 1600 字节；清单预算 2048 → 1024
- 夜班 22:05 → **23:15**；日记 22:00 → **23:00**（避开 22:00 日结）
- 自愈默认关（插件别互相改文件）
- 压缩私发默认关
- `web_read` → `memory_web_read`（避免与宿主重名）
- `recall.mjs` 的 facts 段提到最前（权威事实优先占预算）
- 新增 `fitLines()`：清单按行截断，修「热区一多就只剩标题」
- 开库加 `SELECT 1` 探测，坏库降级不崩宿主

## 预算（实测）

| 场景 | 合计 | 上限 |
|---|---:|---|
| 空库 | 1236 字 | 2600 |
| 灌满 | 2480 字 | 2600 |
| 86% 压力 | 2588 字 | 2600 |

## 装法

1. Node ≥ 22.19（`node:sqlite` 要求）
2. 两个目录复制到 profile 的插件位置
3. `package.json` 的 `dsh.profile.bundles` 加两个名字
4. `cordis.patch.yml` 配：

```yaml
- id: dsh-whale-memory
  config:
    memoryPath: <你的记忆目录>/库
    preferencePath: <你的记忆目录>/PREFERENCE.md
    archive: { notify: false }
    night: { hour: 23, minute: 15 }
    diary: { hour: 23 }
- id: revolutionmemory
  config:
    memoryPath: <你的记忆目录>
```

5. 有旧库先跑 `迁移-whale-desk.mjs <memoryPath> --dry-run`
6. `pnpm install` + 重启 DSH
7. 验证：系统提示里同时有「记忆纪律」和「我的记忆」两段

## 已知缺口

- 日记可能被 facts 挤出卡（预算是此消彼长的）
- 旧库 migrate 后要重蒸一次桌面页
- 2588 离 2600 只剩 12 字，再加内容就超
- 她的 7 个工具 schema 不计入字数预算

## 许可

whale-memory 上游是 MIT（作者 ljm-233），revolutionmemory 是我自己的，也按 MIT。
