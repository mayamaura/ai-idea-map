// リリースビルドでコンソールウィンドウを出さない（デバッグ時はログを見たいので出す）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ideamap_desktop_lib::run()
}
