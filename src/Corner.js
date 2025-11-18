import * as THREE from 'three';

const DEPTH_MARGIN = 2;

/**
 * Класс для работы с углами (corners) детали
 */
export default class Corner {
  constructor(config, wasm, cutIDMap) {
    this.config = config;
    this.wasm = wasm;
    this.cutIDMap = cutIDMap;
  }

  /**
   * Аппроксимация кубической кривой Безье точками
   * @param {Array} p0 - начальная точка [x, y]
   * @param {Array} p1 - первая контрольная точка [x, y]
   * @param {Array} p2 - вторая контрольная точка [x, y]
   * @param {Array} p3 - конечная точка [x, y]
   * @param {number} steps - количество шагов
   * @returns {Array} - массив точек
   */
  bezierCurve(p0, p1, p2, p3, steps = 8) {
    const points = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const invT = 1 - t;
      const invT2 = invT * invT;
      const invT3 = invT2 * invT;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = invT3 * p0[0] + 3 * invT2 * t * p1[0] + 3 * invT * t2 * p2[0] + t3 * p3[0];
      const y = invT3 * p0[1] + 3 * invT2 * t * p1[1] + 3 * invT * t2 * p2[1] + t3 * p3[1];
      points.push([x, y]);
    }
    return points;
  }

  /**
   * Применяет обработку угла к детали
   * @param {Manifold} detailMesh - основная деталь
   * @param {Object} corner - параметры угла
   * @param {Manifold} Manifold - класс Manifold
   * @param {number} materialIndex - индекс материала для этого угла
   * @param {THREE.Material} material - материал для этого угла (опционально)
   * @returns {Manifold} - деталь с обработанным углом
   */
  applyCorner(detailMesh, corner, Manifold, materialIndex, material = null) {
    if (!corner.type) return detailMesh;

    const { l, h, w } = this.config;

    if (corner.type === 2) {
      // Прямоугольный срез угла
      if (!corner.x || !corner.y) return detailMesh;

      const radius1 = corner.radius1 || 0;
      const radius2 = corner.radius2 || 0;

      // Вычисляем параметры для скругления
      const cornerRotate = Math.atan(corner.x / corner.y);

      let radius1Delta = { offset: 0, deltaOffsetX: 0, deltaOffsetY: 0 };
      let radius2Delta = { offset: 0, deltaOffsetX: 0, deltaOffsetY: 0 };

      if (radius1 > 0) {
        radius1Delta.offset = Math.tan(Math.atan(corner.y / corner.x) / 2) * radius1;
        radius1Delta.deltaOffsetY = radius1Delta.offset * Math.cos(cornerRotate);
        radius1Delta.deltaOffsetX = radius1Delta.offset * Math.sin(cornerRotate);
      }

      if (radius2 > 0) {
        radius2Delta.offset = Math.tan(Math.atan(corner.x / corner.y) / 2) * radius2;
        radius2Delta.deltaOffsetY = radius2Delta.offset * Math.cos(cornerRotate);
        radius2Delta.deltaOffsetX = radius2Delta.offset * Math.sin(cornerRotate);
      }

      // Создаем профиль среза с учетом скруглений
      let profilePoints = [];

      switch (corner.angle) {
        case 1: // Левый нижний
          profilePoints.push([0, 0]);
          if (radius2 > 0) {
            const startPoint = [0, corner.y + radius2Delta.offset];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [0, corner.y],
              [radius2Delta.deltaOffsetX, corner.y - radius2Delta.deltaOffsetY]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([0, corner.y]);
          }

          if (radius1 > 0) {
            const startPoint = [corner.x - radius1Delta.deltaOffsetX, radius1Delta.deltaOffsetY];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [corner.x, 0],
              [corner.x + radius1Delta.offset, 0]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([corner.x, 0]);
          }
          break;

        case 2: // Левый верхний
          profilePoints.push([0, 0]);
          if (radius2 > 0) {
            const startPoint = [0, -corner.y - radius2Delta.offset];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [0, -corner.y],
              [radius2Delta.deltaOffsetX, -corner.y + radius2Delta.deltaOffsetY]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([0, -corner.y]);
          }

          if (radius1 > 0) {
            const startPoint = [corner.x - radius1Delta.deltaOffsetX, -radius1Delta.deltaOffsetY];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [corner.x, 0],
              [corner.x + radius1Delta.offset, 0]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([corner.x, 0]);
          }
          break;

        case 3: // Правый верхний
          profilePoints.push([0, 0]);
          if (radius2 > 0) {
            const startPoint = [0, -corner.y - radius2Delta.offset];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [0, -corner.y],
              [-radius2Delta.deltaOffsetX, -corner.y + radius2Delta.deltaOffsetY]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([0, -corner.y]);
          }

          if (radius1 > 0) {
            const startPoint = [-corner.x + radius1Delta.deltaOffsetX, -radius1Delta.deltaOffsetY];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [-corner.x, 0],
              [-corner.x - radius1Delta.offset, 0]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([-corner.x, 0]);
          }
          break;

        case 4: // Правый нижний
          profilePoints.push([0, 0]);
          if (radius2 > 0) {
            const startPoint = [0, corner.y + radius2Delta.offset];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [0, corner.y],
              [-radius2Delta.deltaOffsetX, corner.y - radius2Delta.deltaOffsetY]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([0, corner.y]);
          }

          if (radius1 > 0) {
            const startPoint = [-corner.x + radius1Delta.deltaOffsetX, radius1Delta.deltaOffsetY];
            profilePoints.push(startPoint);
            const curve = this.bezierCurve(
              startPoint,
              startPoint,
              [-corner.x, 0],
              [-corner.x - radius1Delta.offset, 0]
            );
            profilePoints.push(...curve);
          } else {
            profilePoints.push([-corner.x, 0]);
          }
          break;

        default:
          profilePoints = [[0, 0], [corner.x, 0], [0, corner.y]];
      }

      let profile = this.wasm.CrossSection.ofPolygons([profilePoints]);

      // Экструдируем на всю глубину детали
      const depth = w + DEPTH_MARGIN;
      let cornerMesh = profile.extrude(depth, 0, 0, [1, 1], true);
      profile.delete();

      // Позиционируем в нужный угол детали
      const position = this.calculateCornerPosition(corner, l, h);

      cornerMesh = cornerMesh.translate(position.x, position.y, position.z);

      cornerMesh = cornerMesh.asOriginal();
      const cutID = cornerMesh.originalID();

      // Сохраняем информацию об обработке
      this.cutIDMap.push({
        id: cutID,
        type: 'corner',
        cornerType: 2,
        materialIndex: materialIndex,
        material: material
      });

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
      const depth = w + DEPTH_MARGIN;
      let cornerMesh = profile.extrude(depth, 0, 0, [1, 1], true);
      profile.delete();

      // Позиционируем в нужный угол
      const position = this.calculateCornerPosition(corner, l, h);

      cornerMesh = cornerMesh.translate(position.x, position.y, position.z);

      cornerMesh = cornerMesh.asOriginal();
      const cutID = cornerMesh.originalID();

      // Сохраняем информацию об обработке
      this.cutIDMap.push({
        id: cutID,
        type: 'corner',
        cornerType: 1,
        materialIndex: materialIndex,
        material: material
      });

      // Выполняем вычитание
      const result = detailMesh.subtract(cornerMesh);
      cornerMesh.delete();

      return result;
    }

    // Цилиндрическое скругление угла
    if (corner.type === 3) {
      if (!corner.r) return detailMesh;

      const radius = corner.r;
      const height = w + DEPTH_MARGIN;
      const segments = Math.max(32, Math.min(64, Math.ceil(radius * 0.8)));
      let cornerMesh = Manifold.cylinder(height, radius, radius, segments, true);

      // Позиционируем цилиндр в угол детали
      const position = this.calculateCornerCylinderPosition(corner, l, h);

      cornerMesh = cornerMesh.translate(position.x, position.y, position.z);

      cornerMesh = cornerMesh.asOriginal();
      const cutID = cornerMesh.originalID();

      // Сохраняем информацию об обработке
      this.cutIDMap.push({
        id: cutID,
        type: 'corner',
        cornerType: 3,
        materialIndex: materialIndex,
        material: material
      });

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
