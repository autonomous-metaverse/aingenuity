import { Meteor } from 'meteor/meteor'
import { Configuration, OpenAIApi } from 'openai'

console.log('OpenAI API:', OpenAIApi)

const openaiKey = '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'

const configuration = new Configuration({
	apiKey: openaiKey,
})
const openai = new OpenAIApi(configuration)

const fakeResponses = [
	'Not telling you anything until you add your credit card.',
	'No money, no service.',
	'Maybe Google can tell you.',
]

let i = 0

Meteor.methods({
	async sendMessage(msg) {
		console.log('sendMessage on server?', msg)

		if (!Meteor.userId()) throw new Error('Not logged in.')

		console.log('send message to client')

		try {
			const response = await openai.createChatCompletion({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'user',
						content: 'Brainstorm some ideas combining VR and fitness.',
					},
				],
				temperature: 0.6,
				max_tokens: 256,
			})

			return response.data
		} catch (e) {
			return fakeResponses[i++ % 3]
		}
	},
})
