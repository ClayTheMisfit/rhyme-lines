const COMMON_WORDS = [
  'about', 'above', 'across', 'act', 'action', 'after', 'again', 'against', 'age', 'ago', 'air', 'all', 'almost',
  'along', 'also', 'always', 'am', 'among', 'an', 'and', 'another', 'answer', 'any', 'anyone', 'anything', 'are',
  'area', 'around', 'as', 'ask', 'at', 'away', 'back', 'bad', 'ball', 'bank', 'bar', 'base', 'be', 'beat', 'beautiful',
  'because', 'become', 'bed', 'been', 'before', 'began', 'begin', 'behind', 'being', 'believe', 'best', 'better', 'between',
  'big', 'bird', 'black', 'blue', 'body', 'book', 'both', 'box', 'boy', 'bring', 'brother', 'build', 'building', 'business',
  'but', 'buy', 'by', 'call', 'came', 'can', 'car', 'care', 'carry', 'case', 'cat', 'catch', 'cause', 'center', 'change',
  'check', 'child', 'children', 'city', 'class', 'clear', 'close', 'cold', 'color', 'come', 'common', 'company', 'complete',
  'consider', 'control', 'could', 'country', 'course', 'cut', 'day', 'dead', 'deal', 'decide', 'deep', 'develop', 'did',
  'different', 'do', 'doctor', 'does', 'dog', 'done', 'door', 'down', 'draw', 'dream', 'drive', 'during', 'each', 'early',
  'earth', 'east', 'easy', 'eat', 'either', 'else', 'end', 'enough', 'even', 'ever', 'every', 'example', 'eye', 'face',
  'fact', 'family', 'far', 'farm', 'fast', 'father', 'feel', 'feet', 'few', 'field', 'find', 'fine', 'fire', 'first',
  'fish', 'five', 'floor', 'follow', 'food', 'for', 'form', 'found', 'four', 'free', 'friend', 'from', 'front', 'full',
  'game', 'gave', 'get', 'girl', 'give', 'go', 'goal', 'good', 'got', 'government', 'great', 'green', 'ground', 'group',
  'grow', 'guess', 'had', 'half', 'hand', 'happen', 'hard', 'has', 'have', 'he', 'head', 'hear', 'heard', 'heart',
  'help', 'her', 'here', 'high', 'him', 'his', 'hit', 'hold', 'home', 'hope', 'hot', 'hour', 'house', 'how', 'however',
  'idea', 'if', 'important', 'in', 'interest', 'into', 'is', 'it', 'its', 'job', 'just', 'keep', 'key', 'kid', 'kind',
  'king', 'knew', 'know', 'land', 'large', 'last', 'late', 'later', 'laugh', 'law', 'lead', 'learn', 'leave', 'left',
  'less', 'let', 'letter', 'life', 'light', 'like', 'line', 'little', 'live', 'local', 'long', 'look', 'lot', 'love',
  'low', 'make', 'man', 'many', 'market', 'may', 'me', 'mean', 'men', 'might', 'mile', 'mind', 'mine', 'minute', 'miss',
  'money', 'month', 'more', 'most', 'mother', 'move', 'much', 'music', 'must', 'my', 'name', 'near', 'need', 'never',
  'new', 'next', 'night', 'no', 'north', 'not', 'note', 'nothing', 'now', 'number', 'of', 'off', 'often', 'oil', 'old',
  'on', 'once', 'one', 'only', 'open', 'or', 'order', 'other', 'our', 'out', 'over', 'own', 'page', 'paint', 'paper',
  'part', 'party', 'pass', 'pay', 'people', 'place', 'plan', 'play', 'point', 'police', 'power', 'press', 'problem',
  'program', 'provide', 'public', 'put', 'question', 'quick', 'quickly', 'quite', 'race', 'rain', 'ran', 'read', 'ready',
  'real', 'really', 'reason', 'record', 'red', 'remember', 'rest', 'right', 'river', 'road', 'rock', 'room', 'run',
  'said', 'same', 'saw', 'say', 'school', 'science', 'sea', 'season', 'second', 'see', 'seem', 'seen', 'sense', 'set',
  'seven', 'several', 'she', 'ship', 'short', 'shot', 'should', 'show', 'side', 'since', 'sing', 'sit', 'six', 'size',
  'sky', 'small', 'so', 'some', 'someone', 'something', 'song', 'soon', 'sound', 'south', 'special', 'speed', 'spell',
  'spring', 'spot', 'stand', 'start', 'state', 'stay', 'step', 'stop', 'story', 'street', 'strong', 'study', 'such',
  'summer', 'sun', 'system', 'take', 'talk', 'teacher', 'team', 'tell', 'ten', 'test', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'thing', 'think', 'this', 'those', 'thought', 'three', 'through', 'time',
  'to', 'together', 'told', 'too', 'took', 'top', 'total', 'toward', 'town', 'tree', 'true', 'try', 'turn', 'two',
  'under', 'until', 'up', 'upon', 'us', 'use', 'usual', 'very', 'voice', 'wait', 'walk', 'want', 'war', 'was', 'watch',
  'water', 'way', 'we', 'week', 'well', 'went', 'were', 'west', 'what', 'when', 'where', 'which', 'while', 'white',
  'who', 'why', 'will', 'win', 'wind', 'with', 'within', 'without', 'woman', 'women', 'word', 'work', 'world', 'would',
  'write', 'year', 'yes', 'yet', 'you', 'young', 'your',
  'aim', 'air', 'arm', 'art', 'ball', 'band', 'bank', 'base', 'bath', 'battle', 'bear', 'beauty', 'beer', 'bill', 'birth',
  'blood', 'boat', 'bone', 'bottom', 'boy', 'brain', 'bread', 'break', 'bright', 'brother', 'brown', 'brush', 'burn',
  'camera', 'camp', 'card', 'care', 'case', 'chair', 'chance', 'change', 'chart', 'check', 'chance', 'cheese', 'chief',
  'choice', 'church', 'circle', 'clean', 'clock', 'close', 'cloud', 'coat', 'coffee', 'corner', 'county', 'cover', 'crowd',
  'cry', 'dance', 'dark', 'date', 'daughter', 'death', 'desk', 'dress', 'drink', 'drop', 'dry', 'edge', 'egg', 'engine',
  'evening', 'event', 'example', 'face', 'fact', 'fair', 'fall', 'fan', 'farm', 'fight', 'fill', 'final', 'finger', 'flag',
  'flower', 'fly', 'forest', 'forward', 'friend', 'front', 'fruit', 'game', 'garden', 'glass', 'gold', 'grass', 'great',
  'ground', 'group', 'half', 'hall', 'hallway', 'happy', 'hard', 'head', 'health', 'heat', 'heavy', 'hill', 'history',
  'home', 'hope', 'horse', 'hotel', 'hour', 'house', 'idea', 'image', 'island', 'job', 'join', 'juice', 'jump', 'key',
  'lake', 'language', 'laugh', 'law', 'lead', 'leaf', 'left', 'leg', 'letter', 'level', 'lift', 'light', 'list', 'lock',
  'look', 'lose', 'loud', 'love', 'machine', 'main', 'major', 'mark', 'match', 'matter', 'mean', 'measure', 'meet', 'middle',
  'mile', 'milk', 'mind', 'month', 'moon', 'morning', 'mountain', 'move', 'music', 'name', 'nation', 'nature', 'neck',
  'news', 'noise', 'note', 'north', 'number', 'office', 'open', 'other', 'outside', 'page', 'paint', 'pair', 'paper',
  'parent', 'party', 'path', 'peace', 'people', 'place', 'plan', 'plant', 'play', 'point', 'power', 'price', 'print',
  'public', 'rain', 'ready', 'reason', 'record', 'rest', 'river', 'road', 'rock', 'room', 'round', 'rule', 'run', 'safe',
  'sale', 'salt', 'sand', 'save', 'school', 'sea', 'seat', 'second', 'see', 'seem', 'set', 'ship', 'shop', 'show', 'side',
  'sign', 'simple', 'sister', 'size', 'sleep', 'slow', 'small', 'snow', 'song', 'sound', 'south', 'space', 'spend',
  'sport', 'spring', 'stage', 'star', 'start', 'state', 'stay', 'step', 'stock', 'stone', 'store', 'story', 'street',
  'strong', 'style', 'summer', 'sun', 'table', 'take', 'talk', 'team', 'tell', 'term', 'test', 'thank', 'thing', 'think',
  'time', 'today', 'together', 'top', 'town', 'train', 'travel', 'tree', 'trip', 'truck', 'turn', 'under', 'use', 'view',
  'wait', 'walk', 'wall', 'want', 'warm', 'watch', 'water', 'wear', 'week', 'wheel', 'white', 'wind', 'window', 'winter',
  'woman', 'wood', 'word', 'work', 'world', 'write', 'year', 'young',
  'dot', 'dime', 'rhyme', 'prime', 'time', 'line', 'mine', 'fine', 'sign', 'shine', 'smile', 'mile', 'tile', 'while',
  'hot', 'pot', 'lot', 'not', 'got', 'shot', 'spot', 'plot', 'rot', 'cot', 'tot', 'bot', 'top', 'stop',
]

export const COMMON_ENGLISH = new Set(COMMON_WORDS)

const VOWEL_REGEX = /[aeiouy]/

export const isCommonEnglishWord = (word: string): boolean => {
  if (!word) return false
  if (word.includes("'")) return false
  if (word.length < 2) return false
  if (!VOWEL_REGEX.test(word)) return false
  return COMMON_ENGLISH.has(word)
}
