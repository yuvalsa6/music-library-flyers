# שרת אחסון שירים: Backblaze B2 + Cloudflare Worker

מה מקבלים: 10GB לשירים בחינם (בערך 1,700 שירים באיכות מקורית), בלי התחברות לחשבון של אף אחד.
Firebase ממשיך לשמור את הרשימות, התיקיות, הסנכרון והשליטה מרחוק.

כל עוד `AUDIO_HOST` ב-`config.js` ריק, האפליקציה עובדת בדיוק כמו קודם.

## חלק א: Backblaze (איפה שהשירים נשמרים)

1. נכנסים ל-[backblaze.com](https://www.backblaze.com/sign-up/cloud-storage) ← נרשמים ל-**B2 Cloud Storage**.
   באזור (Region) כדאי לבחור **EU Central** (הכי קרוב לישראל).
2. בתפריט: **Buckets ← Create a Bucket**
   - **Bucket Unique Name**: שם באנגלית קטנה עם מספרים, למשל `music-lib-4821`
   - **Files in Bucket are**: **Private**
   - שאר ההגדרות כמו שהן ← **Create a Bucket**
3. בכרטיס של ה-Bucket מעתיקים את השורה **Endpoint**, למשל `s3.eu-central-003.backblazeb2.com`.
4. בתפריט: **Caps & Alerts** ← בכל השורות קובעים תקרה של **$0** ← **Update Caps**.
   כך אי אפשר לקבל חיוב, גם אם משהו חורג.
5. בתפריט: **Application Keys ← Add a New Application Key**
   - **Name of Key**: `audio-worker`
   - **Allow access to Bucket(s)**: ה-Bucket שיצרת
   - **Type of Access**: **Read and Write**
   - ← **Create New Key**
6. מעתיקים למקום בטוח את **keyID** ואת **applicationKey**. את applicationKey רואים רק פעם אחת.

## חלק ב: Cloudflare (שומר הסף)

1. נכנסים ל-[dash.cloudflare.com](https://dash.cloudflare.com/sign-up) ← נרשמים (חינם).
2. בתפריט: **Workers & Pages ← Create ← Create Worker** (התבנית "Hello World").
   שם: `audio-lib` ← **Deploy**.
3. **Edit code** ← מוחקים את כל הקוד ← מדביקים את כל התוכן של
   [worker/audio-worker.js](https://raw.githubusercontent.com/yuvalsa6/music-library-flyers/main/worker/audio-worker.js) ← **Deploy**.
4. חוזרים ל-Worker ← **Settings ← Variables and Secrets ← Add**, ומוסיפים 5 משתנים:

   | שם | סוג | ערך |
   |---|---|---|
   | `B2_ENDPOINT` | Text | ה-Endpoint מחלק א שלב 3 |
   | `B2_BUCKET` | Text | שם ה-Bucket |
   | `B2_KEY_ID` | Secret | keyID |
   | `B2_APP_KEY` | Secret | applicationKey |
   | `LIB_CODES` | Secret | קוד הספרייה (אותו קוד שמקלידים באפליקציה) |

   ← **Deploy** / **Save**.
5. מעתיקים את כתובת ה-Worker, שנראית כך: `https://audio-lib.<שם>.workers.dev`
6. בדיקה: פותחים בדפדפן `https://audio-lib.<שם>.workers.dev/ping?k=<קוד הספרייה>`.
   צריך להופיע `{"ok":true}`. אל תשתפו את הקישור הזה, כי יש בו את הקוד.

## חלק ג: חיבור לאפליקציה

1. ב-`config.js` ממלאים `window.AUDIO_HOST = "https://audio-lib.<שם>.workers.dev";` (בלי הקוד).
   `AUDIO_MIGRATE` נשאר `false`: שירים חדשים נשמרים בשרת, הישנים נשארים ב-Firebase.
2. מעלים שיר אחד לבדיקה, ובודקים שהוא מתנגן גם במכשיר אחר.
   בהגדרות ← אחסון יש כפתור **"בדיקת חיבור לשרת"**.
3. אחרי שהבדיקה עברה: `window.AUDIO_MIGRATE = true;`
   השירים הישנים עוברים לשרת ברקע (ממכשיר שיש בו את הקבצים), ומקומם ב-Firebase מתפנה.

## איך זה עובד

- השירים נשמרים ב-Bucket בתיקייה לכל ספרייה. שם התיקייה מחושב מהקוד, אבל הקוד עצמו לא מופיע בו.
- ה-Worker עונה רק כשהקוד שהאפליקציה שולחת נמצא ב-`LIB_CODES`. כדי לפתוח ספרייה נוספת, מוסיפים את הקוד שלה עם פסיק.
- מפתחות Backblaze שמורים רק ב-Cloudflare, ולא ב-GitHub.
- הורדות מ-Backblaze חינמיות עד פי 3 מהנפח השמור בכל חודש. כל מכשיר שומר את השירים אצלו אחרי ההורדה הראשונה.
