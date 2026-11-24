import { createRoot } from 'react-dom/client';

import { CreatorAgreements } from '../../components/marketplace/CreatorAgreements';

import './standalone.css';

createRoot(document.getElementById('app')!).render(<CreatorAgreements />);
