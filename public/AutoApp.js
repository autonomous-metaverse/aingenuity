// @ts-check
import './make-three-global.js'
import { Meteor } from 'meteor/meteor'
import { Motor, defineElements } from 'lume'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { loadNonModuleScript } from './utils/loadNonModuleScript.js'
//   import * as HOST from "../src/three.js/index.js";

// Load the global "HOST" API from the build file copied over from the build
// output of the Amazon Sumerian three.js demo.
await loadNonModuleScript('/host.three.js')

defineElements()

/**
 * Whether to use Lume's scene for rendering. When true, the Sumerian Three.js
 * scene is appended to the Lume Three.js scene, otherwise the Lume scene is
 * appended to the Sumerian scene.
 */
const renderWithLume = true

/**
 * Whether to use Lume's camera while rendering with the Sumerian vanilla Three.js scene.
 * If rendering with Lume, this is ignored, and Lume's camera is always used.
 */
const useLumeCamera = true

/**
 * When true, CSS transforms are output to Lume elements using Lume's CSS
 * rendering, which is useful for hovering on elements in devtools element
 * inspector and seeing where they are on screen. This has some additional
 * performance overhead.
 */
const cssTransformsForDebug = false

/** Height of the player camera from the ground. */
const playerHeight = 1.6

const renderFn = []
const speakers = new Map([
	['Luke', undefined],
	['Alien', undefined],
])

export let controlSpeech = null

class AutoApp extends HTMLElement {
	constructor() {
		super()
		this.attachShadow({ mode: 'open' })
	}

