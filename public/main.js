/* @jsxImportSource solid-js */
// @ts-check
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Blaze } from 'meteor/blaze'
import { Template } from 'meteor/templating'
import { createMutable } from 'solid-js/store'
import { batch } from 'solid-js'
import html from 'solid-js/html'
import './AutoApp.js'
import { Recorder } from './audio.js'
import { controlSpeech } from './AutoApp.js'

function App() {
	const state = createMutable({ response: '', user: null, userId: null })

	Tracker.autorun(() => {
		batch(() => {
			state.user = Meteor.user()
			state.userId = Meteor.userId()
		})
	})

	let input

	function sendMessage(e) {
		e.preventDefault()

		controlSpeech('stop')

		Meteor.call('sendMessage', input.value, (error, result) => {
			if (error) throw error
			textToSpeech(result)
		})
		input.value = ''
	}

	let loginBox = html`<div></div>`
	Blaze.render(Template.loginButtons, loginBox)

	function textToSpeech(text) {
		state.response = text
		controlSpeech('play', text)
	}

	async function recordAndSendAudio() {
		controlSpeech('stop')

		const rec = new Recorder()

		// Stop after 4 seconds (TODO detect the audio to capture between silences)
		setTimeout(() => rec.stop(), 4000)

		/** @type {Blob} */
		const blob = await new Promise(r => rec.recordAudio(r))

		Meteor.call('sendAudio', { audio: new Uint8Array(await blob.arrayBuffer()) }, (error, result) => {
			if (error) throw error
			textToSpeech(result)
		})
	}

	const div = html`
		<div>
			Log in to chat: ${loginBox}

			<form onsubmit=${sendMessage} style=${() => (state.user ? '' : 'display: none')}>
				<input ref=${el => (input = el)} type="text" />
			</form>

			<div>${() => state.response}</div>

			<button onclick=${recordAndSendAudio}>record</button>
		</div>
	`

	return div
}

Meteor.startup(async () => {
	await customElements.whenDefined('auto-app')
	const el = document.querySelector('auto-app')
	el.append(App())
})
