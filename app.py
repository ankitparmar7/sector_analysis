from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request, Query
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from fastapi import FastAPI
import json
import os
import random
import sys
from cachetools import TTLCache

# Get the absolute path of the current file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="Sector Analysis Dashboard")

# Cache configuration
cache = TTLCache(maxsize=100, ttl=1800)

# Mount static files with absolute path
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Initialize templates with absolute path and autoescape
templates = Jinja2Templates(
    directory=TEMPLATES_DIR,
    autoescape=True
)

durationMapping = {
    '1d': '1 day',
    '5d': '5 days',
    '1m': '1 month',
    '3m': '3 months',
    '6m': '6 months',
    '1y': '1 year',
    '2y': '2 years',
    '3y': '3 years',
    '5y': '5 years',
}

durationItems = list(durationMapping.items())
todayDate = (datetime.now() - timedelta(days=0)).strftime('%d-%m-%Y')

@app.get("/")
async def dashboard(request: Request):
    return templates.TemplateResponse(
        "dashboard.html", 
        {
            "request": request,
            "durations": durationItems,
            "current_date": todayDate,
            "app_name": "Market Insight"
        }
    )

@app.get("/sector-analysis")
async def sector_analysis(request: Request):
    return templates.TemplateResponse(
        "sector_analysis.html", 
        {
            "request": request,
            "durations": durationItems,
            "current_date": todayDate,
            "app_name": "Market Insight"
        }
    )

@app.get("/api/guide")
def read_root():
    return {
        "status": "success",
        "message": "Welcome to the sector analysis API",
        "duration_breakdown": durationMapping
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "python_version": sys.version,
        "template_dir": TEMPLATES_DIR,
        "static_dir": STATIC_DIR
    }

def get_mock_sectors():
    """Generate mock sector data for testing"""
    sectors = [
        "Technology", "Finance", "Healthcare", "Energy", "Consumer Goods",
        "Industrial", "Real Estate", "Materials", "Utilities", "Telecom",
        "Automotive", "Aerospace", "Retail", "Pharmaceuticals", "Biotechnology",
        "Semiconductors", "Software", "Banking", "Insurance", "Manufacturing",
        "Metals & Mining", "Power", "Infrastructure", "Chemicals", "FMCG"
    ]
    
    trends = ["Bullish", "Bearish", "Neutral"]
    data = []
    
    for sector in sectors[:20]:
        trend = random.choice(trends)
        change = round(random.uniform(-15, 25), 2)
        
        stocks = []
        num_stocks = random.randint(5, 12)
        for j in range(num_stocks):
            stock = {
                'stock_name': f"{sector[:4]}{j+1}",
                'price': str(round(random.uniform(50, 5000), 2)),
                'stock_url': '#',
                'percentage_change': round(random.uniform(-12, 18), 2),
                'market_cap': random.randint(1000000, 999999999),
                'net_profit': random.randint(100000, 99999999),
                'stock_trend': random.choice(["Bullish", "Bearish", "Neutral"]),
                'industry': sector
            }
            stocks.append(stock)
        
        sector_data = {
            'date': todayDate,
            'duration': '1 day',
            'trend': trend,
            'sector': sector,
            'percentage_change': change,
            'sector_url': '#',
            'stocks_data': stocks
        }
        data.append(sector_data)
    
    return data

@app.get("/api/sector-data")
async def get_sector_data(duration: str = Query(..., description="1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y")):
    """Get sector data with caching"""
    cache_key = f"sector_data_{duration}"
    
    if cache_key in cache:
        return cache[cache_key]
    
    # Use mock data for Vercel (faster and reliable)
    data = get_mock_sectors()
    
    # Try to fetch real data if possible
    try:
        import requests as req
        url = f'https://api.moneycontrol.com/mcapi/v1/sector/listing?dur={duration}&section=sector'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = req.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            response_data = response.json()
            if 'data' in response_data and len(response_data['data']) > 0:
                import pandas as pd
                df = pd.DataFrame(response_data['data'])
                
                real_data = []
                for _, row in df.iterrows():
                    sector_data = {
                        'date': todayDate,
                        'duration': durationMapping.get(duration, duration),
                        'trend': row.get('trend', 'Neutral'),
                        'sector': row.get('sector', 'Unknown'),
                        'percentage_change': row.get('mCapPerChange', 0),
                        'sector_url': f"https://www.moneycontrol.com/markets/sector-analysis/{row.get('slug', '')}",
                        'stocks_data': []
                    }
                    real_data.append(sector_data)
                
                if len(real_data) > 0:
                    data = real_data
    except Exception as e:
        print(f"Error fetching real data: {e}")
    
    # Add summary
    summary = {
        'total_sectors': len(data),
        'total_stocks': sum(len(sector.get('stocks_data', [])) for sector in data),
        'avg_performance': sum(float(sector.get('percentage_change', 0)) for sector in data) / len(data) if data else 0,
        'trend_breakdown': {}
    }
    
    for sector in data:
        trend = sector.get('trend', 'Unknown')
        summary['trend_breakdown'][trend] = summary['trend_breakdown'].get(trend, 0) + 1
    
    result = {
        'data': data,
        'summary': summary,
        'cached': False
    }
    
    cache[cache_key] = result
    return result

@app.delete("/api/cache")
async def clear_all_cache():
    cache.clear()
    return {'message': 'All cache cleared'}

@app.delete("/api/cache/{duration}")
async def clear_cache(duration: str):
    cache_key = f"sector_data_{duration}"
    if cache_key in cache:
        del cache[cache_key]
        return {'message': f'Cache cleared for duration {duration}'}
    return {'message': 'Cache not found'}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)