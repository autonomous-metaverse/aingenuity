import { Tracker } from 'meteor/tracker'
import { Blaze } from 'meteor/blaze'
import { Template } from 'meteor/templating'
import { Mongo } from 'meteor/mongo'

// Expose Meteor globals for the ES Modules re-export in public/modules/meteor.js
globalThis.Tracker = Tracker
globalThis.Blaze = Blaze
globalThis.Template = Template
globalThis.Mongo = Mongo
