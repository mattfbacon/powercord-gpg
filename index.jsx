const { React, getModule, messages, getModuleByDisplayName } = require('powercord/webpack');
const { Plugin } = require('powercord/entities');
const Injector = require('powercord/injector');
const child_process = require('child_process');

const Settings = require('./Settings.jsx');

const INJECTION_NAME_RX = 'gpg-plugin-receive';
const INJECTION_NAME_TX = 'gpg-plugin-send';
const INJECTION_NAME_UPDATECHID = 'gpg-plugin-chidup';
const PGP_MESSAGE_HEADER = '-----BEGIN PGP MESSAGE-----\n\n';
const PGP_MESSAGE_FOOTER = '\n-----END PGP MESSAGE-----';
const PGP_PUBLIC_KEY_HEADER = '-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n';
const PGP_PUBLIC_KEY_FOOTER = '\n-----END PGP PUBLIC KEY BLOCK-----';

/**
 * Execute a process, passing the given string to stdin, and capturing stdout. Promise rejects on non-zero exit code.

 * @param {string} executable - The name of the executable
 * @param {string[]} args - The arguments to the executable
 * @param {string} stdin - The string to pass to stdin
 * @returns {Promise<string>} - Resolves with process's stdout if successful, or rejects with the process's stderr if not
 */
async function stdinToStdout(executable, args, stdin) {
	const name = arguments.callee.name;
	console.log(name, 'start', executable, args, stdin);
	return new Promise(function (resolve, reject) {
		let stdout = '';
		let stderr = '';
		const proc = child_process.spawn(executable, args, {
			env: Object.create(process.env, { LANG: { value: 'C' } }),
		});
		proc.stdin.end(stdin);
		proc.stdout.on('data', (data) => {
			console.log(name, 'stdout', data);
			stdout += data;
		});
		proc.stderr.on('data', (data) => {
			console.log(name, 'stderr', data);
			stderr += data;
		});
		proc.on('close', (code) => {
			console.log(name, 'close', 0);
			if (code == 0) {
				console.log(name, 'resolve');
				resolve({ stdout, stderr });
			} else {
				console.log(name, 'reject');
				reject(stderr);
			}
		});
	});
}

