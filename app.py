from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request, Query
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from fastapi import FastAPI
from curl_cffi import requests
from lxml import html
import pandas as pd
import json
import os
from cachetools import TTLCache

app = FastAPI(title="Sector Analysis Dashboard")

# Cache configuration (TTL: 30 minutes)
cache = TTLCache(maxsize=100, ttl=1800)

# Get the directory where this file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Templates
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

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

# Convert to list of tuples for template compatibility
durationItems = list(durationMapping.items())

todayDate = (datetime.now() - timedelta(days=0)).strftime('%d-%m-%Y')

@app.get("/")
async def dashboard(request: Request):
    """Serve the main dashboard"""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "durations": durationItems,  # Use list of tuples instead of dict
        "current_date": todayDate,
        "durationMapping": durationMapping  # Keep for reference if needed
    })

@app.get("/sector-analysis")
async def sector_analysis(request: Request):
    """Serve the sector analysis page"""
    return templates.TemplateResponse("sector_analysis.html", {
        "request": request,
        "durations": durationItems,  # Use list of tuples instead of dict
        "current_date": todayDate,
        "durationMapping": durationMapping  # Keep for reference if needed
    })

@app.get("/api/guide")
def read_root():
    return {
        "Greetings": "Welcome to the sector analysis API",
        "API Guide": "Hello User, Please Choose duration from one of [1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y]",
        "duration_breakdown": durationMapping
    }

def get_response(duration):
    """Fetch data from MoneyControl API"""
    try:
        res = requests.get(
            f'https://api.moneycontrol.com/mcapi/v1/sector/listing?dur={duration}&section=sector',
            impersonate='edge99',
            timeout=30
        )
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
    return None

async def process_sector_data(duration):
    """Process sector data with caching"""
    cache_key = f"sector_data_{duration}"
    
    # Check cache
    if cache_key in cache:
        return cache[cache_key]
    
    response = get_response(duration)
    if response is None:
        return None
    
    df = pd.DataFrame(response['data'])
    sectorwiseData = []
    
    for trend, group in df.groupby('trend'):
        for _, row in group.iterrows():
            sector_url = f"https://www.moneycontrol.com/markets/sector-analysis/{row['slug']}"
            sectorData = {
                'date': todayDate,
                'duration': durationMapping.get(duration, duration),
                'trend': trend,
                'sector': row['sector'],
                'percentage_change': row['mCapPerChange'],
                'sector_url': sector_url,
                'stocks_data': []
            }
            
            try:
                res = requests.get(sector_url, impersonate='edge99', timeout=15)
                if res.status_code == 200:
                    htmlData = res.text
                    tree = html.fromstring(htmlData)
                    
                    jsonLDData = tree.xpath('//script[@id="__NEXT_DATA__"]/text()')
                    if jsonLDData:
                        jsonLD = json.loads(jsonLDData[0])
                        allStocks = jsonLD['props']['pageProps']['data']['allStocks']
                        
                        for stock in allStocks:
                            try:
                                stock_data = {
                                    'stock_name': stock.get('stockName', ''),
                                    'price': stock.get('currPrice', ''),
                                    'stock_url': f"https://www.moneycontrol.com/india/stockpricequote/{stock.get('slug', '')}",
                                    'percentage_change': float(stock.get('perChange', 0)),
                                    'market_cap': int(stock.get('marketCap', '0').replace(',', '')),
                                    'net_profit': int(stock.get('netProfit', '0').replace(',', '')),
                                    'stock_trend': stock.get('techTrend', ''),
                                    'industry': stock.get('industry', '')
                                }
                                sectorData['stocks_data'].append(stock_data)
                            except:
                                continue
            except Exception as e:
                print(f"Error processing {sector_url}: {e}")
            
            sectorwiseData.append(sectorData)
    
    # Cache the result
    cache[cache_key] = sectorwiseData
    return sectorwiseData

@app.get("/api/sector-data")
async def get_sector_data(duration: str = Query(..., description="1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y")):
    """Get sector analysis data with caching"""
    durationHandler = ['1d', '5d', '1m', '3m', '6m', '1y', '2y', '3y', '5y']
    
    if duration not in durationHandler:
        return JSONResponse(
            status_code=400,
            content={
                'error': 'Invalid duration',
                'message': 'Please enter a valid duration!',
                'available_durations': durationMapping
            }
        )
    
    data = await process_sector_data(duration)
    
    if data is None:
        return JSONResponse(
            status_code=503,
            content={'error': 'Service unavailable', 'message': 'Website Response Error, Please try again in some time.'}
        )
    
    # Add summary statistics
    summary = {
        'total_sectors': len(data),
        'total_stocks': sum(len(sector['stocks_data']) for sector in data),
        'avg_performance': sum(float(sector['percentage_change']) for sector in data) / len(data) if data else 0,
        'trend_breakdown': {}
    }
    
    for sector in data:
        trend = sector.get('trend', 'Unknown')
        summary['trend_breakdown'][trend] = summary['trend_breakdown'].get(trend, 0) + 1
    
    return {
        'data': data,
        'summary': summary,
        'cached': cache.get(f"sector_data_{duration}") is not None
    }

@app.delete("/api/cache/{duration}")
async def clear_cache(duration: str):
    """Clear cache for a specific duration"""
    cache_key = f"sector_data_{duration}"
    if cache_key in cache:
        del cache[cache_key]
        return {'message': f'Cache cleared for duration {duration}'}
    return {'message': 'Cache not found'}

@app.delete("/api/cache")
async def clear_all_cache():
    """Clear all cache"""
    cache.clear()
    return {'message': 'All cache cleared'}

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)