/*
 * הגדרות ענן (Firebase).
 * כל עוד FIREBASE_CONFIG ריק (null) האפליקציה עובדת במצב מקומי: הקבצים נשמרים רק בדפדפן של המכשיר.
 * כדי לסנכרן בין מכשירים: צור פרויקט ב-Firebase, הדבק כאן את ה-config שלו (ראה README.md).
 */
window.FIREBASE_CONFIG = null;
/* דוגמה:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "my-audio-lib.firebaseapp.com",
  projectId: "my-audio-lib",
  storageBucket: "my-audio-lib.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

/* true = שמירת קבצי השמע ב-Firebase Storage (דורש תוכנית Blaze). false = שמירה בחלקים בתוך Firestore (עובד בתוכנית החינמית) */
window.CLOUD_USE_STORAGE = false;

/* מגבלת נפח לקבצים שנשמרים בתוך Firestore, במגה-בייט (התוכנית החינמית כוללת 1GB) */
window.CLOUD_CAP_MB = 900;
