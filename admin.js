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
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Variables globales
let currentUser = null;
let articleToDelete = null;
let editMode = false;
let currentEditId = null;
let uploadedImageUrl = null;

// Éléments DOM
const loginSection = document.getElementById('loginSection');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const articleForm = document.getElementById('articleForm');
const adminArticlesList = document.getElementById('adminArticlesList');
const deleteModal = document.getElementById('deleteModal');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');
const userEmailDisplay = document.getElementById('userEmail');
const mediaHelper = document.getElementById('mediaHelper');

// Gestion de l'authentification
auth.onAuthStateChanged(user => {
    currentUser = user;
    
    if (user) {
        loginSection.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;
        
        loadAdminArticles();
        loadStatistics();
        loadNewsletterSubscribers();
    } else {
        loginSection.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
});

// Connexion
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Connexion réussie !', 'success');
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showNotification('Erreur de connexion: ' + error.message, 'error');
    }
});

// Déconnexion
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showNotification('Déconnexion réussie', 'success');
    } catch (error) {
        console.error('Erreur de déconnexion:', error);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
});

// Upload d'image
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('L\'image ne doit pas dépasser 5MB', 'error');
        return;
    }
    
    showNotification('Upload en cours...', 'info');
    
    try {
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`articles/${Date.now()}_${file.name}`);
        
        await fileRef.put(file);
        uploadedImageUrl = await fileRef.getDownloadURL();
        
        document.getElementById('imageUrl').value = uploadedImageUrl;
        
        // Afficher aperçu
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${uploadedImageUrl}" alt="Preview"><button type="button" class="remove-preview" onclick="removeImagePreview()"><i class="fas fa-times"></i></button>`;
        preview.classList.remove('hidden');
        
        showNotification('Image uploadée avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur upload:', error);
        showNotification('Erreur lors de l\'upload: ' + error.message, 'error');
    }
}

function removeImagePreview() {
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imageUrl').value = '';
    document.getElementById('imageFile').value = '';
    uploadedImageUrl = null;
}

// Helpers pour ajouter médias
function showImageUrlHelper() {
    document.getElementById('mediaHelperTitle').textContent = 'Ajouter une image';
    document.getElementById('mediaHelperText').textContent = 'Collez l\'URL de l\'image que vous souhaitez insérer dans le contenu:';
    document.getElementById('mediaHelperInput').placeholder = 'https://exemple.com/image.jpg';
    mediaHelper.classList.remove('hidden');
}

function showVideoHelper() {
    document.getElementById('mediaHelperTitle').textContent = 'Ajouter une vidéo YouTube';
    document.getElementById('mediaHelperText').textContent = 'Collez le lien YouTube de la vidéo:';
    document.getElementById('mediaHelperInput').placeholder = 'https://www.youtube.com/watch?v=...';
    mediaHelper.classList.remove('hidden');
}

function closeMediaHelper() {
    mediaHelper.classList.add('hidden');
    document.getElementById('mediaHelperInput').value = '';
}

function insertMedia() {
    const url = document.getElementById('mediaHelperInput').value.trim();
    if (!url) return;
    
    const contentTextarea = document.getElementById('content');
    const currentContent = contentTextarea.value;
    
    // Ajouter l'URL sur une nouvelle ligne
    contentTextarea.value = currentContent + '\n' + url + '\n';
    
    closeMediaHelper();
    showNotification('Média ajouté au contenu', 'success');
}

