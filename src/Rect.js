import * as THREE from 'three';

const DEPTH_MARGIN = 2;

/**
 * Класс для работы с прямоугольными выемками (rects) в детали
 */
export default class Rect {
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
   * Создает профиль прямоугольника со скругленными углами
   * @param {number} width - ширина
   * @param {number} height - высота
   * @param {number} radius - радиус скругления углов
   * @returns {CrossSection} - профиль
   */
  createRoundedRectProfile(width, height, radius) {
    const halfW = width / 2;
    const halfH = height / 2;

    // Ограничиваем радиус
    const maxRadius = Math.min(halfW, halfH);
    const r = Math.min(radius, maxRadius);

    // Количество сегментов
    const segments = Math.max(16, Math.min(32, Math.ceil(r * 0.5)));

    const points = [];

    // Начинаем с нижней левой точки после радиуса и идем против часовой стрелки
    points.push([-halfW + r, -halfH]);

    // Нижняя сторона до правого нижнего угла
    points.push([halfW - r, -halfH]);

    // Правый нижний угол - скругление
    const rbStart = [halfW - r, -halfH];
    const curve1 = this.bezierCurve(
      rbStart,
      rbStart,
      [halfW, -halfH],
      [halfW, -halfH + r],
      segments
    );
    points.push(...curve1);

    // Правая сторона до правого верхнего угла
    points.push([halfW, halfH - r]);

    // Правый верхний угол - скругление
    const rtStart = [halfW, halfH - r];
    const curve2 = this.bezierCurve(
      rtStart,
      rtStart,
      [halfW, halfH],
      [halfW - r, halfH],
      segments
    );
    points.push(...curve2);

    // Верхняя сторона до левого верхнего угла
    points.push([-halfW + r, halfH]);

    // Левый верхний угол - скругление
    const ltStart = [-halfW + r, halfH];
    const curve3 = this.bezierCurve(
      ltStart,
      ltStart,
      [-halfW, halfH],
      [-halfW, halfH - r],
      segments
    );
    points.push(...curve3);

    // Левая сторона до левого нижнего угла
    points.push([-halfW, -halfH + r]);

    // Левый нижний угол - скругление
    const lbStart = [-halfW, -halfH + r];
    const curve4 = this.bezierCurve(
      lbStart,
      lbStart,
      [-halfW, -halfH],
      [-halfW + r, -halfH],
      segments
    );
    points.push(...curve4);

    return this.wasm.CrossSection.ofPolygons([points]);
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
    const radius = rect.r || 0;

    let rectMesh;

    // Если есть радиус скругления, создаем через экструзию профиля
    if (radius > 0) {
      let profileWidth, profileHeight, extrudeDepth;

      switch(side) {
        case 1: // Передняя грань Z+
        case 2: // Задняя грань Z-
          profileWidth = width;
          profileHeight = height;
          extrudeDepth = depth;
          break;
        case 3: // Левая грань X-
        case 4: // Правая грань X+
          profileWidth = width;
          profileHeight = height;
          extrudeDepth = depth;
          break;
        case 5: // Верхняя грань Y+
        case 6: // Нижняя грань Y-
          profileWidth = width;
          profileHeight = height;
          extrudeDepth = depth;
          break;
        default:
          profileWidth = width;
          profileHeight = height;
          extrudeDepth = depth;
      }

      // Создаем профиль прямоугольника со скругленными углами
      const profile = this.createRoundedRectProfile(profileWidth, profileHeight, radius);

      rectMesh = profile.extrude(extrudeDepth, 0, 0, [1, 1], true);
      profile.delete();

      // Для сторон 3-6 нужно повернуть экструзию
      switch(side) {
        case 3: // Левая грань X-
        case 4: // Правая грань X+
          rectMesh = rectMesh.rotate([0, 1, 0], 90);
          break;
        case 5: // Верхняя грань Y+
        case 6: // Нижняя грань Y-
          rectMesh = rectMesh.rotate([1, 0, 0], 90);
          break;
      }
    } else {
      // Без радиуса
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
