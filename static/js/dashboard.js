class Dashboard {
    constructor() {
        this.currentData = null;
        this.isCached = false;
        this.charts = {};
        this.toastTimeout = null;
        this.initializeElements();
        this.attachEventListeners();
        this.initTheme();
        this.loadSavedDuration();
    }

    initializeElements() {
        this.durationSelect = document.getElementById('durationSelect');
        this.fetchBtn = document.getElementById('fetchDataBtn');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.exportBtn = document.getElementById('exportData');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.statsGrid = document.getElementById('statsGrid');
        this.noData = document.getElementById('noData');
        this.chartWrapper = document.getElementById('chartWrapper');
        this.themeToggle = document.getElementById('themeToggle');
        this.chartBadge = document.getElementById('chartBadge');
        this.comparisonChart = null;
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
        if (this.durationSelect) {
            this.durationSelect.addEventListener('change', () => {
                localStorage.setItem('selectedDuration', this.durationSelect.value);
            });
            this.durationSelect.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchData();
            });
        }
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
        if (this.comparisonChart) {
            this.comparisonChart.destroy();
            if (this.currentData && this.currentData.data) {
                this.createComparisonChart(this.currentData.data);
            }
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

    loadSavedDuration() {
        const savedDuration = localStorage.getItem('selectedDuration') || '1d';
        if (this.durationSelect) {
            this.durationSelect.value = savedDuration;
            setTimeout(() => this.fetchData(), 300);
        }
    }

    async fetchData() {
        const duration = this.durationSelect ? this.durationSelect.value : '';
        if (!duration) {
            this.showToast('Please select a duration', 'warning');
            return;
        }

        localStorage.setItem('selectedDuration', duration);
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
            if (this.noData) this.noData.style.display = 'block';
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(data) {
        if (!data.data || data.data.length === 0) {
            if (this.noData) this.noData.style.display = 'block';
            return;
        }

        this.displayStats(data.summary);
        this.createComparisonChart(data.data);
        
        if (this.statsGrid) this.statsGrid.style.display = 'grid';
        if (this.chartWrapper) this.chartWrapper.style.display = 'block';
        if (this.chartBadge) this.chartBadge.textContent = `${data.data.length} Sectors`;
        if (this.noData) this.noData.style.display = 'none';
    }

    displayStats(summary) {
        const statsHtml = `
            <div class="dashboard-stat-card">
                <div class="stat-value">${summary.total_sectors}</div>
                <div class="stat-label"><i class="fas fa-building"></i> Total Sectors</div>
                <div class="stat-trend" style="color: var(--text-secondary);">+${summary.total_sectors > 0 ? '12' : '0'}%</div>
            </div>
            <div class="dashboard-stat-card">
                <div class="stat-value">${summary.total_stocks}</div>
                <div class="stat-label"><i class="fas fa-chart-bar"></i> Total Stocks</div>
                <div class="stat-trend" style="color: var(--text-secondary);">+${summary.total_stocks > 0 ? '8' : '0'}%</div>
            </div>
            <div class="dashboard-stat-card">
                <div class="stat-value" style="color: ${summary.avg_performance >= 0 ? '#48bb78' : '#fc8181'}">${summary.avg_performance.toFixed(2)}%</div>
                <div class="stat-label"><i class="fas fa-arrow-up"></i> Avg Performance</div>
                <div class="stat-trend" style="color: ${summary.avg_performance >= 0 ? '#48bb78' : '#fc8181'}">${summary.avg_performance >= 0 ? '+' : ''}${summary.avg_performance.toFixed(2)}%</div>
            </div>
            <div class="dashboard-stat-card">
                <div class="stat-value" style="color: ${summary.avg_performance > 2 ? '#48bb78' : summary.avg_performance < -2 ? '#fc8181' : '#ed8936'}">
                    ${summary.avg_performance > 2 ? 'Bullish' : summary.avg_performance < -2 ? 'Bearish' : 'Neutral'}
                </div>
                <div class="stat-label"><i class="fas fa-trend-up"></i> Market Sentiment</div>
                <div class="stat-trend" style="color: var(--text-secondary);">•</div>
            </div>
        `;
        if (this.statsGrid) {
            this.statsGrid.innerHTML = statsHtml;
            this.statsGrid.style.display = 'grid';
        }
    }

    createComparisonChart(sectors) {
        const ctx = document.getElementById('sectorComparisonChart');
        if (!ctx) return;

        if (this.comparisonChart) {
            this.comparisonChart.destroy();
        }

        const sorted = [...sectors].sort((a, b) => b.percentage_change - a.percentage_change);
        const labels = sorted.map(s => s.sector);
        const data = sorted.map(s => s.percentage_change);
        const colors = data.map(v => v >= 0 ? '#48bb78' : '#fc8181');

        this.comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Performance (%)',
                    data: data,
                    backgroundColor: colors,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff',
                    borderWidth: 2,
                    borderRadius: 4
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
                                return `${context.parsed.y >= 0 ? '+' : ''}${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e2e8f0'
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568',
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    async clearCache() {
        try {
            const response = await fetch('/api/cache', { method: 'DELETE' });
            if (response.ok) {
                this.showToast('Cache cleared successfully!', 'success');
                if (this.currentData) {
                    this.isCached = false;
                    this.displayResults(this.currentData);
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
            this.fetchBtn.innerHTML = show ? '<i class="fas fa-spinner fa-spin"></i> Loading...' : '<i class="fas fa-rocket"></i> Analyze Market';
        }
    }

    hideResults() {
        if (this.statsGrid) this.statsGrid.style.display = 'none';
        if (this.chartWrapper) this.chartWrapper.style.display = 'none';
        if (this.noData) this.noData.style.display = 'none';
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
    window.dashboard = new Dashboard();
});