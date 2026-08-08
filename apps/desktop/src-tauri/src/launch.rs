//! `.ideamap` をダブルクリックで開く導線。
//!
//! Windows / Linux はファイルパスがプロセスの起動引数として渡り、macOS は
//! `RunEvent::Opened` として届く。多重起動を防ぐ single-instance プラグインと
//! 組み合わせ、2つ目の起動は既存ウィンドウへのイベントに変換する。

use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_fs::FsExt;

/// フロントエンドが購読するイベント名。ペイロードはファイルの絶対パス
pub const OPEN_MAP_EVENT: &str = "ideamap://open-map-file";

/// 起動時の引数から拾ったパスの置き場。フロントの準備が整ってから取りに来る
#[derive(Default)]
pub struct PendingLaunchFile(pub Mutex<Option<String>>);

/// 起動引数からマップファイルらしきパスを1つ選ぶ。
/// 先頭は実行ファイル自身なので飛ばし、オプション（`-` 始まり）も除く。
pub fn map_file_from_args<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|arg| !arg.starts_with('-') && is_map_path(arg))
}

fn is_map_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".ideamap") || lower.ends_with(".json")
}

/// 起動時に一度だけ呼ぶ。以降 `take_launch_file` で取り出せる
pub fn pending_from_env() -> PendingLaunchFile {
    PendingLaunchFile(Mutex::new(map_file_from_args(std::env::args())))
}

/// 起動引数で渡されたファイルを1回だけ返す。取り出したら消すのでリロードでは再実行されない
#[tauri::command]
pub fn take_launch_file(app: AppHandle, state: State<'_, PendingLaunchFile>) -> Option<String> {
    let path = state.0.lock().ok().and_then(|mut guard| guard.take())?;
    grant_fs_access(&app, &path);
    Some(path)
}

/// 2つ目のインスタンスが起動したとき。ウィンドウを前面に出してから開く指示を送る
pub fn handle_second_instance(app: &AppHandle, args: Vec<String>) {
    focus_main_window(app);
    if let Some(path) = map_file_from_args(args) {
        grant_fs_access(app, &path);
        let _ = app.emit(OPEN_MAP_EVENT, path);
    }
}

/// macOS の `RunEvent::Opened`。Finder からの起動・ドロップはこちらで届く
#[cfg(target_os = "macos")]
pub fn handle_opened_urls(app: &AppHandle, urls: &[tauri::Url]) {
    focus_main_window(app);
    for url in urls {
        if let Ok(path) = url.to_file_path() {
            let path = path.to_string_lossy().to_string();
            if is_map_path(&path) {
                grant_fs_access(app, &path);
                let _ = app.emit(OPEN_MAP_EVENT, path);
                break;
            }
        }
    }
}

/// 起動引数・OSイベント経由のパスを fs プラグインが読めるようにする。
///
/// capabilities の `fs:scope` はアプリ専用ディレクトリだけに絞ってあり、ユーザーが選んだ
/// パスは dialog プラグインが実行時に許可を足す設計になっている。ダブルクリック起動は
/// その dialog を通らないので、同じことをここで明示的にやる必要がある。
/// ドラッグ&ドロップは Tauri 本体が Drop イベント処理の中で同じ許可を出しているため不要。
fn grant_fs_access<R: Runtime, M: Manager<R>>(manager: &M, path: &str) {
    let path = Path::new(path);
    if let Some(scope) = manager.try_fs_scope() {
        let _ = scope.allow_file(path);
    }
    let _ = manager
        .state::<tauri::scope::Scopes>()
        .allow_file(path);
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::map_file_from_args;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn 実行ファイル自身は候補にしない() {
        assert_eq!(map_file_from_args(args(&["C:\\app\\IdeaMap.exe"])), None);
    }

    #[test]
    fn 拡張子で絞り込む() {
        let picked = map_file_from_args(args(&["IdeaMap.exe", "C:\\docs\\memo.txt", "C:\\docs\\a.ideamap"]));
        assert_eq!(picked.as_deref(), Some("C:\\docs\\a.ideamap"));
    }

    #[test]
    fn 大文字の拡張子とjsonも受け付ける() {
        let picked = map_file_from_args(args(&["IdeaMap.exe", "C:\\docs\\B.JSON"]));
        assert_eq!(picked.as_deref(), Some("C:\\docs\\B.JSON"));
    }

    #[test]
    fn オプション引数は無視する() {
        let picked = map_file_from_args(args(&["IdeaMap.exe", "--flag.json", "C:\\docs\\a.ideamap"]));
        assert_eq!(picked.as_deref(), Some("C:\\docs\\a.ideamap"));
    }
}
