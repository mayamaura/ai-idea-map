mod keychain;
mod launch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // single-instance は「最初に登録する」のが公式の指示。2つ目のプロセスの引数を
    // 既存ウィンドウへ転送するため、他のプラグインより先にフックを掛ける必要がある
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            launch::handle_second_instance(app, args);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(launch::pending_from_env());

    let app = builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        // fs のスコープを復元するプラグインなので、必ず fs プラグインより後に登録する
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![
            keychain::has_secret,
            keychain::get_secret,
            keychain::set_secret,
            keychain::clear_secret,
            launch::take_launch_file,
        ])
        .build(tauri::generate_context!())
        .expect("Tauri アプリケーションの起動に失敗しました");

    // macOS は Finder からのファイル起動が引数ではなくイベントで届くため、
    // run(context) ではなくイベントを受け取れる形で回す
    app.run(|_app_handle, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &_event {
            launch::handle_opened_urls(_app_handle, urls);
        }
    });
}
