// Everything demo-only lives in this folder. To remove it when a real backend
// arrives: delete src/demo, src/api/mock/options.js usage of failNext if wanted,
// and remove the <DemoControls /> lines in the pages and the /reset route in App.jsx.
import { isShared } from '../api';
import { DemoControls as MockDemoControls } from './DemoControls';

// The panel simulates other people inside the mock backend. With the shared backend
// real people sign in on their own devices, so the panel is not shown.
export const DemoControls = isShared ? () => null : MockDemoControls;
export { ResetPage } from './ResetPage';
