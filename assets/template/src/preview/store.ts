export interface Project { id: string; name: string; created: string }

export function createPreviewStore() {
  const projects: Project[] = [
    { id: 'demo-1', name: 'Demo workspace', created: '2026-01-01' },
    { id: 'demo-2', name: 'Sample integration', created: '2026-01-02' },
  ];
  return {
    list: () => projects.map((project) => ({ ...project })),
    create(name: string) {
      if (!name.trim()) throw new Error('Enter a project name.');
      const project = { id: `demo-${projects.length + 1}`, name: name.trim(), created: new Date().toISOString().slice(0, 10) };
      projects.push(project);
      return { ...project };
    },
    unsupported(operation: string): never {
      throw new Error(`PREVIEW_ONLY: ${operation} is not implemented. No request was sent.`);
    },
  };
}

export const previewStore = createPreviewStore();
