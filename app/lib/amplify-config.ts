'use client';

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// Import Amplify configuration
import outputs from '@/amplify_outputs.json';

// Configure Amplify
Amplify.configure(outputs);

// Create data client
export const dataClient = generateClient<Schema>();

// Re-export for convenience
export { Amplify };