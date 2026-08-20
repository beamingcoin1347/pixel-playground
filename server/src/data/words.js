// Hangman word bank. Lowercase a-z only, 2-20 letters, so every entry satisfies the engine's
// WORD_RE. Kept deliberately guessable - no proper nouns, no abbreviations.

export const CATEGORIES = {
  animals: [
    'penguin', 'giraffe', 'dolphin', 'squirrel', 'leopard', 'tortoise', 'octopus',
    'flamingo', 'hedgehog', 'antelope', 'raccoon', 'panther', 'walrus', 'gazelle',
  ],
  food: [
    'pancake', 'avocado', 'noodles', 'pineapple', 'chocolate', 'sandwich', 'biryani',
    'dumpling', 'espresso', 'cinnamon', 'pistachio', 'lasagna', 'popcorn', 'mango',
  ],
  space: [
    'nebula', 'asteroid', 'gravity', 'eclipse', 'meteorite', 'telescope', 'galaxy',
    'orbit', 'satellite', 'comet', 'crater', 'quasar', 'starlight', 'cosmos',
  ],
  computing: [
    'keyboard', 'compiler', 'variable', 'function', 'database', 'protocol', 'pointer',
    'terminal', 'firewall', 'recursion', 'buffer', 'kernel', 'cursor', 'pixel',
  ],
  sports: [
    'cricket', 'volleyball', 'marathon', 'badminton', 'skating', 'archery', 'hurdles',
    'gymnast', 'referee', 'dribble', 'penalty', 'stadium', 'javelin', 'sprint',
  ],
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);
