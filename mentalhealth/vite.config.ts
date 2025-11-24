import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // ใช้ SWC plugin ที่มีประสิทธิภาพ

// URL จริงของคุณที่ใช้ในการ Deploy Google Apps Script
const GAS_REAL_URL = "https://script.google.com/macros/s/AKfycbzmuU_mldbT44f6w1Emt_yP23O2HJq46yHriedBDCdM3UWI2ppw1elGQWOwkSfinJHwmQ/exec";

// Path ที่ใช้เรียกจาก Frontend 
const GAS_PROXY_PATH = '/gas_proxy';


export default defineConfig({
  plugins: [react()],
  server: {
    // *** ส่วนนี้คือการตั้งค่า Proxy เพื่อหลีกเลี่ยง CORS สำหรับ GAS เท่านั้น ***
    proxy: {
      // 1. Proxy สำหรับ Google Apps Script (GAS)
      [GAS_PROXY_PATH]: {
        target: GAS_REAL_URL,
        changeOrigin: true, // เปลี่ยน Origin ของคำขอเป็น Target Host
        secure: false, // ปิดการตรวจสอบ SSL (ช่วยใน Local Dev)
        rewrite: (path) => path.replace(GAS_PROXY_PATH, ''), // ลบ /gas_proxy ออกจาก Path
      },
      // 2. ไม่ต้องมี Proxy สำหรับ Gemini API แล้ว เพราะ KKU API รองรับ CORS
    },
  },
});