import json
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Только подключения зрителей (получают данные)
        self.viewer_connections: Dict[str, List[WebSocket]] = {}
        self.root_latest_known_map: Dict[str, str] = {}

    async def connect_viewer(self, websocket: WebSocket, root_nickname: str):
        await websocket.accept()
        if root_nickname not in self.viewer_connections:
            self.viewer_connections[root_nickname] = []
        self.viewer_connections[root_nickname].append(websocket)

    def disconnect_viewer(self, websocket: WebSocket, root_nickname: str):
        if root_nickname in self.viewer_connections:
            if websocket in self.viewer_connections[root_nickname]:
                self.viewer_connections[root_nickname].remove(websocket)

    async def broadcast_to_viewers(self, root_nickname: str, data: dict):
        if data['data']['update_type'] == "SWITCH_MAP":
            self.root_latest_known_map[root_nickname] = data['data']['new_map']

        if root_nickname in self.viewer_connections:
            disconnected = []
            for connection in self.viewer_connections[root_nickname]:
                try:
                    await connection.send_text(json.dumps(data))
                except:
                    disconnected.append(connection)
            
            # Удаляем отключенные соединения
            for conn in disconnected:
                self.viewer_connections[root_nickname].remove(conn)

manager = ConnectionManager()