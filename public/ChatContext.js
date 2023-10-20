import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

/** @type {Mongo.Collection<ChatContextDocument>} */
export const ChatContext = new Mongo.Collection('ChatContext')

if (Meteor.isServer) {
	Meteor.publish('ChatContext', () => {
		const userId = Meteor.userId()
		if (!userId) return []
		return ChatContext.find({ userId })
	})
} else {
	Meteor.subscribe('ChatContext')
}

/**
 * @typedef {{
 *   userId: string,
 *   msg: string
 *   response: string
 *   t: number
 * }} ChatContext
 */

/** @typedef {ChatContext & {_id: string}} ChatContextDocument */
