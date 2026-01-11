export type Language = 'zh' | 'en';

export interface EmergencyContact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface UserContact {
  name: string;
  email: string;
  phone: string;
}

export interface CheckInData {
  timestamp: number;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:mm
}

export interface AppState {
  userId: string;
  language: Language | null;
  lastCheckIn: number | null;
  checkInHistory: CheckInData[];
  emergencyContacts: EmergencyContact[];
  userContact: UserContact;
  streak: number;
  isRegistered: boolean;
}

export interface TranslationStrings {
  title: string;
  subtitle: string;
  checkInBtn: string;
  checkedInToday: string;
  emergencyTitle: string;
  emergencyDesc: string;
  userTitle: string;
  userDesc: string;
  settings: string;
  history: string;
  name: string;
  email: string;
  phone: string;
  save: string;
  warningTitle: string;
  warningDesc: string;
  viewSample: string;
  emailTemplate: string;
  quoteTitle: string;
  statsTitle: string;
  daysMissing: string;
  lifeValue: string;
  selectLang: string;
  streakText: string;
  consecutiveDays: string;
  statusSafe: string;
  statusPending: string;
  policyTitle: string;
  guardianLabel: string;
  addGuardian: string;
  alertStatus: string;
  protocolNote: string;
  statusRunning: string;
  statusCheck: string;
  getStarted: string;
  setupProfile: string;
  setupDesc: string;
  calendarTitle: string;
  activityLevel: string;
  timeTrend: string;
}