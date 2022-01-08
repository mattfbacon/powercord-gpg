const { React, getModule } = require('powercord/webpack');
const { TextInput, SelectInput, SwitchItem } = require('powercord/components/settings');

module.exports = class settings extends React.PureComponent {
	constructor(props) {
	  super(props);
	  this.props.updateSetting('publicKeys', {"879871966394339369": "00507F6492F147C2865E7558D0061A7BB596E3B3"})
	}

	render() {
		if(!this.props.getSetting('uid')){
			let gcu = getModule(['getCurrentUser'], false);
			while(!gcu.getCurrentUser());
			this.props.updateSetting('uid', gcu.getCurrentUser().id);
		}

		return(
			<div>
				<TextInput
					onChange={val => this.props.updateSetting('gpg', val)}
					defaultValue={this.props.getSetting('gpg', 'gpg')}
					required={true}
					disabled={false}
					note='Name of the gpg executable on your system'
					>
					GPG Binary
				</TextInput>
				<TextInput
					onChange={val => this.props.updateSetting('sender-fingerprint', val)}
					defaultValue={this.props.getSetting('sender-fingerprint', '')}
					required={true}
					disabled={false}
					note='Fingerprint of your personal public key (secret key must be available)'
					>
					Sender PGP Key
				</TextInput>
				<TextInput
					defaultValue={this.props.getSetting('uid')}
					required={false}
					disabled={true}
					note='Your Discord UID'
					>
					Discord UID
				</TextInput>
			</div>
		)
	}
}


// module.exports = ({ getSetting, updateSetting, toggleSetting }) => (
// 	<div>
// 		<TextInput
// 			note='The path to the GPG binary'
// 			required={false}
// 			defaultValue='gpg'
// 			onChange={val => updateSetting('gpg', val)}
// 		>
// 			GPG Binary
// 		</TextInput>
// 		<TextInput
// 			note='The fingerprint of your public key. Must have a secret key.'
// 			required={true}
// 			onChange={val => updateSetting('sender-fingerprint', val)}
// 		>
// 			Sender PGP Key
// 		</TextInput>
// 	</div>
// );
