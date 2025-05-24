
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse
from websocket_manager import manager
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.get("/df/{root_nickname}")
async def serve_radar(root_nickname: str):
    return FileResponse("../front/index.html")

app.mount("/df", StaticFiles(directory="../front", html=True), name="static")

@app.post("/api/df/game-data/{root_nickname}")
async def receive_game_data(root_nickname: str, data: dict):
    if not data.get("update_type", None): return PlainTextResponse("BAD_REQUEST", 400)
    if data.get("update_type") == "PING": return PlainTextResponse("PONG", 200)

    broadcasted_data = {
        "type": "game_update",
        "data": data
    }
    print(f'Broadcasting: {broadcasted_data}')
    await manager.broadcast_to_viewers(root_nickname, {
        "type": "game_update",
        "data": data
    })

@app.websocket("/api/ws/view-df/{root_nickname}")
async def websocket_endpoint(websocket: WebSocket, root_nickname: str):
    await manager.connect_viewer(websocket, root_nickname)
    try:
        while True:
            # Ждем сообщения от клиента (ping/pong или команды)
            data = await websocket.receive_text()
            if data:
                print(f"Recieved some data from front-end by root: {root_nickname}")
            # Можно обработать команды от клиента если нужно
    except WebSocketDisconnect:
        manager.disconnect_viewer(websocket, root_nickname)

    