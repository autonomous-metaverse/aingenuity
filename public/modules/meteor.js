export let Meteor = globalThis.Meteor // Only Meteor is initially available

export let Blaze
export let Tracker
export let Template
export let Mongo

const promises = [new Promise(r => Meteor.startup(r))]

if (document.readyState !== 'complete') {
	promises.push(new Promise(r => window.addEventListener('load', r)))
}

promises.push(
	new Promise(resolve =>
		setTimeout(function waitForGlobals() {
			if (globalThis.Tracker) {
				// Add any Meteor APIs as needed here, and in imports/ui/main.jsx
				Blaze = globalThis.Blaze
				Tracker = globalThis.Tracker
				Template = globalThis.Template
				Mongo = globalThis.Mongo

				resolve()
			} else setTimeout(waitForGlobals)
		}),
	),
)

await Promise.all(promises)
