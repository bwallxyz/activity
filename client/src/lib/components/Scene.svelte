<script lang="ts">
	// Svelte
	import { onMount } from "svelte";

	// Libs
	import * as THREE from "three";
	import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
	import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
	import { ConvexHull } from "three/examples/jsm/Addons.js";
	import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
	import RAPIER from "@dimforge/rapier3d-compat";
	import { me, onPlayerJoin } from "playroomkit";

	// Utils
	import { Player } from "$lib/models/Player";
	import { Ground } from "$lib/models/Ground";
	import { Guest } from "$lib/models/Guest";

	// Stores
	import { guests } from "$lib/stores/guests";
	import { onDestroy } from "svelte";

	// Variables
	let loader;
	let textureLoader;
	let gravity = { x: 0.0, y: -9.81, z: 0.0 };
	// If enabled, you can see yourself in the game as a static object
	const debug = false;
	let composer;
	let rootElement;
	let camera;
	let animationId;
	let world;
	let renderer;
	let labelRenderer;
	let scene;

	onMount(async () => {
		try {
			// Initialize loaders
			loader = new GLTFLoader();
			textureLoader = new THREE.TextureLoader();
			
			// Initialize physics
			await RAPIER.init();
			world = new RAPIER.World(gravity);
			
			// Initialize THREE.js scene
			scene = initThree();
			
			// Initialize guests
			initGuests(scene, world, new THREE.Vector3(0, 0.2, 0));
			
			console.log("Scene initialized successfully");
		} catch (error) {
			console.error("Error initializing scene:", error);
		}
	});
	
	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		
		if (renderer) {
			renderer.dispose();
		}
		
		if (scene) {
			disposeScene(scene);
		}
	});
	
	function disposeScene(scene) {
		scene.traverse((object) => {
			if (object.geometry) {
				object.geometry.dispose();
			}
			
			if (object.material) {
				if (Array.isArray(object.material)) {
					object.material.forEach(material => material.dispose());
				} else {
					object.material.dispose();
				}
			}
		});
	}

	function initThree() {
		if (!rootElement) {
			console.error("Root element not found");
			return null;
		}
		
		const renderWidth = rootElement.clientWidth || window.innerWidth;
		const renderHeight = rootElement.clientHeight || window.innerHeight;

		labelRenderer = new CSS2DRenderer();
		labelRenderer.setSize(renderWidth, renderHeight);
		labelRenderer.domElement.style.position = "absolute";
		labelRenderer.domElement.style.top = "0px";
		rootElement.appendChild(labelRenderer.domElement);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(renderWidth, renderHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		rootElement.appendChild(renderer.domElement);

		const newScene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera(65, renderWidth / renderHeight);

		// Initial setups
		const ground = new Ground(newScene, world, 20);
		const player = new Player(me(), newScene, world, ground.rigidBody.collider(0), camera, new THREE.Vector3(0, 2, 0));
		setupMap(newScene, world);
		setupLights(newScene);
		setupHDRI(newScene);

		// Events
		handleResize(renderer, labelRenderer, camera);
		rootElement.addEventListener("click", () => {
			rootElement.requestPointerLock();
		});

		// Animation loop with proper reference
		const animate = () => {
			animationId = requestAnimationFrame(animate);
			if (player) player.update();
			updateGuests();
			if (world) world.step();
			renderer.render(newScene, camera);
			labelRenderer.render(newScene, camera);
		};
		
		animate();

		return newScene;
	}

	function handleResize(renderer, labelRenderer, camera) {
		const resizeHandler = () => {
			if (!rootElement) return;
			
			const newWidth = rootElement.clientWidth || window.innerWidth;
			const newHeight = rootElement.clientHeight || window.innerHeight;
			
			if (camera) {
				camera.aspect = newWidth / newHeight;
				camera.updateProjectionMatrix();
			}
			
			if (renderer) {
				renderer.setSize(newWidth, newHeight);
			}
			
			if (labelRenderer) {
				labelRenderer.setSize(newWidth, newHeight);
			}
			
			if (composer) {
				composer.setSize(newWidth, newHeight);
			}
		};
		
		window.addEventListener("resize", resizeHandler);
		
		return () => {
			window.removeEventListener("resize", resizeHandler);
		};
	}

	function initGuests(scene, world, spawnPos) {
		onPlayerJoin((playerState) => {
			const myState = me();
			const guestState = playerState;
			
			if (!myState || !guestState) return;
			
			if (guestState.id !== myState.id || debug) {
				try {
					const guest = new Guest(guestState, scene, world, spawnPos, debug);
					$guests = [...$guests, guest];
				} catch (error) {
					console.error("Error creating guest:", error);
				}
			}
			
			playerState.onQuit(() => {
				const guest = $guests.find((g) => g.playerState.id === playerState.id);
				if (guest) {
					guest.despawn();
					$guests = $guests.filter((g) => g.playerState.id !== playerState.id);
				}
			});
		});
	}

	function setupMap(scene, world) {
		const excludedMeshes = ["wall-narrow-gate", "metal-gate001", "bridge-draw001"];
		loader.load(
			"scenes/map.glb",
			function (gltf) {
				const model = gltf.scene;
				model.traverse((node) => {
					if (node instanceof THREE.Mesh) {
						node.castShadow = true;
						node.receiveShadow = true;
						if (!excludedMeshes.includes(node.name)) setupCollider(world, node);
					}
				});
				scene.add(model);
			},
			undefined,
			function (error) {
				console.log("Error loading GLB:", error);
			}
		);
	}

	function setupCollider(world, node) {
		try {
			const convexHull = new ConvexHull().setFromObject(node);
			const vertices = convexHull.vertices;
			const buffer = new Float32Array(vertices.length * 3);
			
			for (let i = 0; i < vertices.length; i++) {
				buffer[i * 3] = vertices[i].point.x;
				buffer[i * 3 + 1] = vertices[i].point.y;
				buffer[i * 3 + 2] = vertices[i].point.z;
			}
			
			const meshColliderDesc = RAPIER.ColliderDesc.convexHull(buffer);
			world.createCollider(meshColliderDesc);
		} catch (error) {
			console.error("Error setting up collider:", error);
		}
	}

	function setupLights(scene) {
		const ambientLight = new THREE.AmbientLight("#E6F9EC", 1);
		scene.add(ambientLight);
		
		const directionalLight = new THREE.DirectionalLight(0xffffff, 4.2);
		directionalLight.castShadow = true;
		directionalLight.shadow.bias = -0.0001;
		directionalLight.shadow.mapSize.width = 4096;
		directionalLight.shadow.mapSize.height = 4096;
		directionalLight.shadow.camera.near = 0.5;
		directionalLight.shadow.camera.far = 500;
		directionalLight.shadow.camera.left = -50;
		directionalLight.shadow.camera.right = 50;
		directionalLight.shadow.camera.top = 50;
		directionalLight.shadow.camera.bottom = -50;
		directionalLight.rotation.z = Math.PI / 4;
		directionalLight.position.set(-20, 20, 0);
		scene.add(directionalLight);
	}

	function setupHDRI(scene) {
		try {
			const texture = textureLoader.load("textures/skybox.png");
			const geometry = new THREE.SphereGeometry(200, 32, 32);
			geometry.scale(-1, 1, 1);
			const material = new THREE.MeshBasicMaterial({ map: texture });
			const sphere = new THREE.Mesh(geometry, material);
			scene.add(sphere);
		} catch (error) {
			console.error("Error setting up HDRI:", error);
		}
	}

	function updateGuests() {
		for (const guest of $guests) {
			try {
				guest.update();
			} catch (error) {
				console.error("Error updating guest:", error);
			}
		}
	}
</script>

<!-- Main container -->
<div class="h-full w-full flex flex-col justify-center items-center" bind:this={rootElement}></div>