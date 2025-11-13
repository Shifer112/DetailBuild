import * as THREE from 'three';

/**
 * Класс для работы с углами (corners) детали
 */
export default class Corner {
  constructor(config, wasm) {
    this.config = config;
    this.wasm = wasm;
  }

  /**
   * Применяет обработку угла к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} corner - параметры угла
   * @param {Manifold} Manifold - класс Manifold
   * @returns {Manifold} - деталь с обработанным углом
   */
  applyCorner(detailMesh, corner, Manifold) {
    if (!corner.type) return detailMesh;

    const { l, h, w } = this.config;

    if (corner.type === 2) {
      // Прямоугольный срез угла
      if (!corner.x || !corner.y) return detailMesh;

      // Создаем треугольный профиль для среза
      let triangle;

      switch (corner.angle) {
        case 1: // Левый нижний
          triangle = [[0, 0], [corner.x, 0], [0, corner.y]];
          break;
        case 2: // Левый верхний
          triangle = [[0, 0], [0, -corner.y], [corner.x, 0]];
          break;
        case 3: // Правый верхний
          triangle = [[0, 0], [-corner.x, 0], [0, -corner.y]];
          break;
        case 4: // Правый нижний
          triangle = [[0, 0], [0, corner.y], [-corner.x, 0]];
          break;
        default:
          triangle = [[0, 0], [corner.x, 0], [0, corner.y]];
      }

      let profile = this.wasm.CrossSection.ofPolygons([triangle]);

      // Экструдируем на всю глубину детали
      const depth = w + 2;
      let cornerMesh = profile.extrude(depth, 0, 0, [1, 1], true);
      profile.delete();

      // Позиционируем в нужный угол детали
      const position = this.calculateCornerPosition(corner, l, h, w);

      cornerMesh = cornerMesh.translate(position.x, position.y, position.z);

      // Выполняем вычитание
      const result = detailMesh.subtract(cornerMesh);
      cornerMesh.delete();

      return result;
    }

    if (corner.type === 1) {
      // Радиусное скругление угла
      if (!corner.r) return detailMesh;

      // Создаем квадрант круга
      const square = [[0, 0], [corner.r, 0], [corner.r, corner.r], [0, corner.r]];
      let squareProfile = this.wasm.CrossSection.ofPolygons([square]);

      let circleX, circleY;
      switch (corner.angle) {
        case 1: // Левый нижний
          circleX = corner.r;
          circleY = corner.r;
          break;
        case 2: // Левый верхний
          circleX = corner.r;
          circleY = 0;
          break;
        case 3: // Правый верхний
          circleX = 0;
          circleY = 0;
          break;
        case 4: // Правый нижний
          circleX = 0;
          circleY = corner.r;
          break;
        default:
          circleX = corner.r;
          circleY = corner.r;
      }

      let circle = this.wasm.CrossSection.circle(corner.r, 32);
      circle = circle.translate(circleX, circleY);

      // Получаем четверть круга в углу
      let profile = squareProfile.subtract(circle);
      squareProfile.delete();
      circle.delete();

      // Экструдируем на всю глубину
      const depth = w + 2;
      let cornerMesh = profile.extrude(depth, 0, 0, [1, 1], true);
      profile.delete();

      // Позиционируем в нужный угол
      const position = this.calculateCornerPosition(corner, l, h, w);

      cornerMesh = cornerMesh.translate(position.x, position.y, position.z);

      // Выполняем вычитание
      const result = detailMesh.subtract(cornerMesh);
      cornerMesh.delete();

      return result;
    }

    if (corner.type === 3) {
      // Цилиндрическое скругление угла
      if (!corner.r) return detailMesh;

      // Создаем цилиндр вдоль всей глубины детали
      const radius = corner.r;
      const height = w + 2;
      let cornerMesh = Manifold.cylinder(height, radius, radius, 32, true);

      // Позиционируем цилиндр в угол детали
      const position = this.calculateCornerCylinderPosition(corner, l, h, w, radius);

      cornerMesh = cornerMesh.translate(position.x, position.y, position.z);

      // Вычитаем
      const result = detailMesh.subtract(cornerMesh);
      cornerMesh.delete();

      return result;
    }

    return detailMesh;
  }

  /**
   * Вычисляет позицию угла на детали
   * @param {Object} corner - параметры угла
   * @param {number} l - длина детали
   * @param {number} h - высота детали
   * @param {number} w - толщина детали
   * @returns {THREE.Vector3} - позиция
   */
  calculateCornerPosition(corner, l, h) {
    // Углы детали:
    // 1 - Левый нижний
    // 2 - Левый верхний
    // 3 - Правый верхний
    // 4 - Правый нижний

    let x, y, z;

    if (corner.type === 2) {
      // Для type=2 треугольник с вершиной в [0,0] просто ставим в угол
      switch (corner.angle) {
        case 1: // Левый нижний
          x = -l / 2;
          y = -h / 2;
          break;
        case 2: // Левый верхний
          x = -l / 2;
          y = h / 2;
          break;
        case 3: // Правый верхний
          x = l / 2;
          y = h / 2;
          break;
        case 4: // Правый нижний
          x = l / 2;
          y = -h / 2;
          break;
        default:
          x = 0;
          y = 0;
      }
    } else {
      // Для type=1 (круг) нужны смещения
      switch (corner.angle) {
        case 1: // Левый нижний
          x = -l / 2;
          y = -h / 2;
          break;
        case 2: // Левый верхний
          x = -l / 2;
          y = h / 2 - corner.r;
          break;
        case 3: // Правый верхний
          x = l / 2 - corner.r;
          y = h / 2 - corner.r;
          break;
        case 4: // Правый нижний
          x = l / 2 - corner.r;
          y = -h / 2;
          break;
        default:
          x = 0;
          y = 0;
      }
    }

    z = 0;

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Вычисляет позицию цилиндра в углу детали
   * @param {Object} corner - параметры угла
   * @param {number} l - длина детали
   * @param {number} h - высота детали
   * @returns {THREE.Vector3} - позиция
   */
  calculateCornerCylinderPosition(corner, l, h) {
    let x, y, z;
    const x_offset = corner.x_offset || 0;
    const y_offset = corner.y_offset || 0;

    switch (corner.angle) {
      case 1: // Левый нижний
        x = -l / 2 + x_offset;
        y = -h / 2 + y_offset;
        break;
      case 2: // Левый верхний
        x = -l / 2 + x_offset;
        y = h / 2 - y_offset;
        break;
      case 3: // Правый верхний
        x = l / 2 - x_offset;
        y = h / 2 - y_offset;
        break;
      case 4: // Правый нижний
        x = l / 2 - x_offset;
        y = -h / 2 + y_offset;
        break;
      default:
        x = 0;
        y = 0;
    }

    z = 0;

    return new THREE.Vector3(x, y, z);
  }
}
