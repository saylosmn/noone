import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('Дараах мөрүүдийг server/.env (эсвэл Render-ийн Environment) руу хуулна уу:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com');
