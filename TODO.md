Features:

- [ ] Add voice-to-text support.
- [ ] Add FPS controls
- [ ] VR Mode

- [ ] Make the experience a little more aesthetic (rather than simple UI at the top left)

Code/Infra:

- [ ] split out Three.js lib from Sumerian bundle
- [ ] Make the AWS key not public (get a new key!), and use aws on the backend instead of in the client.
- [ ] Look at getting text-to-audio from other sources (openai whisper?)

Later:

- [ ] Come up with a plan to make the system usable, so it isn't just a sample
      app, but something easy to plug into a Three.js app with Lume, and later one a
      Babylon app once we have an alternative renderer.
- [ ] Try getting a custom Ready Player Me avatar and see what it takes to map visemes to that instead of to Amazon's models.
