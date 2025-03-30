// DOM元素
const speedElement = document.getElementById('speed');
const altitudeElement = document.getElementById('altitude');
const headingElement = document.getElementById('heading');
const loadingElement = document.getElementById('loading');

// 游戏参数
const WORLD_SIZE = 10000;
const TERRAIN_SEGMENTS = 100;
const MIN_HEIGHT = -20;
const MAX_HEIGHT = 200;
const CLOUD_COUNT = 50;

// 飞机参数
const MAX_SPEED = 500;
const MIN_SPEED = 50;
const ACCELERATION = 50;
const TURN_SPEED = 0.02;
const PITCH_SPEED = 0.02;
const ROLL_SPEED = 0.02;

// 游戏状态
let gameState = {
    speed: 100,                     // 当前速度 (km/h)
    altitude: 100,                  // 高度 (m)
    heading: 0,                     // 航向角 (degrees)
    pitch: 0,                       // 俯仰角 (radians)
    roll: 0,                        // 翻滚角 (radians)
    yaw: 0,                         // 偏航角 (radians)
    position: new THREE.Vector3(0, 100, 0), // 初始位置
    isLoaded: false
};

// 键盘控制状态
const keys = {
    w: false, // 向前俯仰
    s: false, // 向后俯仰
    a: false, // 左侧翻滚
    d: false, // 右侧翻滚
    q: false, // 左偏航
    e: false, // 右偏航
    r: false, // 加速
    f: false, // 减速
    space: false // 重置位置
};

// Three.js 变量
let scene, camera, renderer, airplane, terrain, sky, clouds = [];
let clock = new THREE.Clock();

// 统计信息
let stats;

// 初始化场景
function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0002);

    // 创建相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
    camera.position.set(0, 100, -300);
    camera.lookAt(0, 0, 0);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 添加统计信息
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    stats.domElement.style.right = '0px';
    document.getElementById('game-container').appendChild(stats.domElement);

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 0.5).normalize();
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 创建地形
    createTerrain();

    // 创建天空盒
    createSky();

    // 创建云层
    createClouds();

    // 加载飞机模型
    loadAirplane();

    // 事件监听
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 开始渲染循环
    animate();
}

// 创建地形
function createTerrain() {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geometry.rotateX(-Math.PI / 2);

    // 生成高度图
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        // 使用柏林噪声生成地形高度
        vertices[i + 1] = getTerrainHeight(x, z);
    }
    
    geometry.computeVertexNormals();

    // 创建材质
    const material = new THREE.MeshStandardMaterial({
        color: 0x228B22, // 森林绿色
        flatShading: false,
        side: THREE.DoubleSide
    });

    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // 添加水面
    const waterGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x1E90FF, // 道奇蓝
        transparent: true,
        opacity: 0.8
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.y = 0;
    scene.add(water);
}

// 简化的柏林噪声实现（实际应用中可使用更复杂的地形生成算法）
function getTerrainHeight(x, z) {
    const scale = 0.002;
    const xzValue = (Math.sin(x * scale) + Math.sin(z * scale)) * 50;
    const xz2Value = (Math.sin(x * scale * 2) + Math.sin(z * scale * 2)) * 25;
    const xz3Value = (Math.sin(x * scale * 4) + Math.sin(z * scale * 4)) * 12.5;
    
    let height = MIN_HEIGHT + (xzValue + xz2Value + xz3Value);
    
    // 控制最大和最小高度
    height = Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT);
    
    // 在世界边缘平滑过渡到水面
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const edgeFactor = 1 - Math.min(1, Math.max(0, (distanceFromCenter - WORLD_SIZE / 2.5) / (WORLD_SIZE / 10)));
    
    return height * edgeFactor;
}

// 创建天空盒
function createSky() {
    const skyGeometry = new THREE.SphereGeometry(WORLD_SIZE / 2, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87CEEB, // 天空蓝
        side: THREE.BackSide
    });
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
}

// 创建云层
function createClouds() {
    for (let i = 0; i < CLOUD_COUNT; i++) {
        const cloudGeometry = new THREE.SphereGeometry(Math.random() * 40 + 60, 8, 8);
        cloudGeometry.scale(Math.random() + 1, 0.3, Math.random() + 1);
        
        const cloudMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            flatShading: true,
            transparent: true,
            opacity: 0.8
        });
        
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        
        // 随机位置
        const angle = Math.random() * Math.PI * 2;
        const radius = (Math.random() * 0.5 + 0.3) * WORLD_SIZE / 2;
        cloud.position.x = Math.cos(angle) * radius;
        cloud.position.z = Math.sin(angle) * radius;
        cloud.position.y = Math.random() * 300 + 300;
        
        cloud.rotation.y = Math.random() * Math.PI;
        
        cloud.castShadow = true;
        cloud.receiveShadow = true;
        
        clouds.push(cloud);
        scene.add(cloud);
    }
}

