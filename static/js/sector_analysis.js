class SectorAnalysis {
    constructor() {
        this.currentData = null;
        this.isCached = false;
        this.allSectors = [];
        this.allStocks = [];
        this.charts = {};
        this.toastTimeout = null;
        this.currentSortField = 'percentage_change';
        this.currentSortOrder = 'desc';
        this.initializeElements();
        this.attachEventListeners();
        this.initTheme();
        // Auto-fetch data on load with default duration
        setTimeout(() => {
            const defaultDuration = '1d';
            if (this.durationSelect) {
                this.durationSelect.value = defaultDuration;
                this.fetchData();
            }
        }, 500);
    }

    initializeElements() {
        this.durationSelect = document.getElementById('durationSelect');
        this.fetchBtn = document.getElementById('fetchData');
        this.clearCacheBtn = document.getElementById('clearCache');
        this.exportBtn = document.getElementById('exportData');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.sectorGrid = document.getElementById('sectorGrid');
        this.noData = document.getElementById('noData');
        this.cacheStatusElement = document.getElementById('cacheStatus');
        this.resultsCount = document.getElementById('resultsCount');
        this.searchInput = document.getElementById('searchInput');
        this.themeToggle = document.getElementById('themeToggle');
        this.topPerformers = document.getElementById('topPerformers');
        this.topPerformersSection = document.getElementById('topPerformersSection');
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
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.applySearch());
        }
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.durationSelect) {
            this.durationSelect.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchData();
            });
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
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

    async fetchData() {
        const duration = this.durationSelect ? this.durationSelect.value : '';
        
        if (!duration) {
            this.showToast('Please select a duration', 'warning');
            return;
        }

        this.showLoading(true);
        this.hideResults();

        try {
            const response = await fetch(`/api/sector-data?duration=${duration}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch data');
            }

            const result = await response.json();
            this.currentData = result;
            this.isCached = result.cached || false;
            
            this.displayResults(result);
            this.showToast('Data loaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error:', error);
            this.showToast(error.message || 'Failed to load data. Please try again.', 'error');
            if (this.noData) {
                this.noData.style.display = 'block';
            }
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(data) {
        if (!data.data || data.data.length === 0) {
            if (this.noData) {
                this.noData.style.display = 'block';
            }
            return;
        }

        this.allSectors = data.data;
        
        // Collect all stocks for search
        this.allStocks = [];
        data.data.forEach(sector => {
            if (sector.stocks_data) {
                sector.stocks_data.forEach(stock => {
                    this.allStocks.push({
                        ...stock,
                        sector: sector.sector
                    });
                });
            }
        });

        this.displayTopSectorPerformers(data.data);
        this.renderSectors(data.data);
        
        if (this.resultsContainer) this.resultsContainer.style.display = 'block';
        if (this.topPerformersSection) this.topPerformersSection.style.display = 'block';
        if (this.noData) this.noData.style.display = 'none';
        if (this.resultsCount) {
            this.resultsCount.textContent = `${data.data.length} sectors found`;
        }
        
        this.updateCacheStatus();
    }

    displayTopSectorPerformers(sectors) {
        if (!this.topPerformers) return;

        // Sort sectors by percentage change
        const sortedSectors = [...sectors].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );

        // Get top 5 gaining sectors (positive change)
        const topGainers = sortedSectors.filter(s => parseFloat(s.percentage_change) > 0).slice(0, 5);
        
        // Get top 5 losing sectors (negative change)
        const topLosers = sortedSectors.filter(s => parseFloat(s.percentage_change) < 0).slice(-5).reverse();
        
        // Get top 5 neutral sectors (close to 0)
        const topNeutral = sortedSectors
            .filter(s => Math.abs(parseFloat(s.percentage_change)) <= 0.5)
            .slice(0, 5);

        // Helper to render items
        const renderItems = (items, type) => {
            if (items.length === 0) {
                return `<div class="performer-item" style="color: var(--text-secondary); font-size: 13px;">No sectors available</div>`;
            }
            return items.map((s, index) => {
                const change = parseFloat(s.percentage_change) || 0;
                const valueClass = type === 'gainers' ? 'positive' : 
                                  type === 'losers' ? 'negative' : 'neutral';
                return `
                    <div class="performer-item" onclick="window.sectorAnalysis.openSectorDetail(${sectors.indexOf(s)})" style="cursor: pointer;">
                        <span class="name">${index + 1}. ${s.sector || 'N/A'}</span>
                        <span class="value ${valueClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>
                    </div>
                `;
            }).join('');
        };

        this.topPerformers.innerHTML = `
            <div class="performer-card gainers">
                <div class="performer-title">
                    <i class="fas fa-arrow-up"></i> Top 5 Gaining Sectors
                    <span style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left: 8px;">
                        ${topGainers.length} sectors
                    </span>
                </div>
                ${renderItems(topGainers, 'gainers')}
            </div>
            <div class="performer-card losers">
                <div class="performer-title">
                    <i class="fas fa-arrow-down"></i> Top 5 Losing Sectors
                    <span style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left: 8px;">
                        ${topLosers.length} sectors
                    </span>
                </div>
                ${renderItems(topLosers, 'losers')}
            </div>
            <div class="performer-card neutral">
                <div class="performer-title">
                    <i class="fas fa-minus"></i> Top 5 Neutral Sectors
                    <span style="font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left: 8px;">
                        ${topNeutral.length} sectors
                    </span>
                </div>
                ${renderItems(topNeutral, 'neutral')}
            </div>
        `;
    }

    applySearch() {
        if (!this.searchInput || !this.allSectors) return;
        
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.renderSectors(this.allSectors);
            if (this.resultsCount) {
                this.resultsCount.textContent = `${this.allSectors.length} sectors found`;
            }
            // Update top performers too
            this.displayTopSectorPerformers(this.allSectors);
            return;
        }

        const filteredSectors = this.allSectors.filter(sector => {
            const sectorMatch = sector.sector && sector.sector.toLowerCase().includes(searchTerm);
            const stockMatch = sector.stocks_data && sector.stocks_data.some(stock => 
                stock.stock_name && stock.stock_name.toLowerCase().includes(searchTerm)
            );
            return sectorMatch || stockMatch;
        });

        const resultSectors = filteredSectors.map(sector => {
            const stocks = sector.stocks_data || [];
            const filteredStocks = stocks.filter(stock => 
                stock.stock_name && stock.stock_name.toLowerCase().includes(searchTerm)
            );
            const sectorNameMatch = sector.sector && sector.sector.toLowerCase().includes(searchTerm);
            return {
                ...sector,
                stocks_data: sectorNameMatch ? stocks : filteredStocks
            };
        });

        if (this.resultsCount) {
            this.resultsCount.textContent = `${resultSectors.length} sectors found`;
        }
        
        this.renderSectors(resultSectors);
        // Update top performers for filtered sectors
        this.displayTopSectorPerformers(resultSectors);
    }

    renderSectors(sectors) {
        if (!this.sectorGrid) return;
        
        if (!sectors || sectors.length === 0) {
            this.sectorGrid.innerHTML = `
                <div class="no-data" style="padding: 40px; grid-column: 1 / -1;">
                    <i class="fas fa-search"></i>
                    <p>No sectors match your search</p>
                </div>
            `;
            return;
        }

        let html = '';
        
        sectors.forEach((sector, index) => {
            const change = parseFloat(sector.percentage_change) || 0;
            const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
            const trendClass = this.getTrendClass(sector.trend);
            const stockCount = (sector.stocks_data || []).length;
            
            // Get first 3 stocks for preview
            const previewStocks = (sector.stocks_data || []).slice(0, 3);
            const stockPreviewHtml = previewStocks.map(s => 
                `<span style="font-size: 12px; color: var(--text-secondary);">${s.stock_name || 'N/A'} (₹${s.price || 'N/A'})</span>`
            ).join(', ');
            
            html += `
                <div class="sector-card" data-sector="${sector.sector || 'Unknown'}" onclick="window.sectorAnalysis.openSectorDetail(${index})">
                    <div class="sector-card-header">
                        <span class="sector-name">${sector.sector || 'N/A'}</span>
                        <span class="sector-change ${changeClass}">
                            ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                        </span>
                    </div>
                    <div class="sector-card-body">
                        <span class="sector-trend ${trendClass}">
                            <i class="fas fa-${sector.trend && sector.trend.toLowerCase().includes('bullish') ? 'arrow-up' : 'arrow-down'}"></i>
                            ${sector.trend || 'N/A'}
                        </span>
                        <div class="sector-stats">
                            <div><strong>Stocks:</strong> ${stockCount}</div>
                            <div><strong>Performance:</strong> ${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div>
                        </div>
                        ${stockCount > 0 ? `
                            <div class="stock-preview">
                                <span>${stockPreviewHtml || 'No stocks'}</span>
                                <a href="#" class="view-link" onclick="event.stopPropagation(); window.sectorAnalysis.openSectorDetail(${index})">
                                    View All <i class="fas fa-arrow-right"></i>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        this.sectorGrid.innerHTML = html;
    }

    openSectorDetail(index) {
        const sector = this.allSectors[index];
        if (!sector) return;

        // Create detail view
        const existingView = document.querySelector('.sector-detail-view');
        if (existingView) {
            existingView.remove();
        }

        const detailView = document.createElement('div');
        detailView.className = 'sector-detail-view active';
        
        const change = parseFloat(sector.percentage_change) || 0;
        const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
        const trendClass = this.getTrendClass(sector.trend);

        // Get stocks with sorting
        let stocks = [...(sector.stocks_data || [])];
        stocks = this.sortStocks(stocks);

        // Get top 5 gainers, losers, neutral for stocks in this sector
        const sortedStocks = [...stocks].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );
        const topGainers = sortedStocks.filter(s => parseFloat(s.percentage_change) > 0).slice(0, 5);
        const topLosers = sortedStocks.filter(s => parseFloat(s.percentage_change) < 0).slice(-5).reverse();
        const neutralStocks = sortedStocks
            .filter(s => Math.abs(parseFloat(s.percentage_change)) <= 0.5)
            .slice(0, 5);

        detailView.innerHTML = `
            <div class="sector-detail-content">
                <button class="sector-detail-close" onclick="this.closest('.sector-detail-view').remove();">
                    <i class="fas fa-times"></i>
                </button>
                
                <div class="sector-detail-header">
                    <h2>${sector.sector || 'N/A'}</h2>
                    <div class="sector-meta">
                        <span>Trend: <span class="sector-trend ${trendClass}">${sector.trend || 'N/A'}</span></span>
                        <span>Performance: <span class="${changeClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span></span>
                        <span>Total Stocks: ${(sector.stocks_data || []).length}</span>
                    </div>
                </div>

                <!-- Stock Top Performers - Top 5 -->
                <div class="top-performers" style="margin-bottom: 24px;">
                    <div class="performer-card gainers">
                        <div class="performer-title"><i class="fas fa-arrow-up"></i> Top 5 Stock Gainers</div>
                        ${topGainers.map((s, i) => `
                            <div class="performer-item">
                                <span class="name">${i + 1}. ${s.stock_name || 'N/A'}</span>
                                <span class="value positive">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                            </div>
                        `).join('') || '<div class="performer-item" style="color: var(--text-secondary);">No gainers</div>'}
                    </div>
                    <div class="performer-card losers">
                        <div class="performer-title"><i class="fas fa-arrow-down"></i> Top 5 Stock Losers</div>
                        ${topLosers.map((s, i) => `
                            <div class="performer-item">
                                <span class="name">${i + 1}. ${s.stock_name || 'N/A'}</span>
                                <span class="value negative">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                            </div>
                        `).join('') || '<div class="performer-item" style="color: var(--text-secondary);">No losers</div>'}
                    </div>
                    <div class="performer-card neutral">
                        <div class="performer-title"><i class="fas fa-minus"></i> Top 5 Stock Neutral</div>
                        ${neutralStocks.map((s, i) => `
                            <div class="performer-item">
                                <span class="name">${i + 1}. ${s.stock_name || 'N/A'}</span>
                                <span class="value neutral">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                            </div>
                        `).join('') || '<div class="performer-item" style="color: var(--text-secondary);">No neutral stocks</div>'}
                    </div>
                </div>

                <!-- Stock Table with Sorting -->
                <div class="stocks-table-wrapper">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                        <span style="font-weight: 600; color: var(--text-primary);">All Stocks</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <select id="sortField" class="form-control" style="width: auto; min-width: 120px; padding: 6px 12px; font-size: 12px;">
                                <option value="percentage_change">Sort by Change</option>
                                <option value="price">Sort by Price</option>
                                <option value="market_cap">Sort by Market Cap</option>
                                <option value="net_profit">Sort by Net Profit</option>
                                <option value="stock_name">Sort by Name</option>
                            </select>
                            <select id="sortOrder" class="form-control" style="width: auto; min-width: 100px; padding: 6px 12px; font-size: 12px;">
                                <option value="desc">Highest First</option>
                                <option value="asc">Lowest First</option>
                            </select>
                            <button id="applySortBtn" class="btn btn-sm btn-primary">Apply Sort</button>
                        </div>
                    </div>
                    <table class="stocks-table" id="sectorStocksTable">
                        <thead>
                            <tr>
                                <th>Stock Name</th>
                                <th>Price</th>
                                <th>Code</th>
                                <th>Change</th>
                                <th>Market Cap</th>
                                <th>Net Profit</th>
                                <th>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderStocks(stocks)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(detailView);

        // Add sort event listeners
        const applySortBtn = detailView.querySelector('#applySortBtn');
        const sortField = detailView.querySelector('#sortField');
        const sortOrder = detailView.querySelector('#sortOrder');

        if (applySortBtn && sortField && sortOrder) {
            applySortBtn.addEventListener('click', () => {
                const field = sortField.value;
                const order = sortOrder.value;
                this.currentSortField = field;
                this.currentSortOrder = order;
                
                let sortedStocks = [...(sector.stocks_data || [])];
                sortedStocks = this.sortStocks(sortedStocks, field, order);
                
                const tbody = detailView.querySelector('#sectorStocksTable tbody');
                if (tbody) {
                    tbody.innerHTML = this.renderStocks(sortedStocks);
                }
            });
        }
    }

    sortStocks(stocks, field, order) {
        if (!field) field = this.currentSortField || 'percentage_change';
        if (!order) order = this.currentSortOrder || 'desc';

        return [...stocks].sort((a, b) => {
            let valA, valB;

            switch(field) {
                case 'price':
                    valA = parseFloat(a.price) || 0;
                    valB = parseFloat(b.price) || 0;
                    break;
                case 'market_cap':
                    valA = parseFloat(a.market_cap) || 0;
                    valB = parseFloat(b.market_cap) || 0;
                    break;
                case 'net_profit':
                    valA = parseFloat(a.net_profit) || 0;
                    valB = parseFloat(b.net_profit) || 0;
                    break;
                case 'stock_name':
                    valA = (a.stock_name || '').toLowerCase();
                    valB = (b.stock_name || '').toLowerCase();
                    return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'percentage_change':
                default:
                    valA = parseFloat(a.percentage_change) || 0;
                    valB = parseFloat(b.percentage_change) || 0;
                    break;
            }

            if (order === 'asc') {
                return valA - valB;
            } else {
                return valB - valA;
            }
        });
    }

    renderStocks(stocks) {
        if (!stocks || stocks.length === 0) {
            return `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">No stocks available</td></tr>`;
        }

        return stocks.map(stock => {
            const change = parseFloat(stock.percentage_change) || 0;
            const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
            const trendClass = this.getTrendClass(stock.stock_trend);
            
            return `
                <tr>
                    <td>
                        <a href="${stock.stock_url || '#'}" target="_blank" class="stock-link">
                            ${stock.stock_name || 'N/A'}
                        </a>
                    </td>
                    <td><strong>₹${stock.price || 'N/A'}</strong></td>
                    <td><span style="font-family: monospace;">${stock.stock_code || 'N/A'}</span></td>
                    <td class="${changeClass}" style="font-weight: 600;">
                        ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                    </td>
                    <td>${this.formatCurrency(stock.market_cap)}</td>
                    <td>${this.formatCurrency(stock.net_profit)}</td>
                    <td>
                        <span class="stock-trend-badge ${trendClass}">
                            <i class="fas fa-${stock.stock_trend && stock.stock_trend.toLowerCase().includes('bullish') ? 'arrow-up' : 'arrow-down'}"></i>
                            ${stock.stock_trend || 'N/A'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getTrendClass(trend) {
        if (!trend) return 'trend-neutral';
        const trendLower = trend.toLowerCase();
        if (trendLower.includes('bullish') || trendLower.includes('positive')) {
            return 'trend-bullish';
        } else if (trendLower.includes('bearish') || trendLower.includes('negative')) {
            return 'trend-bearish';
        }
        return 'trend-neutral';
    }

    formatCurrency(value) {
        if (!value) return 'N/A';
        if (value >= 10000000) {
            return `₹${(value / 10000000).toFixed(2)} Cr`;
        } else if (value >= 100000) {
            return `₹${(value / 100000).toFixed(2)} L`;
        }
        return `₹${value.toLocaleString()}`;
    }

    updateCacheStatus() {
        if (!this.cacheStatusElement) return;
        
        if (this.isCached) {
            this.cacheStatusElement.textContent = '✓ Cached';
            this.cacheStatusElement.style.background = 'rgba(72, 187, 120, 0.15)';
            this.cacheStatusElement.style.color = '#48bb78';
        } else {
            this.cacheStatusElement.textContent = '✓ Live';
            this.cacheStatusElement.style.background = 'rgba(66, 153, 225, 0.15)';
            this.cacheStatusElement.style.color = '#4299e1';
        }
    }

    async clearCache() {
        try {
            const response = await fetch('/api/cache', { method: 'DELETE' });
            if (response.ok) {
                this.showToast('Cache cleared successfully', 'success');
                if (this.currentData) {
                    this.isCached = false;
                    this.updateCacheStatus();
                }
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showToast('Failed to clear cache', 'error');
        }
    }

    exportData() {
        if (!this.currentData || !this.currentData.data) {
            this.showToast('No data to export', 'warning');
            return;
        }
        
        let csv = 'Sector,Trend,Performance,Stock Name,Price,Stock Code,Stock Change,Stock Trend\n';
        this.currentData.data.forEach(sector => {
            const sectorName = sector.sector || 'N/A';
            const sectorTrend = sector.trend || 'N/A';
            const sectorPerf = sector.percentage_change || 0;
            
            if (sector.stocks_data && sector.stocks_data.length > 0) {
                sector.stocks_data.forEach(stock => {
                    csv += `${sectorName},${sectorTrend},${sectorPerf},${stock.stock_name || 'N/A'},${stock.price || 'N/A'},${stock.stock_code || 'N/A'},${stock.percentage_change || 0},${stock.stock_trend || 'N/A'}\n`;
                });
            } else {
                csv += `${sectorName},${sectorTrend},${sectorPerf},N/A,N/A,N/A,N/A,N/A\n`;
            }
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sector_analysis_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showToast('Data exported successfully!', 'success');
    }

    showLoading(show) {
        if (!this.loadingIndicator) return;
        
        this.loadingIndicator.style.display = show ? 'flex' : 'none';
        if (this.fetchBtn) {
            this.fetchBtn.disabled = show;
            if (show) {
                this.fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            } else {
                this.fetchBtn.innerHTML = '<i class="fas fa-rocket"></i> Analyze';
            }
        }
    }

    hideResults() {
        if (this.resultsContainer) this.resultsContainer.style.display = 'none';
        if (this.topPerformersSection) this.topPerformersSection.style.display = 'none';
        if (this.noData) this.noData.style.display = 'none';
        if (this.topPerformers) this.topPerformers.innerHTML = '';
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastMessage) {
            alert(message);
            return;
        }
        
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
        this.toastTimeout = setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sectorAnalysis = new SectorAnalysis();
});