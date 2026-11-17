// A fake server: answers after `ms`.
export const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
export const refuse = (ms, message) => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
export const load = () => wait(10, "start");
