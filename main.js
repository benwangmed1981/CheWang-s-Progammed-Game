import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 添加在文件起始位置，import之后
console.log('加载3D飞行模拟器...');

// 错误处理函数
function handleErrors() {
  window.addEventListener('error', function(event) {
    console.error('捕获到错误:', event.message);
    document.body.innerHTML += `<div style="position:fixed; bottom:10px; right:10px; background:red; color:white; padding:10px; z-index:1000">
      错误: ${event.message}
    </div>`;
  });
}

// 调用错误处理函数
handleErrors();

// 场景设置
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // 淡蓝色背景

// 启用调试信息
console.log('初始化3D场景...');

// 修改相机设置
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 15000);
camera.position.set(0, 50, 100); // 调整相机初始位置
camera.lookAt(0, 0, 0);

// 渲染器设置
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  alpha: true, // 启用透明背景
  powerPreference: "high-performance" // 要求高性能
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

console.log('渲染器初始化完成');

// 天空设置
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 10;
skyUniforms['rayleigh'].value = 2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

// 太阳位置
const sun = new THREE.Vector3();
const phi = THREE.MathUtils.degToRad(90 - 45); // 调整太阳高度
const theta = THREE.MathUtils.degToRad(180);
sun.setFromSphericalCoords(1, phi, theta);
skyUniforms['sunPosition'].value.copy(sun);

// 添加光源
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8); // 降低光照强度
sunLight.position.set(sun.x * 100, sun.y * 100, sun.z * 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.3); // 降低环境光强度
scene.add(ambientLight);

// 创建地形
const terrainSize = 10000;
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, 100, 100);
// 修改地形材质，使用更显眼的颜色
const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a8f3c, // 更鲜艳的绿色
    side: THREE.DoubleSide,
    flatShading: true,
    metalness: 0.1,
    roughness: 0.8,
    emissive: 0x072c10, // 添加一些自发光
    emissiveIntensity: 0.2
});

// 随机地形高度 - 增加高度变化使其更明显
const vertices = terrainGeometry.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
    if (i % 3 === 1) { // 只修改y坐标
        vertices[i] = Math.random() * 400 - 100; // 增加高度变化范围
    }
}
terrainGeometry.computeVertexNormals();

const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

// 创建飞机
let airplane;
const airplaneGroup = new THREE.Group();
scene.add(airplaneGroup);

// 临时使用一个简单的飞机模型，后续可以替换为GLTF模型
const fuselageGeometry = new THREE.CylinderGeometry(1, 0.8, 8, 16);
const fuselageMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
fuselage.rotation.x = Math.PI / 2;
airplaneGroup.add(fuselage);

const wingGeometry = new THREE.BoxGeometry(12, 0.2, 2);
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
const wing = new THREE.Mesh(wingGeometry, wingMaterial);
wing.position.y = 0.3;
airplaneGroup.add(wing);

const tailGeometry = new THREE.BoxGeometry(3, 0.2, 1.5);
const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
const tail = new THREE.Mesh(tailGeometry, tailMaterial);
tail.position.z = -3.5;
tail.position.y = 1;
airplaneGroup.add(tail);

const verticalTailGeometry = new THREE.BoxGeometry(0.2, 2, 1.5);
const verticalTailMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
const verticalTail = new THREE.Mesh(verticalTailGeometry, verticalTailMaterial);
verticalTail.position.z = -3.5;
verticalTail.position.y = 1.5;
airplaneGroup.add(verticalTail);

// 飞行控制
const speed = {
    forward: 0,
    rotation: 0,
    ascent: 0,
    tilt: 0,
    maxSpeed: 2,
    acceleration: 0.01,
    deceleration: 0.005
};

// 初始位置高度
airplaneGroup.position.y = 200; // 降低初始高度

