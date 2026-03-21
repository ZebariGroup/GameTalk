const adjectives = [
  'Sneaky', 'Super', 'Mega', 'Flying', 'Invisible', 'Magic', 'Cosmic', 
  'Hyper', 'Turbo', 'Ninja', 'Robot', 'Ghost', 'Shadow', 'Neon', 'Pixel',
  'Captain', 'Doctor', 'Professor', 'Agent', 'Detective'
];

const nouns = [
  'Taco', 'Burrito', 'Potato', 'Waffle', 'Noodle', 'Pickle', 'Marshmallow',
  'Dinosaur', 'Unicorn', 'Dragon', 'Alien', 'Monster', 'Zombie', 'Vampire',
  'Cheetah', 'Panther', 'Falcon', 'Shark', 'Octopus', 'Penguin'
];

export function generateName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 99) + 1; // 1-99
  
  return `${adjective}${noun}${number}`;
}
