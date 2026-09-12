export const CATEGORIES = {
  staffOnly: process.env.CATEGORY_STAFF_ONLY || '1537096123507023902',
  information: process.env.CATEGORY_INFORMATION || '1532025241856114869',
  chatRoom: process.env.CATEGORY_CHAT_ROOM || '1453703811607826595',
  studyRoom: process.env.CATEGORY_STUDY_ROOM || '1536993085890891848',
  games: process.env.CATEGORY_GAMES || '1535916023772094564',
  quizTrivia: process.env.CATEGORY_QUIZ_TRIVIA || '1535916195289767977',
  summerQuest: process.env.CATEGORY_SUMMER_QUEST || '1535918330886750239',
  summerEvents: process.env.CATEGORY_SUMMER_EVENTS || '1535918997017591889',
  recap: process.env.CATEGORY_REKAP || '1535810740932579329',
  voiceRoom: process.env.CATEGORY_VOICE_ROOM || '1453703811607826599',
  waveflixRoom: process.env.CATEGORY_WAVEFLIX_ROOM || '1537065953995788338',
  afk: process.env.CATEGORY_AFK || '1535214276556357632',
} as const;

export const CHANNELS = {
  // Staff Only
  moderator: process.env.CHANNEL_MODERATOR || '1531955366269681787',
  backup: process.env.CHANNEL_BACKUP || '1536369402419744789',
  historyServer: process.env.CHANNEL_HISTORY || '1537097359450832976',

  // Information
  rules: process.env.CHANNEL_RULES || '1531955366269681784',
  welcome: process.env.CHANNEL_WELCOME || '1535071902312169492',
  resources: process.env.CHANNEL_RESOURCES || '1532241897265828122',
  announcements: process.env.CHANNEL_ANNOUNCEMENTS || '1532238760874348554',
  inviteLink: process.env.CHANNEL_INVITE || '1532009958319849533',
  logServer: process.env.CHANNEL_LOG || '1535070933583405169',

  // Chat Room
  general: process.env.CHANNEL_GENERAL || '1453703811607826596',
  random: process.env.CHANNEL_RANDOM || '1532236708039622736',
  media: process.env.CHANNEL_MEDIA || '1532236816986669056',

  // Study Room
  language: process.env.CHANNEL_LANGUAGE || '1536995881881051186',
  study: process.env.CHANNEL_STUDY || '1536889743013314570',
  studyVoice: process.env.CHANNEL_STUDY_VOICE || '1536889743013314570',

  // Games
  suit: process.env.CHANNEL_SUIT || '1535967723836940379',
  duel: process.env.CHANNEL_DUEL || '1535968024937500722',
  hunt: process.env.CHANNEL_HUNT || '1535916648765063300',
  games: process.env.CHANNEL_GAMES || '1535916450533998632',
  cards: process.env.CHANNEL_CARDS || '1535916677173354577',
  tatsumaki: process.env.CHANNEL_TATSUMAKI || '1535917342201221140',
  guessNumber: process.env.CHANNEL_GUESS_NUMBER || '1535967600520073306',
  chain: process.env.CHANNEL_CHAIN || '1536719492334362626',

  // Quiz & Trivia
  trivia: process.env.CHANNEL_TRIVIA || '1535917622036791367',
  akinator: process.env.CHANNEL_AKINATOR || '1535917843965550692',

  // Summer Quest
  quest: process.env.CHANNEL_QUEST || '1535918526156767242',

  // Summer Events
  contest: process.env.CHANNEL_CONTEST || '1535920856658874460',
  volleyball: process.env.CHANNEL_VOLLEYBALL || '1535919366426730506',
  karaoke: process.env.CHANNEL_KARAOKE || '1535921034891628645',
  song: process.env.CHANNEL_SONG || '1535919887673856073',
  balloon: process.env.CHANNEL_BALLOON || '1535920221884518452',

  // Rekap
  recap: process.env.CHANNEL_RECAP || '1535836590264557599',
  statistics: process.env.CHANNEL_STATISTICS || '1535960574263820338',
  summerGames: process.env.CHANNEL_SUMMER_GAMES || '1535810881634570372',

  // Voice Room
  pantaiUtara: process.env.CHANNEL_VOICE_PANTAI_UTARA || '1453704065979646083',
  pantaiSelatan: process.env.CHANNEL_VOICE_PANTAI_SELATAN || '1536886429429268540',
  pantaiTimur: process.env.CHANNEL_VOICE_PANTAI_TIMUR || '1536886487445016747',
  pantaiBarat: process.env.CHANNEL_VOICE_PANTAI_BARAT || '1536886534115037232',
  panggung: process.env.CHANNEL_VOICE_PANGGUNG || '1536886710116556810',

  // WaveFlix Room
  waveflix: process.env.CHANNEL_WAVEFLIX || '1537224641062506557',
  waveflixRoom1: process.env.CHANNEL_WAVEFLIX_ROOM_1 || '1537067400665767956',
  waveflixRoom2: process.env.CHANNEL_WAVEFLIX_ROOM_2 || '1537067445255409705',
  waveflixRoom3: process.env.CHANNEL_WAVEFLIX_ROOM_3 || '1537067535986597898',
  waveflixRoom4: process.env.CHANNEL_WAVEFLIX_ROOM_4 || '1537067576071430287',
  waveflixRoom5: process.env.CHANNEL_WAVEFLIX_ROOM_5 || '1537067607751139348',

  // AFK
  afkLog: process.env.CHANNEL_AFK_LOG || '1535214549765197834',
  afkVoice: process.env.CHANNEL_AFK || '1532240730653851769',
} as const;

export type ChannelRules = Record<string, readonly string[]>;

export function isCommandAllowed(commandName: string, channelId: string, rules: ChannelRules): boolean {
  return rules[commandName]?.includes(channelId) ?? false;
}

export function commandChannelMessage(commandName: string, rules: ChannelRules): string {
  const channels = rules[commandName] ?? [];
  const mentions = channels.map((channelId) => `<#${channelId}>`).join(' atau ');
  return `Perintah \`/${commandName}\` tidak berlaku di channel ini. Gunakan di ${mentions || 'channel yang sudah dikonfigurasi'}.`;
}