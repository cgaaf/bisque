// A stand-in for a server that takes a moment: refuses the username "taken", and fails for "offline".
export const register = (values, delay) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (values.username === "offline") reject(new Error("Network down"));
      else resolve(values.username === "taken" ? { username: "Already registered" } : undefined);
    }, delay);
  });
