import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDf7l23Q9tz0eOQupzkUlnMQtSHDvs14QA",
    authDomain: "mcm-reposteria.firebaseapp.com",
    databaseURL: "https://mcm-reposteria-default-rtdb.firebaseio.com",
    projectId: "mcm-reposteria",
    storageBucket: "mcm-reposteria.firebasestorage.app",
    messagingSenderId: "563376696410",
    appId: "1:563376696410:web:deb011d387a85fc7d8bc63",
    measurementId: "G-F6EJR7FKVC"
};

console.log("DEBUG: firebase_config.js LOADED. API Key:", firebaseConfig.apiKey);

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
