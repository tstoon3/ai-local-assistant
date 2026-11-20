# บันทึกการแก้ปัญหาเสียงของ Erwin

เอกสารนี้แนบไปกับตัวติดตั้ง Erwin เพื่อบันทึก error ที่พบและการแก้ไขล่าสุด

## อาการและ log ที่ได้รับ

1. `Could not load local Whisper... TypeError: Failed to fetch`
   - Whisper โหลดโมเดลจาก Hugging Face ไม่สำเร็จ
2. `no available backend found ... Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.mjs`
   - ONNX Runtime พยายามโหลดไฟล์ backend จาก jsDelivr ในตัวติดตั้ง
3. `no available backend found ... RuntimeError: Aborted(both async and sync fetching of the wasm failed)`
   - หลัง bundle ไฟล์ `.mjs` และ `.wasm` มาในแอปแล้ว การ fetch ไฟล์ WASM ในเครื่องยังถูก CSP บล็อก เพราะ `connect-src` ที่กำหนดเองไม่มี `'self'` และ Tauri asset origin

## การแก้ไขที่ทำ

- เพิ่มโดเมน Hugging Face CDN ใต้ `hf.co` ใน CSP สำหรับดาวน์โหลดโมเดล Whisper
- bundle ONNX Runtime `.mjs` และ `.wasm` ไปกับแอป และชี้ `wasmPaths` ไปยังไฟล์เหล่านี้แทน jsDelivr
- เพิ่ม `'self'`, `asset:` และ `http://asset.localhost` ใน `connect-src` เพื่อให้ WebView โหลด WASM ที่ bundle ในเครื่องได้
- เพิ่ม Tauri WebView microphone permission handler สำหรับ Windows WebView2 โดยหน้าแอปยังปิดการเรียกไมโครโฟนเมื่อ `Microphone access` ปิดอยู่

## วิธีเริ่มใช้เสียงหลังติดตั้ง

1. เปิด `Internet access` และ `Microphone access` ใน Privacy settings ของ Erwin
2. อนุญาตการใช้ไมโครโฟนใน Windows และรอ Whisper ดาวน์โหลดโมเดลจนเสร็จในครั้งแรก
3. หลังจากโมเดลถูก cache แล้ว สามารถปิด `Internet access` และใช้ Whisper ในเครื่องได้
4. ถ้ายังพบ error ให้บันทึกข้อความเต็มจากกล่อง error ในหน้าคุยด้วยเสียง พร้อมระบุว่าหยุดที่สถานะใด

## สถานะการตรวจสอบ

- Vue/TypeScript production build ผ่าน และมี ONNX `.mjs` กับ `.wasm` อยู่ใน `dist/assets`
- Tauri Windows release build และ NSIS installer ผ่านหลังแก้ CSP ล่าสุด; เอกสารนี้ถูกคัดลอกไปไว้ที่ `resources/docs/VOICE_TROUBLESHOOTING_TH.md`
- การคุยด้วยเสียงจริงบนเครื่องผู้ใช้ยังต้องทดสอบหลังติดตั้ง build ล่าสุด

