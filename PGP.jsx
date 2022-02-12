const Constants = require('./constants');
const { stdinToStdout } = require('./util');

/**
 * @param {string} content - The raw string that may or may not be an encrypted message
 * @returns {bool} - whether the string is an encrypted message
 */
function isMessage(content) {
	return content.startsWith(Constants.PGP_MESSAGE_HEADER) && content.endsWith(Constants.PGP_MESSAGE_FOOTER);
}
/**
 * @param {string} content - The raw string that may or may not be a public key
 * @returns {bool} - whether the string is a public key
 */
function isPublicKey(content) {
	return content.startsWith(Constants.PGP_PUBLIC_KEY_HEADER) && content.endsWith(Constants.PGP_PUBLIC_KEY_FOOTER);
}
/**
 * @param {string} raw - The raw string that may or may not be a fingerprint
 * @returns {bool} - whether the string is a fingerprint
 */
function isFingerprint(content) {
	return content.match(/[0-9A-F]{40}/) !== null;
}

function makeRecipients(...fingerprints) {
	return fingerprints.flatMap((fingerprint) => ['--recipient', fingerprint]);
}

async function decrypt(gpgPath, encrypted) {
	return stdinToStdout(gpgPath, ['-d', '--batch'], encrypted);
}
async function encrypt(gpgPath, plain, recipients) {
	const baseArgs = ['-sea', '--batch', '--always-trust'];
	return stdinToStdout(gpgPath, baseArgs.concat(makeRecipients(...recipients)), plain);
}
async function addPublicKey(gpgPath, key) {
	const baseArgs = ['--import', '--batch'];
	return stdinToStdout(gpgPath, baseArgs, key);
}
async function exportPublicKey(gpgPath, fingerprint) {
	const baseArgs = ['--export', '--armor', '--batch'];
	return stdinToStdout(gpgPath, fingerprint ? baseArgs.concat(fingerprint) : baseArgs, '');
}

const friendlyErrorMessages = new Map([['no secret key', 'No secret key to decrypt this message']]);
/**
 * Make a friendly error message
 * @param {string} rawError - The raw error message from GPG
 * @returns {string}
 */
function friendlyError(rawError) {
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

module.exports = {
	isMessage,
	isPublicKey,
	addPublicKey,
	exportPublicKey,
	isFingerprint,
	decrypt,
	encrypt,
	friendlyError,
};
