class SectorAnalysis {
    constructor() {
        this.currentData = null;
        this.isCached = false;
        this.allSectors = [];
        this.allStocks = [];
        this.charts = {};
        this.toastTimeout = null;
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
        this.chartsSection = document.getElementById('chartsSection');
        this.topPerformers = document.getElementById('topPerformers');
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

        this.displayTopPerformers(data.data);
        this.displayCharts(data.data);
        this.renderSectors(data.data);
        
        if (this.resultsContainer) this.resultsContainer.style.display = 'block';
        if (this.chartsSection) this.chartsSection.style.display = 'block';
        if (this.noData) this.noData.style.display = 'none';
        if (this.resultsCount) {
            this.resultsCount.textContent = `${data.data.length} sectors found`;
        }
        
        this.updateCacheStatus();
    }

    displayTopPerformers(sectors) {
        if (!this.topPerformers) return;

        // Get all stocks from all sectors
        const allStocks = [];
        sectors.forEach(sector => {
            if (sector.stocks_data) {
                sector.stocks_data.forEach(stock => {
                    allStocks.push({
                        ...stock,
                        sector: sector.sector
                    });
                });
            }
        });

        // Sort by percentage change
        const sorted = [...allStocks].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );

        const gainers = sorted.slice(0, 3);
        const losers = sorted.slice(-3).reverse();
        const neutral = sorted.filter(s => Math.abs(parseFloat(s.percentage_change)) < 0.5).slice(0, 3);

        this.topPerformers.innerHTML = `
            <div class="performer-card gainers">
                <div class="performer-title"><i class="fas fa-arrow-up"></i> Top Gainers</div>
                ${gainers.map(s => `
                    <div class="performer-item">
                        <span class="name">${s.stock_name || 'N/A'}</span>
                        <span class="value positive">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                    </div>
                `).join('')}
            </div>
            <div class="performer-card losers">
                <div class="performer-title"><i class="fas fa-arrow-down"></i> Top Losers</div>
                ${losers.map(s => `
                    <div class="performer-item">
                        <span class="name">${s.stock_name || 'N/A'}</span>
                        <span class="value negative">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                    </div>
                `).join('')}
            </div>
            <div class="performer-card neutral">
                <div class="performer-title"><i class="fas fa-minus"></i> Neutral</div>
                ${neutral.map(s => `
                    <div class="performer-item">
                        <span class="name">${s.stock_name || 'N/A'}</span>
                        <span class="value neutral">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    displayCharts(sectors) {
        setTimeout(() => {
            this.createSectorPerformanceChart(sectors);
            this.createTrendDistributionChart(sectors);
        }, 100);
    }

