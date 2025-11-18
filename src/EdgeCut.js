import * as THREE from 'three';

/**
 * Класс для работы с обработкой кромок (edges) детали
 */
export default class EdgeCut {
  constructor(config, wasm, cutIDMap) {
    this.config = config;
    this.wasm = wasm;
    this.cutIDMap = cutIDMap;
  }

  /**
   * Применяет обработку кромок к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} edges - объект с параметрами кромок
   * @param {Object} materialIndexMap - объект с materialIndex для каждой кромки
   * @param {Object} materialMap - объект с THREE.Material для каждой кромки (опционально)
   * @returns {Manifold} - деталь с обработанными кромками
   */
  applyEdges(detailMesh, edges, materialIndexMap, materialMap = {}) {
    const edgeMap = {
      left: 2,    // Левый торец
      right: 4,   // Правый торец
      top: 3,     // Верхний торец
      bottom: 5   // Нижний торец
    };

    for (const [edgeName, side] of Object.entries(edgeMap)) {
      const edge = edges[edgeName];

      if (!edge || edge === 1 || typeof edge !== 'object') continue;
      if (edge.type !== 'srez' || !edge.degrees) continue;

      const materialIndex = materialIndexMap[edgeName];
      const material = materialMap[edgeName] || null;
      detailMesh = this.applyEdgeSrez(detailMesh, side, edge.degrees, edgeName, materialIndex, material);
    }

    return detailMesh;
  }

  /**
   * Применяет срез кромки (srez) к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {number} side - номер стороны (2-5)
   * @param {number} degrees - угол среза в градусах
   * @param {string} edgeName - имя кромки (left, right, top, bottom)
   * @param {number} materialIndex - индекс материала для этой кромки
   * @param {THREE.Material} material - материал для этой кромки (опционально)
   * @returns {Manifold} - деталь со срезом
   */
  applyEdgeSrez(detailMesh, side, degrees, edgeName, materialIndex, material = null) {
    const { l, h, w } = this.config;

    // Срез всегда идет от заднего торца к переднему
    // Глубина среза вглубь детали зависит от угла
    const degreesRad = degrees * (Math.PI / 180);
    const wedgeThickness = w; // Всегда от заднего к переднему торцу
    const wedgeDepth = w / Math.tan(Math.abs(degreesRad));

    // Определяем длину клина в зависимости от стороны
    let wedgeLength;
    switch (side) {
      case 2: // Левый торец (вдоль Y)
      case 4: // Правый торец (вдоль Y)
        wedgeLength = h + 20;
        break;
      case 3: // Верхний торец (вдоль X)
      case 5: // Нижний торец (вдоль X)
        wedgeLength = l + 20;
        break;
      default:
        return detailMesh;
    }

    // Создаем треугольный профиль для клина с катетами wedgeDepth и wedgeThickness
    const triangle = [
      [0, 0],
      [wedgeDepth, 0],
      [wedgeDepth, wedgeThickness]
    ];

    let profile = this.wasm.CrossSection.ofPolygons([triangle]);

    // Экструдируем клин вдоль соответствующей оси
    let wedgeMesh = profile.extrude(wedgeLength, 0, 0, [1, 1], true);
    profile.delete();

    // Позиционируем и ориентируем клин
    const position = this.calculateEdgeSrezPosition(side, l, h, w);
    const rotation = this.calculateEdgeSrezRotation(side, degrees);

    // Применяем трансформации
    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ');
    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(position);

    const mat4 = Array.from(matrix.elements);
    wedgeMesh = wedgeMesh.transform(mat4);

    wedgeMesh = wedgeMesh.asOriginal();
    const cutID = wedgeMesh.originalID();

    // Сохраняем информацию об обработке
    this.cutIDMap.push({
      id: cutID,
      type: 'edge',
      edgeName: edgeName,
      materialIndex: materialIndex,
      material: material
    });

    // Выполняем вычитание
    const result = detailMesh.subtract(wedgeMesh);
    wedgeMesh.delete();

    return result;
  }

  /**
   * Вычисляет позицию среза кромки
   * @param {number} side - номер стороны
   * @param {number} l - длина детали
   * @param {number} h - высота детали
   * @param {number} w - толщина детали
   * @returns {THREE.Vector3} - позиция
   */
  calculateEdgeSrezPosition(side, l, h, w) {
    let x, y, z;

    // Клин начинается от заднего торца (Z = -w/2) и идёт к переднему (Z = +w/2)
    // Позиционируем клин так, чтобы его задняя грань была на заднем торце детали
    switch (side) {
      case 2: // Левый торец
        x = -l / 2;
        y = 0;
        z = -w / 2; // Начинаем от заднего торца
        break;
      case 4: // Правый торец
        x = l / 2;
        y = 0;
        z = -w / 2; // Начинаем от заднего торца
        break;
      case 3: // Верхний торец
        x = 0;
        y = h / 2;
        z = -w / 2; // Начинаем от заднего торца
        break;
      case 5: // Нижний торец
        x = 0;
        y = -h / 2;
        z = -w / 2; // Начинаем от заднего торца
        break;
      default:
        x = y = z = 0;
    }

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Вычисляет поворот среза кромки
   * @param {number} side - номер стороны
   * @param {number} degrees - угол среза в градусах
   * @returns {Object} - углы поворота {x, y, z}
   */
  calculateEdgeSrezRotation(side, degrees) {
    const rotation = { x: 0, y: 0, z: 0 };

    switch (side) {
      case 2: // Левый торец
        rotation.z = -Math.PI / 2;
        rotation.x = degrees > 0 ? -Math.PI / 2 : Math.PI / 2;
        break;
      case 4: // Правый торец
        rotation.z = Math.PI / 2;
        rotation.x = degrees > 0 ? Math.PI / 2 : -Math.PI / 2;
        break;
      case 3: // Верхний торец
        rotation.y = degrees > 0 ? Math.PI / 2 : -Math.PI / 2;
        break;
      case 5: // Нижний торец
        rotation.y = degrees > 0 ? -Math.PI / 2 : Math.PI / 2;
        break;
    }

    return rotation;
  }
}
