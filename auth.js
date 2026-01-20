// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAlBDedWLbHG-3UnijsSfocm77sNpn15Wg",
    authDomain: "electroactu-b6050.firebaseapp.com",
    projectId: "electroactu-b6050",
    storageBucket: "electroactu-b6050.firebasestorage.app",
    messagingSenderId: "890343912768",
    appId: "1:890343912768:web:87de595f6df3c3f434f6a5"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Vérifier si l'utilisateur est déjà connecté
auth.onAuthStateChanged(user => {
    if (user) {
        // Rediriger vers la page d'accueil si déjà connecté
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || 'index.html';
        window.location.href = redirect;
    }
});

// Gestion des onglets
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Mettre à jour les onglets
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Mettre à jour les formulaires
    document.querySelectorAll('.auth-form-container').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Connexion
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    try {
        const persistence = rememberMe ? 
            firebase.auth.Auth.Persistence.LOCAL : 
            firebase.auth.Auth.Persistence.SESSION;
        
        await auth.setPersistence(persistence);
        await auth.signInWithEmailAndPassword(email, password);
        
        showNotification('Connexion réussie !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        let message = 'Erreur lors de la connexion';
        
        if (error.code === 'auth/user-not-found') {
            message = 'Aucun compte trouvé avec cet email';
        } else if (error.code === 'auth/wrong-password') {
            message = 'Mot de passe incorrect';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Email invalide';
        }
        
        showNotification(message, 'error');
    }
});

// Inscription
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
        showNotification('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    // Vérifier la longueur du mot de passe
    if (password.length < 6) {
        showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    try {
        // Créer le compte
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Mettre à jour le profil avec le nom
        await user.updateProfile({
            displayName: name
        });
        
        // Sauvegarder les informations utilisateur dans Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            photoURL: null
        });
        
        showNotification('Compte créé avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        let message = 'Erreur lors de la création du compte';
        
        if (error.code === 'auth/email-already-in-use') {
            message = 'Cet email est déjà utilisé';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Email invalide';
        } else if (error.code === 'auth/weak-password') {
            message = 'Mot de passe trop faible';
        }
        
        showNotification(message, 'error');
    }
});

// Connexion avec Google
async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Vérifier si c'est un nouvel utilisateur
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Créer le profil pour les nouveaux utilisateurs
            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        showNotification('Connexion réussie !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la connexion avec Google', 'error');
    }
}

// Afficher/Masquer mot de passe
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Vérifier la force du mot de passe
document.getElementById('registerPassword')?.addEventListener('input', (e) => {
    const password = e.target.value;
    const strengthDiv = document.getElementById('passwordStrength');
    
    if (password.length === 0) {
        strengthDiv.innerHTML = '';
        return;
    }
    
    let strength = 0;
    let feedback = '';
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    switch(strength) {
        case 0:
        case 1:
            feedback = '<span class="strength-weak">Faible</span>';
            break;
        case 2:
            feedback = '<span class="strength-medium">Moyen</span>';
            break;
        case 3:
            feedback = '<span class="strength-good">Bon</span>';
            break;
        case 4:
            feedback = '<span class="strength-strong">Fort</span>';
            break;
    }
    
    strengthDiv.innerHTML = `Force du mot de passe : ${feedback}`;
});

// Mot de passe oublié
function showForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
}

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value.trim();
    
    try {
        await auth.sendPasswordResetEmail(email);
        showNotification('Email de réinitialisation envoyé !', 'success');
        closeForgotPassword();
        document.getElementById('forgotPasswordForm').reset();
        
    } catch (error) {
        console.error('Erreur:', error);
        let message = 'Erreur lors de l\'envoi de l\'email';
        
        if (error.code === 'auth/user-not-found') {
            message = 'Aucun compte trouvé avec cet email';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Email invalide';
        }
        
        showNotification(message, 'error');
    }
});

// Notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}