// 键盘控制
const keys = {};
document.addEventListener('keydown', (event) => {
    keys[event.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (event) => {
    keys[event.key.toLowerCase()] = false;
});

// 窗口调整大小
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 获取信息显示元素
const infoElement = document.getElementById('info');

// 动画循环
function animate() {
    try {
        requestAnimationFrame(animate);
        
        // 控制飞机
        if (keys['w'] || keys['arrowup']) {
            speed.forward += speed.acceleration;
        } else if (keys['s'] || keys['arrowdown']) {
            speed.forward -= speed.acceleration;
        } else {
            if (speed.forward > 0) {
                speed.forward -= speed.deceleration;
            } else if (speed.forward < 0) {
                speed.forward += speed.deceleration;
            }
            if (Math.abs(speed.forward) < speed.deceleration) {
                speed.forward = 0;
            }
        }
        
        // 限制速度
        speed.forward = Math.max(-speed.maxSpeed / 2, Math.min(speed.maxSpeed, speed.forward));
        
        // 空格键加速
        if (keys[' ']) {
            speed.forward = speed.maxSpeed;
        }
        
        // 左右转向
        if (keys['a']) {
            speed.rotation = 0.02;
            airplaneGroup.rotation.z = Math.min(airplaneGroup.rotation.z + 0.01, 0.3); // 倾斜效果
        } else if (keys['d']) {
            speed.rotation = -0.02;
            airplaneGroup.rotation.z = Math.max(airplaneGroup.rotation.z - 0.01, -0.3); // 倾斜效果
        } else {
            speed.rotation = 0;
            // 恢复倾斜
            if (airplaneGroup.rotation.z > 0.01) {
                airplaneGroup.rotation.z -= 0.01;
            } else if (airplaneGroup.rotation.z < -0.01) {
                airplaneGroup.rotation.z += 0.01;
            } else {
                airplaneGroup.rotation.z = 0;
            }
        }
        
        // 上升/下降
        if (keys['arrowup']) {
            speed.ascent = 0.5;
            airplaneGroup.rotation.x = Math.min(airplaneGroup.rotation.x + 0.01, 0.2);
        } else if (keys['arrowdown']) {
            speed.ascent = -0.5;
            airplaneGroup.rotation.x = Math.max(airplaneGroup.rotation.x - 0.01, -0.2);
        } else {
            speed.ascent = 0;
            // 恢复平衡
            if (airplaneGroup.rotation.x > 0.01) {
                airplaneGroup.rotation.x -= 0.01;
            } else if (airplaneGroup.rotation.x < -0.01) {
                airplaneGroup.rotation.x += 0.01;
            } else {
                airplaneGroup.rotation.x = 0;
            }
        }
        
        // Q/E 左倾/右倾
        if (keys['q']) {
            speed.tilt = 0.02;
        } else if (keys['e']) {
            speed.tilt = -0.02;
        } else {
            speed.tilt = 0;
        }
        
        // 应用旋转和移动
        airplaneGroup.rotation.y += speed.rotation;
        airplaneGroup.rotation.z += speed.tilt;
        
        // 前进方向
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(airplaneGroup.quaternion);
        
        // 移动飞机
        airplaneGroup.position.add(direction.multiplyScalar(speed.forward));
        airplaneGroup.position.y += speed.ascent;
        
        // 确保飞机不会低于地面
        if (airplaneGroup.position.y < 50) {
            airplaneGroup.position.y = 50;
        }
        
        // 更新信息显示
        infoElement.innerHTML = `3D飞行模拟器<br>
                               位置: x=${Math.round(airplaneGroup.position.x)}, 
                               y=${Math.round(airplaneGroup.position.y)}, 
                               z=${Math.round(airplaneGroup.position.z)}<br>
                               速度: ${speed.forward.toFixed(2)}`;
        
        // 更新相机位置 - 让相机跟随飞机
        const cameraOffset = new THREE.Vector3(0, 10, 40); // 相机偏移量：在飞机上方和后方
        cameraOffset.applyQuaternion(airplaneGroup.quaternion); // 应用飞机的旋转
        camera.position.copy(airplaneGroup.position).add(cameraOffset); // 设置相机位置
        
        // 计算飞机前方的目标点
        const lookAtOffset = new THREE.Vector3(0, 0, -50);
        lookAtOffset.applyQuaternion(airplaneGroup.quaternion);
        camera.lookAt(airplaneGroup.position.clone().add(lookAtOffset));
        
        renderer.render(scene, camera);
    } catch (error) {
        console.error('动画循环中发生错误:', error);
        document.body.innerHTML += `<div style="position:fixed; top:10px; left:10px; background:red; color:white; padding:10px; z-index:1000">
          动画错误: ${error.message}
        </div>`;
    }
}

// 添加一些帮助对象，让场景更容易理解
const axesHelper = new THREE.AxesHelper(50);
scene.add(axesHelper);

// 初始化函数
function init() {
  console.log('初始化3D飞行模拟器...');
  
  // 创建一个简单的地板网格，确保场景中有明显可见的内容
  const gridHelper = new THREE.GridHelper(2000, 20, 0xff0000, 0x444444);
  scene.add(gridHelper);
  
  // 添加一些简单的标记物以帮助定位
  // 添加一个中心点标记
  const centerGeometry = new THREE.SphereGeometry(50, 32, 32);
  const centerMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
  const centerSphere = new THREE.Mesh(centerGeometry, centerMaterial);
  centerSphere.position.set(0, 0, 0);
  scene.add(centerSphere);
  
  // 添加几个方向标记
  const directionMarkers = [
    {position: new THREE.Vector3(500, 0, 0), color: 0xff0000},
    {position: new THREE.Vector3(0, 500, 0), color: 0x00ff00},
    {position: new THREE.Vector3(0, 0, 500), color: 0x0000ff}
  ];
  
  directionMarkers.forEach(marker => {
    const markerGeometry = new THREE.SphereGeometry(30, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({color: marker.color});
    const markerSphere = new THREE.Mesh(markerGeometry, markerMaterial);
    markerSphere.position.copy(marker.position);
    scene.add(markerSphere);
  });
  
  // 初始化飞机位置
  airplaneGroup.position.set(0, 200, 0);
  
  console.log('初始化完成，场景已准备就绪');
}

// 在页面加载完成后调用初始化函数
window.addEventListener('load', init);

animate(); 