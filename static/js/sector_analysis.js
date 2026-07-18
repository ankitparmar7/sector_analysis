class SectorAnalysis {
    constructor() {
            this.currentData = null;
            this.chartInstances = {};
            this.modalChart = null;
            this.toastTimeout = null;
            this.initializeElements();
            this.attachEventListeners();
            this.initTheme();
            setTimeout(() => this.fetchData(), 500);
        }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.fetchBtn = document.getElementById('fetchDataBtn');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.exportBtn = document.getElementById('exportData');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.sectorGrid = document.getElementById('sectorGrid');
        this.noData = document.getElementById('noData');
        this.cacheStatus = document.getElementById('cacheStatus');
        this.resultsCount = document.getElementById('resultsCount');
        this.chartsSection = document.getElementById('chartsSection');
        this.topPerformersContainer = document.getElementById('topPerformersContainer');
        this.topPerformers = document.getElementById('topPerformers');
        this.themeToggle = document.getElementById('themeToggle');
        this.sectorModal = document.getElementById('sectorModal');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
        this.modalStockChart = document.getElementById('modalStockChart');
        this.currentSectorIndex = null;
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
            this.searchInput.addEventListener('input', () => this.applySearch());
        }
        if (this.sectorModal) {
            this.sectorModal.addEventListener('click', (e) => {
                if (e.target === this.sectorModal) this.closeSectorModal();
            });
        }
        if (this.modalCloseBtn) {
            this.modalCloseBtn.addEventListener('click', () => this.closeSectorModal());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSectorModal();
        });
    }

    initTheme() {
        // Set dark mode as default
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
        if (this.currentData) {
            this.createCharts(this.currentData.data);
        }
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
        // Show loading indicator inside controls
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }
        
        // Disable fetch button
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
                this.displayResults(data);
                this.showToast('Data loaded successfully!', 'success');
            } else if (data && data.Message) {
                this.showToast(data.Message, 'error');
            }
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
        } finally {
            // Hide loading indicator
            if (this.loadingIndicator) {
                this.loadingIndicator.style.display = 'none';
            }
            // Restore fetch button
            if (this.fetchBtn) {
                this.fetchBtn.disabled = false;
                this.fetchBtn.innerHTML = '<i class="fas fa-rocket"></i> Refresh Data';
            }
        }
    }

    displayResults(data) {
        // Sort sectors by percentage change (high to low)
        const sortedSectors = [...data.data].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );
        
        // Update currentData with sorted sectors
        this.currentData.data = sortedSectors;
        
        this.showTopPerformers(sortedSectors);
        this.createCharts(sortedSectors);
        this.displaySectors(sortedSectors);
        
        if (this.resultsContainer) this.resultsContainer.style.display = 'block';
        if (this.chartsSection) this.chartsSection.style.display = 'block';
        if (this.topPerformersContainer) this.topPerformersContainer.style.display = 'block';
        if (this.noData) this.noData.style.display = 'none';
        if (this.resultsCount) {
            this.resultsCount.textContent = `${sortedSectors.length} sectors found`;
        }
        
        if (this.cacheStatus) {
            if (data.cached) {
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

    showTopPerformers(sectors) {
        if (!this.topPerformers) return;
        
        const gainers = sectors.filter(s => parseFloat(s.percentage_change) > 0).slice(0, 5);
        const losers = sectors.filter(s => parseFloat(s.percentage_change) < 0).slice(-5).reverse();
        const neutral = sectors.filter(s => Math.abs(parseFloat(s.percentage_change)) <= 0.5).slice(0, 5);
        
        function renderItems(items, type) {
            if (items.length === 0) {
                return '<div class="performer-item"><span class="name">No data available</span></div>';
            }
            return items.map((s, i) => `
                <div class="performer-item" onclick="window.sectorAnalysis.scrollToSector('${s.sector}')">
                    <span class="name">${i + 1}. ${s.sector}</span>
                    <span class="value ${type}">${parseFloat(s.percentage_change) >= 0 ? '+' : ''}${parseFloat(s.percentage_change).toFixed(2)}%</span>
                </div>
            `).join('');
        }
        
        this.topPerformers.innerHTML = `
            <div class="performer-card gainers">
                <div class="performer-title"><i class="fas fa-arrow-up"></i> Top 5 Gaining Sectors</div>
                ${renderItems(gainers, 'positive')}
            </div>
            <div class="performer-card losers">
                <div class="performer-title"><i class="fas fa-arrow-down"></i> Top 5 Losing Sectors</div>
                ${renderItems(losers, 'negative')}
            </div>
            <div class="performer-card neutral">
                <div class="performer-title"><i class="fas fa-minus"></i> Top 5 Neutral Sectors</div>
                ${renderItems(neutral, 'neutral')}
            </div>
        `;
    }

    scrollToSector(sectorName) {
        const cards = document.querySelectorAll('.sector-card');
        cards.forEach(card => {
            const nameEl = card.querySelector('.sector-name');
            if (nameEl && nameEl.textContent === sectorName) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.boxShadow = '0 0 0 3px #667eea';
                setTimeout(() => { card.style.boxShadow = ''; }, 3000);
            }
        });
    }

    createCharts(sectors) {
        if (this.chartInstances.sectorPerformance) {
            this.chartInstances.sectorPerformance.destroy();
        }
        if (this.chartInstances.trendDistribution) {
            this.chartInstances.trendDistribution.destroy();
        }

        const ctx1 = document.getElementById('sectorPerformanceChart');
        const ctx2 = document.getElementById('trendDistributionChart');
        if (!ctx1 || !ctx2) return;

        const labels = sectors.map(s => s.sector || 'Unknown');
        const data = sectors.map(s => Math.abs(parseFloat(s.percentage_change)) || 0.1);
        const colors = sectors.map(s => parseFloat(s.percentage_change) >= 0 ? '#48bb78' : '#fc8181');

        this.chartInstances.sectorPerformance = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: { size: 10 },
                            boxWidth: 12,
                            padding: 8,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const sector = sectors[context.dataIndex];
                                return `${context.label}: ${parseFloat(sector.percentage_change) >= 0 ? '+' : ''}${parseFloat(sector.percentage_change).toFixed(2)}%`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });

        const trends = {};
        sectors.forEach(s => {
            const trend = s.trend || 'Unknown';
            trends[trend] = (trends[trend] || 0) + 1;
        });
        
        const trendLabels = Object.keys(trends);
        const trendData = Object.values(trends);
        const trendColors = ['#48bb78', '#fc8181', '#ed8936', '#4299e1', '#9f7aea'];

        this.chartInstances.trendDistribution = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Number of Sectors',
                    data: trendData,
                    backgroundColor: trendColors.slice(0, trendData.length),
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} sectors`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            stepSize: 1,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568'
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e2e8f0'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568'
                        }
                    }
                }
            }
        });
    }

    displaySectors(sectors) {
        if (!this.sectorGrid) return;
        
        let html = '';
        sectors.forEach((sector, index) => {
            const change = parseFloat(sector.percentage_change) || 0;
            const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
            const stockCount = sector.stocks_data ? sector.stocks_data.length : 0;
            const trendClass = sector.trend ? sector.trend.toLowerCase() : 'neutral';
            
            // Get first 4 stocks for preview
            const previewStocks = (sector.stocks_data || []).slice(0, 4);
            const stockNamesHtml = previewStocks.map(s => 
                `<span>${s.stock_name || 'N/A'}</span>`
            ).join('');
            
            const hasMoreStocks = (sector.stocks_data || []).length > 4;
            const trendIcon = sector.trend && sector.trend.toLowerCase().includes('bullish') ? 'arrow-up' : 
                            sector.trend && sector.trend.toLowerCase().includes('bearish') ? 'arrow-down' : 'minus';
            
            html += `
                <div class="sector-card" data-sector-index="${index}" onclick="window.sectorAnalysis.openSectorModal(${index})">
                    <div class="sector-card-header">
                        <span class="sector-name">${sector.sector || 'N/A'}</span>
                        <span class="sector-change ${changeClass}">
                            ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                        </span>
                    </div>
                    <div class="sector-card-body">
                        <span class="sector-trend trend-${trendClass}">
                            <i class="fas fa-${trendIcon}"></i>
                            ${sector.trend || 'N/A'}
                        </span>
                        ${stockCount > 0 ? `
                            <div class="stock-preview">
                                <div class="stock-names">
                                    ${stockNamesHtml}
                                    ${hasMoreStocks ? `<span style="color: var(--text-light); font-size: 11px;">+${(sector.stocks_data || []).length - 4} more</span>` : ''}
                                </div>
                                <a href="#" class="view-link" onclick="event.stopPropagation(); window.sectorAnalysis.openSectorModal(${index})">
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

    openSectorModal(index) {
        if (!this.currentData || !this.currentData.data) return;
        
        const sector = this.currentData.data[index];
        if (!sector) return;
        
        this.currentSectorIndex = index;
        const modal = this.sectorModal;
        if (!modal) return;

        // Set sector name
        document.getElementById('modalSectorName').textContent = sector.sector || 'N/A';
        
        // Set trend badge
        const trendClass = sector.trend ? sector.trend.toLowerCase() : 'neutral';
        const trendIcon = sector.trend && sector.trend.toLowerCase().includes('bullish') ? 'arrow-up' : 
                        sector.trend && sector.trend.toLowerCase().includes('bearish') ? 'arrow-down' : 'minus';
        document.getElementById('modalSectorBadge').innerHTML = `
            <span class="trend-badge trend-${trendClass}">
                <i class="fas fa-${trendIcon}"></i>
                ${sector.trend || 'N/A'}
            </span>
        `;

        // Set stats
        const change = parseFloat(sector.percentage_change) || 0;
        const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
        document.getElementById('modalStats').innerHTML = `
            <div class="modal-stat">
                <span class="modal-stat-label">Performance</span>
                <span class="modal-stat-value ${changeClass}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-label">Total Stocks</span>
                <span class="modal-stat-value">${sector.stocks_data ? sector.stocks_data.length : 0}</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-label">Duration</span>
                <span class="modal-stat-value">${sector.duration || '1 day'}</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-label">Date</span>
                <span class="modal-stat-value">${sector.date || 'N/A'}</span>
            </div>
        `;

        // Set top performers for this sector
        const stocks = sector.stocks_data || [];
        const sortedStocks = [...stocks].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );
        const gainers = sortedStocks.filter(s => parseFloat(s.percentage_change) > 0).slice(0, 5);
        const losers = sortedStocks.filter(s => parseFloat(s.percentage_change) < 0).slice(-5).reverse();
        const neutral = sortedStocks.filter(s => Math.abs(parseFloat(s.percentage_change)) < 0.5).slice(0, 5);

        document.getElementById('modalTopPerformers').innerHTML = `
            <div class="performer-card gainers">
                <div class="performer-title"><i class="fas fa-arrow-up"></i> Top 5 Gainers</div>
                ${gainers.length > 0 ? gainers.map(s => `
                    <div class="performer-item">
                        <span class="name">${s.stock_name || 'N/A'}</span>
                        <span class="value positive">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                    </div>
                `).join('') : '<div class="performer-item"><span class="name">No gainers</span></div>'}
            </div>
            <div class="performer-card losers">
                <div class="performer-title"><i class="fas fa-arrow-down"></i> Top 5 Losers</div>
                ${losers.length > 0 ? losers.map(s => `
                    <div class="performer-item">
                        <span class="name">${s.stock_name || 'N/A'}</span>
                        <span class="value negative">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                    </div>
                `).join('') : '<div class="performer-item"><span class="name">No losers</span></div>'}
            </div>
            <div class="performer-card neutral">
                <div class="performer-title"><i class="fas fa-minus"></i> Top 5 Neutral</div>
                ${neutral.length > 0 ? neutral.map(s => `
                    <div class="performer-item">
                        <span class="name">${s.stock_name || 'N/A'}</span>
                        <span class="value neutral">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                    </div>
                `).join('') : '<div class="performer-item"><span class="name">No neutral stocks</span></div>'}
            </div>
        `;

        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeSectorModal() {
        const modal = this.sectorModal;
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            document.body.style.overflow = 'auto';
        }
        this.currentSectorIndex = null;
    }

    applySearch() {
        const searchTerm = this.searchInput ? this.searchInput.value.toLowerCase().trim() : '';
        const cards = document.querySelectorAll('.sector-card');
        let visibleCount = 0;
        
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            const shouldShow = text.includes(searchTerm);
            card.style.display = shouldShow ? '' : 'none';
            if (shouldShow) visibleCount++;
        });
        
        if (this.resultsCount) {
            this.resultsCount.textContent = `${visibleCount} sectors found`;
        }
    }

    async clearCache() {
        try {
            const response = await fetch('/api/cache', { method: 'DELETE' });
            if (response.ok) {
                this.showToast('Cache cleared successfully!', 'success');
                if (this.currentData) this.fetchData();
            }
        } catch (error) {
            this.showToast('Error clearing cache: ' + error.message, 'error');
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
    window.sectorAnalysis = new SectorAnalysis();
});