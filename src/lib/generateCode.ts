const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Black', 'White', 'Silver', 'Gold', 'Cyan', 'Magenta', 'Lime', 'Teal', 'Indigo', 'Maroon', 'Navy'];
const animals = ['Monkey', 'Lion', 'Tiger', 'Bear', 'Elephant', 'Giraffe', 'Zebra', 'Penguin', 'Kangaroo', 'Koala', 'Panda', 'Dolphin', 'Shark', 'Whale', 'Eagle', 'Hawk', 'Owl', 'Wolf', 'Fox', 'Rabbit'];
const adjectives = ['Happy', 'Sad', 'Angry', 'Brave', 'Calm', 'Eager', 'Fierce', 'Gentle', 'Jolly', 'Kind', 'Lively', 'Proud', 'Silly', 'Smart', 'Swift', 'Wild', 'Wise', 'Zany', 'Bold', 'Cool'];

export function generateRoomCode(): string {
  const color = colors[Math.floor(Math.random() * colors.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  
  return `${color}${animal}${adjective}`;
}
