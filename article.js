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

// Variables globales
let currentArticleId = null;
let userReactions = {};

// Récupérer l'ID de l'article depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const articleId = urlParams.get('id');

// Éléments DOM
const loadingState = document.getElementById('loadingState');
const articleContainer = document.getElementById('articleContainer');
const errorState = document.getElementById('errorState');
const newsletterModal = document.getElementById('newsletterModal');
const themeToggle = document.getElementById('themeToggle');

// Charger l'article au démarrage
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadUserReactions();
    
    if (articleId) {
        loadArticle(articleId);
    } else {
        showError();
    }
    
    setupEventListeners();
});

// Configuration des événements
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Réactions
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', handleReaction);
    });
    
    // Commentaire
    document.getElementById('commentForm').addEventListener('submit', submitComment);
    
    // Newsletter
    document.getElementById('newsletterForm').addEventListener('submit', submitNewsletter);
    
    // Smooth scroll pour navigation rapide
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Charger l'article
async function loadArticle(id) {
    currentArticleId = id;
    
    try {
        const doc = await db.collection('articles').doc(id).get();
        
        if (!doc.exists) {
            showError();
            return;
        }
        
        const article = doc.data();
        
        // Incrémenter les vues
        await db.collection('articles').doc(id).update({
            views: firebase.firestore.FieldValue.increment(1)
        });
        
        // Afficher l'article
        displayArticle(article);
        
        // Charger les données supplémentaires
        loadReactions(id);
        loadComments(id);
        loadRelatedArticles(article.category);
        
        // Cacher le loading, afficher le contenu
        loadingState.classList.add('hidden');
        articleContainer.classList.remove('hidden');
        
        // Mettre à jour le titre de la page
        document.title = `${article.title} | Électro-Actu`;
        
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        showError();
    }
}

// Afficher l'article
function displayArticle(article) {
    // Image
    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1200&q=80';
    document.getElementById('articleImage').src = imgUrl;
    document.getElementById('articleImage').alt = article.title;
    
    // Titre
    document.getElementById('articleTitle').textContent = article.title;
    
    // Catégorie
    const categoryBadge = document.getElementById('articleCategory');
    categoryBadge.textContent = article.category;
    categoryBadge.className = `article-category-badge category-${getCategoryClass(article.category)}`;
    
    // Date
    const date = article.createdAt 
        ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        })
        : 'Date inconnue';
    document.getElementById('articleDate').textContent = date;
    
    // Temps de lecture
    const readTime = calculateReadingTime(article.content);
    document.getElementById('articleReadTime').textContent = `${readTime} min de lecture`;
    
    // Vues
    document.getElementById('articleViews').textContent = (article.views || 0) + 1;
    
    // Résumé
    document.getElementById('articleSummary').textContent = article.summary;
    
    // Contenu
    document.getElementById('articleBody').innerHTML = formatArticleContent(article.content);
    
    // Tags
    displayTags(article.tags);
}

// Formater le contenu
function formatArticleContent(content) {
    if (!content) return '';
    
    const lines = content.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Ignorer les lignes vides
        if (line === '') {
            continue;
        }
        
        // Nettoyer complètement la ligne de tous les espaces invisibles
        line = line.replace(/\s+/g, ' ').trim();
        
        // Test 1: Est-ce une URL qui commence par http/https ?
        const startsWithHttp = /^https?:\/\//i.test(line);
        
        if (startsWithHttp) {
            // Test 2: Est-ce une URL YouTube ?
            const youtubeMatch = line.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i);
            
            if (youtubeMatch) {
                // C'EST UNE VIDÉO YOUTUBE
                const videoId = youtubeMatch[1];
                result.push(`<div class="video-container">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen
                        loading="lazy">
                    </iframe>
                </div>`);
                continue;
            }
            
            // Test 3: Contient-elle une extension d'image OU vient-elle d'un service d'image connu ?
            const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(line);
            const isImageService = /^https?:\/\/(.*?)(unsplash\.com|pexels\.com|pixabay\.com|imgur\.com|cloudinary\.com|bing\.com\/th\/id|images\.unsplash\.com|th\.bing\.com)/i.test(line);
            
            if (hasImageExtension || isImageService) {
                // C'EST UNE IMAGE
                result.push(`<img src="${line}" alt="Image de l'article" class="content-image" loading="lazy">`);
                continue;
            }
            
            // C'est un autre type de lien
            result.push(`<p><a href="${line}" target="_blank" rel="noopener noreferrer" class="content-link">${line}</a></p>`);
            continue;
        }
        
        // Si la ligne contient http mais ne commence pas par http
        if (line.includes('http')) {
            // Remplacer les URLs dans le texte par des liens
            const linkedText = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="content-link">$1</a>');
            result.push(`<p>${linkedText}</p>`);
            continue;
        }
        
        // Texte normal
        result.push(`<p>${escapeHtml(line)}</p>`);
    }
    
    return result.join('');
}

