# ปงยางคก (pong-yang-kok)

## ภาษาไทย

**ปงยางคก** คือเกมบนเบราว์เซอร์แนวสร้างเมืองผสมจำลองการเมือง คุณเป็นผู้บริหารตำบลปงยางคกในล้านนา วางบ้าน ไร่ เหมือง ร้านค้า และสาธารณูปโภค ดูแลงบประมาณและความนิยม แล้วลงเลือกตั้งทุกปีเพื่อไต่เต้าจากนายกเทศมนตรีตำบลขึ้นไปเป็นนายกรัฐมนตรี

เขียนด้วย HTML/JavaScript ล้วน ไม่ต้องบิลด์ ไม่มีไลบรารีภายนอก บันทึกเกมอัตโนมัติใน `localStorage` ของเบราว์เซอร์

### วิธีเล่น

- **การก่อสร้าง** เลือกสิ่งก่อสร้างจากเมนู "ผังเมือง" (หมวด: ที่อยู่อาศัย, ค้าขาย, เกษตร, เหมือง, โครงสร้าง, ชุมชน) แล้วแตะแปลงว่าง แปลงต้อง **ติดถนน** และถนนต้อง **ต่อถึงซุ้มประตูเมืองด้านตะวันตก** (ทางเข้าเมือง) ถนนที่วางบนลำน้ำจะกลายเป็นสะพาน (฿420) เพื่อข้ามไปฝั่งเหนือ สร้างในลำน้ำอย่างอื่นไม่ได้
- **ไฟฟ้า** อาคารที่ไม่มีไฟฟ้าให้ผลผลิตน้อยลงมาก ต้องมี **โรงไฟฟ้าถ่านหิน** ที่ติดถนน และต้องมี **เหมืองถ่านหิน** ติดถนนเป็นเชื้อเพลิง จากนั้นเดินไฟด้วยเสา: เสาไม้ (ระยะ 3 ช่อง), เสาคอนกรีต (5 ช่อง), เสาแรงสูง (8 ช่อง) เสาเชื่อมกันเมื่อเสาต้นใดต้นหนึ่งเอื้อมถึงอีกต้น
- **สภาเมือง** (ปุ่ม G) ตั้ง **ภาษี** (2–22%) และ **งบบริการ** (0–5) ภาษีสูงได้รายรับมากแต่ความนิยมลด งบบริการสูงช่วยความนิยมแต่รายจ่ายเพิ่ม โรงเรียน สถานีอนามัย วัด และสวน ดูแลประชาชนได้จำนวนจำกัด เมืองโตต้องสร้างเพิ่ม ถ้าเงินคลังติดลบ สามารถ **กู้ฉุกเฉิน** ได้ ฿4,000 ปีละครั้ง (ผ่อนคืนเดือนละ ฿220 รวมดอกเบี้ย 10% และความนิยมลดลง 6)
- **เลือกตั้งประจำปี** ทุก 12 เดือน คะแนนมาจากความนิยมเฉลี่ย 6 เดือนล่าสุด บวกผลงานลงพื้นที่ ความเชื่อมั่น และฐานเสียง ต้องได้ตั้งแต่ 50% จึงชนะ
- **การเลื่อนตำแหน่ง** ชนะเลือกตั้ง 2 สมัยติดต่อกันจึงเลื่อนขั้น: นายกเทศมนตรีตำบล → ผู้บริหารระดับอำเภอ → ผู้บริหารระดับจังหวัด → สมาชิกสภาผู้แทนราษฎร → นายกรัฐมนตรี
- **เมนูการเมือง** (ปุ่ม P) เดือนละหนึ่งครั้งเลือกได้อย่างใดอย่างหนึ่ง: ลงพื้นที่ (฿180 จากเงินพรรค เพิ่มความเชื่อมั่นและคะแนนหาเสียง) หรือ **ซื้อเสียง** (฿900 เพิ่มฐานเสียงชั่วคราว) เงินพรรคเพิ่มเดือนละ ฿100
- **ซื้อเสียงมีความเสี่ยง** ยิ่งซื้อมาก ยิ่งมีโอกาสถูกเปิดโปงตอนเลือกตั้ง (สูงสุด 85%) ถ้าถูกจับได้ จะได้คะแนน 0 แพ้เลือกตั้ง และความเชื่อมั่นลดลงอย่างหนัก
- **ฝ่ายค้าน** เมื่อแพ้เลือกตั้ง คุณเป็นฝ่ายค้าน: สร้าง ขาย ปรับภาษี หรือกู้ไม่ได้ ได้เงินพรรคเดือนละ ฿180 และทำได้เพียงลงพื้นที่/เมนูการเมืองเพื่อกลับมาชนะปีหน้า (คะแนนอิงความนิยมของคู่แข่ง)
- เริ่มเกมด้วยเงินคลัง ฿24,000 ภาษี 8% งบบริการ 2/5 ประชากร 108 คน

