const { React, getModule, messages, getModuleByDisplayName } = require('powercord/webpack');
const { Plugin } = require('powercord/entities');
const Injector = require('powercord/injector');
const child_process = require('child_process');

const Settings = require('./Settings.jsx');

const INJECTION_NAME_RX = 'gpg-plugin-receive';
const INJECTION_NAME_TX = 'gpg-plugin-send';
const INJECTION_NAME_UPDATECHID = 'gpg-plugin-chidup';
const PGP_MESSAGE_HEADER = "-----BEGIN PGP MESSAGE-----\n\n";
const PGP_MESSAGE_FOOTER = "\n-----END PGP MESSAGE-----";
const PGP_PUBLIC_KEY_HEADER = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\n";
const PGP_PUBLIC_KEY_FOOTER = "\n-----END PGP PUBLIC KEY BLOCK-----";

/**
 * Execute a process, passing the given string to stdin, and capturing stdout. Promise rejects on non-zero exit code.

 * @param {string} executable - The name of the executable
 * @param {string[]} args - The arguments to the executable
 * @param {string} stdin - The string to pass to stdin
 * @returns {Promise<string>} - Resolves with process's stdout if successful, or rejects with the process's stderr if not
 */
async function stdinToStdout(executable, args, stdin) {
	console.log("call:", executable, args, stdin);
	return new Promise(function (resolve, reject) {
		let stdout = '';
		let stderr = '';
		const proc = child_process.spawn(executable, args, {
			env: Object.create(process.env, { LANG: { value: "C" } }),
		});
		proc.stdin.end(stdin);
		proc.stdout.on('data', data => { stdout += data; })
		proc.stderr.on('data', data => { stderr += data; })
		proc.on('close', (code) => {
			if (code == 0) {
				resolve({ stdout, stderr });
			} else {
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

		this.inject();
	}

	pluginWillUnload() {
		powercord.api.settings.unregisterSettings(this.entityID);
		this.uninject();
	}

	async inject() {
		const parser = await getModule(['parse', 'parseTopic']);
		Injector.inject(INJECTION_NAME_RX, parser.defaultRules.codeBlock, 'react', (args, res) => {
			return this.injectRxImpl(args, res);
		});

		Injector.inject(INJECTION_NAME_TX, messages, 'sendMessage', (args) => {
			return this.injectTxImpl(args);
		}, true);

		const PrivateChannel = await getModuleByDisplayName('PrivateChannel');
		Injector.inject(INJECTION_NAME_UPDATECHID, PrivateChannel.prototype, 'render', (args, res) => {
			const re = /\@me\/(.*)/;
			console.log(re.exec(window.location.href)[1]);
			return res;
		})
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

	injectRxImpl(args, res) {
		/**
		 * @type {string}
		 */
		const content = args[0].content;
		if (GPG.isPgpMessage(content)) {
			return (<GPGContainer rawContent={content} gpgPath={this.gpgPath()} plugin={this} />);
		} else if (GPG.isPgpPublicKey(content)) {
			const render = res.props.render;
			res.props.render = (props) => {
				const elem = render(props);
				elem.children.push((<a href="javascript:void;">Add key</a>));
				return elem;
			};
		} else {
			return res;
		}
	}

	injectTxImpl(args) {
		stdinToStdout(this.gpgPath(), ['-sea', '--batch', '--always-trust', '-r', this.settings.get('sender-fingerprint'), '-r', this.settings.get('publicKeys')["879871966394339369"]], args[1].content).then(({stdout: encrypted, stderr: log}) => {
			args[1].content = "" + "```\n" + encrypted + "\n```";
			console.log(encrypted)
			console.log(log);
		}).catch(err => {
			console.log("Failed to encrypt");
			console.log(err);
		});
	
		return args;
	}
}




class GPGContainer extends React.Component {
	async decryptPgp() {
		return stdinToStdout(this.props.gpgPath, ['--decrypt'], this.props.rawContent);
	}

	/**
	 * Make a friendly error message
	 * @param {string} raw_error - The raw error message from GPG
	 * @returns {string}
	 */
	static friendlyError(raw_error) {
		raw_error = raw_error.toLowerCase();
		if (raw_error.includes("decryption failed: no secret key")) {
			return "No secret key to decrypt this message";
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
		this.state = { done: false, };
	}

	componentDidMount() {
		this.decryptPgp().then(({ stdout: decrypted, stderr: log }) => {
			this.setState({
				done: true,
				succeeded: true,
				content: GPGContainer.sanitize(decrypted),
				log,
			});
		}).catch(err => {
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
				content = (<span style={{ "white-space": "normal" }}>
					<a href="javascript:void;" onClick={this.toggleInfo.bind(this)}>
						<i class="fas fa-lock" style={{ color: "green" }}></i>
					</a>
					&nbsp;
					<span dangerouslySetInnerHTML={{ __html: this.state.content }} />
				</span>);
			} else {
				content = (<span style={{
					color: "red"
				}}>
					{this.state.friendlyError}
					&nbsp;
					<a href="javascript:void;" onClick={this.toggleInfo.bind(this)}>{this.state.info ? "Less" : "More"}</a>
				</span>);
			}
			return (<>
				{content}
				{this.state.info && <div>
					<span>This message was encrypted with PGP. The original message content is as follows:</span>
					<pre><code class={["hljs"]}>{this.props.rawContent}</code></pre>
					<span>GPG command output:</span>
					<pre><code class={["hljs"]}>{this.state.log}</code></pre>
					<a href="javascript:void;" onClick={this.toggleInfo.bind(this)}>Close</a>
				</div>}
			</>)
		} else {
			return (<span>Decrypting...</span>);
		}
	}
}
