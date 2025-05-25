// Canvas and basic variables
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastX, lastY;
let mapImage = new Image();
let players = [];
let currentMap = 'zerodam';
let socket = null;

// Player icons
const playerIcons = {
    alive: new Image(),
    ally: new Image(),
    self: new Image(),
    injured: new Image(),
    boxed: new Image()
};

// Load icons
playerIcons.alive.src = 'assets/markers/enemy.svg';
playerIcons.ally.src = 'assets/markers/ally.svg';
playerIcons.self.src = 'assets/markers/self.svg';
playerIcons.injured.src = 'assets/markers/injured.svg';
playerIcons.boxed.src = 'assets/markers/boxed.svg';

// Canvas initialization
function resizeCanvas() {
    const container = document.querySelector('.map-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redraw();
}

// Map loading
function loadMap(mapName) {
    if (mapName === "lobby") {
        mapName = "standby";
        currentMap = "standby";
        players = [];
    }
    
    const img_ext = (mapName === "offline" || mapName === "standby") ? "svg" : "webp";
    console.log(`assets/maps/${mapName}.${img_ext}`);
    
    mapImage.src = `assets/maps/${mapName}.${img_ext}`;
    mapImage.onload = function() {
        resizeCanvas();
        centerMap();
        redraw();
    };
}

// Center map on load
function centerMap() {
    const imgWidth = (currentMap === "offline" || currentMap === "standby") 
        ? canvas.height 
        : mapImage.naturalWidth * scale;
    const imgHeight = (currentMap === "offline" || currentMap === "standby") 
        ? canvas.height 
        : mapImage.naturalHeight * scale;
    
    offsetX = (canvas.width - imgWidth) / 2;
    offsetY = (canvas.height - imgHeight) / 2;
}

// Main redraw function
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw map
    drawMap();
    
    // Draw players with filters
    drawPlayers();
}

function drawMap() {
    const imgWidth = (currentMap === "offline" || currentMap === "standby") 
        ? canvas.height 
        : mapImage.naturalWidth * scale;
    const imgHeight = (currentMap === "offline" || currentMap === "standby") 
        ? canvas.height 
        : mapImage.naturalHeight * scale;

    ctx.drawImage(mapImage, offsetX, offsetY, imgWidth, imgHeight);
}

function drawPlayers() {
    // Get filter settings
    const showAllies = document.getElementById('show-allies').checked;
    const showEnemies = document.getElementById('show-enemies').checked;
    const showSelf = document.getElementById('show-self').checked;
    const showDead = document.getElementById('show-dead').checked;
    const markerSize = parseInt(document.getElementById('marker-size').value);
    
    players.forEach(player => {
        // Apply filters
        if (!shouldShowPlayer(player, showAllies, showEnemies, showSelf, showDead)) {
            return;
        }
        
        // Convert world coordinates to canvas coordinates
        const { x: canvasX, y: canvasY } = map1.worldToCanvas(player.pos.x, player.pos.y);
        
        // Draw player marker
        drawPlayerMarker(player, canvasX, canvasY, markerSize);
        
        // Draw player name
        drawPlayerName(player, canvasX, canvasY, markerSize);
    });
}

function shouldShowPlayer(player, showAllies, showEnemies, showSelf, showDead) {
    if (player.is_self && !showSelf) return false;
    if (player.team === 'ally' && !showAllies) return false;
    if (player.team === 'enemy' && !showEnemies) return false;
    if (player.status === 'deadboxed' && !showDead) return false;
    return true;
}

function drawPlayerMarker(player, canvasX, canvasY, markerSize) {
    const icon = getPlayerIcon(player);
    const baseSize = markerSize * 2;
    const opacity = player.status === 'deadboxed' ? 0.5 : 1.0;
    
    ctx.globalAlpha = opacity;
    
    if (icon && icon.complete) {
        // Calculate proper icon dimensions maintaining aspect ratio
        const iconWidth = icon.naturalWidth || icon.width;
        const iconHeight = icon.naturalHeight || icon.height;
        const aspectRatio = iconWidth / iconHeight;
        
        let drawWidth, drawHeight;
        if (aspectRatio > 1) {
            // Width is larger - scale based on width
            drawWidth = baseSize;
            drawHeight = baseSize / aspectRatio;
        } else {
            // Height is larger or equal - scale based on height
            drawHeight = baseSize;
            drawWidth = baseSize * aspectRatio;
        }
        
        if (shouldRotateIcon(player)) {
            drawRotatedIcon(icon, canvasX, canvasY, drawWidth, drawHeight, player.yaw || 0);
        } else {
            ctx.drawImage(icon, canvasX - drawWidth/2, canvasY - drawHeight/2, drawWidth, drawHeight);
        }
    } else {
        // Fallback circle
        drawFallbackCircle(player, canvasX, canvasY, markerSize);
    }
    
    ctx.globalAlpha = 1.0;
}

