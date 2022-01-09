import child_process = require('child_process');

export interface ProcessOutput {
	stdout: string;
	stderr: string;
}

export async function stdinToStdout(executable: string, args: string[], stdin: string): Promise<ProcessOutput> {
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
