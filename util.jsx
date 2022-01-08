const child_process = require('child_process');

/**
 * Execute a process, passing the given string to stdin, and capturing stdout. Promise rejects on non-zero exit code.

 * @param {string} executable - The name of the executable
 * @param {string[]} args - The arguments to the executable
 * @param {string} stdin - The string to pass to stdin
 * @returns {Promise<string>} - Resolves with process's stdout if successful, or rejects with the process's stderr if not
 */
async function stdinToStdout(executable, args, stdin) {
	return new Promise(function (resolve, reject) {
		let stdout = '';
		let stderr = '';
		const proc = child_process.spawn(executable, args, {
			env: Object.create(process.env, { LANG: { value: 'C' } }),
		});
		proc.stdin.end(stdin);
		proc.stdout.on('data', (data) => {
			stdout += data;
		});
		proc.stderr.on('data', (data) => {
			stderr += data;
		});
		proc.on('close', (code) => {
			if (code == 0) {
				resolve({ stdout, stderr });
			} else {
				reject(stderr);
			}
		});
	});
}

module.exports.stdinToStdout = stdinToStdout;
