from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from datetime import datetime, timedelta
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from curl_cffi import requests
from lxml import html
import pandas as pd
import uvicorn
import json
import os
from cachetools import TTLCache

app = FastAPI()

# Cache configuration (TTL: 1 day)
cache = TTLCache(maxsize=100, ttl=84600)

# Get the absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Mount static files
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Templates
templates = Jinja2Templates(directory=TEMPLATES_DIR)

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

todayDate = (datetime.now() - timedelta(days=0)).strftime('%d-%m-%Y')

# Convert to list of tuples for template compatibility
durationItems = list(durationMapping.items())

@app.get("/")
async def dashboard(request: Request):
    """Serve the main dashboard UI"""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "durations": durationItems,
        "current_date": todayDate
    })

@app.get("/sector-analysis")
async def sector_analysis_page(request: Request):
    """Serve the sector analysis UI"""
    return templates.TemplateResponse("sector_analysis.html", {
        "request": request,
        "durations": durationItems,
        "current_date": todayDate
    })

@app.get("/stock-analysis")
async def stock_analysis_page(request: Request):
    """Serve the stock analysis UI"""
    return templates.TemplateResponse("stock_analysis.html", {
        "request": request,
        "durations": durationItems,
        "current_date": todayDate
    })

@app.get("/watchlist")
async def watchlist_page(request: Request):
    """Serve the watchlist UI"""
    return templates.TemplateResponse("watchlist.html", {
        "request": request,
        "durations": durationItems,
        "current_date": todayDate
    })

@app.get("/notes")
async def notes_page(request: Request):
    """Serve the notes UI"""
    return templates.TemplateResponse("notes.html", {
        "request": request,
        "durations": durationItems,
        "current_date": todayDate
    })

@app.get("/guide")
def read_root():
    return {
        "Greetings": "Welcome to the sector analysis API",
        "API Guide": "Hello User, Please Choose duration from one of [1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y]",
        "duration_breakdown": durationMapping
    }

def get_response(duration):
    cache_key = f"api_response_{duration}"
    
    # Check cache for API response
    if cache_key in cache:
        return cache[cache_key]
    
    res = requests.get(
        f'https://api.moneycontrol.com/mcapi/v1/sector/listing?dur={duration}&section=sector',
        impersonate='edge99'
    )
    
    if res.status_code == 200:
        data = res.json()
        cache[cache_key] = data
        return data
    else:
        return None

@app.get('/api/sector-data')
def main(duration: str = Query(..., description="1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y")):
    """Your original API logic with caching"""
    durationHandler = ['1d', '5d', '1m', '3m', '6m', '1y', '2y', '3y', '5y']

    if duration is None:
        return {
            'Message': 'Please enter duration',
            "API Guide": "Hello User, Please Choose duration from one of [1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y]",
            "duration_breakdown": durationMapping
        }
    else:
        if duration in durationHandler:
            # Check cache for processed data
            cache_key = f"processed_data_{duration}"
            if cache_key in cache:
                return cache[cache_key]
            
            response = get_response(duration)

            if response is None:
                return {
                    'Message': 'Website Response Error, Please try again in some time.',
                }

            df = pd.DataFrame(response['data'])

            sectorwiseData = []

            for trend, group in df.groupby('trend'):
                for _, row in group.iterrows():
                    sector_url = f"https://www.moneycontrol.com/markets/sector-analysis/{row['slug']}"
                    sectorData = {
                        'date': todayDate,
                        'duration': durationMapping[duration],
                        'trend': trend,
                        'sector': row['sector'],
                        'percentage_change': row['mCapPerChange'],
                        'sector_url': sector_url,
                        'stocks_data': []
                    }

                    url = sector_url

                    try:
                        res = requests.get(url, impersonate='edge99')

                        if res.status_code == 200:
                            htmlData = res.text
                            tree = html.fromstring(htmlData)

                            jsonLDData = tree.xpath('//script[@id="__NEXT_DATA__"]/text()')
                            if jsonLDData:
                                jsonLD = json.loads(jsonLDData[0])
                                allStocks = jsonLD['props']['pageProps']['data']['allStocks']

                                sectorwiseStockDetails = []

                                for stock in allStocks:
                                    try:
                                        stock['stockName']
                                    except:
                                        continue
                                    try:
                                        stock_slug = stock['slug']
                                    except:
                                        continue

                                    stock_url = f"https://www.moneycontrol.com/india/stockpricequote/{stock_slug}"
                                    stock_percentage_change = float(stock['perChange']) 
                                    stock_market_cap = int(stock['marketCap'].replace(',', '')) 
                                    stock_net_profit = int(stock['netProfit'].replace(',', '')) 
                                    stock_trend = stock['techTrend']
                                    stock_price = stock.get('currPrice', 'N/A')

                                    stockData = {
                                        'stock_url': stock_url,
                                        'stock_name': stock['stockName'],
                                        'stock_code': stock['scId'],
                                        'price': stock_price,
                                        'duration': '1 day',
                                        'percentage_change': stock_percentage_change,
                                        'market_cap': stock_market_cap,
                                        'net_profit': stock_net_profit,
                                        'stock_trend': stock_trend,
                                    }

                                    sectorwiseStockDetails.append(stockData)
                        
                        sectorData['stocks_data'] = sectorwiseStockDetails
                    except Exception as e:
                        print(f"Error processing {sector_url}: {e}")
                    
                    sectorwiseData.append(sectorData)

            # Add summary for UI
            summary = {
                'total_sectors': len(sectorwiseData),
                'total_stocks': sum(len(sector['stocks_data']) for sector in sectorwiseData),
                'avg_performance': sum(float(sector['percentage_change']) for sector in sectorwiseData) / len(sectorwiseData) if sectorwiseData else 0,
                'trend_breakdown': {}
            }
            
            for sector in sectorwiseData:
                trend = sector.get('trend', 'Unknown')
                summary['trend_breakdown'][trend] = summary['trend_breakdown'].get(trend, 0) + 1

            result = {
                'data': sectorwiseData,
                'summary': summary,
                'cached': False
            }
            
            # Cache the processed data
            cache[cache_key] = result
            
            return result

        else:
            return {
                'Message': 'Please enter a valid duration!',
                "API Guide": "Hello User, Please Choose duration from one of [1d, 5d, 1m, 3m, 6m, 1y, 2y, 3y, 5y]",
                "duration_breakdown": durationMapping
            }

@app.delete("/api/cache")
async def clear_all_cache():
    """Clear all cache"""
    cache.clear()
    return {'message': 'All cache cleared successfully'}

@app.delete("/api/cache/{duration}")
async def clear_cache(duration: str):
    """Clear cache for specific duration"""
    cache_key = f"processed_data_{duration}"
    if cache_key in cache:
        del cache[cache_key]
        return {'message': f'Cache cleared for duration {duration}'}
    return {'message': 'Cache not found'}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)