	async connectedCallback() {
		this.makeDOM()

		// Increment rotation by a small number of degrees every frame.
		const box = this.shadowRoot?.querySelector('lume-box')
		box.rotation = (x, y, z) => [x, y + 0.2, z]

		// Move the sphere around in a circle based on time.
		const sphere = this.shadowRoot?.querySelector('lume-sphere')
		sphere.position = (x, y, z, t) => [0.1 * Math.sin(t * 0.005), y, 0.1 * Math.cos(t * 0.005)]

		// Wait for Meteor auth and API to be ready.
		await new Promise(r => Meteor.startup(r))

		/////////////////////////////////////////////////////////////////////

		// FIXME: This key is *public* (visible on the client side) for now,
		// but we want to keep it on the server side so malicious users
		// don't steal it and make their own apps with it while we pay for
		// it. Once we switch it to the server, we want to delete the
		// current key and make a new one.
		const cognitoIdentityPoolId = Meteor.settings.public.AWS_SUMERIAN_KEY

		// Parse the region out of the cognito Id
		const region = cognitoIdentityPoolId.split(':')[0]

		// Initialize AWS and create Polly service objects
		window.AWS.config.region = region
		window.AWS.config.credentials = new AWS.CognitoIdentityCredentials({ IdentityPoolId: cognitoIdentityPoolId })
		const polly = new AWS.Polly()
		const presigner = new AWS.Polly.Presigner()
		const speechInit = HOST.aws.TextToSpeechFeature.initializeService(polly, presigner, window.AWS.VERSION)

		// Define the glTF assets that will represent the host
		const characterFile1 = '/assets/glTF/characters/adult_male/preston/preston.gltf'
		const characterFile2 = '/assets/glTF/characters/alien/alien.gltf'
		const animationPath1 = '/assets/glTF/animations/adult_male'
		const animationPath2 = '/assets/glTF/animations/alien'
		const animationFiles = [
			'stand_idle.glb',
			'lipsync.glb',
			'gesture.glb',
			'emote.glb',
			'face_idle.glb',
			'blink.glb',
			'poi.glb',
		]
		const gestureConfigFile = 'gesture.json'
		const poiConfigFile = 'poi.json'
		const audioAttachJoint1 = 'chardef_c_neckB' // Name of the joint to attach audio to
		const audioAttachJoint2 = 'charhead'
		const lookJoint1 = 'charjx_c_look' // Name of the joint to use for point of interest target tracking
		const lookJoint2 = 'chargaze'
		const voice1 = 'Matthew' // Polly voice. Full list of available voices at: https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
		const voice2 = 'Ivy'
		const voiceEngine = 'neural' // Neural engine is not available for all voices in all regions: https://docs.aws.amazon.com/polly/latest/dg/NTTS-main.html

		// Set up the scene and host
		const { scene, camera, clock } = this.createScene()
		const {
			character: character1,
			clips: clips1,
			bindPoseOffset: bindPoseOffset1,
		} = await this.loadCharacter(scene, characterFile1, animationPath1, animationFiles)
		const {
			character: character2,
			clips: clips2,
			bindPoseOffset: bindPoseOffset2,
		} = await this.loadCharacter(scene, characterFile2, animationPath2, animationFiles)

		character1.position.set(1.25, 0, 0)
		character1.rotateY(-0.5)
		character2.position.set(-0.5, 0, 0)
		character2.rotateY(0.5)

		// Find the joints defined by name
		const audioAttach1 = character1.getObjectByName(audioAttachJoint1)
		const audioAttach2 = character2.getObjectByName(audioAttachJoint2)
		const lookTracker1 = character1.getObjectByName(lookJoint1)
		const lookTracker2 = character2.getObjectByName(lookJoint2)

		// Read the gesture config file. This file contains options for splitting up
		// each animation in gestures.glb into 3 sub-animations and initializing them
		// as a QueueState animation.
		const gestureConfig1 = await fetch(`${animationPath1}/${gestureConfigFile}`).then(response => response.json())
		const gestureConfig2 = await fetch(`${animationPath2}/${gestureConfigFile}`).then(response => response.json())

		// Read the point of interest config file. This file contains options for
		// creating Blend2dStates from look pose clips and initializing look layers
		// on the PointOfInterestFeature.
		const poiConfig1 = await fetch(`${animationPath1}/${poiConfigFile}`).then(response => response.json())
		const poiConfig2 = await fetch(`${animationPath2}/${poiConfigFile}`).then(response => response.json())

		const [idleClips1, lipsyncClips1, gestureClips1, emoteClips1, faceClips1, blinkClips1, poiClips1] = clips1
		const host1 = this.createHost(
			character1,
			audioAttach1,
			voice1,
			voiceEngine,
			idleClips1[0],
			faceClips1[0],
			lipsyncClips1,
			gestureClips1,
			gestureConfig1,
			emoteClips1,
			blinkClips1,
			poiClips1,
			poiConfig1,
			lookTracker1,
			bindPoseOffset1,
			clock,
			camera,
			scene,
		)
		const [idleClips2, lipsyncClips2, gestureClips2, emoteClips2, faceClips2, blinkClips2, poiClips2] = clips2
		const host2 = this.createHost(
			character2,
			audioAttach2,
			voice2,
			voiceEngine,
			idleClips2[0],
			faceClips2[0],
			lipsyncClips2,
			gestureClips2,
			gestureConfig2,
			emoteClips2,
			blinkClips2,
			poiClips2,
			poiConfig2,
			lookTracker2,
			bindPoseOffset2,
			clock,
			camera,
			scene,
		)

		// Set up each host to look at the other when the other speaks and at the
		// camera when speech ends
		const onHost1StartSpeech = () => {
			host2.PointOfInterestFeature.setTarget(lookTracker1)
		}
		const onHost2StartSpeech = () => {
			host1.PointOfInterestFeature.setTarget(lookTracker2)
		}
		const onStopSpeech = () => {
			host1.PointOfInterestFeature.setTarget(camera)
			host2.PointOfInterestFeature.setTarget(camera)
		}

		host1.listenTo(host1.TextToSpeechFeature.EVENTS.play, onHost1StartSpeech)
		host1.listenTo(host1.TextToSpeechFeature.EVENTS.resume, onHost1StartSpeech)
		host2.listenTo(host2.TextToSpeechFeature.EVENTS.play, onHost2StartSpeech)
		host2.listenTo(host2.TextToSpeechFeature.EVENTS.resume, onHost2StartSpeech)
		HOST.aws.TextToSpeechFeature.listenTo(HOST.aws.TextToSpeechFeature.EVENTS.pause, onStopSpeech)
		HOST.aws.TextToSpeechFeature.listenTo(HOST.aws.TextToSpeechFeature.EVENTS.stop, onStopSpeech)

		// Hide the load screen and show the text input
		this.shadowRoot.getElementById('ui').classList.remove('hidden')
		this.shadowRoot.getElementById('loadScreen').classList.add('hidden')

		await speechInit

		speakers.set('Luke', host1)
		speakers.set('Alien', host2)

		this.initializeUX()

		this.setupControls()
	}

	/** @type {Array<(time: number) => void>} */
	animationLoopUpdates = []

	downKeys = new Set()

	isJumping = false

