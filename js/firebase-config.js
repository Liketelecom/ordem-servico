
// Importando o SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDq1hhc2dgcZqVd5F27fKBJfSh0qFi0pQM",
    authDomain: "liketelecom-f3f56.firebaseapp.com",
    projectId: "liketelecom-f3f56",
    storageBucket: "liketelecom-f3f56.firebasestorage.app",
    messagingSenderId: "225206218445",
    appId: "1:225206218445:web:e8f40174f1ce2e57ee0384"
};

// Inicializando o Firebase
const app = initializeApp(firebaseConfig);

// Inicializando o serviço de autenticação
const auth = getAuth(app);

export { auth };