// Publier ou Modifier un article
articleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Vous devez être connecté', 'error');
        return;
    }
    
    const tags = document.getElementById('tags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t !== '');
    
    const article = {
        title: document.getElementById('title').value.trim(),
        category: document.getElementById('category').value,
        imageUrl: document.getElementById('imageUrl').value.trim(),
        summary: document.getElementById('summary').value.trim(),
        content: document.getElementById('content').value.trim(),
        tags: tags,
        featured: document.getElementById('featured').checked,
        author: currentUser.email
    };
    
    try {
        if (editMode && currentEditId) {
            // Mode édition
            await db.collection('articles').doc(currentEditId).update({
                ...article,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('Article modifié avec succès !', 'success');
            cancelEdit();
        } else {
            // Mode création
            article.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            article.views = 0;
            article.commentsCount = 0;
            article.reactions = { like: 0, love: 0, star: 0 };
            
            await db.collection('articles').add(article);
            
            articleForm.reset();
            removeImagePreview();
            
            showNotification('Article publié avec succès !', 'success');
        }
        
        loadAdminArticles();
        loadStatistics();
        
        document.getElementById('adminArticlesList').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
        
    } catch (error) {
        console.error('Erreur lors de la publication:', error);
        showNotification('Erreur lors de la publication: ' + error.message, 'error');
    }
});

// Charger les articles dans l'admin
async function loadAdminArticles() {
    adminArticlesList.innerHTML = `
        <div class="loading-container">
            <i class="fas fa-spinner fa-spin loading-icon"></i>
            <p class="loading-text">Chargement...</p>
        </div>
    `;
    
    try {
        const snapshot = await db.collection('articles')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            adminArticlesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-newspaper"></i>
                    <p>Aucun article pour le moment</p>
                    <p style="font-size: 0.875rem;">Commencez par publier votre premier article !</p>
                </div>
            `;
            return;
        }
        
        adminArticlesList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const article = doc.data();
            const articleElement = createAdminArticleItem(doc.id, article);
            adminArticlesList.appendChild(articleElement);
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        adminArticlesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                <p style="color: #dc2626;">Erreur lors du chargement</p>
            </div>
        `;
    }
}

// Créer un élément d'article pour l'admin
function createAdminArticleItem(id, article) {
    const div = document.createElement('div');
    div.className = 'article-item';
    
    const date = article.createdAt 
        ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        })
        : 'Non daté';
    
    const featuredBadge = article.featured ? '<span class="featured-badge"><i class="fas fa-star"></i> En vedette</span>' : '';
    
    div.innerHTML = `
        <div class="article-info">
            <h3 class="article-title-admin">${escapeHtml(article.title)} ${featuredBadge}</h3>
            <p class="article-meta-admin">
                <span>${escapeHtml(article.category)}</span> • 
                <span>${date}</span> • 
                <span><i class="fas fa-eye"></i> ${article.views || 0} vues</span> • 
                <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
            </p>
        </div>
        <div class="article-actions">
            <button class="btn-icon btn-edit" onclick="editArticle('${id}')">
                <i class="fas fa-edit"></i>
                Modifier
            </button>
            <button class="btn-icon btn-delete" onclick="showDeleteModal('${id}')">
                <i class="fas fa-trash"></i>
                Supprimer
            </button>
        </div>
    `;
    
    return div;
}

// Éditer un article
async function editArticle(articleId) {
    try {
        const doc = await db.collection('articles').doc(articleId).get();
        
        if (!doc.exists) {
            showNotification('Article introuvable', 'error');
            return;
        }
        
        const article = doc.data();
        
        // Remplir le formulaire
        document.getElementById('title').value = article.title;
        document.getElementById('category').value = article.category;
        document.getElementById('imageUrl').value = article.imageUrl || '';
        document.getElementById('summary').value = article.summary;
        document.getElementById('content').value = article.content;
        document.getElementById('tags').value = (article.tags || []).join(', ');
        document.getElementById('featured').checked = article.featured || false;
        
        // Afficher aperçu image si présente
        if (article.imageUrl) {
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${article.imageUrl}" alt="Preview"><button type="button" class="remove-preview" onclick="removeImagePreview()"><i class="fas fa-times"></i></button>`;
            preview.classList.remove('hidden');
        }
        
        // Passer en mode édition
        editMode = true;
        currentEditId = articleId;
        
        document.getElementById('formTitle').textContent = 'Modifier l\'article';
        document.getElementById('submitBtnText').textContent = 'Enregistrer les modifications';
        
        // Scroll vers le formulaire
        document.getElementById('articleForm').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        showNotification('Vous pouvez maintenant modifier cet article', 'info');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement de l\'article', 'error');
    }
}

// Annuler l'édition
function cancelEdit() {
    editMode = false;
    currentEditId = null;
    
    articleForm.reset();
    removeImagePreview();
    
    document.getElementById('formTitle').textContent = 'Nouvel Article';
    document.getElementById('submitBtnText').textContent = 'Publier l\'article';
}

// Afficher le modal de suppression
function showDeleteModal(articleId) {
    articleToDelete = articleId;
    deleteModal.classList.remove('hidden');
}

// Cacher le modal de suppression
function hideDeleteModal() {
    articleToDelete = null;
    deleteModal.classList.add('hidden');
}

// Confirmer la suppression
confirmDelete.addEventListener('click', async () => {
    if (!articleToDelete) return;
    
    try {
        // Supprimer les commentaires
        const commentsSnapshot = await db.collection('articles')
            .doc(articleToDelete)
            .collection('comments')
            .get();
        
        const deletePromises = commentsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        
        // Supprimer l'article
        await db.collection('articles').doc(articleToDelete).delete();
        
        hideDeleteModal();
        loadAdminArticles();
        loadStatistics();
        
        showNotification('Article supprimé avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showNotification('Erreur lors de la suppression: ' + error.message, 'error');
    }
});

// Annuler la suppression
cancelDelete.addEventListener('click', hideDeleteModal);

// Fermer le modal en cliquant sur l'overlay
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal || e.target.classList.contains('modal-overlay')) {
        hideDeleteModal();
    }
});

