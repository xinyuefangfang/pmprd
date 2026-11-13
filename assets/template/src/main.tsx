import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Folder, Plus, Settings, X } from 'lucide-react';
import { previewStore } from './preview/store';
import './styles.css';

function App() {
  const [route, setRoute] = useState(location.pathname);
  const [projects, setProjects] = useState(previewStore.list);
  const [name, setName] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const update = () => setRoute(location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', path);
    setRoute(path);
  }
  function create(event: FormEvent) {
    event.preventDefault();
    previewStore.create(name);
    setProjects(previewStore.list());
    dialog.current?.close();
    setName('');
  }
  return <div className="app">
    <aside className="nav">
      <div className="brand"><Folder size={23} /> Demo Console</div>
      <nav data-prd-nav="">
        <a href="/projects" aria-current={route !== '/settings' ? 'page' : undefined} onClick={(e) => navigate(e, '/projects')}><Folder size={17} />Projects</a>
        <a href="/settings" aria-current={route === '/settings' ? 'page' : undefined} onClick={(e) => navigate(e, '/settings')}><Settings size={17} />Settings</a>
      </nav>
      <div className="identity">Demo workspace</div>
    </aside>
    <main className="content">
      <header><span>Workspace</span><span className="environment">Demo</span></header>
      {route === '/settings' ? <section>
        <div className="heading"><h1>Settings</h1></div>
        <dl><div><dt>Workspace</dt><dd>Demo workspace</dd></div><div><dt>Environment</dt><dd>Local preview</dd></div></dl>
      </section> : <section>
        <div className="heading"><h1>Projects</h1><button className="primary" data-prd="projects.create" onClick={() => dialog.current?.showModal()}><Plus size={16} />Create project</button></div>
        <div className="table-wrap" data-prd="projects.list"><table><thead><tr><th>Name</th><th>Created</th><th>Status</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><Folder size={16} />{project.name}</td><td>{project.created}</td><td><span className="status">Active</span></td></tr>)}</tbody></table></div>
      </section>}
    </main>
    <dialog ref={dialog} onClose={() => setName('')}>
      <form onSubmit={create}>
        <div className="heading"><h2>Create project</h2><button type="button" className="icon" title="Close" aria-label="Close" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
        <label htmlFor="project-name">Project name</label><input id="project-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <footer><button type="button" onClick={() => dialog.current?.close()}>Cancel</button><button className="primary" disabled={!name.trim()}>Create project</button></footer>
      </form>
    </dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
