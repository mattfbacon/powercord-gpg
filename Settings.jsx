const { React } = require('powercord/webpack');
const { TextInput, SelectInput, SwitchItem } = require('powercord/components/settings');

module.exports = ({ getSetting, updateSetting, toggleSetting }) => (
	<div>
		<TextInput
			note='The path to the GPG binary'
			required={false}
			defaultValue='gpg'
			onChange={val => updateSetting('gpg', val)}
		>
			GPG Binary
		</TextInput>
		<TextInput
			note='The fingerprint of your public key. Must have a secret key.'
			required={true}
			onChange={val => updateSetting('sender-fingerprint', val)}
		>
			Sender PGP Key
		</TextInput>
	</div>
);
