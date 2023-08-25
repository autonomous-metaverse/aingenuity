/**
 * Load and run a non-module script given its URL. (For module scripts, use the
 * built-in `import()` function.)
 *
 * @param {string} url
 */
export async function loadNonModuleScript(url) {
	const script = document.createElement('script')
	const code = await fetch(url).then(r => r.text())
	script.textContent = code
	document.body.append(script)
}
