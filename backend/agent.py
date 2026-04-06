import os
import json
from typing import Dict, Any, List, Optional
from openai import OpenAI
from dotenv import load_dotenv

from tools.search_tool import search_products
from tools.order_tool import place_order

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ─────────────────────────────────────────
# OpenAI Tool Schemas (Function Calling)
# ─────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Tìm kiếm sản phẩm trên Google Shopping. "
                "Dùng khi user muốn tìm, xem giá, hoặc so sánh sản phẩm. "
                "Trả về danh sách sản phẩm với tên, giá, link, cửa hàng."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Từ khóa tìm kiếm sản phẩm bằng tiếng Việt hoặc tiếng Anh",
                    },
                    "location": {
                        "type": "string",
                        "description": "Quốc gia/địa điểm tìm kiếm, mặc định là Vietnam",
                        "default": "Vietnam",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "place_order",
            "description": (
                "Đặt hàng một sản phẩm cụ thể. "
                "Dùng khi user đã chọn sản phẩm và muốn đặt mua. "
                "Trả về mã đơn hàng và thông tin giao hàng."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_title": {
                        "type": "string",
                        "description": "Tên đầy đủ của sản phẩm muốn đặt",
                    },
                    "price": {
                        "type": "string",
                        "description": "Giá sản phẩm dưới dạng string (ví dụ: '5.990.000đ')",
                    },
                    "store": {
                        "type": "string",
                        "description": "Tên cửa hàng hoặc nguồn bán sản phẩm",
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "Số lượng muốn đặt, mặc định là 1",
                        "default": 1,
                    },
                    "address": {
                        "type": "string",
                        "description": "Địa chỉ giao hàng của user",
                        "default": "",
                    },
                },
                "required": ["product_title", "price", "store"],
            },
        },
    },
]

# ─────────────────────────────────────────
# System Prompt
# ─────────────────────────────────────────
SYSTEM_PROMPT = """Bạn là ShopBot 🛒 — AI Shopping Assistant thông minh.

Nhiệm vụ của bạn:
1. Giúp user tìm kiếm sản phẩm với giá tốt nhất
2. So sánh giá từ nhiều nguồn khác nhau  
3. Hỗ trợ đặt hàng khi user muốn mua

Quy tắc:
- Luôn trả lời bằng tiếng Việt thân thiện, ngắn gọn
- Khi tìm được sản phẩm, tóm tắt 2-3 lựa chọn tốt nhất cho user
- Khi đặt hàng, xác nhận lại thông tin trước khi confirm
- Nếu user hỏi thứ không liên quan đến mua sắm, hãy lịch sự hướng user về shopping
- Format giá bằng tiếng Việt (vd: "5.990.000đ" hoặc "$299")"""

# ─────────────────────────────────────────
# Tool Dispatcher
# ─────────────────────────────────────────
def dispatch_tool(tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
    """Gọi tool tương ứng dựa theo tên và arguments."""
    if tool_name == "search_products":
        return search_products(**tool_args)
    elif tool_name == "place_order":
        return place_order(**tool_args)
    else:
        return {"error": f"Tool '{tool_name}' không tồn tại"}


# ─────────────────────────────────────────
# ReAct Agent Loop
# ─────────────────────────────────────────
def run_agent(
    message: str,
    address: str = "",
    conversation_history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    ReAct Agent: 
    1. LLM nhận message → quyết định gọi tool nào
    2. Gọi tool → lấy kết quả
    3. LLM tổng hợp → trả về response cuối
    
    Returns: {
        "reply": str,
        "action_type": "search" | "order" | "chat",
        "products": list | None,
        "order": dict | None,
    }
    """
    # Build conversation
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    if conversation_history:
        messages.extend(conversation_history)
    
    # Inject address hint vào message nếu có
    user_content = message
    if address:
        user_content += f"\n[Địa chỉ giao hàng của tôi: {address}]"
    
    messages.append({"role": "user", "content": user_content})

    action_type = "chat"
    products = None
    order = None

    # ── Vòng lặp ReAct (tối đa 3 lượt tool calls) ──
    for _ in range(3):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.3,
        )

        choice = response.choices[0]
        assistant_message = choice.message

        # Không gọi tool → LLM đã có câu trả lời cuối
        if not assistant_message.tool_calls:
            return {
                "reply": assistant_message.content or "Xin lỗi, tôi không hiểu yêu cầu của bạn.",
                "action_type": action_type,
                "products": products,
                "order": order,
            }

        # Append assistant message (với tool_calls)
        messages.append(assistant_message)

        # ── Xử lý từng tool call ──
        for tool_call in assistant_message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            # Inject address vào place_order nếu chưa có
            if tool_name == "place_order" and address and not tool_args.get("address"):
                tool_args["address"] = address

            # Gọi tool thật
            tool_result = dispatch_tool(tool_name, tool_args)

            # Cập nhật action_type và data
            if tool_name == "search_products":
                action_type = "search"
                products = tool_result.get("products", [])
            elif tool_name == "place_order":
                action_type = "order"
                order = tool_result

            # Thêm tool result vào conversation
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result, ensure_ascii=False),
            })

    # Fallback: lấy response cuối cùng sau loop
    final_response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.3,
    )
    
    reply = final_response.choices[0].message.content or "Đã xử lý xong!"
    
    return {
        "reply": reply,
        "action_type": action_type,
        "products": products,
        "order": order,
    }
