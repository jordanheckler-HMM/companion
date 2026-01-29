#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      use tauri::Manager;
      use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

      let window = app.get_webview_window("main").unwrap();

      #[cfg(target_os = "macos")]
      apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
        .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

      app.handle().plugin(tauri_plugin_store::Builder::default().build())?;
      app.handle().plugin(tauri_plugin_fs::init())?;
      app.handle().plugin(tauri_plugin_dialog::init())?;
      app.handle().plugin(tauri_plugin_http::init())?;
      app.handle().plugin(tauri_plugin_shell::init())?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
