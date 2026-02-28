/* Replace duplicate/incorrect implementations with a single correct normalizer.
  This version maps object children to id/path/name instead of stringifying them. */

type Raw = Record<string, any>;

function basename(p: string) {
  if (!p) return '';
  const s = String(p).replace(/\\/g, '/');
  const parts = s.split('/');
  return parts[parts.length - 1] || '';
}

const KNOWN_KEYS = new Set([
  'id',
  '_id',
  'type',
  'name',
  'path',
  'filePath',
  'parentId',
  'children',
  'size',
  'modifiedAt',
  'createdAt',
  'dirty',
  'synced',
  'isSynced',
  'version',
  'mimeType',
  'meta',
]);

function toISODate(value: any): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export type FileNode = {
  id: string;
  type: 'file' | 'directory';
  name: string;
  path: string;
  parentId?: string | null;
  children?: string[];
  size?: number;
  modifiedAt?: string;
  createdAt?: string;
  dirty?: boolean;
  synced?: boolean;
  isSynced?: boolean;
  version?: number;
  mimeType?: string;
  meta?: Record<string, any>;
};

export function normalizeToFileNode(raw: Raw): FileNode {
  const now = new Date().toISOString();

  const path = raw.path ?? raw.filePath ?? '';
  const name = raw.name ?? basename(path);
  const id = raw.id ?? raw._id ?? raw.uid ?? (path ? String(path) : undefined) ?? name ?? `${name}-${Math.random().toString(36).slice(2, 9)}`;

  const hasChildren = Array.isArray(raw.children) && raw.children.length > 0;
  let type: 'file' | 'directory';
  if (raw.type) {
    const t = String(raw.type).toLowerCase();
    type = t === 'directory' || t === 'folder' ? 'directory' : 'file';
  } else {
    type = hasChildren ? 'directory' : 'file';
  }

  const children = type === 'directory'
    ? (Array.isArray(raw.children) ? raw.children.map((c: any) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object') return String(c.id ?? c.path ?? c.name ?? JSON.stringify(c));
      return String(c);
    }) : [])
    : undefined;

  const meta: Record<string, any> = { ...(raw.meta || {}) };
  for (const k of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(k)) meta[k] = raw[k];
  }

  const node: FileNode = {
    id: String(id),
    type,
    name: String(name ?? (type === 'directory' ? 'untitled-folder' : 'untitled')),
    path: String(path ?? ''),
    parentId: raw.parentId ?? raw.parent ?? null,
    children,
    size: typeof raw.size === 'number' ? raw.size : (raw.size ? Number(raw.size) : undefined),
    modifiedAt: raw.modifiedAt ? toISODate(raw.modifiedAt) : now,
    createdAt: raw.createdAt ? toISODate(raw.createdAt) : now,
    dirty: raw.dirty === true,
    isSynced: raw.isSynced !== undefined ? raw.isSynced : (raw.synced !== undefined ? raw.synced : undefined),
    version: typeof raw.version === 'number' ? raw.version : (raw.version ? Number(raw.version) : undefined),
    mimeType: raw.mimeType ?? raw.mimetype ?? undefined,
    meta: Object.keys(meta).length ? meta : undefined,
  };

  if (node.type === 'file' && 'children' in node) delete node.children;

  return node;
}

export default normalizeToFileNode;
