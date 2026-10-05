import '@glaceon/ui/styles.css';
import { createRoot } from 'react-dom/client';
import { createRendererCompositionRoot } from './composition-root';

const container = document.getElementById('root');
if (container === null) throw new Error('#root element is missing');

const root = await createRendererCompositionRoot(window);
createRoot(container).render(root.render());