// 加载飞机模型
function loadAirplane() {
    // 由于加载外部模型比较复杂，我们这里用简单几何体代替
    const group = new THREE.Group();
    
    // 飞机主体
    const bodyGeometry = new THREE.CylinderGeometry(5, 5, 40, 8);
    bodyGeometry.rotateZ(Math.PI / 2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xDCDCDC });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);
    
    // 机翼
    const wingGeometry = new THREE.BoxGeometry(7, 70, 2);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xA9A9A9 });
    const wing = new THREE.Mesh(wingGeometry, wingMaterial);
    wing.position.set(0, 0, 0);
    group.add(wing);
    
    // 尾翼 - 垂直
    const tailFinGeometry = new THREE.BoxGeometry(15, 2, 10);
    const tailFinMaterial = new THREE.MeshStandardMaterial({ color: 0xA9A9A9 });
    const tailFin = new THREE.Mesh(tailFinGeometry, tailFinMaterial);
    tailFin.position.set(-18, 0, 5);
    group.add(tailFin);
    
    // 尾翼 - 水平
    const tailWingGeometry = new THREE.BoxGeometry(10, 20, 1);
    const tailWingMaterial = new THREE.MeshStandardMaterial({ color: 0xA9A9A9 });
    const tailWing = new THREE.Mesh(tailWingGeometry, tailWingMaterial);
    tailWing.position.set(-18, 0, 0);
    group.add(tailWing);
    
    // 螺旋桨
    const propellerGeometry = new THREE.BoxGeometry(1, 20, 2);
    const propellerMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
    propeller.position.set(20, 0, 0);
    group.add(propeller);
    
    // 座舱
    const cockpitGeometry = new THREE.SphereGeometry(6, 8, 8);
    cockpitGeometry.scale(1, 0.8, 0.8);
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1E90FF,
        transparent: true,
        opacity: 0.7 
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(5, 0, 3);
    group.add(cockpit);
    
    // 设置阴影
    group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
    
    airplane = group;
    scene.add(airplane);
    
    // 设置初始位置
    airplane.position.copy(gameState.position);
    
    // 隐藏加载信息
    loadingElement.style.display = 'none';
    gameState.isLoaded = true;
}

// 窗口大小调整
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 处理键盘按下事件
function handleKeyDown(event) {
    switch(event.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyD': keys.d = true; break;
        case 'KeyQ': keys.q = true; break;
        case 'KeyE': keys.e = true; break;
        case 'KeyR': keys.r = true; break;
        case 'KeyF': keys.f = true; break;
        case 'Space': keys.space = true; break;
    }
}

// 处理键盘释放事件
function handleKeyUp(event) {
    switch(event.code) {
        case 'KeyW': keys.w = false; break;
        case 'KeyS': keys.s = false; break;
        case 'KeyA': keys.a = false; break;
        case 'KeyD': keys.d = false; break;
        case 'KeyQ': keys.q = false; break;
        case 'KeyE': keys.e = false; break;
        case 'KeyR': keys.r = false; break;
        case 'KeyF': keys.f = false; break;
        case 'Space': keys.space = false; break;
    }
}

