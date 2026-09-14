# BMO - Reproductor Multimedia y Dual Audio Inmersivo

Aplicación web local minimalista para la reproducción de contenido multimedia (videos `.mp4`, `.webm` y GIFs `.gif`) y pistas de audio en sesiones inmersivas.

---

## 🚀 Características Principales

1. **Stack & APIs Nativas:**
   - **File System Access API (`showDirectoryPicker`):** Lectura nativa de carpetas y subcarpetas locales con soporte de fallback para navegadores estándar.
   - **Gamepad API (`navigator.getGamepads()`):** Control completo mediante mandos Bluetooth, USB o VR (Xbox, PlayStation, etc.) con bucle `requestAnimationFrame` y debounce.
   - **Web Audio API:** Mezclador de audio inteligente con control dual e independiente de pistas.

2. **Normalización Visual & Diseño:**
   - Pantalla completa con fondo negro absoluto (`#000000`).
   - Contenedor rígido `100vw` / `100vh` con `object-fit: contain` unificado para `<video>` e `<img>` (GIFs). Mantiene la relación de aspecto sin deformación, saltos de layout ni glitched de resolución.

3. **Capa de Mezcla & Audio Ducking Inteligente:**
   - **Sufijo `[music]` / `_music`:** Pausa automáticamente la pista secundaria con un fade-out suave, y la reanuda con un **fade-in de 1.5s** al cambiar a un clip sin música.
   - **Sufijo `[voice]` / `_voice`:** Atenúa la pista secundaria al **30% del volumen (`Audio Ducking`)** durante la duración del clip.
   - **GIFs / Archivos Silenciosos:** La pista secundaria se reproduce al 100% de volumen.
   - **Fallback Web Audio API (`AnalyserNode`):** Si un clip no tiene etiquetas en el nombre, un analizador en tiempo real detecta si la señal de audio supera los **-40dB** sostenidos y aplica ducking al 30% automáticamente.

4. **HUD / Menú Flotante:**
   - Muestra el Tag actual, clip activo, estado del mezclador (`Música Pausada`, `Ducking 30%`, `Full 100%`), pista secundaria y estado del mando.
   - Ocultado automático tras **2 segundos de inactividad** del cursor o mando. Se activa de nuevo con cualquier movimiento o presionando la tecla `H`.

---

## 📂 Estructura de Carpetas Recomendada

Al hacer clic en **"Cargar Carpeta Raíz"**, selecciona un directorio con una estructura similar a esta:

```
Mi_Coleccion_Raiz/
├── 01_anal/
│   ├── clip_01.mp4
│   ├── clip_02_[music].mp4    <-- Pausará el audio secundario (fade 1.5s)
│   └── clip_03_[voice].mp4    <-- Atenuará el audio secundario al 30%
├── 02_lesbian/
│   ├── animacion.gif          <-- Audio secundario al 100%
│   └── video_muestra.webm
├── 03_dolls/
│   └── escena_01.mp4
└── Audio_Tracks/              <-- Carpeta reservada para pistas de fondo (.mp3, .wav)
    ├── ambiente_01.mp3
    └── musica_relajante.wav
```

---

## 🎮 Controles (Teclado y Mando)

| Acción | Teclado | Mando (Gamepad / VR) |
| :--- | :--- | :--- |
| **Siguiente / Previo Video** | `Flecha Derecha` / `Flecha Izquierda` | D-Pad Derecha / Izquierda o Stick Izquierdo |
| **Siguiente / Previo Tag (Categoría)** | Tecla `N` / `B` | Botón A / Botón B (o D-Pad Abajo / Arriba) |
| **Siguiente / Previo Audio Secundario** | Tecla `PageDown` / `PageUp` | Gatillos LT/RT o Bumpers LB/RB |
| **Play / Pausa** | `Barra Espaciadora` | Botón Start o Botón X |
| **Ocultar / Mostrar HUD** | Tecla `H` | Botón Select o Botón Y |
| **Alternar Pantalla Completa** | Tecla `F` | Stick Press (L3) |
| **Silenciar Vídeo** | Tecla `M` | - |

---

## ⚡ Instrucciones de Ejecución Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en un navegador basado en Chromium (Google Chrome, Microsoft Edge, Brave, Opera) para aprovechar al máximo el File System Access API nativo.

3. **Compilar para producción:**
   ```bash
   npm run build
   ```
