import * as THREE from 'three';

const DEPTH_MARGIN = 2;

/**
 * Класс для работы с прямоугольными выемками (rects) в детали
 */
export default class Rect {
  constructor(config, cutIDMap) {
    this.config = config;
    this.cutIDMap = cutIDMap;
  }

  /**
   * Применяет прямоугольную выемку к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} rect - параметры выемки
   * @param {Manifold} Manifold - класс Manifold
   * @param {number} materialIndex - индекс материала для этой выемки
   * @param {THREE.Material} material - материал для этой выемки (опционально)
   * @returns {Manifold} - деталь с примененной выемкой
   */
  applyRect(detailMesh, rect, Manifold, materialIndex, material = null) {
    const width = rect.width;
    const height = rect.height;
    const depth = (rect.fullDepth ? this.config.w : rect.depth) + DEPTH_MARGIN;
    const side = rect.side;

    let rectMesh;
    let cubeDimensions;

    switch(side) {
      case 1: // Передняя грань Z+
      case 2: // Задняя грань Z-
        cubeDimensions = [width, height, depth];
        rectMesh = Manifold.cube(cubeDimensions, true);
        break;
      case 3: // Левая грань X-
      case 4: // Правая грань X+
        cubeDimensions = [depth, height, width];
        rectMesh = Manifold.cube(cubeDimensions, true);
        break;
      case 5: // Верхняя грань Y+
      case 6: // Нижняя грань Y-
        cubeDimensions = [width, depth, height];
        rectMesh = Manifold.cube(cubeDimensions, true);
        break;
      default:
        cubeDimensions = [width, height, depth];
        rectMesh = Manifold.cube(cubeDimensions, true);
    }

    const position = this.calculateRectPosition(rect);
    rectMesh = rectMesh.translate(position.x, position.y, position.z);

    rectMesh = rectMesh.asOriginal();
    const cutID = rectMesh.originalID();

    // Сохраняем информацию об обработке
    this.cutIDMap.push({
      id: cutID,
      type: 'rect',
      fullDepth: rect.fullDepth || false,
      materialIndex: materialIndex,
      material: material
    });

    const result = detailMesh.subtract(rectMesh);

    // Очищаем временный объект
    rectMesh.delete();

    return result;
  }

  /**
   * Вычисляет позицию прямоугольной выемки на грани
   * @param {Object} rect - параметры выемки
   * @returns {THREE.Vector3} - позиция
   */
  calculateRectPosition(rect) {
    const { l, h, w } = this.config;
    const { side, x, y, width, height, depth, x_axis, y_axis, fullDepth } = rect;

    let posX = 0, posY = 0, posZ = 0;
    const actualDepth = fullDepth ? w : depth;

    switch(side) {
      case 1: // Передняя грань Z+
        posX = x_axis === "0" ? -l/2 + x + width/2 : l/2 - x - width/2;
        posY = y_axis === "0" ? -h/2 + y + height/2 : h/2 - y - height/2;
        posZ = w/2 - actualDepth/2;
        break;
      case 2: // Задняя грань Z-
        posX = x_axis === "0" ? -l/2 + x + width/2 : l/2 - x - width/2;
        posY = y_axis === "0" ? -h/2 + y + height/2 : h/2 - y - height/2;
        posZ = -w/2 + actualDepth/2;
        break;
      case 3: // Левая грань X-
        posX = -l/2 + actualDepth/2;
        posY = y_axis === "0" ? -h/2 + y + height/2 : h/2 - y - height/2;
        posZ = x_axis === "0" ? -w/2 + x + width/2 : w/2 - x - width/2;
        break;
      case 4: // Правая грань X+
        posX = l/2 - actualDepth/2;
        posY = y_axis === "0" ? -h/2 + y + height/2 : h/2 - y - height/2;
        posZ = x_axis === "0" ? -w/2 + x + width/2 : w/2 - x - width/2;
        break;
      case 5: // Верхняя грань Y+
        posX = x_axis === "0" ? -l/2 + x + width/2 : l/2 - x - width/2;
        posY = h/2 - actualDepth/2;
        posZ = y_axis === "0" ? -w/2 + y + height/2 : w/2 - y - height/2;
        break;
      case 6: // Нижняя грань Y-
        posX = x_axis === "0" ? -l/2 + x + width/2 : l/2 - x - width/2;
        posY = -h/2 + actualDepth/2;
        posZ = y_axis === "0" ? -w/2 + y + height/2 : w/2 - y - height/2;
        break;
    }

    return new THREE.Vector3(posX, posY, posZ);
  }
}