function getPlayerIcon(player) {
    if (player.is_self) return playerIcons.self;
    if (player.team === 'ally') return playerIcons.ally;
    
    // Enemy icons based on status
    switch (player.status) {
        case 'deadboxed': return playerIcons.boxed;
        case 'injured': return playerIcons.injured;
        case 'alive': return playerIcons.alive;
        default: return playerIcons.alive;
    }
}

function shouldRotateIcon(player) {
    // Only rotate directional icons (alive, ally, self)
    return player.is_self || 
           player.team === 'ally' || 
           (player.team === 'enemy' && player.status === 'alive');
}

function drawRotatedIcon(icon, centerX, centerY, width, height, yawDegrees) {
    ctx.save();
    
    // Convert yaw to radians (assuming yaw is in degrees)
    const yawRadians = (yawDegrees * Math.PI) / 180;
    
    // Move to center point
    ctx.translate(centerX, centerY);
    
    // Rotate around center
    ctx.rotate(yawRadians);
    
    // Draw icon centered at origin with proper dimensions
    ctx.drawImage(icon, -width/2, -height/2, width, height);
    
    ctx.restore();
}

function drawFallbackCircle(player, canvasX, canvasY, markerSize) {
    const color = player.is_self ? '#00FF00' : 
                  player.team === 'ally' ? '#4CAF50' : '#f44336';
    
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, markerSize, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawPlayerName(player, canvasX, canvasY, markerSize) {
    ctx.font = '12px Arial';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    
    // Draw text with outline for better visibility
    ctx.strokeText(player.name, canvasX + markerSize + 2, canvasY + 4);
    ctx.fillText(player.name, canvasX + markerSize + 2, canvasY + 4);
}

// WebSocket initialization
function initWebSocket(rootNickname) {
    if (socket) socket.close();
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/view-df/${rootNickname}`;
    console.log('Connecting to:', wsUrl);
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data).data;
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };
    
    socket.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        setTimeout(() => initWebSocket(rootNickname), 5000);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

function handleWebSocketMessage(data) {
    switch (data.update_type) {
        case "GAME_DATA":
            if (data.players) {
                players = data.players;
                updatePlayerCount();
                redraw();
            }
            break;
            
        case "SWITCH_MAP":
            console.log(`Map changed to ${data.new_map}`);
            currentMap = data.new_map;
            loadMap(currentMap);
            break;
    }
}

// Status and UI updates
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

function updatePlayerCount() {
    const allyCount = players.filter(p => p.team === 'ally').length;
    const enemyCount = players.filter(p => p.team === 'enemy').length;
    
    document.getElementById('player-count').textContent = `Players on map: ${players.length}`;
    document.getElementById('team-breakdown').textContent = `Allies: ${allyCount} | Enemies: ${enemyCount}`;
}

// Mouse and touch event handlers
function setupEventHandlers() {
    // Mouse drag events
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
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

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'move';
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'move';
    });

    // Touch events
    setupTouchEvents();
    
    // Zoom events
    setupZoomEvents();
    
    // Filter change events
    document.querySelectorAll('input[type="checkbox"], input[type="range"]')
        .forEach(input => input.addEventListener('change', redraw));
    
    // Window resize
    window.addEventListener('resize', resizeCanvas);
}

function setupTouchEvents() {
    let lastTouchDistance = 0;
    let touchCenterX = 0;
    let touchCenterY = 0;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            e.preventDefault();
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            touchCenterX = (touch1.clientX + touch2.clientX) / 2;
            touchCenterY = (touch1.clientY + touch2.clientY) / 2;
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - lastX;
            const deltaY = e.touches[0].clientY - lastY;
            
            offsetX += deltaX;
            offsetY += deltaY;
            
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            redraw();
            e.preventDefault();
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentTouchDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            
            const zoomFactor = currentTouchDistance / lastTouchDistance;
            smoothZoom(scale * zoomFactor, touchCenterX, touchCenterY);
            
            lastTouchDistance = currentTouchDistance;
        }
    });

    canvas.addEventListener('touchend', () => {
        isDragging = false;
        lastTouchDistance = 0;
    });
}

function setupZoomEvents() {
    // Zoom buttons
    document.getElementById('zoom-in').addEventListener('click', () => {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        smoothZoom(scale * 1.5, centerX, centerY);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        smoothZoom(scale / 1.5, centerX, centerY);
    });

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const delta = -Math.sign(e.deltaY);
        const factor = delta > 0 ? 1.3 : 0.77;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        smoothZoom(scale * factor, mouseX, mouseY);
    });
}

// Smooth zoom animation
function smoothZoom(targetScale, centerX, centerY) {
    const startScale = scale;
    const scaleDiff = targetScale - startScale;
    const startOffsetX = offsetX;
    const startOffsetY = offsetY;
    
    let targetOffsetX = offsetX;
    let targetOffsetY = offsetY;
    
    if (centerX !== undefined && centerY !== undefined) {
        const worldX = (centerX - offsetX) / scale;
        const worldY = (centerY - offsetY) / scale;
        targetOffsetX = centerX - worldX * targetScale;
        targetOffsetY = centerY - worldY * targetScale;
    }
    
    const offsetDiffX = targetOffsetX - startOffsetX;
    const offsetDiffY = targetOffsetY - startOffsetY;
    
    const duration = 200;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
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

// Coordinate conversion class
class MapConverter {
    constructor(worldX1, worldY1, mapX1, mapY1, worldX2, worldY2, mapX2, mapY2) {
        this.a = (mapX2 - mapX1) / (worldX2 - worldX1);
        this.b = mapX1 - this.a * worldX1;
        this.c = (mapY2 - mapY1) / (worldY2 - worldY1);
        this.d = mapY1 - this.c * worldY1;
    }

    worldToCanvas(worldX, worldY) {
        const mapX = this.a * worldX + this.b;
        const mapY = this.c * worldY + this.d;
        const canvasX = mapX * scale + offsetX;
        const canvasY = mapY * scale + offsetY;
        return { x: canvasX, y: canvasY };
    }
}

// Map converter instance
const map1 = new MapConverter(
    11147.27, 6738.17, 2708, 2017,
    -21573.45, -25095.97, 1738, 1072
);

// Cursor coordinates tracking
function trackCursorCoordinates() {
    let coordDisplay = document.getElementById('cursor-coords');
    if (!coordDisplay) {
        coordDisplay = document.createElement('div');
        coordDisplay.id = 'cursor-coords';
        coordDisplay.style.cssText = `
            position: fixed; top: 10px; right: 10px;
            background: rgba(0, 0, 0, 0.8); color: white;
            padding: 10px; border-radius: 5px;
            font-family: monospace; font-size: 12px;
            z-index: 1000; pointer-events: none;
            min-width: 250px;
        `;
        document.body.appendChild(coordDisplay);
    }
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const mapX = (canvasX - offsetX) / scale;
        const mapY = (canvasY - offsetY) / scale;
        
        coordDisplay.innerHTML = `
            <strong>Cursor Coordinates:</strong><br>
            Canvas: ${Math.round(canvasX)}, ${Math.round(canvasY)}<br>
            Map: ${Math.round(mapX)}, ${Math.round(mapY)}<br>
            <br>
            <strong>Parameters:</strong><br>
            Scale: ${scale.toFixed(3)}<br>
            Offset: ${Math.round(offsetX)}, ${Math.round(offsetY)}<br>
            Map size: ${mapImage.naturalWidth}x${mapImage.naturalHeight}
        `;
    });
    
    canvas.addEventListener('mouseleave', () => coordDisplay.style.display = 'none');
    canvas.addEventListener('mouseenter', () => coordDisplay.style.display = 'block');
}

async function getCurrentMap(rootNickname) {
    try {
        const res = await fetch(`/api/df/${rootNickname}/current_map`);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const map = await res.text();
        return map;

    } catch (error) {
        console.error('Error fetching current map:', error);
        return 'offline';
    }
}

// Application initialization
async function init() {
    const pathParts = window.location.pathname.split('/');
    const rootNickname = pathParts[pathParts.length - 1] || 'default';

    const map = await getCurrentMap(rootNickname);

    loadMap(map);
    initWebSocket(rootNickname);
    setupEventHandlers();
    trackCursorCoordinates();
    
    // Demo data
    players = [
        { name: 'Player 1', pos: {x: -48000, y: -48000}, team: 'ally', status: 'alive', is_self: true, yaw: 45 }
    ];
}

// Start application
(async () => {
    await init();
})();