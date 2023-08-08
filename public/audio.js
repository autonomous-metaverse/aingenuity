// @ts-check
import { Meteor } from 'meteor/meteor'

console.log('Meteor.call?', Meteor.call)

export function createAudioElement(blobUrl) {
	const anchor = document.createElement('a')
	anchor.style = 'display: block'
	anchor.innerHTML = 'download'
	anchor.download = 'audio.webm'
	anchor.href = blobUrl
	document.body.appendChild(anchor)

	const audio = document.createElement('audio')
	audio.controls = true
	document.body.appendChild(audio)

	const source = document.createElement('source')
	source.src = blobUrl
	source.type = 'audio/webm'
	audio.appendChild(source)
}

// convert blob to URL so it can be assigned to a audio src attribute
// createAudioElement(URL.createObjectURL(blob))

export class Recorder {
	stream
	recorder

	// store streaming data chunks in array
	chunks = []

	async init() {
		// request permission to access audio stream
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		this.chunks = []
		// create media recorder instance to initialize recording
		this.recorder = new MediaRecorder(this.stream)
	}

	/** @param {(blob: Blob) => void} onFinished */
	async recordAudio(onFinished) {
		await this.init()

		// function to be called when data is received
		this.recorder.ondataavailable = e => {
			// add stream data to chunks
			this.chunks.push(e.data)

			// if recorder is 'inactive' then recording has finished
			if (this.recorder.state == 'inactive') this.#onFinished(onFinished)
		}

		// start recording with 1 second time between receiving 'ondataavailable' events
		this.recorder.start(1000)
	}

	stop() {
		this.recorder.stop()
	}

	/** @param {(blob: Blob) => void} onFinished */
	#onFinished(onFinished) {
		// convert stream data chunks to a 'webm' audio format as a blob
		const blob = new Blob(this.chunks, { type: 'audio/webm' })
		onFinished(blob)
	}
}
