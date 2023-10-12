// @ts-check
import { Meteor } from 'meteor/meteor'
import { Configuration, OpenAIApi } from 'openai/dist/index.js'
import { createReadStream, promises } from 'fs'
import { Readable } from 'stream'
import { File, Blob } from 'web-file-polyfill'
import { PlayerStates } from '../public/PlayerStates'
import { ChatContext } from '../public/ChatContext'

const { open, writeFile } = promises

const openaiKey = Meteor.settings.OPENAI_KEY
if (!openaiKey) throw new Error('Follow instructions in README.md to add keys to the app.')

const configuration = new Configuration({ apiKey: openaiKey })
const openai = new OpenAIApi(configuration)

ChatContext.remove({}) // temporary

// Basically Meteor's RPC feature. Arguments can be EJSON (JSON with extensions
// like typed binary arrays).
Meteor.methods({
	/**
	 * @param {string} msg
	 */
	async sendMessage(msg) {
		if (!Meteor.userId()) throw new Error('Not logged in.')

		try {
			const response = await Promise.race([
				openai.createChatCompletion({
					model: 'gpt-3.5-turbo',
					messages: [{ role: 'user', content: msg }],
					temperature: 0.6,
					max_tokens: 256,
				}),
				// Time out after 5 seconds.
				new Promise(r => setTimeout(r, 5000)),
			])

			// If timed out.
			if (!response) throw 'timed out'

			const id = Meteor.userId()

			// TODO: add AI_agent ID to keep context for each agent
			if (!id) throw new Error('Not logged in. Cannot save context.')

			ChatContext.upsert(
				{
					_id: id,
				},
				{
					_msg: msg,
					_response: response.data.choices[0].message.content,
					// Use backend time to avoid clients hacking it.
					t: Date.now(),
				},
			)

			//test
			// if (ChatContext) {
			// 	console.log(ChatContext.find().fetch())
			// }

			// Add to ChatContext Collection
			return response.data.choices[0].message.content
		} catch (e) {
			return 'Error 500: something went wrong.'
		}
	},

	/**
	 * @param {{audio: Uint8Array}} msg
	 */
	async sendAudio(msg) {
		// Several commented attempts indicate various ways the developer tried to handle audio transcription.

		// Attempt 4, this works, but it is pretty bad because we have to write
		// the file to disk just to read it back. Presumably this works because
		// it gets the MIME type correct.
		await writeFile('./tmp-audio.webm', msg.audio)
		const r = await openai.createTranscription(createReadStream('./tmp-audio.webm'), 'whisper-1')

		const text = r.data.text

		// Method 5, fall back to direct network fetch.
		// const text = fetch('https://api.openai.com/v1/audio/transcriptions', {
		// 	headers: {
		// 		Authorization: `Bearer ${openaiKey}`,
		// 	}
		// }).then(r => r.text)

		return Meteor.call('sendMessage', text)
	},

	/**
	 * @param {import('../public/PlayerStates').PlayerState} playerState
	 */
	async updatePlayerState(playerState) {
		const id = Meteor.userId()

		if (!id) console.error('Not logged in. Someone trying to cheat?')

		PlayerStates.upsert(
			{
				_id: id,
			},
			{
				...playerState,
				// Use backend time to avoid clients hacking it.
				t: Date.now(),
			},
		)
	},
})
