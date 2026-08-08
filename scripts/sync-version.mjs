#!/usr/bin/env node
/**
 * ルート package.json の version を、アプリのバージョン番号を持つ全ファイルへ配る。
 *
 * Web版とデスクトップ版は同じアプリケーションバージョンを共有する方針
 * （docs/desktop/platform-integration.md §6.4）。ルートを単一の真実にして、
 * リリース前に本スクリプトで下流へ同期する。
 *
 * tauri.conf.json の version に `../../../package.json` と相対パスを書く方式も
 * 動作する（tauri CLI・tauri-build とも src-tauri 基準で解決することを実測で確認）。
 * ただし apps/web の package.json と Cargo.toml はどのみち本スクリプトが要るため、
 * 仕組みを二重に持たず数値で持つ方に統一している。
 *
 *   node scripts/sync-version.mjs           同期する
 *   node scripts/sync-version.mjs --check   ズレていたら 1 で終了する（CI用）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`ルート package.json の version が semver ではありません: ${version}`)
  process.exit(1)
}

/** @type {{ file: string, read: (text: string) => string, write: (text: string, v: string) => string }[]} */
const targets = [
  {
    file: 'apps/web/package.json',
    read: (t) => JSON.parse(t).version,
    write: (t, v) => t.replace(/("version":\s*")[^"]*(")/, `$1${v}$2`),
  },
  {
    file: 'apps/desktop/package.json',
    read: (t) => JSON.parse(t).version,
    write: (t, v) => t.replace(/("version":\s*")[^"]*(")/, `$1${v}$2`),
  },
  {
    file: 'apps/desktop/src-tauri/tauri.conf.json',
    read: (t) => JSON.parse(t).version,
    write: (t, v) => t.replace(/("version":\s*")[^"]*(")/, `$1${v}$2`),
  },
  {
    // [package] の version だけを狙う。依存の version = "..." に当たらないよう先頭から最初の1件に限定する
    file: 'apps/desktop/src-tauri/Cargo.toml',
    read: (t) => t.match(/^version\s*=\s*"([^"]*)"/m)?.[1] ?? '',
    write: (t, v) => t.replace(/^version\s*=\s*"[^"]*"/m, `version = "${v}"`),
  },
]

let drifted = false
for (const target of targets) {
  const path = join(root, target.file)
  const text = readFileSync(path, 'utf8')
  const current = target.read(text)
  if (current === version) continue

  drifted = true
  if (checkOnly) {
    console.error(`${target.file}: ${current} （ルートは ${version}）`)
  } else {
    writeFileSync(path, target.write(text, version))
    console.log(`${target.file}: ${current} -> ${version}`)
  }
}

if (checkOnly && drifted) {
  console.error('\nバージョンがズレています。`node scripts/sync-version.mjs` を実行してコミットしてください。')
  process.exit(1)
}
console.log(checkOnly ? `全ファイルが ${version} で一致しています。` : `同期完了: ${version}`)
