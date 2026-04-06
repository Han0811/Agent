import os
import uuid
import json
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from dotenv import load_dotenv

from models import ChatRequest, ChatResponse, Product, OrderInfo
from agent import run_agent

load_dotenv()

app = FastAPI(
    title="Shopping Agent API",
    description="AI Shopping Assistant với OpenAI + SerpAPI",
    version="1.0.0",
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory session store (conversation context for LLM) ───
sessions: Dict[str, List[Dict]] = {}

# ─── History directory (persistent log on disk) ───
HISTORY_DIR = Path(__file__).parent / "history"
HISTORY_DIR.mkdir(exist_ok=True)


# ══════════════════════════════════════════════════
# HISTORY HELPERS
# ══════════════════════════════════════════════════
def history_file(session_id: str) -> Path:
    return HISTORY_DIR / f"{session_id}.json"


def load_session_log(session_id: str) -> dict:
    f = history_file(session_id)
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return {
        "session_id": session_id,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "title": "Cuộc trò chuyện",
        "messages": [],
    }


def save_session_log(session_id: str, data: dict):
    data["updated_at"] = datetime.now().isoformat()
    history_file(session_id).write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def append_to_log(
    session_id: str,
    role: str,
    content: str,
    products: Optional[list] = None,
    order: Optional[dict] = None,
    action_type: str = "chat",
):
    log = load_session_log(session_id)
    msg = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "action_type": action_type,
    }
    if products:
        msg["products"] = products
    if order:
        msg["order"] = order

    log["messages"].append(msg)

    # Auto-generate title from first user message
    user_msgs = [m for m in log["messages"] if m["role"] == "user"]
    if len(user_msgs) == 1:
        title = user_msgs[0]["content"][:60]
        log["title"] = title + ("..." if len(user_msgs[0]["content"]) > 60 else "")

    save_session_log(session_id, log)


# ══════════════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════════════
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "openai_key": bool(os.getenv("OPENAI_API_KEY")),
        "serpapi_key": bool(os.getenv("SERPAPI_KEY")),
    }


# ══════════════════════════════════════════════════
# CHAT
# ══════════════════════════════════════════════════
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())

    if session_id not in sessions:
        sessions[session_id] = []

    history = sessions[session_id]

    try:
        result = run_agent(
            message=request.message,
            address=request.address or "",
            conversation_history=history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # Update in-memory context
    sessions[session_id].append({"role": "user", "content": request.message})
    sessions[session_id].append({"role": "assistant", "content": result["reply"]})

    if len(sessions[session_id]) > 20:
        sessions[session_id] = sessions[session_id][-20:]

    # ── Persist user turn to disk ──
    append_to_log(
        session_id,
        role="user",
        content=request.message,
    )

    # ── Persist assistant turn to disk ──
    raw_products = result.get("products") or []
    raw_order = result.get("order")
    append_to_log(
        session_id,
        role="assistant",
        content=result["reply"],
        products=raw_products,
        order=raw_order,
        action_type=result["action_type"],
    )

    # Map to response models
    products = [Product(**p) for p in raw_products] if raw_products else None
    order = OrderInfo(**raw_order) if raw_order else None

    return ChatResponse(
        reply=result["reply"],
        action_type=result["action_type"],
        products=products,
        order=order,
        session_id=session_id,
    )


# ══════════════════════════════════════════════════
# HISTORY ENDPOINTS
# ══════════════════════════════════════════════════
@app.get("/history")
async def list_history():
    """Danh sách tất cả sessions đã lưu, mới nhất trước."""
    sessions_list = []
    for f in sorted(HISTORY_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            sessions_list.append({
                "session_id": data["session_id"],
                "title": data.get("title", "Cuộc trò chuyện"),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
                "message_count": len(data.get("messages", [])),
            })
        except Exception:
            continue
    return {"sessions": sessions_list}


@app.get("/history/{session_id}")
async def get_history(session_id: str):
    """Lấy toàn bộ lịch sử của một session."""
    f = history_file(session_id)
    if not f.exists():
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return json.loads(f.read_text(encoding="utf-8"))


@app.delete("/history/{session_id}")
async def delete_history(session_id: str):
    """Xoá lịch sử của một session."""
    f = history_file(session_id)
    if f.exists():
        f.unlink()
    if session_id in sessions:
        del sessions[session_id]
    return {"message": "Đã xoá", "session_id": session_id}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
    return {"message": "Session cleared", "session_id": session_id}


# ══════════════════════════════════════════════════
# FRONTEND STATIC
# ══════════════════════════════════════════════════
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
