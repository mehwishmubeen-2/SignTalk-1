// Mock data for sign language dictionary used in dashboard favourite 
export interface SignData {
  id: string;
  word: string;
  category: string;
  videoUrl: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const signDictionary: SignData[] = [
  {
    id: '1',
    word: 'hello',
    category: 'greetings',
    videoUrl: 'https://example.com/signs/hello.mp4',
    description: 'A common greeting gesture - wave your hand near your head',
    difficulty: 'beginner'
  },
  {
    id: '2',
    word: 'thank you',
    category: 'greetings',
    videoUrl: 'https://example.com/signs/thank-you.mp4',
    description: 'Touch fingers to chin and move hand forward',
    difficulty: 'beginner'
  },
  {
    id: '3',
    word: 'please',
    category: 'greetings',
    videoUrl: 'https://example.com/signs/please.mp4',
    description: 'Circular motion on chest with flat hand',
    difficulty: 'beginner'
  },
  {
    id: '4',
    word: 'sorry',
    category: 'emotions',
    videoUrl: 'https://example.com/signs/sorry.mp4',
    description: 'Circular motion on chest with fist',
    difficulty: 'beginner'
  },
  {
    id: '5',
    word: 'yes',
    category: 'common',
    videoUrl: 'https://example.com/signs/yes.mp4',
    description: 'Nod fist up and down like a head nodding',
    difficulty: 'beginner'
  },
  {
    id: '6',
    word: 'no',
    category: 'common',
    videoUrl: 'https://example.com/signs/no.mp4',
    description: 'Snap index and middle finger with thumb',
    difficulty: 'beginner'
  },
  {
    id: '7',
    word: 'help',
    category: 'common',
    videoUrl: 'https://example.com/signs/help.mp4',
    description: 'Place fist on flat palm and lift together',
    difficulty: 'beginner'
  },
  {
    id: '8',
    word: 'friend',
    category: 'relationships',
    videoUrl: 'https://example.com/signs/friend.mp4',
    description: 'Link index fingers twice, alternating which is on top',
    difficulty: 'beginner'
  },
  {
    id: '9',
    word: 'family',
    category: 'relationships',
    videoUrl: 'https://example.com/signs/family.mp4',
    description: 'F handshape, make a circle with both hands',
    difficulty: 'beginner'
  },
  {
    id: '10',
    word: 'love',
    category: 'emotions',
    videoUrl: 'https://example.com/signs/love.mp4',
    description: 'Cross fists over heart',
    difficulty: 'intermediate'
  },
  {
    id: '11',
    word: 'happy',
    category: 'emotions',
    videoUrl: 'https://example.com/signs/happy.mp4',
    description: 'Brush chest upward with flat hands twice',
    difficulty: 'beginner'
  },
  {
    id: '12',
    word: 'sad',
    category: 'emotions',
    videoUrl: 'https://example.com/signs/sad.mp4',
    description: 'Hands slide down face from eyes',
    difficulty: 'beginner'
  },
  {
    id: '13',
    word: 'eat',
    category: 'actions',
    videoUrl: 'https://example.com/signs/eat.mp4',
    description: 'Bring flat O hand to mouth',
    difficulty: 'beginner'
  },
  {
    id: '14',
    word: 'drink',
    category: 'actions',
    videoUrl: 'https://example.com/signs/drink.mp4',
    description: 'C hand shape, tip to mouth like holding a cup',
    difficulty: 'beginner'
  },
  {
    id: '15',
    word: 'sleep',
    category: 'actions',
    videoUrl: 'https://example.com/signs/sleep.mp4',
    description: 'Flat hand slides down face, eyes close',
    difficulty: 'beginner'
  },
  {
    id: '16',
    word: 'good morning',
    category: 'greetings',
    videoUrl: 'https://example.com/signs/good-morning.mp4',
    description: 'Sign good then morning (sun rising)',
    difficulty: 'intermediate'
  },
  {
    id: '17',
    word: 'goodbye',
    category: 'greetings',
    videoUrl: 'https://example.com/signs/goodbye.mp4',
    description: 'Open and close hand in waving motion',
    difficulty: 'beginner'
  },
  {
    id: '18',
    word: 'understand',
    category: 'common',
    videoUrl: 'https://example.com/signs/understand.mp4',
    description: 'Flick index finger up near temple',
    difficulty: 'intermediate'
  }
];

export const categories = [
  'all',
  'greetings',
  'emotions',
  'common',
  'relationships',
  'actions'
];
