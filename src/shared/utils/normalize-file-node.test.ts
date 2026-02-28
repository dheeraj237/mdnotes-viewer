import { normalizeToFileNode } from './normalize-file-node';

describe('normalizeToFileNode', () => {
  test('raw with missing timestamps gets defaults', () => {
    const raw = { id: '1', name: 'a', path: '/a' };
    const node = normalizeToFileNode(raw as any);
    expect(node.id).toBe('1');
    expect(typeof node.createdAt).toBe('string');
    expect(typeof node.modifiedAt).toBe('string');
    expect(isNaN(Date.parse(node.createdAt ?? ''))).toBe(false);
    expect(isNaN(Date.parse(node.modifiedAt ?? ''))).toBe(false);
  });

  test('directory raw with children array of objects transforms correctly', () => {
    const raw = { id: 'd1', name: 'dir', path: '/dir', type: 'directory', children: [{ id: 'f1' }, { id: 'f2' }] };
    const node = normalizeToFileNode(raw as any);
    expect(node.type).toBe('directory');
    expect(node.children).toEqual(['f1', 'f2']);
  });

  test('directory raw with children array of strings preserves them', () => {
    const raw = { id: 'd2', name: 'dir2', path: '/dir2', type: 'directory', children: ['a', 'b'] };
    const node = normalizeToFileNode(raw as any);
    expect(node.type).toBe('directory');
    expect(node.children).toEqual(['a', 'b']);
  });

  test('file raw sets type file and no children', () => {
    const raw: any = { id: 'f1', name: 'file', path: '/file', type: 'file', children: ['x'] };
    const node = normalizeToFileNode(raw as any);
    expect(node.type).toBe('file');
    expect(node.children).toBeUndefined();
  });

  test('unknown fields are preserved in meta', () => {
    const raw: any = { id: 'm1', name: 'm', path: '/m', foo: 'bar', extra: 123 };
    const node = normalizeToFileNode(raw as any);
    expect(node.meta).toBeDefined();
    expect(node.meta?.foo).toBe('bar');
    expect(node.meta?.extra).toBe(123);
  });
});