	triggerJump() {
		if (this.isJumping) return
		this.isJumping = true

		const camera = this.shadowRoot?.querySelector('lume-perspective-camera')

		const cameraRoot = camera?.parentElement

		const startTime = performance.now()
		console.log('TRIGGER JUMP')

		Motor.addRenderTask(() => {
			const currentTime = performance.now()
			const elapsedTime = (currentTime - startTime) / 1000

			if (elapsedTime >= 1) {
				this.isJumping = false
				cameraRoot.position.y = -playerHeight
				return false
			}

			let new_y = -4 * (elapsedTime - 0.5) ** 2 + 1
			cameraRoot.position.y = -(new_y + playerHeight)
		})
	}

	setupControls() {
		document.addEventListener('keydown', event => {
			this.downKeys.add(event.key)

			if (this.downKeys.has(' ')) this.triggerJump()
		})
		document.addEventListener('keyup', event => {
			this.downKeys.delete(event.key)
		})

		const camera = this.shadowRoot?.querySelector('lume-perspective-camera')
		const cameraRoot = camera?.parentElement

		// Every animation frame, move the camera if WASD keys are held.
		const loop = () => {
			const speed = 0.05
			const crouchHeight = 0.1 // Define how much the camera moves down when crouching

			if (this.downKeys.has('w')) {
				cameraRoot.position.x += speed * -Math.sin(cameraRoot.rotation.y * (Math.PI / 180))
				cameraRoot.position.z += speed * -Math.cos(cameraRoot.rotation.y * (Math.PI / 180))
			}
			if (this.downKeys.has('s')) {
				cameraRoot.position.x -= speed * -Math.sin(cameraRoot.rotation.y * (Math.PI / 180))
				cameraRoot.position.z -= speed * -Math.cos(cameraRoot.rotation.y * (Math.PI / 180))
			}
			if (this.downKeys.has('a')) {
				cameraRoot.position.x += speed * -Math.cos(cameraRoot.rotation.y * (Math.PI / 180))
				cameraRoot.position.z += speed * Math.sin(cameraRoot.rotation.y * (Math.PI / 180))
			}
			if (this.downKeys.has('d')) {
				cameraRoot.position.x -= speed * -Math.cos(cameraRoot.rotation.y * (Math.PI / 180))
				cameraRoot.position.z -= speed * Math.sin(cameraRoot.rotation.y * (Math.PI / 180))
			}

			//crouch
			if (this.downKeys.has('Shift')) {
				cameraRoot.position.y += crouchHeight // Move the camera down
			}
		}

		this.animationLoopUpdates.push(loop)

		let pointers = new Set()

		this.addEventListener('pointerdown', event => {
			if (pointers.size > 1) return // just one pointer for now
			pointers.add(event.pointerId)
		})
		this.addEventListener('pointermove', event => {
			if (!pointers.has(event.pointerId)) return // just one pointer for now

			cameraRoot.rotation.y -= event.movementX * 0.3
			camera.rotation.x += event.movementY * 0.3
		})
		this.addEventListener('pointerup', event => {
			if (!pointers.has(event.pointerId)) return // just one pointer for now
			pointers.delete(event.pointerId)
		})
	}

