
// Importando o SDK do Firebase
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Função para realizar login
function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Login realizado com sucesso
            const user = userCredential.user;
            console.log(`Usuário logado: ${user.email}`);
            toggleDashboard(true);
        })
        .catch((error) => {
            console.error(`Erro ao logar: ${error.message}`);
            alert('Falha no login. Verifique suas credenciais.');
        });
}

// Função para realizar logout
function logout() {
    signOut(auth).then(() => {
        console.log('Usuário deslogado');
        toggleDashboard(false);
    }).catch((error) => {
        console.error(`Erro ao deslogar: ${error.message}`);
        alert('Erro ao tentar deslogar.');
    });
}

// Verificação de sessão
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado
        console.log(`Sessão ativa: ${user.email}`);
        toggleDashboard(true);

        // Detecção de tipo de usuário baseado no email
        if (user.email.endsWith('@admin.com')) {
            console.log('Usuário administrador');
            // Implementar funcionalidades específicas para administrador
            document.getElementById('adminFeatures').classList.remove('hidden');
        } else {
            console.log('Usuário padrão');
            // Implementar funcionalidades específicas para usuário padrão
            document.getElementById('adminFeatures').classList.add('hidden');
        }
    } else {
        // Usuário não está logado
        console.log('Nenhum usuário logado');
        toggleDashboard(false);
    }
});

// Função para alternar entre login e dashboard
function toggleDashboard(isLoggedIn) {
    document.getElementById('login').classList.toggle('hidden', isLoggedIn);
    document.getElementById('dashboard').classList.toggle('hidden', !isLoggedIn);
}

// Adicionando eventos aos botões
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('logoutBtn').addEventListener('click', logout);

// Funcionalidades básicas de ordens de serviço
function manageOrders() {
    // Implementar lógica para gerenciar ordens de serviço
    console.log('Gerenciando ordens de serviço');
}

// Interface responsiva
window.addEventListener('resize', () => {
    // Implementar lógica para ajustar a interface conforme o tamanho da tela
    console.log('Interface ajustada');
});
