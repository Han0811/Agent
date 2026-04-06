from pydantic import BaseModel
from typing import Optional, List


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    address: Optional[str] = ""


class Product(BaseModel):
    title: str
    price: Optional[str] = None
    source: Optional[str] = None
    link: Optional[str] = None
    thumbnail: Optional[str] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    product_id: Optional[str] = None


class OrderInfo(BaseModel):
    order_id: str
    status: str
    product: str
    quantity: int
    price: str
    store: str
    address: str
    estimated_delivery: str
    payment_method: str


class ChatResponse(BaseModel):
    reply: str
    action_type: str  # "search" | "order" | "chat"
    products: Optional[List[Product]] = None
    order: Optional[OrderInfo] = None
    session_id: str