// Afficher les tags
function displayTags(tags) {
    const container = document.getElementById('articleTags');
    
    if (!tags || tags.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '<h3 class="tags-section-title"><i class="fas fa-tags mr-2"></i>Tags</h3>';
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'tags-list';
    
    tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag-badge';
        tagSpan.textContent = tag;
        tagsDiv.appendChild(tagSpan);
    });
    
    container.appendChild(tagsDiv);
}

// Charger les réactions
async function loadReactions(articleId) {
    try {
        const doc = await db.collection('articles').doc(articleId).get();
        const reactions = doc.data().reactions || { like: 0, love: 0, star: 0 };
        
        document.getElementById('likeCount').textContent = reactions.like || 0;
        document.getElementById('loveCount').textContent = reactions.love || 0;
        document.getElementById('starCount').textContent = reactions.star || 0;
        
        // Vérifier si l'utilisateur a déjà réagi
        const userReaction = userReactions[articleId];
        if (userReaction) {
            document.getElementById(`${userReaction}Btn`).classList.add('active');
        }
        
    } catch (error) {
        console.error('Erreur chargement réactions:', error);
    }
}

// Gérer les réactions
async function handleReaction(e) {
    if (!currentArticleId) return;
    
    const reaction = e.currentTarget.dataset.reaction;
    const previousReaction = userReactions[currentArticleId];
    
    try {
        const articleRef = db.collection('articles').doc(currentArticleId);
        
        // Retirer ancienne réaction
        if (previousReaction) {
            await articleRef.update({
                [`reactions.${previousReaction}`]: firebase.firestore.FieldValue.increment(-1)
            });
            document.getElementById(`${previousReaction}Btn`).classList.remove('active');
        }
        
        // Ajouter nouvelle réaction
        if (previousReaction !== reaction) {
            await articleRef.update({
                [`reactions.${reaction}`]: firebase.firestore.FieldValue.increment(1)
            });
            userReactions[currentArticleId] = reaction;
            e.currentTarget.classList.add('active');
        } else {
            delete userReactions[currentArticleId];
        }
        
        saveUserReactions();
        loadReactions(currentArticleId);
        
    } catch (error) {
        console.error('Erreur réaction:', error);
    }
}

// Charger les commentaires
async function loadComments(articleId) {
    try {
        const snapshot = await db.collection('articles').doc(articleId)
            .collection('comments')
            .orderBy('createdAt', 'desc')
            .get();
        
        const commentsList = document.getElementById('commentsList');
        document.getElementById('commentsCount').textContent = snapshot.size;
        
        if (snapshot.empty) {
            commentsList.innerHTML = '<p class="no-comments">Aucun commentaire pour le moment. Soyez le premier à partager votre avis !</p>';
            return;
        }
        
        commentsList.innerHTML = '';
        snapshot.forEach(doc => {
            const comment = doc.data();
            const commentEl = createCommentElement(comment, doc.id);
            commentsList.appendChild(commentEl);
        });
        
    } catch (error) {
        console.error('Erreur chargement commentaires:', error);
    }
}