	makeDOM() {
		const el = document.createElement('lume-directional-light')
		this.shadowRoot.innerHTML = /*html*/ `
			<div id="lume">
				<lume-scene
					webgl
					enable-css="${cssTransformsForDebug}"
					vr="${renderWithLume ? true : false}"
					background-color="#33334d"
					background-opacity="1"
					fog-mode="linear"
					fog-color="#33334d"
					fog-near="0"
					fog-far="10"
				>

					<!--
					Align the Lume scene with the Sumerian Threejs scene.
					We may remove this when we update Lume so its default origin aligns with Three.js.
					-->
					<lume-element3d align-point="0.5 0.5">

						<!--<lume-camera-rig
							initial-distance="3"
							min-distance="1"
							max-distance="100"
							dolly-speed="0.03"
							position="0 -0.65"
						></lume-camera-rig>-->

						<lume-element3d position="0 -${playerHeight} 2" >
							<lume-perspective-camera active></lume-perspective-camera>
						</lume-element3d>

						<lume-directional-light
							position="0 -4 5"
							cast-shadow=true
							shadow-map-width="1024"
							shadow-map-height="1024"
							shadow-camera-top="2.5"
							shadow-camera-bottom="-2.5"
							shadow-camera-left="-2.5"
							shadow-camera-right="2.5"
							shadow-camera-near="0.1"
							shadow-camera-far="40"
						></lume-directional-light>

						<lume-box position="-2" rotation="0 -30" size="0.5 0.5 0.5" mount-point="0.5 1 0.5" color="pink"></lume-box>

						<lume-element3d position="2">
							<lume-sphere size="0.5 0.5 0.5" mount-point="0.5 1 0.5" color="skyblue"></lume-sphere>
						</lume-element3d>

					</lume-element3d>

				</lume-scene>
			</div>

			<div id="scene">
				<!-- The Three.js scene canvas gets appended here. -->
			</div>

			<div id="ui">
				<slot>
					<!-- Login UI from main.jsx gets slotted here. -->
				</slot>

				<!--Text to speech controls-->
				<div id="textToSpeech" class="hidden">
					<button class="tab current">Luke</button>
					<button class="tab">Alien</button>
					<div>
						<textarea autofocus size="23" type="text" class="textEntry Luke">
<speak>
	<amazon:domain name="conversational">
		Hello, my name is Luke. I used to only be a host inside Amazon Sumerian, but
		now you can use me in other Javascript runtime environments like three js
		and Babylon js. Right now,
		<mark name='{"feature":"PointOfInterestFeature","method":"setTargetByName","args":["chargaze"]}'/>
		my friend and I here are in three js.
	</amazon:domain>
</speak>
</textarea
						>
						<textarea autofocus size="23" type="text" class="textEntry Alien">
<speak>
	Hi there! As you can see I'm set up to be a host too, although I don't use
	the same type of skeleton as any of the original Amazon Sumerian hosts. With
	open source hosts, you can apply host functionality to any custom animated
	character you'd like. I'm excited to see what kinds of interesting host
	characters you'll bring to life!
</speak>
</textarea
						>
					</div>
					<div>
						<button id="play" class="speechButton">Play</button>
						<button id="pause" class="speechButton">Pause</button>
						<button id="resume" class="speechButton">Resume</button>
						<button id="stop" class="speechButton">Stop</button>
					</div>
					<div>
						<button id="gestures" class="gestureButton">Generate Gestures</button>
					</div>
					<div>
						<select id="emotes" class="gestureButton"></select>
					</div>
					<div>
						<button id="playEmote" class="gestureButton">Play Emote</button>
					</div>
				</div>
			</div>

			<!-- /////////////////////////////////////////////////////////////// -->

			<!--Loading screen-->
			<div id="loadScreen">
				<div id="loader"></div>
			</div>

			<style>
				:host {
					display: block;
				}

				.tab {
					background-color: rgb(219, 219, 219);
					padding-bottom: 0px;
					margin-bottom: -1px;
					border-width: 1px;
					border-style: solid;
					z-index: 2;
					position: relative;
					outline: 0px;
				}

				.current {
					background-color: white;
					border-bottom-color: white;
					font-weight: bold;
				}

				.textEntry {
					min-width: 305px;
					min-height: 200px;
					outline: 0px;
					padding: 10px;
					resize: both;
				}

				.speechButton {
					width: 78.75px;
				}

				.gestureButton {
					width: 327px;
					outline: 0px;
				}

				#renderCanvas {
					display: block;
					width: 100%;
					height: 100%;
					touch-action: none;
				}

				#lume {
					position: absolute;
					width: 100%;
					height: 100%;

					/* Make the Lume scene visibly hidden because we're rendering with the Sumerian scene. */
					opacity: ${renderWithLume ? '1' : '0.000001'};

					/* If we're not using the Lume camera, we can completely hide the Lume scene, otherwise we make it practically invisible with tiny opacity so that it will catch pointer events for Lume's camera functionality. */
					${useLumeCamera ? '' : 'display: none;'}
				}

				#ui {
					position: absolute;
					top: 10px;
					left: 10px;
					border-radius: 10px;
					padding: 10px;
					background: rgba(0, 0, 0, 0.8);
				}

				#loadScreen {
					display: flex;
					align-items: center;
					justify-content: center;
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-image: url('/assets/images/load_screen.png');
					background-color: gray;
					background-repeat: no-repeat;
					background-attachment: fixed;
					background-position: center;
					background-size: contain;
					z-index: 9999;
				}

				#loader {
					border: 16px solid #3498db38;
					border-radius: 50%;
					border-top: 16px solid #3498db;
					width: 120px;
					height: 120px;
					-webkit-animation: spin 2s linear infinite;
					animation: spin 2s linear infinite;
					position: fixed;
				}

				.hidden {
					display: none !important;
				}

				@-webkit-keyframes spin {
					0% {
						-webkit-transform: rotate(0deg);
					}
					100% {
						-webkit-transform: rotate(360deg);
					}
				}

				@keyframes spin {
					0% {
						transform: rotate(0deg);
					}
					100% {
						transform: rotate(360deg);
					}
				}
			</style>
		`
	}

