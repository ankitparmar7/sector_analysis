class Dashboard {
    constructor() {
        this.currentData = null;
        this.isCached = false;
        this.charts = {};
        this.toastTimeout = null;
        this.initializeElements();
        this.attachEventListeners();
        this.initTheme();
        // Auto-fetch on load with saved duration
        this.loadSavedDuration();
    }

    initializeElements() {
        this.durationSelect = document.getElementById('durationSelect');
        this.fetchBtn = document.getElementById('fetchData');
        this.clearCacheBtn = document.getElementById('clearCache');
        this.exportBtn = document.getElementById('exportData');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.statsGrid = document.getElementById('statsGrid');
        this.noData = document.getElementById('noData');
        this.cacheStatusElement = document.getElementById('cacheStatus');
        this.chartsSection = document.getElementById('chartsSection');
        this.themeToggle = document.getElementById('themeToggle');
        
        this.totalSectors = document.getElementById('totalSectors');
        this.totalStocks = document.getElementById('totalStocks');
        this.avgPerformance = document.getElementById('avgPerformance');
        this.marketSentiment = document.getElementById('marketSentiment');
        this.sectorTrend = document.getElementById('sectorTrend');
        this.stockTrend = document.getElementById('stockTrend');
        this.perfTrend = document.getElementById('perfTrend');
    }

    loadSavedDuration() {
        const savedDuration = localStorage.getItem('dashboardDuration');
        if (savedDuration && this.durationSelect) {
            this.durationSelect.value = savedDuration;
            // Auto-fetch after a small delay
            setTimeout(() => this.fetchData(), 300);
        }
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
            this.durationSelect.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchData();
            });
            this.durationSelect.addEventListener('change', () => {
                localStorage.setItem('dashboardDuration', this.durationSelect.value);
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

        // Save duration
        localStorage.setItem('dashboardDuration', duration);

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

        this.displayStats(data.summary);
        this.displayCharts(data.data);
        
        if (this.statsGrid) this.statsGrid.style.display = 'grid';
        if (this.chartsSection) this.chartsSection.style.display = 'block';
        if (this.noData) this.noData.style.display = 'none';
        
        this.updateCacheStatus();
    }

    displayStats(summary) {
        if (this.totalSectors) this.totalSectors.textContent = summary.total_sectors || 0;
        if (this.totalStocks) this.totalStocks.textContent = summary.total_stocks || 0;
        
        const avgPerf = summary.avg_performance || 0;
        if (this.avgPerformance) {
            this.avgPerformance.textContent = `${avgPerf >= 0 ? '+' : ''}${avgPerf.toFixed(2)}%`;
            this.avgPerformance.style.color = avgPerf >= 0 ? '#48bb78' : '#fc8181';
        }
        
        if (this.perfTrend) {
            this.perfTrend.textContent = `${avgPerf >= 0 ? '+' : ''}${avgPerf.toFixed(2)}%`;
            this.perfTrend.style.color = avgPerf >= 0 ? '#48bb78' : '#fc8181';
        }
        
        if (this.marketSentiment) {
            const sentiment = avgPerf > 2 ? 'Bullish' : avgPerf < -2 ? 'Bearish' : 'Neutral';
            this.marketSentiment.textContent = sentiment;
            this.marketSentiment.style.color = 
                sentiment === 'Bullish' ? '#48bb78' : 
                sentiment === 'Bearish' ? '#fc8181' : '#ed8936';
        }
    }

    displayCharts(sectors) {
        setTimeout(() => {
            this.createSectorComparisonChart(sectors);
        }, 100);
    }

    createSectorComparisonChart(sectors) {
        const ctx = document.getElementById('sectorComparisonChart');
        if (!ctx) return;

        if (this.charts.sectorComparison) {
            this.charts.sectorComparison.destroy();
        }

        // Sort by performance
        const sorted = [...sectors].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );

        const labels = sorted.map(s => s.sector || 'Unknown');
        const data = sorted.map(s => parseFloat(s.percentage_change) || 0);
        const colors = data.map(v => v >= 0 ? '#48bb78' : '#fc8181');

        try {
            this.charts.sectorComparison = new Chart(ctx, {
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
                        legend: {
                            display: false
                        },
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
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568',
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: false,
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating sector comparison chart:', error);
        }
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
                this.fetchBtn.innerHTML = '<i class="fas fa-rocket"></i> Analyze Market';
            }
        }
    }

    hideResults() {
        if (this.statsGrid) this.statsGrid.style.display = 'none';
        if (this.chartsSection) this.chartsSection.style.display = 'none';
        if (this.noData) this.noData.style.display = 'none';
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
    window.dashboard = new Dashboard();
});