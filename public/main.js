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

// setTimeout(() => {
console.log('stuff?', globalThis.Tracker, Tracker)
// })

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

		window.controlSpeech('stop')

		console.log('send message to server', input.value)
		Meteor.call('sendMessage', input.value, (error, result) => {
			if (error) throw error
			console.log('got messge from server', result)
			state.response = result

			const el = document.querySelector('auto-app')
			const textarea = el.shadowRoot.querySelector('.textEntry.Luke')
			textarea.value = result
			window.controlSpeech('play')
		})
		input.value = ''
	}

	let loginBox = html`<div></div>`
	Blaze.render(Template.loginButtons, loginBox)

	const div = html`
		<div>
			Log in to chat: ${loginBox}

			<form onsubmit=${sendMessage} style=${() => (state.user ? '' : 'display: none')}>
				<input ref=${el => (input = el)} type="text" />
			</form>

			<div>${() => state.response}</div>

			<button
				onclick=${() => {
					console.log('click')
				}}
			>
				record
			</button>
		</div>
	`

	return div
}

Meteor.startup(async () => {
	await customElements.whenDefined('auto-app')
	const el = document.querySelector('auto-app')
	el.append(App())
})
