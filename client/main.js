import { Tracker } from 'meteor/tracker'
import { Blaze } from 'meteor/blaze'
import { Template } from 'meteor/templating'

// Expose Meteor globals for the ES Modules re-export in public/modules/meteor.js
globalThis.Tracker = Tracker
globalThis.Blaze = Blaze
globalThis.Template = Template