    createSectorPerformanceChart(sectors) {
        const ctx = document.getElementById('sectorPerformanceChart');
        if (!ctx) return;

        if (this.charts.sectorPerformance) {
            this.charts.sectorPerformance.destroy();
        }

        const labels = sectors.map(s => s.sector || 'Unknown');
        const data = sectors.map(s => parseFloat(s.percentage_change) || 0);
        const colors = data.map(v => v >= 0 ? '#48bb78' : '#fc8181');

        try {
            this.charts.sectorPerformance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data.map(v => Math.abs(v) || 0.1),
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
                                padding: 10,
                                usePointStyle: true,
                                font: { size: 11 },
                                boxWidth: 12,
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = data[context.dataIndex];
                                    return `${context.label}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        } catch (error) {
            console.error('Error creating sector performance chart:', error);
        }
    }

    createTrendDistributionChart(sectors) {
        const ctx = document.getElementById('trendDistributionChart');
        if (!ctx) return;

        if (this.charts.trendDistribution) {
            this.charts.trendDistribution.destroy();
        }

        const trends = {};
        sectors.forEach(s => {
            const trend = s.trend || 'Unknown';
            trends[trend] = (trends[trend] || 0) + 1;
        });

        const labels = Object.keys(trends);
        const data = Object.values(trends);
        const colors = ['#48bb78', '#fc8181', '#ed8936', '#4299e1', '#9f7aea'];

        try {
            this.charts.trendDistribution = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Number of Sectors',
                        data: data,
                        backgroundColor: colors.slice(0, data.length),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#ffffff',
                        borderWidth: 2,
                        borderRadius: 8
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
                            ticks: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#4a5568'
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating trend distribution chart:', error);
        }
    }

    applySearch() {
        if (!this.searchInput || !this.allSectors) return;
        
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.renderSectors(this.allSectors);
            if (this.resultsCount) {
                this.resultsCount.textContent = `${this.allSectors.length} sectors found`;
            }
            return;
        }

        // Search in both sector names and stock names
        const filteredSectors = this.allSectors.filter(sector => {
            // Check sector name
            const sectorMatch = sector.sector && sector.sector.toLowerCase().includes(searchTerm);
            
            // Check stock names in this sector
            const stockMatch = sector.stocks_data && sector.stocks_data.some(stock => 
                stock.stock_name && stock.stock_name.toLowerCase().includes(searchTerm)
            );
            
            return sectorMatch || stockMatch;
        });

        // If stock search matched, show the sector with filtered stocks
        const resultSectors = filteredSectors.map(sector => {
            const stocks = sector.stocks_data || [];
            const filteredStocks = stocks.filter(stock => 
                stock.stock_name && stock.stock_name.toLowerCase().includes(searchTerm)
            );
            
            // If sector name matched, show all stocks, else show only matching stocks
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

        // Get top 3 gainers, losers, neutral for this sector's stocks
        const stocks = sector.stocks_data || [];
        const sortedStocks = [...stocks].sort((a, b) => 
            parseFloat(b.percentage_change) - parseFloat(a.percentage_change)
        );
        const topGainers = sortedStocks.slice(0, 3);
        const topLosers = sortedStocks.slice(-3).reverse();
        const neutralStocks = sortedStocks.filter(s => Math.abs(parseFloat(s.percentage_change)) < 0.5).slice(0, 3);

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

                <!-- Top Performers for this sector -->
                <div class="top-performers" style="margin-bottom: 24px;">
                    <div class="performer-card gainers">
                        <div class="performer-title"><i class="fas fa-arrow-up"></i> Top Gainers</div>
                        ${topGainers.map(s => `
                            <div class="performer-item">
                                <span class="name">${s.stock_name || 'N/A'}</span>
                                <span class="value positive">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="performer-card losers">
                        <div class="performer-title"><i class="fas fa-arrow-down"></i> Top Losers</div>
                        ${topLosers.map(s => `
                            <div class="performer-item">
                                <span class="name">${s.stock_name || 'N/A'}</span>
                                <span class="value negative">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="performer-card neutral">
                        <div class="performer-title"><i class="fas fa-minus"></i> Neutral</div>
                        ${neutralStocks.map(s => `
                            <div class="performer-item">
                                <span class="name">${s.stock_name || 'N/A'}</span>
                                <span class="value neutral">${s.percentage_change >= 0 ? '+' : ''}${s.percentage_change.toFixed(2)}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="chart-container" style="height: 250px; margin-bottom: 24px;">
                    <canvas id="sectorStockChart"></canvas>
                </div>

                <div class="stocks-table-wrapper">
                    <table class="stocks-table">
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
                            ${this.renderStocks(sector.stocks_data || [])}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(detailView);

        // Create chart for sector stocks
        setTimeout(() => {
            this.createSectorStockChart(sector);
        }, 100);
    }

    createSectorStockChart(sector) {
        const ctx = document.getElementById('sectorStockChart');
        if (!ctx) return;

        const stocks = sector.stocks_data || [];
        const labels = stocks.map(s => s.stock_name || 'N/A');
        const data = stocks.map(s => parseFloat(s.percentage_change) || 0);
        const colors = data.map(v => v >= 0 ? '#48bb78' : '#fc8181');

        // Destroy existing chart if any
        if (this.charts.sectorStock) {
            this.charts.sectorStock.destroy();
        }

        try {
            this.charts.sectorStock = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Stock Performance (%)',
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
                                minRotation: 45
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating sector stock chart:', error);
        }
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
        if (this.chartsSection) this.chartsSection.style.display = 'none';
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