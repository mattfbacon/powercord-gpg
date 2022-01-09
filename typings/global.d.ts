import type React from 'react';

export declare namespace powercord {
	export namespace api {
		export namespace commands {
			export interface CommandResult {
				send: boolean,
				result: string,
			}
			export interface AutocompleteResult {
				header?: string,
				commands: string[]
			}
			export interface RegisterCommandOptions {
				command: string,
				description: string,
				usage: string,
				executor: () => CommandResult | undefined | Promise<CommandResult | undefined>,
				autocomplete: () => AutocompleteResult,
			}
			export function registerCommand(opts: RegisterCommandOptions): void;
		}
		export namespace settings {
			export interface RegisterSettingsOptions {
				category: string,
				label: string,
				render: React.Component,
			}
			export function registerSettings(entityID: unknown, opts: RegisterSettingsOptions): void;
		}
	}
}
