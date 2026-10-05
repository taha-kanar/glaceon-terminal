import { app } from 'electron';
import { createMainCompositionRoot } from './composition-root';

const root = createMainCompositionRoot();

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  root.dispose();
});

void app.whenReady().then(() => {
  root.start();
});
