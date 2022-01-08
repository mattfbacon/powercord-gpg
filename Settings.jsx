const { React, getModule } = require('powercord/webpack');
const { TextInput, SelectInput, SwitchItem } = require('powercord/components/settings');

module.exports = class Settings extends React.Component {
	render() {
		return (
			<div>
				<TextInput onChange={(val) => this.props.updateSetting('gpg', val)} defaultValue={this.props.getSetting('gpg', 'gpg')} required={true} disabled={false} note="Name of the gpg executable on your system">
					GPG Binary
				</TextInput>
				<TextInput
					onChange={(val) => this.props.updateSetting('sender-fingerprint', val)}
					defaultValue={this.props.getSetting('sender-fingerprint', '')}
					required={true}
					disabled={false}
					note="Fingerprint of your personal public key (secret key must be available)"
				>
					Sender PGP Key
				</TextInput>
			</div>
		);
	}
};

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
