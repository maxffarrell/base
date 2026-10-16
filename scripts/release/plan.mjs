import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!stable.test(version)) throw new Error('Release version must be stable semver');
const eventName = process.env.GITHUB_EVENT_NAME;
const event = process.env.GITHUB_EVENT_PATH
	? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
	: {};
let release = false;
const commit = git('rev-parse', 'HEAD');
if (eventName === 'workflow_dispatch') {
	if (event.inputs?.release_ref !== `v${version}`)
		throw new Error('Dispatch requires the existing version tag');
	if (git('rev-parse', `refs/tags/v${version}^{commit}`) !== commit)
		throw new Error('Dispatch must check out the release tag');
	release = true;
} else if (eventName === 'push' && event.before && !/^0+$/.test(event.before)) {
	if (!/^[a-f0-9]{40,64}$/.test(event.before)) throw new Error('Invalid previous commit');
	const previous = JSON.parse(git('show', `${event.before}:package.json`)).version;
	if (!stable.test(previous)) throw new Error('Invalid previous version');
	release = previous !== version;
	if (release) {
		const older = previous.split('.').map(Number);
		const difference = version
			.split('.')
			.map((part, i) => Number(part) - older[i])
			.find((part) => part !== 0);
		if (!(difference > 0)) throw new Error('Release version must increase');
	}
}
if (release && git('tag', '--list', `v${version}`)) {
	if (git('rev-parse', `refs/tags/v${version}^{commit}`) !== commit)
		throw new Error('Version already released from a different commit');
}
appendFileSync(
	process.env.GITHUB_OUTPUT,
	`release=${release}\nversion=${version}\ncommit=${commit}\n`
);
