/**
 * 迁移-whale-desk.mjs —— 把旧库里「米鱼（Miyu）」那套自我描述换成 fubi。
 *
 * 背景：改代码只改「新蒸出来」的默认值；已经写进 meta.desk 的旧值会继续注入，
 * 直到夜班重蒸。合并后两套身份同屏，必须在装之前清一次。
 *
 * 用法：
 *   node 迁移-whale-desk.mjs <memoryPath>
 *   node 迁移-whale-desk.mjs <你的记忆目录>\库 --dry-run
 *
 * 只改 meta 表里 k='desk' 的那一行，不动任何记忆条目；改之前备份成 desk.md.bak。
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, isAbsolute, resolve } from 'node:path'

const args = process.argv.slice(2)
const target = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')

if (!target) {
  console.error('用法: node 迁移-whale-desk.mjs <memoryPath> [--dry-run]')
  process.exit(1)
}

const dbPath = isAbsolute(target)
  ? join(target, 'memory.db')
  : resolve(target, 'memory.db')

if (!existsSync(dbPath)) {
  console.log(`没有库：${dbPath}（不用迁移，新库会直接用 fubi）`)
  process.exit(0)
}

const NEW_INTRO = '（这里写你是谁、住在哪）'

const db = new DatabaseSync(dbPath, { timeout: 5000 })
db.exec('SELECT 1')

const row = (() => {
  try {
    return db.prepare("SELECT v FROM meta WHERE k='desk'").get()
  } catch {
    return null
  }
})()

if (!row?.v) {
  console.log('meta.desk 是空的：不用迁移')
  db.close()
  process.exit(0)
}

const old = String(row.v)
const bad = /米鱼|Miyu|Arch/mu.test(old)
console.log(`meta.desk 长度 ${old.length}，含旧身份: ${bad ? '是' : '否'}`)

if (!bad) {
  console.log('没有 Miyu/Arch，跳过')
  db.close()
  process.exit(0)
}

// 只替换「我是谁」那一行的自述，其余内容原样保留
const fixed = old
  .replace(/^.*米鱼（Miyu）.*$/gmu, NEW_INTRO)
  .replace(/^.*Miyu.*跑在 Arch.*$/gmu, NEW_INTRO)

console.log('\n--- 改前（前 3 行）---')
console.log(old.split('\n').slice(0, 3).join('\n'))
console.log('\n--- 改后（前 3 行）---')
console.log(fixed.split('\n').slice(0, 3).join('\n'))

if (dryRun) {
  console.log('\n--dry-run：没写库')
  db.close()
  process.exit(0)
}

const bak = `${dbPath}.bak-${new Date().toISOString().replace(/[:.]/gu, '-')}`
writeFileSync(bak, old, 'utf8')
console.log(`\n旧值已备份：${bak}`)

db.prepare("UPDATE meta SET v=? WHERE k='desk'").run(fixed)
const check = db.prepare("SELECT v FROM meta WHERE k='desk'").get()
console.log(`写入完成，当前含 Miyu: ${/米鱼|Miyu/mu.test(String(check?.v)) ? '是（失败）' : '否'}`)

db.close()
