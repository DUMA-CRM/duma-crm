import assert from 'node:assert/strict';
import test from 'node:test';

const { cn } = await import('../lib/utils/cn.ts');

test('custom type sizes survive a colour class', () => {
  assert.equal(cn('text-label', 'text-primary-foreground'), 'text-label text-primary-foreground');
  assert.equal(cn('text-micro text-muted-foreground'), 'text-micro text-muted-foreground');
});

test('a later size still replaces an earlier one', () => {
  assert.equal(cn('text-label', 'text-sm'), 'text-sm');
  assert.equal(cn('text-sm', 'text-metric'), 'text-metric');
});
