import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

/** @type {Mongo.Collection<PlayerStateDocument>} */
export const PlayerStates = new Mongo.Collection('PlayerStates')

if (Meteor.isServer) {
	Meteor.publish('PlayerStates', () => {
		if (!Meteor.userId()) return []
		return PlayerStates.find()
	})

	// Remove inactive user states after ~10 seconds of inactivity so that they
	// no longer appear in the world.
	// TODO: This is currently based on interaction. Instead we can base it on a
	// heartbeat.
	setInterval(
		Meteor.bindEnvironment(() => {
			const states = /** @type {PlayerStateDocument[]} */ (PlayerStates.find().fetch())

			for (const state of states) {
				if (Date.now() - state.t > 10_000) PlayerStates.remove({ _id: state._id })
			}
		}),
		1_000,
	)
} else {
	Meteor.subscribe('PlayerStates')
}

/**
 * @typedef {{
 *   r: {x: number, y: number}
 *   p: {x: number, y: number, z: number}
 *   t: number
 * }} PlayerState
 */

/**
 * @typedef {PlayerState & {_id: string}} PlayerStateDocument
 */
