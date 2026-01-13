<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDf7L23Q9Tz0eOQupzkUInMQtSHDvs14QA",
    authDomain: "mcm-reposteria.firebaseapp.com",
    projectId: "mcm-reposteria",
    messagingSenderId: "563376694610",
    appId: "1:563376694610:web:deb011d387a85c7d8bc63"
  };

  export const app = initializeApp(firebaseConfig);
  export const db = getFirestore(app);
</script>
