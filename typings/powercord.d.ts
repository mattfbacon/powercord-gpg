declare module 'powercord/webpack' {
	export { default as React } from 'react';
	// this type could probably be better if we could somehow put moduleNames as the keys of the record
	export function getModule(moduleNames: string[]): Promise<Record<string, any>>;
	export function getModuleByDisplayName(name: string): Promise<any>;
	export const messages: any;
}

declare module 'powercord/entities' {
	interface Settings extends Map<string, any> {
		get(key: string): any | undefined;
		get<T>(key: string, defaultValue: T): T;
	}

	export abstract class Plugin {
		abstract startPlugin(): void;
		abstract pluginWillUnload(): void;
		log(...msg: string[]): void;
		error(...msg: string[]): void;

		settings: Settings;
		entityID: unknown;
	}
}

declare module 'powercord/injector' {
	export function inject(name: string, rules: any, site: 'react', injection: (args: unknown, res: React.Component) => typeof res, preinjection?: boolean): void;
	export function inject(name: string, rules: any, site: 'sendMessage', injection: (args: unknown) => typeof args, preinjection?: boolean): void;
	export function inject(name: string, rules: any, site: 'render', injection: (args: unknown, res: unknown) => typeof res, preinjection?: boolean): void;

	export function uninject(name: string): void;
}
