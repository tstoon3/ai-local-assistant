# Erwin — Local AI Assistant

**English** · [ภาษาไทย](#ภาษาไทย)

Erwin is a desktop AI chat application built with Tauri, Vue 3, and TypeScript. It runs chat with Ollama on your own device, stores conversations in a local SQLite database, and offers voice transcription with Whisper running locally in the app.

## Features

- Chat locally with Ollama using the `qwen3:1.7b` model.
- Keep chat history and privacy settings in a per-user SQLite database.
- Use voice chat with the multilingual `Xenova/whisper-tiny` speech-recognition model.
- Optionally provide explicitly selected text or source files to the local model. File and folder access is off by default.
- Control internet access for Whisper downloads, local Ollama access, microphone access, and selected-file access in Privacy settings.

## Requirements

- Node.js and npm
- Rust toolchain and the platform prerequisites for [Tauri 2](https://v2.tauri.app/start/prerequisites/)
- [Ollama](https://ollama.com/) for AI chat

The commands below use PowerShell on Windows. Tauri also supports other platforms; see its prerequisite guide for platform-specific setup.

## Get started

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Install and start Ollama, then download the model used by Erwin:

   ```powershell
   ollama pull qwen3:1.7b
   ```

   Keep Ollama running while using chat. Erwin checks its local API at `http://127.0.0.1:11434`.

3. Start the desktop app in development mode:

   ```powershell
   npm run tauri dev
   ```

## Build

Build the frontend:

```powershell
npm run build
```

Build a desktop installer or bundle for the current platform:

```powershell
npm run tauri build
```

## Voice chat

Voice transcription uses `Xenova/whisper-tiny` through Transformers.js and runs locally in the app. On first use, enable **Internet access for Whisper downloads** in Privacy settings so the model can be downloaded and cached. Afterward, you can turn that permission off and use the cached model offline. Microphone permission must also be enabled in Erwin and may need to be allowed in Windows.

## Privacy and local data

- Chat prompts and replies are sent to the Ollama service on this device when local service access is enabled. Erwin does not search the web for chat answers.
- Voice audio is transcribed locally with Whisper. Internet access is used only to download the speech model when needed.
- Selected file contents are included in a chat only when selected-file access is enabled and you choose files or a folder. Supported text/source files are limited to 64 KB per file; folder selection reads up to 40 files and 80 KB total. Selected contents are sent to local Ollama and saved in chat history.
- Chat history and privacy settings are stored in Erwin's per-user SQLite database. Settings are available from the app's Privacy dialog.

## Troubleshooting

- **Ollama disconnected:** Start Ollama and confirm its local service is available, then check that local service access is enabled in Erwin.
- **Model not found:** Run `ollama pull qwen3:1.7b` and retry.
- **Whisper could not load:** Enable internet access for Whisper downloads, check your connection, and retry. For more help, see [docs/VOICE_TROUBLESHOOTING_TH.md](docs/VOICE_TROUBLESHOOTING_TH.md).

## Tech stack

Tauri 2 · Vue 3 · TypeScript · Vite · Rust · SQLite · Ollama · Transformers.js / Whisper

---

## ภาษาไทย

Erwin เป็นแอปแชต AI บนเดสก์ท็อป พัฒนาด้วย Tauri, Vue 3 และ TypeScript โดยส่งข้อความให้ Ollama ที่ทำงานอยู่ในเครื่อง เก็บประวัติแชตในฐานข้อมูล SQLite ภายในเครื่อง และถอดเสียงด้วย Whisper ที่ทำงานในแอป

### ความสามารถ

- แชตกับ Ollama ในเครื่องโดยใช้โมเดล `qwen3:1.7b`
- เก็บประวัติแชตและการตั้งค่าความเป็นส่วนตัวในฐานข้อมูล SQLite ของผู้ใช้
- ใช้แชตเสียงด้วยโมเดลรู้จำเสียงหลายภาษา `Xenova/whisper-tiny`
- เลือกส่งไฟล์ข้อความหรือซอร์สโค้ดให้โมเดลได้ โดยค่าเริ่มต้นปิดสิทธิ์เข้าถึงไฟล์และโฟลเดอร์
- ตั้งค่าสิทธิ์อินเทอร์เน็ตสำหรับดาวน์โหลด Whisper, การเชื่อมต่อ Ollama ในเครื่อง, ไมโครโฟน และไฟล์ที่เลือกได้ในหน้า Privacy

### สิ่งที่ต้องติดตั้ง

- Node.js และ npm
- Rust toolchain และส่วนประกอบสำหรับแพลตฟอร์มของ [Tauri 2](https://v2.tauri.app/start/prerequisites/)
- [Ollama](https://ollama.com/) สำหรับแชต AI

คำสั่งด้านล่างใช้ PowerShell บน Windows แต่ Tauri รองรับแพลตฟอร์มอื่นด้วย โปรดดูคู่มือการติดตั้งของ Tauri สำหรับแต่ละแพลตฟอร์ม

### เริ่มใช้งาน

1. ติดตั้ง dependencies:

   ```powershell
   npm install
   ```

2. ติดตั้งและเปิด Ollama จากนั้นดาวน์โหลดโมเดลที่ Erwin ใช้:

   ```powershell
   ollama pull qwen3:1.7b
   ```

   เปิด Ollama ค้างไว้ขณะใช้งานแชต โดย Erwin จะเชื่อมต่อ API ภายในเครื่องที่ `http://127.0.0.1:11434`

3. เปิดแอปเดสก์ท็อปในโหมดพัฒนา:

   ```powershell
   npm run tauri dev
   ```

### สร้างแอป

สร้าง frontend:

```powershell
npm run build
```

สร้างตัวติดตั้งหรือ bundle สำหรับแพลตฟอร์มปัจจุบัน:

```powershell
npm run tauri build
```

### แชตด้วยเสียง

การถอดเสียงใช้ `Xenova/whisper-tiny` ผ่าน Transformers.js และทำงานภายในเครื่อง เมื่อใช้ครั้งแรก ให้เปิด **Internet access for Whisper downloads** ในหน้า Privacy เพื่อดาวน์โหลดและเก็บแคชโมเดล หลังจากนั้นปิดสิทธิ์นี้และใช้โมเดลที่แคชไว้แบบออฟไลน์ได้ ต้องเปิดสิทธิ์ไมโครโฟนใน Erwin ด้วย และอาจต้องอนุญาตเพิ่มเติมใน Windows

### ความเป็นส่วนตัวและข้อมูลในเครื่อง

- เมื่ออนุญาตการเชื่อมต่อบริการในเครื่อง ข้อความและคำตอบจะส่งไปยัง Ollama ในอุปกรณ์นี้ Erwin ไม่ค้นหาเว็บเพื่อตอบแชต
- เสียงจะถูกถอดความในเครื่องด้วย Whisper โดยอินเทอร์เน็ตใช้เฉพาะดาวน์โหลดโมเดลเมื่อจำเป็น
- เนื้อหาไฟล์จะถูกใส่ในแชตต่อเมื่อเปิดสิทธิ์ไฟล์และเลือกไฟล์หรือโฟลเดอร์เอง ไฟล์ข้อความหรือซอร์สโค้ดที่รองรับจำกัดไม่เกิน 64 KB ต่อไฟล์ ส่วนโฟลเดอร์อ่านได้สูงสุด 40 ไฟล์ รวมไม่เกิน 80 KB เนื้อหาที่เลือกจะส่งให้ Ollama ในเครื่องและบันทึกในประวัติแชต
- ประวัติแชตและการตั้งค่าความเป็นส่วนตัวบันทึกในฐานข้อมูล SQLite ประจำผู้ใช้ เข้าถึงการตั้งค่าได้จากหน้าต่าง Privacy ในแอป

### การแก้ปัญหาเบื้องต้น

- **เชื่อมต่อ Ollama ไม่ได้:** เปิด Ollama และตรวจสอบว่าบริการในเครื่องทำงานอยู่ จากนั้นตรวจดูว่าได้เปิดสิทธิ์ Local AI service ใน Erwin
- **ไม่พบโมเดล:** รัน `ollama pull qwen3:1.7b` แล้วลองใหม่
- **โหลด Whisper ไม่สำเร็จ:** เปิดสิทธิ์ดาวน์โหลด Whisper ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่ ดูรายละเอียดเพิ่มเติมได้ที่ [docs/VOICE_TROUBLESHOOTING_TH.md](docs/VOICE_TROUBLESHOOTING_TH.md)

### เทคโนโลยีที่ใช้

Tauri 2 · Vue 3 · TypeScript · Vite · Rust · SQLite · Ollama · Transformers.js / Whisper
