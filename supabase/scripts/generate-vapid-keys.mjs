#!/usr/bin/env node
// Prints a new VAPID key pair for web push (base64url, the format the `push` function and
// browsers expect). Run once: node supabase/scripts/generate-vapid-keys.mjs
import { createECDH } from 'node:crypto';

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`);
