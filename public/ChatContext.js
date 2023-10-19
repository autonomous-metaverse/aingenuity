import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const ChatContext = new Mongo.Collection('ChatContext')

if (Meteor.isServer) {
	Meteor.publish('ChatContext', () => {
		if (!Meteor.userId()) return []
		return ChatContext.find()
	})
} else {
	Meteor.subscribe('ChatContext')
}

/**
 * @typedef {{
 *   _msg: string
 *   _response: string
 * }} ChatContext
 */

/** @typedef {ChatContext & {_id: string}} ChatContextDocument */
