import * as THREE from "three";
import { teacherPose } from "./pose";
import type { TeacherFrame, TeacherRenderer, Vec3 } from "./types";
export function mount(
  host: HTMLElement,
  { onFailure }: { onFailure: (message: string) => void },
): TeacherRenderer {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "3D visual teacher with two articulated hands. Illustrations accompany the captions.",
  );
  canvas.style.cssText = "display:block;width:100%;height:100%";
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) throw new Error("WebGL 2 is unavailable.");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 25);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x65798d, 2.5));
  const key = new THREE.DirectionalLight(0xffefdc, 3.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd6f3ff, 1.9);
  rim.position.set(3, 3, -2);
  scene.add(rim);
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  const geom = <T extends THREE.BufferGeometry>(g: T) => {
    geometry.add(g);
    return g;
  };
  const mat = (color: string, roughness = 0.8) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.01,
    });
    materials.add(m);
    return m;
  };
  const skin = mat("#ad724f"),
    skinLight = mat("#c28a62"),
    shirt = mat("#164f69"),
    cuff = mat("#103b50"),
    hair = mat("#292b2a"),
    white = mat("#fff9ee"),
    ink = mat("#172f3d"),
    lips = mat("#79483d"),
    accent = mat("#51b9b5");
  const sphere = geom(new THREE.SphereGeometry(1, 16, 12));
  const smallSphere = geom(new THREE.SphereGeometry(1, 8, 6));
  const cylinder = geom(new THREE.CylinderGeometry(1, 1, 1, 12));
  const root = new THREE.Group();
  scene.add(root);
  function ellipsoid(
    parent: THREE.Object3D,
    material: THREE.Material,
    pos: Vec3,
    size: Vec3,
  ) {
    const m = new THREE.Mesh(
      Math.max(...size) < 0.04 ? smallSphere : sphere,
      material,
    );
    m.position.set(...pos);
    m.scale.set(...size);
    parent.add(m);
    return m;
  }
  function segment(
    parent: THREE.Object3D,
    material: THREE.Material,
    radius: number,
  ) {
    const mesh = new THREE.Mesh(cylinder, material);
    parent.add(mesh);
    return { mesh, radius };
  }
  const av = new THREE.Vector3(),
    bv = new THREE.Vector3(),
    delta = new THREE.Vector3(),
    axis = new THREE.Vector3(0, 1, 0);
  function positionSegment(bone: ReturnType<typeof segment>, a: Vec3, b: Vec3) {
    av.set(...a);
    bv.set(...b);
    delta.copy(bv).sub(av);
    bone.mesh.position.copy(av.add(bv).multiplyScalar(0.5));
    bone.mesh.scale.set(bone.radius, delta.length(), bone.radius);
    bone.mesh.quaternion.setFromUnitVectors(axis, delta.normalize());
  }
  const torsoPoints = [
    new THREE.Vector2(0.3, 0.36),
    new THREE.Vector2(0.33, 0.55),
    new THREE.Vector2(0.36, 0.95),
    new THREE.Vector2(0.43, 1.35),
    new THREE.Vector2(0.42, 1.48),
    new THREE.Vector2(0.3, 1.6),
    new THREE.Vector2(0.12, 1.63),
  ];
  const torso = new THREE.Mesh(
    geom(new THREE.LatheGeometry(torsoPoints, 24)),
    shirt,
  );
  torso.scale.z = 0.58;
  root.add(torso);
  ellipsoid(root, cuff, [0, 0.37, 0], [0.3, 0.055, 0.18]);
  ellipsoid(root, skin, [0, 1.7, 0], [0.115, 0.16, 0.105]);
  const collar = new THREE.Mesh(
    geom(new THREE.TorusGeometry(0.135, 0.025, 6, 24)),
    cuff,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.62;
  root.add(collar);
  const badge = ellipsoid(
    root,
    accent,
    [-0.18, 1.35, 0.225],
    [0.032, 0.032, 0.009],
  );
  badge.rotation.z = 0.2;
  const head = new THREE.Group();
  head.position.y = 1.82;
  root.add(head);
  ellipsoid(head, hair, [0, 0.22, -0.025], [0.3, 0.37, 0.26]);
  ellipsoid(head, skinLight, [0, 0.2, 0.045], [0.278, 0.34, 0.252]);
  ellipsoid(head, skin, [-0.278, 0.21, 0.015], [0.045, 0.075, 0.032]);
  ellipsoid(head, skin, [0.278, 0.21, 0.015], [0.045, 0.075, 0.032]);
  // Sculpted hair clusters keep the silhouette readable without textures.
  for (let i = 0; i < 11; i++) {
    const angle = (Math.PI * i) / 10;
    ellipsoid(
      head,
      hair,
      [
        Math.cos(angle) * 0.235,
        0.42 + Math.sin(angle) * 0.09,
        0.1 + Math.sin(angle) * 0.06,
      ],
      [0.09, 0.085, 0.09],
    );
  }
  const eyes: THREE.Mesh[] = [],
    whiteEyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    whiteEyes.push(
      ellipsoid(
        head,
        white,
        [side * 0.105, 0.24, 0.265],
        [0.052, 0.035, 0.018],
      ),
    );
    const pupil = ellipsoid(
      head,
      ink,
      [side * 0.105, 0.24, 0.282],
      [0.022, 0.027, 0.009],
    );
    eyes.push(pupil);
    const brow = ellipsoid(
      head,
      hair,
      [side * 0.105, 0.31, 0.253],
      [0.06, 0.012, 0.02],
    );
    brow.rotation.z = side * -0.12;
  }
  ellipsoid(head, skin, [0, 0.16, 0.3], [0.043, 0.065, 0.053]);
  const smile = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.085, 0.065, 0.267),
    new THREE.Vector3(0, 0.018, 0.284),
    new THREE.Vector3(0.085, 0.065, 0.267),
  );
  head.add(
    new THREE.Mesh(
      geom(new THREE.TubeGeometry(smile, 12, 0.009, 6, false)),
      lips,
    ),
  );
  for (const side of [-1, 1])
    ellipsoid(root, shirt, [side * 0.37, 1.51, 0], [0.105, 0.1, 0.12]);
  const leftArm = {
    upper: segment(root, shirt, 0.08),
    lower: segment(root, skin, 0.057),
    elbow: ellipsoid(root, skin, [0, 0, 0], [0.062, 0.062, 0.062]),
  };
  const rightArm = {
    upper: segment(root, shirt, 0.08),
    lower: segment(root, skin, 0.057),
    elbow: ellipsoid(root, skin, [0, 0, 0], [0.062, 0.062, 0.062]),
  };
  const hands: { group: THREE.Group; joints: THREE.Group[][] }[] = [];
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.scale.set(side === -1 ? -1.12 : 1.12, 1.12, 1.12);
    root.add(group);
    ellipsoid(group, skinLight, [0, 0.095, 0], [0.086, 0.108, 0.032]);
    ellipsoid(group, skin, [0, 0.02, 0], [0.048, 0.04, 0.031]);
    const joints: THREE.Group[][] = [];
    for (let digit = 0; digit < 5; digit++) {
      const chain: THREE.Group[] = [];
      let parent: THREE.Object3D = group;
      const lengths =
        digit === 0
          ? [0.055, 0.045, 0.035]
          : digit === 1
            ? [0.061, 0.049, 0.037]
            : digit === 2
              ? [0.069, 0.055, 0.041]
              : digit === 3
                ? [0.064, 0.051, 0.038]
                : [0.05, 0.04, 0.03];
      for (let joint = 0; joint < 3; joint++) {
        const bone = new THREE.Group();
        parent.add(bone);
        if (joint === 0) {
          bone.position.set(
            digit === 0 ? -0.075 : -0.059 + (digit - 1) * 0.041,
            digit === 0 ? 0.075 : 0.17,
            0,
          );
          bone.rotation.z = digit === 0 ? 0.88 : (digit - 1 - 1.5) * -0.045;
        } else bone.position.y = lengths[joint - 1];
        const radius = digit === 0 ? 0.019 : 0.0145;
        const part = segment(bone, skinLight, radius);
        positionSegment(part, [0, 0, 0], [0, lengths[joint], 0]);
        ellipsoid(bone, skinLight, [0, 0, 0], [radius, radius, radius]);
        if (joint === 2)
          ellipsoid(
            bone,
            skinLight,
            [0, lengths[joint], 0],
            [radius, radius, radius],
          );
        chain.push(bone);
        parent = bone;
      }
      joints.push(chain);
    }
    hands.push({ group, joints });
  }
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x6e9da8,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });
  materials.add(discMat);
  const disc = new THREE.Mesh(
    geom(new THREE.CircleGeometry(0.65, 32)),
    discMat,
  );
  disc.rotation.x = -Math.PI / 2;
  disc.scale.y = 0.55;
  disc.position.y = 0.34;
  scene.add(disc);
  // Keep the rig hierarchy for articulation; batch matching surfaces for the GPU.
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
      return;
    const key = object.geometry.uuid + object.material.uuid;
    const group = groups.get(key) || [];
    group.push(object);
    groups.set(key, group);
  });
  const batches: { mesh: THREE.InstancedMesh; sources: THREE.Mesh[] }[] = [];
  for (const sources of groups.values()) {
    if (sources.length < 2) continue;
    const mesh = new THREE.InstancedMesh(
      sources[0].geometry,
      sources[0].material,
      sources.length,
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    for (const source of sources) source.visible = false;
    batches.push({ mesh, sources });
  }
  const instanceMatrix = new THREE.Matrix4();
  function updateInstances() {
    root.updateMatrixWorld(true);
    for (const batch of batches) {
      batch.sources.forEach((source, index) => {
        instanceMatrix.copy(source.matrixWorld);
        // Cylinders and ellipsoids are reflection symmetric. Remove the left
        // hand's negative X scale: InstancedMesh does not support negative scales.
        if (instanceMatrix.determinant() < 0)
          for (let i = 0; i < 4; i++) instanceMatrix.elements[i] *= -1;
        batch.mesh.setMatrixAt(index, instanceMatrix);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  let disposed = false,
    frames = 0,
    lastDraw = 0,
    lastFrame: TeacherFrame | undefined,
    lastKey = "",
    poorSince = 0,
    lastTick = 0;
  const compact =
    window.innerWidth < 768 || matchMedia("(pointer: coarse)").matches;
  let pixelRatio = Math.min(devicePixelRatio || 1, compact ? 1.25 : 1.5);
  const fps = compact ? 30 : 60;
  canvas.dataset.quality = compact ? "balanced" : "high";
  canvas.dataset.renderer = "3d";
  let width = 0,
    height = 0;
  function resize() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    lastKey = "";
    if (lastFrame) render(lastFrame, true);
  }
  function render(frame: TeacherFrame, force = false) {
    if (disposed) return;
    lastFrame = frame;
    if (!frame.visible) return;
    const now = performance.now();
    const identity = JSON.stringify(frame);
    if (!force && identity === lastKey) return;
    if (!force && frame.playing && now - lastDraw < 1000 / fps - 1) return;
    if (frame.playing && lastTick && now - lastTick > 42) {
      if (!poorSince) poorSince = now;
      if (now - poorSince > 2000 && pixelRatio > 0.75) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        canvas.dataset.quality = "low";
        poorSince = now;
      }
    } else poorSince = 0;
    lastTick = now;
    lastDraw = now;
    lastKey = identity;
    const pose = teacherPose(frame);
    [leftArm, rightArm].forEach((arm, i) => {
      const limb = i ? pose.right : pose.left;
      positionSegment(arm.upper, limb.shoulder, limb.elbow);
      positionSegment(arm.lower, limb.elbow, limb.wrist);
      arm.elbow.position.set(...limb.elbow);
      const hand = hands[i];
      hand.group.position.set(...limb.wrist);
      hand.group.rotation.set(...(i ? pose.rightRotation : pose.leftRotation));
      const curl = i ? pose.rightCurl : pose.leftCurl;
      hand.joints.forEach((chain, digit) =>
        chain.forEach((joint, j) => {
          joint.rotation.x = curl[digit] * (j === 0 ? 0.7 : 1);
          if (digit === 0) joint.rotation.z = j === 0 ? 0.88 : -0.12;
        }),
      );
    });
    head.rotation.set(pose.headPitch, pose.headYaw, 0);
    torso.position.y = pose.breath;
    const blink =
      frame.motion && Math.sin(frame.seconds * 0.85) > 0.997 ? 0.15 : 1;
    for (const eye of eyes) eye.scale.y = 0.027 * blink;
    for (const eye of whiteEyes) eye.scale.y = 0.035 * blink;
    const distance = frame.camera === "hands" ? 4.05 : 5.2;
    camera.position.set(
      0,
      frame.camera === "hands" ? 1.38 : 1.48,
      distance * Math.max(1, 1 / camera.aspect),
    );
    camera.lookAt(0, frame.camera === "hands" ? 1.28 : 1.38, 0.08);
    updateInstances();
    renderer.render(scene, camera);
    frames++;
    canvas.dataset.gesture = frame.gesture;
    canvas.dataset.seconds = frame.seconds.toFixed(3);
    canvas.dataset.phase = frame.phase.toFixed(3);
    canvas.dataset.leftHand = pose.left.wrist
      .map((x) => x.toFixed(3))
      .join(",");
    canvas.dataset.rightHand = pose.right.wrist
      .map((x) => x.toFixed(3))
      .join(",");
  }
  const lost = (event: Event) => {
    event.preventDefault();
    if (!disposed)
      onFailure(
        "3D graphics were interrupted. The 2D illustration remains available.",
      );
  };
  canvas.addEventListener("webglcontextlost", lost);
  host.append(canvas);
  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => resize())
      : undefined;
  observer?.observe(host);
  resize();
  return {
    update: (frame) => render(frame),
    resize,
    stats: () => ({
      frames,
      calls: renderer.info.render.calls,
      fpsTarget: fps,
      handsInFrame: hands.every((hand) => {
        const box = new THREE.Box3().setFromObject(hand.group);
        return [box.min.x, box.max.x].every((x) =>
          [box.min.y, box.max.y].every((y) =>
            [box.min.z, box.max.z].every((z) => {
              const p = new THREE.Vector3(x, y, z).project(camera);
              return (
                Math.abs(p.x) <= 0.98 &&
                Math.abs(p.y) <= 0.98 &&
                p.z >= -1 &&
                p.z <= 1
              );
            }),
          ),
        );
      }),
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      pixelRatio,
      quality: canvas.dataset.quality || "balanced",
      disposed,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      for (const batch of batches) batch.mesh.dispose();
      for (const g of geometry) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      lastFrame = undefined;
    },
  };
}
