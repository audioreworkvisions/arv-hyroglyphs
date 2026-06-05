/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const applyInitialTheme = () => {
  try {
    const storedTheme = window.localStorage.getItem('hyroglyphis-theme');
    const useDarkMode = storedTheme !== 'light';
    document.documentElement.classList.toggle('dark', useDarkMode);
  } catch {
    document.documentElement.classList.add('dark');
  }
};

applyInitialTheme();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);