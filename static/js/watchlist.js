class Watchlist {
    constructor() {
        this.watchlistData = [];
        this.toastTimeout = null;
        this.pendingRemoveStock = null;
        this.initializeElements();
        this.attachEventListeners();
        this.initTheme();
        this.loadWatchlist();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.exportBtn = document.getElementById('exportWatchlistBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.watchlistGrid = document.getElementById('watchlistGrid');
        this.resultsCount = document.getElementById('resultsCount');
        this.totalWatchlist = document.getElementById('totalWatchlist');
        this.avgPerformance = document.getElementById('avgPerformance');
        this.bullishCount = document.getElementById('bullishCount');
        this.bearishCount = document.getElementById('bearishCount');
        
        // Modals
        this.watchlistModal = document.getElementById('watchlistModal');
        this.removeModal = document.getElementById('removeModal');
        this.modalStockName = document.getElementById('modalStockName');
        this.modalStockCode = document.getElementById('modalStockCode');
        this.modalStockPrice = document.getElementById('modalStockPrice');
        this.modalComment = document.getElementById('modalComment');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalActionBtn = document.getElementById('modalActionBtn');
        this.removeStockName = document.getElementById('removeStockName');
        this.removeStockCode = document.getElementById('removeStockCode');
        this.confirmRemoveBtn = document.getElementById('confirmRemoveBtn');
    }

    attachEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.renderWatchlist());
        }
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => {
                this.loadWatchlist();
                this.showToast('Watchlist refreshed!', 'success');
            });
        }
        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => this.clearAll());
        }
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportWatchlist());
        }
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.watchlistModal) {
            this.watchlistModal.addEventListener('click', (e) => {
                if (e.target === this.watchlistModal) this.closeWatchlistModal();
            });
        }
        if (this.removeModal) {
            this.removeModal.addEventListener('click', (e) => {
                if (e.target === this.removeModal) this.closeRemoveModal();
            });
        }
        if (this.modalActionBtn) {
            this.modalActionBtn.addEventListener('click', () => {
                const stockCode = this.modalActionBtn.dataset.stockCode;
                if (stockCode) this.saveComment(stockCode);
            });
        }
        // Also add event listener for confirm remove as backup
        if (this.confirmRemoveBtn) {
            this.confirmRemoveBtn.addEventListener('click', () => this.confirmRemove());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeWatchlistModal();
                this.closeRemoveModal();
            }
        });
        // Listen for duration changes from other pages
        window.addEventListener('storage', (e) => {
            if (e.key === 'durationChanged' || e.key === 'selectedDuration') {
                // Reload watchlist data with new duration
                this.loadWatchlist();
                this.showToast('Duration updated from dashboard', 'info');
            }
        });
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
        this.renderWatchlist();
    }

    updateThemeIcon(theme) {
        if (this.themeToggle) {
            const icon = this.themeToggle.querySelector('i');
            const span = this.themeToggle.querySelector('span');
            if (theme === 'dark') {
                icon.className = 'fas fa-sun';
                span.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                span.textContent = 'Dark Mode';
            }
        }
    }

    getWatchlist() {
        try {
            const data = localStorage.getItem('watchlist');
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    saveWatchlist(data) {
        localStorage.setItem('watchlist', JSON.stringify(data));
    }

    loadWatchlist() {
        this.watchlistData = this.getWatchlist();
        this.renderWatchlist();
    }

    renderWatchlist() {
        const searchTerm = this.searchInput ? this.searchInput.value.toLowerCase().trim() : '';
        let filtered = this.watchlistData;
        
        if (searchTerm) {
            filtered = filtered.filter(item => 
                (item.stock_name && item.stock_name.toLowerCase().includes(searchTerm)) ||
                (item.stock_code && item.stock_code.toLowerCase().includes(searchTerm)) ||
                (item.sector && item.sector.toLowerCase().includes(searchTerm))
            );
        }
        
        this.updateStats(filtered);
        this.displayWatchlist(filtered);
        if (this.resultsCount) {
            this.resultsCount.textContent = `${filtered.length} stocks`;
        }
    }

    updateStats(items) {
        const total = items.length;
        if (this.totalWatchlist) this.totalWatchlist.textContent = total;
        
        if (total === 0) {
            if (this.avgPerformance) this.avgPerformance.textContent = '0%';
            if (this.bullishCount) this.bullishCount.textContent = '0';
            if (this.bearishCount) this.bearishCount.textContent = '0';
            return;
        }
        
        const totalChange = items.reduce((sum, item) => sum + (parseFloat(item.percentage_change) || 0), 0);
        const avg = totalChange / total;
        if (this.avgPerformance) {
            this.avgPerformance.textContent = `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`;
        }
        
        const bullish = items.filter(item => parseFloat(item.percentage_change) > 0).length;
        const bearish = items.filter(item => parseFloat(item.percentage_change) < 0).length;
        if (this.bullishCount) this.bullishCount.textContent = bullish;
        if (this.bearishCount) this.bearishCount.textContent = bearish;
    }

    displayWatchlist(items) {
        if (!this.watchlistGrid) return;
        
        if (items.length === 0) {
            this.watchlistGrid.innerHTML = `
                <div class="watchlist-empty">
                    <span class="empty-icon">
                        <i class="fas fa-star"></i>
                    </span>
                    <h3>Your Watchlist is Empty</h3>
                    <p>Start building your watchlist by adding stocks from the Stock Analysis page. Track your favorite stocks all in one place.</p>
                    <a href="/stock-analysis" class="btn-primary">
                        <i class="fas fa-chart-bar"></i> Go to Stock Analysis
                    </a>
                </div>
            `;
            return;
        }

        let html = '';
        items.forEach((item) => {
            const change = parseFloat(item.percentage_change) || 0;
            const changeClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : 'change-neutral';
            const trendClass = change > 0 ? 'bullish' : change < 0 ? 'bearish' : 'neutral';
            const trendLabel = change > 0 ? 'Bullish' : change < 0 ? 'Bearish' : 'Neutral';
            const addedDate = item.added_date ? new Date(item.added_date).toLocaleDateString() : 'N/A';
            
            html += `
                <div class="watchlist-card">
                    <div class="watchlist-card-header">
                        <div class="stock-info" onclick="window.open('${item.stock_url || '#'}', '_blank')">
                            <div class="stock-name">${item.stock_name || 'N/A'}</div>
                            <div class="stock-code">${item.stock_code || 'N/A'} • ${item.sector || 'N/A'}</div>
                        </div>
                        <span class="stock-change ${changeClass}">
                            ${change > 0 ? '+' : ''}${change.toFixed(2)}%
                        </span>
                    </div>
                    <div class="watchlist-card-body" onclick="window.open('${item.stock_url || '#'}', '_blank')">
                        <div class="stock-detail">
                            <span>Price</span>
                            <strong>₹${item.price || 'N/A'}</strong>
                        </div>
                        <div class="stock-detail">
                            <span>Added On</span>
                            <strong>${addedDate}</strong>
                        </div>
                        <div style="margin-top: 8px;">
                            <span class="trend-badge trend-${trendClass}">
                                <i class="fas fa-${change > 0 ? 'arrow-up' : change < 0 ? 'arrow-down' : 'minus'}"></i>
                                ${trendLabel}
                            </span>
                        </div>
                        ${item.comment ? `
                            <div class="stock-comment">
                                <strong><i class="fas fa-comment"></i> Comment</strong>
                                ${item.comment}
                            </div>
                        ` : ''}
                    </div>
                    <div class="watchlist-card-actions">
                        <button class="btn-sm btn-edit" onclick="window.watchlist.openEditModal('${item.stock_code}')">
                            <i class="fas fa-edit"></i> Comment
                        </button>
                        <button class="btn-sm btn-view" onclick="window.open('${item.stock_url || '#'}', '_blank')">
                            <i class="fas fa-external-link-alt"></i> View
                        </button>
                        <button class="btn-sm btn-remove" onclick="window.watchlist.openRemoveModal('${item.stock_code}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        });
        
        this.watchlistGrid.innerHTML = html;
    }

    openEditModal(stockCode) {
        const watchlist = this.getWatchlist();
        const item = watchlist.find(i => i.stock_code === stockCode);
        if (!item) return;

        if (this.modalStockName) this.modalStockName.textContent = item.stock_name || 'N/A';
        if (this.modalStockCode) this.modalStockCode.textContent = item.stock_code + ' • ' + (item.sector || 'N/A');
        if (this.modalStockPrice) this.modalStockPrice.textContent = '₹' + (item.price || 'N/A');
        if (this.modalComment) this.modalComment.value = item.comment || '';
        if (this.modalTitle) this.modalTitle.textContent = 'Edit Comment';
        
        if (this.modalActionBtn) {
            this.modalActionBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            this.modalActionBtn.className = 'btn btn-add';
            this.modalActionBtn.dataset.stockCode = stockCode;
        }

        if (this.watchlistModal) this.watchlistModal.classList.add('show');
    }

    saveComment(stockCode) {
        if (!stockCode) return;
        
        const watchlist = this.getWatchlist();
        const item = watchlist.find(i => i.stock_code === stockCode);
        if (!item) return;

        const newComment = this.modalComment ? this.modalComment.value.trim() : '';
        item.comment = newComment;
        this.saveWatchlist(watchlist);
        this.closeWatchlistModal();
        this.loadWatchlist();
        this.showToast('Comment updated successfully!', 'success');
    }

    openRemoveModal(stockCode) {
        console.log('Opening remove modal for:', stockCode);
        const watchlist = this.getWatchlist();
        const item = watchlist.find(i => i.stock_code === stockCode);
        if (!item) {
            console.log('Item not found:', stockCode);
            return;
        }

        this.pendingRemoveStock = stockCode;
        console.log('Pending remove stock set to:', this.pendingRemoveStock);
        
        if (this.removeStockName) this.removeStockName.textContent = item.stock_name || 'N/A';
        if (this.removeStockCode) this.removeStockCode.textContent = item.stock_code + ' • ' + (item.sector || 'N/A');
        if (this.removeModal) this.removeModal.classList.add('show');
    }

    confirmRemove() {
        console.log('Confirm remove called. Pending stock:', this.pendingRemoveStock);
        
        if (!this.pendingRemoveStock) {
            this.showToast('No stock selected to remove', 'warning');
            return;
        }
        
        const watchlist = this.getWatchlist();
        console.log('Current watchlist:', watchlist);
        
        const filtered = watchlist.filter(item => item.stock_code !== this.pendingRemoveStock);
        console.log('Filtered watchlist:', filtered);
        
        this.saveWatchlist(filtered);
        this.closeRemoveModal();
        this.loadWatchlist();
        this.showToast('Stock removed from watchlist', 'success');
        this.pendingRemoveStock = null;
    }

    closeWatchlistModal() {
        if (this.watchlistModal) this.watchlistModal.classList.remove('show');
    }

    closeRemoveModal() {
        if (this.removeModal) this.removeModal.classList.remove('show');
        this.pendingRemoveStock = null;
    }

    clearAll() {
        if (this.watchlistData.length === 0) {
            this.showToast('Watchlist is already empty', 'warning');
            return;
        }
        
        if (!confirm('Are you sure you want to clear your entire watchlist?')) return;
        
        this.saveWatchlist([]);
        this.loadWatchlist();
        this.showToast('Watchlist cleared successfully!', 'success');
    }

    exportWatchlist() {
        if (this.watchlistData.length === 0) {
            this.showToast('Watchlist is empty, nothing to export', 'warning');
            return;
        }
        
        let csv = 'Stock Name,Code,Sector,Price,Change %,Comment,Added Date\n';
        this.watchlistData.forEach(item => {
            csv += `${item.stock_name || 'N/A'},${item.stock_code || 'N/A'},${item.sector || 'N/A'},${item.price || 'N/A'},${item.percentage_change || 0},${item.comment || ''},${item.added_date || ''}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watchlist_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('Watchlist exported successfully!', 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) { alert(message); return; }
        
        toast.className = 'toast';
        const icon = toast.querySelector('.toast-icon');
        if (type === 'success') {
            toast.classList.add('toast-success');
            if (icon) icon.className = 'fas fa-check-circle toast-icon';
        } else if (type === 'error') {
            toast.classList.add('toast-error');
            if (icon) icon.className = 'fas fa-exclamation-circle toast-icon';
        } else if (type === 'warning') {
            toast.classList.add('toast-warning');
            if (icon) icon.className = 'fas fa-exclamation-triangle toast-icon';
        }
        
        toastMessage.textContent = message;
        toast.style.display = 'flex';
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }
}

// Make sure the instance is available globally
document.addEventListener('DOMContentLoaded', () => {
    window.watchlist = new Watchlist();
});