# Test environment — Android / iPhone / iPad

Date: 2026-11-19  
Purpose: virtual device testing for the hotel app. This does not change application code.

## Android — installed and verified

| Component | Value |
|---|---|
| JDK | Temurin OpenJDK **21.0.13** portable |
| JDK path | `C:\Users\DIGMA_PRO\Tools\android-test\jdk21` |
| Android SDK | `C:\Users\DIGMA_PRO\AppData\Local\Android\Sdk` |
| SDK command-line tools | 19.0 |
| Platform tools / adb | 37.0.1 |
| Emulator | 37.2.13 |
| System image | `system-images;android-28;google_apis;x86_64` |
| AVD | **Hotel_API28** (Pixel 2) |
| Android version | **9 / API 28** verified |
| Display | 1080×1920 |
| Acceleration | **WHPX installed and usable** |

Verified boot:

```text
emulator-5554  device
Android 9
API 28
```

Start:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$jdk = "C:\Users\DIGMA_PRO\Tools\android-test\jdk21"
$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$jdk\bin;$sdk\platform-tools;$sdk\emulator;" + $env:PATH

emulator -avd Hotel_API28 -no-snapshot
```

Headless:

```powershell
emulator -avd Hotel_API28 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect
adb wait-for-device
adb shell getprop sys.boot_completed
```

Stop:

```powershell
adb emu kill
```

## iPhone / iPad — WebKit emulation only

**A native iOS Simulator cannot run on Windows.** Xcode/iOS Simulator require macOS. Therefore:

- installed Playwright **WebKit 27.2**;
- verified device profiles:
  - iPhone 13;
  - iPad (gen 7);
  - Pixel 5 via Chromium.
- WebKit is a Safari-engine approximation, **not** real iOS Safari or a real iPad.

Browser path:

```text
app\.playwright-browsers\webkit-2370
app\.playwright-browsers\chromium-1248
```

Run Playwright with:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\DIGMA_PRO\Documents\deepseek-harness\Coding_workspace\hotel-linen-management\app\.playwright-browsers"
```

Verified user agents:

```text
iPhone 13     iPhone OS 15_0 ... Safari/604.1
iPad (gen 7)  iPad OS 12_2 ... Safari/604.1
Pixel 5       Android 11 ... Chrome/156
```

The iPad descriptor reports iPadOS 12.2, while the target is iPad 7 / iPadOS 15; validate the actual app with a real iPad 7 or a cloud device farm.

## What is not installed

- Android Studio GUI — not required; command-line SDK/emulator is installed.
- Native iOS Simulator — impossible on Windows.
- BrowserStack/Sauce Labs — requires an account/paid subscription.
- Real iPad 7 / Android 9 hardware — still needed for final acceptance.

## Recommended test matrix

| Target | Method | Status |
|---|---|---|
| Android 9 phone/tablet | Android emulator API 28 | ready |
| Android current | Playwright Chromium / real device | Chromium ready |
| iPhone Safari | Playwright WebKit iPhone 13 | emulation ready |
| iPad 7 Safari | Playwright WebKit iPad (gen 7) / real iPad | emulation ready; real device needed |
| PWA install/offline | emulator/device + service worker | needs app run |
| QR camera | real device (emulator camera limited) | real device needed |

## App-run note

The app is not started by this setup. Start the app separately, then open it from:

- Android emulator: host loopback `http://10.0.2.2:3000` (if app listens on port 3000);
- host browser: `http://127.0.0.1:3000`;
- HTTPS production: `https://hotel` if DNS/TLS resolves.

Do not commit `.env`, `id_client_apaleo.txt`, databases, or storage.
