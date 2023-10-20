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

const timeoutDuration = 10000

const vacationAssistantDescription = `
	You are a walking encyclopedia, and you know absolutely everything. You like
	to respond in riddles and jokes, and often respond in the form of a
	question. You like to make people laugh with your responses. With every
	response, you try to tell a joke if you can, but you also try to give useful
	information. You pride yourself on the quality of your information, and on
	how funny your jokes and responses are.
`

// Basically Meteor's RPC feature. Arguments can be EJSON (JSON with extensions
// like typed binary arrays).
Meteor.methods({
	/**
	 * @param {string} newMsg - The latest message from the client.
	 */
	async sendMessage(newMsg) {
		const userId = Meteor.userId()

		if (!userId) throw new Error('Not logged in.')

		const messageResponsePairs = await ChatContext.find({ userId }).fetchAsync()

		// For now each document has a message and response. Maybe better to
		// save messages and responses separate in the collection.
		/** @type {ChatMsg[]} */
		const messages = messageResponsePairs
			.map(pair => [
				/** @type {ChatMsg} */ ({ role: 'user', content: pair.msg }),
				/** @type {ChatMsg} */ ({ role: 'assistant', content: pair.response }),
			])
			.flat()

		let responseMsg = ''

		try {
			const response = await Promise.race([
				openai.createChatCompletion({
					model: 'gpt-3.5-turbo',
					messages: [
						{ role: 'system', content: vacationAssistantDescription },
						...messages,
						{ role: 'user', content: newMsg },
					],
					temperature: 0.6,
					// max_tokens: 256, // What is a good value for this?
				}),

				// Time out after a while.
				new Promise(r => setTimeout(r, timeoutDuration)),
			])

			// If timed out.
			if (!response) throw new Error('openai request timed out')

			// TODO: add AI_agent ID to keep context for each agent

			responseMsg = response.data.choices[0].message.content
		} catch (e) {
			console.log(' ===== Error with OpenAI: ===== \n')
			console.error(e)

			// NOTE! For now, we put error messages in the chat context for
			// testing, because OpenAI is giving nothing but errors (they always
			// seem to break) and we need to at least test with *something*.

			if (!(e instanceof Error)) responseMsg = 'Error: something went wrong.'
			else if (e.message.includes('timed out')) responseMsg = 'Error: OpenAI timed out.'
			else if (e.message.includes('status code 500')) responseMsg = 'Error 500: something went wrong.'
			else responseMsg = 'Error: something went wrong.'
		}

		console.log('OpenAI response:', responseMsg)

		ChatContext.insert({
			userId,
			msg: newMsg,
			response: responseMsg,
			// Use backend time to avoid clients hacking it.
			t: Date.now(),
		})

		return responseMsg
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
		const _id = Meteor.userId()

		if (!_id) console.error('Not logged in. Someone trying to cheat?')

		PlayerStates.upsert(
			{ _id },
			// Use backend time to avoid clients hacking it.
			{ ...playerState, t: Date.now() },
		)
	},
})

/** @typedef {import('openai/dist/api').ChatCompletionRequestMessage} ChatMsg */
