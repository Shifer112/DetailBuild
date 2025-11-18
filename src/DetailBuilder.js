import * as THREE from 'three';
import Module from 'manifold-3d';
import Holes from './Holes.js';
import Rect from './Rect.js';
import Arc from './Arc.js';
import Smile from './Smile.js';
import Corner from './Corner.js';
import EdgeCut from './EdgeCut.js';

let manifoldModule = null;
let Manifold = null;

// Инициализация модуля Manifold (WASM)
async function initManifold() {
  if (!manifoldModule) {
    manifoldModule = await Module();
    manifoldModule.setup();
    Manifold = manifoldModule.Manifold;
  }
  return { wasm: manifoldModule, Manifold };
}

export default class DetailBuilder {
  constructor(detailConfig) {
    this.config = detailConfig;
  }

  async build() {
    const { wasm, Manifold } = await initManifold();

    this.wasm = wasm;
    this.Manifold = Manifold;

    // Массив для хранения информации о вырезах
    this.cutIDMap = [];

    let currentMaterialIndex = 6;

    // Экземпляры классов
    const smileBuilder = new Smile(this.config, wasm, this.cutIDMap);
    const arcBuilder = new Arc(this.config, wasm, this.cutIDMap);
    const holeBuilder = new Holes(this.config, this.cutIDMap);
    const rectBuilder = new Rect(this.config, wasm, this.cutIDMap);
    const cornerBuilder = new Corner(this.config, wasm, this.cutIDMap);
    const edgeCutBuilder = new EdgeCut(this.config, wasm, this.cutIDMap);

    // Основная деталь
    let detail = Manifold.cube([this.config.l, this.config.h, this.config.w], true);

    // Помечаем деталь и сохраняем её ID
    detail = detail.asOriginal();
    this.detailOriginalID = detail.originalID();

    // Применяем smiles
    if (this.config.smiles && this.config.smiles.length > 0) {
      for (const smile of this.config.smiles) {
        detail = smileBuilder.applySmile(detail, smile, currentMaterialIndex++, smile.material);
      }
    }

    // Применяем арки
    if (this.config.arcs && this.config.arcs.length > 0) {
      for (const arch of this.config.arcs) {
        detail = await arcBuilder.applyArch(detail, arch, currentMaterialIndex++, arch.material);
      }
    }

    // Применяем отверстия
    if (this.config.holes && this.config.holes.length > 0) {
      for (const hole of this.config.holes) {
        detail = holeBuilder.applyHole(detail, hole, Manifold, currentMaterialIndex++, hole.material);
      }
    }

    // Применяем выемки
    if (this.config.rects && this.config.rects.length > 0) {
      for (const rect of this.config.rects) {
        detail = rectBuilder.applyRect(detail, rect, Manifold, currentMaterialIndex++, rect.material);
      }
    }

    // Применяем срезы углов
    if (this.config.corners && this.config.corners.length > 0) {
      for (const corner of this.config.corners) {
        detail = cornerBuilder.applyCorner(detail, corner, Manifold, currentMaterialIndex++, corner.material);
      }
    }

    // Применяем срезы торцов
    if (this.config.edges) {
      // Создаем materialIndexMap для кромок
      const edgeMaterialIndexMap = {
        left: currentMaterialIndex++,
        right: currentMaterialIndex++,
        top: currentMaterialIndex++,
        bottom: currentMaterialIndex++
      };

      // Создаем materialMap с материалами из конфига
      const edgeMaterialMap = {
        left: this.config.edges.left?.material,
        right: this.config.edges.right?.material,
        top: this.config.edges.top?.material,
        bottom: this.config.edges.bottom?.material
      };

      detail = edgeCutBuilder.applyEdges(detail, this.config.edges, edgeMaterialIndexMap, edgeMaterialMap);
    }

    // Создаем геометрию с разными материалами для разных поверхностей
    const mesh = this.manifoldToMeshWithMaterials(detail);

    // Очищаем Manifold объект
    detail.delete();

    return mesh;
  }

