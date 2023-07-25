# Requirements to dev locally

- Install [Node.js](https://nodejs.org)
- Install [Meteor](https://meteor.com)

# Setup:

- Visit https://github.com/organizations/autonomys/settings/variables/actions to see tokens needed for the app.
- Copy `settings.sample.json` to `settings.json`
- Paste tokens in `settings.json` as specified in there, do not commit `settings.json` to the repo (it is gitignored).

FIXME: Get a new AWS key (it may be leaked already) and make it not public within
`settings.json` (i.e. make it not visible on the client side).

# Run:

Once keys are in `settings.json`, the app will function. Run it with:

```
npm start
```

This runs the full-stack Meteor app in dev mode.
