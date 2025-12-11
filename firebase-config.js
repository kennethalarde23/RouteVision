import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvIzMQnaJVHCkeJMMmUgx2QJLJLQ_zva4",
  authDomain: "routevision-1ae3a.firebaseapp.com",
  projectId: "routevision-1ae3a",
  storageBucket: "routevision-1ae3a.firebasestorage.app",
  messagingSenderId: "1032650918786",
  appId: "1:1032650918786:web:b530097f32aed09539dd9b",
  measurementId: "G-708KD2ZL68"
};



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };