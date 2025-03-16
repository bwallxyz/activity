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

	// Utils
	import { Player } from "$lib/models/Player";
	import { Ground } from "$lib/models/Ground";
	import { Guest } from "$lib/models/Guest";

	// Stores
	import { guests } from "$lib/stores/guests";

	// Variables
	const loader = new GLTFLoader();
	const textureLoader = new THREE.TextureLoader();
	const gravity = { x: 0.0, y: -9.81, z: 0.0 };
	// If enabled, you can see yourself in the game as a static object
	const debug = false;
	let composer;
	let rootElement;
	let camera;
	
	// Fake player state for testing in Discord
	const fakePlayerState = {
		id: "local-player",
		getState: (key) => ({}),
		setState: (key, value) => {}, 
		getProfile: () => ({ name: "LocalPlayer" }),
		getColor: () => "#FF0000",
		onQuit: (callback) => {}
	};

	onMount(async () => {
		try {
			const world = await initPhysics();
			const scene = initThree(world);
			// Skip guest initialization in Discord as it depends on PlayroomKit
			if (!window.location.href.includes("discord.com")) {
				initGuests(scene, world, new THREE.Vector3(0, 0.2, 0));
			}
		} catch (error) {
			console.error("Failed to initialize scene:", error);
		}
	});

	async function initPhysics() {
		await RAPIER.init();
		return new RAPIER.World(gravity);
	}

	function initThree(world) {
		const renderWidth = rootElement.clientWidth;
		const renderHeight = rootElement.clientHeight;

		const labelRenderer = new CSS2DRenderer();
		labelRenderer.setSize(renderWidth, renderHeight);
		labelRenderer.domElement.style.position = "absolute";
		labelRenderer.domElement.style.top = "0px";
		rootElement.appendChild(labelRenderer.domElement);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(renderWidth, renderHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		rootElement.appendChild(renderer.domElement);

		const scene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera(65, renderWidth / renderHeight);

		// Initial setups
		const ground = new Ground(scene, world, 20);
		
		// Use fake player state when in Discord to avoid PlayroomKit dependencies
		const playerState = window.location.href.includes("discord.com") ? 
			fakePlayerState : window.me();
		
		const player = new Player(
			playerState, 
			scene, 
			world, 
			ground.rigidBody.collider(0), 
			camera, 
			new THREE.Vector3(0, 2, 0)
		);
		
		// Skip loading remote assets in Discord due to CSP
		const isDiscord = window.location.href.includes("discord.com");
		if (!isDiscord) {
			setupMap(scene, world);
			setupHDRI(scene);
		} else {
			// Create a simple scene for Discord
			createSimpleScene(scene);
		}
		
		setupLights(scene);

		// Events
		handleResize(renderer, labelRenderer, camera);
		rootElement.addEventListener("click", () => {
			rootElement.requestPointerLock();
		});

		renderer.setAnimationLoop(() => {
			player.update();
			updateGuests();
			world.step();
			renderer.render(scene, camera);
			labelRenderer.render(scene, camera);
		});

		return scene;
	}
	
	function createSimpleScene(scene) {
		// Add simple geometry instead of loading GLB
		const floorGeometry = new THREE.PlaneGeometry(40, 40);
		const floorMaterial = new THREE.MeshStandardMaterial({ 
			color: 0x8ADBA2,
			side: THREE.DoubleSide 
		});
		const floor = new THREE.Mesh(floorGeometry, floorMaterial);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = 0;
		floor.receiveShadow = true;
		scene.add(floor);
		
		// Add some simple structures
		for (let i = 0; i < 5; i++) {
			const boxGeometry = new THREE.BoxGeometry(2, 4, 2);
			const boxMaterial = new THREE.MeshStandardMaterial({ 
				color: 0x888888 
			});
			const box = new THREE.Mesh(boxGeometry, boxMaterial);
			box.position.set(
				(Math.random() - 0.5) * 20,
				2,
				(Math.random() - 0.5) * 20
			);
			box.castShadow = true;
			box.receiveShadow = true;
			scene.add(box);
		}
		
		// Create simple sky
		const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
		skyGeometry.scale(-1, 1, 1);
		const skyMaterial = new THREE.MeshBasicMaterial({
			color: 0x87CEEB
		});
		const sky = new THREE.Mesh(skyGeometry, skyMaterial);
		scene.add(sky);
	}

	function handleResize(renderer, labelRenderer, camera) {
		window.addEventListener("resize", () => {
			const newWidth = rootElement.clientWidth;
			const newHeight = rootElement.clientHeight;
			camera.aspect = newWidth / newHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(newWidth, newHeight);
			labelRenderer.setSize(newWidth, newHeight);
			if (composer) composer.setSize(newWidth, newHeight);
		});
	}

	function initGuests(scene, world, spawnPos) {
		window.onPlayerJoin((playerState) => {
			const myState = window.me();
			if (!myState) return;
			
			const guestState = playerState;
			if (guestState.id !== myState.id || debug) {
				try {
					const guest = new Guest(guestState, scene, world, spawnPos, debug);
					$guests = [...$guests, guest];
				} catch (error) {
					console.error("Error adding guest:", error);
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