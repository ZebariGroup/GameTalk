export const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'crap', 'dick', 'pussy', 
  'cock', 'slut', 'whore', 'bastard', 'cunt', 'fag', 'faggot', 'nigger', 
  'nigga', 'spic', 'chink', 'twat', 'wanker', 'motherfucker'
];

export function filterProfanity(text: string): { cleanText: string, hasProfanity: boolean } {
  let cleanText = text;
  let hasProfanity = false;
  
  // Replace bad words with silly kid-friendly alternatives
  const sillyReplacements = ['🦄', '💩', '🥦', '🤡', '🦖', '[bleep]'];
  
  const regex = new RegExp(`\\b(${BAD_WORDS.join('|')})\\b`, 'gi');
  
  if (regex.test(text)) {
    hasProfanity = true;
    cleanText = text.replace(regex, () => {
      return sillyReplacements[Math.floor(Math.random() * sillyReplacements.length)];
    });
  }
  
  return { cleanText, hasProfanity };
}
