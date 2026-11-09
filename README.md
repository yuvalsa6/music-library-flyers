# ספריית שמע לאימונים

אפליקציית ווב שאפשר להתקין (PWA): ספריית שמע לאימונים עם תור תרגילים, לופ A-B, שינוי מהירות, ספירה לאחור, הערות ושליטה ממכשיר אחר.
האפליקציה נבנתה במקור כארטיפקט ב-Claude והועברה לאפליקציה עצמאית.

## מבנה

| קובץ | תפקיד |
|---|---|
| `index.html` | האפליקציה עצמה |
| `cloud.js` | חיבור לענן (Firebase) במקום השירותים של ארטיפקט Claude |
| `config.js` | הגדרות Firebase. זה הקובץ היחיד שצריך לערוך |
| `sw.js`, `manifest.webmanifest`, `icons/` | התקנה למסך הבית ועבודה בלי רשת |
| `vendor/` | ספריית Firebase (גרסה 10.14.1), כלולה מקומית |
| `firestore.rules`, `storage.rules` | כללי אבטחה להדבקה ב-Firebase |

## 1. פרסום האפליקציה (GitHub Pages)

1. מזגו את הקוד לענף `main`.
2. ב-GitHub: **Settings ← Pages ← Source: GitHub Actions**.
3. בכל push ל-`main` האפליקציה מתפרסמת אוטומטית בכתובת `https://<user>.github.io/music-library-flyers/`.

התקנה בטלפון: פותחים את הכתובת ב-Safari (אייפון) או Chrome (אנדרואיד) ← שיתוף / תפריט ← **הוסף למסך הבית**.

## 2. סנכרון בין מכשירים (Firebase, אופציונלי)

בלי הגדרה, האפליקציה עובדת במצב מקומי: הכול נשמר רק בדפדפן של המכשיר.
כדי לסנכרן בין הטלפון, המחשב והמאמנים האחרים:

1. נכנסים ל-[console.firebase.google.com](https://console.firebase.google.com) ← **Add project**.
2. **Build ← Authentication ← Get started ← Sign-in method ← Anonymous ← Enable**.
3. **Build ← Firestore Database ← Create database** (בוחרים מיקום, למשל `eur3`).
   בלשונית **Rules** מדביקים את התוכן של `firestore.rules` ← **Publish**.
4. **Project settings (גלגל שיניים) ← General ← Your apps ← `</>` (Web)**, נותנים שם ומעתיקים את אובייקט `firebaseConfig`.
5. מדביקים אותו ב-`config.js`:
   ```js
   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
   ```
6. ב-**Authentication ← Settings ← Authorized domains** מוסיפים את `<user>.github.io`.

אחרי זה בשורת המצב באפליקציה יופיע "☁ הענן מחובר".

### איפה נשמרים קבצי השמע

- **ברירת מחדל (`CLOUD_USE_STORAGE = false`)**: הקבצים נשמרים בחלקים בתוך Firestore. זה עובד בתוכנית החינמית (Spark), עד 1GB בסך הכול (`CLOUD_CAP_MB` ב-`config.js`).
- **Firebase Storage (`CLOUD_USE_STORAGE = true`)**: מתאים לספרייה גדולה. דורש תוכנית Blaze (עם מכסה חינמית). צריך להפעיל את Storage, להדביק את `storage.rules`, ולהגדיר CORS:
  `gsutil cors set storage-cors.json gs://<storageBucket>`

## הבדלים מהגרסה בארטיפקט

- **Google Drive**: החיבור לדרייב עבד דרך המחברים של Claude ואינו זמין מחוץ ל-Claude. הקבצים נשמרים עכשיו ב-Firebase.
- **הנתונים הקיימים** (שירים, קטגוריות, תור, היסטוריית אימונים) נשארו בארטיפקט ובדרייב ולא עוברים אוטומטית. מעלים מחדש את קבצי השמע (אפשר גם דרך "ייבוא מוואטסאפ (zip)").
- **שליטה ממכשיר אחר** עובדת דרך Firestore. כדי לחסוך במכסה החינמית, עדכוני המצב נשלחים בתדירות נמוכה יותר מאשר בארטיפקט.

## אבטחה

כל מי שפותח את כתובת האפליקציה מתחבר אנונימית ויכול לקרוא ולערוך את הספרייה, בדומה לשיתוף קישור של הארטיפקט. אם צריך הגבלה, אפשר להחליף בכללים את `request.auth != null` ברשימת משתמשים מורשים.

## הרצה מקומית

```bash
python3 -m http.server 8000
# http://localhost:8000
```