// Créer un élément commentaire
function createCommentElement(comment, commentId) {
    const div = document.createElement('div');
    div.className = 'comment-item fade-in';
    div.setAttribute('data-comment-id', commentId);
    
    const date = comment.createdAt 
        ? new Date(comment.createdAt.toDate()).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : '';
    
    // Vérifier si c'est le commentaire de l'utilisateur actuel
    const userCommentId = localStorage.getItem(`comment_${commentId}`);
    const isUserComment = userCommentId === commentId;
    
    const actionsHtml = isUserComment ? `
        <div class="comment-actions">
            <button class="comment-action-btn edit-btn" onclick="editComment('${commentId}', this)" title="Modifier">
                <i class="fas fa-edit"></i>
            </button>
            <button class="comment-action-btn delete-btn" onclick="deleteComment('${commentId}')" title="Supprimer">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';
    
    div.innerHTML = `
        <div class="comment-avatar">${comment.name.charAt(0).toUpperCase()}</div>
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.name)}</span>
                <span class="comment-date">${date}</span>
            </div>
            <p class="comment-text">${escapeHtml(comment.text)}</p>
            ${actionsHtml}
        </div>
    `;
    
    return div;
}

// Soumettre un commentaire
async function submitComment(e) {
    e.preventDefault();
    
    if (!currentArticleId) return;
    
    const name = document.getElementById('commentName').value.trim();
    const text = document.getElementById('commentText').value.trim();
    
    if (!name || !text) return;
    
    try {
        const docRef = await db.collection('articles').doc(currentArticleId)
            .collection('comments')
            .add({
                name,
                text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Sauvegarder l'ID du commentaire dans localStorage pour permettre la modification/suppression
        localStorage.setItem(`comment_${docRef.id}`, docRef.id);
        
        await db.collection('articles').doc(currentArticleId).update({
            commentsCount: firebase.firestore.FieldValue.increment(1)
        });
        
        document.getElementById('commentForm').reset();
        loadComments(currentArticleId);
        showNotification('Commentaire publié avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la publication du commentaire', 'error');
    }
}

// Modifier un commentaire
async function editComment(commentId, button) {
    const commentItem = button.closest('.comment-item');
    const commentTextEl = commentItem.querySelector('.comment-text');
    const currentText = commentTextEl.textContent;
    
    // Créer un formulaire d'édition
    const editForm = document.createElement('div');
    editForm.className = 'comment-edit-form';
    editForm.innerHTML = `
        <textarea class="comment-textarea" rows="3">${currentText}</textarea>
        <div class="comment-edit-actions">
            <button class="btn-save-comment" onclick="saveCommentEdit('${commentId}', this)">
                <i class="fas fa-check mr-1"></i>Enregistrer
            </button>
            <button class="btn-cancel-comment" onclick="cancelCommentEdit(this)">
                <i class="fas fa-times mr-1"></i>Annuler
            </button>
        </div>
    `;
    
    // Remplacer le texte par le formulaire
    commentTextEl.replaceWith(editForm);
    
    // Cacher les boutons d'action
    const actionsDiv = commentItem.querySelector('.comment-actions');
    actionsDiv.style.display = 'none';
}

// Sauvegarder la modification d'un commentaire
async function saveCommentEdit(commentId, button) {
    const editForm = button.closest('.comment-edit-form');
    const newText = editForm.querySelector('textarea').value.trim();
    
    if (!newText) {
        showNotification('Le commentaire ne peut pas être vide', 'error');
        return;
    }
    
    try {
        await db.collection('articles').doc(currentArticleId)
            .collection('comments')
            .doc(commentId)
            .update({
                text: newText,
                editedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        loadComments(currentArticleId);
        showNotification('Commentaire modifié avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

// Annuler la modification d'un commentaire
function cancelCommentEdit(button) {
    const commentItem = button.closest('.comment-item');
    loadComments(currentArticleId);
}

// Supprimer un commentaire
async function deleteComment(commentId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
        return;
    }
    
    try {
        await db.collection('articles').doc(currentArticleId)
            .collection('comments')
            .doc(commentId)
            .delete();
        
        await db.collection('articles').doc(currentArticleId).update({
            commentsCount: firebase.firestore.FieldValue.increment(-1)
        });
        
        // Supprimer l'ID du localStorage
        localStorage.removeItem(`comment_${commentId}`);
        
        loadComments(currentArticleId);
        showNotification('Commentaire supprimé avec succès !', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

// Charger les articles similaires
async function loadRelatedArticles(category) {
    const container = document.getElementById('relatedArticles');
    
    try {
        // Solution sans index : récupérer tous les articles puis filtrer
        const snapshot = await db.collection('articles').get();
        
        if (snapshot.empty) {
            container.innerHTML = '<p class="no-related">Aucun article similaire pour le moment.</p>';
            return;
        }
        
        // Filtrer manuellement par catégorie et exclure l'article actuel
        const relatedArticles = [];
        snapshot.forEach(doc => {
            const article = doc.data();
            if (article.category === category && doc.id !== currentArticleId) {
                relatedArticles.push({
                    id: doc.id,
                    data: article,
                    createdAt: article.createdAt
                });
            }
        });
        
        // Trier par date (plus récent en premier)
        relatedArticles.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });
        
        // Limiter à 3 articles
        const limitedArticles = relatedArticles.slice(0, 3);
        
        if (limitedArticles.length === 0) {
            container.innerHTML = '<p class="no-related">Aucun article similaire pour le moment.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        limitedArticles.forEach(item => {
            const relatedItem = createRelatedArticleItem(item.id, item.data);
            container.appendChild(relatedItem);
        });
        
    } catch (error) {
        console.error('Erreur chargement articles similaires:', error);
        container.innerHTML = '<p class="no-related">Erreur de chargement</p>';
    }
}

// Créer un élément article similaire
function createRelatedArticleItem(id, article) {
    const div = document.createElement('div');
    div.className = 'related-article-item';
    
    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80';
    
    div.innerHTML = `
        <img src="${imgUrl}" alt="${escapeHtml(article.title)}" class="related-article-img">
        <div class="related-article-content">
            <h4 class="related-article-title">${escapeHtml(article.title)}</h4>
            <a href="article.html?id=${id}" class="related-article-link">
                Lire l'article <i class="fas fa-arrow-right"></i>
            </a>
        </div>
    `;
    
    return div;
}

// Partage social
function shareArticle(platform) {
    const title = document.getElementById('articleTitle').textContent;
    const url = window.location.href;
    
    let shareUrl = '';
    
    switch(platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`;
            break;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
}

