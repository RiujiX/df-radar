
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi import status
from websocket_manager import manager
from fastapi.staticfiles import StaticFiles
from dotenv import find_dotenv, load_dotenv
from cachetools import TTLCache

import os


dotenv_path = find_dotenv()
if not os.path.exists(dotenv_path): open(".env", "w").write("PERCEPTION_HANDSHAKE=\"\"")
load_dotenv(dotenv_path, override=True)

HANDSHAKE_KEY = os.getenv("PERCEPTION_HANDSHAKE")
HANDSHAKE_CACHE = TTLCache(ttl=120, maxsize=1_000)

app = FastAPI()

@app.get("/favicon.ico")
async def get_favicon():
    return FileResponse("../front/favicon.ico")

@app.get("/df/{root_nickname}")
async def serve_radar(root_nickname: str):
    return FileResponse("../front/index.html")

app.mount("/df", StaticFiles(directory="../front", html=True), name="static")

@app.post("/api/df/game-data/{root_nickname}")
async def receive_game_data(request: Request, root_nickname: str, data: dict):
    if request.client.host not in ("127.0.0.1", "localhost") and request.client.host not in HANDSHAKE_CACHE.keys():
        if data.get("PERCEPTION_HANDSHAKE", "") != HANDSHAKE_KEY:
            return PlainTextResponse("FORBIDDEN", status.HTTP_403_FORBIDDEN)
        else:
            HANDSHAKE_CACHE[request.client.host] = "HANDSHAKED"

    if not data.get("update_type", None): return PlainTextResponse("BAD_REQUEST", status.HTTP_400_BAD_REQUEST)
    if data.get("update_type") == "PING": return PlainTextResponse("PONG", status.HTTP_200_OK)
    await manager.broadcast_to_viewers(root_nickname, {
        "type": "game_update",
        "data": data
    })

@app.get("/api/df/{root_nickname}/current_map")
async def get_current_map(root_nickname: str):
    if root_nickname not in manager.root_latest_known_map.keys(): 
        return PlainTextResponse("offline", status.HTTP_200_OK)
    
    return PlainTextResponse(manager.root_latest_known_map[root_nickname], status.HTTP_200_OK)

@app.websocket("/api/ws/view-df/{root_nickname}")
async def websocket_endpoint(websocket: WebSocket, root_nickname: str):
    await manager.connect_viewer(websocket, root_nickname)
    try:
        while True:
            data = await websocket.receive_text()
            if data:
                print(f"Recieved some data from front-end by root: {root_nickname}")
    except WebSocketDisconnect:
        manager.disconnect_viewer(websocket, root_nickname)

    