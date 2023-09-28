// @ts-check
import { Meteor } from 'meteor/meteor'
import { Configuration, OpenAIApi } from 'openai/dist/index.js'
import { createReadStream, promises } from 'fs'
import { Readable } from 'stream'
import { File, Blob } from 'web-file-polyfill'
import { PlayerStates } from '../public/PlayerStates'

const { open, writeFile } = promises

const openaiKey = Meteor.settings.OPENAI_KEY
if (!openaiKey) throw new Error('Follow instructions in README.md to add keys to the app.')

const configuration = new Configuration({ apiKey: openaiKey })
const openai = new OpenAIApi(configuration)

let i = 0

// Basically Meteor's RPC feature. Arguments can be EJSON (JSON with extensions
// like typed binary arrays).
Meteor.methods({
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

			return response.data.choices[0].message.content
		} catch (e) {
			return 'Error 500: something went wrong.'
		}
	},

	/**
	 * @param {{audio: Uint8Array}} msg
	 */
	async sendAudio(msg) {
		// Attempt 1
		// Doesn't work, there is no File in Node.js (only browsers), but that's
		// what the openai type definition tells us to use.
		// const audioFile = new File(msg.audio)
		// const r = await openai.createTranscription(audioFile)

		// Attempt 2, use a buffer
		// No luck, these all get an error 400 back from openai.
		// Maybe we need to specify the MIME type somehow.
		//
		// const buffer = Buffer.from(msg.audio)
		// const r = await openai.createTranscription(buffer, 'whisper-1') // error 400
		//
		// const buffer = Buffer.from(msg.audio)
		// const r = await openai.createTranscription(Readable.from(buffer), 'whisper-1') // error 400
		//
		// const buffer = Buffer.from(msg.audio)
		// const readable = new Readable()
		// readable._read = () => {} // _read is required but you can noop it
		// readable.push(buffer)
		// readable.push(null)
		// const r = await openai.createTranscription(readable, 'whisper-1') // error 400

		// Attempt 3, using a File polyfill, which satisfies the openai type def,
		// but doesn't work ("TypeError: source.on is not a function")
		// const r = await openai.createTranscription(
		// 	new File([msg.audio], 'recording.webm', { type: 'audio/webm' }),
		// 	'whisper-1',
		// )

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

		if (!id) throw new Error('Not logged in.')

		PlayerStates.upsert(
			{ _id: id },
			{
				...playerState,

				// Use backend time to avoid clients hacking it.
				t: Date.now(),
			},
		)
	},
})
