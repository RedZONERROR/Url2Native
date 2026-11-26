/// Cross-platform display wake-lock manager.
///
/// Keeps the screen awake and prevents automatic display dimming while the
/// application is active when `behavior.preventBrightnessDrop` is enabled.
pub struct WakeLockGuard {
    #[cfg(target_os = "macos")]
    assertion_id: Option<u32>,
    #[cfg(target_os = "linux")]
    dbus_cookie: Option<(zbus::blocking::Connection, u32)>,
    #[cfg(target_os = "windows")]
    active: bool,
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    _phantom: (),
}

impl WakeLockGuard {
    pub fn acquire(app_name: &str) -> Self {
        #[cfg(target_os = "windows")]
        {
            let _ = app_name;
            Self::acquire_windows()
        }
        #[cfg(target_os = "macos")]
        {
            Self::acquire_macos(app_name)
        }
        #[cfg(target_os = "linux")]
        {
            Self::acquire_linux(app_name)
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            let _ = app_name;
            Self { _phantom: () }
        }
    }

    #[cfg(target_os = "windows")]
    fn acquire_windows() -> Self {
        const ES_CONTINUOUS: u32 = 0x8000_0000;
        const ES_DISPLAY_REQUIRED: u32 = 0x0000_0002;

        #[link(name = "kernel32")]
        extern "system" {
            fn SetThreadExecutionState(es_flags: u32) -> u32;
        }

        // SAFETY: SetThreadExecutionState is a standard Win32 kernel32 API taking a bitmask.
        let prev = unsafe { SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED) };
        Self { active: prev != 0 }
    }

    #[cfg(target_os = "macos")]
    fn acquire_macos(app_name: &str) -> Self {
        use std::ffi::CString;
        use std::os::raw::c_void;

        type CFStringRef = *const c_void;
        type CFAllocatorRef = *const c_void;
        type IOReturn = i32;
        type IOPMAssertionID = u32;
        type IOPMAssertionLevel = u32;

        const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
        const K_IOPM_ASSERTION_LEVEL_ON: IOPMAssertionLevel = 255;

        #[link(name = "CoreFoundation", kind = "framework")]
        extern "C" {
            fn CFStringCreateWithCString(
                alloc: CFAllocatorRef,
                c_str: *const i8,
                encoding: u32,
            ) -> CFStringRef;
            fn CFRelease(cf: *const c_void);
        }

        #[link(name = "IOKit", kind = "framework")]
        extern "C" {
            fn IOPMAssertionCreateWithName(
                assertion_type: CFStringRef,
                assertion_level: IOPMAssertionLevel,
                assertion_name: CFStringRef,
                assertion_id: *mut IOPMAssertionID,
            ) -> IOReturn;
        }

        let assertion_type_c = CString::new("PreventUserIdleDisplaySleep").ok();
        let reason_c = CString::new(format!("{app_name} active session")).ok();

        if let (Some(type_c), Some(name_c)) = (assertion_type_c, reason_c) {
            // SAFETY: Pointers are valid null-terminated CStrings and released before returning.
            unsafe {
                let cf_type = CFStringCreateWithCString(
                    std::ptr::null(),
                    type_c.as_ptr(),
                    K_CF_STRING_ENCODING_UTF8,
                );
                let cf_name = CFStringCreateWithCString(
                    std::ptr::null(),
                    name_c.as_ptr(),
                    K_CF_STRING_ENCODING_UTF8,
                );

                let mut assertion_id: IOPMAssertionID = 0;
                let status = if !cf_type.is_null() && !cf_name.is_null() {
                    IOPMAssertionCreateWithName(
                        cf_type,
                        K_IOPM_ASSERTION_LEVEL_ON,
                        cf_name,
                        &mut assertion_id,
                    )
                } else {
                    -1
                };

                if !cf_type.is_null() {
                    CFRelease(cf_type);
                }
                if !cf_name.is_null() {
                    CFRelease(cf_name);
                }

                if status == 0 {
                    return Self {
                        assertion_id: Some(assertion_id),
                    };
                }
            }
        }

        Self { assertion_id: None }
    }

    #[cfg(target_os = "linux")]
    fn acquire_linux(app_name: &str) -> Self {
        let conn = match zbus::blocking::Connection::session() {
            Ok(c) => c,
            Err(_) => return Self { dbus_cookie: None },
        };

        let reply = conn.call_method(
            Some("org.freedesktop.ScreenSaver"),
            "/org/freedesktop/ScreenSaver",
            Some("org.freedesktop.ScreenSaver"),
            "Inhibit",
            &(app_name, "Active application session"),
        );

        match reply {
            Ok(msg) => match msg.body().deserialize::<u32>() {
                Ok(cookie) => Self {
                    dbus_cookie: Some((conn, cookie)),
                },
                Err(_) => Self { dbus_cookie: None },
            },
            Err(_) => Self { dbus_cookie: None },
        }
    }
}

impl Drop for WakeLockGuard {
    fn drop(&mut self) {
        #[cfg(target_os = "windows")]
        if self.active {
            const ES_CONTINUOUS: u32 = 0x8000_0000;

            #[link(name = "kernel32")]
            extern "system" {
                fn SetThreadExecutionState(es_flags: u32) -> u32;
            }

            // SAFETY: Restores normal display sleep policy when window closes.
            unsafe {
                SetThreadExecutionState(ES_CONTINUOUS);
            }
        }

        #[cfg(target_os = "macos")]
        if let Some(id) = self.assertion_id {
            #[link(name = "IOKit", kind = "framework")]
            extern "C" {
                fn IOPMAssertionRelease(assertion_id: u32) -> i32;
            }

            // SAFETY: Releases the assertion previously created by IOPMAssertionCreateWithName.
            unsafe {
                IOPMAssertionRelease(id);
            }
        }

        #[cfg(target_os = "linux")]
        if let Some((conn, cookie)) = self.dbus_cookie.take() {
            let _ = conn.call_method(
                Some("org.freedesktop.ScreenSaver"),
                "/org/freedesktop/ScreenSaver",
                Some("org.freedesktop.ScreenSaver"),
                "UnInhibit",
                &(cookie,),
            );
        }
    }
}
