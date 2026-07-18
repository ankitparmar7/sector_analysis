class StockAnalysis {
    constructor() {
        this.currentData = null;
        this.allStocks = [];
        this.filteredStocks = [];
        this.currentPage = 1;
        this.ITEMS_PER_PAGE = 100;
        this.toastTimeout = null;
        this.pendingWatchlistStock = null;
        this.isRemoveAction = false;
        this.uniqueSectors = [];
        this.initializeElements();
        this.attachEventListeners();
        this.initTheme();
        setTimeout(() => this.fetchData(), 500);
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.sectorFilter = document.getElementById('sectorFilter');
        this.sortBy = document.getElementById('sortBy');
        this.fetchBtn = document.getElementById('fetchDataBtn');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.exportBtn = document.getElementById('exportData');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.statsGrid = document.getElementById('statsGrid');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.stockGrid = document.getElementById('stockGrid');
        this.noData = document.getElementById('noData');
        this.cacheStatus = document.getElementById('cacheStatus');
        this.resultsCount = document.getElementById('resultsCount');
        this.themeToggle = document.getElementById('themeToggle');
        this.watchlistModal = document.getElementById('watchlistModal');
        this.modalStockName = document.getElementById('modalStockName');
        this.modalStockCode = document.getElementById('modalStockCode');
        this.modalStockPrice = document.getElementById('modalStockPrice');
        this.modalComment = document.getElementById('modalComment');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalActionBtn = document.getElementById('modalActionBtn');
        this.totalStocks = document.getElementById('totalStocks');
        this.bullishStocks = document.getElementById('bullishStocks');
        this.neutralStocks = document.getElementById('neutralStocks');
        this.bearishStocks = document.getElementById('bearishStocks');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.pageNumbers = document.getElementById('pageNumbers');
        this.pageInfo = document.getElementById('pageInfo');
    }

    attachEventListeners() {
        if (this.fetchBtn) {
            this.fetchBtn.addEventListener('click', () => this.fetchData());
        }
        if (this.clearCacheBtn) {
            this.clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportData());
        }
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.applyFiltersAndSort());
        }
        if (this.sectorFilter) {
            this.sectorFilter.addEventListener('change', () => this.applyFiltersAndSort());
        }
        if (this.sortBy) {
            this.sortBy.addEventListener('change', () => this.applyFiltersAndSort());
        }
        if (this.watchlistModal) {
            this.watchlistModal.addEventListener('click', (e) => {
                if (e.target === this.watchlistModal) this.closeWatchlistModal();
            });
        }
        if (this.modalActionBtn) {
            this.modalActionBtn.addEventListener('click', () => this.confirmWatchlistAction());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeWatchlistModal();
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
        this.applyFiltersAndSort();
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

    // Watchlist Functions
    getWatchlist() {
        try {
            const data = localStorage.getItem('watchlist');
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    saveWatchlist(watchlist) {
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }

    isStockInWatchlist(stockCode) {
        const watchlist = this.getWatchlist();
        return watchlist.some(item => item.stock_code === stockCode);
    }

    openWatchlistModal(stockCode, stockName, stockUrl, price, change, sector, isRemove = false) {
        event.stopPropagation();
        
        this.pendingWatchlistStock = {
            stock_code: stockCode,
            stock_name: stockName,
            stock_url: stockUrl,
            price: price,
            percentage_change: change,
            sector: sector
        };
        this.isRemoveAction = isRemove;

        if (this.modalStockName) this.modalStockName.textContent = stockName;
        if (this.modalStockCode) this.modalStockCode.textContent = stockCode + ' • ' + sector;
        if (this.modalStockPrice) this.modalStockPrice.textContent = '₹' + price;
        
        const title = this.modalTitle;
        const actionBtn = this.modalActionBtn;
        const commentField = this.modalComment;
        const commentLabel = document.querySelector('label[for="modalComment"]');
        
        if (isRemove) {
            if (title) title.textContent = 'Remove from Watchlist';
            if (actionBtn) {
                actionBtn.innerHTML = '<i class="fas fa-trash"></i> Remove from Watchlist';
                actionBtn.className = 'btn btn-remove';
            }
            const watchlist = this.getWatchlist();
            const existing = watchlist.find(item => item.stock_code === stockCode);
            if (existing && existing.comment) {
                if (commentField) {
                    commentField.value = existing.comment;
                    commentField.style.display = 'block';
                }
                if (commentLabel) commentLabel.style.display = 'block';
            } else {
                if (commentField) commentField.style.display = 'none';
                if (commentLabel) commentLabel.style.display = 'none';
            }
        } else {
            if (title) title.textContent = 'Add to Watchlist';
            if (actionBtn) {
                actionBtn.innerHTML = '<i class="fas fa-plus"></i> Add to Watchlist';
                actionBtn.className = 'btn btn-add';
            }
            if (commentField) {
                commentField.style.display = 'block';
                commentField.value = '';
            }
            if (commentLabel) commentLabel.style.display = 'block';
        }

        if (this.watchlistModal) this.watchlistModal.classList.add('show');
    }

    closeWatchlistModal() {
        if (this.watchlistModal) this.watchlistModal.classList.remove('show');
        this.pendingWatchlistStock = null;
    }

    confirmWatchlistAction() {
        if (!this.pendingWatchlistStock) return;

        const watchlist = this.getWatchlist();
        const stockCode = this.pendingWatchlistStock.stock_code;

        if (this.isRemoveAction) {
            const filtered = watchlist.filter(item => item.stock_code !== stockCode);
            this.saveWatchlist(filtered);
            this.showToast(`Removed ${this.pendingWatchlistStock.stock_name} from watchlist`, 'success');
        } else {
            const comment = this.modalComment ? this.modalComment.value.trim() : '';
            const newItem = {
                stock_code: stockCode,
                stock_name: this.pendingWatchlistStock.stock_name,
                stock_url: this.pendingWatchlistStock.stock_url,
                price: this.pendingWatchlistStock.price,
                percentage_change: this.pendingWatchlistStock.percentage_change,
                sector: this.pendingWatchlistStock.sector,
                comment: comment || '',
                added_date: new Date().toISOString()
            };
            watchlist.push(newItem);
            this.saveWatchlist(watchlist);
            this.showToast(`Added ${this.pendingWatchlistStock.stock_name} to watchlist!`, 'success');
        }

        this.closeWatchlistModal();
        this.applyFiltersAndSort();
    }

    async fetchData() {
        if (this.loadingIndicator) this.loadingIndicator.style.display = 'flex';
        if (this.fetchBtn) {
            this.fetchBtn.disabled = true;
            this.fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }

        try {
            const duration = localStorage.getItem('selectedDuration') || '1d';
            const response = await fetch(`/api/sector-data?duration=${duration}`);
            const data = await response.json();

            if (data && data.data) {
                this.currentData = data;
                this.allStocks = [];
                const sectors = new Set();
                
                data.data.forEach(sector => {
                    if (sector.stocks_data) {
                        sector.stocks_data.forEach(stock => {
                            this.allStocks.push({
                                ...stock,
                                sector: sector.sector,
                                sector_trend: sector.trend,
                                sector_performance: sector.percentage_change
                            });
                            sectors.add(sector.sector);
                        });
                    }
                });
                
                // Populate sector filter
                this.populateSectorFilter(sectors);
                
                this.allStocks.sort((a, b) => parseFloat(b.percentage_change) - parseFloat(a.percentage_change));
                this.filteredStocks = [...this.allStocks];
                this.currentPage = 1;
                this.displayResults(this.filteredStocks, data);
                this.showToast('Data loaded successfully!', 'success');
            } else if (data && data.Message) {
                this.showToast(data.Message, 'error');
            }
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
        } finally {
            if (this.loadingIndicator) this.loadingIndicator.style.display = 'none';
            if (this.fetchBtn) {
                this.fetchBtn.disabled = false;
                this.fetchBtn.innerHTML = '<i class="fas fa-rocket"></i> Refresh Data';
            }
        }
    }

    populateSectorFilter(sectors) {
        if (!this.sectorFilter) return;
        
        // Clear existing options except "All Sectors"
        this.sectorFilter.innerHTML = '<option value="all">All Sectors</option>';
        
        // Sort sectors alphabetically
        const sortedSectors = Array.from(sectors).sort();
        
        sortedSectors.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            this.sectorFilter.appendChild(option);
        });
        
        this.uniqueSectors = sortedSectors;
    }

    displayResults(stocks, data) {
        const total = stocks.length;
        const bullish = stocks.filter(s => parseFloat(s.percentage_change) > 0).length;
        const bearish = stocks.filter(s => parseFloat(s.percentage_change) < 0).length;
        const neutral = stocks.filter(s => parseFloat(s.percentage_change) === 0).length;
        
        if (this.totalStocks) this.totalStocks.textContent = total.toLocaleString();
        if (this.bullishStocks) this.bullishStocks.textContent = bullish.toLocaleString();
        if (this.neutralStocks) this.neutralStocks.textContent = neutral.toLocaleString();
        if (this.bearishStocks) this.bearishStocks.textContent = bearish.toLocaleString();
        
        if (this.statsGrid) this.statsGrid.style.display = 'grid';

        this.renderStocksWithPagination(stocks);
        
        if (this.resultsContainer) this.resultsContainer.style.display = 'block';
        if (this.noData) this.noData.style.display = 'none';
        
        if (this.cacheStatus) {
            if (data && data.cached) {
                this.cacheStatus.textContent = '✓ Cached';
                this.cacheStatus.style.background = 'rgba(72, 187, 120, 0.15)';
                this.cacheStatus.style.color = '#48bb78';
            } else {
                this.cacheStatus.textContent = '✓ Live';
                this.cacheStatus.style.background = 'rgba(66, 153, 225, 0.15)';
                this.cacheStatus.style.color = '#4299e1';
            }
        }
    }

    renderStocksWithPagination(stocks) {
        const totalPages = Math.ceil(stocks.length / this.ITEMS_PER_PAGE);
        if (this.currentPage > totalPages) this.currentPage = totalPages || 1;
        
        const start = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
        const end = Math.min(start + this.ITEMS_PER_PAGE, stocks.length);
        const pageStocks = stocks.slice(start, end);
        
        this.renderStocks(pageStocks);
        this.updatePagination(stocks.length, totalPages);
        
        if (this.resultsCount) {
            this.resultsCount.textContent = `${stocks.length} stocks found`;
        }
    }

    renderStocks(stocks) {
        if (!this.stockGrid) return;
        
        if (stocks.length === 0) {
            this.stockGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                    <p>No stocks match your search criteria</p>
                </div>
            `;
            return;
        }

        let html = '';
        stocks.forEach((stock) => {
            const change = parseFloat(stock.percentage_change) || 0;
            const changeClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : 'change-neutral';
            const trendClass = change > 0 ? 'bullish' : change < 0 ? 'bearish' : 'neutral';
            const marketCapCr = stock.market_cap ? stock.market_cap.toFixed(2) : 'N/A';
            const netProfitCr = stock.net_profit ? stock.net_profit.toFixed(2) : 'N/A';
            const trendIcon = change > 0 ? 'arrow-up' : change < 0 ? 'arrow-down' : 'minus';
            const trendLabel = change > 0 ? 'Bullish' : change < 0 ? 'Bearish' : 'Neutral';
            
            const isInWatchlist = this.isStockInWatchlist(stock.stock_code);
            
            html += `
                <div class="stock-card">
                    <div class="stock-card-header">
                        <div class="stock-clickable" onclick="window.open('${stock.stock_url || '#'}', '_blank')">
                            <div class="stock-name">${stock.stock_name || 'N/A'}</div>
                            <div class="stock-code">${stock.stock_code || 'N/A'}</div>
                        </div>
                        <div class="stock-card-header-right">
                            <span class="stock-change ${changeClass}">
                                ${change > 0 ? '+' : ''}${change.toFixed(2)}%
                            </span>
                            <button onclick="window.stockAnalysis.openWatchlistModal('${stock.stock_code}', '${stock.stock_name}', '${stock.stock_url}', '${stock.price}', ${change}, '${stock.sector}', ${isInWatchlist})" 
                                    class="watchlist-btn ${isInWatchlist ? 'in-watchlist' : ''}" 
                                    title="${isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                                <i class="fas ${isInWatchlist ? 'fa-star' : 'fa-star-o'}"></i>
                            </button>
                        </div>
                    </div>
                    <div class="stock-card-body" onclick="window.open('${stock.stock_url || '#'}', '_blank')" style="cursor: pointer;">
                        <div class="stock-detail">
                            <span>Price</span>
                            <strong>₹${stock.price || 'N/A'}</strong>
                        </div>
                        <div class="stock-detail">
                            <span>Sector</span>
                            <strong>${stock.sector || 'N/A'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <span class="stock-trend trend-${trendClass}">
                                <i class="fas fa-${trendIcon}"></i>
                                ${trendLabel}
                            </span>
                            <span class="stock-sector-tag">${stock.sector || 'N/A'}</span>
                        </div>
                        <div class="stock-stats-mini">
                            <div>
                                <strong>${marketCapCr}</strong>
                                Market Cap (Cr)
                            </div>
                            <div>
                                <strong>${netProfitCr}</strong>
                                Net Profit (Cr)
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        this.stockGrid.innerHTML = html;
    }

    updatePagination(totalItems, totalPages) {
        if (this.pageInfo) {
            this.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        }
        
        if (this.prevPageBtn) this.prevPageBtn.disabled = this.currentPage <= 1;
        if (this.nextPageBtn) this.nextPageBtn.disabled = this.currentPage >= totalPages;
        
        if (!this.pageNumbers) return;
        
        let pageHtml = '';
        const maxVisible = 7;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            pageHtml += `<button onclick="window.stockAnalysis.goToPage(1)">1</button>`;
            if (startPage > 2) pageHtml += `<button disabled>...</button>`;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageHtml += `<button onclick="window.stockAnalysis.goToPage(${i})" class="${i === this.currentPage ? 'active' : ''}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pageHtml += `<button disabled>...</button>`;
            pageHtml += `<button onclick="window.stockAnalysis.goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        this.pageNumbers.innerHTML = pageHtml;
    }

    changePage(delta) {
        const totalPages = Math.ceil(this.filteredStocks.length / this.ITEMS_PER_PAGE);
        const newPage = this.currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.renderStocksWithPagination(this.filteredStocks);
            if (this.stockGrid) {
                this.stockGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredStocks.length / this.ITEMS_PER_PAGE);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderStocksWithPagination(this.filteredStocks);
            if (this.stockGrid) {
                this.stockGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    applyFiltersAndSort() {
        const searchTerm = this.searchInput ? this.searchInput.value.toLowerCase().trim() : '';
        const selectedSector = this.sectorFilter ? this.sectorFilter.value : 'all';
        const sortBy = this.sortBy ? this.sortBy.value : 'change_desc';
        
        let filtered = [...this.allStocks];
        
        // Apply search
        if (searchTerm) {
            filtered = filtered.filter(stock => 
                (stock.stock_name && stock.stock_name.toLowerCase().includes(searchTerm)) ||
                (stock.stock_code && stock.stock_code.toLowerCase().includes(searchTerm)) ||
                (stock.sector && stock.sector.toLowerCase().includes(searchTerm))
            );
        }
        
        // Apply sector filter
        if (selectedSector !== 'all') {
            filtered = filtered.filter(stock => stock.sector === selectedSector);
        }
        
        // Apply sorting
        switch(sortBy) {
            case 'change_desc':
                filtered.sort((a, b) => parseFloat(b.percentage_change) - parseFloat(a.percentage_change));
                break;
            case 'change_asc':
                filtered.sort((a, b) => parseFloat(a.percentage_change) - parseFloat(b.percentage_change));
                break;
            case 'name_asc':
                filtered.sort((a, b) => (a.stock_name || '').localeCompare(b.stock_name || ''));
                break;
            case 'name_desc':
                filtered.sort((a, b) => (b.stock_name || '').localeCompare(a.stock_name || ''));
                break;
            case 'price_desc':
                filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                break;
            case 'price_asc':
                filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                break;
            case 'market_cap_desc':
                filtered.sort((a, b) => (parseFloat(b.market_cap) || 0) - (parseFloat(a.market_cap) || 0));
                break;
            case 'market_cap_asc':
                filtered.sort((a, b) => (parseFloat(a.market_cap) || 0) - (parseFloat(b.market_cap) || 0));
                break;
            default:
                filtered.sort((a, b) => parseFloat(b.percentage_change) - parseFloat(a.percentage_change));
        }
        
        this.filteredStocks = filtered;
        this.currentPage = 1;
        this.renderStocksWithPagination(filtered);
        
        const total = filtered.length;
        const bullish = filtered.filter(s => parseFloat(s.percentage_change) > 0).length;
        const bearish = filtered.filter(s => parseFloat(s.percentage_change) < 0).length;
        const neutral = filtered.filter(s => parseFloat(s.percentage_change) === 0).length;
        
        if (this.totalStocks) this.totalStocks.textContent = total.toLocaleString();
        if (this.bullishStocks) this.bullishStocks.textContent = bullish.toLocaleString();
        if (this.neutralStocks) this.neutralStocks.textContent = neutral.toLocaleString();
        if (this.bearishStocks) this.bearishStocks.textContent = bearish.toLocaleString();
    }

    async clearCache() {
        try {
            const response = await fetch('/api/cache', { method: 'DELETE' });
            if (response.ok) {
                this.showToast('Cache cleared successfully!', 'success');
                if (this.currentData) {
                    this.displayResults(this.filteredStocks, this.currentData);
                }
            }
        } catch (error) {
            this.showToast('Error clearing cache: ' + error.message, 'error');
        }
    }

    exportData() {
        if (!this.allStocks || this.allStocks.length === 0) {
            this.showToast('No data to export', 'warning');
            return;
        }
        
        let csv = 'Stock Name,Code,Sector,Price,Change %,Market Cap (Cr),Net Profit (Cr),Trend\n';
        this.allStocks.forEach(stock => {
            const marketCapCr = stock.market_cap ? stock.market_cap.toFixed(2) : 'N/A';
            const netProfitCr = stock.net_profit ? stock.net_profit.toFixed(2) : 'N/A';
            const trend = parseFloat(stock.percentage_change) > 0 ? 'Bullish' : 
                         parseFloat(stock.percentage_change) < 0 ? 'Bearish' : 'Neutral';
            csv += `${stock.stock_name || 'N/A'},${stock.stock_code || 'N/A'},${stock.sector || 'N/A'},${stock.price || 'N/A'},${stock.percentage_change || 0},${marketCapCr},${netProfitCr},${trend}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock_analysis_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('Data exported successfully!', 'success');
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

document.addEventListener('DOMContentLoaded', () => {
    window.stockAnalysis = new StockAnalysis();
});