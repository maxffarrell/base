import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.ts';

describe('spreadsheet-safe exports', () => {
	it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1', '\n=1+1', '  =1+1'])(
		'neutralizes untrusted formula text %j',
		(value) => {
			expect(parseCsv(toCsv([[value]]))).toEqual([[`'${value}`]]);
		}
	);
	it('preserves typed numbers and ordinary text, escaping CSV separators and line breaks', () => {
		const values = ['plain', 'a,b', 'a"b', 'a\rb', 'a\nb', '', -42, 0, null, undefined];
		expect(parseCsv(toCsv([values]))).toEqual([
			['plain', 'a,b', 'a"b', 'a\rb', 'a\nb', '', '-42', '0', '', '']
		]);
	});
});
