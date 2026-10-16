# Vendored Three.js runtime

This directory contains the minimal ES-module subset of **Three.js 0.186.1**
used by Kristal Yapı. The files are taken unchanged from the official npm
package [three@0.186.1](https://www.npmjs.com/package/three/v/0.186.1), not
downloaded from a CDN when the editor runs.

Original package: `https://registry.npmjs.org/three/-/three-0.186.1.tgz`

SHA-512 package integrity (npm registry):

`sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==`

Included paths:

- `build/three.core.js`
- `build/three.module.js`
- `examples/jsm/controls/OrbitControls.js`
- `examples/jsm/geometries/ConvexGeometry.js`
- `examples/jsm/math/ConvexHull.js` (transitive ConvexGeometry dependency)
- `LICENSE` (MIT license)

All three-dimensional editor imports resolve through the relative import map
in `index.html`. GitHub Pages copies this directory into `public/vendor/three`.
When upgrading, update the package version, preserve the official MIT license,
verify the published integrity hash, and run the full real-browser/WebGL tests.
