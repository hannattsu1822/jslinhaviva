import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9VxZXQNoV_Uxf0JhMybv145e7nAGBjJA",
  authDomain: "gestao-servicos-notifica-18299.firebaseapp.com",
  projectId: "gestao-servicos-notifica-18299",
  storageBucket: "gestao-servicos-notifica-18299.appspot.com",
  messagingSenderId: "635720711489",
  appId: "1:635720711489:web:42347140989c527bf335c0"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { messaging, getToken };