  manifoldToMeshWithMaterials(manifoldMesh) {
    // Получаем данные геометрии из Manifold
    const mesh = manifoldMesh.getMesh();

    const geometry = new THREE.BufferGeometry();

    // Получаем позиции вершин
    if (mesh.numProp === 3) {
      geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertProperties, 3));
    } else {
      const numVert = mesh.vertProperties.length / mesh.numProp;
      const positions = new Float32Array(numVert * 3);
      for (let i = 0; i < numVert; i++) {
        positions[i * 3] = mesh.vertProperties[i * mesh.numProp];
        positions[i * 3 + 1] = mesh.vertProperties[i * mesh.numProp + 1];
        positions[i * 3 + 2] = mesh.vertProperties[i * mesh.numProp + 2];
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }

    geometry.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));

    // Создаем группы для разных материалов
    if (mesh.runOriginalID && mesh.runIndex) {
      this.createMaterials(geometry, mesh);
    }

    this.computeNormals(geometry, 30);

    let materials = [];

    if (this.config.materials3D) {
      materials = [
        this.config.materials3D.face,
        this.config.materials3D.rear,
        this.config.materials3D.left,
        this.config.materials3D.right,
        this.config.materials3D.top,
        this.config.materials3D.bottom
      ];

      // Используем индивидуальный материал
      for (const cutInfo of this.cutIDMap) {
        materials[cutInfo.materialIndex] = cutInfo.material;
      }
    }

    return new THREE.Mesh(geometry, materials);
  }

  createMaterials(geometry, mesh) {
    // Анализируем runOriginalID для определения группы материала
    const numTriangles = mesh.triVerts.length / 3;
    const runIndex = mesh.runIndex;
    const runOriginalID = mesh.runOriginalID;

    // Группируем треугольники по originalID
    const groups = new Map();

    let currentRun = 0;
    for (let triIdx = 0; triIdx < numTriangles; triIdx++) {
      // runIndex содержит индексы в triVerts
      const vertexIndex = triIdx * 3;
      while (currentRun < runIndex.length - 1 && vertexIndex >= runIndex[currentRun + 1]) {
        currentRun++;
      }

      const originalID = runOriginalID[currentRun];

      if (!groups.has(originalID)) {
        groups.set(originalID, []);
      }
      groups.get(originalID).push(triIdx);
    }

    // Поиск materialIndex по originalID
    const originalIDToMaterialIndex = new Map();
    for (const cutInfo of this.cutIDMap) {
      originalIDToMaterialIndex.set(cutInfo.id, cutInfo.materialIndex);
    }

    let maxMaterialIndex = 5;
    for (const cutInfo of this.cutIDMap) {
      if (cutInfo.materialIndex > maxMaterialIndex) {
        maxMaterialIndex = cutInfo.materialIndex;
      }
    }

    const trianglesByMaterial = Array.from({ length: maxMaterialIndex + 1 }, () => []);

    for (const [originalID, triangles] of groups) {
      // Треугольники от оригинальной детали определяем по нормали
      if (originalID === this.detailOriginalID) {
        for (const triIdx of triangles) {
          const i0 = mesh.triVerts[triIdx * 3];
          const i1 = mesh.triVerts[triIdx * 3 + 1];
          const i2 = mesh.triVerts[triIdx * 3 + 2];

          const v0x = mesh.vertProperties[i0 * 3];
          const v0y = mesh.vertProperties[i0 * 3 + 1];
          const v0z = mesh.vertProperties[i0 * 3 + 2];
          const v1x = mesh.vertProperties[i1 * 3];
          const v1y = mesh.vertProperties[i1 * 3 + 1];
          const v1z = mesh.vertProperties[i1 * 3 + 2];
          const v2x = mesh.vertProperties[i2 * 3];
          const v2y = mesh.vertProperties[i2 * 3 + 1];
          const v2z = mesh.vertProperties[i2 * 3 + 2];

          const e1x = v1x - v0x;
          const e1y = v1y - v0y;
          const e1z = v1z - v0z;
          const e2x = v2x - v0x;
          const e2y = v2y - v0y;
          const e2z = v2z - v0z;

          const nx = e1y * e2z - e1z * e2y;
          const ny = e1z * e2x - e1x * e2z;
          const nz = e1x * e2y - e1y * e2x;

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (len === 0) continue;

          const normX = nx / len;
          const normY = ny / len;
          const normZ = nz / len;

          // Определяем грань по нормали
          if (Math.abs(normZ - 1) < 0.1) {
            trianglesByMaterial[0].push(triIdx);
          } else if (Math.abs(normZ + 1) < 0.1) {
            trianglesByMaterial[1].push(triIdx);
          } else if (Math.abs(normX + 1) < 0.1) {
            trianglesByMaterial[2].push(triIdx);
          } else if (Math.abs(normX - 1) < 0.1) {
            trianglesByMaterial[3].push(triIdx);
          } else if (Math.abs(normY - 1) < 0.1) {
            trianglesByMaterial[4].push(triIdx);
          } else if (Math.abs(normY + 1) < 0.1) {
            trianglesByMaterial[5].push(triIdx);
          }
        }
      } else {
        const materialIndex = originalIDToMaterialIndex.get(originalID);
        if (materialIndex !== undefined) {
          trianglesByMaterial[materialIndex].push(...triangles);
        }
      }
    }

    // Порядок индексов в geometry.index чтобы они соответствовали группам
    const originalIndices = Array.from(mesh.triVerts);
    const newIndices = [];
    let currentOffset = 0;

    // Добавляем треугольники по материалам и создаем группы
    for (let materialIdx = 0; materialIdx < trianglesByMaterial.length; materialIdx++) {
      const triangles = trianglesByMaterial[materialIdx];
      if (triangles && triangles.length > 0) {
        // Добавляем группу для этого материала
        geometry.addGroup(currentOffset, triangles.length * 3, materialIdx);

        // Добавляем индексы треугольников
        for (const triIdx of triangles) {
          newIndices.push(
            originalIndices[triIdx * 3],
            originalIndices[triIdx * 3 + 1],
            originalIndices[triIdx * 3 + 2]
          );
        }

        currentOffset += triangles.length * 3;
      }
    }

    geometry.setIndex(newIndices);
  }

  computeNormals(geometry, thresholdAngleDegrees) {
    // Дублируем вершины на sharp edges
    // Это позволяет иметь разные нормали для одной и той же позиции
    const thresholdAngle = thresholdAngleDegrees * Math.PI / 180;
    const index = geometry.index.array;
    const position = geometry.attributes.position;
    const numTriangles = index.length / 3;

    // Временные векторы
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();

    // Вычисляем нормали для каждой грани
    const faceNormals = [];
    for (let i = 0; i < numTriangles; i++) {
      const a = index[i * 3];
      const b = index[i * 3 + 1];
      const c = index[i * 3 + 2];

      pA.fromBufferAttribute(position, a);
      pB.fromBufferAttribute(position, b);
      pC.fromBufferAttribute(position, c);

      cb.subVectors(pC, pB);
      ab.subVectors(pA, pB);
      const normal = cb.cross(ab).normalize();

      faceNormals.push(normal.clone());
    }

    // 2. Строим карту ребер: key = "minIdx_maxIdx", value = [faceIdx, ...]
    const edgeToFaces = new Map();
    for (let faceIdx = 0; faceIdx < numTriangles; faceIdx++) {
      const i0 = index[faceIdx * 3];
      const i1 = index[faceIdx * 3 + 1];
      const i2 = index[faceIdx * 3 + 2];

      // Три ребра треугольника
      const edges = [
        [i0, i1],
        [i1, i2],
        [i2, i0]
      ];

      for (const [v0, v1] of edges) {
        const key = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
        if (!edgeToFaces.has(key)) {
          edgeToFaces.set(key, []);
        }
        edgeToFaces.get(key).push(faceIdx);
      }
    }

    // 3. Определяем sharp edges (угол >= threshold)
    const sharpEdges = new Set();
    for (const [edgeKey, faces] of edgeToFaces) {
      if (faces.length === 2) {
        const angle = faceNormals[faces[0]].angleTo(faceNormals[faces[1]]);
        if (angle >= thresholdAngle) {
          sharpEdges.add(edgeKey);
        }
      } else if (faces.length === 1) {
        // Boundary edge - всегда sharp
        sharpEdges.add(edgeKey);
      }
    }

    // 4. Для каждой вершины в каждой грани вычисляем нормаль
    // Усредняем нормали соседних граней, но не пересекая sharp edges
    const newPositions = [];
    const newNormals = [];
    const newIndices = [];
    const vertexMap = new Map();

    for (let faceIdx = 0; faceIdx < numTriangles; faceIdx++) {
      const faceIndices = [
        index[faceIdx * 3],
        index[faceIdx * 3 + 1],
        index[faceIdx * 3 + 2]
      ];

      for (const oldIdx of faceIndices) {
        const mapKey = `${oldIdx}_${faceIdx}`;

        if (!vertexMap.has(mapKey)) {
          // Копируем позицию
          const pos = new THREE.Vector3().fromBufferAttribute(position, oldIdx);
          newPositions.push(pos.x, pos.y, pos.z);

          // Вычисляем нормаль: усредняем нормали граней, которые:
          // 1. Используют эту вершину
          // 2. Достижимы через non-sharp edges от текущей грани
          const connectedFaces = this.getConnectedFaces(
            faceIdx, oldIdx, index, numTriangles, sharpEdges
          );

          const avgNormal = new THREE.Vector3();
          for (const connFaceIdx of connectedFaces) {
            avgNormal.add(faceNormals[connFaceIdx]);
          }
          avgNormal.normalize();

          newNormals.push(avgNormal.x, avgNormal.y, avgNormal.z);

          const newIdx = newPositions.length / 3 - 1;
          vertexMap.set(mapKey, newIdx);
        }

        newIndices.push(vertexMap.get(mapKey));
      }
    }

    // 5. Обновляем геометрию
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(newNormals), 3));
    geometry.setIndex(newIndices);
  }

  getConnectedFaces(startFaceIdx, vertexIdx, index, numTriangles, sharpEdges) {
    // Найти все грани, достижимые от startFaceIdx через вершину vertexIdx
    const result = new Set([startFaceIdx]);
    const queue = [startFaceIdx];
    const visited = new Set([startFaceIdx]);

    // Строим список граней для данной вершины
    const vertexFaces = [];
    for (let i = 0; i < numTriangles; i++) {
      const i0 = index[i * 3];
      const i1 = index[i * 3 + 1];
      const i2 = index[i * 3 + 2];
      if (i0 === vertexIdx || i1 === vertexIdx || i2 === vertexIdx) {
        vertexFaces.push(i);
      }
    }

    while (queue.length > 0) {
      const currentFace = queue.shift();

      // Получаем ребра текущей грани, которые используют вершину
      const faceVerts = [
        index[currentFace * 3],
        index[currentFace * 3 + 1],
        index[currentFace * 3 + 2]
      ];

      const edges = [];
      for (let i = 0; i < 3; i++) {
        const v0 = faceVerts[i];
        const v1 = faceVerts[(i + 1) % 3];
        if (v0 === vertexIdx || v1 === vertexIdx) {
          edges.push([v0, v1]);
        }
      }

      // Проверяем соседние грани через эти ребра
      for (const [v0, v1] of edges) {
        const edgeKey = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;

        // Если ребро sharp - не переходим
        if (sharpEdges.has(edgeKey)) continue;

        // Находим соседнюю грань через это ребро
        for (const neighborFace of vertexFaces) {
          if (visited.has(neighborFace)) continue;

          const nVerts = [
            index[neighborFace * 3],
            index[neighborFace * 3 + 1],
            index[neighborFace * 3 + 2]
          ];

          // Проверяем, что соседняя грань использует это ребро
          const hasV0 = nVerts.includes(v0);
          const hasV1 = nVerts.includes(v1);

          if (hasV0 && hasV1) {
            visited.add(neighborFace);
            queue.push(neighborFace);
            result.add(neighborFace);
          }
        }
      }
    }

    return result;
  }

}