// Charger les statistiques
async function loadStatistics() {
    try {
        const snapshot = await db.collection('articles').get();
        const total = snapshot.size;
        
        // Articles d'aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let todayCount = 0;
        let totalViews = 0;
        
        snapshot.forEach(doc => {
            const article = doc.data();
            
            if (article.createdAt) {
                const articleDate = article.createdAt.toDate();
                if (articleDate >= today) {
                    todayCount++;
                }
            }
            
            totalViews += (article.views || 0);
        });
        
        document.getElementById('totalArticles').textContent = total;
        document.getElementById('todayArticles').textContent = todayCount;
        document.getElementById('totalViews').textContent = totalViews.toLocaleString();
        
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
    }
}

// Charger les abonnés newsletter
async function loadNewsletterSubscribers() {
    const newsletterList = document.getElementById('newsletterList');
    
    try {
        const snapshot = await db.collection('newsletter')
            .orderBy('subscribedAt', 'desc')
            .get();
        
        document.getElementById('newsletterSubs').textContent = snapshot.size;
        
        if (snapshot.empty) {
            newsletterList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope"></i>
                    <p>Aucun abonné pour le moment</p>
                </div>
            `;
            return;
        }
        
        newsletterList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const subscriber = doc.data();
            const date = subscriber.subscribedAt 
                ? new Date(subscriber.subscribedAt.toDate()).toLocaleDateString('fr-FR')
                : 'Date inconnue';
            
            const div = document.createElement('div');
            div.className = 'newsletter-item';
            div.innerHTML = `
                <div class="newsletter-info">
                    <i class="fas fa-envelope-open"></i>
                    <span>${escapeHtml(subscriber.email)}</span>
                </div>
                <span class="newsletter-date">${date}</span>
            `;
            newsletterList.appendChild(div);
        });
        
    } catch (error) {
        console.error('Erreur chargement newsletter:', error);
        newsletterList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>
                <p style="color: #dc2626;">Erreur lors du chargement</p>
            </div>
        `;
    }
}

// Exporter Newsletter en Excel (Email + Date + Heure)
async function exportNewsletterXLSX() {
    try {
        const snapshot = await db.collection('newsletter').get();
        const subscribers = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                // Récupérer la date et l'heure d'inscription si elles existent
                let date = "Date inconnue";
                let heure = "Heure inconnue";

                if (data.subscribedAt) {
                    const fullDate = data.subscribedAt.toDate();
                    date = fullDate.toLocaleDateString('fr-FR'); // ex: 20/01/2026
                    heure = fullDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); // ex: 17:44
                }

                // Ajouter Email + Date + Heure dans l'objet
                subscribers.push({
                    Email: data.email,
                    DateInscription: date,
                    HeureInscription: heure
                });
            }
        });

        if (subscribers.length === 0) {
            showNotification("Aucun abonné à exporter", "info");
            return;
        }

        // Créer une feuille Excel avec Email + Date + Heure
        const worksheet = XLSX.utils.json_to_sheet(subscribers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Newsletter");

        // Générer et télécharger le fichier
        XLSX.writeFile(workbook, "newsletter_abonnes.xlsx");

        showNotification("Export Excel généré avec succès !", "success");
    } catch (error) {
        console.error("Erreur export newsletter XLSX:", error);
        showNotification("Erreur lors de l'export Excel: " + error.message, "error");
    }
}

// Exporter Newsletter en CSV (seulement emails)
async function exportNewsletterCSV() {
    try {
        const snapshot = await db.collection('newsletter').get();
        const subscribers = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) {
                subscribers.push(data.email);
            }
        });

        if (subscribers.length === 0) {
            showNotification("Aucun abonné à exporter", "info");
            return;
        }

        const csvContent = "data:text/csv;charset=utf-8," 
            + subscribers.join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "newsletter_emails.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification("Export CSV généré avec succès !", "success");
    } catch (error) {
        console.error("Erreur export newsletter CSV:", error);
        showNotification("Erreur lors de l'export CSV: " + error.message, "error");
    }
}

// Fonction pour afficher une notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 5rem;
        right: 1rem;
        background-color: ${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        max-width: 20rem;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Fonction pour échapper les caractères HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Ajouter les animations CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);