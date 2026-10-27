// Every piece of on-screen text. Thai labels, Arabic digits.
export default {
  title: 'ซอยผี',
  startKeyboard: 'กด A กับ D สลับกันเพื่อวิ่ง',
  startPhone: 'แกว่งแขนเพื่อวิ่ง',
  meters: (m) => `${m} ม.`,            // m already formatted
  gap: (m) => `ผีห่าง ${m} ม.`,
  chaseBanner: (sec) => `ไล่ล่า ${sec} วิ!`,
  survived: 'รอดแล้ว!',
  caught: 'โดนจับแล้ว!',
  restart: 'กด R เพื่อเล่นอีกครั้ง',
  phoneLost: 'มือถือหลุด',
  scanToConnect: 'สแกนด้วยมือถือเพื่อใช้เป็นคอนโทรลเลอร์',
  // Shop signs along the soi: everyday shops only (nothing sacred, no brands).
  signs: ['ข้าวมันไก่', 'ก๋วยเตี๋ยว', 'ชาเย็น', 'ร้านตัดผม', 'ข้าวต้ม', 'โจ๊ก', 'ส้มตำ', 'หมูปิ้ง',
          'กาแฟสด', 'ซ่อมรถ', 'ร้านยา', 'ซักรีด', 'ข้าวผัด', 'ผลไม้', 'ขนมปัง', 'ร้านชำ'],
};
