# dsh-whale-memory 架构速览（0.28.16）

这份是给 fubi 看的导读；源码在同目录 `lib/`，跑着的也是这版。

## 一、注入：四段 section + 一段运行时上下文

- 人格 / 偏好 / 画像 / 桌面页：`ctx.inject(['systemPrompt'])` 里各挂一个 `systemPrompt.section(...)`（`lib/index.mjs:380-384`）。挂在 system prompt 里，稳定、不进历史。
- 记忆卡（热区事实、最近几轮、联想）：不走普通 user 消息，走 `systemPrompt.context({ name, order: 940, interpolate: false, text: (ctx) => memoryCard(ctx?.agent) })`（`lib/index.mjs:389-394`）。
  - 为什么：runtime context 每步现算，压缩把上下文冲掉之后会自动重投；当普通消息塞进历史，被压缩就没了。
  - `order: 940` 排在运行时上下文（目录 100 / 沙箱 110 / 源码 200 / 网页 210）之后，硬约束先立住。
  - `text` 必须同步：里面不联网、不调模型。

## 二、预算：1000 字符怎么花

- `MEMORY_BUDGET_CHARS = 1000`（`lib/constants.mjs`），`memoryCard` 同步拼，超了按权重/时间截。
- 上限还有几个：事实 8 条、最近 4 轮、联想 3 条、召回单条 180 字、冷区 2000。
- 联想单独算：`user/message` 时 `associate()` 异步算一次，结果放小缓存，`card()` 只同步读（`lib/index.mjs:519-521`）。算不出来这轮就没有联想段，不耽误回话。

## 三、事件：turn/end 只落库，不调模型

`ctx.on('session/event', ...)`（`lib/index.mjs:510`）里认五种：

| 事件 | 干什么 |
|---|---|
| `user/message` | 写用户那句话、记共享时间线、异步算联想 |
| `assistant/message` | 写我说的那句、记时间线 |
| `tool/call` / `tool/result` | 只记工具名 |
| `turn/end` | `flush()` 落库，fire-and-forget，**不 await 模型** |
| `compaction/summary` | 趁压缩前把被冲掉的原文蒸馏进长期记忆 |

要模型的事全都挪到定时器：日记 22:00（`lib/index.mjs:605-610`）、夜间整理 22:05 起（`lib/nightly.mjs`）。对话主链上一次模型都不多调。

## 四、怎么不把宿主带崩

1. 瀑布流中间件必须 `return await next()`——漏了就是 fubi 那次 `agent/pre-step` 崩宿主的原因。能不挂瀑布流就别挂。
2. 能力先探测再调用：`typeof spCtx.systemPrompt.context !== 'function'` 就直接 return（`lib/index.mjs:388`），老版本 harness 上跳过而不是报错。
3. 服务用 `ctx.inject([...])` 拿引用，不裸读 `ctx.xxx`；拿不到就不做事。
4. 所有异步 `.catch(() => undefined)`：写库失败不影响对话，导出失败不影响启动。
5. 写库、备份这类副作用都包 try/catch，且不阻塞返回。
