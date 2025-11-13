import * as THREE from 'three';

/**
 * Класс для работы с отверстиями (holes) в детали
 */
export default class Holes {
  constructor(config, holeComplexity) {
    this.config = config;
    this.holeComplexity = holeComplexity;
  }

  /**
   * Применяет отверстие к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} hole - параметры отверстия
   * @param {Manifold} Manifold - класс Manifold
   * @returns {Manifold} - деталь с примененным отверстием
   */
  applyHole(detailMesh, hole, Manifold) {
    const radius = hole.diam / 2;
    const depth = hole.depth + 2;

    // lerp от 8 до 64 сегментов
    // Fix Me
    const cylinderSegments = Math.max(8, Math.round(THREE.MathUtils.lerp(6, 128, this.holeComplexity)));

    // Manifold.cylinder(height, radiusLow, radiusHigh, circularSegments, center)
    let holeMesh = Manifold.cylinder(depth, radius, radius, cylinderSegments, true);

    const position = this.calculateHolePosition(hole);
    const rotationRadians = this.calculateHoleRotation(hole.side);

    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(rotationRadians.x, rotationRadians.y, rotationRadians.z, 'XYZ');

    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(position);

    const mat4 = Array.from(matrix.elements);
    holeMesh = holeMesh.transform(mat4);

    const result = detailMesh.subtract(holeMesh);

    // Очищаем временный объект
    holeMesh.delete();

    return result;
  }

  /**
   * Вычисляет позицию отверстия на грани
   * @param {Object} hole - параметры отверстия
   * @returns {THREE.Vector3} - позиция
   */
  calculateHolePosition(hole) {
    const { l, h, w } = this.config;
    const { side, x, y, depth, x_axis, y_axis } = hole;

    const cylinderDepth = depth;
    let posX = 0, posY = 0, posZ = 0;

    switch(side) {
      case 1: // Передняя грань Z+
        posX = x_axis === "0" ? -l/2 + x : l/2 - x;
        posY = y_axis === "0" ? -h/2 + y : h/2 - y;
        posZ = w/2 - cylinderDepth/2;
        break;
      case 2: // Задняя грань Z-
        posX = x_axis === "0" ? -l/2 + x : l/2 - x;
        posY = y_axis === "0" ? -h/2 + y : h/2 - y;
        posZ = -w/2 + cylinderDepth/2;
        break;
      case 3: // Левая грань X-
        posX = -l/2 + cylinderDepth/2;
        posY = y_axis === "0" ? -h/2 + y : h/2 - y;
        posZ = x_axis === "0" ? -w/2 + x : w/2 - x;
        break;
      case 4: // Правая грань X+
        posX = l/2 - cylinderDepth/2;
        posY = y_axis === "0" ? -h/2 + y : h/2 - y;
        posZ = x_axis === "0" ? -w/2 + x : w/2 - x;
        break;
      case 5: // Верхняя грань Y+
        posX = x_axis === "0" ? -l/2 + x : l/2 - x;
        posY = h/2 - cylinderDepth/2;
        posZ = y_axis === "0" ? -w/2 + y : w/2 - y;
        break;
      case 6: // Нижняя грань Y-
        posX = x_axis === "0" ? -l/2 + x : l/2 - x;
        posY = -h/2 + cylinderDepth/2;
        posZ = y_axis === "0" ? -w/2 + y : w/2 - y;
        break;
    }

    return new THREE.Vector3(posX, posY, posZ);
  }

  /**
   * Вычисляет поворот отверстия для грани
   * @param {number} side - номер грани
   * @returns {Object} - углы поворота {x, y, z}
   */
  calculateHoleRotation(side) {
    // Manifold cylinder создается вдоль оси Z (не Y как в Three.js!)
    const rotation = { x: 0, y: 0, z: 0 };

    switch(side) {
      case 1: // Передняя грань Z+
        rotation.x = 0;
        rotation.y = 0;
        rotation.z = 0;
        break;
      case 2: // Задняя грань Z-
        rotation.y = Math.PI;
        break;
      case 3: // Левая грань X-
        rotation.y = -Math.PI / 2;
        break;
      case 4: // Правая грань X+
        rotation.y = Math.PI / 2;
        break;
      case 5: // Верхняя грань Y+
        rotation.x = -Math.PI / 2;
        break;
      case 6: // Нижняя грань Y-
        rotation.x = Math.PI / 2;
        break;
    }

    return rotation;
  }
}
