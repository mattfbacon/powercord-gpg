const { React } = require('powercord/webpack');
const { TextInput } = require('powercord/components/settings');

module.exports = ({ getSetting, updateSetting }) => (
	<div>
		<TextInput onChange={(val) => updateSetting('gpg', val)} defaultValue={getSetting('gpg', 'gpg')} required={true} disabled={false} note="Name of the gpg executable on your system">
			GPG Binary
		</TextInput>
		<TextInput onChange={(val) => updateSetting('sender-fingerprint', val)} defaultValue={getSetting('sender-fingerprint', '')} required={true} disabled={false} note="Fingerprint of your personal public key (secret key must be available)">
			Sender PGP Key
		</TextInput>
	</div>
);
