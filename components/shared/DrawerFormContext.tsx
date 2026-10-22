'use client';

import { createContext, useContext } from 'react';

export const DrawerFormContext = createContext(false);
export const useDrawerForm = () => useContext(DrawerFormContext);
