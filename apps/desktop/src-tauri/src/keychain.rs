//! OSキーチェーンへの秘密情報の保管。
//!
//! フロントエンドの `SecretAdapter`（apps/desktop/src/platform/secret.desktop.ts）から
//! invoke される。Windows は Credential Manager、macOS は Keychain、Linux は Secret Service。
//! OSログインで保護されているため、Web版のようなマスターパスワードは要求しない。

use keyring::v1::{Entry, Error as KeyringError};

/// キーチェーン上のサービス名。アカウント名には SecretAdapter の論理キーをそのまま使う
const SERVICE: &str = "com.ideamap.desktop";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_secret(key: String) -> Result<bool, String> {
    match entry(&key)?.get_password() {
        Ok(_) => Ok(true),
        Err(KeyringError::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        // 未設定は異常ではないので null を返し、呼び出し側の「キー無し」分岐に載せる
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_secret(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) => Ok(()),
        // 消えている状態が目的なので、元から無いのは成功として扱う
        Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
