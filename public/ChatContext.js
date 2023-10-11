import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const ChatContext = new Mongo.Collection('ChatContext')

if (Meteor.isServer) {
	Meteor.publish('ChatContext', () => {
		if (!Meteor.userId()) return []
		return ChatContext.find()
	})
	// Remove inactive user states after ~10 seconds of inactivity so that they
	// no longer appear in the world.
	// TODO: This is currently based on interaction. Instead we can base it on a
	// heartbeat.
	setInterval(
		Meteor.bindEnvironment(() => {
			const states = /** @type {ChatContextDocument[]} */ (ChatContext.find().fetch())

			for (const state of states) {
				if (Date.now() - state.t > 10_000) ChatContext.remove({ _id: state._id })
			}
		}),
		1_000,
	)
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
