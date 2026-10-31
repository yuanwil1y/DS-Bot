import { registerRootComponent } from 'expo';
import React from 'react';
import { FatalGate, FatalScreen, installGlobalHandler, recordError } from './src/errors';

// Startup safety: a JS error while loading the app shows an error screen instead of exiting.
installGlobalHandler();
let Root: React.ComponentType;
try {
  const App = require('./App').default;
  Root = () => React.createElement(FatalGate, null, React.createElement(App));
} catch (e) {
  recordError('startup', e);
  Root = () => React.createElement(FatalScreen, { error: e });
}
registerRootComponent(Root);
