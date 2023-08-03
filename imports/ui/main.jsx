/* @refresh reload */
/* @jsxImportSource solid-js */
// @ts-check
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Blaze } from 'meteor/blaze'
import { Template } from 'meteor/templating'
import { createMutable } from 'solid-js/store'
import { Show, batch } from 'solid-js'
// import {} from "../../server/methods";

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

	let loginBox = <div></div>
	Blaze.render(Template.loginButtons, loginBox)

	const style = <style>/*css*/``</style>

	const div = (
		<div>
			{style}
			Log in to chat:
			{loginBox}
			<Show when={state.user}>
				<form onsubmit={sendMessage}>
					<input ref={input} type="text" />
				</form>
			</Show>
			<div>{state.response}</div>
		</div>
	)

	return div
}

Meteor.startup(async () => {
	await customElements.whenDefined('auto-app')
	const el = document.querySelector('auto-app')
	el.append(App())
})
