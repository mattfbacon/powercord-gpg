import * as Constants from './constants';
import type { ProcessOutput } from './util';
import { stdinToStdout } from './util';

export type Message = string;
export type PublicKey = string;
export type Fingerprint = string;

/**
 * @param {string} content - The raw string that may or may not be an encrypted message
 * @returns {bool} - whether the string is an encrypted message
 */
export function isMessage(content: string): content is Message {
	return content.startsWith(Constants.PGP_MESSAGE_HEADER) && content.endsWith(Constants.PGP_MESSAGE_FOOTER);
}
/**
 * @param {string} content - The raw string that may or may not be a public key
 * @returns {bool} - whether the string is a public key
 */
export function isPublicKey(content: string): content is PublicKey {
	return content.startsWith(Constants.PGP_PUBLIC_KEY_HEADER) && content.endsWith(Constants.PGP_PUBLIC_KEY_FOOTER);
}
/**
 * @param {string} raw - The raw string that may or may not be a fingerprint
 * @returns {bool} - whether the string is a fingerprint
 */
export function isFingerprint(content: string): content is Fingerprint {
	return content.match(/[0-9A-F]{40}/) !== null;
}

function makeRecipients(...fingerprints: Fingerprint[]) {
	return fingerprints.flatMap((fingerprint) => ['--recipient', fingerprint]);
}

export async function decrypt(gpgPath: string, encrypted: Message): Promise<ProcessOutput> {
	return stdinToStdout(gpgPath, ['-d', '--batch'], encrypted);
}
export async function encrypt(gpgPath: string, plain: string, recipients: Fingerprint[]): Promise<ProcessOutput> {
	const baseArgs = ['-sea', '--batch', '--always-trust'];
	return stdinToStdout(gpgPath, baseArgs.concat(makeRecipients(...recipients)), plain);
}

const friendlyErrorMessages: Map<string, string> = new Map([['no secret key', 'No secret key to decrypt this message']]);
/**
 * Make a friendly error message
 * @param {string} rawError - The raw error message from GPG
 * @returns {string}
 */
export function friendlyError(rawError: string): string {
	const messageNames = rawError.match(/^gpg: (en|de)cryption failed: (.+)$/im);
	if (messageNames) {
		const friendly = friendlyErrorMessages.get(messageNames[messageNames.length - 1].toLowerCase());
		if (friendly) {
			return friendly;
		}
	}
	const lines = rawError.split('\n');
	return lines[lines.length - 1];
}
