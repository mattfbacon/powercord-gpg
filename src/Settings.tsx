const { React } = require('powercord/webpack');
const { TextInput } = require('powercord/components/settings');

export default (props) => (
	<div>
		<TextInput onChange={(val) => props.updateSetting('gpg', val)} defaultValue={props.getSetting('gpg', 'gpg')} required={true} disabled={false} note="Name of the gpg executable on your system">
			GPG Binary
		</TextInput>
		<TextInput
			onChange={(val) => props.updateSetting('sender-fingerprint', val)}
			defaultValue={props.getSetting('sender-fingerprint', '')}
			required={true}
			disabled={false}
			note="Fingerprint of your personal public key (secret key must be available)">
			Sender PGP Key
		</TextInput>
	</div>
);
