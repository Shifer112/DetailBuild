import * as THREE from 'three';

/**
 * Класс для работы с арками (arcs) на гранях детали
 */
export default class Arc {
  constructor(config, wasm, cutIDMap) {
    this.config = config;
    this.wasm = wasm;
    this.cutIDMap = cutIDMap;
  }

  /**
   * Создает Manifold объект арки
   * @param {Object} archParams - параметры арки
   * @returns {Manifold} - Manifold объект арки
   */
  createArchManifold(archParams) {
    let { width, height, depth, segments } = archParams;

    // Минимальные значения
    width = Math.max(width, 10);
    height = Math.max(height, 1);
    depth = Math.max(depth, 1);
    segments = Math.max(segments, 10);

    const halfWidth = width / 2;

    // Вычисляем центр и радиус круга
    const cy = (halfWidth * halfWidth - height * height) / (2 * height);
    const radius = Math.sqrt(halfWidth * halfWidth + cy * cy);

    // Создаем точки профиля арки
    const arcPoints = [];

    // Левая нижняя точка
    arcPoints.push([-halfWidth, 0]);

    // Дуга арки - генерируем точки по кругу
    const leftAngle = Math.atan2(0 - cy, -halfWidth);
    const rightAngle = Math.atan2(0 - cy, halfWidth);

    // Генерируем точки дуги от левой к правой
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const angle = leftAngle + (rightAngle - leftAngle) * t;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle) + cy;
      arcPoints.push([x, y]);
    }

    // Правая нижняя точка
    arcPoints.push([halfWidth, 0]);

    // Нижняя горизонтальная линия замыкает контур
    arcPoints.push([-halfWidth, 0]);

    // Создаем CrossSection из точек
    let crossSection = this.wasm.CrossSection.ofPolygons([arcPoints]);

    // Экструдируем профиль
    let manifold = crossSection.extrude(depth, 0, 0, [1, 1], true);
    crossSection.delete();

    return manifold;
  }

  /**
   * Применяет арку к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} arch - параметры арки
   * @param {number} materialIndex - индекс материала для этой арки
   * @param {THREE.Material} material - материал для этой арки (опционально)
   * @returns {Manifold} - деталь с примененной аркой
   */
  async applyArch(detailMesh, arch, materialIndex, material = null) {
    const { side, inner, offsetY } = arch;

    // Проверяем, что side в диапазоне 3-6
    if (side < 3 || side > 6) {
      return detailMesh;
    }

    const { l, h, w } = this.config;

    // Параметры арки
    let archWidth, archDepth;

    switch(side) {
      case 3: // Левая грань X-
      case 4: // Правая грань X+
        archWidth = h;
        archDepth = w;
        break;
      case 5: // Верхняя грань Y+
      case 6: // Нижняя грань Y-
        archWidth = l;
        archDepth = w;
        break;
    }

    // Количество сегментов зависит от offsetY
    // Для offsetY=10 -> 20 сегментов, для offsetY=50 -> 50, для offsetY=100+ -> 80
    const segments = Math.max(20, Math.min(80, Math.round(offsetY * 0.6 + 14)));

    const archParams = {
      width: archWidth,
      height: offsetY,
      depth: archDepth,
      segments: segments
    };

    let archManifold = this.createArchManifold(archParams);

    const position = this.calculateArchPosition(arch);
    const rotation = this.calculateArchRotation(arch);

    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ');

    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(position);

    const mat4 = Array.from(matrix.elements);
    archManifold = archManifold.transform(mat4);

    archManifold = archManifold.asOriginal();
    const cutID = archManifold.originalID();

    // Сохраняем информацию об обработке
    this.cutIDMap.push({
      id: cutID,
      type: 'arc',
      inner: inner,
      materialIndex: materialIndex,
      material: material
    });

    // Применяем union или subtract
    let result;
    if (inner) {
      // Внутренняя арка - вырезаем
      result = detailMesh.subtract(archManifold);
    } else {
      // Наружная арка - добавляем
      result = detailMesh.add(archManifold);
    }

    // Очищаем manifold объект
    archManifold.delete();

    return result;
  }

  /**
   * Вычисляет позицию арки на грани
   * @param {Object} arch - параметры арки
   * @returns {THREE.Vector3} - позиция
   */
  calculateArchPosition(arch) {
    const { l, h } = this.config;
    const { side } = arch;

    const positions = {
      3: { x: -l/2, y: 0, z: 0 },
      4: { x: l/2, y: 0, z: 0 },
      5: { x: 0, y: h/2, z: 0 },
      6: { x: 0, y: -h/2, z: 0 }
    };
    const pos = positions[side];

    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  /**
   * Вычисляет поворот арки для грани
   * @param {Object} arch - параметры арки
   * @returns {Object} - углы поворота {x, y, z}
   */
  calculateArchRotation(arch) {
    const { side, inner } = arch;
    const rotation = { x: 0, y: 0, z: 0 };

    switch(side) {
      case 3: // Левая грань X-
        if (inner) {
          rotation.z = Math.PI / 2;
        } else {
          rotation.z = -Math.PI / 2;
        }
        break;
      case 4: // Правая грань X+
        if (inner) {
          rotation.z = -Math.PI / 2;
        } else {
          rotation.z = Math.PI / 2;
        }
        break;
      case 5: // Верхняя грань Y+
        if (inner) {
          rotation.z = -Math.PI;
        } else {
          rotation.z = Math.PI;
        }
        break;
      case 6: // Нижняя грань Y-
        if (inner) {
          rotation.x = Math.PI * 2;
        } else {
          rotation.x = -Math.PI * 2;
        }
        break;
    }

    return rotation;
  }
}
