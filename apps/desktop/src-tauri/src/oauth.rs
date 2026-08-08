//! Google の OAuth 2.0 ループバックフロー（RFC 8252）用の一時 HTTP サーバ。
//!
//! Google は組み込み WebView からの認可リクエストを `disallowed_useragent` で拒否するため、
//! 認可画面は OS 既定ブラウザで開き、リダイレクト先の `http://127.0.0.1:<port>` を
//! ここで待ち受ける（docs/desktop/platform-integration.md §3.8）。
//!
//! ポートは事前登録が不要なので実行時に空きポートを OS から借りる。
//! PKCE の `code_challenge` をここで計算するのは、Tauri の WebView が
//! セキュアコンテキスト判定に依存する `crypto.subtle` を使えるとは限らないため。

use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State};

/// フロントエンドが購読するイベント名
pub const OAUTH_CALLBACK_EVENT: &str = "ideamap://oauth-callback";
/// ブラウザでの認可を待つ上限。これを過ぎたらサーバを畳んで timeout を通知する
const LISTEN_TIMEOUT: Duration = Duration::from_secs(300);
/// accept をポーリングする間隔。キャンセル要求への反応速度と CPU 消費の折衷
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const READ_TIMEOUT: Duration = Duration::from_secs(5);

/// 起動中のループバックサーバの停止フラグ。二重起動時は前のサーバを畳む
#[derive(Default)]
pub struct OauthServer(pub Mutex<Option<Arc<AtomicBool>>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthStartInfo {
    /// OS から借りた実際の待ち受けポート。フロントが redirect_uri を組み立てるのに使う
    port: u16,
    /// PKCE の S256 チャレンジ（base64url、パディングなし）
    code_challenge: String,
}

#[derive(Clone, Serialize)]
struct OauthCallback {
    code: Option<String>,
    error: Option<String>,
}

/// PKCE の `code_challenge`（S256）を計算する
fn code_challenge_s256(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// リクエストラインの対象（`/?code=...`）からクエリを取り出す。
/// 認可コードは `%2F` を含みうるのでパーセントデコードが要る。
/// `tauri::Url`（実体は url crate）を借りることで自前デコードを避けている。
fn query_pairs(request_target: &str) -> Vec<(String, String)> {
    let Ok(url) = tauri::Url::parse(&format!("http://127.0.0.1{request_target}")) else {
        return Vec::new();
    };
    url.query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect()
}

fn find<'a>(pairs: &'a [(String, String)], key: &str) -> Option<&'a str> {
    pairs
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.as_str())
}

