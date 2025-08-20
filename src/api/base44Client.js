//import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
//export const base44 = createClient({
  //appId: "6880a09bdee873c356e7b267", 
  //requiresAuth: true // Ensure authentication is required for all operations
//});


// src/api/base44Client.js

export const base44 = {
  async get(endpoint) {
    const res = await fetch(`/api${endpoint}`);
    if (!res.ok) throw new Error(`Failed GET ${endpoint}`);
    return res.json();
  },
  async post(endpoint, body) {
    const res = await fetch(`/api${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed POST ${endpoint}`);
    return res.json();
  }
  // add put/delete if needed
};