module.exports = class GPG extends Plugin {
	gpgPath() {
		return this.settings.get('gpg', 'gpg');
	}

	startPlugin() {
		powercord.api.settings.registerSettings(this.entityID, {
			category: this.entityID,
			label: 'GPG',
			render: Settings,
		});
		powercord.api.commands.registerCommand({
			command: 'gpg',
			description: 'Configure channel-specific GPG settings',
			usage: '{c} {encrypt [true|false|toggle]|recipients [add|remove|clear]}',
			executor: this.handleCommand.bind(this),
			autocomplete: this.handleAutocomplete.bind(this),
		});

		this.inject();
	}

	pluginWillUnload() {
		powercord.api.settings.unregisterSettings(this.entityID);
		powercord.api.commands.unregisterCommand('gpg');
		this.uninject();
	}

	/**
	 * @returns {{ recipientKeys: Set<string>, encrypt: bool }}
	 */
	getChannelConfig() {
		let container = this.settings.get('channel-config');
		if (!container || Object.prototype.toString.call(container) !== '[object Map]') {
			container = new Map();
			this.settings.set('channel-config', container);
		}
		let config = container.get(this.currentChannel);
		if (!config || typeof config != 'object' || !config.hasOwnProperty('recipientKeys') || !config.hasOwnProperty('encrypt')) {
			config = {
				recipientKeys: new Set(),
				encrypt: false,
			};
			container.set(this.currentChannel, config);
		}
		return config;
	}

	async handleEncryptCommand(subcommand) {
		const config = this.getChannelConfig();
		switch (subcommand) {
			case 'true':
			case 'enable':
			case 'on':
			case 'yes':
				config.encrypt = true;
				break;
			case 'false':
			case 'disable':
			case 'off':
			case 'no':
				config.encrypt = false;
				break;
			case 'toggle':
				config.encrypt = !config.encrypt;
				break;
			case undefined:
				return {
					send: false,
					result: `Encryption is currently **${this.getChannelConfig().encrypt ? 'enabled' : 'disabled'}** for this channel.`,
				};
			default:
				return {
					send: false,
					result: `Unknown subcommand ${subcommand}`,
				};
		}
		return {
			send: false,
			result: `Encryption ${config.encrypt ? 'enabled' : 'disabled'}`,
		};
	}
	async handleRecipientsCommand(subcommand, ...args) {
		const config = this.getChannelConfig();
		switch (subcommand) {
			case 'add':
				for (const fingerprint of args) {
					if (!GPG.isFingerprint(fingerprint)) {
						return {
							send: false,
							result: `Invalid fingerprint \`${fingerprint}\`.`,
						};
					}
				}
				for (const fingerprint of args) {
					config.recipientKeys.add(fingerprint);
				}
				return { send: false, result: 'Success!' };
			case 'remove':
				for (const fingerprint of args) {
					config.recipientKeys.delete(fingerprint);
				}
				return { send: false, result: 'Success!' };
			case 'clear':
				config.recipientKeys.clear();
				return { send: false, result: 'Success!' };
			case undefined:
				if (config.recipientKeys.size > 0) {
					return { send: false, result: `The current recipient fingerprints are \`\`\`\n${[...config.recipientKeys.values()].join('\n')}\n\`\`\`` };
				} else {
					return { send: false, result: 'There are currently no recipients.' };
				}
			default:
				return { send: false, result: `Unknown subcommand ${subcommand}` };
		}
	}
	async handleCommand(args, context) {
		const subcommand = args[0];
		switch (subcommand) {
			case 'encrypt':
			case 'encryption':
				return this.handleEncryptCommand(args[1]);
			case 'recipients':
				return this.handleRecipientsCommand(...args.slice(1));
			case undefined:
				return { send: false, result: `Missing subcommand ${subcommand}` };
			default:
				return { send: false, result: `Unknown subcommand ${subcommand}` };
		}
	}
	handleAutocomplete(args) {
		const lastArg = args.slice(-1)[0];
		if (lastArg === null || lastArg === undefined) {
			return;
		}
		const completions = {
			encrypt: ['', 'true', 'false', 'toggle'],
			recipients: ['', 'add', 'remove', 'clear'],
		};
		completions.encryption = completions.encrypt;
		const headers = ['Command', 'Subcommand'];
		const options = (() => {
			switch (args.length) {
				case 1:
					return Object.keys(completions);
				case 2:
					return completions[args[0]];
				default:
					return [];
			}
		})();
		const header = headers[args.length - 1];
		if (!options || !header) {
			return;
		}
		const commands = options
			.filter((option) => option.startsWith(lastArg))
			.map((option) => ({
				command: option,
			}));
		return {
			header,
			commands,
		};
	}

	async inject() {
		const parser = await getModule(['parse', 'parseTopic']);
		Injector.inject(INJECTION_NAME_RX, parser.defaultRules.codeBlock, 'react', (args, res) => {
			return this.injectRxImpl(args, res);
		});

		Injector.inject(
			INJECTION_NAME_TX,
			messages,
			'sendMessage',
			(args) => {
				return this.injectTxImpl(args);
			},
			true,
		);

		const PrivateChannel = await getModuleByDisplayName('PrivateChannel');
		Injector.inject(INJECTION_NAME_UPDATECHID, PrivateChannel.prototype, 'render', (args, res) => {
			const re = /\@me\/(.*)/;
			this.currentChannel = re.exec(window.location.href)[1];
			return res;
		});
	}

	uninject() {
		Injector.uninject(INJECTION_NAME_RX);
		Injector.uninject(INJECTION_NAME_TX);
		Injector.uninject(INJECTION_NAME_UPDATECHID);
	}

	static isPgpMessage(content) {
		return content.startsWith(PGP_MESSAGE_HEADER) && content.endsWith(PGP_MESSAGE_FOOTER);
	}
	static isPgpPublicKey(content) {
		return content.startsWith(PGP_PUBLIC_KEY_HEADER) && content.endsWith(PGP_PUBLIC_KEY_FOOTER);
	}
	static makeRecipients(...fingerprints) {
		return fingerprints.flatMap((fingerprint) => ['--recipient', fingerprint]);
	}
	/**
	 * @param {string} raw - The raw string that may or may not be a fingerprint
	 * @returns {bool} - whether the string is a fingerprint
	 */
	static isFingerprint(raw) {
		return raw.match(/[0-9A-F]{40}/) !== null;
	}

	injectRxImpl(args, res) {
		/**
		 * @type {string}
		 */
		const content = args[0].content;
		if (GPG.isPgpMessage(content)) {
			return <GPGContainer rawContent={content} gpgPath={this.gpgPath()} plugin={this} />;
		} else if (GPG.isPgpPublicKey(content)) {
			const render = res.props.render;
			res.props.render = (props) => {
				const elem = render(props);
				elem.children.push(<a href="javascript:void;">Add key</a>);
				return elem;
			};
		} else {
			return res;
		}
	}

	injectTxImpl(args) {
		if (args[1].shibboleth) {
			return args;
		}

		const channelId = args[0];

		const senderKey = this.settings.get('sender-fingerprint');
		const { recipientKeys, encrypt } = this.getChannelConfig();
		if (!encrypt) {
			return args;
		}

		const baseArgs = ['-sea', '--batch', '--always-trust'];
		stdinToStdout(this.gpgPath(), baseArgs.concat(GPG.makeRecipients(senderKey, ...recipientKeys)), args[1].content)
			.then(async ({ stdout: encrypted }) => {
				const { sendMessage } = await getModule(['sendMessage']);
				sendMessage(channelId, { content: '```\n' + encrypted + '\n```', shibboleth: true });
			})
			.catch((err) => {
				this.error('Failed to encrypt', err);
			});

		return false;
	}
};

