/*
 * הגדרות ענן (Firebase).
 * אם FIREBASE_CONFIG = null האפליקציה עובדת במצב מקומי: הקבצים נשמרים רק בדפדפן של המכשיר.
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCuDCXremgM7V1SszPbb4esX4HkrHL4zRc",
  authDomain: "music-library-flyers.firebaseapp.com",
  projectId: "music-library-flyers",
  storageBucket: "music-library-flyers.firebasestorage.app",
  messagingSenderId: "94769761759",
  appId: "1:94769761759:web:5b7e8e0b48fa6c31f6886a"
};
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