// 更新飞机状态
function updateAirplane(deltaTime) {
    // 重置位置
    if (keys.space) {
        resetAirplanePosition();
        return;
    }

    // 速度控制
    if (keys.r) {
        gameState.speed += ACCELERATION * deltaTime;
        if (gameState.speed > MAX_SPEED) gameState.speed = MAX_SPEED;
    }
    if (keys.f) {
        gameState.speed -= ACCELERATION * deltaTime;
        if (gameState.speed < MIN_SPEED) gameState.speed = MIN_SPEED;
    }

    // 俯仰控制 (pitch)
    if (keys.w) {
        gameState.pitch -= PITCH_SPEED;
    }
    if (keys.s) {
        gameState.pitch += PITCH_SPEED;
    }
    
    // 限制俯仰角
    gameState.pitch = Math.max(Math.min(gameState.pitch, Math.PI / 4), -Math.PI / 4);
    
    // 翻滚控制 (roll)
    if (keys.a) {
        gameState.roll += ROLL_SPEED;
    }
    if (keys.d) {
        gameState.roll -= ROLL_SPEED;
    }
    
    // 偏航控制 (yaw)
    if (keys.q) {
        gameState.yaw += TURN_SPEED;
    }
    if (keys.e) {
        gameState.yaw -= TURN_SPEED;
    }
    
    // 计算速度向量
    const speedVector = new THREE.Vector3(0, 0, 1);
    speedVector.applyAxisAngle(new THREE.Vector3(1, 0, 0), gameState.pitch);
    speedVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), gameState.yaw);
    speedVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), gameState.roll);
    
    // 归一化速度向量并应用速度
    speedVector.normalize().multiplyScalar(gameState.speed * deltaTime);
    
    // 更新位置
    gameState.position.add(speedVector);
    
    // 限制飞行高度
    const terrainHeight = getTerrainHeight(gameState.position.x, gameState.position.z);
    const minimumAltitude = terrainHeight + 10; // 最低飞行高度为地形高度+10米
    
    if (gameState.position.y < minimumAltitude) {
        gameState.position.y = minimumAltitude;
        // 如果飞机撞地了，稍微调整俯仰角向上
        if (gameState.pitch > 0) {
            gameState.pitch = -0.1;
        }
    }
    
    // 防止飞出世界边界
    const maxDistance = WORLD_SIZE / 2.2;
    const distanceFromCenter = Math.sqrt(
        gameState.position.x * gameState.position.x + 
        gameState.position.z * gameState.position.z
    );
    
    if (distanceFromCenter > maxDistance) {
        const angle = Math.atan2(gameState.position.z, gameState.position.x);
        gameState.position.x = Math.cos(angle) * maxDistance;
        gameState.position.z = Math.sin(angle) * maxDistance;
    }
    
    // 更新飞机位置和旋转
    airplane.position.copy(gameState.position);
    
    // 设置飞机的旋转
    airplane.rotation.set(0, 0, 0); // 重置旋转
    airplane.rotateOnAxis(new THREE.Vector3(0, 1, 0), gameState.yaw);
    airplane.rotateOnAxis(new THREE.Vector3(1, 0, 0), gameState.pitch);
    airplane.rotateOnAxis(new THREE.Vector3(0, 0, 1), gameState.roll);
    
    // 更新相机位置
    updateCamera();
    
    // 计算高度和航向
    gameState.altitude = Math.floor(gameState.position.y);
    gameState.heading = (Math.atan2(-speedVector.x, -speedVector.z) * 180 / Math.PI + 360) % 360;
    
    // 更新HUD
    updateHUD();
}

// 重置飞机位置
function resetAirplanePosition() {
    gameState.position.set(0, 100, 0);
    gameState.speed = 100;
    gameState.pitch = 0;
    gameState.roll = 0;
    gameState.yaw = 0;
}

// 更新相机位置
function updateCamera() {
    // 计算相机偏移
    const cameraOffset = new THREE.Vector3(0, 20, -100);
    cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), gameState.pitch);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), gameState.yaw);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 0, 1), gameState.roll);
    
    // 设置相机位置为飞机位置加偏移
    camera.position.copy(gameState.position).add(cameraOffset);
    
    // 相机始终看向飞机前方
    const lookAtPoint = new THREE.Vector3(0, 0, 50);
    lookAtPoint.applyAxisAngle(new THREE.Vector3(1, 0, 0), gameState.pitch);
    lookAtPoint.applyAxisAngle(new THREE.Vector3(0, 1, 0), gameState.yaw);
    lookAtPoint.applyAxisAngle(new THREE.Vector3(0, 0, 1), gameState.roll);
    
    camera.lookAt(gameState.position.clone().add(lookAtPoint));
}

// 更新HUD
function updateHUD() {
    speedElement.textContent = Math.floor(gameState.speed);
    altitudeElement.textContent = Math.floor(gameState.altitude);
    headingElement.textContent = Math.floor(gameState.heading);
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    
    // 更新统计信息
    stats.update();
    
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    
    // 如果飞机已加载，更新飞机状态
    if (gameState.isLoaded) {
        updateAirplane(deltaTime);
        
        // 更新螺旋桨旋转
        if (airplane) {
            airplane.children[4].rotation.x += gameState.speed * 0.01;
        }
    }
    
    // 更新云朵位置（轻微移动）
    clouds.forEach(cloud => {
        cloud.position.x += Math.sin(Date.now() * 0.0001) * 0.1;
        cloud.position.z += Math.cos(Date.now() * 0.0001) * 0.1;
    });
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 启动飞行模拟器
init(); 