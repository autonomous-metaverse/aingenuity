import { Meteor } from 'meteor/meteor'
import { Configuration, OpenAIApi } from 'openai'

console.log('OpenAI API:', OpenAIApi)

const openaiKey = Meteor.settings.OPENAI_KEY
if (!openaiKey) throw new Error('Follow instructions in README.md to add keys to the app.')

const configuration = new Configuration({ apiKey: openaiKey })
const openai = new OpenAIApi(configuration)

let i = 0

Meteor.methods({
	async sendMessage(msg) {
		console.log('sendMessage on server?', msg)

		if (!Meteor.userId()) throw new Error('Not logged in.')

		console.log('send message to client...')

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

			console.log('message data:', response.data.choices[0].message.content)
			return response.data.choices[0].message.content
		} catch (e) {
			return 'Error 500: something went wrong.'
		}
	},
})
