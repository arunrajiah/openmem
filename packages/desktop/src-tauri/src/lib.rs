use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the spawned companion sidecar process so it lives for the app's
/// lifetime and can be killed on shutdown.
struct CompanionProcess(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(CompanionProcess(Mutex::new(None)))
        .setup(|app| {
            // In `tauri dev` the companion is started by `beforeDevCommand`
            // (see predev script). Only spawn the bundled sidecar in release
            // builds so we don't fight over port 7410 during development.
            #[cfg(not(debug_assertions))]
            {
                let sidecar = app
                    .shell()
                    .sidecar("openmem-companion")
                    .expect("failed to create `openmem-companion` sidecar command");

                let (mut rx, child) = sidecar
                    .spawn()
                    .expect("failed to spawn `openmem-companion` sidecar");

                // Keep the child handle so we can kill it on exit.
                app.state::<CompanionProcess>()
                    .0
                    .lock()
                    .unwrap()
                    .replace(child);

                // Drain the sidecar's output so the pipe doesn't fill up.
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                println!("[companion] {}", String::from_utf8_lossy(&line));
                            }
                            CommandEvent::Stderr(line) => {
                                eprintln!("[companion] {}", String::from_utf8_lossy(&line));
                            }
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // When the main window closes, terminate the companion sidecar.
            if let WindowEvent::CloseRequested { .. } = event {
                kill_companion(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building OpenMem desktop app")
        .run(|app_handle, event| {
            // Belt-and-suspenders: also kill the sidecar on full app exit.
            if let RunEvent::ExitRequested { .. } = event {
                kill_companion(app_handle);
            }
        });
}

fn kill_companion(app_handle: &tauri::AppHandle) {
    if let Some(child) = app_handle
        .state::<CompanionProcess>()
        .0
        .lock()
        .unwrap()
        .take()
    {
        let _ = child.kill();
    }
}
