import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'

export const PlayerStates = new Mongo.Collection('PlayerStates')

if (Meteor.isServer) {
	Meteor.publish('PlayerStates', () => {
		if (!Meteor.userId()) return []
		return PlayerStates.find()
	})
} else {
	Meteor.subscribe('PlayerStates')
}

/**
 * @typedef {{
 *   r: {x: number, y: number}
 *   p: {x: number, y: number, z: number}
 * }} PlayerState
 */

/**
 * @typedef {PlayerState & {_id: string}} PlayerStateDocument
 */
