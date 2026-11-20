# ERWIN — Tauri Desktop Brand Kit

ชุดไฟล์แบรนด์ ERWIN สำหรับโปรเจกต์ Tauri 2 + Vue 3 + TypeScript

## แนวคิด
- Orbit E: วงโคจรสื่อถึงผู้ช่วยที่อยู่เคียงข้าง
- Abstract E: ตัว E เป็นสัญลักษณ์หลัก จดจำได้แม้ใช้เป็นไอคอนขนาดเล็ก
- สีหลัก: Midnight Navy, Electric Blue, Cyan และ Violet

## ไฟล์สำคัญ
- `icons/icon.ico` — ไอคอน Windows executable
- `icons/icon.png` — ไอคอน PNG 1024×1024
- `icons/icon.svg` — ไฟล์เวกเตอร์ต้นฉบับ
- `logo-dark.svg` / `logo-light.svg` — โลโก้แนวนอน
- `logo-monochrome.svg` — โลโก้สีเดียว
- `splash-screen.png` — ภาพตัวอย่าง Splash Screen

## นำไปใช้กับ Tauri
1. สำรองโฟลเดอร์ `src-tauri/icons` เดิมก่อน
2. คัดลอกไฟล์ในโฟลเดอร์ `icons` ไปไว้ที่ `src-tauri/icons`
3. ตรวจสอบ `src-tauri/tauri.conf.json` ให้มีการอ้างอิงไอคอน เช่น

```json
{
  "bundle": {
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ]
  }
}
```

4. Build ใหม่ด้วย `npm run tauri build`

## หมายเหตุ
นี่เป็นชุดแบรนด์และไอคอนเริ่มต้นที่สร้างจากเวกเตอร์ต้นฉบับ สามารถปรับสี รูปทรง และตัวอักษรต่อได้
ไฟล์ splash-screen เป็นภาพประกอบตัวอย่าง ไม่ได้เปิด Splash Screen ให้อัตโนมัติใน Tauri
