import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import type { RemotePlayer } from "../hooks/useWebSocket";

interface SplatViewerProps {
  splatUrl: string | null;
  remotePlayers: Map<string, RemotePlayer>;
  onMove?: (
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ) => void;
}

// Simple first-person controls
class FirstPersonControls {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  moveSpeed = 2.0;
  lookSpeed = 0.002;
  velocity = new THREE.Vector3();
  euler = new THREE.Euler(0, 0, 0, "YXZ");
  keys = new Set<string>();
  isLocked = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.euler.setFromQuaternion(camera.quaternion);

    this.domElement.addEventListener("click", () => {
      this.domElement.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isLocked) return;
      this.euler.y -= e.movementX * this.lookSpeed;
      this.euler.x -= e.movementY * this.lookSpeed;
      this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });

    document.addEventListener("keydown", (e) => this.keys.add(e.code));
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  update(delta: number) {
    this.velocity.set(0, 0, 0);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) this.velocity.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) this.velocity.sub(forward);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) this.velocity.sub(right);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) this.velocity.add(right);
    if (this.keys.has("Space")) this.velocity.y += 1;
    if (this.keys.has("ShiftLeft")) this.velocity.y -= 1;

    if (this.velocity.lengthSq() > 0) {
      this.velocity.normalize().multiplyScalar(this.moveSpeed * delta);
      this.camera.position.add(this.velocity);
    }
  }

  dispose() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }
}

export function SplatViewer({ splatUrl, remotePlayers, onMove }: SplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<FirstPersonControls | null>(null);
  const splatMeshRef = useRef<SplatMesh | null>(null);
  const playerMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const animFrameRef = useRef<number>(0);
  const lastMoveRef = useRef(0);

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0.5, 2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 10, 5);
    scene.add(directional);

    // Ground grid for reference
    const grid = new THREE.GridHelper(20, 20, 0x333366, 0x222244);
    grid.position.y = -0.5;
    scene.add(grid);

    const controls = new FirstPersonControls(camera, renderer.domElement);
    controlsRef.current = controls;

    const clock = new THREE.Clock();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      controls.update(delta);

      // Broadcast position at ~15Hz
      const now = performance.now();
      if (now - lastMoveRef.current > 66) {
        lastMoveRef.current = now;
        onMoveRef.current?.(
          { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z }
        );
      }

      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load/update splat
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !splatUrl) return;

    // Remove old splat
    if (splatMeshRef.current) {
      scene.remove(splatMeshRef.current);
      splatMeshRef.current.dispose();
      splatMeshRef.current = null;
    }

    const splat = new SplatMesh({ url: splatUrl });
    splatMeshRef.current = splat;
    scene.add(splat);

    return () => {
      if (splatMeshRef.current === splat) {
        scene.remove(splat);
        splat.dispose();
        splatMeshRef.current = null;
      }
    };
  }, [splatUrl]);

  // Update remote player avatars
  const updatePlayerMeshes = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const meshes = playerMeshesRef.current;

    // Remove players who left
    for (const [id, group] of meshes) {
      if (!remotePlayers.has(id)) {
        scene.remove(group);
        meshes.delete(id);
      }
    }

    // Add/update players
    for (const [id, player] of remotePlayers) {
      let group = meshes.get(id);
      if (!group) {
        group = createPlayerAvatar(player.color, player.name);
        meshes.set(id, group);
        scene.add(group);
      }

      // Smoothly interpolate position
      const target = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      group.position.lerp(target, 0.2);
      group.rotation.y = player.rotation.y;
    }
  }, [remotePlayers]);

  useEffect(() => {
    updatePlayerMeshes();
  }, [updatePlayerMeshes]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }}
    >
      {!splatUrl && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "#888",
            fontSize: "18px",
            pointerEvents: "none",
          }}
        >
          Waiting for a world to be generated...
        </div>
      )}
    </div>
  );
}

function createPlayerAvatar(color: string, name: string): THREE.Group {
  const group = new THREE.Group();

  // Body - a simple capsule-like shape
  const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.3, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 0.35;
  group.add(head);

  // Direction indicator (cone pointing forward)
  const coneGeo = new THREE.ConeGeometry(0.06, 0.15, 8);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0, 0.35, -0.18);
  group.add(cone);

  // Nametag using sprite
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.roundRect(0, 0, 256, 64, 12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, 128, 42);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 0.65;
  sprite.scale.set(0.8, 0.2, 1);
  group.add(sprite);

  // Glow ring at feet
  const ringGeo = new THREE.RingGeometry(0.18, 0.22, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.2;
  group.add(ring);

  return group;
}