/// リクエストラインの2番目のトークン（`GET /?code=x HTTP/1.1` の `/?code=x`）
fn request_target(request_line: &str) -> Option<&str> {
    request_line.split_whitespace().nth(1)
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn page(title: &str, message: &str) -> String {
    format!(
        "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><title>{title}</title></head>\
         <body style=\"font-family:sans-serif;text-align:center;padding:3rem\">\
         <h1 style=\"font-size:1.25rem\">{title}</h1><p>{message}</p></body></html>"
    )
}

/// 1本の接続を処理する。認可結果を受け取れたら Some を返し、
/// それ以外（ブラウザが勝手に取りに来る `/favicon.ico` など）は None で待機を続ける
fn handle_connection(mut stream: TcpStream, expected_state: &str) -> Option<OauthCallback> {
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let mut line = String::new();
    if BufReader::new(&stream).read_line(&mut line).is_err() {
        return None;
    }

    let Some(target) = request_target(&line) else {
        respond(&mut stream, "400 Bad Request", &page("エラー", "リクエストを解釈できませんでした。"));
        return None;
    };

    let pairs = query_pairs(target);
    let code = find(&pairs, "code");
    let error = find(&pairs, "error");
    if code.is_none() && error.is_none() {
        respond(&mut stream, "404 Not Found", "");
        return None;
    }

    // state はリダイレクトURLが推測可能であることへの対策。一致しない応答は捨てる
    if find(&pairs, "state") != Some(expected_state) {
        respond(
            &mut stream,
            "400 Bad Request",
            &page("認証に失敗しました", "リクエストの照合に失敗しました。アプリから操作をやり直してください。"),
        );
        return Some(OauthCallback {
            code: None,
            error: Some("state_mismatch".to_string()),
        });
    }

    if let Some(err) = error {
        respond(
            &mut stream,
            "200 OK",
            &page("認証をキャンセルしました", "アプリに戻って操作をやり直してください。"),
        );
        return Some(OauthCallback {
            code: None,
            error: Some(err.to_string()),
        });
    }

    respond(
        &mut stream,
        "200 OK",
        &page("認証が完了しました", "このタブを閉じて IdeaMap に戻ってください。"),
    );
    Some(OauthCallback {
        code: code.map(str::to_string),
        error: None,
    })
}

/// ループバックサーバを起動し、待ち受けポートと PKCE チャレンジを返す。
/// 結果は `ideamap://oauth-callback` イベントで1回だけ届く。
#[tauri::command]
pub fn start_oauth_loopback(
    app: AppHandle,
    server: State<'_, OauthServer>,
    code_verifier: String,
    state: String,
) -> Result<OauthStartInfo, String> {
    stop_previous(&server);

    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .map_err(|e| format!("ループバックサーバを起動できませんでした: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("待ち受けポートを取得できませんでした: {e}"))?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("ループバックサーバの設定に失敗しました: {e}"))?;

    let cancel = Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = server.0.lock() {
        *guard = Some(Arc::clone(&cancel));
    }

    let thread_cancel = Arc::clone(&cancel);
    std::thread::spawn(move || {
        let deadline = Instant::now() + LISTEN_TIMEOUT;
        loop {
            if thread_cancel.load(Ordering::Relaxed) {
                return;
            }
            if Instant::now() >= deadline {
                let _ = app.emit(
                    OAUTH_CALLBACK_EVENT,
                    OauthCallback {
                        code: None,
                        error: Some("timeout".to_string()),
                    },
                );
                return;
            }
            match listener.accept() {
                Ok((stream, _)) => {
                    // accept したストリームはリスナーの非ブロッキング設定を継ぐ環境があるため戻す
                    let _ = stream.set_nonblocking(false);
                    if let Some(result) = handle_connection(stream, &state) {
                        let _ = app.emit(OAUTH_CALLBACK_EVENT, result);
                        return;
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(POLL_INTERVAL);
                }
                Err(_) => return,
            }
        }
    });

    Ok(OauthStartInfo {
        port,
        code_challenge: code_challenge_s256(&code_verifier),
    })
}

/// 待ち受けを打ち切る。ユーザーがサインインをやめたときにフロントから呼ぶ
#[tauri::command]
pub fn cancel_oauth_loopback(server: State<'_, OauthServer>) {
    stop_previous(&server);
}

fn stop_previous(server: &State<'_, OauthServer>) {
    if let Ok(mut guard) = server.0.lock() {
        if let Some(flag) = guard.take() {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{code_challenge_s256, find, handle_connection, query_pairs, request_target};
    use std::io::{Read, Write};
    use std::net::{Ipv4Addr, TcpListener, TcpStream};

    /// 実際にソケットへ GET を流し、受け取り側の解釈を確かめる
    fn round_trip(request_target: &str, expected_state: &str) -> (Option<super::OauthCallback>, String) {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let request = format!("GET {request_target} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");

        let client = std::thread::spawn(move || {
            let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
            stream.write_all(request.as_bytes()).unwrap();
            let mut response = String::new();
            let _ = stream.read_to_string(&mut response);
            response
        });

        let (server_stream, _) = listener.accept().unwrap();
        let result = handle_connection(server_stream, expected_state);
        (result, client.join().unwrap())
    }

    #[test]
    fn 認可コードを受け取りブラウザに完了ページを返す() {
        let (result, response) = round_trip("/?code=4%2FabC&state=s1", "s1");
        let callback = result.expect("認可結果が返るはず");
        assert_eq!(callback.code.as_deref(), Some("4/abC"));
        assert!(callback.error.is_none());
        assert!(response.starts_with("HTTP/1.1 200 OK"));
        assert!(response.contains("認証が完了しました"));
    }

    #[test]
    fn stateが一致しない応答は捨てる() {
        let (result, response) = round_trip("/?code=abc&state=wrong", "s1");
        let callback = result.expect("照合失敗として結果を返すはず");
        assert!(callback.code.is_none());
        assert_eq!(callback.error.as_deref(), Some("state_mismatch"));
        assert!(response.starts_with("HTTP/1.1 400"));
    }

    #[test]
    fn faviconの取得要求では待機を続ける() {
        // ブラウザは完了ページを開いた流れで /favicon.ico も取りに来る。
        // これを認可結果と取り違えるとサーバが早期に畳まれてしまう
        let (result, response) = round_trip("/favicon.ico", "s1");
        assert!(result.is_none());
        assert!(response.starts_with("HTTP/1.1 404"));
    }

    #[test]
    fn ユーザーが拒否した場合はエラーとして返る() {
        let (result, _) = round_trip("/?error=access_denied&state=s1", "s1");
        let callback = result.expect("エラーも結果として返るはず");
        assert_eq!(callback.error.as_deref(), Some("access_denied"));
        assert!(callback.code.is_none());
    }

    #[test]
    fn rfc7636の検証ベクタと一致する() {
        // RFC 7636 Appendix B の code_verifier / code_challenge の組
        assert_eq!(
            code_challenge_s256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn 認可コードのパーセントエンコードを解く() {
        let pairs = query_pairs("/?code=4%2F0AX4XfWi&state=abc");
        assert_eq!(find(&pairs, "code"), Some("4/0AX4XfWi"));
        assert_eq!(find(&pairs, "state"), Some("abc"));
    }

    #[test]
    fn クエリのないリクエストは空になる() {
        assert!(query_pairs("/favicon.ico").is_empty());
    }

    #[test]
    fn リクエストラインから対象を取り出す() {
        assert_eq!(
            request_target("GET /?code=x HTTP/1.1"),
            Some("/?code=x")
        );
        assert_eq!(request_target("GET"), None);
    }

    #[test]
    fn エラー応答もクエリとして読める() {
        let pairs = query_pairs("/?error=access_denied&state=abc");
        assert_eq!(find(&pairs, "error"), Some("access_denied"));
        assert_eq!(find(&pairs, "code"), None);
    }
}
