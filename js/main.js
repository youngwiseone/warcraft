/*
 * main.js
 *
 * This script initializes a simple 3D warrior model using Three.js on the login
 * screen and handles navigation to the blog page. The warrior is built from
 * primitive shapes (boxes, spheres and cylinders) and slowly rotates to
 * provide a dynamic visual element reminiscent of the character select screen
 * in World of Warcraft.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Grab the canvas and create the renderer
  const canvas = document.getElementById('warriorCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  // Create scene and camera
  const scene = new THREE.Scene();
  scene.background = null; // transparent, so underlying panel shows
  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 1.2, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(3, 5, 2);
  scene.add(directionalLight);

  // Build a simplistic warrior model using groups of primitives
  const warrior = new THREE.Group();

  // Materials
  const armorMaterial = new THREE.MeshPhongMaterial({ color: 0x8b5a2b });
  const skinMaterial = new THREE.MeshPhongMaterial({ color: 0xd2b48c });
  const metalMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });

  // Torso
  const torsoGeom = new THREE.BoxGeometry(1, 1.6, 0.6);
  const torso = new THREE.Mesh(torsoGeom, armorMaterial);
  torso.position.set(0, 1.2, 0);
  warrior.add(torso);

  // Head
  const headGeom = new THREE.SphereGeometry(0.4, 16, 16);
  const head = new THREE.Mesh(headGeom, skinMaterial);
  head.position.set(0, 2.3, 0);
  warrior.add(head);

  // Helmet (simple cylinder)
  const helmGeom = new THREE.CylinderGeometry(0.45, 0.5, 0.5, 16);
  const helm = new THREE.Mesh(helmGeom, metalMaterial);
  helm.position.set(0, 2.55, 0);
  warrior.add(helm);

  // Arms
  const armGeom = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 12);
  // Left arm
  const leftArm = new THREE.Mesh(armGeom, armorMaterial);
  leftArm.position.set(-0.8, 1.1, 0);
  leftArm.rotation.z = Math.PI / 2;
  warrior.add(leftArm);
  // Right arm
  const rightArm = leftArm.clone();
  rightArm.position.set(0.8, 1.1, 0);
  warrior.add(rightArm);

  // Legs
  const legGeom = new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12);
  const leftLeg = new THREE.Mesh(legGeom, armorMaterial);
  leftLeg.position.set(-0.3, 0.3, 0);
  warrior.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.set(0.3, 0.3, 0);
  warrior.add(rightLeg);

  // Sword
  const swordGeom = new THREE.BoxGeometry(0.1, 1.8, 0.1);
  const sword = new THREE.Mesh(swordGeom, metalMaterial);
  sword.position.set(1.4, 1.2, 0);
  // Create a small cross-guard for the sword
  const guardGeom = new THREE.BoxGeometry(0.5, 0.05, 0.3);
  const guard = new THREE.Mesh(guardGeom, metalMaterial);
  guard.position.set(1.4, 0.3, 0);
  warrior.add(sword);
  warrior.add(guard);

  scene.add(warrior);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    warrior.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  animate();

  // Adjust on resize
  window.addEventListener('resize', () => {
    const { clientWidth, clientHeight } = canvas;
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  });

  // Navigation to blog page
  const enterButton = document.getElementById('enter-button');
  if (enterButton) {
    enterButton.addEventListener('click', () => {
      window.location.href = 'blog.html';
    });
  }
});