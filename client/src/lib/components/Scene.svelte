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
			// No guest initialization in Discord environment
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
		
		// Always use fake player state for Discord compatibility
		const playerState = fakePlayerState;
		
		const player = new Player(
			playerState, 
			scene, 
			world, 
			ground.rigidBody.collider(0), 
			camera, 
			new THREE.Vector3(0, 2, 0)
		);
		
		// Create a simple scene with built-in geometry instead of loading assets
		createSimpleScene(scene, world);
		setupLights(scene);

		// Events
		handleResize(renderer, labelRenderer, camera);
		rootElement.addEventListener("click", () => {
			rootElement.requestPointerLock();
		});

		renderer.setAnimationLoop(() => {
			player.update();
			world.step();
			renderer.render(scene, camera);
			labelRenderer.render(scene, camera);
		});

		return scene;
	}
	
	function createSimpleScene(scene, world) {
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
			
			// Add physics for the box
			try {
				const boxDesc = RAPIER.ColliderDesc.cuboid(1, 2, 1);
				boxDesc.setTranslation(box.position.x, box.position.y, box.position.z);
				world.createCollider(boxDesc);
			} catch (error) {
				console.error("Error creating physics for box:", error);
			}
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
</script>

<!-- Main container -->
<div class="h-full w-full flex flex-col justify-center items-center" bind:this={rootElement}></div>