export let Meteor = globalThis.Meteor
export let Blaze = globalThis.Blaze
export let Tracker = globalThis.Tracker
export let Template = globalThis.Template

console.log('got stuff?', Meteor, Blaze, Tracker, Template)

const promises = [new Promise(r => Meteor.startup(r))]

if (document.readyState !== 'complete') {
	promises.push(new Promise(r => window.addEventListener('load', r)))
}

promises.push(
	new Promise(resolve =>
		setTimeout(function waitForGlobals() {
			if (globalThis.Tracker) {
				console.log('ADD GLOBALS')

				// Add any Meteor APIs as needed here, and in imports/ui/main.jsx
				Meteor = globalThis.Meteor
				Blaze = globalThis.Blaze
				Tracker = globalThis.Tracker
				Template = globalThis.Template

				resolve()
			} else setTimeout(waitForGlobals)
		}),
	),
)

await Promise.all(promises)
