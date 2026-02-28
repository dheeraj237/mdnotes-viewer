/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('E2E workspace switch (JSDOM)', () => {
  test('switching workspace updates file list and isolates dirty state', async () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/e2e-workspace-switch.html'), 'utf8');

    // Seed two workspaces
    const ws = [
      { id: 'ws1', name: 'Workspace One', files: [ { name: 'a.md', dirty: true }, { name: 'b.md' } ] },
      { id: 'ws2', name: 'Workspace Two', files: [ { name: 'x.md' }, { name: 'y.md', dirty: false } ] }
    ];

    // Load HTML into document
    document.documentElement.innerHTML = html;

    // Set seed before executing inline script: define global variable
    // @ts-ignore
    (global as any).__E2E_WORKSPACES = ws;

    // Extract inline script content and execute it in the page context
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    expect(scriptMatch).toBeTruthy();
    const script = scriptMatch![1];

    const s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);

    // initial render should show workspace one files
    const files = document.querySelectorAll('#files li');
    expect(files.length).toBe(2);
    expect(files[0].textContent).toMatch(/a.md/);
    expect(files[0].textContent).toMatch(/dirty/);

    // Switch to workspace two by clicking its button
    const btn = Array.from(document.querySelectorAll('#workspaces button')).find(b => b.textContent && b.textContent.includes('Workspace Two')) as HTMLButtonElement;
    expect(btn).toBeDefined();
    btn.click();

    const filesAfter = Array.from(document.querySelectorAll('#files li')).map(el => el.textContent || '');
    expect(filesAfter.length).toBe(2);
    expect(filesAfter[0]).toMatch(/x.md/);
    // ensure no 'dirty' marker present in second workspace
    expect(filesAfter.some(t => t.includes('dirty'))).toBe(false);

    // Switch back to first
    const btn1 = Array.from(document.querySelectorAll('#workspaces button')).find(b => b.textContent && b.textContent.includes('Workspace One')) as HTMLButtonElement;
    btn1.click();
    const filesBack = Array.from(document.querySelectorAll('#files li')).map(el => el.textContent || '');
    expect(filesBack[0]).toMatch(/a.md/);
    expect(filesBack[0]).toMatch(/dirty/);
  });
});
