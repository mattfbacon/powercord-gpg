import { React, getModule, messages, getModuleByDisplayName } from 'powercord/webpack';
import { Plugin } from 'powercord/entities';
import Injector = require('powercord/injector');

import Settings from './Settings';
import DecryptContainer from './DecryptContainer';
import * as Constants from './constants';
import * as PGP from './PGP';

module.exports = class PGPPlugin extends Plugin {
	currentChannel: string | null | undefined;

	gpgPath() {
		return this.settings.get('gpg', 'gpg');
	}

	startPlugin() {
		powercord.api.settings.registerSettings(this.entityID, {
			category: this.entityID,
			label: 'PGP',
			render: Settings,
		});
		powercord.api.commands.registerCommand({
			command: 'pgp',
			description: 'Configure channel-specific PGP settings',
			usage: '{c} {encrypt [true|false|toggle]|recipients [add|remove|clear]}',
			executor: this.handleCommand.bind(this),
			autocomplete: this.handleAutocomplete.bind(this),
		});

		this.inject();
	}

	pluginWillUnload() {
		powercord.api.settings.unregisterSettings(this.entityID);
		powercord.api.commands.unregisterCommand('pgp');
		this.uninject();
	}

	/**
	 * @returns {{ recipientKeys: Set<string>, encrypt: bool }}
	 */
	getChannelConfig() {
		let container: Map<string, any> = this.settings.get('channel-config');
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

	async handleEncryptCommand(subcommand?: string): powercord.api.commands.CommandResult {
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
	async handleRecipientsCommand(subcommand: string, ...args: string[]) {
		const config = this.getChannelConfig();
		switch (subcommand) {
			case 'add':
				for (const fingerprint of args) {
					if (!PGP.isFingerprint(fingerprint)) {
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
	async handleCommand(args: string[], _context: unknown) {
		const subcommand = args[0];
		switch (subcommand) {
			case 'encrypt':
			case 'encryption':
				return this.handleEncryptCommand(args[1]);
			case 'recipients':
				return this.handleRecipientsCommand(args[1], ...args.slice(2)); // typescript doesn't like ...args.slice(1)
			case undefined:
				return { send: false, result: `Missing subcommand ${subcommand}` };
			default:
				return { send: false, result: `Unknown subcommand ${subcommand}` };
		}
	}
	handleAutocomplete(args: string[]) {
		const lastArg = args.slice(-1)[0];
		if (lastArg === null || lastArg === undefined) {
			return;
		}
		const completions = new Map([
			['encrypt', ['', 'true', 'false', 'toggle']],
			['encryption', ['', 'true', 'false', 'toggle']],
			['recipients', ['', 'add', 'remove', 'clear']],
		]);
		const headers = ['Command', 'Subcommand'];
		const options = (() => {
			switch (args.length) {
				case 1:
					return Object.keys(completions);
				case 2:
					return completions.get(args[0]) ?? [];
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
		Injector.inject(Constants.INJECTION_NAME_RX, parser.defaultRules.codeBlock, 'react', this.injectRxImpl);

		Injector.inject(Constants.INJECTION_NAME_TX, messages, 'sendMessage', this.injectTxImpl, true);

		const PrivateChannel = await getModuleByDisplayName('PrivateChannel');
		Injector.inject(Constants.INJECTION_NAME_UPDATECHID, PrivateChannel.prototype, 'render', (args, res) => {
			const re = /\@me\/(.*)/;
			const match = re.exec(window.location.href);
			if (!match) {
				this.currentChannel = null;
			} else {
				this.currentChannel = match[1];
			}
			return res;
		});
	}

	uninject() {
		Injector.uninject(Constants.INJECTION_NAME_RX);
		Injector.uninject(Constants.INJECTION_NAME_TX);
		Injector.uninject(Constants.INJECTION_NAME_UPDATECHID);
	}

	injectRxImpl(args: any, res: React.Component): React.Component {
		/**
		 * @type {string}
		 */
		const content = args[0].content;
		if (PGP.isMessage(content)) {
			return <DecryptContainer rawContent={content} gpgPath={this.gpgPath()} plugin={this} />;
		} else if (PGP.isPublicKey(content)) {
			const render = res.props.render;
			res.props.render = (props: unknown) => {
				const elem = render(props);
				elem.children.push(<a href="javascript:void(0);">Add key</a>);
				return elem;
			};
			return res;
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

		PGP.encrypt(this.gpgPath(), args[0].content, [senderKey, ...recipientKeys])
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
