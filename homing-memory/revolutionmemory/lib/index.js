/**
 * dsh-revolutionmemory
 *
 * 把「热区」注入系统提示，让每次对话睁眼就知道「我是谁、我认识谁」。
 * 冷区（日记/流水 + 归档/会话原文）不常驻，只在提示里给出检索路径。
 *
 * 0.5.2（2026-11-26）
 *   - 热区改走 systemPrompt.context（动态上下文，压缩后自动重投），拿不到才回退 section；
 *     读法参考 Yobi 的 dsh-whale-memory 0.28.16：能力先探测，不裸读、不硬试。
 *   - 热区预算 6000 → 1500 字符（对齐 Yobi 的 1000 级预算，留点余量）。
 *
 * 0.5.0（2026-11-26）
 *   - 修掉致命 bug：agent/pre-step 是瀑布流，监听器必须返回 next(decision)；
 *     0.4.0 只用来偷 session id 却返回 undefined，框架读 decision.kind 时抛
 *     "Cannot read properties of undefined (reading 'kind')"，宿主直接崩。
 *     现在改成不挂该事件，按「最近更新的会话缓存」读上下文用量。
 *
 * 0.4.0（2026-11-25）
 *   - 每轮读 contextPressure，把上下文用量写进提示；
 *     超过 70% 时给出强提醒：先把这一天落盘再做别的（软压缩触发）
 *   - 冷区索引加上「归档/会话」里的原对话全文
 *   - 适配工作站布局：记忆/HOT.md + 日记/流水 + 日记/信件
 *   - 热区 6000 字上限；HOT.md 缺失时明确提示，不静默
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-revolutionmemory'
export const inject = []

const SECTION_NAME = 'REVOLUTION_MEMORY'
const SECTION_ORDER = 5
const CONTEXT_ORDER = 940
const HOT_LIMIT = 600
const PRESSURE_WARN = 0.7

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return ''
  }
}

function listRecent(dir, limit = 5) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .slice(-limit)
  } catch {
    return []
  }
}

/** 读会话缓存里的「上下文用量」比例。优先按当前会话 id 找；找不到再退化为「最近有更新的会话」。 */
function readPressure(sessionId) {
  try {
    const dir = path.join(DSH_HOME, 'storages', 'session_projcache', 'sessions')
    let target = null

    if (sessionId) {
      const direct = path.join(dir, `${sessionId}.json`)
      if (fs.existsSync(direct)) target = direct
    }

    if (!target) {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const full = path.join(dir, f)
          return { full, mtime: fs.statSync(full).mtimeMs }
        })
        .sort((a, b) => b.mtime - a.mtime)
      if (!files.length) return null
      // 只看最近 5 分钟内有更新的，避免把过期的比例当成当前会话
      if (Date.now() - files[0].mtime > 90 * 1000) return null
      target = files[0].full
    }

    const j = JSON.parse(fs.readFileSync(target, 'utf8'))
    const cp = j?.record?.rows?.contextPressure?.val
    if (!cp?.contextWindow || !Number.isFinite(cp.surfaceTokens)) return null
    return {
      ratio: cp.surfaceTokens / cp.contextWindow,
      surface: cp.surfaceTokens,
      window: cp.contextWindow,
    }
  } catch {
    return null
  }
}

function pressureBlock(sessionId) {
  const p = readPressure(sessionId)
  if (!p) return []

  const pct = Math.round(p.ratio * 100)
  const lines = []
  if (p.ratio >= PRESSURE_WARN) {
    lines.push(
      '',
      `## ⚠ 上下文已用 ${pct}%`,
      '',
      '超过 70% 了：把今天最核心的 3 条补进 HOT.md，然后 git commit。'
    )
  } else {
    lines.push(
      '',
      `> 上下文用量：${pct}%（${Math.round(p.surface / 1000)}k / ${Math.round(p.window / 1000)}k）。超过 70% 会自动提醒日结。`
    )
  }
  return lines
}

