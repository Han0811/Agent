import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
SERPAPI_URL = "https://serpapi.com/search"


def search_products(query: str, location: str = "Vietnam") -> Dict[str, Any]:
    """
    Tìm kiếm sản phẩm trên Google Shopping qua SerpAPI.
    Trả về danh sách sản phẩm với giá, link, ảnh.
    """
    if not SERPAPI_KEY:
        return {"error": "SERPAPI_KEY chưa được cấu hình", "products": []}

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": SERPAPI_KEY,
        "hl": "vi",
        "gl": "vn",
        "num": 8,
    }

    try:
        response = requests.get(SERPAPI_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "products": []}

    shopping_results = data.get("shopping_results", [])
    products = []

    for i, item in enumerate(shopping_results[:8]):
        product = {
            "product_id": str(i),
            "title": item.get("title", "Không có tên"),
            "price": item.get("price", "Liên hệ"),
            "source": item.get("source", "Unknown"),
            "link": item.get("link") or item.get("product_link", "#"),
            "thumbnail": item.get("thumbnail", ""),
            "rating": item.get("rating"),
            "reviews": item.get("reviews"),
        }
        products.append(product)

    return {
        "query": query,
        "total_found": len(products),
        "products": products,
    }
