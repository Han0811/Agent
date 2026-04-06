import uuid
from datetime import datetime, timedelta
from typing import Dict, Any


def place_order(
    product_title: str,
    price: str,
    store: str,
    quantity: int = 1,
    address: str = "",
) -> Dict[str, Any]:
    """
    Giả lập đặt hàng sản phẩm (mock checkout).
    Trả về order ID, status, ngày giao hàng dự kiến.
    """
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now()
    estimated_delivery = (now + timedelta(days=3)).strftime("%d/%m/%Y")

    return {
        "order_id": order_id,
        "status": "confirmed",
        "product": product_title,
        "quantity": quantity,
        "price": price,
        "store": store,
        "address": address if address else "Chưa cung cấp địa chỉ",
        "estimated_delivery": estimated_delivery,
        "payment_method": "COD (Thanh toán khi nhận hàng)",
        "created_at": now.strftime("%d/%m/%Y %H:%M"),
    }
