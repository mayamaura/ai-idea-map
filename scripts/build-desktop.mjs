#!/usr/bin/env node
/**
 * updater 署名鍵を環境変数に載せてから tauri build を実行する。
 *
 * 鍵は IdeaMap 専用なのでユーザー環境変数には置かず、`~/.tauri/` に置いたまま
 * 本スクリプトが読む。Tauri v2 の CLI は .env を読まないため、この方式を採る。
 * 鍵が無ければ環境変数を渡さない（CI は GitHub Secrets から直接与えるので、
 * その場合は既存の環境変数をそのまま使う）。
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const keyDir = join(homedir(), '.tauri')
const env = { ...process.env }

if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  try {
    const password = readFileSync(join(keyDir, 'ideamap-updater.password.txt'), 'utf8').trim()
    // TAURI_SIGNING_PRIVATE_KEY はファイルパスも受け付ける
    env.TAURI_SIGNING_PRIVATE_KEY = join(keyDir, 'ideamap-updater.key')
    env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = password
  } catch {
    console.warn(`署名鍵が ${keyDir} に見つかりません。updater 用の .sig は生成されません。`)
  }
}

// execFileSync だと Windows で pnpm.cmd の spawn が Node 24 に拒否されるため execSync を使う。
// 引数はエスケープせず連結する（`--target x86_64-apple-darwin` 程度しか渡さないため）
const args = process.argv.slice(2).join(' ')
execSync(`pnpm --filter @ideamap/desktop tauri build ${args}`.trimEnd(), { stdio: 'inherit', env })
