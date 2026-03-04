import 'fake-indexeddb/auto';
import { initFileOps, destroyCacheDB, mockFetchForSamples, restoreFetchMock, createWorkspace } from '@/tests/helpers/test-utils';
import { useFileExplorerStore } from '@/features/file-explorer/store/file-explorer-store';
import { WorkspaceType, FileType } from '@/core/cache/types';

describe('Sample Workspace File Tree Sorting and Content', () => {
  beforeEach(async () => {
    await initFileOps();
    mockFetchForSamples();
  });

  afterEach(async () => {
    try {
      await destroyCacheDB();
    } catch (e) {
      // ignore
    }
    restoreFetchMock();
  });

  /**
   * Test Issue #1: File tree renders without sorting after reload
   * Expected: Directories should always appear before files, alphabetically sorted
   */
  it('should maintain directory-first alphabetical sorting after reloading verve-samples workspace', async () => {
    await createWorkspace('Verve Samples', WorkspaceType.Browser, 'verve-samples');
    const store = useFileExplorerStore.getState();
    await store.reloadSampleWorkspace();

    // Helper to verify sorting in a tree
    function verifySorting(nodes: any[], nodePath = '') {
      const dirs = nodes.filter(n => n.type === FileType.Directory);
      const files = nodes.filter(n => n.type === FileType.File);
      
      // Check that directories come before files
      for (let i = 0; i < nodes.length - 1; i++) {
        const curr = nodes[i];
        const next = nodes[i + 1];
        if (curr.type === FileType.File && next.type === FileType.Directory) {
          console.error(`[SORT ERROR at ${nodePath}] File '${curr.name}' appears before directory '${next.name}'`);
          return false;
        }
      }
      
      // Check alphabetical sorting within each type
      for (let i = 0; i < dirs.length - 1; i++) {
        const cmp = dirs[i].name.localeCompare(dirs[i + 1].name, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp > 0) {
          console.error(`[SORT ERROR at ${nodePath}/dirs] '${dirs[i].name}' > '${dirs[i + 1].name}'`);
          return false;
        }
      }
      for (let i = 0; i < files.length - 1; i++) {
        const cmp = files[i].name.localeCompare(files[i + 1].name, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp > 0) {
          console.error(`[SORT ERROR at ${nodePath}/files] '${files[i].name}' > '${files[i + 1].name}'`);
          return false;
        }
      }
      
      // Recursively verify children
      for (const node of dirs) {
        if (node.children && node.children.length > 0) {
          if (!verifySorting(node.children, `${nodePath}/${node.name}`)) {
            return false;
          }
        }
      }
      
      return true;
    }

    const treeAfterFirstLoad = store.getFileTree();
    console.log(`First load tree has ${treeAfterFirstLoad.length} root nodes`);
    expect(verifySorting(treeAfterFirstLoad)).toBe(true);
    console.log('✓ First load tree is properly sorted');

    // Reload the samples workspace
    await store.reloadSampleWorkspace();
    const treeAfterReload = store.getFileTree();

    console.log(`After reload tree has ${treeAfterReload.length} root nodes`);
    expect(verifySorting(treeAfterReload)).toBe(true);
    console.log('✓ After reload tree is properly sorted');

    // Verify tree size is consistent
    expect(treeAfterReload.length).toBe(treeAfterFirstLoad.length);
  });

  /**
   * Test Issue #2: Opening files after reload shows wrong content
   * Expected: File content should remain consistent across reloads
   */
  it('should correctly load file content after reloading verve-samples workspace', async () => {
    await createWorkspace('Verve Samples', WorkspaceType.Browser, 'verve-samples');
    const store = useFileExplorerStore.getState();
    
    await store.reloadSampleWorkspace();

    // Find first markdown file in tree
    function findFirstMarkdownFile(nodes: any[]): any {
      for (const node of nodes) {
        if (node.type === FileType.File && node.name?.endsWith('.md')) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = findFirstMarkdownFile(node.children);
          if (found) return found;
        }
      }
      return null;
    }

    const targetFile = findFirstMarkdownFile(store.getFileTree());
    expect(targetFile).toBeDefined();
    console.log(`Testing file: ${targetFile.path}`);

    // Load file content
    const { loadFile } = await import('@/core/cache/file-manager');
    const loaded1 = await loadFile(targetFile.path, WorkspaceType.Browser, 'verve-samples');
    
    expect(loaded1.content).toBeDefined();
    expect(loaded1.content.length).toBeGreaterThan(0);
    expect(loaded1.content).not.toContain('<html');
    expect(loaded1.content).not.toContain('<!DOCTYPE');
    
    const hash1 = Buffer.from(loaded1.content || '').toString('base64').substring(0, 20);
    console.log(`First load content hash: ${hash1}`);

    // Reload and check again
    await store.reloadSampleWorkspace();
    
    const loaded2 = await loadFile(targetFile.path, WorkspaceType.Browser, 'verve-samples');
    expect(loaded2.content).toBe(loaded1.content);
    
    const hash2 = Buffer.from(loaded2.content || '').toString('base64').substring(0, 20);
    console.log(`After reload content hash: ${hash2}`);
    expect(hash2).toBe(hash1);
    console.log('✓ Content is consistent across reloads');
  });

  /**
   * Sanity check: All sample files can be loaded without HTML artifacts
   */
  it('should load all sample files without HTML artifacts', async () => {
    await createWorkspace('Verve Samples', WorkspaceType.Browser, 'verve-samples');
    const store = useFileExplorerStore.getState();
    await store.reloadSampleWorkspace();

    const { getAllFiles, loadFile } = await import('@/core/cache/file-manager');
    const allFiles = await getAllFiles('verve-samples');

    for (const file of allFiles) {
      if (file.type === FileType.File && file.path) {
        const loaded = await loadFile(file.path, WorkspaceType.Browser, 'verve-samples');
        
        if (loaded.content) {
          // No HTML artifacts
          expect(loaded.content).not.toContain('<html');
          expect(loaded.content).not.toContain('<!DOCTYPE');
          // Markdown files should have reasonable content
          if (file.path.endsWith('.md')) {
            expect(loaded.content.length).toBeGreaterThan(0);
          }
        }
      }
    }
    console.log(`✓ All ${allFiles.length} files loaded successfully`);
  });
});
