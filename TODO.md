- [x] Don't serve AWS token from public folder, but from backend.
- [x] Fund openai account, ensure it works (it's just a send-text-get-text API, saving for later, wiring up the graphics stuff first)
- [ ] Make the AWS key not public (get a new key!), and use aws on the backend instead of in the client.
- [ ] Add voice-to-text support.
- [ ] Make the experience a little more aesthetic (rather than simple UI at the top left)
- [ ] Add FPS controls
- [ ] Try getting a custom Ready Player Me avatar and see what it takes to map visemes to that instead of to Amazon's models.
- [ ] Look at getting text-to-audio from other sources (openai whisper?)

Code:

- [ ] split out Three.js lib from Sumerian bundle

Next:

- [ ] Come up with a plan to make the system usable, so it isn't just a sample
      app, but something easy to plug into a Three.js app with Lume, and later one a
      Babylon app once we have an alternative renderer.
