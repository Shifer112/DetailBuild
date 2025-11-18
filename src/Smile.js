import * as THREE from 'three';

const DEPTH_MARGIN = 2;

/**
 * Класс для работы с улыбками (smiles) на гранях детали
 */
export default class Smile {
  constructor(config, wasm, cutIDMap) {
    this.config = config;
    this.wasm = wasm;
    this.cutIDMap = cutIDMap;
  }

  /**
   * Применяет smile к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} smile - параметры smile
   * @param {number} materialIndex - индекс материала для этой smile
   * @param {THREE.Material} material - материал для этой smile (опционально)
   * @returns {Manifold} - деталь с примененной smile
   */
  applySmile(detailMesh, smile, materialIndex, material = null) {
    const { side, offsetX = 0, offsetY = 0, depth = 10 } = smile;
    const width = smile.standartValue || smile.width || 120;

    // Проверяем валидность side (только 3-6)
    if (side < 3 || side > 6) {
      return detailMesh;
    }

    const { w } = this.config;

    // Создаем профиль smile
    // Количество сегментов зависит от глубины дуги (depth)
    const N = Math.max(20, Math.min(70, Math.round(depth * 1.6 + 12)));
    const smilePoints = [];

    // Порог, после которого smile делится на дуги + прямой участок
    const MAX_SINGLE_ARC_WIDTH = 200;

    const arcWidth = Math.min(width / 2, MAX_SINGLE_ARC_WIDTH / 2);
    const flatWidth = Math.max(0, width - 2 * arcWidth);

    const leftStart = -width / 2;
    const leftEnd = leftStart + arcWidth;
    const rightStart = width / 2 - arcWidth;

    // Функция S-образного сглаживания
    function sShape(t) {
      return t * t * (3 - 2 * t);
    }

    // Левая S-дуга
    for (let i = 0; i <= N / 4; i++) {
      const t = i / (N / 4);
      const ease = sShape(t);
      const x = leftStart + arcWidth * t;
      const y = -depth * ease;
      smilePoints.push([x, y]);
    }

    // Плавный переход к прямой
    const transitionSteps = 8;
    for (let i = 1; i <= transitionSteps; i++) {
      const t = i / transitionSteps;
      const x = leftEnd + flatWidth * t;
      const y = -depth;
      smilePoints.push([x, y]);
    }

    // Правая S-дуга
    for (let i = 0; i <= N / 4; i++) {
      const t = i / (N / 4);
      const ease = sShape(1 - t);
      const x = rightStart + arcWidth * t;
      const y = -depth * ease;
      smilePoints.push([x, y]);
    }

    // Замыкаем сверху
    smilePoints.push([width / 2, 1]);
    smilePoints.push([-width / 2, 1]);

    // Создаем CrossSection
    let profile = this.wasm.CrossSection.ofPolygons([smilePoints]);

    // Экструдируем на толщину детали + запас
    const extrudeDepth = w + DEPTH_MARGIN;
    let smileManifold = profile.extrude(extrudeDepth, 0, 0, [1, 1], true);
    profile.delete();

    // Вычисляем позицию и поворот
    const position = this.calculateSmilePosition(smile, side, offsetX, offsetY);
    const rotation = this.calculateSmileRotation(side);

    // Применяем трансформацию
    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ');

    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(position);

    const mat4 = Array.from(matrix.elements);
    smileManifold = smileManifold.transform(mat4);

    smileManifold = smileManifold.asOriginal();
    const cutID = smileManifold.originalID();

    // Сохраняем информацию об обработке
    this.cutIDMap.push({
      id: cutID,
      type: 'smile',
      materialIndex: materialIndex,
      material: material
    });

    const result = detailMesh.subtract(smileManifold);

    smileManifold.delete();

    return result;
  }

  /**
   * Вычисляет позицию smile на грани
   * @param {Object} smile - параметры smile
   * @param {number} side - номер грани
   * @param {number} offsetX - смещение по X
   * @param {number} offsetY - смещение по Y
   * @returns {THREE.Vector3} - позиция
   */
  calculateSmilePosition(smile, side, offsetX, offsetY) {
    const { l, h } = this.config;

    let posX = 0, posY = 0, posZ = 0;

    switch(side) {
      case 3: // Левая грань X-
        posX = -l / 2;
        posY = offsetY;
        posZ = 0;
        break;
      case 4: // Правая грань X+
        posX = l / 2;
        posY = offsetY;
        posZ = 0;
        break;
      case 5: // Верхняя грань Y+
        posX = offsetX;
        posY = h / 2;
        posZ = 0;
        break;
      case 6: // Нижняя грань Y-
        posX = offsetX;
        posY = -h / 2;
        posZ = 0;
        break;
    }

    return new THREE.Vector3(posX, posY, posZ);
  }

  /**
   * Вычисляет поворот smile для грани
   * @param {number} side - номер грани
   * @returns {Object} - углы поворота {x, y, z}
   */
  calculateSmileRotation(side) {
    const rotation = { x: 0, y: 0, z: 0 };

    // Smile создается в XY плоскости:
    // - Ширина вдоль X
    // - Глубина вдоль Y (вогнутая часть)
    // - Экструзия вдоль Z+ (толщина детали)

    switch(side) {
      case 3: // Левая грань X- (YZ плоскость)
        // Нужно: smile в YZ плоскости, экструзия вдоль X
        rotation.z = Math.PI / 2;
        break;
      case 4: // Правая грань X+ (YZ плоскость)
        // Нужно: smile в YZ плоскости, экструзия вдоль X
        rotation.z = -Math.PI / 2;
        break;
      case 5: // Верхняя грань Y+ (XZ плоскость)
        // Нужно: smile в XZ плоскости, экструзия вдоль Y
        rotation.z = Math.PI * 2;
        break;
      case 6: // Нижняя грань Y- (XZ плоскость)
        // Нужно: smile в XZ плоскости, экструзия вдоль Y
        rotation.z = Math.PI;
        break;
    }

    return rotation;
  }
}
