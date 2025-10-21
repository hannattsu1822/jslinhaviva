importScripts("https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyB9VxZXQNoV_Uxf0JhMybv145e7nAGBjJA",
  authDomain: "gestao-servicos-notifica-18299.firebaseapp.com",
  projectId: "gestao-servicos-notifica-18299",
  storageBucket: "gestao-servicos-notifica-18299.appspot.com",
  messagingSenderId: "635720711489",
  appId: "1:635720711489:web:42347140989c527bf335c0"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("Received background message ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/static/images/firebase-logo.png", 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
