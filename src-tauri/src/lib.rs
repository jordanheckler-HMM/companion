#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      use tauri::Manager;
      use tauri::menu::{Menu, MenuItem};
      use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
      use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

      let main_window = app.get_webview_window("main").unwrap();
      let panel_window = app.get_webview_window("panel").unwrap();

      #[cfg(target_os = "macos")]
      {
        apply_vibrancy(&main_window, NSVisualEffectMaterial::HudWindow, None, None)
          .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
        
        apply_vibrancy(&panel_window, NSVisualEffectMaterial::HudWindow, None, None)
          .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
      }

      let tray_icon = if let Ok(icon_image) = image::load_from_memory(include_bytes!("../icons/tray-icon.png")) {
        let width = icon_image.width();
        let height = icon_image.height();
        let rgba = icon_image.into_rgba8().into_vec();
        Some(tauri::image::Image::new_owned(rgba, width, height))
      } else {
        None
      };

      // Remove the auto-hide logic to allow the window to be movable/persistent
      /*
      let panel_handle = panel_window.clone();
      panel_window.on_window_event(move |event| {
          if let tauri::WindowEvent::Focused(focused) = event {
              if !*focused {
                  let _ = panel_handle.hide();
              }
          }
      });
      */

      // Create Tray Menu
      let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let show_i = MenuItem::with_id(app, "show", "Show Main Window", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

      let _tray = TrayIconBuilder::new()
        .icon(tray_icon.unwrap_or_else(|| app.default_window_icon().unwrap().clone()))
        .icon_as_template(true)
        .menu(&menu)
        .on_menu_event(|app, event| {
          match event.id.as_ref() {
            "quit" => {
              app.exit(0);
            }
            "show" => {
              let window = app.get_webview_window("main").unwrap();
              let _ = window.show();
              let _ = window.set_focus();
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, position, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("panel") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        // Basic positioning - on macOS tray is at the top
                        // We align it to the click x coordinate
                        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { 
                            x: (position.x - 190.0) as i32, // roughly half the window width
                            y: 0 
                        }));
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

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
