// Every piece of on-screen text. Thai labels, Arabic digits.
export default {
  title: 'ระวังหมาดุ',
  startKeyboard: 'กด A กับ D สลับกันเพื่อวิ่ง',
  startPhone: 'แกว่งแขนเพื่อวิ่ง',
  meters: (m) => `${m} ม.`,            // m already formatted
  gap: (m) => `หมาห่าง ${m} ม.`,
  chaseBanner: (sec) => `ฝูงหมาไล่! ${sec} วิ`,
  survived: 'รอดแล้ว!',
  caught: 'หมาทันแล้ว!',
  restart: 'กด R เพื่อเล่นอีกครั้ง',
  phoneLost: 'มือถือหลุด',
  scanToConnect: 'สแกนด้วยมือถือเพื่อใช้เป็นคอนโทรลเลอร์',
  // stick controllers (onsite): connect panel, how-to, drop overlay
  sticks: { waiting: 'รอไม้…', ready: 'พร้อม', phone: 'มือถือ', reconnecting: 'ไม้หลุด กำลังต่อใหม่…', again: 'ปุ่มเล็ก = เล่นอีกรอบ' },
  howTo: ['วิ่งอยู่กับที่ = วิ่ง', 'ดันไม้ทั้งสองขึ้น = กระโดด', 'ปุ่มใหญ่ = เปลี่ยนเลน', 'ปุ่มเล็ก = เริ่ม'],
  // phone controller page
  phone: {
    pickHand: 'ถือมือถือไว้มือไหน?',
    left: 'ซ้าย',
    right: 'ขวา',
    start: 'เริ่ม',
    hand: (h) => (h === 'L' ? 'มือซ้าย' : 'มือขวา'),
    connecting: 'กำลังเชื่อมต่อ…',
    connected: 'เชื่อมต่อแล้ว',
    reconnecting: 'หลุด กำลังต่อใหม่…',
    rtt: (ms) => `หน่วง ${ms} ms`,
    rate: (hz) => `${hz} ครั้ง/วิ`,
    holdTip: 'ถือมือถือให้แน่น แล้วแกว่งแขนวิ่งอยู่กับที่',
    tapTip: (h) => (h === 'L' ? 'แตะจอ = หลบซ้าย' : 'แตะจอ = หลบขวา'),
    denied: 'ไม่ได้รับสิทธิ์ใช้เซ็นเซอร์',
    deniedHow: 'ปิดแท็บนี้ แล้วเปิดลิงก์ใหม่อีกครั้ง จากนั้นกด เริ่ม แล้วเลือก อนุญาต',
    noSensor: 'ไม่พบเซ็นเซอร์การเคลื่อนไหวในเครื่องนี้',
  },
  // Shop signs along the soi: everyday shops only (nothing sacred, no brands).
  signs: ['ข้าวมันไก่', 'ก๋วยเตี๋ยว', 'ชาเย็น', 'ร้านตัดผม', 'ข้าวต้ม', 'โจ๊ก', 'ส้มตำ', 'หมูปิ้ง',
          'กาแฟสด', 'ซ่อมรถ', 'ร้านยา', 'ซักรีด', 'ข้าวผัด', 'ผลไม้', 'ขนมปัง', 'ร้านชำ'],
};
