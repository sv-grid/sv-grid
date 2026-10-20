// What the routes leave on window for the post-publish check to read.
declare global {
	interface Window {
		__check?: Record<string, unknown>;
	}
	namespace App {}
}

export {};