function copyArticleLink() {
    navigator.clipboard.writeText(window.location.href);
    showNotification('Lien copié !', 'success');
}

// Newsletter
function openNewsletterModal() {
    newsletterModal.classList.remove('hidden');
}

function closeNewsletterModal() {
    newsletterModal.classList.add('hidden');
}

async function submitNewsletter(e) {
    e.preventDefault();
    
    const email = document.getElementById('newsletterEmail').value.trim();
    
    try {
        await db.collection('newsletter').add({
            email,
            subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('Merci pour votre inscription !', 'success');
        closeNewsletterModal();
        document.getElementById('newsletterForm').reset();
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'inscription', 'error');
    }
}

// Thème sombre
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const icon = themeToggle.querySelector('i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').className = 'fas fa-sun';
    }
}

// Afficher l'état d'erreur
function showError() {
    loadingState.classList.add('hidden');
    articleContainer.classList.add('hidden');
    errorState.classList.remove('hidden');
}

// Utilitaires
function getCategoryClass(category) {
    const map = {
        'INNOVATION': 'blue',
        'SÉCURITÉ': 'red',
        'NOUVEAUTÉ': 'green',
        'TUTO': 'orange',
        'DOMOTIQUE': 'purple'
    };
    return map[category] || 'blue';
}

function calculateReadingTime(content) {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function saveUserReactions() {
    localStorage.setItem('userReactions', JSON.stringify(userReactions));
}

function loadUserReactions() {
    const saved = localStorage.getItem('userReactions');
    if (saved) {
        userReactions = JSON.parse(saved);
    }
}

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