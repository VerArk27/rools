# dsh-revolutionmemory

给 DeepSeek Harness 用的**三层记忆**插件：把 `memory/HOT.md`（热区）自动注入系统提示，
让每次新对话睁眼就知道「我是谁、我认识谁」；冷区和信件不常驻，按需检索。

## 它解决什么问题

DSH 的会话是隔离的——换一个对话，上下文就清零。这个插件给 agent 一个**跨会话的记忆骨架**：

| 层 | 文件 | 行为 |
|---|---|---|
| 热区 | `memory/HOT.md` | **每轮自动注入**系统提示（实时读文件，改了立刻生效） |
| 冷区 | `memory/cold/YYYY-MM-DD.md` | 不注入，只在提示里给文件名 + grep 命令，需要时自己查 |
| 信件 | `memory/letters/YYYY-MM-DD.md` | 不注入，同上 |

## 安装

### 从本地目录

```yaml
# package.json
"dependencies": {
  "dsh-revolutionmemory": "file:./plugins/revolutionmemory"
},
"dsh": { "profile": { "bundles": [ ..., "dsh-revolutionmemory" ] } }
```

```bash
pnpm install
```

### 从 tgz 包

```bash
dsh plugin --profile <你的profile> add ./dsh-revolutionmemory-0.1.0.tgz
```

## 配置

```yaml
# cordis.patch.yml
- id: revolutionmemory
  config:
    memoryDir: memory        # 相对路径基于 DSH 进程 cwd；也可以写绝对路径
```

`memoryDir` 三种写法：

| 写法 | 解析为 |
|---|---|
| 不写 | `<cwd>/memory` |
| 相对路径 `memory` | `<cwd>/memory` |
| 绝对路径 `D:\...\memory` | 原样使用 |

## 文件约定

插件只读这几样：

```
<memoryDir>/
├── HOT.md                 必需，缺失则注入为空（不会报错）
├── cold/*.md              可选，用于提示「最近有哪些冷区文件」
└── letters/*.md           可选，同上
```

`HOT.md` 建议包含：

```markdown
# 热区记忆

## 固定身份
- 我是谁、用户是谁、我住在哪

## 日志
### 2026-11-25
- 今天最核心的 3–5 条
```

## 行为细节

- **每轮实时读文件**，不是启动时缓存——改 `HOT.md` 下一轮就生效
- 文件读不到返回空串，**绝不让记忆缺失把会话搞崩**
- 注入的 section 名是 `REVOLUTION_MEMORY`，order = 5（排系统提示靠前）
- 只注入热区；冷区/信件只给「文件名列表 + grep 命令」，避免撑爆上下文

## 卸载

从 `dsh.profile.bundles` 里删掉 `dsh-revolutionmemory`，再 `pnpm remove dsh-revolutionmemory`。

## 许可

MIT