	// Set up base scene
	createScene() {
		// Base scene
		const scene = new THREE.Scene()
		scene.background = new THREE.Color(0x33334d)
		scene.fog = new THREE.Fog(0x33334d, 0, 10)

		this.lumeScene = this.shadowRoot?.querySelector('lume-scene')

		// Render one scene in the other
		if (renderWithLume) {
			// (rendering the Sumerian scene in the Lume scene doesn't work currently due to version differences of Threejs libs)
			this.lumeScene.three.children.push(scene)
		} else {
			scene.children.push(this.lumeScene.three)
		}

		const clock = new THREE.Clock()

		// Renderer
		const renderer = new THREE.WebGLRenderer({ antialias: true })
		renderer.setPixelRatio(window.devicePixelRatio)
		renderer.setSize(window.innerWidth, window.innerHeight)
		renderer.outputEncoding = THREE.sRGBEncoding
		renderer.shadowMap.enabled = true
		renderer.setClearColor(0x33334d)
		renderer.domElement.id = 'renderCanvas'
		this.shadowRoot.getElementById('scene').append(renderer.domElement)

		if (!renderWithLume) {
			// Enable XR
			renderer.xr.enabled = true
			const button = VRButton.createButton(renderer)
			button.style = 'position: unset;'
			this.shadowRoot.getElementById('ui')?.append(button)
		}

		// Env map
		new THREE.TextureLoader().setPath('/assets/').load('images/machine_shop.jpg', hdrEquirect => {
			const hdrCubeRenderTarget = pmremGenerator.fromEquirectangular(hdrEquirect)
			hdrEquirect.dispose()
			pmremGenerator.dispose()

			scene.environment = hdrCubeRenderTarget.texture
		})

		const pmremGenerator = new THREE.PMREMGenerator(renderer)
		pmremGenerator.compileEquirectangularShader()

		// Camera
		const camera = new THREE.PerspectiveCamera(
			THREE.MathUtils.radToDeg(0.8),
			window.innerWidth / window.innerHeight,
			0.1,
			1000,
		)
		camera.position.set(0, 0.75, 3.1)
		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true
		controls.target = new THREE.Vector3(0, 0.8, 0)
		controls.screenSpacePanning = true
		controls.update()

		// Handle window resize
		const onWindowResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight
			camera.updateProjectionMatrix()
			renderer.setSize(window.innerWidth, window.innerHeight)
		}
		window.addEventListener('resize', onWindowResize, false)

		// Render loop
		const loop = () => {
			controls.update()

			renderFn.forEach(fn => {
				fn()
			})

			if (renderWithLume) {
				// Skip rendering with the Sumerian Three.js renderer.
			} else {
				if (useLumeCamera) {
					// Render with Lume's camera
					renderer.render(scene, this.lumeScene?.camera.three)
				} else {
					// Render with the original Sumerian camera.
					renderer.render(scene, camera)
				}
			}
		}

		queueMicrotask(() => this.animationLoopUpdates.push(loop))

		// If we're rendering with the Lume scene, we should hook into its own
		// loop system so that when WebXR is enabled we're hooked into its XR
		// loop.
		if (renderWithLume) {
			Motor.addRenderTask(time => {
				for (const fn of this.animationLoopUpdates) fn(time)
			})
		} else {
			// Add this callback in a microtask so that render happens last after
			// any other callbacks.
			renderer.setAnimationLoop(time => {
				for (const fn of this.animationLoopUpdates) fn(time)
			})
		}

