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
let allArticles = [];
let filteredArticles = [];
let currentPage = 1;
const articlesPerPage = 6;
let currentUser = null;

// Éléments DOM
const articlesContainer = document.getElementById('articlesContainer');
const featuredContainer = document.getElementById('featuredContainer');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterButtons = document.querySelectorAll('.filter-btn');
const newsletterModal = document.getElementById('newsletterModal');
const themeToggle = document.getElementById('themeToggle');

// Gestion de l'authentification
auth.onAuthStateChanged(user => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (user) {
        // Utilisateur connecté
        loginBtn?.classList.add('hidden');
        userMenu?.classList.remove('hidden');
        
        // Afficher le nom et l'avatar
        const displayName = user.displayName || user.email.split('@')[0];
        document.getElementById('userName').textContent = displayName;
        document.getElementById('userNameDropdown').textContent = displayName;
        document.getElementById('userEmailDropdown').textContent = user.email;
        
        const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e40af&color=fff`;
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('userAvatarDropdown').src = avatarUrl;
    } else {
        // Utilisateur non connecté
        loginBtn?.classList.remove('hidden');
        userMenu?.classList.add('hidden');
    }
});

// Toggle menu utilisateur
document.getElementById('userMenuBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('hidden');
});

// Fermer le dropdown en cliquant ailleurs
document.addEventListener('click', (e) => {
    const userDropdown = document.getElementById('userDropdown');
    const userMenuBtn = document.getElementById('userMenuBtn');
    
    if (userDropdown && !userDropdown.classList.contains('hidden')) {
        if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    }
});

// Déconnexion
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showNotification('Déconnexion réussie', 'success');
        window.location.reload();
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
});

// Chargement des articles au démarrage
document.addEventListener('DOMContentLoaded', () => {
    loadArticles();
    loadTheme();
    setupEventListeners();
});

// Configuration des événements
function setupEventListeners() {
    // Recherche
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Tri
    sortSelect.addEventListener('change', handleSort);
    
    // Filtres
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            handleFilter(e.target.dataset.category);
        });
    });

    // Catégories sidebar
    document.querySelectorAll('.category-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.target.dataset.category;
            handleFilter(category);
            document.querySelector(`[data-category="${category}"].filter-btn`)?.click();
        });
    });

    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (e.target.dataset.filter) {
                e.preventDefault();
                handleFilter(e.target.dataset.filter);
            }
        });
    });

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Newsletter button
    document.getElementById('newsletterBtn').addEventListener('click', openNewsletterModal);
}

// Charger tous les articles
async function loadArticles() {
    articlesContainer.innerHTML = `
        <div class="loading-container">
            <i class="fas fa-spinner fa-spin loading-icon"></i>
            <p class="loading-text">Chargement des articles...</p>
        </div>
    `;

    try {
        const snapshot = await db.collection('articles')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            articlesContainer.innerHTML = `
                <div class="loading-container">
                    <p class="loading-text">Aucun article pour le moment.</p>
                </div>
            `;
            return;
        }

        allArticles = [];
        snapshot.forEach(doc => {
            allArticles.push({ id: doc.id, ...doc.data() });
        });

        filteredArticles = [...allArticles];
        displayArticles();
        displayFeaturedArticles();
        displayPopularArticles();

    } catch (error) {
        console.error('Erreur lors du chargement des articles:', error);
        articlesContainer.innerHTML = `
            <div class="loading-container">
                <p style="color: #dc2626;">Erreur de chargement des articles</p>
            </div>
        `;
    }
}

// Afficher les articles en vedette
function displayFeaturedArticles() {
    const featured = allArticles.filter(a => a.featured).slice(0, 2);
    if (featured.length === 0) return;

    featuredContainer.innerHTML = '<h3 class="featured-title"><i class="fas fa-star mr-2"></i>En Vedette</h3>';
    const grid = document.createElement('div');
    grid.className = 'featured-grid';
    
    featured.forEach(article => {
        const card = createFeaturedCard(article);
        grid.appendChild(card);
    });
    
    featuredContainer.appendChild(grid);
}

// Créer carte article en vedette
function createFeaturedCard(article) {
    const div = document.createElement('div');
    div.className = 'featured-card fade-in';
    
    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    
    div.innerHTML = `
        <img src="${imgUrl}" alt="${escapeHtml(article.title)}" class="featured-image">
        <div class="featured-content">
            <span class="category-badge ${getCategoryClass(article.category)}">${escapeHtml(article.category)}</span>
            <h3 class="featured-title-text">${escapeHtml(article.title)}</h3>
            <p class="featured-summary">${escapeHtml(article.summary)}</p>
            <button class="btn-read-featured" onclick="window.location.href='article.html?id=${article.id}'">
                Lire l'article <i class="fas fa-arrow-right ml-1"></i>
            </button>
        </div>
    `;
    
    return div;
}

// Afficher les articles populaires
function displayPopularArticles() {
    const popular = allArticles
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5);
    
    const container = document.getElementById('popularArticles');
    container.innerHTML = '';
    
    popular.forEach((article, index) => {
        const item = document.createElement('div');
        item.className = 'popular-item';
        item.innerHTML = `
            <span class="popular-rank">${index + 1}</span>
            <div class="popular-content">
                <h4 class="popular-title" onclick="window.location.href='article.html?id=${article.id}'" style="cursor: pointer;">${escapeHtml(article.title)}</h4>
                <p class="popular-views"><i class="fas fa-eye mr-1"></i>${article.views || 0} vues</p>
            </div>
        `;
        container.appendChild(item);
    });
}

// Afficher les articles avec pagination
function displayArticles() {
    const startIndex = (currentPage - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    const articlesToDisplay = filteredArticles.slice(startIndex, endIndex);

    if (articlesToDisplay.length === 0) {
        articlesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>Aucun article trouvé</p>
            </div>
        `;
        return;
    }

    articlesContainer.innerHTML = '';
    
    articlesToDisplay.forEach(article => {
        const articleElement = createArticleCard(article);
        articlesContainer.appendChild(articleElement);
    });

    displayPagination();
}

