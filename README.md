# 🦆 Responsive Ducky

Dashboard locale (stile BrowserStack Live) per testare i siti su **iPhone, iPad, Android e Mac** con browser veri:

| Piattaforma | Cosa usa | Browser |
|---|---|---|
| iPhone / iPad | iOS Simulator di Xcode (vero Mobile Safari) | Safari · Chrome* |
| Android | Android Emulator (vero Chrome per Android) | Chrome |
| Mac | App installate | Safari, Chrome, Firefox, Edge |

\* Su iOS tutti i browser, Chrome compreso, usano il motore WebKit di Safari: il sito si disegna allo stesso modo. Il vero Chrome iOS non si può installare nel Simulator.

## Avvio

```bash
npm start
```

Si apre `http://localhost:4747`. Scrivi l'URL, scegli il dispositivo e il browser e naviga nella finestra del Simulator o dell'emulatore.
Funzionano anche i siti in locale (`http://localhost:3000`): il Simulator condivide la rete del Mac.

## Requisiti

- Node 20+ (nessuna dipendenza npm)
- **iOS/iPadOS**: Xcode dall'App Store → aprilo una volta e scarica la piattaforma iOS → `sudo xcode-select -s /Applications/Xcode.app`
- **Android** (facoltativo): Android Studio → Device Manager → crea un dispositivo con immagine *Google Play*

## Funzioni

- Avvio del dispositivo e apertura URL
- Apertura di un nuovo URL sul dispositivo già acceso
- Screenshot (salvati in `screenshots/`)
- Tema chiaro/scuro del dispositivo
- Spegnimento

Scorciatoie nel Simulator: `⌘←` / `⌘→` ruota, `⌘K` tastiera software, `⌘S` screenshot.
