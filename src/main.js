import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import DetailBuilder from './DetailBuilder';
import { GUI } from 'lil-gui';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x263238);

const canvas = document.getElementById('canvas3D');

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 40000);
camera.position.set(800, 600, 800);
camera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(500, 1000, 500);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.enableDamping = true;
controls.dampingFactor = 0.3;

const group1 = new THREE.MeshStandardMaterial({ color: 0x33A8FF, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });

const detailBuild = {
  "l": 1000, // Длина детали
  "h": 600, // Ширина детали
  "w": 18, // Глубина детали
  "materials3D": {
    "face": new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
    "rear": new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
    "left": new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
    "right": new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
    "top": new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
    "bottom": new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
  },
  "rects": [
    {
      "side": 1, // Передняя грань (1-6)
      "x": 200, // Смещение X
      "y": 500, // Смещение Y
      "width": 100, // Ширина выемки
      "height": 110, // Высота выемки
      "depth": 10, // Глубина выемки
      "x_axis": "0", // База привязки X ("0" или "w")
      "y_axis": "0", // База привязки Y ("0" или "h")
      "r": 5,
      "fullDepth": true, // На всю ли глубину детали
      "material": new THREE.MeshStandardMaterial({ color: 0xFF5733, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 1, // Передняя грань (1-6)
      "x": 500, // Смещение X
      "y": 500, // Смещение Y
      "width": 20, // Ширина выемки
      "height": 110, // Высота выемки
      "depth": 8, // Глубина выемки
      "x_axis": "0", // База привязки X ("0" или "w")
      "y_axis": "0", // База привязки Y ("0" или "h")
      "r": 8,
      "fullDepth": false, // На всю ли глубину детали
      "material": group1
    },
    {
      "side": 1, // Передняя грань (1-6)
      "x": 0, // Смещение X
      "y": 100, // Смещение Y
      "width": 1500, // Ширина выемки
      "height": 12, // Высота выемки
      "depth": 8, // Глубина выемки
      "x_axis": "0", // База привязки X ("0" или "w")
      "y_axis": "0", // База привязки Y ("0" или "h")
      "r": 0,
      "fullDepth": false, // На всю ли глубину детали
      "material": new THREE.MeshStandardMaterial({ color: 0x3357FF, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 3, // Передняя грань (1-6)
      "x": 5, // Смещение X
      "y": 200, // Смещение Y
      "width": 8, // Ширина выемки
      "height": 50, // Высота выемки
      "depth": 20, // Глубина выемки
      "x_axis": "0", // База привязки X ("0" или "w")
      "y_axis": "0", // База привязки Y ("0" или "h")
      "r": 0,
      "fullDepth": false,
      "material": new THREE.MeshStandardMaterial({ color: 0xFF33A8, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 3, // Передняя грань (1-6)
      "x": 5, // Смещение X
      "y": 400, // Смещение Y
      "width": 8, // Ширина выемки
      "height": 50, // Высота выемки
      "depth": 20, // Глубина выемки
      "x_axis": "0", // База привязки X ("0" или "w")
      "y_axis": "0", // База привязки Y ("0" или "h")
      "fullDepth": false,
      "material": new THREE.MeshStandardMaterial({ color: 0x33FFF6, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    }
  ],
  "holes": [ // отверстия
    {
      "side": 1, // Передняя грань
      "x": 35, // Смещение X
      "y": 500, // Смещение Y
      "depth": 15, // Глубина
      "diam": 25, // Диаметр
      "x_axis": "0", // База привязки X
      "y_axis": "0", // База привязки Y
      "material": new THREE.MeshStandardMaterial({ color: 0x66FF33, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 3, // Передняя грань
      "x": 9.5, // Смещение X
      "y": 500, // Смещение Y
      "depth": 30, // Глубина
      "diam": 8, // Диаметр
      "x_axis": "0", // База привязки X
      "y_axis": "0", // База привязки Y
      "material": new THREE.MeshStandardMaterial({ color: 0xFF8F33, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 1, // Передняя грань
      "x": 500, // Смещение X
      "y": 300, // Смещение Y
      "depth": 8, // Глубина
      "diam": 200, // Диаметр
      "x_axis": "0", // База привязки X
      "y_axis": "0", // База привязки Y
      "material": new THREE.MeshStandardMaterial({ color: 0xFF3366, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 1, // Передняя грань
      "x": 500, // Смещение X
      "y": 300, // Смещение Y
      "depth": 18, // Глубина
      "diam": 35, // Диаметр
      "x_axis": "0", // База привязки X
      "y_axis": "0", // База привязки Y
      "material": new THREE.MeshStandardMaterial({ color: 0x8F33FF, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "side": 1, // Передняя грань (1-6)
      "x": 510, // Смещение X
      "y": 550, // Смещение Y
      "depth": 8, // Глубина
      "diam": 50, // Диаметр
      "x_axis": "0", // База привязки X ("0" или "w")
      "y_axis": "0", // База привязки Y ("0" или "h")
      "material": group1
    }
  ],
  "smiles": [
    {
      "side": 6,        // Верхняя грань
      "offsetX": 0,     // Смещение по горизонтали (центр)
      "offsetY": 0,     // Не используется для side 3
      "standartValue": 400,     // Ширина smile
      "depth": 20,      // Глубина выемки
      "material": new THREE.MeshStandardMaterial({ color: 0x33FF33, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    }
  ],
  "corners": [
    {
      "angle": 4,        // Левый нижний угол
      "x": 60,          // Размер по X
      "y": 60,          // Размер по Y
      "type": 2,         // Тип: прямоугольный срез
      "radius1": 10,      // Радиус скругления первой стороны
      "radius2": 0,      // Радиус скругления второй стороны
      "material": new THREE.MeshStandardMaterial({ color: 0x3333FF, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    {
      "angle": 3,        // Правый верхний угол
      "type": 3,         // Тип: цилиндрическое скругление
      "r": 60,           // Радиус цилиндра
      "x_offset": 0,    // Смещение от угла по X (+ внутрь детали)
      "y_offset": 0,    // Смещение от угла по Y (+ внутрь детали)
      "material": new THREE.MeshStandardMaterial({ color: 0xFFCC33, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
  ],
  "arcs": [
    {
      "side": 4,        // Левая грань X-
      "inner": true,   // Наружная арка
      "offsetY": 50,     // Высота подъема арки
      "material": new THREE.MeshStandardMaterial({ color: 0x33FFCC, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    }
  ],
  "edges": { // кромки (торцы детали)
    "left": {
      "type": "srez",      // тип обработки кромки
      "degrees": 44.9,       // угол среза
      "material": new THREE.MeshStandardMaterial({ color: 0xCC33FF, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })
    },
    "top": 1, // без обработок - 1
    "right": 1,
    "bottom": 1
  },
  "material": {
    "w": 18,
    "article": "28856"
  }
};

// Параметры для GUI
const params = {
  showWireframe: true,
  detailLength: 1000,
  detailHeight: 600,
  detailWidth: 18,
};

let detail = null;
let wireframe = null;

// Построение детали
async function buildDetail() {
  if (detail) {
    scene.remove(detail);
    detail.geometry.dispose();
    if (Array.isArray(detail.material)) {
      detail.material.forEach(mat => mat.dispose());
    } else {
      detail.material.dispose();
    }
  }
  if (wireframe) {
    scene.remove(wireframe);
    wireframe.geometry.dispose();
    wireframe.material.dispose();
  }

  detailBuild.l = params.detailLength;
  detailBuild.h = params.detailHeight;
  detailBuild.w = params.detailWidth;

  const builder = new DetailBuilder(detailBuild);
  detail = await builder.build();

  scene.add(detail);

  if (params.showWireframe) {
    wireframe = meshToLine(detail);
    scene.add(wireframe);
  }
}

buildDetail();

console.log(detailBuild)

const axesHelper = new THREE.AxesHelper(500);
scene.add(axesHelper);

const gridHelper = new THREE.GridHelper(2000, 20);
gridHelper.position.y = -300;
scene.add(gridHelper);

const gui = new GUI();

const dimensionsFolder = gui.addFolder('Detail Dimensions');
dimensionsFolder.add(params, 'detailLength', 100, 2000, 10)
  .name('Length')
  .onFinishChange(async () => await buildDetail());
dimensionsFolder.add(params, 'detailHeight', 100, 1000, 10)
  .name('Height')
  .onFinishChange(async () => await buildDetail());
dimensionsFolder.add(params, 'detailWidth', 10, 50, 1)
  .name('Width')
  .onFinishChange(async () => await buildDetail());

const visualFolder = gui.addFolder('Visualization');
visualFolder.add(params, 'showWireframe')
  .name('Show Wireframe')
  .onChange(async () => await buildDetail());
visualFolder.open();

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);
}

animate();

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

function meshToLine(mesh, color = 'white', linewidth = 1, renderOrder = 0, isBed = false, isDashed = false) {
  const edgesGeometry = new THREE.EdgesGeometry(mesh.geometry, 15);
  let lineSegments;
  lineSegments = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ color: color, linewidth: linewidth, depthTest: true, side: 2}));
  lineSegments.userData.isWireframeMesh = true;
  lineSegments.position.copy(mesh.position);
  lineSegments.rotation.copy(mesh.rotation);
  lineSegments.scale.copy(mesh.scale);
  lineSegments.renderOrder = renderOrder;
  if (isDashed) {
    lineSegments.computeLineDistances();
  }

  return lineSegments;
}