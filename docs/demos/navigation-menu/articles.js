// Stands in for a server in the "content from a server" navigation menu demo: every answer takes 900ms, and
// `dropNetwork()` makes every request started in the next two seconds fail.
const ARTICLES = {
  tools: ["Choosing a spade", "Hand tools for small beds", "Looking after blades"],
  plants: ["Herbs for a windowsill", "Climbing beans", "Plants that like shade"],
};

let downUntil = 0;

export function dropNetwork() {
  downUntil = Date.now() + 2000;
}

/** The articles filed under `topic`. */
export function loadArticles(topic) {
  const down = Date.now() < downUntil;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (down) reject(new Error("The server couldn't be reached."));
      else resolve([...(ARTICLES[topic] ?? [])]);
    }, 900);
  });
}
