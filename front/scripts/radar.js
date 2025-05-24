// Базовые переменные для работы с канвасом
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastX, lastY;
let mapImage = new Image();
let players = [];
let items = [];
let currentMap = 'zerodam';
let socket = null;

// Загрузка иконок
const playerIcons = {
    ally: new Image(),
    allyWounded: new Image(),
    allyDead: new Image(),
    enemy: new Image(),
    enemyWounded: new Image(),
    enemyDead: new Image(),
};

// Предустановка иконок (можно заменить на свои)
playerIcons.ally.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzRDQUY1MCIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3bC0xMC01eiIvPjwvc3ZnPg==';
playerIcons.allyWounded.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3bC0xMC01eiIvPjwvc3ZnPg==';
playerIcons.allyDead.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzc4Nzg3OCIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3bC0xMC01eiIvPjwvc3ZnPg==';
playerIcons.enemy.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBmaWxsPSIjZjQ0MzM2IiBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=';
playerIcons.enemyWounded.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBmaWxsPSIjRkY5ODAwIiBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=';
playerIcons.enemyDead.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBmaWxsPSIjNzg3ODc4IiBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=';

// Инициализация размеров канваса
function resizeCanvas() {
    const container = document.querySelector('.map-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redraw();
}

// Загрузка изображения карты
function loadMap(mapName) {
    if (mapName == "lobby") { mapName = "standby"; currentMap = "standby"; players = []; };
    let img_ext = (mapName == "offline" || mapName == "standby") ? "svg" : "webp";
    let imgWidth, imgHeight;
    // let fix_svg_size = currentMap == "offline" || "standby" ? 5 : 1
    console.log(`assets/maps/${mapName}.${img_ext}`);
    mapImage.src = `assets/maps/${mapName}.${img_ext}`;
    mapImage.onload = function() {
        resizeCanvas();
        
        if (currentMap == "offline" || currentMap == "standby") {
            imgWidth = canvas.height;
            imgHeight = canvas.height;
        } else {
            imgWidth = mapImage.naturalWidth * scale;
            imgHeight = mapImage.naturalHeight * scale;
        }
        
        // Центрирование карты при загрузке
        offsetX = (canvas.width - imgWidth) / 2;
        offsetY = (canvas.height - imgHeight) / 2;
        
        redraw();
    };
}
// Перерисовка всего канваса
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // let imgWidth, imgHeight;
    
    if (currentMap == "offline" || currentMap == "standby") {
        imgWidth = canvas.height;
        imgHeight = canvas.height;
    } else {
        imgWidth = mapImage.naturalWidth * scale;
        imgHeight = mapImage.naturalHeight * scale;
    }

    // Отрисовка карты с учетом масштаба и смещения
    ctx.drawImage(
        mapImage, 
        offsetX, 
        offsetY, 
        imgWidth, 
        imgHeight
    );
    
    // Получение настроек фильтров
    const showAllies = document.getElementById('show-allies').checked;
    const showEnemies = document.getElementById('show-enemies').checked;
    const showSelf = document.getElementById('show-self').checked;
    const showDead = document.getElementById('show-dead').checked;
    const markerSize = parseInt(document.getElementById('marker-size').value);
    
    // Отрисовка игроков
    players.forEach(player => {
        // Применение фильтров
        if ((player.team === 'ally' && !showAllies) || 
            (player.team === 'enemy' && !showEnemies) ||
            (player.is_self && !showSelf) ||
            (player.status === 'dead' && !showDead)) {
            return;
        }
        
        // Конвертация мировых координат в координаты канваса
        const { x: canvasX, y: canvasY } = map1.worldToCanvas(player.pos.x, player.pos.y);
        
        // Определение иконки и цвета маркера
        let color;
        let icon = null;
        
        // Определяем, какую иконку показывать
        if (player.team === 'ally') {
            color = '#4CAF50';
            if (player.status === 'dead') {
                icon = playerIcons.allyDead;
            } else if (player.status === 'wounded') {
                icon = playerIcons.allyWounded;
            } else {
                icon = playerIcons.ally;
            }
        } else {
            color = '#f44336';
            if (player.status === 'dead') {
                icon = playerIcons.enemyDead;
            } else if (player.status === 'wounded') {
                icon = playerIcons.enemyWounded;
            } else {
                icon = playerIcons.enemy;
            }
        }
        
        // Если игрок мертв, делаем маркер полупрозрачным
        const opacity = player.status === 'dead' ? 0.5 : 1.0;
        ctx.globalAlpha = opacity;
        
        // Рисуем иконку если доступна или круг если нет
        const iconSize = markerSize * 2;
        
        if (icon && icon.complete) {
            ctx.drawImage(
                icon, 
                canvasX - iconSize/2, 
                canvasY - iconSize/2, 
                iconSize, 
                iconSize
            );
        } else {
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, markerSize, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
        
        // Рисуем имя игрока
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(player.name, canvasX + markerSize + 2, canvasY + 4);
        
        ctx.globalAlpha = 1.0;
    });

    // // Отрисовка предметов
    // if (showItems) {
    //     items.forEach(item => {
    //         // Используем иконку или маркер
    //         const itemIconSize = markerSize * 1.6;
            
    //         if (item.iconSrc) {
    //             // Если у предмета определена иконка, используем ее
    //             const itemIcon = new Image();
    //             itemIcon.src = item.iconSrc;
                
    //             if (itemIcon.complete) {
    //                 ctx.drawImage(
    //                     itemIcon, 
    //                     item.x - itemIconSize/2, 
    //                     item.y - itemIconSize/2, 
    //                     itemIconSize, 
    //                     itemIconSize
    //                 );
    //             } else {
    //                 // Запасной вариант
    //                 ctx.beginPath();
    //                 ctx.arc(item.x, item.y, markerSize * 0.8, 0, Math.PI * 2);
    //                 ctx.fillStyle = '#FFC107';
    //                 ctx.fill();
    //             }
    //         } else {
    //             // Стандартный маркер
    //             ctx.beginPath();
    //             ctx.arc(item.x, item.y, markerSize * 0.8, 0, Math.PI * 2);
    //             ctx.fillStyle = '#FFC107';
    //             ctx.fill();
    //         }
            
    //         // Название предмета если есть
    //         if (item.name) {
    //             ctx.font = '10px Arial';
    //             ctx.fillStyle = 'white';
    //             ctx.fillText(item.name, item.x + markerSize, item.y + 3);
    //         }
    //     });
    // }
    
    ctx.restore();
}

// Инициализация WebSocket соединения
function initWebSocket(rootNickname) {
    // Закрываем предыдущее соединение если есть
    if (socket) {
        socket.close();
    }
    
    // Устанавливаем новое соединение
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/view-df/${rootNickname}`;
    console.log(wsUrl);
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function() {
        console.log('WebSocket соединение установлено');
        updateConnectionStatus(true);
    };
    
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data).data;

            if (data.update_type == "GAME_DATA") {
                // Обновляем данные игроков и предметов
                if (data.players) {
                    players = data.players;
                }
                
                // if (data.items) {
                //     items = data.items;
                // }
                
                // Обновляем счетчики
                updatePlayerCount();
                
                // Перерисовываем
                redraw();
            } else if (data.update_type == "SWITCH_MAP") {
                // Change map
                console.log(`Map changed to ${data.new_map}`)
                currentMap = data.new_map;
                loadMap(currentMap);
                
            // } else if (data.type === 'connectionStatus') {
            //     // Обновляем статус подключения к игре
            //     document.getElementById('status-text').textContent = 
            //         data.connected ? 'Подключено к игре' : 'Игра не подключена';
            }
        } catch (error) {
            console.error('Performing websocket message Error:', error);
        }
    };
    
    socket.onclose = function() {
        console.log('WebSocket connection closed.');
        updateConnectionStatus(false);
        
        // Попытка переподключения через 5 секунд
        setTimeout(() => {
            initWebSocket(rootNickname);
        }, 5000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket Error:', error);
        updateConnectionStatus(false);
    };
}

// Обновляем индикатор статуса соединения
function updateConnectionStatus(isConnected) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (isConnected) {
        statusIndicator.classList.remove('status-disconnected');
        statusIndicator.classList.add('status-connected');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('status-connected');
        statusIndicator.classList.add('status-disconnected');
        statusText.textContent = 'Disconnected';
    }
}

// Обновляем счетчики игроков
function updatePlayerCount() {
    const allyCount = players.filter(p => p.team === 'ally').length;
    const enemyCount = players.filter(p => p.team === 'enemy').length;
    
    document.getElementById('player-count').textContent = `Players on map: ${players.length}`;
    document.getElementById('team-breakdown').textContent = `Allies: ${allyCount} | Enemies: ${enemyCount}`;
}

// Обработчики событий для перетаскивания карты
canvas.addEventListener('mousedown', function(e) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', function(e) {
    if (isDragging) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastX = e.clientX;
        lastY = e.clientY;
        
        redraw();
    }
});

canvas.addEventListener('mouseup', function() {
    isDragging = false;
    canvas.style.cursor = 'move';
});

canvas.addEventListener('mouseleave', function() {
    isDragging = false;
    canvas.style.cursor = 'move';
});

// Обработчики событий для мобильных устройств
canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        e.preventDefault();
    }
});

canvas.addEventListener('touchmove', function(e) {
    if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - lastX;
        const deltaY = e.touches[0].clientY - lastY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        
        redraw();
        e.preventDefault();
    }
});

canvas.addEventListener('touchend', function() {
    isDragging = false;
});

// Плавное масштабирование с анимацией
function smoothZoom(targetScale, centerX, centerY) {
    const startScale = scale;
    const scaleDiff = targetScale - startScale;
    const startOffsetX = offsetX;
    const startOffsetY = offsetY;
    
    // Если центр масштабирования указан, вычисляем новое смещение
    let targetOffsetX = offsetX;
    let targetOffsetY = offsetY;
    
    if (centerX !== undefined && centerY !== undefined) {
        // Вычисляем смещение с учетом центра масштабирования
        const worldX = (centerX - offsetX) / scale;
        const worldY = (centerY - offsetY) / scale;
        targetOffsetX = centerX - worldX * targetScale;
        targetOffsetY = centerY - worldY * targetScale;
    }
    
    const offsetDiffX = targetOffsetX - startOffsetX;
    const offsetDiffY = targetOffsetY - startOffsetY;
    
    const duration = 200; // мс
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Плавное изменение масштаба и позиции с эффектом ease-out
        const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease-out
        
        scale = startScale + scaleDiff * easeProgress;
        offsetX = startOffsetX + offsetDiffX * easeProgress;
        offsetY = startOffsetY + offsetDiffY * easeProgress;
        
        redraw();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// Масштабирование при нажатии на кнопки
document.getElementById('zoom-in').addEventListener('click', function() {
    // if (currentMap == "offline" || "standby")
    //     return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    smoothZoom(scale * 1.5, centerX, centerY);
});

document.getElementById('zoom-out').addEventListener('click', function() {
    // if (currentMap == "offline" || "standby")
    //     return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    smoothZoom(scale / 1.5, centerX, centerY);
});

// Touch-based zoom controls for mobile
let lastTouchDistance = 0;
let touchCenterX = 0;
let touchCenterY = 0;

canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
        e.preventDefault(); // Prevent default browser behavior (e.g., scrolling)
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        touchCenterX = (touch1.clientX + touch2.clientX) / 2;
        touchCenterY = (touch1.clientY + touch2.clientY) / 2;
    }
});

canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentTouchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        
        // Calculate zoom factor based on pinch distance change
        const zoomFactor = currentTouchDistance / lastTouchDistance;
        smoothZoom(scale * zoomFactor, touchCenterX, touchCenterY);
        
        lastTouchDistance = currentTouchDistance;
    }
});

canvas.addEventListener('touchend', function(e) {
    // Reset when pinch gesture ends
    lastTouchDistance = 0;
});

// Масштабирование колесиком мыши
canvas.addEventListener('wheel', function(e) {
    // if (currentMap == "offline" || "standby")
    //     return;

    e.preventDefault();
    
    // Определяем направление скролла
    const delta = -Math.sign(e.deltaY);
    const factor = delta > 0 ? 1.3 : 0.77;
    
    // Позиция мыши относительно канваса
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Масштабируем относительно позиции курсора
    smoothZoom(scale * factor, mouseX, mouseY);
});

// Переключение карт
document.querySelectorAll('.map-button').forEach((button, index) => {
    button.addEventListener('click', function() {
        const mapName = `map${index + 1}`;
        
        // Запрос на смену карты через WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'requestMapChange',
                mapName: mapName
            }));
        }
        
        // Обновляем UI
        updateMapButtons(mapName);
    });
});

// Обработчики событий для всех фильтров
document.querySelectorAll('input[type="checkbox"], input[type="range"]').forEach(input => {
    input.addEventListener('change', redraw);
});

// Обработка изменения размера окна
window.addEventListener('resize', resizeCanvas);

// Инициализация
function init() {
    // Извлекаем nickname из URL
    const pathParts = window.location.pathname.split('/');
    const rootNickname = pathParts[pathParts.length - 1] || 'default';
    
    // Загружаем карту
    loadMap(currentMap);
    
    // Инициализируем WebSocket
    initWebSocket(rootNickname);
    
    players = [
        { name: 'Игрок 1', pos: {x: -48000, y: -48000}, team: 'ally', status: 'alive', isSelf: true }
    ]

    // Инициализируем демо-данные с иконками
    // players = [
    //     { name: 'Игрок 1', x: 100, y: 100, team: 'ally', status: 'alive', isSelf: true },
    //     { name: 'Игрок 2', x: 200, y: 150, team: 'ally', status: 'wounded' },
    //     { name: 'Враг 1', x: 300, y: 250, team: 'enemy', status: 'alive' },
    //     { name: 'Враг 2', x: 400, y: 300, team: 'enemy', status: 'dead' }
    // ];
    
    // Демо-предметы с иконками
    // items = [
    //     { 
    //         name: 'Аптечка', 
    //         x: 150, 
    //         y: 200,
    //         iconSrc: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgZmlsbD0id2hpdGUiIHg9IjQiIHk9IjQiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgcng9IjIiLz48cGF0aCBmaWxsPSJyZWQiIGQ9Ik0xMSA3djRIN3YyaDR2NGgydi00aDR2LTJoLTR2LTR6Ii8+PC9zdmc+'
    //     },
    //     { 
    //         name: 'Оружие', 
    //         x: 350, 
    //         y: 180,
    //         iconSrc: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzc5NTU0OCIgZD0iTTIxLDVjMC0yLTItMi0yLTJINWMwLDAtMiwwLTIsMnYzaDJ2MkgzdjJoMnYySDN2MmgydjJjMCwwLDAsMS4wNywwLjk1LDFoMTYuMTJDMjEsMTkuODgsMjEsMTksMjEsMTl2LTJoLTJ2LTJoMnYtMmgtMnYtMmgyVjhjLTEsMC0yLTEtMi0xLjVDMTksNi41LDE5LDUsMjEsNXoiLz48L3N2Zz4='
    //     }
    // ];
    
    // updatePlayerCount();
    // trackCursorCoordinates();
    // addCalibrationButton();
}

// Функция для перевода координат
class MapConverter {
    constructor(worldX1, worldY1, mapX1, mapY1, worldX2, worldY2, mapX2, mapY2) {
        // Вычисляем коэффициенты a, b, c, d на основе двух точек
        this.a = (mapX2 - mapX1) / (worldX2 - worldX1);
        this.b = mapX1 - this.a * worldX1;
        this.c = (mapY2 - mapY1) / (worldY2 - worldY1);
        this.d = mapY1 - this.c * worldY1;
    }

    worldToCanvas(worldX, worldY) {
        // Преобразуем мировые координаты в координаты карты
        const mapX = this.a * worldX + this.b;
        const mapY = this.c * worldY + this.d;
        // Применяем зум и смещение для получения координат на канвасе
        const canvasX = mapX * scale + offsetX;
        const canvasY = mapY * scale + offsetY;
        return { x: canvasX, y: canvasY };
    }
}

// Пример использования для одной карты
const map1 = new MapConverter(
    11147.27, 6738.17, 2708, 2017, // Первая точка: мир (x1, y1) -> карта (x1, y1)
    -21573.45, -25095.97, 1738, 1072  // Вторая точка: мир (x2, y2) -> карта (x2, y2)
);

// Функция для отслеживания координат курсора
// function trackCursorCoordinates() {
//     // Создаем элемент для отображения координат если его еще нет
//     let coordDisplay = document.getElementById('cursor-coords');
//     if (!coordDisplay) {
//         coordDisplay = document.createElement('div');
//         coordDisplay.id = 'cursor-coords';
//         coordDisplay.style.cssText = `
//             position: fixed;
//             top: 10px;
//             right: 10px;
//             background: rgba(0, 0, 0, 0.8);
//             color: white;
//             padding: 10px;
//             border-radius: 5px;
//             font-family: monospace;
//             font-size: 12px;
//             z-index: 1000;
//             pointer-events: none;
//             min-width: 250px;
//         `;
//         document.body.appendChild(coordDisplay);
//     }
    
//     // Обработчик движения мыши
//     canvas.addEventListener('mousemove', function(e) {
//         // Получаем координаты курсора относительно канваса
//         const rect = canvas.getBoundingClientRect();
//         const canvasX = e.clientX - rect.left;
//         const canvasY = e.clientY - rect.top;
        
//         // Конвертируем в мировые координаты (с текущими предположениями)
        
//         // Также показываем координаты на карте (до применения масштаба и смещения)
//         const mapX = (canvasX - offsetX) / scale;
//         const mapY = (canvasY - offsetY) / scale;
        
//         // Обновляем отображение
//         coordDisplay.innerHTML = `
//             <strong>Координаты курсора:</strong><br>
//             Canvas: ${Math.round(canvasX)}, ${Math.round(canvasY)}<br>
//             Map: ${Math.round(mapX)}, ${Math.round(mapY)}<br>
//             <br>
//             <strong>Параметры:</strong><br>
//             Scale: ${scale.toFixed(3)}<br>
//             Offset: ${Math.round(offsetX)}, ${Math.round(offsetY)}<br>
//             Map size: ${mapImage.naturalWidth}x${mapImage.naturalHeight}
//         `;
//     });
    
//     // Скрываем координаты когда курсор покидает канвас
//     canvas.addEventListener('mouseleave', function() {
//         coordDisplay.style.display = 'none';
//     });
    
//     // Показываем координаты когда курсор входит в канвас
//     canvas.addEventListener('mouseenter', function() {
//         coordDisplay.style.display = 'block';
//     });
// }

// Запуск приложения
init();