		// Lights
		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6)
		hemiLight.position.set(0, 1, 0)
		hemiLight.intensity = 0.6
		scene.add(hemiLight)

		// Environment
		const groundMat = new THREE.MeshStandardMaterial({
			color: 0x808080,
			depthWrite: false,
		})
		groundMat.metalness = 0
		groundMat.refractionRatio = 0
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMat)
		ground.rotation.x = -Math.PI / 2
		ground.receiveShadow = true
		scene.add(ground)

		const lumeCamera = this.lumeScene?.camera.three

		return { scene, camera: renderWithLume ? lumeCamera : useLumeCamera ? lumeCamera : camera, clock }
	}

	// Load character model and animations
	async loadCharacter(scene, characterFile, animationPath, animationFiles) {
		// Asset loader
		const fileLoader = new THREE.FileLoader()
		const gltfLoader = new GLTFLoader()

		const loadAsset = (loader, assetPath, onLoad) => {
			return new Promise(resolve => {
				loader.load(assetPath, async asset => {
					if (onLoad[Symbol.toStringTag] === 'AsyncFunction') {
						const result = await onLoad(asset)
						resolve(result)
					} else {
						resolve(onLoad(asset))
					}
				})
			})
		}

		// Load character model
		const { character, bindPoseOffset } = await loadAsset(gltfLoader, characterFile, gltf => {
			// Transform the character
			const character = gltf.scene
			scene.add(character)

			// Make the offset pose additive
			const [bindPoseOffset] = gltf.animations
			if (bindPoseOffset) {
				THREE.AnimationUtils.makeClipAdditive(bindPoseOffset)
			}

			// Cast shadows
			character.traverse(object => {
				if (object.isMesh) {
					object.castShadow = true
				}
			})

			return { character, bindPoseOffset }
		})

		// Load animations
		const clips = await Promise.all(
			animationFiles.map((filename, index) => {
				const filePath = `${animationPath}/${filename}`

				return loadAsset(gltfLoader, filePath, async gltf => {
					return gltf.animations
				})
			}),
		)

		return { character, clips, bindPoseOffset }
	}

	// Initialize the host
	createHost(
		character,
		audioAttachJoint,
		voice,
		engine,
		idleClip,
		faceIdleClip,
		lipsyncClips,
		gestureClips,
		gestureConfig,
		emoteClips,
		blinkClips,
		poiClips,
		poiConfig,
		lookJoint,
		bindPoseOffset,
		clock,
		camera,
		scene,
	) {
		// Add the host to the render loop
		const host = new HOST.HostObject({ owner: character, clock })
		renderFn.push(() => {
			host.update()
		})

		// Set up text to speech
		const audioListener = new THREE.AudioListener()
		camera.add(audioListener)
		host.addFeature(HOST.aws.TextToSpeechFeature, false, {
			listener: audioListener,
			attachTo: audioAttachJoint,
			voice,
			engine,
		})

		// Set up animation
		host.addFeature(HOST.anim.AnimationFeature)

		// Base idle
		host.AnimationFeature.addLayer('Base')
		host.AnimationFeature.addAnimation('Base', idleClip.name, HOST.anim.AnimationTypes.single, { clip: idleClip })
		host.AnimationFeature.playAnimation('Base', idleClip.name)

		// Face idle
		host.AnimationFeature.addLayer('Face', {
			blendMode: HOST.anim.LayerBlendModes.Additive,
		})
		THREE.AnimationUtils.makeClipAdditive(faceIdleClip)
		host.AnimationFeature.addAnimation('Face', faceIdleClip.name, HOST.anim.AnimationTypes.single, {
			clip: THREE.AnimationUtils.subclip(faceIdleClip, faceIdleClip.name, 1, faceIdleClip.duration * 30, 30),
		})
		host.AnimationFeature.playAnimation('Face', faceIdleClip.name)

		// Blink
		host.AnimationFeature.addLayer('Blink', {
			blendMode: HOST.anim.LayerBlendModes.Additive,
			transitionTime: 0.075,
		})
		blinkClips.forEach(clip => {
			THREE.AnimationUtils.makeClipAdditive(clip)
		})
		host.AnimationFeature.addAnimation('Blink', 'blink', HOST.anim.AnimationTypes.randomAnimation, {
			playInterval: 3,
			subStateOptions: blinkClips.map(clip => {
				return {
					name: clip.name,
					loopCount: 1,
					clip,
				}
			}),
		})
		host.AnimationFeature.playAnimation('Blink', 'blink')

		// Talking idle
		host.AnimationFeature.addLayer('Talk', {
			transitionTime: 0.75,
			blendMode: HOST.anim.LayerBlendModes.Additive,
		})
		host.AnimationFeature.setLayerWeight('Talk', 0)
		const talkClip = lipsyncClips.find(c => c.name === 'stand_talk')
		lipsyncClips.splice(lipsyncClips.indexOf(talkClip), 1)
		host.AnimationFeature.addAnimation('Talk', talkClip.name, HOST.anim.AnimationTypes.single, {
			clip: THREE.AnimationUtils.makeClipAdditive(talkClip),
		})
		host.AnimationFeature.playAnimation('Talk', talkClip.name)

		// Gesture animations
		host.AnimationFeature.addLayer('Gesture', {
			transitionTime: 0.5,
			blendMode: HOST.anim.LayerBlendModes.Additive,
		})
		gestureClips.forEach(clip => {
			const { name } = clip
			const config = gestureConfig[name]
			THREE.AnimationUtils.makeClipAdditive(clip)

			if (config !== undefined) {
				config.queueOptions.forEach((option, index) => {
					// Create a subclip for each range in queueOptions
					option.clip = THREE.AnimationUtils.subclip(clip, `${name}_${option.name}`, option.from, option.to, 30)
				})
				host.AnimationFeature.addAnimation('Gesture', name, HOST.anim.AnimationTypes.queue, config)
			} else {
				host.AnimationFeature.addAnimation('Gesture', name, HOST.anim.AnimationTypes.single, { clip })
			}
		})

		// Emote animations
		host.AnimationFeature.addLayer('Emote', {
			transitionTime: 0.5,
		})

		emoteClips.forEach(clip => {
			const { name } = clip
			host.AnimationFeature.addAnimation('Emote', name, HOST.anim.AnimationTypes.single, { clip, loopCount: 1 })
		})

		// Viseme poses
		host.AnimationFeature.addLayer('Viseme', {
			transitionTime: 0.12,
			blendMode: HOST.anim.LayerBlendModes.Additive,
		})
		host.AnimationFeature.setLayerWeight('Viseme', 0)

		// Slice off the reference frame
		const blendStateOptions = lipsyncClips.map(clip => {
			THREE.AnimationUtils.makeClipAdditive(clip)
			return {
				name: clip.name,
				clip: THREE.AnimationUtils.subclip(clip, clip.name, 1, 2, 30),
				weight: 0,
			}
		})
		host.AnimationFeature.addAnimation('Viseme', 'visemes', HOST.anim.AnimationTypes.freeBlend, { blendStateOptions })
		host.AnimationFeature.playAnimation('Viseme', 'visemes')

		// POI poses
		poiConfig.forEach(config => {
			host.AnimationFeature.addLayer(config.name, {
				blendMode: HOST.anim.LayerBlendModes.Additive,
			})

			// Find each pose clip and make it additive
			config.blendStateOptions.forEach(clipConfig => {
				const clip = poiClips.find(clip => clip.name === clipConfig.clip)
				THREE.AnimationUtils.makeClipAdditive(clip)
				clipConfig.clip = THREE.AnimationUtils.subclip(clip, clip.name, 1, 2, 30)
			})

			host.AnimationFeature.addAnimation(config.name, config.animation, HOST.anim.AnimationTypes.blend2d, {
				...config,
			})

			host.AnimationFeature.playAnimation(config.name, config.animation)

			// Find and store reference objects
			config.reference = character.getObjectByName(config.reference.replace(':', ''))
		})

		// Apply bindPoseOffset clip if it exists
		if (bindPoseOffset !== undefined) {
			host.AnimationFeature.addLayer('BindPoseOffset', {
				blendMode: HOST.anim.LayerBlendModes.Additive,
			})
			host.AnimationFeature.addAnimation('BindPoseOffset', bindPoseOffset.name, HOST.anim.AnimationTypes.single, {
				clip: THREE.AnimationUtils.subclip(bindPoseOffset, bindPoseOffset.name, 1, 2, 30),
			})
			host.AnimationFeature.playAnimation('BindPoseOffset', bindPoseOffset.name)
		}

		// Set up Lipsync
		const visemeOptions = {
			layers: [{ name: 'Viseme', animation: 'visemes' }],
		}
		const talkingOptions = {
			layers: [
				{
					name: 'Talk',
					animation: 'stand_talk',
					blendTime: 0.75,
					easingFn: HOST.anim.Easing.Quadratic.InOut,
				},
			],
		}
		host.addFeature(HOST.LipsyncFeature, false, visemeOptions, talkingOptions)

		// Set up Gestures
		host.addFeature(HOST.GestureFeature, false, {
			layers: {
				Gesture: { minimumInterval: 3 },
				Emote: {
					blendTime: 0.5,
					easingFn: HOST.anim.Easing.Quadratic.InOut,
				},
			},
		})

		// Set up Point of Interest
		host.addFeature(
			HOST.PointOfInterestFeature,
			false,
			{
				target: camera,
				lookTracker: lookJoint,
				scene,
			},
			{
				layers: poiConfig,
			},
			{
				layers: [{ name: 'Blink' }],
			},
		)

		return host
	}

	// Return the host whose name matches the text of the current tab
	getCurrentHost() {
		const tab = this.shadowRoot.querySelector('.tab.current')
		const name = tab.textContent

		return { name, host: speakers.get(name) }
	}

	// Update UX with data for the current host
	toggleHost(evt) {
		const tab = evt.target
		const allTabs = this.shadowRoot.querySelectorAll('.tab')

		// Update tab classes
		for (let i = 0, l = allTabs.length; i < l; i++) {
			if (allTabs[i] !== tab) {
				allTabs[i].classList.remove('current')
			} else {
				allTabs[i].classList.add('current')
			}
		}

		// Show/hide speech input classes
		const { name, host } = this.getCurrentHost(speakers)
		const textEntries = this.shadowRoot.querySelectorAll('.textEntry')

		for (let i = 0, l = textEntries.length; i < l; i += 1) {
			const textEntry = textEntries[i]

			if (textEntry.classList.contains(name)) {
				textEntry.classList.remove('hidden')
			} else {
				textEntry.classList.add('hidden')
			}
		}

		// Update emote selector
		const emoteSelect = this.shadowRoot.getElementById('emotes')
		emoteSelect.length = 0
		const emotes = host.AnimationFeature.getAnimations('Emote')
		emotes.forEach((emote, i) => {
			const emoteOption = document.createElement('option')
			emoteOption.text = emote
			emoteOption.value = emote
			emoteSelect.add(emoteOption, 0)

			// Set the current item to the first emote
			if (!i) {
				emoteSelect.value = emote
			}
		})
	}

	initializeUX(speakers) {
		// Enable drag/drop text files on the speech text area
		this.enableDragDrop('textEntry')

		// Connect tab buttons to hosts
		Array.from(this.shadowRoot.querySelectorAll('.tab')).forEach(tab => {
			tab.onclick = evt => {
				this.toggleHost(evt)
			}
		})

		// Play, pause, resume and stop the contents of the text input as speech
		// when buttons are clicked
		;['play', 'pause', 'resume', 'stop'].forEach(id => {
			const button = this.shadowRoot.getElementById(id)
			button.onclick = () => controlSpeech(id)
		})

		/**
		 * @param {'play' | 'pause' | 'resume' | 'stop'} action
		 * @param {string=} text The text to play. If not given, plays whatever
		 * text was given last time.
		 */
		controlSpeech = (action, text) => {
			const { name, host } = this.getCurrentHost(speakers)
			const textarea = this.shadowRoot.querySelector(`.textEntry.${name}`)
			if (text) textarea.value = text
			host.TextToSpeechFeature[action](textarea.value)
		}

		// Update the text area text with gesture SSML markup when clicked
		const gestureButton = this.shadowRoot.getElementById('gestures')
		gestureButton.onclick = () => {
			const { name, host } = this.getCurrentHost(speakers)
			const speechInput = this.shadowRoot.querySelector(`.textEntry.${name}`)
			const gestureMap = host.GestureFeature.createGestureMap()
			const gestureArray = host.GestureFeature.createGenericGestureArray(['Gesture'])
			speechInput.value = HOST.aws.TextToSpeechUtils.autoGenerateSSMLMarks(speechInput.value, gestureMap, gestureArray)
		}

		// Play emote on demand with emote button
		const emoteSelect = this.shadowRoot.getElementById('emotes')
		const emoteButton = this.shadowRoot.getElementById('playEmote')
		emoteButton.onclick = () => {
			const { host } = this.getCurrentHost(speakers)
			host.GestureFeature.playGesture('Emote', emoteSelect.value)
		}

		// Initialize tab
		const tab = this.shadowRoot.querySelector('.tab.current')
		this.toggleHost({ target: tab })
	}

	enableDragDrop(className) {
		const elements = this.shadowRoot.querySelector('.' + className)

		for (let i = 0, l = elements.length; i < l; i += 1) {
			const dropArea = elements[i]

			// Copy contents of files into the text input once they are read
			const fileReader = new FileReader()
			fileReader.onload = evt => {
				dropArea.value = evt.target.result
			}

			// Drag and drop listeners
			dropArea.addEventListener('dragover', evt => {
				evt.stopPropagation()
				evt.preventDefault()
				evt.dataTransfer.dropEffect = 'copy'
			})

			dropArea.addEventListener('drop', evt => {
				evt.stopPropagation()
				evt.preventDefault()

				// Read the first file that was dropped
				const [file] = evt.dataTransfer.files
				fileReader.readAsText(file, 'UTF-8')
			})
		}
	}
}

customElements.define('auto-app', AutoApp)
