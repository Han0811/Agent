# 🛒 ShopBot AI

Trợ lý mua sắm thông minh: tìm giá thật từ Google Shopping, so sánh và đặt hàng — tất cả trong một giao diện chat.

---

## Tính năng

- 🔍 Tìm kiếm sản phẩm thật qua SerpAPI Google Shopping
- 🤖 ReAct Agent với OpenAI Function Calling
- 📦 Hiển thị product cards với ảnh, giá, rating
- 🛒 Mock checkout với order ID và ngày giao hàng
- 📖 Lưu lịch sử hội thoại theo session

---

## Cài đặt

**1. Cài dependencies**

```bash
pip install -r requirements.txt
```

**2. Cấu hình API keys**

```bash
cp .env.example .env
```

Điền vào `.env`:

```env
OPENAI_API_KEY=sk-proj-...
SERPAPI_KEY=abc123...
OPENAI_MODEL=gpt-4o-mini
```

**3. Chạy server**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**4. Mở trình duyệt**

```
http://localhost:8000
```

---

## Lấy API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **SerpAPI**: https://serpapi.com/manage-api-key *(100 searches/tháng miễn phí)*

---

## Cấu trúc project

```
shopping-agent/
├── backend/
│   ├── main.py           # FastAPI app
│   ├── agent.py          # ReAct agent
│   ├── tools/
│   │   ├── search_tool.py
│   │   └── order_tool.py
│   └── history/          # Lịch sử chat (JSON)
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env
└── requirements.txt
```

---

## API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/chat` | Gửi tin nhắn |
| `GET` | `/history` | Danh sách sessions |
| `DELETE` | `/history/{id}` | Xoá session |
| `GET` | `/docs` | Swagger UI |

---

## Lưu ý

- Đặt hàng là **mock** — không có checkout thật.
- SerpAPI free tier giới hạn 100 requests/tháng.

---

*VinUni A20 AI Thực Chiến · Day 02 Lab*