### วิธีรันเกม

เปิดไฟล์ `index.html` ในเบราว์เซอร์โดยตรง หรือเปิดเซิร์ฟเวอร์สถิตในโฟลเดอร์นี้:

```sh
npx serve
# หรือ
python -m http.server
```

### ทางลัดคีย์บอร์ด

| ปุ่ม | การทำงาน |
| --- | --- |
| Space | เดินเวลา / หยุดเวลา |
| N | ถัดไป 1 เดือน |
| R | หมุนกล้อง |
| + / - | ซูมเข้า / ซูมออก |
| H | กลับกลางเมือง |
| B | เปิด / พับเมนูผังเมือง |
| 1–9 | เลือกสิ่งก่อสร้างตามลำดับ |
| X | โหมดทุบ / ขาย |
| G | สภาเมือง |
| P | การเมือง |
| M | ปิด / เปิดเสียง |
| , | ตั้งค่า |
| ? | หน้าต่างนี้ |
| Esc | ปิดหน้าต่าง / ยกเลิกเครื่องมือ |

### โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
| --- | --- |
| `index.html` | หน้าเกมหลัก: การเรนเดอร์ การควบคุม และ UI ของเกม |
| `game-core.js` | ตรรกะเกมล้วน (catalog, terrain, buildCost, saleValue, sellTile, newCity, sanitizeCity, analyze, advance, politics, takeLoan) โหลดโดย `index.html` ก่อนสคริปต์หลัก และส่งออกผ่าน `module.exports` เพื่อให้ Node ทดสอบได้ |
| `audio.js` | เสียงที่สังเคราะห์ด้วย WebAudio |
| `ui.js`, `ui.css` | หน้าตั้งค่า บทสอนเล่น และทางลัดคีย์บอร์ด |
| `meadow.webp`, `village.webp` | ภาพประกอบ |
| `package.json` | สคริปต์ `npm test` (ไม่มี dependency) |
| `test/*.test.js` | การทดสอบตรรกะเกม |

### การรันเทสต์

ต้องใช้ Node 18 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม:

```sh
npm test    # = node --test
```

### สัญญาอนุญาต

License: TBD — เจ้าของโครงการยังไม่ได้เลือกสัญญาอนุญาต

---

## English

**ปงยางคก (Pong Yang Kok)** is a browser city-builder with a politics sim. You run a Lanna-style township: place homes, farms, mines, shops and utilities, balance the budget and your popularity, and stand for election every year to climb from township mayor to prime minister. It is plain HTML/JS with no build step and no dependencies; saves go to the browser's `localStorage`.

**Gameplay in brief**
- Build on empty plots next to a road; every road must connect to the western town-gate entrance. Roads over the river become bridges.
- Power needs a coal plant (on a road) fed by a coal mine (on a road), linked to buildings by poles (wood 3, concrete 5, high-voltage 8 tiles).
- At the Town Council (`G`) set tax (2–22%) and services (0–5); take a once-a-year emergency loan of ฿4,000 when the treasury is negative.
- Elections happen every 12 months; you need 50% or more. Two consecutive wins promote you (township → district → province → MP → prime minister).
- Losing makes you the opposition: no building, selling, tax changes or loans, only campaigning until you win back office.
- Vote-buying (฿900 of party funds) boosts your vote but risks exposure at election time (up to 85%), which zeroes your score and costs trust.

**Run:** open `index.html` directly, or serve the folder with `npx serve` or `python -m http.server`.

**Shortcuts:** Space pause/play · N next month · R rotate · +/- zoom · H recentre · B toggle build menu · 1–9 pick building · X demolish/sell · G council · P politics · M mute · `,` settings · `?` this help · Esc close/cancel.

**Layout:** `index.html` (rendering/UI), `game-core.js` (pure game logic, also exported via `module.exports` for Node), `audio.js`, `ui.js`/`ui.css`, `meadow.webp`/`village.webp`, `package.json`, `test/*.test.js`.

**Tests:** Node 18+, no dependencies — `npm test` (runs `node --test`).

**License:** TBD — the owner has not chosen a licence yet.
