# Debug Session: media-engine-timeout

- Status: [OPEN]
- Symptom: Audio/video conversion reports engine loading timeout. The solution must work offline in PC EXE and Android APK, while remaining functional on the web.

## Hypotheses
1. FFmpeg WASM core or worker assets fail to load and are masked as a timeout.
2. Asset URLs differ across Web, Electron, and Android WebView.
3. The initial loading timeout is too short or cleanup/error propagation is incomplete.
4. Offline bundles do not contain usable local conversion assets or native execution paths.
5. The selected input codec/extension is not supported by the shipped engine build.

## Evidence
- Pending instrumentation and reproduction.
