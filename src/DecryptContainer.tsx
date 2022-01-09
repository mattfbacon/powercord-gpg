const { React } = require('powercord/webpack');
import * as PGP from './PGP';

export interface Props {
	rawContent: string;
	gpgPath: string;
	plugin: any;
}

export default class DecryptContainer extends React.Component<Props> {
	static sanitize(raw: string): string {
		return raw.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll('\n', '<br>');
	}

	constructor(props: Props) {
		super(props);
		this.state = { done: false };
	}

	componentDidMount() {
		PGP.decrypt(this.props.gpgPath, this.props.rawContent)
			.then(({ stdout: decrypted, stderr: log }) => {
				this.setState({
					done: true,
					succeeded: true,
					content: DecryptContainer.sanitize(decrypted),
					log,
				});
			})
			.catch((err) => {
				this.setState({
					done: true,
					succeeded: false,
					log: err,
					friendlyError: PGP.friendlyError(err),
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
					<span style={{ whiteSpace: 'normal' }}>
						<a href="javascript:void(0);" onClick={this.toggleInfo.bind(this)}>
							<i className="fas fa-lock" style={{ color: 'green' }}></i>
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
						}}>
						{this.state.friendlyError}
						&nbsp;
						<a href="javascript:void(0);" onClick={this.toggleInfo.bind(this)}>
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
								<code className="hljs">{this.props.rawContent}</code>
							</pre>
							<span>GPG command output:</span>
							<pre>
								<code className="hljs">{this.state.log}</code>
							</pre>
							<a href="javascript:void(0);" onClick={this.toggleInfo.bind(this)}>
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
