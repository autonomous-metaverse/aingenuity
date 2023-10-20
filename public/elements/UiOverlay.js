import { For, batch, html } from 'lume'
import { Tracker } from 'meteor/tracker'
import { createMutable, unwrap } from 'solid-js/store'
import { ChatContext } from '../ChatContext.js'

export class UiOverlay extends HTMLElement {
	state = createMutable({
		/** @type {string | null} */
		userId: null,

		/** @type {boolean | false} */
		isFocused: false,

		/** @type {import('../ChatContext').ChatContextDocument[]} */
		chatMessages: [],
	})

	/** @type {HTMLInputElement} */
	input

	/** @type {import('./AppRoot.js').AppRoot} */
	appRoot

	constructor() {
		super()
		this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.appRoot = this.getRootNode().host

		Tracker.autorun(() => {
			batch(() => {
				this.state.userId = Meteor.userId()
			})
		})

		Tracker.autorun(() => {
			const userId = Meteor.userId()

			if (!userId) {
				this.state.chatMessages = []
			} else {
				this.state.chatMessages = /** @type {import('../ChatContext.js').ChatContextDocument[]} */ (
					ChatContext.find({ userId }).fetch()
				)
			}

			console.log('MESSAGES:', unwrap(this.state.chatMessages))
		})

		this.shadowRoot.innerHTML = /* html */ `
			<style>
				:host {
					background: rgba(255, 255, 255, 0.8);
					color: black;
				}

				#ui {
					display: flex;
					flex-direction: column;
					gap: 10px;
				}

				#msgs {
					border-top: 1px solid gray;
					border-bottom: 1px solid gray;
				}

				/** ///////////////////////////////////////////////// */

				/* Not working, the middle container still takes up content size, instead of being scrollable */
				/* #msgs {
					flex-grow: 1;
					overflow: auto;
					min-height: 0;
				} */

				/* Instead we need to specify an exact size, but then top and bottom cannot adapt their size to content. */
				#login {
					height: 20px;
				}
				#msgs {
					flex-grow: 1;
					overflow: auto;

					height: calc(100vh - 100px);
				}
				#input {
					height: 20px;
					display: flex;
				}
			</style>
		`

		this.shadowRoot?.append(html`
			<div id="ui">
				<div id="login">
					<slot name="login">${'' /* The Meteor loginBox gets slotted here from document light DOM */}</slot>
				</div>

				<div id="msgs">
					<${For} each=${() => this.state.chatMessages}>
						${
							/** @param {import('../ChatContext.js').ChatContextDocument} msg */
							msg => html`
								<p>${msg.msg}</p>
								<p>${msg.response}</p>
							`
						}
					<//>
				</div>

				<div id="input">
					<form onsubmit=${this.sendMessage} style=${() => (this.state.userId ? '' : 'display: none')}>
						<input
							ref=${el => (this.input = el)}
							type="text"
							placeholder="Write message, hit enter."
							onfocus=${() => (this.state.isFocused = true)}
							onblur=${() => (this.state.isFocused = false)}
						/>
					</form>

					<button type="submit">Send</button>
					<button onclick=${() => this.appRoot.recordAndSendAudio()}>Record</button>
				</div>
			</div>
		`)
	}

	sendMessage = e => {
		e.preventDefault()

		this.appRoot.controlSpeech('stop')

		Meteor.call('sendMessage', this.input.value, (error, result) => {
			if (error) throw error
			this.appRoot.textToSpeech(result)
		})
		this.input.value = ''
	}
}

customElements.define('ui-overlay', UiOverlay)
