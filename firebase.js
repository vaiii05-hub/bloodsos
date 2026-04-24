// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDlFmq0PwGCC3S_e8jaocIGL3Rw6Ef6buM",
  authDomain: "bloodsos-da62b.firebaseapp.com",
  databaseURL: "https://bloodsos-da62b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bloodsos-da62b",
  storageBucket: "bloodsos-da62b.firebasestorage.app",
  messagingSenderId: "397172947589",
  appId: "1:397172947589:web:61e104982919ccb32047ec"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
