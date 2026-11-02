// ============================================================
//  KUKKARO – ASETUKSET
// ============================================================

// 1) Firebase-projektin "kukkaro-7ed0e" asetukset
//    Firebase Console → Project settings (rataskuvake) → General →
//    "Your apps" → Web app (</>) → SDK setup and configuration → Config
//    Kopioi arvot alle LIITÄ_TÄHÄN-kohtien tilalle.
export const firebaseConfig = {
  apiKey: "AIzaSyB8K4dLzc-D5uY4Yr1TXOF3LwyASn-zYHw",
  authDomain: "kukkaro-7ed0e.firebaseapp.com",
  projectId: "kukkaro-7ed0e",
  storageBucket: "kukkaro-7ed0e.firebasestorage.app",
  messagingSenderId: "146815999490",
  appId: "1:146815999490:web:16110168fee3291ee6911b"
};

// 2) Sähköposti, joka on valmiina kirjautumissivulla.
//    Sama käyttäjä luodaan Firebase Console → Authentication → Users → Add user.
export const LOGIN_EMAIL = "terokulju95@gmail.com";

// Sovelluksen nimi (voi muuttaa myös sovelluksessa: Asetukset → Ulkoasu)
export const APP_NAME = "Kukkaro";
