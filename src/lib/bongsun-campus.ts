import type { Texture } from "three";
import { createBongsunBuilding, createBongsunSurroundings } from "./bongsun-building";
import { createBongsunRearDetails } from "./bongsun-rear";

type Three = typeof import("three");

function makeCampusTrees(THREE: Three) {
  const trees = [
    [-12.85, -3.8, 2.6], [12.8, -4.25, 2.7],
    [-13.35, -12.05, 2.65], [12.45, -12.9, 2.5],
  ];
  const wood = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 1, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x77664f, roughness: 1 }), trees.length);
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ roughness: 1 }), trees.length * 5);
  const pose = new THREE.Object3D();
  const colors = [0x54734a, 0x668451, 0x78905a, 0x607f4c, 0x6c8953];
  trees.forEach(([x, z, height], index) => {
    pose.position.set(x, height * 0.30, z);
    pose.scale.set(height * 0.053, height * 0.6, height * 0.053);
    pose.rotation.set(0, 0, 0);
    pose.updateMatrix();
    wood.setMatrixAt(index, pose.matrix);
    for (let branch = 0; branch < 5; branch++) {
      const angle = index + branch * 2.39;
      const radius = height * (0.27 - branch * 0.018);
      pose.position.set(x + Math.cos(angle) * height * 0.095, height * (0.56 + branch * 0.064),
        z + Math.sin(angle) * height * 0.095);
      pose.scale.set(radius * 1.15, radius * 1.11, radius);
      pose.rotation.y = angle;
      pose.updateMatrix();
      const id = index * 5 + branch;
      leaves.setMatrixAt(id, pose.matrix);
      leaves.setColorAt(id, new THREE.Color(colors[(index + branch) % colors.length]));
    }
  });
  wood.castShadow = leaves.castShadow = true;
  const group = new THREE.Group();
  group.add(wood, leaves);
  return group;
}

/** A single continuous campus in the editor's world coordinates. The +Z face is the main entrance. */
export function createBongsunCampus(THREE: Three, nameplate?: Texture) {
  const campus = new THREE.Group();
  const school = new THREE.Group();
  school.name = "봉선중학교 본관과 수업용 뒤뜰";
  school.scale.setScalar(0.37);
  school.position.z = -7.7;
  school.add(createBongsunBuilding(THREE, nameplate), createBongsunRearDetails(THREE));
  campus.add(school, makeCampusTrees(THREE));

  // Keep the neighborhood beyond both gardens and the end walls throughout a full camera orbit.
  const north = createBongsunSurroundings(THREE);
  north.scale.setScalar(0.44);
  north.position.set(-2, 0, -36);
  const south = north.clone();
  south.rotation.y = Math.PI;
  south.scale.setScalar(0.39);
  south.position.set(3, 0, 23);
  campus.add(north, south);
  return campus;
}
