// Small hack: we're using the pre-built Amazon Sumerian lib, pasted in this
// repo as host.three.js, which relies on a legacy THREE global variable for
// Three.js APIs. For now, we add Three.js APIs to a global THREE variable,
// while otherwise importing Three.js into our own code using modern `import`
// syntax instead of relying on the global variable.

import * as THREE from 'three'

globalThis.THREE = { ...THREE }
