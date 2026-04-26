import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import { ParticleEffect } from "./particle-effect.js";

const MOVE_SPEED       = 0.08;
const LOOK_SENSITIVITY = 0.003;
const LERP_FACTOR      = 0.07;
const DEG2RAD          = Math.PI / 180;
const RAD2DEG          = 180  / Math.PI;

const CAMERA_PRESETS = [
  { pos: new THREE.Vector3(1.791,  0.72, 1.903), rotY: 35.753 * DEG2RAD, rotX: -38.663 * DEG2RAD },
  { pos: new THREE.Vector3(0.753, -2.24, -0.233), rotY: 34.836 * DEG2RAD, rotX: -3.461 * DEG2RAD },
  { pos: new THREE.Vector3(0.138,  -2.756, -3.113), rotY: 15.944 * DEG2RAD, rotX: 2.199 * DEG2RAD },
];

const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const sceneRoot = document.getElementById("scene-root");
let sceneStarted = false;

function startScene() {
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  camera.rotation.order = "YXZ";
  camera.position.copy(CAMERA_PRESETS[0].pos);
  camera.rotation.y = CAMERA_PRESETS[0].rotY;
  camera.rotation.x = CAMERA_PRESETS[0].rotX;
  camera.rotation.z = 0;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const splat = new SplatMesh({ url: new URL("./assets/scene.ply", import.meta.url).href });
  splat.setRotationFromEuler(new THREE.Euler(0, Math.PI, Math.PI));
  scene.add(splat);

  const particleEffect = new ParticleEffect(splat);

  splat.initialized.then(() => {
    particleEffect.init();

    const el = document.getElementById("loading");
    if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 600); }
  });

  let isTransitioning = false;
  let transTarget = null;

  function goToPreset(index) {
    const p = CAMERA_PRESETS[index];
    transTarget = { pos: p.pos.clone(), rotY: p.rotY, rotX: p.rotX };
    isTransitioning = true;
    document.querySelectorAll(".angle-btn").forEach((b, i) =>
      b.classList.toggle("active", i === index));
  }

  function cancelTransition() {
    isTransitioning = false;
    document.querySelectorAll(".angle-btn").forEach(b => b.classList.remove("active"));
  }

  const keys = {};
  const MOVEMENT_KEYS = ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE"];

  function isInputEl(e) {
    const t = e.target.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
  }

  window.addEventListener("keydown", (e) => {
    if (isInputEl(e)) return;
    keys[e.code] = true;
    if (MOVEMENT_KEYS.includes(e.code)) cancelTransition();
  });
  window.addEventListener("keyup", (e) => {
    if (isInputEl(e)) return;
    keys[e.code] = false;
  });

  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  renderer.domElement.addEventListener("pointerdown", (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
    cancelTransition();
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    camera.rotation.y -= dx * LOOK_SENSITIVITY;
    camera.rotation.x = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, camera.rotation.x - dy * LOOK_SENSITIVITY)
    );
    camera.rotation.z = 0;
  });

  window.addEventListener("pointerup", () => { isDragging = false; });

  document.getElementById("btn-0").addEventListener("click", () => goToPreset(0));
  document.getElementById("btn-1").addEventListener("click", () => goToPreset(1));
  document.getElementById("btn-2").addEventListener("click", () => goToPreset(2));

  const _btnParticle = document.getElementById("btn-particle");
  _btnParticle.addEventListener("click", () => {
    particleEffect.toggle();
    _btnParticle.classList.toggle("active", particleEffect.isActive);
  });

  Object.entries(particleEffect.params).forEach(([paramName, uniform]) => {
    const el = document.getElementById(paramName);
    const valEl = document.getElementById(paramName + "_val");
    if (!el) return;
    if (el.type === "range") {
      el.addEventListener("input", () => {
        const v = parseFloat(el.value);
        uniform.value = v;
        if (valEl) valEl.textContent = v;
      });
    }
  });

  const _enableShockCb = document.getElementById("ENABLE_SHOCK");
  if (_enableShockCb) {
    _enableShockCb.addEventListener("change", () => {
      particleEffect.params.ENABLE_SHOCK.value = _enableShockCb.checked ? 1.0 : 0.0;
    });
  }

  function setupDraggableInput(el, speed = 0.1) {
    if (!el) return;
    let active = false;
    let dragged = false;
    let startX = 0;
    let startVal = 0;

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      active = true;
      dragged = false;
      startX = e.clientX;
      startVal = parseFloat(el.value) || 0;
      el.setPointerCapture(e.pointerId);
      el.blur();
      e.preventDefault();
    });

    el.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 2 || dragged) {
        dragged = true;
        document.body.classList.add("dragging-input");
        const spd = e.shiftKey ? speed * 0.1 : e.ctrlKey ? speed * 10 : speed;
        let v = startVal + dx * spd;
        if (el.min !== "" && !isNaN(+el.min)) v = Math.max(+el.min, v);
        if (el.max !== "" && !isNaN(+el.max)) v = Math.min(+el.max, v);
        el.value = parseFloat(v.toFixed(3));
        el.dispatchEvent(new Event("input"));
      }
    });

    el.addEventListener("pointerup", () => {
      document.body.classList.remove("dragging-input");
      if (!dragged) { el.focus(); el.select(); }
      active = dragged = false;
    });

    el.addEventListener("pointercancel", () => {
      document.body.classList.remove("dragging-input");
      active = dragged = false;
    });
  }

  [
    ["pos-x", 0.05], ["pos-y", 0.05], ["pos-z", 0.05],
    ["rot-x", 0.5], ["rot-y", 0.5], ["rot-z", 0.5],
    ["scale-s", 0.005],
    ["cam-x", 0.05], ["cam-y", 0.05], ["cam-z", 0.05],
    ["cam-yaw", 0.5], ["cam-pitch", 0.5],
  ].forEach(([id, spd]) => setupDraggableInput(document.getElementById(id), spd));

  function bindNumInput(id, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => {
      const v = parseFloat(el.value);
      if (!isNaN(v)) cb(v);
    });
  }

  bindNumInput("pos-x", v => { splat.position.x = v; });
  bindNumInput("pos-y", v => { splat.position.y = v; });
  bindNumInput("pos-z", v => { splat.position.z = v; });
  bindNumInput("rot-x", v => { splat.rotation.x = v * DEG2RAD; });
  bindNumInput("rot-y", v => { splat.rotation.y = v * DEG2RAD; });
  bindNumInput("rot-z", v => { splat.rotation.z = v * DEG2RAD; });
  bindNumInput("scale-s", v => { splat.scale.setScalar(Math.max(0.001, v)); });

  bindNumInput("cam-x", v => { camera.position.x = v; cancelTransition(); });
  bindNumInput("cam-y", v => { camera.position.y = v; cancelTransition(); });
  bindNumInput("cam-z", v => { camera.position.z = v; cancelTransition(); });
  bindNumInput("cam-yaw", v => { camera.rotation.y = v * DEG2RAD; camera.rotation.z = 0; cancelTransition(); });
  bindNumInput("cam-pitch", v => {
    camera.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, v * DEG2RAD));
    camera.rotation.z = 0;
    cancelTransition();
  });

  function setIfUnfocused(id, value) {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = value;
  }

  function fmt(v) { return parseFloat(v.toFixed(3)); }

  function syncUI() {
    setIfUnfocused("pos-x", fmt(splat.position.x));
    setIfUnfocused("pos-y", fmt(splat.position.y));
    setIfUnfocused("pos-z", fmt(splat.position.z));
    setIfUnfocused("rot-x", fmt(splat.rotation.x * RAD2DEG));
    setIfUnfocused("rot-y", fmt(splat.rotation.y * RAD2DEG));
    setIfUnfocused("rot-z", fmt(splat.rotation.z * RAD2DEG));
    setIfUnfocused("scale-s", fmt(splat.scale.x));

    setIfUnfocused("cam-x", fmt(camera.position.x));
    setIfUnfocused("cam-y", fmt(camera.position.y));
    setIfUnfocused("cam-z", fmt(camera.position.z));
    setIfUnfocused("cam-yaw", fmt(camera.rotation.y * RAD2DEG));
    setIfUnfocused("cam-pitch", fmt(camera.rotation.x * RAD2DEG));
  }

  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();

  renderer.setAnimationLoop((time) => {
    if (isTransitioning && transTarget) {
      camera.position.lerp(transTarget.pos, LERP_FACTOR);

      let dyaw = transTarget.rotY - camera.rotation.y;
      while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
      while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      camera.rotation.y += dyaw * LERP_FACTOR;

      camera.rotation.x += (transTarget.rotX - camera.rotation.x) * LERP_FACTOR;
      camera.rotation.z = 0;

      if (
        camera.position.distanceTo(transTarget.pos) < 0.005 &&
        Math.abs(transTarget.rotY - camera.rotation.y) < 0.002 &&
        Math.abs(transTarget.rotX - camera.rotation.x) < 0.002
      ) {
        camera.position.copy(transTarget.pos);
        camera.rotation.y = transTarget.rotY;
        camera.rotation.x = transTarget.rotX;
        camera.rotation.z = 0;
        isTransitioning = false;
      }
    }

    if (!isTransitioning) {
      const yaw = camera.rotation.y;
      _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      _right.set(Math.cos(yaw), 0, -Math.sin(yaw));

      if (keys["KeyW"]) camera.position.addScaledVector(_fwd, MOVE_SPEED);
      if (keys["KeyS"]) camera.position.addScaledVector(_fwd, -MOVE_SPEED);
      if (keys["KeyA"]) camera.position.addScaledVector(_right, -MOVE_SPEED);
      if (keys["KeyD"]) camera.position.addScaledVector(_right, MOVE_SPEED);
      if (keys["KeyE"]) camera.position.y += MOVE_SPEED;
      if (keys["KeyQ"]) camera.position.y -= MOVE_SPEED;
    }

    particleEffect.update(time / 1000);
    _btnParticle.classList.toggle("active", particleEffect.isActive);

    syncUI();
    renderer.render(scene, camera);
  });
}

if (startBtn) {
  startBtn.addEventListener("click", () => {
    if (sceneStarted) return;
    sceneStarted = true;
    if (startScreen) startScreen.classList.add("hidden");
    if (sceneRoot) sceneRoot.classList.remove("hidden");
    startScene();
  });
}