// Créer une carte d'article
function createArticleCard(article) {
    const articleCard = document.createElement('article');
    articleCard.className = 'article-card fade-in';
    
    const date = article.createdAt 
        ? new Date(article.createdAt.toDate()).toLocaleDateString('fr-FR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        })
        : 'Non daté';
    
    const imgUrl = article.imageUrl || 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    const categoryClass = getCategoryClass(article.category);
    const readingTime = calculateReadingTime(article.content);
    
    articleCard.innerHTML = `
        <div style="width: 100%; height: 240px; overflow: hidden;">
            <img src="${imgUrl}" alt="${escapeHtml(article.title)}" class="article-image">
        </div>
        <div class="article-content">
            <div class="article-meta">
                <span class="category-badge ${categoryClass}">${escapeHtml(article.category)}</span>
                <span class="article-date">${date}</span>
            </div>
            <h3 class="article-title">${escapeHtml(article.title)}</h3>
            <p class="article-summary">${escapeHtml(article.summary)}</p>
            <div class="article-footer">
                <div class="article-stats">
                    <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                    <span><i class="fas fa-clock"></i> ${readingTime} min</span>
                    <span><i class="fas fa-comment"></i> ${article.commentsCount || 0}</span>
                </div>
                <button class="read-more" onclick="window.location.href='article.html?id=${article.id}'">
                    Lire la suite <i class="fas fa-arrow-right" style="margin-left: 0.25rem;"></i>
                </button>
            </div>
        </div>
    `;
    
    return articleCard;
}

// Pagination
function displayPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
    
    if (totalPages <= 1) {
        pagination.classList.add('hidden');
        return;
    }
    
    pagination.classList.remove('hidden');
    pagination.innerHTML = '';
    
    // Bouton précédent
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    pagination.appendChild(prevBtn);
    
    // Numéros de page
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => changePage(i);
            pagination.appendChild(pageBtn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
    }
    
    // Bouton suivant
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    pagination.appendChild(nextBtn);
}

function changePage(page) {
    currentPage = page;
    displayArticles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Recherche
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query === '') {
        filteredArticles = [...allArticles];
    } else {
        filteredArticles = allArticles.filter(article => 
            article.title.toLowerCase().includes(query) ||
            article.summary.toLowerCase().includes(query) ||
            article.content.toLowerCase().includes(query) ||
            article.category.toLowerCase().includes(query) ||
            (article.tags && article.tags.some(tag => tag.toLowerCase().includes(query)))
        );
    }
    
    currentPage = 1;
    displayArticles();
}

// Filtre par catégorie
function handleFilter(category) {
    if (category === 'all') {
        filteredArticles = [...allArticles];
    } else {
        filteredArticles = allArticles.filter(article => article.category === category);
    }
    
    currentPage = 1;
    displayArticles();
}

// Tri
function handleSort(e) {
    const sortType = e.target.value;
    
    switch(sortType) {
        case 'date-desc':
            filteredArticles.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            break;
        case 'date-asc':
            filteredArticles.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateA - dateB;
            });
            break;
        case 'popular':
            filteredArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'title':
            filteredArticles.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
    
    currentPage = 1;
    displayArticles();
}

// Newsletter
function openNewsletterModal() {
    newsletterModal.classList.remove('hidden');
}

function closeNewsletterModal() {
    newsletterModal.classList.add('hidden');
}

document.getElementById('newsletterForm').addEventListener('submit', async (e) => {
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
});

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

// Utilitaires
function getCategoryClass(category) {
    const map = {
        'INNOVATION': 'blue',
        'SÉCURITÉ': 'red',
        'NOUVEAUTÉ': 'green',
        'TUTO': 'blue',
        'DOMOTIQUE': 'blue'
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

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
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

// Fermer modals avec Échap
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeNewsletterModal();
    }
});