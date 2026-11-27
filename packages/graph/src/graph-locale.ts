import { createContext, useContext } from 'react';
import { en } from './core/index.js';
export const GraphLocale = createContext(en);
export const useGraphLocale = () => useContext(GraphLocale);