function buildText(dirs, sessionId) {
  const { hotFile, coldDir, letterDir, sessionDir } = dirs
  let hot = readIfExists(hotFile)

  if (!hot) {
    return [
      '## 我的记忆（热区还没写）',
      '',
      `- 期待的文件：${hotFile}`,
      '- 里面应该写：我是谁、我认识谁、我们之间的规矩、最近在做什么。',
      '- 现在没读到内容——别编，如实说「这段没记下来」。',
      ...pressureBlock(sessionId),
    ].join('\n')
  }

  let truncated = false
  if (hot.length > HOT_LIMIT) {
    hot = hot.slice(0, HOT_LIMIT)
    truncated = true
  }

  const lines = ['## 我的记忆（fubi 热区，每次对话都先读这段）', '', hot, '']
  // 截断不解释：解释本身也占预算，反正正文已经截了

  lines.push(...pressureBlock(sessionId))
  return lines.join('\n')
}

/** 解析目录：支持 config.memoryDir / coldDir / letterDir 覆盖，默认按工作站布局推导 */
function resolveDirs(config) {
  const raw = config.memoryPath ?? config.memoryDir ?? path.join(process.cwd(), '记忆')
  const memoryDir = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
  const root = path.dirname(memoryDir)
  const fix = (p) => (path.isAbsolute(p) ? p : path.resolve(root, p))

  return {
    memoryDir,
    hotFile: path.join(memoryDir, 'HOT.md'),
    coldDir: config.coldDir ? fix(config.coldDir) : path.join(root, '日记', '流水'),
    letterDir: config.letterDir ? fix(config.letterDir) : path.join(root, '日记', '信件'),
    sessionDir: config.sessionDir ? fix(config.sessionDir) : path.join(root, '归档', '会话'),
  }
}

export function apply(ctx, config = {}) {
  const dirs = resolveDirs(config)

  if (!fs.existsSync(dirs.memoryDir)) {
    ctx.logger?.warn?.(`[revolutionmemory] 记忆目录不存在：${dirs.memoryDir}（插件已挂载，注入的是提示）`)
  }

  // 0.5.0：不再挂 agent/pre-step。
  // agent/pre-step 是瀑布流，监听器必须返回 next(decision)；
  // 原来的写法只用来偷一个 session id，却返回 undefined，
  // 框架拿着 undefined 继续处理就会抛 "Cannot read properties of undefined (reading 'kind')"，
  // 直接把宿主带崩——这就是菲比那边「死掉」的根因。
  // 现在改成：不认会话 id，只认「最近 5 分钟内有更新的会话缓存」。
  const cachedSessionId = null

  // 0.5.3：只用 section，放弃 context 注入。
  // 0.5.2 的 sp.context({ interpolate:false, text: build }) 会让请求体里出现一条
  // 缺 role 的消息，服务端报 INVALID_REQUEST: messages[790] missing field `role`。
  // section 是 0.5.1 验证过能用的写法，先保可用。
  const build = () => buildText(dirs, cachedSessionId)

  const mount = (prompted) => {
    const sp = prompted?.get ? prompted.get('systemPrompt') : null
    if (!sp) {
      ctx.logger?.warn?.('[revolutionmemory] 拿不到 systemPrompt 服务，热区未挂载')
      return
    }
    if (typeof sp.section === 'function') {
      try {
        sp.section({ name: SECTION_NAME, order: SECTION_ORDER, text: build })
        ctx.logger?.info?.(`[revolutionmemory] 0.5.3 已挂载（section），热区：${dirs.hotFile}`)
        return
      } catch (e) {
        ctx.logger?.warn?.(`[revolutionmemory] section 注入失败：${e?.message}`)
      }
    }
    ctx.logger?.warn?.('[revolutionmemory] 没有可用的注入接口，热区未挂载')
  }

  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['systemPrompt'], mount)
    } catch (e) {
      ctx.logger?.warn?.(`[revolutionmemory] inject 失败，热区未挂载：${e?.message}`)
    }
  } else {
    ctx.logger?.warn?.('[revolutionmemory] 没有 inject 接口，热区未挂载')
  }
}