class GPGContainer extends React.Component {
	async decryptPgp() {
		return stdinToStdout(this.props.gpgPath, ['-d', '--batch'], this.props.rawContent);
	}

	/**
	 * Make a friendly error message
	 * @param {string} raw_error - The raw error message from GPG
	 * @returns {string}
	 */
	static friendlyError(raw_error) {
		raw_error = raw_error.toLowerCase();
		if (raw_error.includes('decryption failed: no secret key')) {
			return 'No secret key to decrypt this message';
		} else {
			const lines = raw_error.split('\n');
			return lines[lines.length - 1];
		}
	}
	static sanitize(raw) {
		return raw.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll('\n', '<br>');
	}

	constructor(props) {
		super(props);
		this.state = { done: false };
	}

	componentDidMount() {
		this.decryptPgp()
			.then(({ stdout: decrypted, stderr: log }) => {
				this.setState({
					done: true,
					succeeded: true,
					content: GPGContainer.sanitize(decrypted),
					log,
				});
			})
			.catch((err) => {
				this.setState({
					done: true,
					succeeded: false,
					log: err,
					friendlyError: GPGContainer.friendlyError(err),
				});
			});
	}

	toggleInfo() {
		this.setState({ info: !this.state.info });
	}

	render() {
		if (this.state.done) {
			let content;
			if (this.state.succeeded) {
				content = (
					<span style={{ 'white-space': 'normal' }}>
						<a href="javascript:void;" onClick={this.toggleInfo.bind(this)}>
							<i class="fas fa-lock" style={{ color: 'green' }}></i>
						</a>
						&nbsp;
						<span dangerouslySetInnerHTML={{ __html: this.state.content }} />
					</span>
				);
			} else {
				content = (
					<span
						style={{
							color: 'red',
						}}
					>
						{this.state.friendlyError}
						&nbsp;
						<a href="javascript:void;" onClick={this.toggleInfo.bind(this)}>
							{this.state.info ? 'Less' : 'More'}
						</a>
					</span>
				);
			}
			return (
				<>
					{content}
					{this.state.info && (
						<div>
							<span>This message was encrypted with PGP. The original message content is as follows:</span>
							<pre>
								<code class={['hljs']}>{this.props.rawContent}</code>
							</pre>
							<span>GPG command output:</span>
							<pre>
								<code class={['hljs']}>{this.state.log}</code>
							</pre>
							<a href="javascript:void;" onClick={this.toggleInfo.bind(this)}>
								Close
							</a>
						</div>
					)}
				</>
			);
		} else {
			return <span>Decrypting...</span>;
		}
	}
}
