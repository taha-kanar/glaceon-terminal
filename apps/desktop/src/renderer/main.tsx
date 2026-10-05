import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/400-italic.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@glaceon/ui/styles.css';
import { createRoot } from 'react-dom/client';
import { createRendererCompositionRoot } from './composition-root';

const container = document.getElementById('root');
if (container === null) throw new Error('#root element is missing');

const root = await createRendererCompositionRoot(window);
createRoot(container).render(root.render());
