# rools · 小工具库

两边共用的小工具。解压就能用，不装也行。

---

## homing-memory（洄游记忆）

DeepSeek Harness 的双插件记忆方案：**身份存文件，检索走数据库**。

| 层 | 插件 | 存哪 |
|---|---|---|
| 我是谁、认识谁、约定 | `revolutionmemory` | Markdown |
| 对话、事实、日记摘要 | `whale-memory` | SQLite |

- `revolutionmemory/`：单文件 218 行，把热区注入系统提示，带上下文用量提示
- `whale-memory/`：基于 [ljm-233/dsh-whale-memory](https://github.com/ljm-233/dsh-whale-memory)（MIT）的定制版，加了分层检索、事实有效期、夜班整理
- `迁移-whale-desk.mjs`：旧库身份迁移工具（默认自述是作者自己的，换成你的）

两套插件同时挂载实测：5 个 section + 1 个 context，注入合计约 2500 字，互不覆盖。

安装和改动清单见 `homing-memory/README.md`。

> 注意：`whale-memory` 的默认自我描述是作者自己的身份，装之前请改掉（`lib/desk.mjs:127` 或配置 `selfIntro`）。

---

## MemReduct-2026-11-26.zip

**Mem Reduct**（内存清理小工具，Henry++ 出品），Windows 用。

- 来源：作者机器上的 `D:\Program Files\Mem Reduct\`，7 个文件原样打包（`memreduct.exe`、签名、语言包、许可证/历史/卸载器）
- 解压即用，绿色版，不需要安装
- 用途：作者平时清内存用；要参考就解压看看，不用强制装

以后再有工具，往这个目录加，文件名带日期。
